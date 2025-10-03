# Restart-TrackMan-Simple.ps1
# Simplified script to restart TrackMan software only

param(
    [string]$InitiatedBy = "ClubOS",
    [string]$Action = "restart-trackman"
)

Write-Output "=== TrackMan Software Restart ==="
Write-Output "Initiated by: $InitiatedBy"
Write-Output "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

try {
    # Find and stop TrackMan processes
    $trackmanProcesses = @("TrackMan", "TPS", "TrackManGolf", "TMPerformance")
    $stopped = $false
    
    foreach ($processName in $trackmanProcesses) {
        $processes = Get-Process -Name "$processName*" -ErrorAction SilentlyContinue
        if ($processes) {
            Write-Output "Stopping $($processes.Count) $processName process(es)..."
            $processes | Stop-Process -Force
            $stopped = $true
        }
    }
    
    if (-not $stopped) {
        Write-Output "No TrackMan processes were running"
    } else {
        Write-Output "Waiting for processes to terminate..."
        Start-Sleep -Seconds 3
    }
    
    # Start TrackMan - check multiple possible locations
    $trackmanPaths = @(
        "C:\Program Files\TrackMan\TrackMan.exe",
        "C:\Program Files\TrackMan\TrackMan Golf\TrackMan.exe",
        "C:\Program Files (x86)\TrackMan\TrackMan.exe",
        "D:\TrackMan\TrackMan.exe"
    )
    
    $started = $false
    foreach ($path in $trackmanPaths) {
        if (Test-Path $path) {
            Write-Output "Starting TrackMan from: $path"
            Start-Process $path
            $started = $true
            break
        }
    }
    
    if ($started) {
        Write-Output "SUCCESS: TrackMan restarted"
        exit 0
    } else {
        Write-Error "TrackMan executable not found"
        exit 1
    }
    
} catch {
    Write-Error "Error: $_"
    exit 99
}
