# -*- coding: utf-8 -*-
"""Prueft Invarianten der auf v3 migrierten Daten. Exit-Code 1 bei Fehlern."""
import json
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "Daten" / "schulungsdaten.json"


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    fehler = []

    for key in ("kurse", "teilnehmer", "buchungen", "trainer", "einstellungen"):
        if key not in data:
            fehler.append(f"Top-Level-Key '{key}' fehlt")
    if fehler:
        print("FEHLER GEFUNDEN:")
        for f in fehler:
            print(" -", f)
        raise SystemExit(1)

    trainer_ids = {t["id"] for t in data["trainer"]}
    for t in data["trainer"]:
        for feld in ("id", "name", "email", "telefon", "qualifikation", "notizen", "dokumente"):
            if feld not in t:
                fehler.append(f"Trainer {t.get('id')} fehlt Feld '{feld}'")
        if not isinstance(t.get("dokumente"), list):
            fehler.append(f"Trainer {t.get('id')}: dokumente ist keine Liste")

    alle_termin_ids = set()
    for kurs in data["kurse"]:
        for feld in ("format", "minTeilnehmer", "maxTeilnehmer", "zertifikat"):
            if feld not in kurs:
                fehler.append(f"Kurs {kurs.get('id')} fehlt neues Feld '{feld}'")
        if "zielgruppe" in kurs:
            fehler.append(f"Kurs {kurs['id']} hat noch das alte Feld 'zielgruppe'")
        if kurs.get("format") not in ("Vor Ort", "Online", "Hybrid"):
            fehler.append(f"Kurs {kurs.get('id')}: ungueltiges Format {kurs.get('format')!r}")
        if not isinstance(kurs.get("minTeilnehmer"), int) or kurs["minTeilnehmer"] < 1:
            fehler.append(f"Kurs {kurs.get('id')}: minTeilnehmer ungueltig")
        if not isinstance(kurs.get("maxTeilnehmer"), int) or kurs["maxTeilnehmer"] < 1:
            fehler.append(f"Kurs {kurs.get('id')}: maxTeilnehmer ungueltig")
        if kurs.get("minTeilnehmer", 0) > kurs.get("maxTeilnehmer", 0):
            fehler.append(f"Kurs {kurs.get('id')}: minTeilnehmer > maxTeilnehmer")

        zert = kurs.get("zertifikat", {})
        for feld in ("kuerzel", "umfangUE", "ueberschrift", "bestaetigungstext", "gueltigkeit"):
            if feld not in zert:
                fehler.append(f"Kurs {kurs.get('id')}: zertifikat fehlt Feld '{feld}'")

        for termin in kurs["termine"]:
            for feld in ("trainerId", "vertretungTrainerId", "abschluss"):
                if feld not in termin:
                    fehler.append(f"Termin {termin.get('id')} fehlt neues Feld '{feld}'")
            for altfeld in ("trainer", "format", "kapazitaet"):
                if altfeld in termin:
                    fehler.append(f"Termin {termin.get('id')} hat noch das alte Feld '{altfeld}'")
            if termin.get("trainerId") is not None and termin["trainerId"] not in trainer_ids:
                fehler.append(f"Termin {termin['id']}: unbekannte trainerId {termin['trainerId']}")
            if termin.get("abschluss") is not None:
                fehler.append(f"Termin {termin['id']}: abschluss sollte null sein")
            alle_termin_ids.add(termin["id"])

    for b in data["buchungen"]:
        for feld in ("anwesenheitProzent", "fehlgrund", "zertifikatNr", "statusManuell"):
            if feld not in b:
                fehler.append(f"Buchung {b.get('id')} fehlt neues Feld '{feld}'")
        if b.get("statusManuell") is not False:
            fehler.append(f"Buchung {b.get('id')}: statusManuell sollte false sein")
        if b.get("terminId") not in alle_termin_ids:
            fehler.append(f"Buchung {b.get('id')}: unbekannte terminId {b.get('terminId')}")

    e = data["einstellungen"]
    if e.get("zertifikatStartNummer") != 147:
        fehler.append("einstellungen.zertifikatStartNummer sollte 147 sein")
    if e.get("bestaetigungsfristTage") != 7:
        fehler.append("einstellungen.bestaetigungsfristTage sollte 7 sein")

    if fehler:
        print("FEHLER GEFUNDEN:")
        for f in fehler:
            print(" -", f)
        raise SystemExit(1)
    print("v3-Migration verifiziert: keine Fehler.")


if __name__ == "__main__":
    main()
