# Restart-Browser-Simple.ps1
# Restart browser with tournament display

param(
    [string]$InitiatedBy = "ClubOS",
    [string]$TournamentURL = "https://tournament.clubhouse247golf.com"
)

Write-Output "=== Browser Restart for Tournament Display ==="
Write-Output "Initiated by: $InitiatedBy"
Write-Output "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

try {
    # Stop all browser processes
    $browsers = @("chrome", "msedge", "firefox", "iexplore")
    $stopped = $false
    
    foreach ($browser in $browsers) {
        $processes = Get-Process -Name $browser -ErrorAction SilentlyContinue
        if ($processes) {
            Write-Output "Stopping $browser..."
            $processes | Stop-Process -Force
            $stopped = $true
        }
    }
    
    if ($stopped) {
        Write-Output "Waiting for browsers to close..."
        Start-Sleep -Seconds 2
    }
    
    # Start Chrome in kiosk mode (preferred)
    $chromePath = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
    $edgePath = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    
    if (Test-Path $chromePath) {
        Write-Output "Starting Chrome in kiosk mode..."
        Start-Process $chromePath -ArgumentList "--kiosk", "--fullscreen", "--disable-session-crashed-bubble", "--disable-infobars", "--autoplay-policy=no-user-gesture-required", $TournamentURL
        Write-Output "SUCCESS: Chrome started with tournament display"
        exit 0
    } elseif (Test-Path $edgePath) {
        Write-Output "Starting Edge in kiosk mode..."
        Start-Process $edgePath -ArgumentList "--kiosk", "--fullscreen", $TournamentURL
        Write-Output "SUCCESS: Edge started with tournament display"
        exit 0
    } else {
        Write-Error "No supported browser found"
        exit 1
    }
    
} catch {
    Write-Error "Error: $_"
    exit 99
}
