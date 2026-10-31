@echo off
cd backend
if not exist venv ( python -m venv venv )
call venv\Scripts\activate
pip install -r requirements.txt
set JADU_DB_BACKEND=mysql
set MYSQL_HOST=127.0.0.1
set MYSQL_PORT=3306
set MYSQL_DATABASE=jadu_safe
uvicorn main:app --reload --host 0.0.0.0 --port 8001
