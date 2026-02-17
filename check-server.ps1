try {
  $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 3
  Write-Host "Server is running. Status: $($r.StatusCode)"
} catch {
  Write-Host "Server not responding: $($_.Exception.Message)"
}
