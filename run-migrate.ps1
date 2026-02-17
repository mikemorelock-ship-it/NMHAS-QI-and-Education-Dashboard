$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location "C:\Users\mikem\OneDrive\Claude\ems-dashboard"
$env:DATABASE_URL = "file:C:/Users/mikem/.local/ems-dashboard/dev.db"
npx prisma migrate dev --name add_portal_auth_and_dor_drafts
