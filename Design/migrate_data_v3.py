# -*- coding: utf-8 -*-
"""Einmalige Migration v2 -> v3.

Verschiebt Format und Kapazitaet vom Termin auf den Kurs, ergaenzt Min-/
Maxteilnehmerzahl und Zertifikatsfelder, macht aus den bisherigen Trainer-
Namensfeldern echte Trainer-Datensaetze und ergaenzt die neuen Buchungs-
felder. Die v2-Daten sind hierfuer konsistent: jeder Kurs hat ueber alle
seine Termine dasselbe Format und dieselbe Kapazitaet."""
import json
from pathlib import Path

BASE = Path(__file__).parent
DATA_PATH = BASE.parent / "Daten" / "schulungsdaten.json"

# Kurs-Kuerzel fuer die Zertifikatsnummer. Bewusst handverlesen statt aus dem
# Titel abgeleitet, damit die Kuerzel lesbar und eindeutig sind.
KUERZEL = {
    "k1": "DSB", "k2": "DSGVO-FK", "k3": "HINSCHG", "k4": "ASIB",
    "k5": "GBU", "k6": "BSH", "k7": "EH", "k8": "DS-AUF",
}

UMFANG_UE = {
    "k1": 40, "k2": 8, "k3": 8, "k4": 8,
    "k5": 8, "k6": 8, "k7": 9, "k8": 4,
}

# Der Bestaetigungstext folgt der tribeta-Vorlage 09_Zertifikat_Vorlage.pdf.
# k1 ist der Zertifizierungslehrgang mit Abschlusspruefung, alle anderen
# bekommen eine neutrale Teilnahmeformulierung.
TEXT_K1 = (
    "den Zertifizierungslehrgang „{kurs}“ – Fachkunde nach Art. 37 DSGVO – "
    "im Umfang von {umfang} Unterrichtseinheiten erfolgreich absolviert und "
    "die Abschlussprüfung bestanden hat. Damit wurde die für die Rolle "
    "erforderliche Fachkunde nachgewiesen."
)
TEXT_STANDARD = (
    "an der Schulung „{kurs}“ im Umfang von {umfang} Unterrichtseinheiten "
    "am {datum} in {ort} teilgenommen hat."
)

UEBERSCHRIFT = {
    "k1": "Zertifizierungslehrgang Datenschutzbeauftragte:r",
}

MIN_TEILNEHMER_VORGABE = 5


def migriere():
    alt = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    # --- Trainer aus den bisherigen Namensfeldern aufbauen ---
    namen = []
    for kurs in alt["kurse"]:
        for termin in kurs["termine"]:
            name = termin.get("trainer", "").strip()
            if name and name not in namen:
                namen.append(name)
    namen.sort()

    trainer = []
    trainer_id_je_name = {}
    for i, name in enumerate(namen, start=1):
        tid = f"tr{i}"
        trainer_id_je_name[name] = tid
        trainer.append({
            "id": tid, "name": name, "email": "", "telefon": "",
            "qualifikation": "", "notizen": "", "dokumente": [],
        })

    # --- Kurse umbauen ---
    for kurs in alt["kurse"]:
        formate = {t["format"] for t in kurs["termine"]}
        kapazitaeten = {t["kapazitaet"] for t in kurs["termine"]}
        if len(formate) != 1 or len(kapazitaeten) != 1:
            raise SystemExit(
                f"Kurs {kurs['id']} hat uneinheitliches Format/Kapazitaet "
                f"({formate} / {kapazitaeten}) - Migration abgebrochen."
            )

        kurs["format"] = formate.pop()
        kurs["maxTeilnehmer"] = kapazitaeten.pop()
        kurs["minTeilnehmer"] = MIN_TEILNEHMER_VORGABE
        kurs.pop("zielgruppe", None)

        kurs["zertifikat"] = {
            "kuerzel": KUERZEL[kurs["id"]],
            "umfangUE": UMFANG_UE[kurs["id"]],
            "ueberschrift": UEBERSCHRIFT.get(kurs["id"], kurs["titel"]),
            "bestaetigungstext": TEXT_K1 if kurs["id"] == "k1" else TEXT_STANDARD,
            "gueltigkeit": "unbefristet",
        }

        for termin in kurs["termine"]:
            termin["trainerId"] = trainer_id_je_name.get(termin.get("trainer", "").strip())
            termin["vertretungTrainerId"] = None
            termin["abschluss"] = None
            termin.pop("trainer", None)
            termin.pop("format", None)
            termin.pop("kapazitaet", None)

    # --- Buchungen um die neuen Felder ergaenzen ---
    for buchung in alt["buchungen"]:
        buchung["anwesenheitProzent"] = None
        buchung["fehlgrund"] = None
        buchung["zertifikatNr"] = None
        buchung["statusManuell"] = False

    neu = {
        "kurse": alt["kurse"],
        "teilnehmer": alt["teilnehmer"],
        "buchungen": alt["buchungen"],
        "trainer": trainer,
        "einstellungen": {"zertifikatStartNummer": 147, "bestaetigungsfristTage": 7},
    }
    DATA_PATH.write_text(json.dumps(neu, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Migriert auf v3: {len(neu['kurse'])} Kurse, "
          f"{sum(len(k['termine']) for k in neu['kurse'])} Termine, "
          f"{len(neu['teilnehmer'])} Teilnehmer, {len(neu['buchungen'])} Buchungen, "
          f"{len(trainer)} Trainer")


if __name__ == "__main__":
    migriere()
