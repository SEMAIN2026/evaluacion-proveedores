"""Wipe all providers from Turso and insert the 4 new ones from PDFs."""
import json
import urllib.request
import urllib.error

BASE_URL = "https://my-project-mu-tan.vercel.app"

# 4 new providers extracted from PDFs
NEW_PROVIDERS = [
    {
        "proveedor": "MULTIEMPAQUES",
        "correo": "",  # N/A in original
        "fecha": "2026-07-02",
        "c1": 4, "c2": 4, "c3": 4, "c4": 4, "c5": 4,
        "c6": 4, "c7": 4, "c8": 4, "c9": 4, "c10": 4,
        "observaciones": "TODO MUY BIEN",
    },
    {
        "proveedor": "JW WINCO MEXICO, S.A. DE C.V.",
        "correo": "FMUNOZ@JWWINCO.MX",
        "fecha": "2026-07-02",
        "c1": 4, "c2": 4, "c3": 3, "c4": 4, "c5": 3,
        "c6": 4, "c7": 4, "c8": 2, "c9": 4, "c10": 4,
        "observaciones": "SIN COMENTARIOS",
    },
    {
        "proveedor": "HEMACHISA HERRAMIENTAS",
        "correo": "VENTAS2@HEMACHISA.COM",
        "fecha": "2026-07-02",
        "c1": 4, "c2": 4, "c3": 4, "c4": 4, "c5": 3,
        "c6": 4, "c7": 4, "c8": 4, "c9": 4, "c10": 4,
        "observaciones": "TODO MUY BIEN",
    },
    {
        "proveedor": "SERVIACERO",
        "correo": "JOSE.ALEMAN@SERVIACERO.COM",
        "fecha": "2026-07-02",
        "c1": 4, "c2": 4, "c3": 4, "c4": 4, "c5": 4,
        "c6": 4, "c7": 4, "c8": 4, "c9": 4, "c10": 4,
        "observaciones": "TODO MUY BIEN",
    },
]


def api(method, path, body=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode("utf-8"), "status": e.code}


# Step 1: get all existing evaluations
print("Fetching existing evaluations...")
res = api("GET", "/api/evaluations")
existing = res.get("data", [])
print(f"Found {len(existing)} existing evaluations")

# Step 2: delete each one
print("\nDeleting existing evaluations...")
for ev in existing:
    eid = ev["id"]
    print(f"  - Deleting {ev.get('proveedor', eid)} ({eid})...")
    api("DELETE", f"/api/evaluations/{eid}")
print("✓ All existing evaluations deleted")

# Step 3: insert new providers
print("\nInserting new providers...")
for p in NEW_PROVIDERS:
    print(f"  + Inserting {p['proveedor']}...")
    res = api("POST", "/api/evaluations", p)
    if "error" in res:
        print(f"    ERROR: {res['error']}")
    else:
        d = res["data"]
        print(f"    ✓ {d['proveedor']} → {d['calificacion']:.1f} ({d['clasificacion']}) [id={d['id']}]")

# Step 4: verify
print("\nFinal list:")
res = api("GET", "/api/evaluations")
for ev in res.get("data", []):
    correo = ev.get("correo") or "(sin correo)"
    print(f"  - {ev['proveedor']:40s} {ev['calificacion']:6.1f} {ev['clasificacion']:10s} {correo}")

print(f"\n✓ Total: {len(res.get('data', []))} proveedores")
