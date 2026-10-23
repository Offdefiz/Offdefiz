"""Register webhook after HTTPS deployment, reading secrets from environment."""
import os
import json
import urllib.request

token=os.environ.get('TELEGRAM_BOT_TOKEN','')
secret=os.environ.get('TELEGRAM_WEBHOOK_SECRET','')
url=os.environ.get('OPS_PUBLIC_URL','').rstrip('/')
if not token or not secret or not url.startswith('https://'):
    raise SystemExit('Defina TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET e OPS_PUBLIC_URL (https).')
api=os.environ.get('TELEGRAM_API_BASE','https://api.telegram.org').rstrip('/')
body={'url':url+'/telegram/webhook','secret_token':secret,
      'allowed_updates':['message','channel_post','my_chat_member'],'drop_pending_updates':False}
req=urllib.request.Request(f'{api}/bot{token}/setWebhook',json.dumps(body).encode(),
                           {'Content-Type':'application/json'})
with urllib.request.urlopen(req,timeout=20) as r:
    reply=json.load(r)
print('Webhook configurado.' if reply.get('ok') else 'Erro: '+reply.get('description','desconhecido'))