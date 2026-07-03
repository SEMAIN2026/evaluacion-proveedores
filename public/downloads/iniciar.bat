@echo off
rem Este .bat solo lanza el VBS que arranca Python silenciosamente.
rem No abre ventana de consola - todo es en segundo plano.
cd /d "%~dp0"
start "" wscript.exe "iniciar.vbs"
