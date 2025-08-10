@echo off
echo ====================================
echo Splashtop Bay Configuration Helper
echo ====================================
echo.

echo Device Name: %COMPUTERNAME%
echo.

echo MAC Addresses:
getmac /v | findstr /i "ethernet wi-fi"
echo.

echo ====================================
echo Quick Setup Instructions:
echo ====================================
echo.
echo 1. Copy the MAC address shown above (format: XX-XX-XX-XX-XX-XX)
echo 2. Remove the dashes to get: XXXXXXXXXXXX
echo 3. Add to your .env.local file:
echo.
echo    NEXT_PUBLIC_[LOCATION]_BAY[NUMBER]_MAC=XXXXXXXXXXXX
echo    NEXT_PUBLIC_[LOCATION]_BAY[NUMBER]_DEVICE=%COMPUTERNAME%
echo.
echo Example for Bedford Bay 1:
echo    NEXT_PUBLIC_BEDFORD_BAY1_MAC=C04A001C72EC
echo    NEXT_PUBLIC_BEDFORD_BAY1_DEVICE=%COMPUTERNAME%
echo.
pause