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
echo   3. Encontrar pythonw.exe (Python sin ventana)
echo   4. Crear un acceso directo en el Escritorio
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
echo   Paso 3: Buscando pythonw.exe...
echo ================================================================

set "PYTHONW="
for /f "delims=" %%i in ('python -c "import sys, os; print(os.path.join(os.path.dirname(sys.executable), 'pythonw.exe'))"') do set "PYTHONW=%%i"

if not exist "%PYTHONW%" (
    for /f "delims=" %%i in ('python -c "import sys, os; print(os.path.join(os.path.dirname(sys.executable), '..', 'pythonw.exe'))"') do set "PYTHONW=%%i"
)

if not exist "%PYTHONW%" (
    echo.
    echo ERROR: No se encontro pythonw.exe
    echo.
    echo Intenta reinstalar Python y marca "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

echo Encontrado: %PYTHONW%
echo.

echo ================================================================
echo   Paso 4: Creando acceso directo en el Escritorio...
echo ================================================================

set "SCRIPT_DIR=%~dp0"
set "PY_SCRIPT=%SCRIPT_DIR%semain_tray.py"
set "DESKTOP=%USERPROFILE%\Desktop"
set "LNK_PATH=%DESKTOP%\SEMAIN - Asistente.lnk"

echo Borrando acceso directo viejo si existe...
if exist "%LNK_PATH%" del /q "%LNK_PATH%"

echo Creando nuevo acceso directo...
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%TEMP%\create_shortcut.vbs"
echo sLinkFile = "%LNK_PATH%" >> "%TEMP%\create_shortcut.vbs"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%TEMP%\create_shortcut.vbs"
echo oLink.TargetPath = "%PYTHONW%" >> "%TEMP%\create_shortcut.vbs"
echo oLink.Arguments = """%PY_SCRIPT%""" >> "%TEMP%\create_shortcut.vbs"
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> "%TEMP%\create_shortcut.vbs"
echo oLink.IconLocation = "shell32.dll,13" >> "%TEMP%\create_shortcut.vbs"
echo oLink.Description = "SEMAIN - Asistente de Evaluacion de Proveedores" >> "%TEMP%\create_shortcut.vbs"
echo oLink.Save >> "%TEMP%\create_shortcut.vbs"
cscript /nologo "%TEMP%\create_shortcut.vbs"
del "%TEMP%\create_shortcut.vbs"

echo.
echo Acceso directo creado en: %LNK_PATH%
echo.
echo   - Ejecutable: %PYTHONW%
echo   - Script:     %PY_SCRIPT%
echo.

echo ================================================================
echo   Instalacion completada.
echo ================================================================
echo.
echo IMPORTANTE: Si ya tenias un acceso directo "SEMAIN - Asistente"
echo en el Escritorio, ya fue borrado y recreado.
echo.
echo Para iniciar el programa (sin ventana de consola):
echo   - Haz doble clic en "SEMAIN - Asistente" en el Escritorio
echo.
echo Veras un icono verde con "S" en la bandeja del sistema (junto al reloj).
echo.
echo IMPORTANTE: El programa debe estar corriendo para que la pagina web
echo pueda preparar los correos automaticamente.
echo.
pause
