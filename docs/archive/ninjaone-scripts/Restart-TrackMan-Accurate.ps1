# Restart-TrackMan-Accurate.ps1
# Based on actual TrackMan Performance Studio processes from Dartmouth Box 4
# Deploy this to NinjaOne script library

param(
    [string]$InitiatedBy = "ClubOS",
    [string]$Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss"),
    [string]$Reason = "Manual restart requested from ClubOS"
)

try {
    Write-Output "=== TrackMan Performance Studio Restart Script ==="
    Write-Output "Initiated by: $InitiatedBy"
    Write-Output "Timestamp: $Timestamp"
    Write-Output "Reason: $Reason"
    Write-Output "Computer: $env:COMPUTERNAME"
    Write-Output ""
    
    # 1. Stop all TrackMan processes
    Write-Output "Stopping TrackMan processes..."
    
    # Main TrackMan processes to stop (in order)
    $mainProcesses = @(
        "TrackMan.Gui.Shell",      # Main UI
        "TrackMan.IO.Service",      # IO Service
        "TrackMan.VmsProcess",      # Video Management
        "PoSe",                     # Pose tracking
        "event_tracker",            # Event tracking
        "event_fusion"              # Event fusion
    )
    
    $stoppedCount = 0
    foreach ($processName in $mainProcesses) {
        $processes = Get-Process -Name $processName -ErrorAction SilentlyContinue
        if ($processes) {
            Write-Output "  Stopping $($processes.Count) $processName process(es)..."
            $processes | Stop-Process -Force -ErrorAction SilentlyContinue
            $stoppedCount += $processes.Count
            Start-Sleep -Milliseconds 500
        }
    }
    
    # Stop ALL ComponentManager processes (there are many!)
    Write-Output "  Stopping ComponentManager processes..."
    $componentManagers = Get-Process -Name "ComponentManager" -ErrorAction SilentlyContinue
    if ($componentManagers) {
        Write-Output "  Found $($componentManagers.Count) ComponentManager processes"
        $componentManagers | Stop-Process -Force -ErrorAction SilentlyContinue
        $stoppedCount += $componentManagers.Count
    }
    
    Write-Output "Stopped $stoppedCount total processes"
    
    # 2. Wait for processes to fully terminate
    Write-Output "Waiting for processes to terminate..."
    Start-Sleep -Seconds 3
    
    # 3. Clear any stuck processes
    $remainingProcesses = Get-Process | Where-Object { 
        $_.ProcessName -match "TrackMan|ComponentManager|PoSe|event_" 
    }
    if ($remainingProcesses) {
        Write-Output "Force stopping $($remainingProcesses.Count) remaining processes..."
        $remainingProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    # 4. Clear TrackMan cache (optional but recommended)
    Write-Output "Clearing TrackMan cache..."
    $cachePaths = @(
        "$env:LOCALAPPDATA\TrackMan\Cache",
        "$env:LOCALAPPDATA\TrackMan\Temp",
        "$env:TEMP\TrackMan*",
        "C:\ProgramData\TrackMan\TrackMan Performance Studio\Cache",
        "C:\ProgramData\TrackMan\TrackMan Performance Studio\Temp"
    )
    
    foreach ($path in $cachePaths) {
        if (Test-Path $path) {
            try {
                Remove-Item "$path\*" -Recurse -Force -ErrorAction SilentlyContinue
                Write-Output "  Cleared: $path"
            } catch {
                Write-Warning "  Could not clear some files in: $path"
            }
        }
    }
    
    # 5. Start TrackMan (main executable)
    Write-Output ""
    Write-Output "Starting TrackMan Performance Studio..."
    
    # Primary path based on your system
    $trackmanPath = "C:\ProgramData\TrackMan\TrackMan Performance Studio\Updates\tps\10.1.250\Modules\TrackMan.Gui.Shell.exe"
    
    # Fallback paths if version changes
    if (-not (Test-Path $trackmanPath)) {
        $possiblePaths = @(
            "C:\ProgramData\TrackMan\TrackMan Performance Studio\Updates\tps\*\Modules\TrackMan.Gui.Shell.exe",
            "C:\ProgramData\TrackMan\TrackMan Performance Studio\TrackMan.Gui.Shell.exe",
            "C:\Program Files\TrackMan\TrackMan Performance Studio\TrackMan.Gui.Shell.exe",
            "C:\Program Files (x86)\TrackMan\TrackMan Performance Studio\TrackMan.Gui.Shell.exe"
        )
        
        foreach ($path in $possiblePaths) {
            $found = Get-ChildItem -Path $path -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                $trackmanPath = $found.FullName
                break
            }
        }
    }
    
    if (Test-Path $trackmanPath) {
        Write-Output "Starting TrackMan from: $trackmanPath"
        Start-Process $trackmanPath
        
        # Wait for TrackMan to start
        Write-Output "Waiting for TrackMan to initialize..."
        Start-Sleep -Seconds 5
        
        # Verify it started
        $trackmanProcess = Get-Process -Name "TrackMan.Gui.Shell" -ErrorAction SilentlyContinue
        if ($trackmanProcess) {
            Write-Output "SUCCESS: TrackMan Performance Studio started (PID: $($trackmanProcess.Id))"
            
            # Wait for other components to start
            Write-Output "Waiting for components to initialize..."
            Start-Sleep -Seconds 10
            
            # Check if ComponentManager processes started
            $componentCount = (Get-Process -Name "ComponentManager" -ErrorAction SilentlyContinue).Count
            if ($componentCount -gt 0) {
                Write-Output "SUCCESS: $componentCount ComponentManager processes running"
            }
            
            # Check if IO Service started
            $ioService = Get-Process -Name "TrackMan.IO.Service" -ErrorAction SilentlyContinue
            if ($ioService) {
                Write-Output "SUCCESS: TrackMan IO Service running"
            }
            
            Write-Output ""
            Write-Output "=== TrackMan restart completed successfully ==="
            exit 0
        } else {
            Write-Warning "TrackMan GUI process not detected after startup"
            Write-Output "Manual intervention may be required"
            exit 2
        }
    } else {
        Write-Error "TrackMan executable not found!"
        Write-Output "Expected location: $trackmanPath"
        Write-Output "Please verify TrackMan Performance Studio installation"
        exit 1
    }
    
} catch {
    Write-Error "Script failed with error: $_"
    Write-Error $_.Exception.Message
    exit 99
}