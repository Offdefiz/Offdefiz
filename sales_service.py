"""Opt-in Telegram sales funnel. No unsolicited first-contact DMs or auto-payment fulfilment."""
import os
import re
from urllib.parse import urlparse
from db import connect, one, rows, change, event

BOT_USERNAME = os.getenv('OPS_BOT_USERNAME', 'Opspulsbot').lstrip('@')


def normalize_code(code):
    code = str(code or '').strip().lower()
    if not re.fullmatch(r'[a-z0-9_-]{1,32}', code):
        raise ValueError('Código: 1-32 letras minúsculas, números, _ ou -.')
    return code


def campaign_link(code):
    return f'https://t.me/{BOT_USERNAME}?start=c_{normalize_code(code)}'


def menu(chat_id, send):
    send(chat_id,
      'OPSPULSE | CONTEÚDO DIGITAL\n\n'
      'Bem-vindo! Aqui você encontra as opções disponíveis e pode tirar suas dúvidas.\n\n'
      '/catalogo — produtos e preços\n'
      '/entrar — informações para entrar no grupo\n'
      '/ajuda — atendimento e perguntas frequentes\n'
      '/avisos — receber novidades (opcional)\n'
      '/parar — cancelar avisos\n'
      '/apagarme — apagar seus dados do cadastro')


def capture(sender, start_payload=''):
    """Persist only sender-provided Telegram metadata from their explicit private /start."""
    tg_id = str(sender.get('id') or '')
    if not tg_id.isdigit(): return None
    name = (sender.get('first_name') or 'Visitante')[:100]
    uname = (sender.get('username') or '')[:100]
    source = 'direto'
    if start_payload.startswith('c_'):
        try:
            code = normalize_code(start_payload[2:])
            if one('SELECT id FROM sales_campaigns WHERE code=? AND active=1',(code,)):
                source=code
        except ValueError: pass
    with connect() as cx:
        exists=cx.execute('SELECT tg_id,source FROM sales_visitors WHERE tg_id=?',(tg_id,)).fetchone()
        if exists:
            cx.execute('UPDATE sales_visitors SET name=?,username=?,last_seen=CURRENT_TIMESTAMP WHERE tg_id=?', (name,uname,tg_id))
        else:
            cx.execute('INSERT INTO sales_visitors(tg_id,name,username,source) VALUES (?,?,?,?)', (tg_id,name,uname,source))
    event('visitante_iniciou', 'origem: '+source)
    return tg_id


def overview():
    total=one('SELECT COUNT(*) n FROM sales_visitors')['n']
    opts=one('SELECT COUNT(*) n FROM sales_visitors WHERE allow_updates=1')['n']
    orders=one('SELECT COUNT(*) n FROM sales_orders')['n']
    return {'visitors':total,'subscribed':opts,'orders':orders,
            'by_campaign':rows('SELECT source,COUNT(*) visits FROM sales_visitors GROUP BY source ORDER BY visits DESC LIMIT 30')}


def product_list():
    return rows('SELECT id,name,description,price_cents FROM sales_products WHERE active=1 ORDER BY id LIMIT 30')


def brl(cents):
    return f'R$ {cents//100:,}'.replace(',','.')+f',{cents%100:02d}'


def show_catalog(chat_id, send):
    products=product_list()
    if not products:
        return send(chat_id,'Nosso catálogo está sendo preparado. Volte em breve ou envie /ajuda.')
    text='CATÁLOGO OPSPULSE\n\n'+'\n\n'.join(
        f"{p['id']}. {p['name']} — {brl(p['price_cents'])}\n{p['description'][:220]}\nPara solicitar: /comprar {p['id']}" for p in products)
    return send(chat_id,text)


