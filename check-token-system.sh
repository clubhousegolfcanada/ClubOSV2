#!/bin/bash

echo "=== TOKEN SYSTEM COMPREHENSIVE CHECK ==="
echo ""

echo "1. Check where tokens are stored after login:"
grep -n "localStorage.setItem('clubos_token'" ClubOSV1-frontend/src -r --include="*.tsx" --include="*.ts" | head -5

echo ""
echo "2. Check where tokens are retrieved:"
grep -n "localStorage.getItem('clubos_token')" ClubOSV1-frontend/src -r --include="*.tsx" --include="*.ts" | head -5

echo ""
echo "3. Check where Authorization headers are set:"
grep -n "Authorization.*Bearer" ClubOSV1-frontend/src -r --include="*.tsx" --include="*.ts" | head -10

echo ""
echo "4. Check axios default header setup:"
grep -n "axios.defaults.headers" ClubOSV1-frontend/src -r --include="*.tsx" --include="*.ts"

echo ""
echo "5. Check if we're setting axios defaults after login:"
grep -A5 -B5 "login.*token" ClubOSV1-frontend/src/state/useStore.ts | head -20
