"""Telegram OPS: zero-dependency private business console + Telegram webhook.

Run: OPS_PASSWORD='a-long-password' python app.py
Never expose this service publicly without HTTPS and persistent storage.
"""
import os
import json
import re
import hmac
import time
import hashlib
import secrets
import threading
from datetime import datetime, timezone
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from http import cookies

from db import connect, init, rows, one, change, event, report
from telegram_service import handle_update, send_due, publish, scheduler, BOT_TOKEN, OWNER_ID, WEBHOOK_SECRET, send
from radar_service import validate_feed_url, run_research
from sales_service import overview as sales_overview, campaign_link, normalize_code, setting_group_link, broadcast_preview, create_notice, send_notice_batch

ROOT = Path(__file__).parent
PASSWORD = os.environ.get('OPS_PASSWORD') or secrets.token_urlsafe(16)
SECRET = (os.environ.get('OPS_SESSION_SECRET') or secrets.token_urlsafe(32)).encode('utf-8')
PUBLIC_URL = (os.environ.get('OPS_PUBLIC_URL') or os.environ.get('RENDER_EXTERNAL_URL') or '').rstrip('/')
PORT = int(os.environ.get('PORT','8080'))
BIND = os.environ.get('OPS_HOST','127.0.0.1')
COOKIE_SECURE = PUBLIC_URL.startswith('https://')
stop = threading.Event()
LOGIN_ATTEMPTS={}

def as_json(value):
    return json.dumps(value, ensure_ascii=False, default=str).encode('utf-8')

def make_cookie():
    val=f'{int(time.time())}.{secrets.token_urlsafe(16)}'
    sig=hmac.new(SECRET,val.encode(),hashlib.sha256).hexdigest()
    return f'{val}.{sig}'

def is_auth(cookie):
    try:
        val, sig=cookie.rsplit('.',1)
        timestamp=int(val.split('.',1)[0])
        if not (0 <= time.time()-timestamp < 12*3600):
            return False
        expected=hmac.new(SECRET,val.encode(),hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig,expected)
    except (ValueError, IndexError, AttributeError):
        return False

def xsrf(cookie):
    return hmac.new(SECRET, ('csrf:'+cookie).encode(), hashlib.sha256).hexdigest()

def parse_due(s):
    if not s: return None
    try:
        d=datetime.fromisoformat(str(s).replace('Z','+00:00'))
        if d.tzinfo is None: raise ValueError()
        return d.astimezone(timezone.utc).isoformat(timespec='seconds')
    except ValueError: raise ValueError('Use data ISO 8601 com fuso horário.')

def check_url(url):
    if not url: return url
    parsed=urlparse(url)
    if parsed.scheme not in ('https','http') or not parsed.netloc:
        raise ValueError('URL deve começar com https:// ou http:// e ter um domínio válido.')
    return url

def string(data, name, maxlen=200, required=False):
    s=str(data.get(name,'')).strip()
    if required and not s: raise ValueError(f'Campo obrigatório: {name}.')
    if len(s)>maxlen: raise ValueError(f'Campo {name} muito longo.')
    return s

