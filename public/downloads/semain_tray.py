"""
===================================================================
  SEMAIN - Asistente de Evaluación de Proveedores (Outlook Tray)
===================================================================

Este programa se ejecuta EN SEGUNDO PLANO en tu computadora (Windows).
Aparece como un icono verde con "S" en la bandeja del sistema (system tray).
NO abre ninguna ventana de consola.

¿Qué hace?
  1. Escucha en http://127.0.0.1:8765
  2. Cuando la página web le envía una solicitud:
     a. Descarga el PDF de evaluación y la gráfica comparativa
     b. Los guarda en:
        C:\\Users\\<tu-usuario>\\Desktop\\WALTER\\ALMACEN\\EVALUACION DE PROVEDORES\\<AÑO>\\<MES>\\
        (crea las carpetas si no existen)
     c. Abre Microsoft Outlook con un correo nuevo:
        - Destinatario: el correo del proveedor
        - Asunto: "Evaluación de Proveedor - <nombre> | Calificación: XX.X"
        - Cuerpo: mensaje en español con el resumen
        - Adjuntos: el PDF y la gráfica
     d. El correo queda listo para revisar y enviar

¿Cómo instalarlo?
  1. Instala Python 3.10+ desde https://python.org (marca "Add to PATH")
  2. Haz doble clic en instalar.bat para instalar dependencias y crear el acceso directo
  3. Haz doble clic en "SEMAIN - Asistente" en el Escritorio

Para cerrar: clic derecho en el icono verde → "Salir"
"""

import sys
import os
import json
import threading
import time
import datetime
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# ====================================================================
# CRITICAL: Initialize COM BEFORE importing win32com.client
# This fixes the "CoInitialize has not been called" error.
# ====================================================================
try:
    import pythoncom
    pythoncom.CoInitialize()
except ImportError:
    pass
except Exception:
    pass

import requests
from PIL import Image, ImageDraw, ImageFont

try:
    import pystray
    from pystray import MenuItem as item, Menu
except ImportError:
    sys.exit(1)

try:
    import win32com.client
    HAS_OUTLOOK = True
except ImportError:
    HAS_OUTLOOK = False


# ====================================================================
# Configuration
# ====================================================================
PORT = 8765
BASE_SAVE_PATH = Path(r"C:\Users\Equipo 39\Desktop\WALTER\ALMACEN\EVALUACION DE PROVEDORES")

MESES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]


