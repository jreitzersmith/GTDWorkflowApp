$conns = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($conns) {
  $conns | ForEach-Object {
    $procId = $_.OwningProcess
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    Write-Output ("PID " + $procId + " : " + $proc.ProcessName + " : " + $proc.Path)
  }
} else {
  Write-Output "No process found listening on port 5173"
}
