# PowerShell script to seed demo data
# Creates a demo tenant and user for testing

$API_BASE_URL = "https://api.gastronomos.clubemkt.digital/api/v1"

Write-Host "🌱 Seeding demo data...`n" -ForegroundColor Cyan

# Prepare registration data
$registerData = @{
    email = "demo@gastronomos.com"
    password = "demo123"
    tenantName = "Demo Restaurant"
    tenantSlug = "demo-restaurant"
} | ConvertTo-Json

Write-Host "Creating demo tenant and user..." -ForegroundColor Yellow

try {
    # Try to register
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/auth/register" `
        -Method Post `
        -ContentType "application/json" `
        -Body $registerData `
        -ErrorAction Stop

    Write-Host "✓ Demo tenant and user created successfully" -ForegroundColor Green
    Write-Host "  Email: demo@gastronomos.com" -ForegroundColor White
    Write-Host "  Password: demo123" -ForegroundColor White
    Write-Host "  Tenant: $($response.tenant.name)" -ForegroundColor White
    Write-Host "  User ID: $($response.user.id)" -ForegroundColor White
    
} catch {
    $errorMessage = $_.Exception.Message
    
    if ($errorMessage -like "*already exists*" -or $errorMessage -like "*409*") {
        Write-Host "✓ Demo account already exists" -ForegroundColor Green
        
        # Try to login to verify
        Write-Host "`nVerifying demo login..." -ForegroundColor Yellow
        
        $loginData = @{
            email = "demo@gastronomos.com"
            password = "demo123"
        } | ConvertTo-Json
        
        try {
            $loginResponse = Invoke-RestMethod -Uri "$API_BASE_URL/auth/login" `
                -Method Post `
                -ContentType "application/json" `
                -Body $loginData `
                -ErrorAction Stop
            
            Write-Host "✓ Demo login successful" -ForegroundColor Green
            Write-Host "  User: $($loginResponse.user.email)" -ForegroundColor White
            Write-Host "  Role: $($loginResponse.user.role)" -ForegroundColor White
            Write-Host "  Tenant: $($loginResponse.user.tenant_id)" -ForegroundColor White
            
        } catch {
            Write-Host "✗ Demo login failed" -ForegroundColor Red
            Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        }
        
    } else {
        Write-Host "❌ Error creating demo account" -ForegroundColor Red
        Write-Host "  Error: $errorMessage" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n✨ Demo data seeding complete!" -ForegroundColor Green
Write-Host "`nYou can now login with:" -ForegroundColor Cyan
Write-Host "  Email: demo@gastronomos.com" -ForegroundColor White
Write-Host "  Password: demo123" -ForegroundColor White
