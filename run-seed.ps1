$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location "C:\Users\mikem\OneDrive\Claude\ems-dashboard"
$env:DATABASE_URL = "file:C:/Users/mikem/.local/ems-dashboard/dev.db"
node --import tsx prisma/seed.mjs 2>&1
