# Discover-Clubhouse-Processes.ps1
# Run this on a simulator PC to discover what needs to be managed
# This will help us write accurate restart scripts

Write-Host "=== Clubhouse Golf Process Discovery Script ===" -ForegroundColor Cyan
Write-Host "Computer: $env:COMPUTERNAME" -ForegroundColor Yellow
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
Write-Host ""

# 1. Find all running processes (excluding Windows system processes)
Write-Host "=== RUNNING PROCESSES ===" -ForegroundColor Green
Write-Host "Looking for golf simulator related processes..."
Write-Host ""

$interestingProcesses = Get-Process | Where-Object {
    $_.ProcessName -notmatch '^(svchost|System|Registry|Idle|services|lsass|csrss|smss|winlogon|explorer|dwm|taskhostw|sihost|fontdrvhost|ctfmon|SearchIndexer|RuntimeBroker|TextInputHost|conhost|dasHost|MsMpEng|NisSrv|SecurityHealthService|WindowsTerminal|Code|chrome|firefox|edge|msedge)$' -and
    $_.MainWindowTitle -ne '' -or 
    $_.ProcessName -match '(Track|Golf|Sim|TPS|Flight|Scope|Music|Spotify|TV|Display|Kiosk|Launch|Club)'
} | Select-Object ProcessName, Id, Path, MainWindowTitle, Company, Product | Sort-Object ProcessName

if ($interestingProcesses) {
    $interestingProcesses | Format-Table -AutoSize
} else {
    Write-Host "No golf-related processes found running" -ForegroundColor Yellow
}

# 2. Check common TrackMan locations
Write-Host ""
Write-Host "=== TRACKMAN INSTALLATION CHECK ===" -ForegroundColor Green

$trackmanLocations = @(
    "C:\Program Files\TrackMan",
    "C:\Program Files (x86)\TrackMan",
    "C:\TrackMan",
    "D:\TrackMan",
    "C:\Program Files\TrackMan Golf",
    "C:\Program Files (x86)\TrackMan Golf",
    "C:\Program Files\TPS",
    "C:\Program Files (x86)\TPS"
)

foreach ($location in $trackmanLocations) {
    if (Test-Path $location) {
        Write-Host "Found TrackMan directory: $location" -ForegroundColor Cyan
        Get-ChildItem "$location\*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "  - Executable: $($_.Name) (Size: $([math]::Round($_.Length/1MB, 2)) MB)" -ForegroundColor Gray
        }
    }
}

# 3. Check registry for installed software
Write-Host ""
Write-Host "=== INSTALLED SOFTWARE (Golf/Simulator Related) ===" -ForegroundColor Green

$registryPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
)

$installedSoftware = $registryPaths | ForEach-Object {
    Get-ItemProperty $_ -ErrorAction SilentlyContinue
} | Where-Object {
    $_.DisplayName -match '(TrackMan|Golf|Simulator|TPS|Flight|Scope|Launch|Club|Kiosk)' -or
    $_.Publisher -match '(TrackMan|FlightScope|Foresight)'
} | Select-Object DisplayName, Publisher, InstallLocation, DisplayVersion | Sort-Object DisplayName -Unique

if ($installedSoftware) {
    $installedSoftware | Format-Table -AutoSize
} else {
    Write-Host "No golf simulator software found in registry" -ForegroundColor Yellow
}

# 4. Check Windows Services
Write-Host ""
Write-Host "=== WINDOWS SERVICES (Non-Microsoft) ===" -ForegroundColor Green

$services = Get-Service | Where-Object {
    $_.Name -notmatch '^(W|Microsoft|Windows|Xbox|Hyper-V)' -and
    $_.DisplayName -notmatch '(Microsoft|Windows|Xbox|Hyper-V|Intel|AMD|NVIDIA)' -and
    $_.Status -eq 'Running'
} | Select-Object Name, DisplayName, Status, StartType

if ($services) {
    $services | Format-Table -AutoSize
} else {
    Write-Host "No third-party services found running" -ForegroundColor Yellow
}

# 5. Check Startup Programs
Write-Host ""
Write-Host "=== STARTUP PROGRAMS ===" -ForegroundColor Green

# Check Run registry keys
$startupPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"
)

