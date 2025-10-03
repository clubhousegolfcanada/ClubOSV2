# Restart-TVSystem.ps1
# NinjaOne Script for restarting TV/display systems
# Deploy this to NinjaOne script library

param(
    [string]$InitiatedBy = "Unknown",
    [string]$Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss"),
    [string]$Reason = "Manual restart requested from ClubOS"
)

try {
    Write-Output "=== TV/Display System Restart Script ==="
    Write-Output "Initiated by: $InitiatedBy"
    Write-Output "Timestamp: $Timestamp"
    Write-Output "Reason: $Reason"
    Write-Output "Computer: $env:COMPUTERNAME"
    
    # Step 1: Reset Display Adapters
    Write-Output "`nStep 1: Resetting display adapters..."
    $displayAdapters = Get-PnpDevice -Class Display -Status OK
    foreach ($adapter in $displayAdapters) {
        Write-Output "Resetting: $($adapter.FriendlyName)"
        try {
            $adapter | Disable-PnpDevice -Confirm:$false -ErrorAction Stop
            Start-Sleep -Seconds 1
            $adapter | Enable-PnpDevice -Confirm:$false -ErrorAction Stop
            Write-Output "  ✓ Reset complete"
        } catch {
            Write-Warning "  × Could not reset $($adapter.FriendlyName)"
        }
    }
    
    # Step 2: Restart Display Driver
    Write-Output "`nStep 2: Restarting display driver service..."
    try {
        # This forces Windows to restart the display driver
        Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DisplayHelper {
    [DllImport("user32.dll")]
    public static extern int ChangeDisplaySettings(IntPtr lpDevMode, int dwFlags);
    public const int CDS_RESET = 0x40000000;
}
"@
        [DisplayHelper]::ChangeDisplaySettings([IntPtr]::Zero, [DisplayHelper]::CDS_RESET)
        Write-Output "  ✓ Display driver reset"
    } catch {
        Write-Warning "  × Could not reset display driver"
    }
    
    # Step 3: Stop Streaming/Browser Applications
    Write-Output "`nStep 3: Stopping browser and streaming applications..."
    $appsToRestart = @(
        @{Name="chrome"; DisplayName="Google Chrome"; Path="${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"},
        @{Name="msedge"; DisplayName="Microsoft Edge"; Path="${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"},
        @{Name="firefox"; DisplayName="Firefox"; Path="${env:ProgramFiles}\Mozilla Firefox\firefox.exe"},
        @{Name="iexplore"; DisplayName="Internet Explorer"; Path="${env:ProgramFiles}\Internet Explorer\iexplore.exe"}
    )
    
    $restartedApps = @()
    foreach ($app in $appsToRestart) {
        $processes = Get-Process -Name $app.Name -ErrorAction SilentlyContinue
        if ($processes) {
            Write-Output "Stopping $($app.DisplayName)..."
            
            # Save URLs if possible (Chrome/Edge)
            $savedUrls = @()
            if ($app.Name -in @("chrome", "msedge")) {
                try {
                    $processes | ForEach-Object {
                        $_.MainWindowTitle | Where-Object { $_ -ne "" } | ForEach-Object {
                            $savedUrls += $_
                        }
                    }
                } catch {}
            }
            
            $processes | Stop-Process -Force
            $restartedApps += $app
            Start-Sleep -Seconds 1
        }
    }
    
    # Step 4: Clear Browser Cache/Temp Files
    Write-Output "`nStep 4: Clearing browser cache..."
    $cachePaths = @(
        "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache",
        "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache",
        "$env:APPDATA\Mozilla\Firefox\Profiles\*\cache2"
    )
    
    foreach ($path in $cachePaths) {
        if (Test-Path $path) {
            try {
                Remove-Item "$path\*" -Recurse -Force -ErrorAction SilentlyContinue
                Write-Output "  ✓ Cleared cache: $path"
            } catch {
                Write-Warning "  × Could not clear: $path"
            }
        }
    }
    
    # Step 5: Restart Tournament Display
    Write-Output "`nStep 5: Starting tournament display..."
    
    # Check for custom tournament display configuration
    $configPath = "C:\Clubhouse\TVConfig.json"
    $defaultUrl = "https://tournament.clubhouse247golf.com"
    $kioskMode = $true
    
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath | ConvertFrom-Json
            if ($config.url) { $defaultUrl = $config.url }
            if ($config.kioskMode -eq $false) { $kioskMode = $false }
        } catch {
            Write-Warning "Could not read TV configuration"
        }
    }
    
    # Find preferred browser
    $browserPath = $null
    foreach ($app in $appsToRestart) {
        if (Test-Path $app.Path) {
            $browserPath = $app.Path
            $browserName = $app.DisplayName
            break
        }
    }
    
    if ($browserPath) {
        Write-Output "Starting $browserName in kiosk mode..."
        if ($kioskMode) {
            # Start in kiosk/fullscreen mode
            if ($browserPath -like "*chrome.exe") {
                Start-Process $browserPath -ArgumentList "--kiosk", "--fullscreen", "--disable-session-crashed-bubble", "--disable-infobars", $defaultUrl
            } elseif ($browserPath -like "*msedge.exe") {
                Start-Process $browserPath -ArgumentList "--kiosk", "--fullscreen", "--disable-features=TranslateUI", $defaultUrl
            } else {
                Start-Process $browserPath -ArgumentList $defaultUrl
            }
        } else {
            Start-Process $browserPath -ArgumentList $defaultUrl
        }
        Write-Output "  ✓ Browser started with tournament display"
    } else {
        Write-Warning "  × No supported browser found"
    }
    
    # Step 6: Reset Display Settings
    Write-Output "`nStep 6: Resetting display settings..."
    try {
        # Set display to extend mode (not duplicate)
        displayswitch.exe /extend
        Start-Sleep -Seconds 2
        Write-Output "  ✓ Display mode set to extended"
    } catch {
        Write-Warning "  × Could not reset display mode"
    }
    
    # Step 7: Restart any custom TV services
    $tvServices = @("ClubhouseTVService", "TournamentDisplayService")
    foreach ($serviceName in $tvServices) {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service) {
            Write-Output "Restarting $serviceName..."
            try {
                Restart-Service -Name $serviceName -Force
                Write-Output "  ✓ Service restarted"
            } catch {
                Write-Warning "  × Could not restart service"
            }
        }
    }
    
    Write-Output "`nTV system restart completed successfully!"
    
    # Create success notification
    $wshell = New-Object -ComObject Wscript.Shell
    $wshell.Popup("TV system has been restarted successfully", 5, "ClubOS Remote Action", 64) | Out-Null
    
    exit 0
    
} catch {
    Write-Error "Script failed with error: $_"
    Write-Error $_.Exception.Message
    exit 99
}
