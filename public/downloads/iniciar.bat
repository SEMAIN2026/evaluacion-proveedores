@echo off
chcp 65001 >nul
title SEMAIN - Asistente de Evaluacion de Proveedores

echo ================================================================
echo   SEMAIN - Iniciando Asistente de Outlook
echo ================================================================
echo.
echo El programa se ejecutara en segundo plano.
echo Veras un icono verde con "S" en la bandeja del sistema.
echo.
echo NO cierres esta ventana mientras uses el programa.
echo Para cerrar: clic derecho en el icono verde -> Salir
echo.

cd /d "%~dp0"
pythonw semain_tray.py

if errorlevel 1 (
    echo.
    echo ERROR: No se pudo iniciar el programa.
    echo Verifica que Python y las dependencias esten instalados.
    echo Ejecuta instalar.bat primero.
    echo.
    pause
)
