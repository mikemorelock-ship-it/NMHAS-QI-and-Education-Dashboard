$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location "C:\Users\mikem\OneDrive\Claude\ems-dashboard"
npx prisma generate
