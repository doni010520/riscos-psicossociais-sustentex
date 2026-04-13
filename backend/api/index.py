import sys
import os

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Forçar SQLite para /tmp na Vercel
os.environ.setdefault("DB_PATH", "/tmp/database.db")

from app.main import app
