@echo off
REM Erzeugt aus den abgelegten HTML-Dokumenten PDFs - per Doppelklick.
REM Vorhandene PDFs bleiben unangetastet; "PDFs-erzeugen.cmd alle" erneuert sie.
cd /d "%~dp0"
python "Design\pdf_erzeugen.py" %*
echo.
pause
