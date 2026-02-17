$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location "C:\Users\mikem\OneDrive\Claude\ems-dashboard"
$env:DATABASE_URL = "file:C:/Users/mikem/.local/ems-dashboard/dev.db"

Write-Output "Running seed..."
node --import tsx prisma/seed.mjs

if ($LASTEXITCODE -eq 0) {
    Write-Output ""
    Write-Output "Seed complete. Starting server..."
    npx next start
} else {
    Write-Output "Seed failed with exit code $LASTEXITCODE"
}
