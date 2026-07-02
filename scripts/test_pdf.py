"""Test the PDF generator against the sample CNC Herramientas Chihuahua evaluation."""
import sys
sys.path.insert(0, "/home/z/my-project/scripts")
from pdf_generator import generate_pdf

ev = {
    "proveedor": "CNC Herramientas Chihuahua",
    "correo": "VENTAS@COMPU-MECANIC.COM",
    "fecha": "2026-07-02",
    "c1": 4, "c2": 4, "c3": 3, "c4": 4, "c5": 4,
    "c6": 4, "c7": 2, "c8": 4, "c9": 4, "c10": 4,
    "total": 37,
    "calificacion": 92.5,
    "clasificacion": "EXCELENTE",
    "observaciones": "SIN OBSERVACIONES.",
    "evaluador": "Walter Piñera",
    "cargo": "Ingeniero Calidad y Compras",
}

out = generate_pdf("/tmp/test-exact.pdf", ev)
print(f"Generated: {out}")

# Verify with pymupdf
import fitz
doc = fitz.open(out)
print(f"Pages: {len(doc)}")
print(f"Page 1 size: {doc[0].rect}")
print("\n=== Page 1 text ===")
print(doc[0].get_text())
print(f"\n=== Page 1 images ===")
for img in doc[0].get_images():
    print(f"  {img}")
print(f"\n=== Drawings count: {len(doc[0].get_drawings())} ===")
