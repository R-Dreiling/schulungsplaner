# -*- coding: utf-8 -*-
"""Prueft Invarianten der migrierten Daten. Exit-Code 1 bei Fehlern."""
import json
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "Daten" / "schulungsdaten.json"


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    fehler = []

    if "schulungen" in data or "kunden" in data:
        fehler.append("Alte Top-Level-Keys 'schulungen'/'kunden' noch vorhanden")

    kurse = data.get("kurse", [])
    if len(kurse) != 8:
        fehler.append(f"Erwartet 8 Kurse, gefunden {len(kurse)}")

    alle_termin_ids = set()
    for kurs in kurse:
        for feld in ("id", "titel", "kategorie", "beschreibung", "lernziele", "agenda", "materialien", "termine"):
            if feld not in kurs:
                fehler.append(f"Kurs {kurs.get('id')} fehlt Feld '{feld}'")
        for termin in kurs.get("termine", []):
            for feld in ("id", "datum", "trainer", "format", "ort", "kapazitaet", "status", "checkliste"):
                if feld not in termin:
                    fehler.append(f"Termin {termin.get('id')} fehlt Feld '{feld}'")
            if termin["id"] in alle_termin_ids:
                fehler.append(f"Doppelte Termin-ID: {termin['id']}")
            alle_termin_ids.add(termin["id"])
            if len(termin.get("checkliste", [])) != 5:
                fehler.append(f"Termin {termin['id']}: Checkliste hat nicht 5 Punkte")

    erwartete_zusatz_termine = {"s1b", "s3b"}
    if not erwartete_zusatz_termine.issubset(alle_termin_ids):
        fehler.append("Synthetische Zweittermine s1b/s3b fehlen")

    teilnehmer = data.get("teilnehmer", [])
    if len(teilnehmer) != 33:
        fehler.append(f"Erwartet 33 Teilnehmer, gefunden {len(teilnehmer)}")
    teilnehmer_ids = {t["id"] for t in teilnehmer}
    for t in teilnehmer:
        if "schulungIds" in t or "anmeldestatus" in t:
            fehler.append(f"Teilnehmer {t['id']} hat noch altes Feld schulungIds/anmeldestatus")

    buchungen = data.get("buchungen", [])
    if len(buchungen) != 36:
        fehler.append(f"Erwartet 36 Buchungen (Summe aller alten schulungIds), gefunden {len(buchungen)}")
    buchung_ids = set()
    for b in buchungen:
        for feld in ("id", "teilnehmerId", "terminId", "anmeldestatus", "gebuchtAm"):
            if feld not in b:
                fehler.append(f"Buchung {b.get('id')} fehlt Feld '{feld}'")
        if b["id"] in buchung_ids:
            fehler.append(f"Doppelte Buchungs-ID: {b['id']}")
        buchung_ids.add(b["id"])
        if b["teilnehmerId"] not in teilnehmer_ids:
            fehler.append(f"Buchung {b['id']}: unbekannte teilnehmerId {b['teilnehmerId']}")
        if b["terminId"] not in alle_termin_ids:
            fehler.append(f"Buchung {b['id']}: unbekannte terminId {b['terminId']}")

    if fehler:
        print("FEHLER GEFUNDEN:")
        for f in fehler:
            print(" -", f)
        raise SystemExit(1)
    print("Migration verifiziert: keine Fehler.")


if __name__ == "__main__":
    main()
