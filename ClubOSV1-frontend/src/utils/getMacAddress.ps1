# PowerShell script to get MAC address and device name for Splashtop setup
# Run this on each bay computer to get the required information

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Splashtop Bay Configuration Helper" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Get device name
$deviceName = $env:COMPUTERNAME
Write-Host "Device Name: " -NoNewline -ForegroundColor Yellow
Write-Host $deviceName -ForegroundColor Green

# Get primary network adapter MAC address
$primaryAdapter = Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object -First 1
if ($primaryAdapter) {
    $macAddress = $primaryAdapter.MacAddress
    Write-Host "MAC Address: " -NoNewline -ForegroundColor Yellow
    Write-Host $macAddress -ForegroundColor Green
    
    # Format for environment variable (remove dashes)
    $macFormatted = $macAddress -replace "-", ""
    Write-Host "Formatted MAC: " -NoNewline -ForegroundColor Yellow
    Write-Host $macFormatted -ForegroundColor Green
} else {
    Write-Host "ERROR: No active network adapter found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "Location: " -NoNewline -ForegroundColor Yellow
$location = Read-Host "Enter location (Bedford/Dartmouth/Stratford/BayersLake/Truro)"

Write-Host "Bay Number: " -NoNewline -ForegroundColor Yellow
$bayNumber = Read-Host "Enter bay number (1/2/3/4/5)"

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Add this to your .env.local file:" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Generate environment variable names
$locationUpper = $location.ToUpper() -replace " ", ""
$envVarDevice = "NEXT_PUBLIC_${locationUpper}_BAY${bayNumber}_DEVICE=${deviceName}"
$envVarMac = "NEXT_PUBLIC_${locationUpper}_BAY${bayNumber}_MAC=${macFormatted}"

Write-Host $envVarDevice -ForegroundColor Green
Write-Host $envVarMac -ForegroundColor Green

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")