Write-Host "Programs that start automatically:"
foreach ($path in $startupPaths) {
    if (Test-Path $path) {
        $items = Get-ItemProperty $path -ErrorAction SilentlyContinue
        $items.PSObject.Properties | Where-Object { 
            $_.Name -notmatch '^PS' -and 
            $_.Value -notmatch '(Microsoft|Windows|OneDrive|Defender)'
        } | ForEach-Object {
            Write-Host "  - $($_.Name): $($_.Value)" -ForegroundColor Gray
        }
    }
}

# Check Startup folder
$startupFolder = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Startup"
if (Test-Path $startupFolder) {
    $startupItems = Get-ChildItem $startupFolder -ErrorAction SilentlyContinue
    if ($startupItems) {
        Write-Host ""
        Write-Host "Startup folder items:"
        $startupItems | ForEach-Object {
            Write-Host "  - $($_.Name)" -ForegroundColor Gray
        }
    }
}

# 6. Check for web-based applications
Write-Host ""
Write-Host "=== BROWSER-BASED APPLICATIONS ===" -ForegroundColor Green

# Check if any browsers are running in kiosk or app mode
$browserProcesses = Get-Process | Where-Object {
    $_.ProcessName -match '(chrome|firefox|msedge|edge|iexplore)' -and
    $_.MainWindowTitle -ne ''
}

if ($browserProcesses) {
    Write-Host "Active browser windows:"
    $browserProcesses | ForEach-Object {
        Write-Host "  - $($_.ProcessName): $($_.MainWindowTitle)" -ForegroundColor Gray
        
        # Try to get command line to see if running in kiosk mode
        try {
            $commandLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
            if ($commandLine -match '(--kiosk|--app=|--fullscreen)') {
                Write-Host "    Running in kiosk/app mode!" -ForegroundColor Yellow
                Write-Host "    Command: $commandLine" -ForegroundColor DarkGray
            }
        } catch {
            # Couldn't get command line
        }
    }
}

# 7. Check scheduled tasks
Write-Host ""
Write-Host "=== SCHEDULED TASKS (Custom) ===" -ForegroundColor Green

$tasks = Get-ScheduledTask | Where-Object {
    $_.TaskPath -notmatch '\\Microsoft\\' -and
    $_.State -eq 'Ready' -and
    $_.TaskName -notmatch '(OneDrive|Adobe|Google|User_Feed)'
} | Select-Object TaskName, TaskPath, State

if ($tasks) {
    $tasks | Format-Table -AutoSize
} else {
    Write-Host "No custom scheduled tasks found" -ForegroundColor Yellow
}

# 8. Network ports check (for remote services)
Write-Host ""
Write-Host "=== LISTENING NETWORK PORTS ===" -ForegroundColor Green
Write-Host "Services accepting network connections:"

$listeningPorts = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | 
    Where-Object { $_.LocalPort -lt 50000 } |
    Sort-Object LocalPort |
    Select-Object -First 20 LocalPort, OwningProcess

if ($listeningPorts) {
    foreach ($port in $listeningPorts) {
        try {
            $process = Get-Process -Id $port.OwningProcess -ErrorAction SilentlyContinue
            if ($process -and $process.ProcessName -notmatch '(svchost|System|lsass|services)') {
                Write-Host "  - Port $($port.LocalPort): $($process.ProcessName)" -ForegroundColor Gray
            }
        } catch {
            # Skip if can't get process info
        }
    }
}

# 9. Export results
Write-Host ""
Write-Host "=== SAVING RESULTS ===" -ForegroundColor Green

$outputFile = "$env:USERPROFILE\Desktop\Clubhouse_Process_Discovery_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

# Redirect all the above output to a file as well
Start-Transcript -Path $outputFile -Force | Out-Null

# Re-run key discoveries for the transcript
Write-Host "=== SUMMARY FOR CLUBOS INTEGRATION ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Key Processes to Manage:"
$interestingProcesses | Where-Object { $_.ProcessName } | ForEach-Object {
    Write-Host "  - $($_.ProcessName) [$($_.Path)]"
}

Write-Host ""
Write-Host "Key Directories Found:"
$trackmanLocations | Where-Object { Test-Path $_ } | ForEach-Object {
    Write-Host "  - $_"
}

Write-Host ""
Write-Host "Key Software Installed:"
$installedSoftware | ForEach-Object {
    Write-Host "  - $($_.DisplayName) by $($_.Publisher)"
}

Stop-Transcript | Out-Null

Write-Host ""
Write-Host "Results saved to: $outputFile" -ForegroundColor Green
Write-Host "Please share this file to help create accurate restart scripts!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")