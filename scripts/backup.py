"""Create a consistent SQLite backup without copying live WAL/shm files."""
from pathlib import Path
from datetime import datetime, timezone
import os, sqlite3, hashlib
root=Path(__file__).resolve().parent.parent
source=Path(os.environ.get('OPS_DB_PATH', str(root/'ops.sqlite3')))
target_dir=Path(os.environ.get('OPS_BACKUP_DIR',str(root/'private_backups')))
if not source.exists():
    raise SystemExit('Ainda não há um banco para copiar.')
target_dir.mkdir(mode=0o700,parents=True,exist_ok=True)
out=target_dir/('telegram_ops_'+datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%SZ')+'.sqlite3')
with sqlite3.connect(source) as cx, sqlite3.connect(out) as target:
    cx.backup(target)
os.chmod(out,0o600)
digest=hashlib.sha256(out.read_bytes()).hexdigest()
print('Backup criado:',out.name,'| SHA256:',digest)