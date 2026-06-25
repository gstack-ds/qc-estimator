@echo off
REM Launcher for the QC Lead Scanner WATCHDOG, invoked by Windows Task Scheduler.
REM Separate task from the scanner so it fires even if the scanner is dead.
REM cd /d sets the working directory to the project root so the heartbeat file
REM (data\last-scan.json) resolves via process.cwd().
cd /d "C:\Users\garys\Documents\QC Event Design\qc estimator"
echo. >> "logs\watchdog.log"
echo ===== Watchdog run: %DATE% %TIME% ===== >> "logs\watchdog.log"
"C:\Program Files\nodejs\node.exe" "scripts\run-watchdog.js" %* >> "logs\watchdog.log" 2>&1