def get_save_folder():
    now = datetime.datetime.now()
    year = str(now.year)
    month = MESES_ES[now.month - 1]
    folder = BASE_SAVE_PATH / year / month
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def download_file(url, filepath):
    response = requests.get(url, stream=True, timeout=30)
    response.raise_for_status()
    with open(filepath, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    return filepath


def get_outlook_app():
    """
    Connect to Outlook using the same robust approach as pv_monitor_tray.py.
    Works even when another tray app is already using Outlook.

    Returns (outlook_app, error_message_or_None).
    """
    import subprocess

    # Método 0: Si Outlook no está corriendo, abrirlo primero
    try:
        result = subprocess.run(
            ['tasklist', '/FI', 'IMAGENAME eq outlook.exe'],
            capture_output=True, text=True, timeout=5
        )
        if 'outlook.exe' not in result.stdout.lower():
            # Outlook no está corriendo — abrirlo
            subprocess.Popen(['cmd', '/c', 'start', 'outlook'], shell=False)
            time.sleep(8)  # esperar a que Outlook arranque
    except Exception:
        pass

    # Método 1: Dispatch (funciona aunque otro proceso use Outlook)
    try:
        outlook = win32com.client.Dispatch("Outlook.Application")
        return outlook, None
    except Exception as e:
        err1 = str(e)

    # Si es el error de "ejecución de servidor", matar Outlook zombie y reintentar
    if '-2146959355' in err1 or '-2147221021' in err1:
        try:
            subprocess.run(
                ['taskkill', '/F', '/IM', 'outlook.exe'],
                capture_output=True, timeout=5
            )
            time.sleep(3)
            subprocess.Popen(['cmd', '/c', 'start', 'outlook'], shell=False)
            time.sleep(10)

            try:
                outlook = win32com.client.Dispatch("Outlook.Application")
                return outlook, None
            except Exception as e2:
                err1 = f"{err1} | reintento: {e2}"
        except Exception:
            pass

    # Método 2: EnsureDispatch
    try:
        import win32com.client.gencache
        outlook = win32com.client.gencache.EnsureDispatch("Outlook.Application")
        return outlook, None
    except Exception as e:
        err2 = str(e)

    # Método 3: GetActiveObject (conectar a instancia existente)
    try:
        outlook = win32com.client.GetActiveObject("Outlook.Application")
        return outlook, None
    except Exception as e:
        err3 = str(e)

    # Todos fallaron
    return None, (
        f"No se pudo conectar a Outlook.\n\n"
        f"Posibles causas:\n"
        f"• Outlook está atascado (proceso zombie)\n"
        f"• Otro programa está usando Outlook (pv_monitor)\n"
        f"• Outlook no está instalado\n\n"
        f"Solución:\n"
        f"1. Abre Outlook MANUALMENTE (doble clic en el icono)\n"
        f"2. Si Outlook da error, abre Administrador de Tareas (Ctrl+Shift+Esc)\n"
        f"3. Termina TODOS los procesos OUTLOOK.EXE\n"
        f"4. Abre Outlook de nuevo manualmente\n"
        f"5. Dejalo abierto y pulsa 'Preparar en Outlook' otra vez\n\n"
        f"Errores técnicos:\n- {err1}\n- {err2}\n- {err3}"
    )


def prepare_outlook_email(data):
    save_folder = get_save_folder()

    proveedor_safe = sanitize_filename(data.get('providerName', 'proveedor'))
    pdf_filename = f"Evaluacion-{proveedor_safe}.pdf"
    pdf_path = save_folder / pdf_filename
    download_file(data['pdfUrl'], pdf_path)

    chart_filename = f"Grafica-comparativa-{proveedor_safe}.png"
    chart_path = save_folder / chart_filename
    download_file(data['chartUrl'], chart_path)

    if not HAS_OUTLOOK:
        return {
            'success': True,
            'savedTo': str(save_folder),
            'warning': 'Outlook no disponible. Los archivos se guardaron.'
        }

    try:
        pythoncom.CoInitialize()
    except Exception:
        pass

    # Connect to Outlook (try running instance first, then new)
    outlook, outlook_err = get_outlook_app()
    if outlook is None:
        return {
            'success': False,
            'error': outlook_err,
            'savedTo': str(save_folder),
            'pdfFile': str(pdf_path),
            'chartFile': str(chart_path)
        }

    try:
        mail = outlook.CreateItem(0)
        mail.To = data.get('email', '')
        mail.Subject = data.get('subject', '')
        mail.Body = data.get('body', '')

        mail.Attachments.Add(str(pdf_path))
        mail.Attachments.Add(str(chart_path))

        mail.Display()

        return {
            'success': True,
            'savedTo': str(save_folder),
            'pdfFile': str(pdf_path),
            'chartFile': str(chart_path)
        }
    except Exception as e:
        err_msg = str(e)
        # Detect the "server execution failed" error specifically
        if '-2146959355' in err_msg or '80080005' in err_msg:
            helpful = (
                f"Outlook no responde. Para arreglarlo:\n\n"
                f"1. Abre Outlook MANUALMENTE con doble clic\n"
                f"2. Si Outlook da error, abre Administrador de Tareas "
                f"(Ctrl+Shift+Esc)\n"
                f"3. Termina TODOS los procesos OUTLOOK.EXE\n"
                f"4. Abre Outlook de nuevo manualmente\n"
                f"5. Dejalo abierto y pulsa 'Preparar en Outlook' otra vez\n\n"
                f"Error tecnico: {err_msg}"
            )
        elif '-2147221008' in err_msg:
            helpful = (
                f"Error de inicializacion COM. Reinicia la app de SEMAIN "
                f"(clic derecho en icono verde → Salir, y vuelve a abrirla).\n\n"
                f"Error tecnico: {err_msg}"
            )
        else:
            helpful = f'Error al crear el correo: {err_msg}'
        return {
            'success': False,
            'error': helpful,
            'savedTo': str(save_folder),
            'pdfFile': str(pdf_path),
            'chartFile': str(chart_path)
        }


def sanitize_filename(s):
    invalid = '<>:"/\\|?*'
    for ch in invalid:
        s = s.replace(ch, '_')
    return s.strip()[:60]


# ====================================================================
# HTTP Server
# ====================================================================
class RequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _send_json(self, code, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == '/status':
            self._send_json(200, {
                'running': True,
                'version': '1.2',
                'outlook': HAS_OUTLOOK,
                'savePath': str(BASE_SAVE_PATH),
            })
        else:
            self._send_json(404, {'error': 'not found'})

    def do_POST(self):
        if self.path == '/prepare-email':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length).decode('utf-8')
                data = json.loads(body)

                result = prepare_outlook_email(data)

                if result.get('success'):
                    show_notification(
                        f"Correo preparado para {data.get('providerName', '?')}",
                        f"Archivos guardados y Outlook abierto con PDF y gráfica adjuntos."
                    )
                else:
                    show_notification("Error", result.get('error', 'Error desconocido'))

                self._send_json(200, result)
            except Exception as e:
                show_notification("Error", str(e))
                self._send_json(500, {'error': str(e)})
        else:
            self._send_json(404, {'error': 'not found'})


def start_server():
    server = HTTPServer(('127.0.0.1', PORT), RequestHandler)
    server.serve_forever()


# ====================================================================
# System Tray Icon
# ====================================================================
def create_icon_image():
    size = 64
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([2, 2, size - 2, size - 2], fill='#A0CD50')
    try:
        font = ImageFont.truetype("arial.ttf", 38)
    except:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), "S", font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) / 2 - bbox[0]
    y = (size - text_h) / 2 - bbox[1]
    draw.text((x, y), "S", fill='#302C2B', font=font)
    return img


