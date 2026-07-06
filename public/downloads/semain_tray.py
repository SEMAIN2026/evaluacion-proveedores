"""
===================================================================
  SEMAIN - Asistente de Evaluación de Proveedores (Outlook Tray)
===================================================================

Se ejecuta en segundo plano como un icono junto al reloj de Windows.
- Sin ventana visible
- Click derecho → menú con opciones
- Escucha en http://127.0.0.1:8765 para recibir solicitudes de la web

Cuando la web envía una solicitud:
  1. Descarga el PDF y la gráfica
  2. Los guarda en ...\\EVALUACION DE PROVEDORES\\<AÑO>\\<MES>\\
  3. Abre Outlook con el correo listo (destinatario, asunto, cuerpo, adjuntos)

El enfoque de conexión a Outlook es IDÉNTICO al de pv_monitor_tray.py
para que ambas apps puedan coexistir sin el error "solo puede ejecutarse
una versión de Outlook a la vez".
"""

import sys
import os
import json
import threading
import time
import datetime
import subprocess
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# CRITICAL: Initialize COM BEFORE importing win32com.client
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

# Estado global
outlook_app = None  # instancia persistente de Outlook.Application (como pv_monitor)
outlook_connected = False


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


def sanitize_filename(s):
    invalid = '<>:"/\\|?*'
    for ch in invalid:
        s = s.replace(ch, '_')
    return s.strip()[:60]


# ====================================================================
# CONEXIÓN A OUTLOOK — idéntico enfoque que pv_monitor_tray.py
# ====================================================================
# pv_monitor ya tiene Outlook abierto y lo mantiene. Aquí usamos la misma
# lógica para reconectarnos si Outlook se cae, y para coexistir.
def ensure_outlook_connected():
    """
    Asegura que outlook_app esté conectado. Si ya lo está, lo reutiliza.
    Si no, intenta conectar (Dispatch primero porque pv_monitor ya abrió Outlook).
    NUNCA abre una nueva instancia si una ya está corriendo.
    """
    global outlook_app, outlook_connected

    # Si ya tenemos conexión, verificar que sigue viva
    if outlook_app is not None:
        try:
            # Test mínimo: GetNamespace debe responder
            outlook_app.GetNamespace("MAPI")
            return True
        except Exception:
            outlook_app = None
            outlook_connected = False

    try:
        pythoncom.CoInitialize()
    except Exception:
        pass

    # Método 1: Dispatch — se conecta a la instancia existente (NO abre nueva)
    try:
        outlook_app = win32com.client.Dispatch("Outlook.Application")
        outlook_app.GetNamespace("MAPI")  # test
        outlook_connected = True
        return True
    except Exception as e:
        err1 = str(e)

    # Método 2: GetActiveObject — conectar a instancia existente (alternativa)
    try:
        outlook_app = win32com.client.GetActiveObject("Outlook.Application")
        outlook_app.GetNamespace("MAPI")  # test
        outlook_connected = True
        return True
    except Exception as e:
        err2 = str(e)

    # Si Outlook NO está corriendo en absoluto, abrirlo UNA sola vez
    try:
        result = subprocess.run(
            ['tasklist', '/FI', 'IMAGENAME eq outlook.exe'],
            capture_output=True, text=True, timeout=5
        )
        if 'outlook.exe' not in result.stdout.lower():
            # Outlook realmente no está corriendo — abrirlo
            subprocess.Popen(['cmd', '/c', 'start', 'outlook'], shell=False)
            time.sleep(10)
            try:
                outlook_app = win32com.client.Dispatch("Outlook.Application")
                outlook_app.GetNamespace("MAPI")
                outlook_connected = True
                return True
            except Exception as e:
                err1 = f"{err1} | después de abrir: {e}"
        else:
            # Outlook SÍ está corriendo pero no podemos conectarnos
            # Esperar un poco y reintentar (pv_monitor puede estar reiniciándolo)
            time.sleep(3)
            try:
                outlook_app = win32com.client.Dispatch("Outlook.Application")
                outlook_app.GetNamespace("MAPI")
                outlook_connected = True
                return True
            except Exception as e:
                err1 = f"{err1} | reintento: {e}"
    except Exception:
        pass

    outlook_connected = False
    return False


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

    # Intentar conectar a Outlook (reutiliza si ya está conectado)
    if not ensure_outlook_connected():
        return {
            'success': False,
            'error': (
                "No se pudo conectar a Outlook.\n\n"
                "Solución:\n"
                "1. Abre Outlook MANUALMENTE (doble clic en el icono)\n"
                "2. Espera a que cargue (veas la bandeja de entrada)\n"
                "3. Dejalo abierto\n"
                "4. Pulsa 'Preparar en Outlook' otra vez\n\n"
                "Si Outlook está abierto y sigue el error:\n"
                "- Reinicia tu PC\n"
                "- Abre Outlook primero, luego pv_monitor y SEMAIN"
            ),
            'savedTo': str(save_folder),
            'pdfFile': str(pdf_path),
            'chartFile': str(chart_path)
        }

    # Crear el correo
    try:
        mail = outlook_app.CreateItem(0)
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
        # Si falla al crear el correo, resetear conexión para próximo intento
        outlook_app = None
        outlook_connected = False
        err_msg = str(e)
        return {
            'success': False,
            'error': f'Error al crear el correo: {err_msg}\n\nSe reiniciará la conexión a Outlook. Intenta de nuevo.',
            'savedTo': str(save_folder),
            'pdfFile': str(pdf_path),
            'chartFile': str(chart_path)
        }


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
                'version': '2.0',
                'outlook': outlook_connected,
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
                        "Archivos guardados y Outlook abierto con PDF y gráfica adjuntos."
                    )
                else:
                    show_notification("Error", result.get('error', 'Error desconocido')[:200])

                self._send_json(200, result)
            except Exception as e:
                show_notification("Error", str(e)[:200])
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
        f"Servidor: puerto {PORT}\nOutlook: {'OK' if outlook_connected else 'NO'}\nGuardar en: {folder}"
    )


def on_open_folder(icon, item):
    folder = get_save_folder()
    folder.mkdir(parents=True, exist_ok=True)
    os.startfile(str(folder))


def on_reconnect_outlook(icon, item):
    global outlook_app, outlook_connected
    outlook_app = None
    outlook_connected = False
    if ensure_outlook_connected():
        show_notification("SEMAIN", "Outlook reconectado correctamente.")
    else:
        show_notification("SEMAIN", "No se pudo reconectar a Outlook.")


def setup_tray():
    global _icon
    image = create_icon_image()
    menu = Menu(
        item('Estado', on_status, default=True),
        item('Abrir carpeta de guardado', on_open_folder),
        item('Reconectar Outlook', on_reconnect_outlook),
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