def handle_private(msg,send,owner_id=''):
    """Handle voluntary private inbound messages only. Return True if consumed."""
    chat=msg.get('chat') or {}
    if chat.get('type')!='private': return False
    sender=msg.get('from') or {}
    tg_id=str(sender.get('id') or '')
    if not tg_id or sender.get('is_bot'): return False
    chat_id=str(chat.get('id'))
    text=str(msg.get('text') or '').strip()
    cmd = text.split(maxsplit=1)[0].split('@')[0].lower() if text.startswith('/') else ''
    args=text.partition(' ')[2].strip()
    if cmd=='/start':
        capture(sender, args)
        menu(chat_id,send)
        return True
    if cmd in ('/catalogo','/produtos','/precos'):
        if not one('SELECT 1 FROM sales_visitors WHERE tg_id=?',(tg_id,)):
            capture(sender)
        show_catalog(chat_id,send)
        return True
    if cmd=='/entrar':
        link=one("SELECT value FROM sales_settings WHERE key='group_link'")
        url=link['value'] if link else ''
        if url:
            send(chat_id,'Para conhecer o grupo, acesse: '+url+'\nA entrada e eventuais compras seguem as condições informadas pela administração.')
        else:
            send(chat_id,'O acesso ao grupo ainda não foi liberado. Consulte /catalogo ou /ajuda.')
        return True
    if cmd in ('/ajuda','/faq'):
        send(chat_id,'Atendimento Opspulse\n\nConsulte /catalogo para preços e /entrar para o grupo. Para comprar, use /comprar N (o número do item). Pagamento e entrega são confirmados manualmente. Para parar novidades, /parar. Nunca envie senhas, documentos ou dados bancários aqui.')
        return True
    if cmd=='/avisos':
        if not one('SELECT 1 FROM sales_visitors WHERE tg_id=?',(tg_id,)):
            capture(sender)
        change('UPDATE sales_visitors SET allow_updates=1 WHERE tg_id=?',(tg_id,))
        send(chat_id,'Você autorizou avisos comerciais do Opspulse. Pode cancelar quando quiser com /parar.')
        return True
    if cmd=='/parar':
        change('UPDATE sales_visitors SET allow_updates=0 WHERE tg_id=?',(tg_id,))
        send(chat_id,'Avisos desativados. Você não receberá novidades comerciais.')
        return True
    if cmd=='/apagarme':
        with connect() as cx:
            cx.execute('DELETE FROM sales_notification_receipts WHERE tg_id=?',(tg_id,))
            cx.execute('DELETE FROM sales_orders WHERE tg_id=?',(tg_id,))
            cx.execute('DELETE FROM sales_visitors WHERE tg_id=?',(tg_id,))
        send(chat_id,'Cadastro e pedidos vinculados a este ID apagados deste sistema. Registros operacionais e mensagens já existentes no Telegram podem continuar fora dele.')
        return True
    if cmd=='/comprar':
        if not one('SELECT 1 FROM sales_visitors WHERE tg_id=?',(tg_id,)):
            capture(sender)
        try: pid=int(args)
        except (ValueError,TypeError):
            send(chat_id,'Use /comprar 1, substituindo 1 pelo número exibido em /catalogo.')
            return True
        prod=one('SELECT id,name,price_cents FROM sales_products WHERE id=? AND active=1',(pid,))
        if not prod:
            send(chat_id,'Produto indisponível. Consulte /catalogo.')
            return True
        with connect() as cx:
            order_id=cx.execute('INSERT INTO sales_orders(tg_id,product_id,price_cents) VALUES (?,?,?)',(tg_id,pid,prod['price_cents'])).lastrowid
        send(chat_id,f"Solicitação #{order_id} registrada: {prod['name']} ({brl(prod['price_cents'])}).\nAinda não houve pagamento nem liberação. Aguarde as instruções de um responsável. Não pague links de terceiros que se apresentem como nosso atendimento.")
        if owner_id and owner_id!=tg_id:
            try: send(owner_id,f"OPSPULSE — Novo pedido #{order_id}\nProduto: {prod['name']}\nValor: {brl(prod['price_cents'])}\nCliente ID: {tg_id}\nConfirme o pagamento manualmente antes de qualquer entrega.")
            except Exception: event('alerta_pedido_falhou',str(order_id))
        event('pedido_criado',str(order_id))
        return True
    return False


def setting_group_link(url):
    url=url.strip()
    if url:
        p=urlparse(url)
        if p.scheme!='https' or p.hostname not in ('t.me','telegram.me') or not p.path or p.path=='/':
            raise ValueError('Informe link válido https://t.me/...')
    with connect() as cx:
        cx.execute('INSERT INTO sales_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',('group_link',url))
    return url


def broadcast_preview():
    return one('SELECT COUNT(*) n FROM sales_visitors WHERE allow_updates=1')['n']

def create_notice(body):
    body=str(body).strip()
    if not 5<=len(body)<=1000:
        raise ValueError('Mensagem de aviso: 5 a 1000 caracteres.')
    return change('INSERT INTO sales_notifications(body) VALUES (?)',(body,))

def send_notice_batch(notice_id, sender, max_batch=20):
    """Owner-approved batches only to explicitly subscribed visitors. No automatic retries."""
    import time
    notice=one('SELECT id,body FROM sales_notifications WHERE id=?',(notice_id,))
    if not notice: raise ValueError('Aviso não encontrado.')
    receivers=rows('SELECT tg_id FROM sales_visitors WHERE allow_updates=1 AND tg_id NOT IN (SELECT tg_id FROM sales_notification_receipts WHERE notification_id=?) ORDER BY tg_id LIMIT ?', (notice_id,min(max_batch,20)))
    good=failed=0
    for visitor in receivers:
        tg_id=visitor['tg_id']
        with connect() as cx:
            enabled=cx.execute('SELECT allow_updates FROM sales_visitors WHERE tg_id=?',(tg_id,)).fetchone()
            if not enabled or not enabled['allow_updates']: continue
            inserted=cx.execute('INSERT OR IGNORE INTO sales_notification_receipts(notification_id,tg_id,status) VALUES (?,?,?)',(notice_id,tg_id,'verificar_envio'))
            if not inserted.rowcount: continue
        try:
            sender(tg_id,notice['body']+'\n\nPara cancelar avisos: /parar')
            change('UPDATE sales_notification_receipts SET status=? WHERE notification_id=? AND tg_id=?',('enviado',notice_id,tg_id))
            good+=1
        except Exception as ex:
            change('UPDATE sales_notification_receipts SET status=?,detail=? WHERE notification_id=? AND tg_id=?',('falha_verificar',type(ex).__name__,notice_id,tg_id))
            failed+=1
        time.sleep(0.15)
    remaining=one('SELECT COUNT(*) n FROM sales_visitors WHERE allow_updates=1 AND tg_id NOT IN (SELECT tg_id FROM sales_notification_receipts WHERE notification_id=?)',(notice_id,))['n']
    event('aviso_lote',f'{notice_id}: enviados={good} falhas={failed} restantes={remaining}')
    return {'sent':good,'failed':failed,'remaining':remaining}