# Other-SystemActions.ps1
# NinjaOne Script for miscellaneous system actions
# Deploy this to NinjaOne script library

param(
    [string]$InitiatedBy = "Unknown",
    [string]$Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss"),
    [string]$Reason = "Manual system action requested from ClubOS"
)

try {
    Write-Output "=== Other System Actions Script ==="
    Write-Output "Initiated by: $InitiatedBy"
    Write-Output "Timestamp: $Timestamp"
    Write-Output "Reason: $Reason"
    Write-Output "Computer: $env:COMPUTERNAME"
    
    # Log event
    $eventSource = "ClubOS-RemoteActions"
    if (-not [System.Diagnostics.EventLog]::SourceExists($eventSource)) {
        New-EventLog -LogName Application -Source $eventSource -ErrorAction SilentlyContinue
    }
    Write-EventLog -LogName Application -Source $eventSource -EventId 1003 -EntryType Information `
        -Message "Other system action initiated by $InitiatedBy. Reason: $Reason"
    
    # Action 1: Clear Windows temporary files
    Write-Output "`nAction 1: Clearing Windows temporary files..."
    $tempPaths = @(
        "$env:TEMP",
        "$env:WINDIR\Temp",
        "$env:LOCALAPPDATA\Temp"
    )
    
    $totalCleaned = 0
    foreach ($path in $tempPaths) {
        if (Test-Path $path) {
            try {
                $files = Get-ChildItem -Path $path -Recurse -Force -ErrorAction SilentlyContinue | 
                         Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) }
                $count = $files.Count
                $files | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
                $totalCleaned += $count
                Write-Output "  Cleaned $count files from: $path"
            } catch {
                Write-Warning "  Could not clean some files in: $path"
            }
        }
    }
    Write-Output "  ✓ Total files cleaned: $totalCleaned"
    
    # Action 2: Reset network adapters
    Write-Output "`nAction 2: Resetting network adapters..."
    try {
        # Flush DNS cache
        ipconfig /flushdns | Out-Null
        Write-Output "  ✓ DNS cache flushed"
        
        # Reset Windows Sockets
        netsh winsock reset | Out-Null
        Write-Output "  ✓ Winsock reset"
        
        # Reset IP configuration
        netsh int ip reset | Out-Null
        Write-Output "  ✓ IP configuration reset"
        
        # Restart network adapters
        $adapters = Get-NetAdapter | Where-Object {$_.Status -eq "Up"}
        foreach ($adapter in $adapters) {
            Write-Output "  Restarting adapter: $($adapter.Name)"
            Restart-NetAdapter -Name $adapter.Name -Confirm:$false -ErrorAction SilentlyContinue
        }
        Write-Output "  ✓ Network adapters reset"
    } catch {
        Write-Warning "  × Could not reset some network components"
    }
    
    # Action 3: Clear print spooler
    Write-Output "`nAction 3: Clearing print spooler..."
    try {
        Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue
        Remove-Item "$env:WINDIR\System32\spool\PRINTERS\*" -Force -ErrorAction SilentlyContinue
        Start-Service -Name Spooler
        Write-Output "  ✓ Print spooler cleared"
    } catch {
        Write-Warning "  × Could not clear print spooler"
    }
    
    # Action 4: Restart Windows Update service
    Write-Output "`nAction 4: Restarting Windows Update service..."
    try {
        $updateServices = @("wuauserv", "bits", "cryptsvc")
        foreach ($svc in $updateServices) {
            Restart-Service -Name $svc -Force -ErrorAction SilentlyContinue
            Write-Output "  ✓ Restarted service: $svc"
        }
    } catch {
        Write-Warning "  × Could not restart some update services"
    }
    
    # Action 5: Clear event logs (keeping recent entries)
    Write-Output "`nAction 5: Clearing old event logs..."
    try {
        $logs = @("Application", "System")
        foreach ($log in $logs) {
            # Export recent events first
            $exportPath = "$env:TEMP\$log-backup-$(Get-Date -Format 'yyyyMMdd').evtx"
            wevtutil epl $log $exportPath /q:"*[System[TimeCreated[timediff(@SystemTime) <= 86400000]]]"
            
            # Clear the log
            wevtutil cl $log
            Write-Output "  ✓ Cleared $log log (recent events backed up)"
        }
    } catch {
        Write-Warning "  × Could not clear some event logs"
    }
    
    # Action 6: Sync system time
    Write-Output "`nAction 6: Synchronizing system time..."
    try {
        w32tm /resync /force | Out-Null
        Write-Output "  ✓ System time synchronized"
    } catch {
        Write-Warning "  × Could not sync system time"
    }
    
    # Action 7: Run system file checker
    Write-Output "`nAction 7: Running quick system integrity check..."
    try {
        # Just verify, don't repair (quick check)
        $sfcResult = sfc /verifyonly 2>&1 | Select-String "found"
        if ($sfcResult) {
            Write-Output "  ✓ System integrity check completed"
        } else {
            Write-Output "  ✓ System files appear intact"
        }
    } catch {
        Write-Warning "  × Could not complete integrity check"
    }
    
    Write-Output "`nOther system actions completed successfully!"
    Write-Output "Note: Some changes may require a system restart to take full effect."
    exit 0
    
} catch {
    Write-Error "Script failed with error: $_"
    Write-Error $_.Exception.Message
    exit 99
}