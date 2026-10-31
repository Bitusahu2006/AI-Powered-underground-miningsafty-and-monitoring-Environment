@echo off
cd frontend
call npm install
call npm run dev -- --host 0.0.0.0
