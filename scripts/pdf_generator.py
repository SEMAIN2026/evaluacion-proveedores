"""
PDF generator for F-CAL-07 REV01 Evaluación de Proveedores.
Replicates the exact layout of the original Excel-template-based PDF.

Layout reference (from sample PDF inspection):
  - A4 portrait (595.2 x 841.8 pt)
  - Header band (y=22-74): 3 columns - logo | title (light blue bg) | code (light blue bg)
  - Info band (y=74-118): supplier name / email / date in 3 columns
  - Score system row (y=129-138)
  - Criteria table header (y=145-160) light blue
  - 10 criteria rows (y=161-305), each ~14.5pt tall
  - Totals (y=305-340): obtained / possible / evaluation+classification box
  - Classification legend (y=375-433): 4 colored boxes
  - Observations (y=451-503)
  - Signature row (y=522-570): name | signature image | cargo
  - Footer (y=604)
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfgen import canvas
from PIL import Image as PILImage

# Register Calibri-compatible fonts (Carlito is metrically compatible)
FONT_DIR = "/usr/share/fonts/truetype/english"
pdfmetrics.registerFont(TTFont("Calibri", f"{FONT_DIR}/Carlito-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Bold", f"{FONT_DIR}/Carlito-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Italic", f"{FONT_DIR}/Carlito-Italic.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-BoldItalic", f"{FONT_DIR}/Carlito-BoldItalic.ttf"))
registerFontFamily(
    "Calibri",
    normal="Calibri",
    bold="Calibri-Bold",
    italic="Calibri-Italic",
    boldItalic="Calibri-BoldItalic",
)

# Colors (from sample PDF inspection)
LIGHT_BLUE = HexColor("#DDEBFB")
DARK_GREEN = HexColor("#00B050")
LIGHT_GREEN = HexColor("#92D050")
ORANGE = HexColor("#FFC000")
RED = HexColor("#FF0000")
BLACK = HexColor("#000000")
WHITE = HexColor("#FFFFFF")
GRAY = HexColor("#808080")

# Layout constants
PAGE_W, PAGE_H = A4  # 595.2 x 841.8
LEFT_MARGIN = 44.5
RIGHT_MARGIN = 543.08
CONTENT_W = RIGHT_MARGIN - LEFT_MARGIN

# Allow overriding asset paths (for Vercel serverless, files are bundled with the function)
_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_LOGO_CANDIDATES = [
    os.environ.get("EVALUACIONES_LOGO_PATH"),
    os.path.join(_BASE, "public", "assets", "logo.png"),
    "/home/z/my-project/public/assets/logo.png",
    "./public/assets/logo.png",
]
_SIG_CANDIDATES = [
    os.environ.get("EVALUACIONES_SIGNATURE_PATH"),
    os.path.join(_BASE, "public", "assets", "firma-evaluador.png"),
    "/home/z/my-project/public/assets/firma-evaluador.png",
    "./public/assets/firma-evaluador.png",
]


def _find_asset(candidates):
    for p in candidates:
        if p and os.path.exists(p):
            return p
    return None


LOGO_PATH = _find_asset(_LOGO_CANDIDATES)
SIGNATURE_PATH = _find_asset(_SIG_CANDIDATES)


def _draw_text(c, text, x, y, font="Calibri", size=9, color=BLACK):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x, y, text)


def _draw_text_right(c, text, x_right, y, font="Calibri", size=9, color=BLACK):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawRightString(x_right, y, text)


def _draw_centered_text(c, text, x_center, y, font="Calibri", size=9, color=BLACK):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawCentredString(x_center, y, text)


def _fit_image(img_path, max_w, max_h):
    try:
        with PILImage.open(img_path) as im:
            iw, ih = im.size
        ratio = min(max_w / iw, max_h / ih)
        return iw * ratio, ih * ratio
    except Exception:
        return max_w, max_h


def generate_pdf(out_path, ev, chart_path=None):
    """Generate the F-CAL-07 REV01 evaluation PDF."""
    c = canvas.Canvas(out_path, pagesize=A4)
    c.setTitle(f"Evaluación {ev.get('proveedor', '')}")
    c.setAuthor(ev.get("evaluador", "Walter Piñera"))
    c.setSubject("Evaluación de Proveedores F-CAL-07 REV01")
    c.setCreator("Sistema de Evaluación de Proveedores")

    # ============== 1. HEADER BAND (y=22 to y=74) ==============
    col1_right = 254.13
    col2_right = 460.68

    c.setFillColor(WHITE)
    c.rect(LEFT_MARGIN, 22, col1_right - LEFT_MARGIN, 52.3, fill=1, stroke=0)
    c.setFillColor(LIGHT_BLUE)
    c.rect(col1_right, 22, col2_right - col1_right, 52.3, fill=1, stroke=0)
    c.setFillColor(LIGHT_BLUE)
    c.rect(col2_right, 22, RIGHT_MARGIN - col2_right, 52.3, fill=1, stroke=0)

    if LOGO_PATH:
        lw, lh = _fit_image(LOGO_PATH, col1_right - LEFT_MARGIN - 8, 44)
        lx = LEFT_MARGIN + (col1_right - LEFT_MARGIN - lw) / 2
        ly = 22 + (52.3 - lh) / 2
        c.drawImage(LOGO_PATH, lx, ly, width=lw, height=lh, mask='auto')

    _draw_centered_text(
        c, "EVALUACIÓN DE PROVEEDORES",
        x_center=(col1_right + col2_right) / 2, y=45,
        font="Calibri-Bold", size=14,
    )
    _draw_text(c, "F-CAL-07 REV01", 475.9, 56, font="Calibri", size=8)
    _draw_text(c, "05/07/2021", 475.9, 45, font="Calibri", size=8)

    c.setFillColor(BLACK)
    for x in [44.5, col1_right, col2_right, RIGHT_MARGIN]:
        c.rect(x - 1, 22, 2, 52.3, fill=1, stroke=0)

    # ============== 2. INFO BAND (y=74 to y=118) ==============
    c.setFillColor(LIGHT_BLUE)
    c.rect(LEFT_MARGIN, 74.3, RIGHT_MARGIN - LEFT_MARGIN, 43.6, fill=1, stroke=0)

    _draw_text(c, "NOMBRE DEL PROVEEDOR", LEFT_MARGIN + 1.7, 82.3, font="Calibri-Bold", size=9)
    _draw_text(c, "CORREO ELECTRONICO", LEFT_MARGIN + 1.7, 96.8, font="Calibri-Bold", size=9)
    _draw_text(c, "FECHA DE EVALUACIÓN", LEFT_MARGIN + 1.7, 111.3, font="Calibri-Bold", size=9)

    proveedor = str(ev.get("proveedor", "")).upper()
    correo = str(ev.get("correo") or "").upper()
    # Original sample uses DD/MM/YYYY as entered. If user typed DD/MM/YYYY we keep it.
    # If they entered YYYY-MM-DD (HTML date input default), convert to DD/MM/YYYY.
    fecha = format_date(str(ev.get("fecha", "")))

    _draw_text(c, proveedor, 255.9, 81.6, font="Calibri-Bold", size=10)
    _draw_text(c, correo, 255.8, 96.8, font="Calibri", size=9)
    _draw_text(c, fecha, 374.4, 105.6, font="Calibri-Bold", size=10)

    c.setFillColor(BLACK)
    for x in [44.0, 253.63, 542.48]:
        c.rect(x - 0.5, 74.3, 1.5, 43.6, fill=1, stroke=0)

    # ============== 3. SISTEMA DE PUNTUACIÓN ==============
    _draw_text(c, "SISTEMA DE PUNTUACIÓN", LEFT_MARGIN + 1.7, 132.6, font="Calibri-Bold", size=9)
    _draw_text(c, "Malo=1", 255.7, 132.4, font="Calibri", size=8)
    _draw_text(c, "Regular=2", 315.8, 132.4, font="Calibri", size=8)
    _draw_text(c, "Bien=3", 364.5, 132.4, font="Calibri", size=8)
    _draw_text(c, "Excelente=4", 413.4, 132.4, font="Calibri", size=8)

    # ============== 4. TABLE HEADER (y=145-160) ==============
    c.setFillColor(LIGHT_BLUE)
    c.rect(LEFT_MARGIN, 145, CONTENT_W, 15.3, fill=1, stroke=0)
    _draw_text(c, "Criterio a evaluar", LEFT_MARGIN + 1.7, 150, font="Calibri-Bold", size=10)
    _draw_text(c, "Calificación", 388.5, 150, font="Calibri-Bold", size=10)
    c.setFillColor(BLACK)
    for x in [44.0, 362.45, 460.08]:
        c.rect(x - 0.5, 144, 1.5, 17.2, fill=1, stroke=0)

    # ============== 5. CRITERIA ROWS ==============
    criteria_labels = [
        "Calidad del producto",
        "Relación precio-calidad",
        "Material en stock",
        "Posibilidad de devolución del producto",
        "Servicio (velocidad de respuesta)",
        "Cumplimiento de fecha de entrega",
        "Servicio post-venta",
        "Pago del transporte",
        "Amabilidad de venta",
        "Envío de material completo",
    ]
    scores = [
        ev.get("c1", 0), ev.get("c2", 0), ev.get("c3", 0), ev.get("c4", 0), ev.get("c5", 0),
        ev.get("c6", 0), ev.get("c7", 0), ev.get("c8", 0), ev.get("c9", 0), ev.get("c10", 0),
    ]

    row_h = 14.5
    y_start = 168
    for i, (label, score) in enumerate(zip(criteria_labels, scores)):
        y = y_start - i * row_h
        _draw_text(c, label, LEFT_MARGIN + 1.7, y, font="Calibri", size=9)
        _draw_text_right(c, str(score), 414.7, y - 0.8, font="Calibri-Bold", size=10)

    table_top = 161.2
    table_bottom = table_top - 10 * row_h
    c.setFillColor(BLACK)
    c.rect(43.5, table_bottom, 1.5, table_top - table_bottom, fill=1, stroke=0)
    c.rect(362.45, table_bottom, 1.5, table_top - table_bottom, fill=1, stroke=0)
    c.rect(459.58, table_bottom, 1.5, table_top - table_bottom, fill=1, stroke=0)

    # ============== 6. TOTALS ==============
    total_obtained_y = 309.3
    total_possible_y = 323.8
    eval_y = 347.8

    total = ev.get("total", 0)
    possible = 40
    calificacion = float(ev.get("calificacion", 0))
    clasificacion = str(ev.get("clasificacion", "MALO"))

    _draw_text(c, "Total de puntos obtenidos", LEFT_MARGIN + 1.7, total_obtained_y, font="Calibri-Bold", size=9)
    _draw_text_right(c, str(total), 417.8, total_obtained_y - 0.7, font="Calibri-Bold", size=11)
    _draw_text(c, "Total de puntos posibles", LEFT_MARGIN + 1.7, total_possible_y, font="Calibri", size=9)
    _draw_text_right(c, str(possible), 417.3, total_possible_y - 0.8, font="Calibri", size=10)
    _draw_text(c, "Evaluación del proveedor=", LEFT_MARGIN + 1.7, eval_y, font="Calibri-Bold", size=10)
    _draw_text_right(c, f"{calificacion:.1f}", 351.6, eval_y - 1.2, font="Calibri-Bold", size=14)

    cls_color = {
        "EXCELENTE": DARK_GREEN, "BUENO": LIGHT_GREEN,
        "REGULAR": ORANGE, "MALO": RED,
    }.get(clasificacion, DARK_GREEN)
    cls_text_color = WHITE if clasificacion in ("EXCELENTE", "MALO") else BLACK

    box_x = 425.7
    box_y = 342.03
    box_w = 117.13
    box_h = 18.9
    c.setFillColor(cls_color)
    c.rect(box_x, box_y, box_w, box_h, fill=1, stroke=0)
    _draw_centered_text(
        c, clasificacion,
        x_center=box_x + box_w / 2, y=box_y + 5,
        font="Calibri-Bold", size=12, color=cls_text_color,
    )
    c.setFillColor(BLACK)
    c.rect(541.98, 343.03, 2, 18.8, fill=1, stroke=0)

    # ============== 7. CLASSIFICATION LEGEND ==============
    legend_y_start = 375.3
    legend_row_h = 14.55
    legend_label_w = 48.9
    legend_rows = [
        ("EXCELENTE", "91 - 100", DARK_GREEN, WHITE),
        ("BUENO", "71 - 90", LIGHT_GREEN, BLACK),
        ("REGULAR", "51 - 70", ORANGE, BLACK),
        ("MALO", "0 - 50", RED, WHITE),
    ]
    for i, (lbl, rng, bg, fg) in enumerate(legend_rows):
        y = legend_y_start + (3 - i) * legend_row_h
        c.setFillColor(bg)
        c.rect(LEFT_MARGIN, y, legend_label_w, 14.55, fill=1, stroke=0)
        _draw_centered_text(
            c, lbl,
            x_center=LEFT_MARGIN + legend_label_w / 2, y=y + 4.5,
            font="Calibri-Bold", size=9, color=fg,
        )
        _draw_text(c, rng, 95.2, y + 5, font="Calibri-Bold", size=11)
    c.setFillColor(BLACK)
    c.rect(43.5, 374.82, 1.5, 58.97, fill=1, stroke=0)

    # ============== 8. OBSERVATIONS ==============
    _draw_text(c, "Observaciones:", LEFT_MARGIN + 1.7, 453.1, font="Calibri-Bold", size=10)
    obs = str(ev.get("observaciones") or "").strip() or "SIN OBSERVACIONES."
    _draw_text(c, obs, LEFT_MARGIN + 1.7, 466.7, font="Calibri", size=9)
    c.setFillColor(BLACK)
    c.rect(43.5, 461.9, 1.5, 41.7, fill=1, stroke=0)

    # ============== 9. SIGNATURE ROW ==============
    sig_label_y = 524.4
    sig_value_y = 562.3
    _draw_text(c, "Nombre del evaluador", LEFT_MARGIN + 1.7, sig_label_y, font="Calibri-Bold", size=8)
    _draw_text(c, "Firma", 275.1, sig_label_y, font="Calibri-Bold", size=8)
    _draw_text(c, "Cargo", 427.1, sig_label_y, font="Calibri-Bold", size=8)
    _draw_text(c, str(ev.get("evaluador", "Walter Piñera")), LEFT_MARGIN + 1.7, sig_value_y, font="Calibri", size=9)
    _draw_text(c, str(ev.get("cargo", "Ingeniero Calidad y Compras")), 431.1, sig_value_y - 0.6, font="Calibri", size=8)

    if SIGNATURE_PATH:
        sw, sh = _fit_image(SIGNATURE_PATH, 130, 50)
        sx = 260 + (130 - sw) / 2
        sy = sig_value_y - sh + 5
        c.drawImage(SIGNATURE_PATH, sx, sy, width=sw, height=sh, mask='auto')

    c.setStrokeColor(BLACK)
    c.setLineWidth(0.5)
    c.line(LEFT_MARGIN, sig_value_y - 4, 250, sig_value_y - 4)
    c.line(270, sig_value_y - 4, 410, sig_value_y - 4)
    c.line(427, sig_value_y - 4, RIGHT_MARGIN, sig_value_y - 4)

    # ============== 10. FOOTER ==============
    _draw_text(c, "F-CAL-07 REV01", LEFT_MARGIN + 1.7, 606.6, font="Calibri", size=8, color=GRAY)

    c.showPage()

    # ============== OPTIONAL: CHART PAGE ==============
    if chart_path and os.path.exists(chart_path):
        c.setFillColor(WHITE)
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        _draw_centered_text(
            c, "POSICIÓN COMPARATIVA ENTRE PROVEEDORES",
            x_center=PAGE_W / 2, y=PAGE_H - 50,
            font="Calibri-Bold", size=14,
        )
        _draw_centered_text(
            c, f"{ev.get('proveedor', '')} - Calificación: {calificacion:.1f} ({clasificacion})",
            x_center=PAGE_W / 2, y=PAGE_H - 68,
            font="Calibri", size=10, color=GRAY,
        )
        img_w = PAGE_W - 80
        img_h = 0
        try:
            with PILImage.open(chart_path) as im:
                iw, ih = im.size
            img_h = img_w * ih / iw
            max_h = PAGE_H - 160
            if img_h > max_h:
                img_h = max_h
                img_w = img_h * iw / ih
        except Exception:
            img_h = 400
        ix = (PAGE_W - img_w) / 2
        iy = (PAGE_H - img_h) / 2 - 20
        c.drawImage(chart_path, ix, iy, width=img_w, height=img_h, mask='auto')
        c.showPage()

    c.save()
    return out_path


def format_date(s):
    """Format date as MM/DD/YYYY to match the original F-CAL-07 sample PDF.
    Accepts YYYY-MM-DD or DD/MM/YYYY or MM/DD/YYYY input."""
    if not s:
        return ""
    s = s.strip()
    # YYYY-MM-DD (HTML date input) -> MM/DD/YYYY
    if "-" in s and len(s) >= 10:
        parts = s[:10].split("-")
        if len(parts) == 3:
            y, m, d = parts
            if y and m and d:
                return f"{m}/{d}/{y}"
    # Already has slashes - keep as-is
    return s


# ============== CLI entry point ==============
# Usage: python3 pdf_generator.py <ev.json> <out.pdf> [<chart.png>|__NO_CHART__] [<logo.png>] [<signature.png>]
if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) < 3:
        print("Usage: pdf_generator.py <ev.json> <out.pdf> [<chart.png>|__NO_CHART__] [<logo.png>] [<signature.png>]", file=sys.stderr)
        sys.exit(2)

    ev_json_path = sys.argv[1]
    out_pdf_path = sys.argv[2]
    chart_arg = sys.argv[3] if len(sys.argv) > 3 else None
    logo_arg = sys.argv[4] if len(sys.argv) > 4 else None
    sig_arg = sys.argv[5] if len(sys.argv) > 5 else None

    # Override module-level paths if provided
    if logo_arg and os.path.exists(logo_arg):
        LOGO_PATH = logo_arg
    if sig_arg and os.path.exists(sig_arg):
        SIGNATURE_PATH = sig_arg

    with open(ev_json_path, "r", encoding="utf-8") as f:
        ev = json.load(f)

    chart_path = None
    if chart_arg and chart_arg != "__NO_CHART__" and os.path.exists(chart_arg):
        chart_path = chart_arg

    generate_pdf(out_pdf_path, ev, chart_path=chart_path)
    print(f"OK: {out_pdf_path}", file=sys.stderr)
