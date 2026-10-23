import os, tempfile, sys, unittest, json, threading, urllib.request, urllib.error, http.server, time
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
TEMP=tempfile.TemporaryDirectory()
os.environ['OPS_DB_PATH']=str(Path(TEMP.name)/'test.sqlite3')
os.environ['OPS_PASSWORD']='test_password_12345678'
os.environ['OPS_SESSION_SECRET']='test_long_session_secret_123456789'
os.environ['OPS_HOST']='127.0.0.1'
import db
import telegram_service as t
import app
import radar_service as radar

class OpsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db.init()
        cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),app.Handler)
        cls.port=cls.server.server_port
        cls.worker=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.worker.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();TEMP.cleanup()
    def http(self,method,path,data=None,session=None,csrf=None):
        headers={}
        if session: headers['Cookie']='ops='+session
        if csrf: headers['X-CSRF-Token']=csrf
        if data is not None: headers['Content-Type']='application/json'
        req=urllib.request.Request(f'http://127.0.0.1:{self.port}{path}',
                data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method)
        try:
            with urllib.request.urlopen(req,timeout=3) as res: return res.status,json.load(res)
        except urllib.error.HTTPError as ex:
            return ex.code,json.load(ex)
    def test_00_security_and_health(self):
        self.assertEqual(self.http('GET','/health')[0],200)
        self.assertEqual(self.http('GET','/api/overview')[0],401)
        self.assertEqual(self.http('POST','/api/groups',{'name':'test'})[0],401)
        self.assertEqual(self.http('POST','/telegram/webhook',{'update_id':1})[0],403)
    def test_01_flow(self):
        cookie=app.make_cookie(); csrf=app.xsrf(cookie)
        self.assertEqual(self.http('POST','/api/groups',{'name':'Grupo demonstração'},cookie)[0],403)
        code,g=self.http('POST','/api/groups',{'name':'Grupo demonstração','url':'https://t.me/exemplo'},cookie,csrf)
        self.assertEqual(code,201)
        self.assertFalse(g['authorized'])
        group=g['id']
        code,o=self.http('POST','/api/opportunities',{'title':'Gestão comercial','score':90},cookie,csrf)
        self.assertEqual(code,201)
        code,l=self.http('POST','/api/leads',{'name':'Cliente teste'},cookie,csrf)
        self.assertEqual(code,201)
        code,f=self.http('POST','/api/finance',{'type':'entrada','description':'Cliente piloto','amount':'149.90'},cookie,csrf)
        self.assertEqual(code,201)
        code,p=self.http('POST','/api/posts',{'group_id':group,'body':'Post de teste'},cookie,csrf)
        self.assertEqual(code,201)
        code,err=self.http('POST',f"/api/posts/{p['id']}/approve",{},cookie,csrf)
        self.assertEqual(code,400)
        self.assertIn('autorizado',err['error'])
        code,r=self.http('GET','/api/overview',session=cookie)
        self.assertEqual(code,200)
        self.assertGreaterEqual(r['groups'],1)
        self.assertGreaterEqual(r['opportunities'],1)
        self.assertGreaterEqual(r['leads'],1)
        self.assertEqual(r['balance_cents'],14990)
        self.assertEqual(self.http('POST','/api/finance',{'type':'entrada','description':'bad','amount':'0.001'},cookie,csrf)[0],400)
        self.assertEqual(self.http('POST','/api/groups',{'name':'X','url':'javascript:alert(1)'},cookie,csrf)[0],400)
    def test_02_telegram_owner_registration(self):
        with patch.object(t,'OWNER_ID','4321'),patch.object(t,'BOT_TOKEN','fake'),patch.object(t,'verify_bot_admin',return_value=True),patch.object(t,'verify_owner_admin',return_value=True),patch.object(t,'send') as send:
            update={'update_id':88001,'message':{'chat':{'id':-10099,'title':'Grupo piloto','type':'supergroup'},'from':{'id':4321},'text':'/registrar'}}
            t.handle_update(update)
            result=db.one('SELECT * FROM groups WHERE chat_id=?',('-10099',))
            self.assertEqual(result['authorized'],1)
            t.handle_update(update)
            self.assertEqual(send.call_count,1)
            # Another user cannot register a group even with a valid update.
            t.handle_update({'update_id':88002,'message':{'chat':{'id':-10055,'title':'X','type':'group'},'from':{'id':9999},'text':'/registrar'}})
            self.assertIsNone(db.one('SELECT id FROM groups WHERE chat_id=?',('-10055',)))
    def test_03_publishing_requires_approval_and_owner(self):
        group=db.one('SELECT * FROM groups WHERE chat_id=?',('-10099',))
        p=db.change('INSERT INTO posts(group_id,body) VALUES (?,?)',(group['id'],'Teste'))
        with patch.object(t,'BOT_TOKEN','fake'), patch.object(t,'verify_bot_admin',return_value=True),patch.object(t,'verify_owner_admin',return_value=True),patch.object(t,'send',return_value={'message_id':12}) as sender:
            with self.assertRaises(ValueError): t.publish(p)
            self.assertEqual(sender.call_count,0)
            db.change("UPDATE posts SET status='aprovado' WHERE id=?",(p,))
            self.assertEqual(t.publish(p),12)
            self.assertEqual(sender.call_count,1)
            self.assertEqual(db.one('SELECT status FROM posts WHERE id=?',(p,))['status'],'enviado')
            with self.assertRaises(ValueError):t.publish(p)
            self.assertEqual(sender.call_count,1)

    def test_04_registration_requires_owner_admin(self):
        with patch.object(t,'OWNER_ID','4321'), patch.object(t,'verify_bot_admin',return_value=True), patch.object(t,'verify_owner_admin',return_value=False), patch.object(t,'send') as send:
            t.handle_update({'update_id':88003,'message':{'chat':{'id':-10066,'title':'Grupo sem permissão','type':'group'},'from':{'id':4321},'text':'/registrar'}})
            self.assertIsNone(db.one('SELECT id FROM groups WHERE chat_id=?',('-10066',)))
            self.assertIn('administrador', send.call_args.args[1])
    def test_05_admin_revocation_disables_group(self):
        with patch.object(t,'OWNER_ID','4321'):
            t.handle_update({'update_id':88004,'my_chat_member':{'chat':{'id':-10099,'type':'supergroup'},'new_chat_member':{'status':'left'}}})
            r=db.one('SELECT authorized,active FROM groups WHERE chat_id=?',('-10099',))
            self.assertEqual((r['authorized'],r['active']),(0,0))
    def test_06_daily_report_is_single_per_local_day(self):
        with patch.object(t,'BOT_TOKEN','fake'),patch.object(t,'OWNER_ID','4321'),patch.dict(os.environ,{'OPS_DAILY_REPORT_HOUR':'0','OPS_REPORT_TIMEZONE':'America/Sao_Paulo'}),patch.object(t,'send') as send:
            self.assertTrue(t.daily_report())
            self.assertFalse(t.daily_report())
            self.assertEqual(send.call_count,1)
            self.assertIn('Relatório diário',send.call_args.args[1])
    def test_07_channel_registration_by_private_command(self):
        with patch.object(t,'BOT_TOKEN','fake'),patch.object(t,'OWNER_ID','4321'),patch.object(t,'verify_bot_admin',return_value=True),patch.object(t,'verify_owner_admin',return_value=True),patch.object(t,'api',return_value={'id':-10088,'title':'Canal piloto','type':'channel'}),patch.object(t,'send') as send:
            t.handle_update({'update_id':88005,'message':{'chat':{'id':4321,'type':'private'},'from':{'id':4321},'text':'/vincular @canalpiloto'}})
            group=db.one('SELECT * FROM groups WHERE chat_id=?',('-10088',))
            self.assertEqual(group['kind'],'canal')
            self.assertEqual(group['authorized'],1)
            self.assertIn('vinculada',send.call_args.args[1])

    def test_08_pipeline_status_changes_are_authorized(self):
        cookie=app.make_cookie(); csrf=app.xsrf(cookie)
        code,l=self.http('POST','/api/leads',{'name':'Lead de teste'},cookie,csrf)
        self.assertEqual(code,201)
        self.assertEqual(self.http('POST',f"/api/leads/{l['id']}/stage",{'stage':'ganho'})[0],401)
        self.assertEqual(self.http('POST',f"/api/leads/{l['id']}/stage",{'stage':'ganho'},cookie,csrf)[0],200)
        self.assertEqual(db.one('SELECT stage FROM leads WHERE id=?',(l['id'],))['stage'],'ganho')
        self.assertEqual(self.http('POST',f"/api/leads/{l['id']}/stage",{'stage':'excluido'},cookie,csrf)[0],400)
        code,o=self.http('POST','/api/opportunities',{'title':'Teste oportunidade'},cookie,csrf)
        self.assertEqual(code,201)
        self.assertEqual(self.http('POST',f"/api/opportunities/{o['id']}/status",{'status':'negociacao'},cookie,csrf)[0],200)
        self.assertEqual(db.one('SELECT status FROM opportunities WHERE id=?',(o['id'],))['status'],'negociacao')

    def test_09_owner_configures_external_radar(self):
        cookie=app.make_cookie(); csrf=app.xsrf(cookie)
        self.assertEqual(self.http('POST','/api/feeds',{'name':'RSS inválido','url':'http://localhost:8080/'},cookie,csrf)[0],400)
        self.assertEqual(self.http('POST','/api/feeds',{'name':'RSS Telegram','url':'https://t.me/test'},cookie,csrf)[0],400)
        code,r=self.http('POST','/api/feeds',{'name':'Publicações de negócios','url':'https://example.com/feed.xml'},cookie,csrf)
        self.assertEqual(code,201)
        self.assertTrue(r['id'])
        with patch.object(radar,'fetch_feed',return_value=[
            ('Parceria de marketing para comunidade','https://example.com/oportunidade/123'),
            ('Comunidade com propostas comerciais','https://t.me/grupo'),
            ('Tema irrelevante para pesquisa','https://example.com/outro')]):
            code,res=self.http('POST','/api/radar/run',{},cookie,csrf)
            self.assertEqual(code,200)
            self.assertEqual(res['new'],1)
            code,res=self.http('POST','/api/radar/run',{},cookie,csrf)
            self.assertEqual(res['new'],0)
        self.assertIsNotNone(db.one('SELECT id FROM opportunities WHERE source_url=?',('https://example.com/oportunidade/123',)))
        self.assertIsNone(db.one('SELECT id FROM opportunities WHERE source_url=?',('https://t.me/grupo',)))

if __name__=='__main__':unittest.main()