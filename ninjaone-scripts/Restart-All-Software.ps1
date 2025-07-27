# Restart-All-Software.ps1
# Restart both TrackMan and Browser

param(
    [string]$InitiatedBy = "ClubOS"
)

Write-Output "=== Full Software Restart ==="
Write-Output "Initiated by: $InitiatedBy"
Write-Output "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

try {
    # Step 1: Stop all software
    Write-Output "`nStep 1: Stopping all software..."
    
    # Stop TrackMan
    $trackmanProcesses = @("TrackMan", "TPS", "TrackManGolf", "TMPerformance")
    foreach ($processName in $trackmanProcesses) {
        Get-Process -Name "$processName*" -ErrorAction SilentlyContinue | Stop-Process -Force
    }
    
    # Stop browsers
    $browsers = @("chrome", "msedge", "firefox", "iexplore")
    foreach ($browser in $browsers) {
        Get-Process -Name $browser -ErrorAction SilentlyContinue | Stop-Process -Force
    }
    
    Write-Output "All software stopped. Waiting 3 seconds..."
    Start-Sleep -Seconds 3
    
    # Step 2: Start TrackMan
    Write-Output "`nStep 2: Starting TrackMan..."
    $trackmanPaths = @(
        "C:\Program Files\TrackMan\TrackMan.exe",
        "C:\Program Files\TrackMan\TrackMan Golf\TrackMan.exe",
        "C:\Program Files (x86)\TrackMan\TrackMan.exe",
        "D:\TrackMan\TrackMan.exe"
    )
    
    $trackmanStarted = $false
    foreach ($path in $trackmanPaths) {
        if (Test-Path $path) {
            Start-Process $path
            Write-Output "TrackMan started from: $path"
            $trackmanStarted = $true
            break
        }
    }
    
    # Step 3: Start browser with tournament display
    Write-Output "`nStep 3: Starting tournament display..."
    Start-Sleep -Seconds 2  # Give TrackMan time to initialize
    
    $chromePath = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
    if (Test-Path $chromePath) {
        Start-Process $chromePath -ArgumentList "--kiosk", "--fullscreen", "https://tournament.clubhouse247golf.com"
        Write-Output "Chrome started in kiosk mode"
    }
    
    if ($trackmanStarted) {
        Write-Output "`nSUCCESS: All software restarted"
        exit 0
    } else {
        Write-Error "TrackMan could not be started"
        exit 1
    }
    
} catch {
    Write-Error "Error: $_"
    exit 99
}