def show_notification(title, message):
    global _icon
    if _icon:
        try:
            _icon.notify(message, title)
        except:
            pass


_icon = None


def on_quit(icon, item):
    icon.stop()
    os._exit(0)


def on_status(icon, item):
    folder = get_save_folder()
    show_notification(
        "SEMAIN - Estado",
        f"Servidor activo en puerto {PORT}\nOutlook: {'OK' if HAS_OUTLOOK else 'NO'}\nGuardar en: {folder}"
    )


def on_open_folder(icon, item):
    folder = get_save_folder()
    folder.mkdir(parents=True, exist_ok=True)
    os.startfile(str(folder))


def setup_tray():
    global _icon
    image = create_icon_image()
    menu = Menu(
        item('Estado', on_status, default=True),
        item('Abrir carpeta de guardado', on_open_folder),
        Menu.SEPARATOR,
        item('Salir', on_quit),
    )
    _icon = pystray.Icon("semain", image, "SEMAIN - Evaluacion de Proveedores", menu)

    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    time.sleep(1)
    show_notification(
        "SEMAIN iniciado",
        f"Servidor activo en puerto {PORT}\nListo para preparar correos."
    )

    _icon.run()


if __name__ == '__main__':
    try:
        setup_tray()
    except Exception as e:
        log_path = Path.home() / "semain_error.log"
        with open(log_path, 'w', encoding='utf-8') as f:
            import traceback
            f.write(traceback.format_exc())
        os._exit(1)
