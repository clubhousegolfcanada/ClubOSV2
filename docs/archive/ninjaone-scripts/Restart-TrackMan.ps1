# Restart-TrackMan.ps1
# NinjaOne Script for restarting TrackMan software
# Deploy this to NinjaOne script library

param(
    [string]$InitiatedBy = "Unknown",
    [string]$Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss"),
    [string]$Reason = "Manual restart requested from ClubOS"
)

try {
    Write-Output "=== TrackMan Restart Script ==="
    Write-Output "Initiated by: $InitiatedBy"
    Write-Output "Timestamp: $Timestamp"
    Write-Output "Reason: $Reason"
    Write-Output "Computer: $env:COMPUTERNAME"
    
    # Stop TrackMan and related processes
    $processesToStop = @(
        "TrackMan*",
        "TPS*",
        "FlightScope*",
        "TrackManGolf*",
        "TMPerformance*"
    )
    
    $stoppedProcesses = 0
    foreach ($processName in $processesToStop) {
        $processes = Get-Process -Name $processName -ErrorAction SilentlyContinue
        if ($processes) {
            Write-Output "Stopping $($processes.Count) process(es) matching: $processName"
            $processes | Stop-Process -Force
            $stoppedProcesses += $processes.Count
        }
    }
    
    if ($stoppedProcesses -gt 0) {
        Write-Output "Stopped $stoppedProcesses TrackMan process(es)"
        Write-Output "Waiting 5 seconds for processes to fully terminate..."
        Start-Sleep -Seconds 5
    } else {
        Write-Output "No TrackMan processes were running"
    }
    
    # Clear TrackMan cache and temp files
    $cachePaths = @(
        "$env:LOCALAPPDATA\TrackMan\Cache",
        "$env:LOCALAPPDATA\TrackMan\Temp",
        "$env:TEMP\TrackMan*"
    )
    
    foreach ($path in $cachePaths) {
        if (Test-Path $path) {
            try {
                Remove-Item "$path\*" -Recurse -Force -ErrorAction SilentlyContinue
                Write-Output "Cleared cache: $path"
            } catch {
                Write-Warning "Could not clear some files in: $path"
            }
        }
    }
    
    # Find TrackMan executable
    $trackmanPaths = @(
        "C:\Program Files\TrackMan\TrackMan Golf\TrackMan.exe",
        "C:\Program Files (x86)\TrackMan\TrackMan Golf\TrackMan.exe",
        "C:\Program Files\TrackMan\TrackMan.exe",
        "C:\Program Files (x86)\TrackMan\TrackMan.exe",
        "D:\TrackMan\TrackMan.exe",
        "E:\TrackMan\TrackMan.exe"
    )
    
    # Also check registry for installation path
    try {
        $regPath = Get-ItemProperty -Path "HKLM:\SOFTWARE\TrackMan" -ErrorAction SilentlyContinue
        if ($regPath.InstallPath) {
            $trackmanPaths += Join-Path $regPath.InstallPath "TrackMan.exe"
        }
    } catch {
        # Registry key not found
    }
    
    $trackmanPath = $trackmanPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if ($trackmanPath) {
        Write-Output "Starting TrackMan from: $trackmanPath"
        Start-Process $trackmanPath
        
        # Wait a moment and verify it started
        Start-Sleep -Seconds 3
        $newProcess = Get-Process -Name "TrackMan*" -ErrorAction SilentlyContinue
        if ($newProcess) {
            Write-Output "SUCCESS: TrackMan started successfully (PID: $($newProcess.Id))"
            exit 0
        } else {
            Write-Error "TrackMan process did not start as expected"
            exit 2
        }
    } else {
        Write-Error "TrackMan executable not found in any standard location"
        Write-Output "Searched paths:"
        $trackmanPaths | ForEach-Object { Write-Output "  $_" }
        exit 1
    }
    
} catch {
    Write-Error "Script failed with error: $_"
    Write-Error $_.Exception.Message
    exit 99
}
