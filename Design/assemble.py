# -*- coding: utf-8 -*-
"""Fuegt Shell-Template + gemeinsames CSS + JS-Module + Seiten-Fragmente +
Beispieldaten zu einer einzigen, eigenstaendigen index.html zusammen."""
import json
from pathlib import Path

BASE = Path(__file__).parent
FRAGMENTS = BASE / "fragments"
OUT = BASE.parent / "Berichte" / "index.html"

def read(path, default=""):
    p = Path(path)
    return p.read_text(encoding="utf-8") if p.exists() else default

template = read(BASE / "shell-template.html")
base_css = read(BASE / "styles.css")
logo_b64 = read(BASE / "logo-invers.b64.txt").strip()
logo_normal_b64 = read(BASE / "logo.b64.txt").strip()
# Nur das Signet ohne Wortmarke - dient als Wasserzeichen auf den Druckseiten.
logo_icon_b64 = read(BASE / "icon.b64.txt").strip()

page_css_parts = []
for name in ["page-uebersicht", "page-schulungen", "page-schulungdetail", "page-buchungen", "page-trainer", "page-hilfe"]:
    css = read(FRAGMENTS / f"{name}.css")
    if css.strip():
        page_css_parts.append(f"/* ---- {name}.css ---- */\n{css}")
page_css = "\n\n".join(page_css_parts)

core_js_parts = []
for name in ["state-engine", "file-store", "ui-helpers"]:
    js = read(BASE / f"{name}.js")
    core_js_parts.append(f"// ---- {name}.js ----\n{js}")
core_js = "\n\n".join(core_js_parts)

page_js_parts = []
for name in ["page-uebersicht", "page-schulungen", "page-schulungdetail", "page-buchungen", "page-trainer", "page-hilfe"]:
    js = read(FRAGMENTS / f"{name}.js")
    if js.strip():
        page_js_parts.append(f"// ---- {name}.js ----\n{js}")
# Gemeinsame Druckvorlagen (Bescheinigung/Bericht) - kein Seiten-Fragment,
# wird aber wie eines eingebettet, damit alle Seiten sie nutzen koennen.
druck_js = read(FRAGMENTS / "druck-vorlagen.js")
if druck_js.strip():
    page_js_parts.insert(0, f"// ---- druck-vorlagen.js ----\n{druck_js}")

page_js = "\n\n".join(page_js_parts)

pages = {}
for key, fname in [
    ("PAGE_UEBERSICHT", "page-uebersicht.html"),
    ("PAGE_SCHULUNGEN", "page-schulungen.html"),
    ("PAGE_SCHULUNGDETAIL", "page-schulungdetail.html"),
    ("PAGE_BUCHUNGEN", "page-buchungen.html"),
    ("PAGE_TRAINER", "page-trainer.html"),
    ("PAGE_HILFE", "page-hilfe.html"),
]:
    pages[key] = read(FRAGMENTS / fname, f"<p>FEHLT: {fname}</p>")

data_json_path = BASE.parent / "Daten" / "schulungsdaten.json"
data = json.loads(data_json_path.read_text(encoding="utf-8"))
data_json_str = json.dumps(data, ensure_ascii=False)

html = template
html = html.replace("{{BASE_CSS}}", base_css)
html = html.replace("{{PAGE_CSS}}", page_css)
html = html.replace("{{LOGO_B64}}", logo_b64)
html = html.replace("{{LOGO_NORMAL_B64}}", logo_normal_b64)
html = html.replace("{{LOGO_ICON_B64}}", logo_icon_b64)
html = html.replace("{{CORE_JS}}", core_js)
html = html.replace("{{PAGE_JS}}", page_js)
html = html.replace("{{DATA_JSON}}", data_json_str)
for key, content in pages.items():
    html = html.replace("{{" + key + "}}", content)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(html, encoding="utf-8")
print("Geschrieben:", OUT, len(html), "Zeichen")
