Get-ChildItem 'C:\Users\mikem\OneDrive\Claude\ems-dashboard\src' -Recurse -File |
  Where-Object { $_.DirectoryName -notmatch 'generated' } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 25 |
  ForEach-Object {
    $rel = $_.FullName.Replace('C:\Users\mikem\OneDrive\Claude\ems-dashboard\src\', '')
    $time = $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm')
    "$time  $rel"
  }
