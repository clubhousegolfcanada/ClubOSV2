# Restart-MusicSystem.ps1
# NinjaOne Script for restarting music/audio systems
# Deploy this to NinjaOne script library

param(
    [string]$InitiatedBy = "Unknown",
    [string]$Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss"),
    [string]$Reason = "Manual restart requested from ClubOS"
)

try {
    Write-Output "=== Music System Restart Script ==="
    Write-Output "Initiated by: $InitiatedBy"
    Write-Output "Timestamp: $Timestamp"
    Write-Output "Reason: $Reason"
    Write-Output "Computer: $env:COMPUTERNAME"
    
    # Step 1: Restart Windows Audio Services
    Write-Output "`nStep 1: Restarting Windows Audio Services..."
    $audioServices = @(
        @{Name="AudioSrv"; DisplayName="Windows Audio"},
        @{Name="AudioEndpointBuilder"; DisplayName="Windows Audio Endpoint Builder"},
        @{Name="Audiosrv"; DisplayName="Windows Audio (Alternative)"}
    )
    
    foreach ($svc in $audioServices) {
        $service = Get-Service -Name $svc.Name -ErrorAction SilentlyContinue
        if ($service) {
            Write-Output "Restarting service: $($svc.DisplayName)"
            try {
                Restart-Service -Name $svc.Name -Force -ErrorAction Stop
                Write-Output "  ✓ Successfully restarted"
            } catch {
                Write-Warning "  × Could not restart $($svc.DisplayName): $_"
            }
        }
    }
    
    # Step 2: Reset Audio Devices
    Write-Output "`nStep 2: Resetting audio devices..."
    try {
        # Disable and re-enable audio devices
        $audioDevices = Get-PnpDevice -Class "AudioEndpoint" -Status OK
        foreach ($device in $audioDevices) {
            Write-Output "Resetting device: $($device.FriendlyName)"
            $device | Disable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 500
            $device | Enable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue
        }
        Write-Output "  ✓ Audio devices reset"
    } catch {
        Write-Warning "  × Could not reset audio devices: $_"
    }
    
    # Step 3: Restart Music Applications
    Write-Output "`nStep 3: Restarting music applications..."
    
    # Spotify
    $spotifyProcesses = Get-Process -Name "Spotify*" -ErrorAction SilentlyContinue
    if ($spotifyProcesses) {
        Write-Output "Stopping Spotify..."
        $spotifyProcesses | Stop-Process -Force
        Start-Sleep -Seconds 2
        
        # Try to restart Spotify
        $spotifyPath = "$env:APPDATA\Spotify\Spotify.exe"
        if (Test-Path $spotifyPath) {
            Write-Output "Starting Spotify..."
            Start-Process $spotifyPath -ArgumentList "--minimized"
        } else {
            # Try protocol handler
            Start-Process "spotify://"
        }
        Write-Output "  ✓ Spotify restarted"
    }
    
    # iTunes/Apple Music
    $itunesProcesses = Get-Process -Name "iTunes", "AppleMusic" -ErrorAction SilentlyContinue
    if ($itunesProcesses) {
        Write-Output "Stopping iTunes/Apple Music..."
        $itunesProcesses | Stop-Process -Force
        Start-Sleep -Seconds 2
        
        $itunesPath = "${env:ProgramFiles}\iTunes\iTunes.exe"
        if (Test-Path $itunesPath) {
            Write-Output "Starting iTunes..."
            Start-Process $itunesPath
            Write-Output "  ✓ iTunes restarted"
        }
    }
    
    # Custom Clubhouse Music Service
    $clubhouseService = Get-Service -Name "ClubhouseMusicService" -ErrorAction SilentlyContinue
    if ($clubhouseService) {
        Write-Output "Restarting Clubhouse Music Service..."
        Restart-Service -Name "ClubhouseMusicService" -Force
        Write-Output "  ✓ Clubhouse Music Service restarted"
    }
    
    # Step 4: Reset Audio Mixer Settings
    Write-Output "`nStep 4: Resetting audio mixer..."
    try {
        # Reset Windows audio mixer to defaults
        Stop-Process -Name "SndVol" -ErrorAction SilentlyContinue
        Remove-Item "$env:LOCALAPPDATA\Microsoft\Windows\SndVol.exe\*" -Force -ErrorAction SilentlyContinue
        Write-Output "  ✓ Audio mixer reset"
    } catch {
        Write-Warning "  × Could not reset audio mixer"
    }
    
    # Step 5: Test Audio
    Write-Output "`nStep 5: Testing audio output..."
    try {
        # Play a test sound
        [System.Media.SystemSounds]::Beep.Play()
        Write-Output "  ✓ Audio test completed"
    } catch {
        Write-Warning "  × Audio test failed"
    }
    
    Write-Output "`nMusic system restart completed successfully!"
    exit 0
    
} catch {
    Write-Error "Script failed with error: $_"
    Write-Error $_.Exception.Message
    exit 99
}
