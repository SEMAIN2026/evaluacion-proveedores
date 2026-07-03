@echo off
chcp 65001 >nul
title SEMAIN - Instalador del Asistente de Evaluacion de Proveedores

echo ================================================================
echo   SEMAIN - Instalador del Asistente de Outlook
echo ================================================================
echo.
echo Este instalador va a:
echo   1. Verificar que Python esta instalado
echo   2. Instalar las dependencias necesarias
echo   3. Crear un acceso directo en el Escritorio
echo.
echo Presiona cualquier tecla para continuar, o cierra esta ventana
echo para cancelar.
pause >nul

echo.
echo ================================================================
echo   Paso 1: Verificando Python...
echo ================================================================

python --version 2>nul
if errorlevel 1 (
    echo.
    echo ERROR: Python no esta instalado o no esta en el PATH.
    echo.
    echo Por favor descarga e instala Python 3.10+ desde:
    echo   https://www.python.org/downloads/
    echo.
    echo IMPORTANTE: Marca la casilla "Add Python to PATH"
    echo durante la instalacion.
    echo.
    pause
    exit /b 1
)

echo Python encontrado.
echo.

echo ================================================================
echo   Paso 2: Instalando dependencias...
echo ================================================================
echo.
echo Instalando pystray (icono de bandeja)...
pip install pystray
echo.
echo Instalando Pillow (imagenes)...
pip install Pillow
echo.
echo Instalando requests (descargas)...
pip install requests
echo.
echo Instalando pywin32 (Outlook)...
pip install pywin32
echo.

echo ================================================================
echo   Paso 3: Creando acceso directo en el Escritorio...
echo ================================================================

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_PATH=%SCRIPT_DIR%semain_tray.py"
set "DESKTOP=%USERPROFILE%\Desktop"

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%TEMP%\create_shortcut.vbs"
echo sLinkFile = "%DESKTOP%\SEMAIN - Asistente.lnk" >> "%TEMP%\create_shortcut.vbs"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%TEMP%\create_shortcut.vbs"
echo oLink.TargetPath = "pythonw.exe" >> "%TEMP%\create_shortcut.vbs"
echo oLink.Arguments = """%SCRIPT_PATH%""" >> "%TEMP%\create_shortcut.vbs"
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> "%TEMP%\create_shortcut.vbs"
echo oLink.IconLocation = "shell32.dll,13" >> "%TEMP%\create_shortcut.vbs"
echo oLink.Description = "SEMAIN - Asistente de Evaluacion de Proveedores" >> "%TEMP%\create_shortcut.vbs"
echo oLink.Save >> "%TEMP%\create_shortcut.vbs"
cscript /nologo "%TEMP%\create_shortcut.vbs"
del "%TEMP%\create_shortcut.vbs"

echo Acceso directo creado en el Escritorio.
echo.

echo ================================================================
echo   Instalacion completada.
echo ================================================================
echo.
echo Para iniciar el programa:
echo   - Haz doble clic en "SEMAIN - Asistente" en el Escritorio
echo   - O haz doble clic en iniciar.bat en esta carpeta
echo.
echo Veras un icono verde con "S" en la bandeja del sistema (junto al reloj).
echo.
echo IMPORTANTE: El programa debe estar corriendo para que la pagina web
echo pueda preparar los correos automaticamente.
echo.
pause
