# Reboot-SimulatorPC.ps1
# NinjaOne Script for rebooting simulator PCs
# Deploy this to NinjaOne script library

param(
    [string]$InitiatedBy = "Unknown",
    [string]$Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss"),
    [string]$Reason = "Manual reboot requested from ClubOS",
    [int]$WarningSeconds = 30
)

Write-Output "=== Simulator PC Reboot Script ==="
Write-Output "Initiated by: $InitiatedBy"
Write-Output "Timestamp: $Timestamp"
Write-Output "Reason: $Reason"
Write-Output "Computer: $env:COMPUTERNAME"
Write-Output "Warning time: $WarningSeconds seconds"

try {
    # Log reboot event to Windows Event Log
    $eventSource = "ClubOS-RemoteActions"
    if (-not [System.Diagnostics.EventLog]::SourceExists($eventSource)) {
        New-EventLog -LogName Application -Source $eventSource -ErrorAction SilentlyContinue
    }
    Write-EventLog -LogName Application -Source $eventSource -EventId 1000 -EntryType Information `
        -Message "PC Reboot initiated by $InitiatedBy. Reason: $Reason"
    
    # Save any TrackMan data
    $trackmanProcesses = Get-Process -Name "TrackMan*" -ErrorAction SilentlyContinue
    if ($trackmanProcesses) {
        Write-Output "TrackMan is running - attempting graceful shutdown"
        $trackmanProcesses | ForEach-Object {
            $_.CloseMainWindow() | Out-Null
        }
        Start-Sleep -Seconds 5
    }
    
    # Create notification for logged-in users
    $message = @"
SYSTEM MAINTENANCE REQUIRED

This simulator PC will restart in $WarningSeconds seconds.

Please save any work and exit TrackMan if running.

Initiated by: $InitiatedBy
Reason: $Reason
"@
    
    # Send message to all sessions
    Write-Output "Notifying users of pending reboot..."
    msg * /TIME:$WarningSeconds $message
    
    # Also create a popup notification
    $wshell = New-Object -ComObject Wscript.Shell
    $wshell.Popup($message, $WarningSeconds, "System Restart Warning", 48) | Out-Null
    
    # Wait for warning period
    Write-Output "Waiting $WarningSeconds seconds before restart..."
    for ($i = $WarningSeconds; $i -gt 0; $i--) {
        Write-Progress -Activity "Reboot Countdown" -Status "$i seconds remaining" -PercentComplete ((($WarningSeconds - $i) / $WarningSeconds) * 100)
        Start-Sleep -Seconds 1
    }
    
    Write-Output "Initiating system restart..."
    
    # Perform the restart
    Restart-Computer -Force -Confirm:$false
    
    # This line should not execute if restart is successful
    Write-Error "Restart command was issued but system did not restart"
    exit 1
    
} catch {
    Write-Error "Script failed with error: $_"
    Write-Error $_.Exception.Message
    
    # Try alternative restart method
    Write-Output "Attempting alternative restart method..."
    shutdown /r /f /t 0
    
    exit 99
}
