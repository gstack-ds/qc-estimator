<#
  Installs the "QC Lead Scanner" Windows scheduled task with FULL reboot
  durability (runs whether logged on or not, and at system boot).

  MUST be run from an ELEVATED PowerShell (Run as administrator). The S4U
  logon type — "run whether user is logged on or not" — requires admin to
  register. Without elevation, fall back to a logon-only task (see README /
  CLAUDE.md), which only runs once the user logs in.

  This replaces the old PM2 + node-cron daemon. Do not run both — PM2 must
  not also be running the scanner (pm2 delete qc-lead-scanner).

  Usage (elevated):
    powershell -ExecutionPolicy Bypass -File scripts\install-scanner-task.ps1
#>

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$bat = Join-Path $projectRoot 'scripts\run-scan-once.bat'
$watchdogBat = Join-Path $projectRoot 'scripts\run-watchdog.bat'

if (-not (Test-Path $bat)) {
  throw "Launcher not found: $bat. Run `npm run build:scan-once` first."
}
if (-not (Test-Path $watchdogBat)) {
  throw "Watchdog launcher not found: $watchdogBat. Run `npm run build:watchdog` first."
}

# Verify elevation up front with a clear message.
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  throw "Not elevated. Re-run this script from an elevated PowerShell (Run as administrator)."
}

$action = New-ScheduledTaskAction -Execute $bat
$triggers = @(
  (New-ScheduledTaskTrigger -Daily -At 7:00am),
  (New-ScheduledTaskTrigger -Daily -At 11:00am),
  (New-ScheduledTaskTrigger -Daily -At 2:00pm),
  (New-ScheduledTaskTrigger -Daily -At 4:00pm),
  (New-ScheduledTaskTrigger -AtStartup)
)
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 5)

# S4U = "run whether user is logged on or not". Survives reboot without login.
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited

Register-ScheduledTask `
  -TaskName 'QC Lead Scanner' `
  -Action $action `
  -Trigger $triggers `
  -Settings $settings `
  -Principal $principal `
  -Description 'QC Lead Scanner one-shot. Scans Gmail for INITIAL LEAD emails at 7/11/14/16 ET + at boot. Runs whether logged on or not. Replaces the PM2 node-cron daemon for reboot durability.' `
  -Force | Out-Null

Write-Host 'Registered "QC Lead Scanner" (S4U, boot + 4x daily ET).'

# ── Watchdog: separate task so it fires even if the scanner is dead ──────────
# Runs 12:00 + 17:00 ET (just after the 11:00 and 16:00 scan windows) and
# alerts if no successful scan completed within the threshold (18h).
$watchdogAction = New-ScheduledTaskAction -Execute $watchdogBat
$watchdogTriggers = @(
  (New-ScheduledTaskTrigger -Daily -At 12:00pm),
  (New-ScheduledTaskTrigger -Daily -At 5:00pm)
)
Register-ScheduledTask `
  -TaskName 'QC Lead Scanner Watchdog' `
  -Action $watchdogAction `
  -Trigger $watchdogTriggers `
  -Settings $settings `
  -Principal $principal `
  -Description 'QC Lead Scanner watchdog. Alerts via email if no successful scan has completed within 18h. Independent of the scanner task so it fires even when the scanner is dead.' `
  -Force | Out-Null

Write-Host 'Registered "QC Lead Scanner Watchdog" (S4U, 12:00 + 17:00 ET).'

Get-ScheduledTaskInfo -TaskName 'QC Lead Scanner' | Select-Object @{n='Task';e={'Scanner'}}, LastRunTime, LastTaskResult, NextRunTime
Get-ScheduledTaskInfo -TaskName 'QC Lead Scanner Watchdog' | Select-Object @{n='Task';e={'Watchdog'}}, LastRunTime, LastTaskResult, NextRunTime
