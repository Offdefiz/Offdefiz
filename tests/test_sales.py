import sys, os, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
os.environ.setdefault('OPS_DB_PATH',str(ROOT/'test_sales_temp.sqlite3'))
import db, telegram_service as t, sales_service as s

class SalesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        cls.old=db.DB_PATH
        db.DB_PATH=Path(cls.tmp.name)/'sales.sqlite3'
        db.init()
    @classmethod
    def tearDownClass(cls):
        db.DB_PATH=cls.old
        cls.tmp.cleanup()
    def msg(self, ident, text, from_id=123):
        return {'update_id':ident,'message':{'chat':{'id':from_id,'type':'private'},'from':{'id':from_id,'first_name':'Consumidor','username':'interessado'},'text':text}}
    def test_01_referral_capture_and_catalog(self):
        db.change('INSERT INTO sales_campaigns(code,title) VALUES (?,?)',('lista_a','Parceiro A'))
        db.change('INSERT INTO sales_products(name,description,price_cents) VALUES (?,?,?)',('E-book autorizado','Conteúdo digital de teste',2590))
        with patch.object(t,'OWNER_ID','999'),patch.object(t,'send') as send:
            t.handle_update(self.msg(99001,'/start c_lista_a'))
            self.assertEqual(db.one("SELECT source FROM sales_visitors WHERE tg_id='123'")['source'],'lista_a')
            self.assertIn('OPSPULSE',send.call_args.args[1])
            t.handle_update(self.msg(99002,'/catalogo'))
            self.assertIn('R$ 25,90',send.call_args.args[1])
    def test_02_interest_purchase_no_payment_claim(self):
        with patch.object(t,'OWNER_ID','999'),patch.object(t,'send') as send:
            t.handle_update(self.msg(99003,'/comprar 1'))
            self.assertIn('Ainda não houve pagamento',send.call_args_list[0].args[1])
            self.assertEqual(db.one('SELECT COUNT(*) n FROM sales_orders')['n'],1)
    def test_03_optin_and_nospam(self):
        sent=[]
        s.capture({'id':456,'first_name':'Pessoa'})
        notice=s.create_notice('Nova coleção publicada!')
        self.assertEqual(s.send_notice_batch(notice,lambda *args:sent.append(args))['sent'],0)
        self.assertEqual(sent,[])
        with patch.object(t,'OWNER_ID','999'),patch.object(t,'send'):
            t.handle_update(self.msg(99004,'/avisos',456))
        self.assertEqual(s.send_notice_batch(notice,lambda *args:sent.append(args))['sent'],1)
        self.assertEqual(len(sent),1)
        self.assertEqual(s.send_notice_batch(notice,lambda *args:sent.append(args))['sent'],0)
        with patch.object(t,'OWNER_ID','999'),patch.object(t,'send'):
            t.handle_update(self.msg(99005,'/parar',456))
        next_notice=s.create_notice('Novo comunicado autorizado')
        self.assertEqual(s.send_notice_batch(next_notice,lambda *args:sent.append(args))['sent'],0)
    def test_04_delete_data_and_restrict_link(self):
        with self.assertRaises(ValueError):s.setting_group_link('https://evil.example/group')
        self.assertEqual(s.setting_group_link('https://t.me/+abc'), 'https://t.me/+abc')
        with patch.object(t,'OWNER_ID','999'),patch.object(t,'send') as send:
            t.handle_update(self.msg(99006,'/entrar'))
            self.assertIn('https://t.me/+abc',send.call_args.args[1])
            t.handle_update(self.msg(99007,'/apagarme',456))
            self.assertIsNone(db.one("SELECT tg_id FROM sales_visitors WHERE tg_id='456'"))
    def test_05_non_private_cannot_enroll(self):
        with patch.object(t,'OWNER_ID','999'),patch.object(t,'send') as send:
            t.handle_update({'update_id':99008,'message':{'chat':{'id':-100777,'type':'supergroup'},'from':{'id':777,'first_name':'X'},'text':'/avisos'}})
            self.assertEqual(send.call_count,0)
            self.assertIsNone(db.one("SELECT tg_id FROM sales_visitors WHERE tg_id='777'"))
    def test_06_order_request_invalid(self):
        with patch.object(t,'OWNER_ID','999'),patch.object(t,'send') as send:
            t.handle_update(self.msg(99009,'/comprar x',123))
            self.assertIn('Use /comprar',send.call_args.args[1])
if __name__=='__main__': unittest.main()