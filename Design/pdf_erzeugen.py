# Design/pdf_erzeugen.py
# Wandelt die vom Schulungsplaner abgelegten HTML-Dokumente in PDF um.
#
# Warum ueberhaupt ein Skript: Eine Anwendung im Browser kann keine PDF-Datei
# erzeugen - das PDF entsteht erst im Druckdialog und liegt ausserhalb ihrer
# Reichweite. Chrome selbst kann es aber im Hintergrund, in derselben
# Qualitaet wie beim Drucken von Hand. Genau das macht dieses Skript.
#
# Aufruf (oder per Doppelklick auf PDFs-erzeugen.cmd):
#   python Design/pdf_erzeugen.py
#   python Design/pdf_erzeugen.py --alle      (auch vorhandene PDFs neu erzeugen)

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

# Der Ablageordner liegt neben dem Projekt; abweichender Pfad per Parameter.
STANDARD_ABLAGE = Path(__file__).resolve().parent.parent / "Ablage"

CHROME_ORTE = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def finde_browser():
    for ort in CHROME_ORTE:
        if os.path.exists(ort):
            return ort
    return None


def als_datei_uri(pfad: Path) -> str:
    return "file:///" + str(pfad).replace("\\", "/").replace(" ", "%20")


def erzeuge_pdf(browser: str, quelle: Path, ziel: Path) -> tuple[bool, str]:
    # Absolute Pfade: mit einem relativen Ziel verweigert Chrome das Schreiben.
    quelle = quelle.resolve()
    ziel = ziel.resolve()
    # Eigenes Nutzerprofil je Lauf: sonst verweigert Chrome den Start, wenn
    # nebenher ein Fenster offen ist.
    with tempfile.TemporaryDirectory(prefix="sp-pdf-") as profil:
        ergebnis = subprocess.run(
            [
                browser,
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                f"--user-data-dir={profil}",
                "--virtual-time-budget=4000",
                "--no-pdf-header-footer",
                f"--print-to-pdf={ziel}",
                als_datei_uri(quelle),
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    if ziel.exists() and ziel.stat().st_size > 800:
        return True, ""
    fehler = (ergebnis.stderr or "").strip().splitlines()
    return False, fehler[-1][:160] if fehler else "unbekannter Fehler"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Erzeugt PDFs aus den abgelegten HTML-Dokumenten des Schulungsplaners."
    )
    parser.add_argument("ablage", nargs="?", default=str(STANDARD_ABLAGE),
                        help="Ablageordner (Vorgabe: Ablage neben dem Projekt)")
    parser.add_argument("--alle", action="store_true",
                        help="auch PDFs neu erzeugen, die es schon gibt")
    argumente = parser.parse_args()

    ablage = Path(argumente.ablage).resolve()
    if not ablage.exists():
        print(f"Ablageordner nicht gefunden: {ablage}")
        print("Pfad als Parameter angeben, z. B.:")
        print(r'  python Design\pdf_erzeugen.py "C:\...\Schulungsplaner\Ablage"')
        return 1

    browser = finde_browser()
    if not browser:
        print("Weder Chrome noch Edge gefunden - ohne einen der beiden geht es nicht.")
        return 1

    # Die Kennungs- und Datendateien sind keine Dokumente.
    dokumente = [p for p in ablage.rglob("*.html")]
    if not dokumente:
        print(f"Keine HTML-Dokumente in {ablage} gefunden.")
        return 0

    print(f"Ablage:  {ablage}")
    print(f"Browser: {browser}")
    print(f"{len(dokumente)} Dokument(e) gefunden.\n")

    erzeugt, uebersprungen, fehlgeschlagen = 0, 0, []
    for quelle in sorted(dokumente):
        ziel = quelle.with_suffix(".pdf")
        if ziel.exists() and not argumente.alle:
            uebersprungen += 1
            continue
        kurz = quelle.relative_to(ablage)
        print(f"  {kurz} ... ", end="", flush=True)
        ok, grund = erzeuge_pdf(browser, quelle, ziel)
        if ok:
            erzeugt += 1
            print("fertig")
        else:
            fehlgeschlagen.append((str(kurz), grund))
            print("FEHLER")

    print()
    print(f"{erzeugt} PDF(s) erzeugt, {uebersprungen} bereits vorhanden.")
    if fehlgeschlagen:
        print(f"{len(fehlgeschlagen)} fehlgeschlagen:")
        for name, grund in fehlgeschlagen:
            print(f"  {name}: {grund}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
