$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location "C:\Users\mikem\OneDrive\Claude\ems-dashboard"
npm install @prisma/adapter-better-sqlite3 better-sqlite3 2>&1
npm install -D @types/better-sqlite3 2>&1