class Handler(BaseHTTPRequestHandler):
    server_version='TelegramOPS/0.1'
    def log_message(self, fmt, *args):
        # Never log query parameters or sensitive message contents.
        print(f'[{self.log_date_time_string()}] {self.client_address[0]} {self.command} {self.path.split("?")[0]}', flush=True)
    def reply(self, status, body, content_type='application/json; charset=utf-8', headers=None):
        if isinstance(body,dict) or isinstance(body,list): body=as_json(body)
        elif isinstance(body,str): body=body.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type',content_type)
        self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','DENY')
        self.send_header('Referrer-Policy','no-referrer')
        self.send_header('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'")
        if headers:
            for k,v in headers.items(): self.send_header(k,v)
        self.end_headers()
        self.wfile.write(body)
    def data(self):
        try: length=int(self.headers.get('Content-Length','0'))
        except ValueError: raise ValueError('Content-Length inválido.')
        if length>65536 or length<0: raise ValueError('Limite de 64 KB por requisição.')
        raw=self.rfile.read(length)
        if 'application/json' in self.headers.get('Content-Type',''):
            value=json.loads(raw or '{}')
            if not isinstance(value,dict): raise ValueError('Esperado objeto JSON.')
            return value
        return {k:v[0] for k,v in parse_qs(raw.decode('utf-8')).items()}
    def cookie(self):
        jar=cookies.SimpleCookie()
        try: jar.load(self.headers.get('Cookie',''))
        except cookies.CookieError: return ''
        return jar['ops'].value if 'ops' in jar else ''
    def authorized(self):
        return is_auth(self.cookie())
    def redirect(self, to):
        self.send_response(303)
        self.send_header('Location',to)
        self.send_header('Content-Length','0')
        self.send_header('Cache-Control','no-store')
        self.end_headers()
    def do_GET(self):
        path=urlparse(self.path).path
        if path=='/health': return self.reply(200,{'ok':True, 'app':'Telegram OPS'})
        if path=='/login':
            page=(ROOT/'static/login.html').read_bytes()
            return self.reply(200,page,'text/html; charset=utf-8')
        if not self.authorized():
            if path.startswith('/api/'): return self.reply(401,{'error':'Login necessário.'})
            return self.redirect('/login')
        if path in ('/','/dashboard'):
            return self.reply(200,(ROOT/'static/index.html').read_bytes(),'text/html; charset=utf-8')
        if path in ('/style.css','/app.js'):
            return self.reply(200,(ROOT/'static'/path[1:]).read_bytes(),
                              'text/css; charset=utf-8' if path.endswith('.css') else 'text/javascript; charset=utf-8')
        if path=='/api/session': return self.reply(200,{'csrf':xsrf(self.cookie())})
        if path=='/api/status':
            return self.reply(200,{'bot_configured':bool(BOT_TOKEN),'owner_configured':bool(OWNER_ID),
               'webhook_configured':bool(WEBHOOK_SECRET),'public_url_configured':bool(PUBLIC_URL),'storage':'SQLite local'})
        if path=='/api/overview': return self.reply(200,report())
        if path=='/api/sales/overview': return self.reply(200,sales_overview())
        if path=='/api/sales/notifications':
            return self.reply(200,rows('SELECT id,body,created_at FROM sales_notifications ORDER BY id DESC LIMIT 20'))
        if path=='/api/sales/settings':
            return self.reply(200,{'group_link':(one("SELECT value FROM sales_settings WHERE key='group_link'") or {}).get('value','')})
        if path=='/api/sales/campaigns':
            campaigns=rows('SELECT id,code,title,active FROM sales_campaigns ORDER BY id DESC LIMIT 100')
            for c in campaigns: c['url']=campaign_link(c['code'])
            return self.reply(200,campaigns)
        if path=='/api/sales/products':
            return self.reply(200,rows('SELECT id,name,description,price_cents,active FROM sales_products ORDER BY id DESC LIMIT 100'))
        if path=='/api/sales/orders':
            return self.reply(200,rows('SELECT o.id, o.product_id,o.price_cents,o.status,o.created_at,p.name AS product,v.name AS customer,v.username AS contact FROM sales_orders o JOIN sales_products p ON p.id=o.product_id JOIN sales_visitors v ON v.tg_id=o.tg_id ORDER BY o.id DESC LIMIT 100'))

        tables={'/api/groups':'SELECT * FROM groups ORDER BY id DESC LIMIT 500',
                '/api/opportunities':'SELECT * FROM opportunities ORDER BY score DESC,id DESC LIMIT 500',
                '/api/leads':'SELECT * FROM leads ORDER BY id DESC LIMIT 500',
                '/api/posts':'''SELECT p.*,g.name AS group_name FROM posts p JOIN groups g ON g.id=p.group_id ORDER BY p.id DESC LIMIT 500''',
                '/api/finance':'SELECT * FROM finance ORDER BY id DESC LIMIT 500',
                '/api/events':'SELECT * FROM events ORDER BY id DESC LIMIT 30',
                '/api/feeds':'SELECT id,name,url,active FROM radar_feeds ORDER BY id DESC LIMIT 100'}
        if path in tables: return self.reply(200,rows(tables[path]))
        if path=='/api/report':
            v=report()
            v['lead_stages']=rows('SELECT stage,COUNT(*) n FROM leads GROUP BY stage ORDER BY n DESC')
            v['opportunity_categories']=rows('SELECT category,COUNT(*) n FROM opportunities GROUP BY category ORDER BY n DESC')
            v['post_statuses']=rows('SELECT status,COUNT(*) n FROM posts GROUP BY status')
            return self.reply(200,v)
        return self.reply(404,{'error':'Não encontrado.'})
    def do_POST(self):
        path=urlparse(self.path).path
        if path=='/telegram/webhook':
            # Missing secret is a hard fail: never allow unauthenticated external events.
            if not WEBHOOK_SECRET or not hmac.compare_digest(self.headers.get('X-Telegram-Bot-Api-Secret-Token',''),WEBHOOK_SECRET):
                return self.reply(403,{'error':'Webhook inválido.'})
            try:
                handle_update(self.data())
                return self.reply(200,{'ok':True})
            except Exception as e:
                # Telegram may redeliver; update dedup suppresses reprocessing.
                event('erro_webhook',type(e).__name__)
                return self.reply(500,{'error':'Erro ao processar evento.'})
        if path=='/login':
            ip=self.client_address[0]
            attempts=[x for x in LOGIN_ATTEMPTS.get(ip,[]) if time.time()-x<600]
            if len(attempts)>=6: return self.reply(429,'Tentativas demais. Tente novamente mais tarde.','text/plain; charset=utf-8')
            try: data=self.data()
            except Exception: return self.reply(400,'Requisição inválida.','text/plain; charset=utf-8')
            if not hmac.compare_digest(str(data.get('password','')),PASSWORD):
                attempts.append(time.time()); LOGIN_ATTEMPTS[ip]=attempts
                return self.reply(401,'Senha incorreta.','text/plain; charset=utf-8')
            LOGIN_ATTEMPTS.pop(ip,None)
            cookie=make_cookie()
            self.send_response(303)
            self.send_header('Location','/')
            self.send_header('Set-Cookie','ops='+cookie+'; HttpOnly; Path=/; SameSite=Strict; Max-Age=43200'+('; Secure' if COOKIE_SECURE else ''))
            self.send_header('Content-Length','0')
            self.end_headers(); return
        if not self.authorized(): return self.reply(401,{'error':'Login necessário.'})
        if not hmac.compare_digest(self.headers.get('X-CSRF-Token',''),xsrf(self.cookie())):
            return self.reply(403,{'error':'Token CSRF inválido.'})
        try:
            data=self.data()
            if path=='/api/sales/campaigns':
                code=normalize_code(string(data,'code',32,True))
                title=string(data,'title',100,True)
                if one('SELECT 1 FROM sales_campaigns WHERE code=?',(code,)):
                    raise ValueError('Esta campanha já existe.')
                ident=change('INSERT INTO sales_campaigns(code,title) VALUES (?,?)',(code,title))
                return self.reply(201,{'id':ident,'link':campaign_link(code)})
            if path=='/api/sales/products':
                from decimal import Decimal,InvalidOperation
                name=string(data,'name',130,True)
                description=string(data,'description',600)
                try:
                    value=Decimal(str(data.get('price','')))
                    cents=value*100
                    if not cents.is_finite() or cents!=cents.to_integral_value() or cents<0 or cents>10**11: raise ValueError()
                except (InvalidOperation,ValueError): raise ValueError('Preço inválido. Use 49.90, por exemplo.')
                ident=change('INSERT INTO sales_products(name,description,price_cents) VALUES (?,?,?)',(name,description,int(cents)))
                return self.reply(201,{'id':ident})
            if path=='/api/sales/notifications':
                ident=create_notice(string(data,'body',1000,True))
                return self.reply(201,{'id':ident,'eligible':broadcast_preview(),'sent':0})
            match_notice=re.fullmatch(r'/api/sales/notifications/(\d+)/send',path)
            if match_notice:
                if not BOT_TOKEN or not OWNER_ID:
                    raise ValueError('Configure o bot e proprietário antes de enviar avisos.')
                if data.get('confirm') is not True:
                    raise ValueError('Confirmação expressa necessária.')
                return self.reply(200,send_notice_batch(int(match_notice[1]),send))
            if path=='/api/sales/settings':
                url=setting_group_link(string(data,'group_link',250))
                return self.reply(200,{'group_link':url})
            match_sales_order=re.fullmatch(r'/api/sales/orders/(\d+)/status',path)
            if match_sales_order:
                ident=int(match_sales_order[1]); status=string(data,'status',25,True)
                if status not in ('aguardando','em_contato','pago_confirmado','cancelado'):
                    raise ValueError('Status inválido.')
                if not one('SELECT 1 FROM sales_orders WHERE id=?',(ident,)):
                    return self.reply(404,{'error':'Pedido não encontrado'})
                change('UPDATE sales_orders SET status=? WHERE id=?',(status,ident))
                event('pedido_status',f'{ident}:{status}')
                return self.reply(200,{'id':ident,'status':status})
            if path=='/api/feeds':
                name=string(data,'name',100,True)
                url=validate_feed_url(string(data,'url',500,True))
                if one('SELECT id FROM radar_feeds WHERE url=?',(url,)):
                    raise ValueError('Fonte RSS já cadastrada.')
                fid=change('INSERT INTO radar_feeds(name,url) VALUES (?,?)',(name,url))
                event('radar_fonte_adicionada',f'Fonte {fid}')
                return self.reply(201,{'id':fid})
            if path=='/api/radar/run':
                return self.reply(200,run_research())
            if path=='/api/groups':
                name=string(data,'name',140,True); url=check_url(string(data,'url',400))
                kind=string(data,'kind',20) or 'grupo'
                if kind not in ('grupo','canal'): raise ValueError('Tipo de comunidade inválido.')
                gid=change('INSERT INTO groups(name,url,kind,authorized) VALUES (?,?,?,0)',(name,url,kind))
                event('grupo_catalogado',str(gid)); return self.reply(201,{'id':gid,'authorized':False})
            if path=='/api/opportunities':
                title=string(data,'title',180,True); category=string(data,'category',40) or 'parceria'
                url=check_url(string(data,'source_url',400)); notes=string(data,'notes',1200)
                score=int(data.get('score',50));
                if not 0<=score<=100: raise ValueError('Nota deve ser entre 0 e 100.')
                oid=change('INSERT INTO opportunities(title,category,source_url,score,notes) VALUES (?,?,?,?,?)',(title,category,url,score,notes))
                event('oportunidade_criada',str(oid)); return self.reply(201,{'id':oid})
            if path=='/api/leads':
                name=string(data,'name',160,True); contact=string(data,'contact',180)
                interest=string(data,'interest',200); notes=string(data,'notes',1000)
                lid=change('INSERT INTO leads(name,contact,interest,notes) VALUES (?,?,?,?)',(name,contact,interest,notes))
                event('lead_criado',str(lid)); return self.reply(201,{'id':lid})
            if path=='/api/finance':
                t=string(data,'type',10,True)
                if t not in ('entrada','saida'): raise ValueError('Tipo deve ser entrada ou saída.')
                description=string(data,'description',200,True)
                # BRL values accepted as decimal with a dot (input[type=number]).
                from decimal import Decimal, InvalidOperation
                try:
                    amount=Decimal(str(data.get('amount','0')))
                    cents=amount*100
                    if not cents.is_finite() or cents!=cents.to_integral_value() or not 0<=cents<=10**11: raise ValueError()
                except (ValueError,InvalidOperation): raise ValueError('Valor monetário inválido.')
                fid=change('INSERT INTO finance(type,description,amount_cents) VALUES (?,?,?)',(t,description,int(cents)))
                event('lancamento_financeiro',str(fid)); return self.reply(201,{'id':fid})
            stage_match=re.fullmatch(r'/api/leads/(\d+)/stage',path)
            if stage_match:
                lid=int(stage_match[1]); stage=string(data,'stage',30,True)
                if stage not in ('novo','qualificado','proposta','negociacao','ganho','perdido'):
                    raise ValueError('Etapa comercial inválida.')
                if not one('SELECT id FROM leads WHERE id=?',(lid,)):
                    return self.reply(404,{'error':'Lead não encontrado.'})
                change('UPDATE leads SET stage=? WHERE id=?',(stage,lid))
                event('lead_atualizado',f'Lead {lid} alterado para {stage}')
                return self.reply(200,{'id':lid,'stage':stage})
            opportunity_match=re.fullmatch(r'/api/opportunities/(\d+)/status',path)
            if opportunity_match:
                oid=int(opportunity_match[1]); status=string(data,'status',30,True)
                if status not in ('novo','analisando','contato_autorizado','negociacao','convertido','descartado'):
                    raise ValueError('Status da oportunidade inválido.')
                if not one('SELECT id FROM opportunities WHERE id=?',(oid,)):
                    return self.reply(404,{'error':'Oportunidade não encontrada.'})
                change('UPDATE opportunities SET status=? WHERE id=?',(status,oid))
                event('oportunidade_atualizada',f'Oportunidade {oid} alterada para {status}')
                return self.reply(200,{'id':oid,'status':status})
            if path=='/api/posts':
                gid=int(data.get('group_id','0')); content=string(data,'body',4096,True)
                group=one('SELECT * FROM groups WHERE id=?',(gid,))
                if not group: raise ValueError('Grupo não encontrado.')
                due=parse_due(data.get('due_at'))
                pid=change('INSERT INTO posts(group_id,body,due_at) VALUES (?,?,?)',(gid,content,due))
                event('rascunho_criado',str(pid)); return self.reply(201,{'id':pid,'status':'rascunho'})
            match=re.fullmatch(r'/api/posts/(\d+)/(approve|cancel|publish)',path)
            if match:
                pid=int(match[1]); action=match[2]
                post=one('SELECT * FROM posts WHERE id=?',(pid,))
                if not post: return self.reply(404,{'error':'Publicação não encontrada.'})
                if action=='approve':
                    if post['status']!='rascunho': raise ValueError('Apenas rascunhos podem ser aprovados.')
                    gp=one('SELECT * FROM groups WHERE id=?',(post['group_id'],))
                    if not gp['authorized'] or not gp['active'] or not gp['chat_id']:
                        raise ValueError('Grupo ainda não autorizado pelo proprietário.')
                    change("UPDATE posts SET status='aprovado' WHERE id=?",(pid,))
                    event('publicacao_aprovada',str(pid)); return self.reply(200,{'status':'aprovado'})
                if action=='cancel':
                    if post['status'] not in ('rascunho','aprovado'): raise ValueError('Essa publicação não pode ser cancelada.')
                    change("UPDATE posts SET status='cancelado' WHERE id=?",(pid,))
                    event('publicacao_cancelada',str(pid)); return self.reply(200,{'status':'cancelado'})
                if action=='publish':
                    if post['status']!='aprovado': raise ValueError('Aprove o rascunho antes de publicar.')
                    mid=publish(pid)
                    return self.reply(200,{'status':'enviado','telegram_message_id':mid})
            if path=='/api/scheduler/run':
                send_due(); return self.reply(200,{'ok':True})
            return self.reply(404,{'error':'Rota não encontrada.'})
        except (ValueError,TypeError,KeyError,json.JSONDecodeError) as e:
            return self.reply(400,{'error':str(e)[:220]})
        except Exception as e:
            event('erro_interno',type(e).__name__)
            return self.reply(500,{'error':'Falha interna; verifique o log do servidor.'})

def serve():
    init()
    if not os.environ.get('OPS_PASSWORD'):
        print('\nATENÇÃO: senha temporária gerada, configure OPS_PASSWORD para uso permanente.\nSenha temporária: '+PASSWORD+'\n',flush=True)
    if BIND not in ('127.0.0.1','localhost','::1'):
        if not PUBLIC_URL.startswith('https://'):
            raise RuntimeError('Hospedagem externa exige OPS_PUBLIC_URL=https://... (TLS obrigatório).')
        if not os.environ.get('OPS_PASSWORD') or not os.environ.get('OPS_SESSION_SECRET'):
            raise RuntimeError('Hospedagem externa exige OPS_PASSWORD e OPS_SESSION_SECRET configurados.')
    if BOT_TOKEN and (not OWNER_ID or not WEBHOOK_SECRET):
        print('AVISO: configure TELEGRAM_OWNER_ID e TELEGRAM_WEBHOOK_SECRET antes de usar o bot.',flush=True)
    t=threading.Thread(target=scheduler,args=(stop,),daemon=True)
    t.start()
    server=ThreadingHTTPServer((BIND,PORT),Handler)
    print(f'Telegram OPS disponível em http://{BIND}:{PORT}',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally:
        stop.set(); server.server_close()

if __name__=='__main__': serve()