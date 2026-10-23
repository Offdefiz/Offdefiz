"""Telegram Bot API integration, restricted to owner-authorized groups and opt-in actions."""
import os
import json
import urllib.request
import urllib.error
import threading
import time
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from db import connect, one, change, event, report
from sales_service import handle_private, overview as sales_overview

BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN','').strip()
OWNER_ID = os.environ.get('TELEGRAM_OWNER_ID','').strip()
WEBHOOK_SECRET = os.environ.get('TELEGRAM_WEBHOOK_SECRET','').strip()
BOT_API_BASE = os.environ.get('TELEGRAM_API_BASE', 'https://api.telegram.org').rstrip('/')
lock = threading.Lock()

def api(method, data):
    if not BOT_TOKEN:
        raise RuntimeError('Token do bot não configurado.')
    req = urllib.request.Request(f'{BOT_API_BASE}/bot{BOT_TOKEN}/{method}',
      data=json.dumps(data).encode('utf-8'), headers={'Content-Type':'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=12) as f:
            result = json.load(f)
    except urllib.error.HTTPError as err:
        raise RuntimeError(f'Telegram HTTP {err.code}') from err
    except urllib.error.URLError as err:
        raise RuntimeError('Não foi possível conectar ao Telegram.') from err
    if not result.get('ok'):
        raise RuntimeError(str(result.get('description','Erro na API Telegram'))[:200])
    return result['result']

def send(chat_id, text):
    return api('sendMessage', {'chat_id':str(chat_id), 'text':text[:4096], 'disable_web_page_preview':True})

def verify_bot_admin(chat_id):
    bot = api('getMe', {})
    info = api('getChatMember', {'chat_id':str(chat_id), 'user_id':bot['id']})
    return info.get('status') in ('administrator','creator') and bool(info.get('can_post_messages',True))

def verify_owner_admin(chat_id):
    """The bot account's owner must also be a real administrator of this chat."""
    if not OWNER_ID:
        return False
    member = api('getChatMember', {'chat_id':str(chat_id), 'user_id':int(OWNER_ID)})
    return member.get('status') in ('administrator','creator')

def register_group(chat):
    chat_id = str(chat['id'])
    username = str(chat.get('username') or '').strip().lstrip('@')
    catalog_url = 'https://t.me/'+username if username else ''
    if not verify_bot_admin(chat_id):
        raise ValueError('Adicione o bot como administrador antes de registrar.')
    if not verify_owner_admin(chat_id):
        raise ValueError('O proprietário do bot também precisa ser administrador deste grupo/canal.')
    with connect() as cx:
        old = cx.execute('SELECT id FROM groups WHERE chat_id=?',(chat_id,)).fetchone()
        if not old and catalog_url:
            old = cx.execute('SELECT id FROM groups WHERE url=? AND chat_id IS NULL',(catalog_url,)).fetchone()
        if old:
            cx.execute('UPDATE groups SET chat_id=?,name=?,kind=?,authorized=1,active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?',
                       (chat_id,str(chat.get('title','Grupo'))[:140], 'canal' if chat.get('type')=='channel' else 'grupo',old['id']))
            rowid = old['id']
        else:
            rowid = cx.execute('INSERT INTO groups(chat_id,name,url,authorized,kind) VALUES (?,?,?,1,?)',
                    (chat_id, str(chat.get('title','Grupo'))[:140], catalog_url, 'canal' if chat.get('type')=='channel' else 'grupo')).lastrowid
    event('grupo_ativado', f'Grupo {rowid} autorizado por proprietário')
    return rowid

def publish(post_id):
    with lock:
        with connect() as cx:
            post = cx.execute('''SELECT p.*, g.chat_id, g.authorized, g.active FROM posts p
                JOIN groups g ON g.id=p.group_id WHERE p.id=?''',(post_id,)).fetchone()
            if not post or post['status']!='aprovado' or not post['authorized'] or not post['active'] or not post['chat_id']:
                raise ValueError('Publicação não aprovada ou grupo sem autorização.')
            if not verify_bot_admin(post['chat_id']) or not verify_owner_admin(post['chat_id']):
                raise ValueError('A administração do bot ou do proprietário mudou; publicação bloqueada.')
            # Prevent duplicates on concurrent scheduler/owner actions; if Telegram times out after
            # accepting a message this remains in verification_pending for human review.
            cx.execute("UPDATE posts SET status='enviando',error='' WHERE id=?",(post_id,))
        try:
            msg = send(post['chat_id'], post['body'])
        except Exception as ex:
            change('UPDATE posts SET status=?,error=? WHERE id=?',('verificar_envio',str(ex)[:250],post_id))
            event('envio_incerto',f'Post {post_id}: verificar antes de tentar novamente')
            raise
        change("UPDATE posts SET status='enviado',telegram_message_id=?,sent_at=CURRENT_TIMESTAMP WHERE id=?",
               (msg.get('message_id'),post_id))
        event('post_enviado',str(post_id))
        return msg.get('message_id')

def audit_groups():
    if not BOT_TOKEN:
        return
    from db import rows
    for group in rows('SELECT id,chat_id FROM groups WHERE authorized=1 AND active=1 AND chat_id IS NOT NULL LIMIT 150'):
        try:
            count = int(api('getChatMemberCount', {'chat_id':group['chat_id']}))
            change('UPDATE groups SET member_count=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', (count,group['id']))
        except Exception as ex:
            event('falha_auditoria', f"Grupo {group['id']}: {type(ex).__name__}")

def send_due():
    if not BOT_TOKEN:
        return
    from db import rows
    scheduled = rows("SELECT id FROM posts WHERE status='aprovado' AND due_at IS NOT NULL AND due_at <= ? ORDER BY due_at LIMIT 8",
                     (datetime.now(timezone.utc).isoformat(timespec='seconds'),))
    for row in scheduled:
        try:
            publish(row['id'])
        except Exception as ex:
            event('falha_publicacao', f"Post {row['id']}: {str(ex)[:100]}")

def daily_report():
    """Send at most one aggregated daily report to the configured owner.

    Only aggregate indicators from this system; never quote group chat content.
    """
    if not BOT_TOKEN or not OWNER_ID:
        return False
    try:
        hour = int(os.environ.get('OPS_DAILY_REPORT_HOUR','8'))
        if not 0 <= hour <= 23:
            return False
        tz = ZoneInfo(os.environ.get('OPS_REPORT_TIMEZONE', 'America/Sao_Paulo'))
        now = datetime.now(tz)
        if now.hour < hour:
            return False
        key = now.date().isoformat()
        with connect() as cx:
            cur=cx.execute('INSERT OR IGNORE INTO daily_runs(kind,run_date) VALUES (?,?)',('relatorio_diario',key))
            if not cur.rowcount:
                return False
        try:
            send(OWNER_ID, format_report('Relatório diário — '+key))
        except Exception:
            change('DELETE FROM daily_runs WHERE kind=? AND run_date=?',('relatorio_diario',key))
            raise
        return True
    except (ValueError,KeyError):
        return False

def format_report(title='TELEGRAM OPS — Relatório'):
    r=report()
    brl=lambda n:f'R$ {n/100:,.2f}'.replace(',','X').replace('.',',').replace('X','.')
    return (title+'\n'+f"Grupos: {r['groups']} ({r['managed_groups']} autorizados)\n"
        +f"Oportunidades: {r['opportunities']}\nLeads: {r['leads']}\n"
        +f"Posts enviados: {r['posts_sent']}\nPosts pendentes: {r['pending_posts']}\n"
        +f"Saldo lançado: {brl(r['balance_cents'])}")

def scheduled_research():
    """Once-daily sync of pre-authorized external RSS feeds, when configured."""
    from radar_service import run_research
    now=datetime.now(ZoneInfo(os.environ.get('OPS_REPORT_TIMEZONE','America/Sao_Paulo')))
    if now.hour < 7:
        return False
    if not one('SELECT 1 FROM radar_feeds WHERE active=1 LIMIT 1'):
        return False
    key=now.date().isoformat()
    with connect() as cx:
        c=cx.execute('INSERT OR IGNORE INTO daily_runs(kind,run_date) VALUES (?,?)',('radar_externo',key))
        if not c.rowcount:
            return False
    run_research()
    return True

def scheduler(stop):
    last_audit=0
    while not stop.is_set():
        send_due()
        try:
            scheduled_research()
        except Exception as ex:
            event('falha_radar',type(ex).__name__)
        try:
            daily_report()
        except Exception as ex:
            event('falha_relatorio_diario',type(ex).__name__)
        if time.monotonic()-last_audit>3600 or last_audit==0:
            audit_groups()
            last_audit=time.monotonic()
        stop.wait(45)

def handle_update(update):
    update_id = update.get('update_id')
    if not isinstance(update_id,int):
        return
    with connect() as cx:
        if cx.execute('SELECT 1 FROM processed_updates WHERE update_id=?',(update_id,)).fetchone():
            return
        cx.execute('INSERT INTO processed_updates(update_id) VALUES (?)',(update_id,))
    # Telegram notifies whenever the bot itself is removed or demoted.
    member_event = update.get('my_chat_member')
    if member_event:
        chat = member_event.get('chat') or {}
        new_status = (member_event.get('new_chat_member') or {}).get('status')
        if new_status not in ('administrator','creator'):
            chat_id=str(chat.get('id',''))
            change('UPDATE groups SET active=0,authorized=0,updated_at=CURRENT_TIMESTAMP WHERE chat_id=?',(chat_id,))
            event('acesso_revogado',f'Comunidade {chat_id}: bot não é mais administrador')
        return
    msg = update.get('message') or update.get('channel_post')
    if not msg:
        return
    chat = msg.get('chat') or {}
    sender = msg.get('from') or {}
    user_id = str(sender.get('id',''))
    content = msg.get('text','').strip()
    cmd = content.split()[0].split('@')[0].lower() if content.startswith('/') else ''
    chat_id = str(chat.get('id',''))
    if cmd=='/meuid' and chat.get('type')=='private':
        send(chat_id, f'Seu ID Telegram é: {user_id}. Configure TELEGRAM_OWNER_ID com esse valor.')
        return
    # Count activity only in opted-in groups, without storing authors or message bodies.
    if chat.get('type') in ('group','supergroup'):
        if one('SELECT id FROM groups WHERE chat_id=? AND authorized=1 AND active=1',(chat_id,)) and not cmd:
            change('UPDATE groups SET message_count=message_count+1 WHERE chat_id=?',(chat_id,))
    # Sales queries are answered only after the person contacts the bot voluntarily.
    if chat.get('type')=='private' and handle_private(msg, send, OWNER_ID):
        return
    if not OWNER_ID or user_id != OWNER_ID:
        return
    if chat.get('type') in ('group','supergroup'):
        if cmd == '/registrar':
            try:
                rowid=register_group(chat)
                send(chat_id,f'Grupo registrado no Telegram OPS (ID interno {rowid}). Publicações exigem aprovação.')
            except Exception as ex:
                send(chat_id, f'Não foi possível registrar: {str(ex)[:180]}')
        if cmd=='/desativar':
            change('UPDATE groups SET active=0,authorized=0 WHERE chat_id=?',(chat_id,))
            send(chat_id, 'Grupo desativado no Telegram OPS.')
        return
    if chat.get('type')!='private':
        return
    if cmd in ('/start','/ajuda'):
        send(chat_id, 'TELEGRAM OPS\n/status — indicadores\n/relatorio — resumo comercial\n/grupos — grupos cadastrados\n/oportunidades — oportunidades\n/meuid — identificar conta\n/vincular @canal — conectar canal público\nUse /registrar dentro de grupos onde você e o bot sejam administradores.')
    elif cmd in ('/status','/relatorio'):
        send(chat_id,format_report())
    elif cmd=='/vincular':
        ref = content.partition(' ')[2].strip()
        if not ref or not (ref.startswith('@') or ref.lstrip('-').isdigit()):
            send(chat_id, 'Use /vincular @seucanal ou o ID numérico da comunidade. O bot e você devem ser administradores.')
        else:
            try:
                found = api('getChat',{'chat_id':ref})
                if found.get('type') not in ('channel','group','supergroup'):
                    raise ValueError('O destino não é uma comunidade.')
                rowid=register_group(found)
                send(chat_id,f'Comunidade {found.get("title","sem nome")} vinculada (ID interno {rowid}).')
            except Exception as ex:
                send(chat_id,f'Não foi possível vincular: {str(ex)[:160]}')
    elif cmd=='/grupos':
        from db import rows
        gs=rows('SELECT name,authorized,member_count FROM groups ORDER BY id DESC LIMIT 20')
        send(chat_id, 'Grupos:\n'+('\n'.join(f"• {g['name']} — {'ativo' if g['authorized'] else 'catálogo'} — {g['member_count']} membros" for g in gs) or '(nenhum)'))
    elif cmd=='/comercial':
        stats=sales_overview()
        send(chat_id,f"OPSPULSE — Vendas\nInteressados: {stats['visitors']}\nInscritos nos avisos: {stats['subscribed']}\nPedidos registrados: {stats['orders']}")
    elif cmd=='/oportunidades':
        from db import rows
        os_=rows('SELECT title,score,status FROM opportunities ORDER BY score DESC LIMIT 10')
        send(chat_id, 'Oportunidades:\n'+('\n'.join(f"• {o['title']} — nota {o['score']}/100 — {o['status']}" for o in os_) or '(nenhuma)'))
    # Never auto-send commercial offers or message private third parties.
    if chat.get('type') == 'private' and cmd:
        event('comando_bot',cmd[:64])