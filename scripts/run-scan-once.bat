@echo off
REM Launcher for the QC Lead Scanner one-shot scan, invoked by Windows Task Scheduler.
REM cd /d sets the working directory to the project root so dedup.ts can resolve
REM data\processed-ids.json via process.cwd(). Node is called by absolute path so
REM this works regardless of the task's account (SYSTEM has a minimal PATH).
cd /d "C:\Users\garys\Documents\QC Event Design\qc estimator"
echo. >> "logs\scanner-task.log"
echo ===== Task Scheduler run: %DATE% %TIME% ===== >> "logs\scanner-task.log"
"C:\Program Files\nodejs\node.exe" "scripts\run-scan-once.js" >> "logs\scanner-task.log" 2>&1
