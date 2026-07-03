"""
===================================================================
  SEMAIN - Asistente de Evaluación de Proveedores (Outlook Tray)
===================================================================

Este programa se ejecuta en segundo plano en tu computadora (Windows).
Aparece como un icono verde con "S" en la bandeja del sistema (system tray).

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
  2. Haz doble clic en instalar.bat para instalar dependencias
  3. Haz doble clic en iniciar.bat para arrancar el programa
  4. Verás un icono verde con "S" en la bandeja del sistema

¿Cómo usarlo?
  1. Mantén este programa corriendo (aparece el icono en la bandeja)
  2. En la página web, pulsa "Correo" en cualquier proveedor
  3. Pulsa "Preparar en Outlook" — se descarga todo y se abre Outlook
  4. Revisa y pulsa "Enviar" en Outlook

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

# Dependencies: pip install pystray pillow requests pywin32
import requests
from PIL import Image, ImageDraw, ImageFont

try:
    import pystray
    from pystray import MenuItem as item, Menu
except ImportError:
    print("ERROR: Falta pystray. Ejecuta instalar.bat primero.")
    sys.exit(1)

try:
    import win32com.client
    HAS_OUTLOOK = True
except ImportError:
    HAS_OUTLOOK = False
    print("ADVERTENCIA: pywin32 no instalado. Outlook no funcionará.")


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
    """Returns the save folder for the current year/month, creating it if needed."""
    now = datetime.datetime.now()
    year = str(now.year)
    month = MESES_ES[now.month - 1]
    folder = BASE_SAVE_PATH / year / month
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def download_file(url, filepath):
    """Downloads a file from URL to local path."""
    response = requests.get(url, stream=True, timeout=30)
    response.raise_for_status()
    with open(filepath, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    return filepath


def prepare_outlook_email(data):
    """
    Downloads PDF + chart, saves them to the year/month folder,
    and opens Outlook with everything ready to send.

    data = {
        providerName: "SERVIACERO",
        email: "JOSE.ALEMAN@SERVIACERO.COM",
        subject: "Evaluación de Proveedor - ...",
        body: "Estimado equipo...",
        pdfUrl: "https://.../api/evaluations/.../pdf",
        chartUrl: "https://.../api/evaluations/.../chart"
    }
    """
    # 1. Get save folder
    save_folder = get_save_folder()
    print(f"[SEMAIN] Guardando en: {save_folder}")

    # 2. Download PDF
    proveedor_safe = sanitize_filename(data.get('providerName', 'proveedor'))
    pdf_filename = f"Evaluacion-{proveedor_safe}.pdf"
    pdf_path = save_folder / pdf_filename
    print(f"[SEMAIN] Descargando PDF: {pdf_filename}")
    download_file(data['pdfUrl'], pdf_path)

    # 3. Download chart
    chart_filename = f"Grafica-comparativa-{proveedor_safe}.png"
    chart_path = save_folder / chart_filename
    print(f"[SEMAIN] Descargando gráfica: {chart_filename}")
    download_file(data['chartUrl'], chart_path)

    # 4. Open Outlook
    if not HAS_OUTLOOK:
        return {
            'success': True,
            'savedTo': str(save_folder),
            'warning': 'Outlook no disponible. Los archivos se guardaron pero no se abrió Outlook.'
        }

    print("[SEMAIN] Abriendo Outlook...")
    outlook = win32com.client.Dispatch("Outlook.Application")
    mail = outlook.CreateItem(0)
    mail.To = data.get('email', '')
    mail.Subject = data.get('subject', '')
    mail.Body = data.get('body', '')

    # Add attachments
    mail.Attachments.Add(str(pdf_path))
    mail.Attachments.Add(str(chart_path))

    # Display (don't auto-send — let user review)
    mail.Display()

    return {
        'success': True,
        'savedTo': str(save_folder),
        'pdfFile': str(pdf_path),
        'chartFile': str(chart_path)
    }


def sanitize_filename(s):
    """Sanitize a string for use as a filename."""
    invalid = '<>:"/\\|?*'
    for ch in invalid:
        s = s.replace(ch, '_')
    return s.strip()[:60]


# ====================================================================
# HTTP Server (listens for requests from the web app)
# ====================================================================
class RequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress default logging
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
                'version': '1.0',
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
                print(f"[SEMAIN] Solicitud recibida para: {data.get('providerName', '?')}")

                result = prepare_outlook_email(data)

                # Show notification
                show_notification(
                    f"Correo preparado para {data.get('providerName', '?')}",
                    f"Archivos guardados en: {result.get('savedTo', '')}\nOutlook abierto con PDF y gráfica adjuntos."
                )

                self._send_json(200, result)
            except Exception as e:
                print(f"[SEMAIN] Error: {e}")
                show_notification("Error", str(e))
                self._send_json(500, {'error': str(e)})
        else:
            self._send_json(404, {'error': 'not found'})


def start_server():
    server = HTTPServer(('127.0.0.1', PORT), RequestHandler)
    print(f"[SEMAIN] Servidor escuchando en http://127.0.0.1:{PORT}")
    server.serve_forever()


# ====================================================================
# System Tray Icon
# ====================================================================
def create_icon_image():
    """Creates a green circle with 'S' for the tray icon."""
    size = 64
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Green circle
    draw.ellipse([2, 2, size - 2, size - 2], fill='#10b981')
    # White "S"
    try:
        font = ImageFont.truetype("arial.ttf", 38)
    except:
        font = ImageFont.load_default()
    # Center the S
    bbox = draw.textbbox((0, 0), "S", font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) / 2 - bbox[0]
    y = (size - text_h) / 2 - bbox[1]
    draw.text((x, y), "S", fill='white', font=font)
    return img


def show_notification(title, message):
    """Shows a notification via the tray icon."""
    global _icon
    if _icon:
        try:
            _icon.notify(message, title)
        except:
            pass


_icon = None


def on_quit(icon, item):
    print("[SEMAIN] Cerrando...")
    icon.stop()
    os._exit(0)


def on_status(icon, item):
    folder = get_save_folder()
    show_notification(
        "SEMAIN - Estado",
        f"Servidor activo en puerto {PORT}\nOutlook: {'✓' if HAS_OUTLOOK else '✗'}\nGuardar en: {folder}"
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
    _icon = pystray.Icon("semain", image, "SEMAIN - Evaluación de Proveedores", menu)

    # Start HTTP server in background thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Show startup notification
    time.sleep(1)
    show_notification(
        "SEMAIN iniciado",
        f"Servidor activo en puerto {PORT}\nListo para preparar correos de evaluación."
    )

    # Run tray icon (blocks)
    _icon.run()


# ====================================================================
# Main
# ====================================================================
if __name__ == '__main__':
    print("=" * 60)
    print("  SEMAIN - Asistente de Evaluación de Proveedores")
    print("=" * 60)
    print(f"  Puerto: {PORT}")
    print(f"  Outlook: {'✓ Disponible' if HAS_OUTLOOK else '✗ No disponible'}")
    print(f"  Guardar en: {BASE_SAVE_PATH}")
    print("=" * 60)
    print()
    print("  El programa está corriendo en segundo plano.")
    print("  Verás un icono verde con 'S' en la bandeja del sistema.")
    print("  Clic derecho en el icono para opciones.")
    print()

    try:
        setup_tray()
    except Exception as e:
        print(f"Error: {e}")
        input("Presiona Enter para cerrar...")
