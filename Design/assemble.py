# -*- coding: utf-8 -*-
"""Fuegt Shell-Template + gemeinsames CSS + Seiten-Fragmente + Beispieldaten
zu einer einzigen, eigenstaendigen index.html zusammen."""
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

page_css_parts = []
for name in ["page-uebersicht", "page-schulungen", "page-schulungdetail", "page-teilnehmer", "page-kunden"]:
    css = read(FRAGMENTS / f"{name}.css")
    if css.strip():
        page_css_parts.append(f"/* ---- {name}.css ---- */\n{css}")
page_css = "\n\n".join(page_css_parts)

pages = {}
for key, fname in [
    ("PAGE_UEBERSICHT", "page-uebersicht.html"),
    ("PAGE_SCHULUNGEN", "page-schulungen.html"),
    ("PAGE_SCHULUNGDETAIL", "page-schulungdetail.html"),
    ("PAGE_TEILNEHMER", "page-teilnehmer.html"),
    ("PAGE_KUNDEN", "page-kunden.html"),
]:
    pages[key] = read(FRAGMENTS / fname, f"<p>FEHLT: {fname}</p>")

data_json_path = BASE.parent / "Daten" / "schulungsdaten.json"
data = json.loads(data_json_path.read_text(encoding="utf-8"))
data_json_str = json.dumps(data, ensure_ascii=False)

html = template
html = html.replace("{{BASE_CSS}}", base_css)
html = html.replace("{{PAGE_CSS}}", page_css)
html = html.replace("{{LOGO_B64}}", logo_b64)
html = html.replace("{{DATA_JSON}}", data_json_str)
for key, content in pages.items():
    html = html.replace("{{" + key + "}}", content)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(html, encoding="utf-8")
print("Geschrieben:", OUT, len(html), "Zeichen")
