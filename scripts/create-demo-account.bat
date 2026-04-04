@echo off
echo Creating demo account...
echo.

curl -X POST https://api.gastronomos.clubemkt.digital/api/v1/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"demo@gastronomos.com\",\"password\":\"demo123\",\"tenantName\":\"Demo Restaurant\",\"tenantSlug\":\"demo-restaurant\"}"

echo.
echo.
echo Demo account created or already exists!
echo.
echo Login credentials:
echo   Email: demo@gastronomos.com
echo   Password: demo123
echo.
pause
