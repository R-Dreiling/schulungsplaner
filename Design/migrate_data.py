# -*- coding: utf-8 -*-
"""Einmalige Migration: alte Struktur (schulungen/teilnehmer/kunden) ->
neue Struktur (kurse mit verschachtelten terminen, teilnehmer, buchungen).
Nach erfolgreicher Migration + Verifikation kann diese Datei bleiben
(dokumentiert die Herkunft der Daten), wird aber nicht mehr ausgefuehrt."""
import json
import hashlib
from datetime import date, timedelta
from pathlib import Path

BASE = Path(__file__).parent
DATA_PATH = BASE.parent / "Daten" / "schulungsdaten.json"

CHECKLISTE_LABELS = [
    "Raum gebucht", "Technik geprüft", "Unterlagen gedruckt",
    "Einladungen versendet", "Zertifikate vorbereitet",
]

# schulung-id -> kurs-id Gruppierung (in den Beispieldaten hat aktuell jede
# schulung einen eigenen Titel, daher 1:1 -- ausser s1 und s3, denen wir je
# einen zusaetzlichen synthetischen Zweittermin geben, um das Kern-Feature
# "zwei Termine je Kurs" mit den Beispieldaten zeigen zu koennen).
SCHULUNG_ZU_KURS = {
    "s1": "k1", "s5": "k2", "s2": "k3", "s3": "k4",
    "s7": "k5", "s4": "k6", "s6": "k7", "s8": "k8",
}

