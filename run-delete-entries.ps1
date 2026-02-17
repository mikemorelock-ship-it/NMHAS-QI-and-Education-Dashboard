# run-delete-entries.ps1 - Delete all metricEntry rows from the database
$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location $PSScriptRoot
node --import tsx scripts/delete-metric-entries.mjs
