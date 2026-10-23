"""Persistent local data layer for Telegram OPS. No message bodies are collected."""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(os.environ.get('OPS_DB_PATH', Path(__file__).parent / 'ops.sqlite3'))

SCHEMA = '''
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS groups (
 id INTEGER PRIMARY KEY, chat_id TEXT UNIQUE, name TEXT NOT NULL,
 url TEXT DEFAULT '', kind TEXT DEFAULT 'grupo', authorized INTEGER DEFAULT 0,
 active INTEGER DEFAULT 1, member_count INTEGER DEFAULT 0,
 message_count INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS opportunities (
 id INTEGER PRIMARY KEY, title TEXT NOT NULL, category TEXT DEFAULT 'parceria',
 source_url TEXT DEFAULT '', score INTEGER DEFAULT 50, status TEXT DEFAULT 'novo',
 notes TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS leads (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, contact TEXT DEFAULT '',
 interest TEXT DEFAULT '', stage TEXT DEFAULT 'novo', value_cents INTEGER DEFAULT 0,
 notes TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS posts (
 id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES groups(id),
 body TEXT NOT NULL, status TEXT DEFAULT 'rascunho', due_at TEXT,
 sent_at TEXT, telegram_message_id INTEGER,
 error TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS finance (
 id INTEGER PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('entrada','saida')),
 description TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY, event TEXT NOT NULL, details TEXT DEFAULT '',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS processed_updates (update_id INTEGER PRIMARY KEY, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS daily_runs (kind TEXT NOT NULL, run_date TEXT NOT NULL, PRIMARY KEY(kind,run_date));
CREATE TABLE IF NOT EXISTS radar_feeds(id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_posts_due ON posts(status, due_at);
CREATE TABLE IF NOT EXISTS sales_campaigns (
 id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_visitors (
 tg_id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT DEFAULT '',
 source TEXT NOT NULL DEFAULT 'direto', allow_updates INTEGER NOT NULL DEFAULT 0,
 first_seen TEXT DEFAULT CURRENT_TIMESTAMP, last_seen TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_products (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
 price_cents INTEGER NOT NULL CHECK(price_cents>=0), active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_orders (
 id INTEGER PRIMARY KEY, tg_id TEXT NOT NULL REFERENCES sales_visitors(tg_id),
 product_id INTEGER NOT NULL REFERENCES sales_products(id),
 price_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'aguardando',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sales_notifications (
 id INTEGER PRIMARY KEY, body TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_notification_receipts (
 notification_id INTEGER NOT NULL REFERENCES sales_notifications(id),
 tg_id TEXT NOT NULL REFERENCES sales_visitors(tg_id),
 status TEXT NOT NULL, detail TEXT DEFAULT '',
 PRIMARY KEY(notification_id,tg_id)
);
CREATE INDEX IF NOT EXISTS idx_sales_visitors_source ON sales_visitors(source);

'''

@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    cx = sqlite3.connect(DB_PATH, timeout=20)
    try:
        cx.row_factory = sqlite3.Row
        cx.execute('PRAGMA busy_timeout = 20000')
        cx.execute('PRAGMA foreign_keys=ON')
        yield cx
        cx.commit()
    except Exception:
        cx.rollback()
        raise
    finally:
        cx.close()

def init():
    with connect() as cx:
        cx.executescript(SCHEMA)

def rows(sql, args=()):
    with connect() as cx:
        return [dict(r) for r in cx.execute(sql, args)]

def one(sql, args=()):
    with connect() as cx:
        r = cx.execute(sql, args).fetchone()
        return dict(r) if r else None

def change(sql, args=()):
    with connect() as cx:
        cursor = cx.execute(sql, args)
        return cursor.lastrowid

def event(name, detail=''):
    change('INSERT INTO events(event,details) VALUES (?,?)', (name, str(detail)[:500]))

def report():
    with connect() as cx:
        count = lambda t: cx.execute('SELECT COUNT(*) FROM '+t).fetchone()[0]
        revenue = cx.execute("SELECT COALESCE(SUM(CASE WHEN type='entrada' THEN amount_cents ELSE -amount_cents END),0) FROM finance").fetchone()[0]
        pending = cx.execute("SELECT COUNT(*) FROM posts WHERE status IN ('rascunho','aprovado')").fetchone()[0]
        enabled = cx.execute('SELECT COUNT(*) FROM groups WHERE authorized=1 AND active=1').fetchone()[0]
        return {'groups':count('groups'), 'managed_groups':enabled, 'leads':count('leads'),
                'opportunities':count('opportunities'), 'pending_posts':pending,
                'balance_cents':revenue, 'posts_sent':cx.execute("SELECT COUNT(*) FROM posts WHERE status='enviado'").fetchone()[0]}