KURS_META = {
    "k1": dict(titel="Datenschutzbeauftragter Grundlagenschulung", kategorie="Datenschutz",
        beschreibung="Grundlagenschulung für neu bestellte oder angehende Datenschutzbeauftragte. Vermittelt die rechtlichen Grundlagen der DSGVO sowie die praktische Umsetzung im Unternehmensalltag.",
        lernziele=["Rechtliche Grundlagen der DSGVO und des BDSG verstehen", "Rollen und Pflichten des Datenschutzbeauftragten kennen", "Ein Verfahrensverzeichnis eigenständig aufbauen können", "Meldepflichten bei Datenschutzverstößen sicher anwenden"],
        zielgruppe="Neue und angehende Datenschutzbeauftragte", voraussetzungen="Keine",
        agenda=[
            {"zeit": "09:00–10:30", "titel": "Rechtliche Grundlagen der DSGVO", "beschreibung": "Überblick über Verordnung, BDSG und Zusammenspiel"},
            {"zeit": "10:45–12:00", "titel": "Rollen & Pflichten des DSB", "beschreibung": "Bestellung, Stellung im Unternehmen, Haftung"},
            {"zeit": "13:00–14:30", "titel": "Verfahrensverzeichnis in der Praxis", "beschreibung": "Aufbau und Pflege anhand von Beispielen"},
            {"zeit": "14:45–16:00", "titel": "Meldepflichten & Vorfallmanagement", "beschreibung": "Ablauf bei Datenschutzverstößen, Fristen"},
        ]),
    "k2": dict(titel="DSGVO Update für Führungskräfte", kategorie="Datenschutz",
        beschreibung="Kompaktes Update zu aktuellen DSGVO-Entwicklungen speziell für Führungskräfte mit Personalverantwortung.",
        lernziele=["Aktuelle Rechtsprechung zur DSGVO kennen", "Verantwortung als Führungskraft einschätzen können", "Datenschutzrisiken im eigenen Bereich erkennen"],
        zielgruppe="Führungskräfte", voraussetzungen="Grundkenntnisse Datenschutz empfohlen",
        agenda=[
            {"zeit": "09:00–10:30", "titel": "Aktuelle Rechtsprechung", "beschreibung": "Relevante Urteile und deren Praxisfolgen"},
            {"zeit": "10:45–12:00", "titel": "Verantwortung der Führungsebene", "beschreibung": "Haftung, Organisationspflichten"},
        ]),
    "k3": dict(titel="Hinweisgeberschutz kompakt", kategorie="Compliance",
        beschreibung="Kompaktschulung zu den Anforderungen des Hinweisgeberschutzgesetzes und dem Aufbau interner Meldestellen.",
        lernziele=["Anforderungen des Hinweisgeberschutzgesetzes kennen", "Interne Meldestelle korrekt aufsetzen", "Meldungen rechtssicher bearbeiten"],
        zielgruppe="Compliance-Verantwortliche, Personalabteilung", voraussetzungen="Keine",
        agenda=[
            {"zeit": "09:00–10:15", "titel": "Rechtlicher Rahmen", "beschreibung": "HinSchG im Überblick"},
            {"zeit": "10:30–12:00", "titel": "Meldestelle einrichten", "beschreibung": "Organisatorische und technische Anforderungen"},
            {"zeit": "13:00–14:30", "titel": "Fallbearbeitung in der Praxis", "beschreibung": "Vom Eingang der Meldung bis zum Abschluss"},
        ]),
    "k4": dict(titel="Arbeitssicherheit Basisschulung", kategorie="Arbeitssicherheit",
        beschreibung="Basisschulung zu den gesetzlichen Grundlagen der Arbeitssicherheit und praktischen Gefahrenprävention am Arbeitsplatz.",
        lernziele=["Gesetzliche Grundlagen des Arbeitsschutzes kennen", "Gefahren am Arbeitsplatz erkennen", "Präventionsmaßnahmen richtig anwenden"],
        zielgruppe="Alle Mitarbeitenden", voraussetzungen="Keine",
        agenda=[
            {"zeit": "09:00–10:30", "titel": "Grundlagen des Arbeitsschutzes", "beschreibung": "Gesetze, Verordnungen, Zuständigkeiten"},
            {"zeit": "10:45–12:00", "titel": "Gefahrenerkennung", "beschreibung": "Typische Gefahrenquellen im Arbeitsalltag"},
            {"zeit": "13:00–14:30", "titel": "Praxisübung Prävention", "beschreibung": "Maßnahmen anhand von Fallbeispielen"},
        ]),
    "k5": dict(titel="Gefährdungsbeurteilung Workshop", kategorie="Arbeitssicherheit",
        beschreibung="Praxisworkshop zur Erstellung und Aktualisierung von Gefährdungsbeurteilungen im Unternehmen.",
        lernziele=["Systematik der Gefährdungsbeurteilung anwenden", "Gefährdungen strukturiert erfassen", "Maßnahmen ableiten und dokumentieren"],
        zielgruppe="Führungskräfte, Sicherheitsbeauftragte", voraussetzungen="Keine",
        agenda=[
            {"zeit": "09:00–10:30", "titel": "Systematik & Rechtsgrundlagen", "beschreibung": "Ablauf und gesetzliche Vorgaben"},
            {"zeit": "10:45–12:30", "titel": "Praxis-Workshop", "beschreibung": "Gefährdungsbeurteilung anhand eigener Arbeitsplätze"},
        ]),
    "k6": dict(titel="Brandschutzhelfer Ausbildung", kategorie="Arbeitssicherheit",
        beschreibung="Ausbildung zum betrieblichen Brandschutzhelfer nach DGUV Information 205-023, Theorie und Löschübung.",
        lernziele=["Aufgaben des Brandschutzhelfers kennen", "Brandklassen und Löschmittel unterscheiden", "Löschgerät im Ernstfall sicher bedienen"],
        zielgruppe="Benannte Brandschutzhelfer", voraussetzungen="Keine",
        agenda=[
            {"zeit": "09:00–10:00", "titel": "Brandschutzgrundlagen", "beschreibung": "Brandklassen, Brandentstehung, Löschmittel"},
            {"zeit": "10:15–11:30", "titel": "Verhalten im Brandfall", "beschreibung": "Alarmierung, Evakuierung, Aufgaben des Helfers"},
            {"zeit": "11:45–13:00", "titel": "Praktische Löschübung", "beschreibung": "Handhabung von Feuerlöschern im Freien"},
        ]),
    "k7": dict(titel="Erste-Hilfe-Kurs", kategorie="Arbeitssicherheit",
        beschreibung="Betrieblicher Erste-Hilfe-Kurs nach DGUV Grundsatz 304-001 zur Ausbildung betrieblicher Ersthelfer.",
        lernziele=["Grundlagen der Ersten Hilfe anwenden", "Lebensrettende Sofortmaßnahmen sicher durchführen", "Verhalten im Notfall koordinieren"],
        zielgruppe="Benannte Ersthelfer", voraussetzungen="Keine",
        agenda=[
            {"zeit": "09:00–10:30", "titel": "Grundlagen der Ersten Hilfe", "beschreibung": "Absicherung, Notruf, Eigenschutz"},
            {"zeit": "10:45–12:15", "titel": "Lebensrettende Sofortmaßnahmen", "beschreibung": "Stabile Seitenlage, Reanimation"},
            {"zeit": "13:00–14:30", "titel": "Praxisübungen", "beschreibung": "Übungen an Fallbeispielen"},
        ]),
    "k8": dict(titel="Datenschutz-Auffrischung", kategorie="Datenschutz",
        beschreibung="Jährliche Pflicht-Auffrischung der Datenschutzgrundlagen für alle Mitarbeitenden.",
        lernziele=["Datenschutzgrundlagen im Arbeitsalltag anwenden", "Typische Fehlerquellen vermeiden", "Aktuelle Änderungen kennen"],
        zielgruppe="Alle Mitarbeitenden", voraussetzungen="Vorherige Datenschutzschulung",
        agenda=[
            {"zeit": "09:00–10:00", "titel": "Auffrischung der Grundlagen", "beschreibung": "Zentrale Prinzipien der DSGVO"},
            {"zeit": "10:15–11:00", "titel": "Typische Fehlerquellen", "beschreibung": "Beispiele aus der Praxis"},
        ]),
}

