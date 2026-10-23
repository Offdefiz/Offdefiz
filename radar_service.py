"""RSS discovery of externally published commercial opportunities.

Never scrapes Telegram messages, chats or private users. Only reads RSS/Atom feeds
explicitly added by the owner and records titles+links for manual assessment.
"""
import re
import urllib.request
from urllib.parse import urlparse
from xml.etree import ElementTree as ET
from db import rows, connect, event

TERMS = ('telegram','comunidade','community','marketing','parceria','publicidade',
         'anúncio','afiliado','negócio','vendas','gestão de grupos')
MAX_FEED_BYTES = 512 * 1024

def validate_feed_url(url):
    url=str(url).strip()
    u=urlparse(url)
    if u.scheme!='https' or not u.hostname or u.username or u.password or len(url)>500:
        raise ValueError('Informe um RSS público com URL https:// válida.')
    host=u.hostname.lower()
    if host == 'localhost' or host.endswith('.local') or host in ('127.0.0.1','::1') or host.endswith('.internal') or host.replace('.','').isdigit():
        raise ValueError('Fontes locais/internas não são aceitas.')
    if host in ('t.me','telegram.org','www.telegram.org') or host.endswith('.t.me'):
        raise ValueError('Use fontes RSS externas; não recolha mensagens do Telegram.')
    # Do not permit IP literal hosts; avoids straightforward internal fetches.
    import ipaddress
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ValueError('Fontes com endereço IP direto não são aceitas.')
    return url

class SafeRSSRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_feed_url(newurl)
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def fetch_feed(url):
    """At most the first 30 entries; title and source URL only."""
    url=validate_feed_url(url)
    req=urllib.request.Request(url,headers={'User-Agent':'ComunidadeOpsRadar/1.0 (owner-configured RSS feed)','Accept':'application/atom+xml,application/rss+xml,application/xml'})
    opener=urllib.request.build_opener(SafeRSSRedirect)
    with opener.open(req,timeout=8) as resp:
        raw=resp.read(MAX_FEED_BYTES+1)
    if len(raw)>MAX_FEED_BYTES:
        raise ValueError('RSS excede o limite de leitura de 512 KB.')
    root=ET.fromstring(raw)
    items=[]
    # RSS 2.0 and Atom 1.0, without descriptions or message bodies.
    for item in root.findall('.//item')[:30]:
        title=(item.findtext('title') or '').strip()
        link=(item.findtext('link') or '').strip()
        items.append((title,link))
    ns='{http://www.w3.org/2005/Atom}'
    for item in root.findall(f'.//{ns}entry')[:30]:
        title=(item.findtext(ns+'title') or '').strip()
        link=next((el.get('href','') for el in item.findall(ns+'link') if el.get('rel','alternate')=='alternate'),None)
        if link is None:
            link=next((el.get('href','') for el in item.findall(ns+'link')), '')
        items.append((title,link))
    return items[:30]

def run_research():
    feeds=rows('SELECT id,name,url FROM radar_feeds WHERE active=1 ORDER BY id LIMIT 10')
    created=0; reviewed=0; errors=0
    for feed in feeds:
        try:
            for title,link in fetch_feed(feed['url']):
                if len(title)<8 or not (8 <= len(link)<=500):
                    continue
                u=urlparse(link)
                if u.scheme not in ('http','https') or not u.hostname:
                    continue
                # Public editorial sources only; Telegram content itself stays out of the radar.
                if u.hostname.lower().removeprefix('www.') in ('t.me','telegram.org'):
                    continue
                if not any(term in title.lower() for term in TERMS):
                    continue
                reviewed += 1
                with connect() as cx:
                    if cx.execute('SELECT 1 FROM opportunities WHERE source_url=?',(link,)).fetchone():
                        continue
                    cx.execute('''INSERT INTO opportunities (title,category,source_url,score,status,notes)
                        VALUES (?,?,?,?,?,?)''', (title[:180],'pesquisa_externa',link,30,'analisando',
                        'Fonte RSS pública: '+feed['name'][:100]+'; avaliar manualmente antes de contactar terceiros.'))
                    created += 1
        except Exception as ex:
            errors+=1
            event('radar_fonte_indisponivel',f"Fonte {feed['id']}: {type(ex).__name__}")
    event('radar_executado',f'Fontes: {len(feeds)}; itens revisados: {reviewed}; novos: {created}; falhas: {errors}')
    return {'feeds':len(feeds),'candidates':reviewed,'new':created,'errors':errors}