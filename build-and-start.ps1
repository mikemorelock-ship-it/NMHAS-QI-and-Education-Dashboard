$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location "C:\Users\mikem\OneDrive\Claude\ems-dashboard"
npx next build
if ($LASTEXITCODE -eq 0) {
    Write-Output "Build succeeded, starting server..."
    npx next start
} else {
    Write-Output "Build failed!"
}