# Zusaetzliche synthetische Zweit-Termine, um "zwei naechste Termine je Kurs"
# mit den Beispieldaten sinnvoll zu zeigen. s1 (Datenschutzbeauftragter) und
# s3 (Arbeitssicherheit Basisschulung, aktuell 7/7 ausgebucht) bekommen je
# einen leeren Zweittermin.
ZUSATZ_TERMINE = {
    "k1": [{"id": "s1b", "datum": "2026-11-18", "trainer": "Dr. Julia Berg", "format": "Vor Ort", "ort": "Hamburg", "kapazitaet": 10, "status": "geplant"}],
    "k4": [{"id": "s3b", "datum": "2026-10-15", "trainer": "Sabine Kroll", "format": "Vor Ort", "ort": "München", "kapazitaet": 7, "status": "geplant"}],
}


def checkliste_fuer(status):
    erledigt = status in ("laufend", "abgeschlossen")
    return [{"label": label, "erledigt": erledigt} for label in CHECKLISTE_LABELS]


def gebucht_am(teilnehmer_id, termin_id, termin_datum_str):
    """Deterministisches, plausibles Buchungsdatum vor dem Termin."""
    termin_datum = date.fromisoformat(termin_datum_str)
    h = int(hashlib.sha256(f"{teilnehmer_id}:{termin_id}".encode("utf-8")).hexdigest(), 16)
    offset_tage = 14 + (h % 45)
    return (termin_datum - timedelta(days=offset_tage)).isoformat()


def migrieren():
    alt = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    kurse_by_id = {}
    for schulung in alt["schulungen"]:
        s_id = schulung["id"]
        k_id = SCHULUNG_ZU_KURS[s_id]
        if k_id not in kurse_by_id:
            meta = KURS_META[k_id]
            kurse_by_id[k_id] = {
                "id": k_id, "titel": meta["titel"], "kategorie": meta["kategorie"],
                "beschreibung": meta["beschreibung"], "lernziele": meta["lernziele"],
                "zielgruppe": meta["zielgruppe"], "voraussetzungen": meta["voraussetzungen"],
                "agenda": meta["agenda"],
                "materialien": {"seminarunterlagen": [], "vorlagen": []},
                "termine": [],
            }
        termin = {
            "id": s_id, "datum": schulung["datum"], "trainer": schulung["trainer"],
            "format": schulung["format"], "ort": schulung["ort"],
            "kapazitaet": schulung["kapazitaet"], "status": schulung["status"],
            "checkliste": checkliste_fuer(schulung["status"]),
        }
        kurse_by_id[k_id]["termine"].append(termin)

    for k_id, zusatz_liste in ZUSATZ_TERMINE.items():
        for zusatz in zusatz_liste:
            kurse_by_id[k_id]["termine"].append({
                **zusatz, "checkliste": checkliste_fuer(zusatz["status"]),
            })

    for kurs in kurse_by_id.values():
        kurs["termine"].sort(key=lambda t: t["datum"])

    neue_teilnehmer = []
    neue_buchungen = []
    buchung_zaehler = 1
    for t in alt["teilnehmer"]:
        neue_teilnehmer.append({
            "id": t["id"], "name": t["name"], "firma": t["firma"],
            "email": t["email"], "bestandskunde": t["bestandskunde"],
        })
        for schulung_id in t["schulungIds"]:
            termin_datum = next(
                s["datum"] for s in alt["schulungen"] if s["id"] == schulung_id
            )
            neue_buchungen.append({
                "id": f"b{buchung_zaehler}",
                "teilnehmerId": t["id"],
                "terminId": schulung_id,
                "anmeldestatus": t["anmeldestatus"],
                "gebuchtAm": gebucht_am(t["id"], schulung_id, termin_datum),
            })
            buchung_zaehler += 1

    neu = {
        "kurse": sorted(kurse_by_id.values(), key=lambda k: k["id"]),
        "teilnehmer": neue_teilnehmer,
        "buchungen": neue_buchungen,
    }
    DATA_PATH.write_text(json.dumps(neu, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Migriert: {len(neu['kurse'])} Kurse, "
          f"{sum(len(k['termine']) for k in neu['kurse'])} Termine, "
          f"{len(neue_teilnehmer)} Teilnehmer, {len(neue_buchungen)} Buchungen")


if __name__ == "__main__":
    migrieren()
