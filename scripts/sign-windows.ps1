# Windows Code Signing Script for lpop
# This script signs the Windows .exe file with an Authenticode certificate

param(
    [Parameter(Mandatory=$false)]
    [string]$CertificatePath,
    
    [Parameter(Mandatory=$false)]
    [string]$CertificatePassword,
    
    [Parameter(Mandatory=$false)]
    [string]$TimestampServer = "http://timestamp.digicert.com",
    
    [Parameter(Mandatory=$false)]
    [string]$BinaryPath = "dist/lpop-windows-x64.exe",
    
    [Parameter(Mandatory=$false)]
    [switch]$VerifyOnly,
    
    [Parameter(Mandatory=$false)]
    [switch]$Help
)

function Show-Help {
    Write-Host "Windows Code Signing Script for lpop" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor White
    Write-Host "  .\sign-windows.ps1 [options]" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Options:" -ForegroundColor White
    Write-Host "  -CertificatePath <path>     Path to the .pfx certificate file" -ForegroundColor Gray
    Write-Host "  -CertificatePassword <pwd>  Password for the certificate" -ForegroundColor Gray
    Write-Host "  -TimestampServer <url>      Timestamp server URL (default: http://timestamp.digicert.com)" -ForegroundColor Gray
    Write-Host "  -BinaryPath <path>          Path to the .exe file to sign (default: dist/lpop-windows-x64.exe)" -ForegroundColor Gray
    Write-Host "  -VerifyOnly                 Only verify the signature without signing" -ForegroundColor Gray
    Write-Host "  -Help                       Show this help message" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor White
    Write-Host "  .\sign-windows.ps1 -CertificatePath cert.pfx -CertificatePassword mypassword" -ForegroundColor Gray
    Write-Host "  .\sign-windows.ps1 -VerifyOnly" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Certificate Requirements:" -ForegroundColor Yellow
    Write-Host "  - Must be a valid Authenticode certificate (.pfx format)" -ForegroundColor Gray
    Write-Host "  - Should be from a trusted Certificate Authority" -ForegroundColor Gray
    Write-Host "  - EV Code Signing certificates provide the highest trust level" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Getting a Certificate:" -ForegroundColor Yellow
    Write-Host "  1. Purchase from a trusted CA (DigiCert, Sectigo, etc.)" -ForegroundColor Gray
    Write-Host "  2. Use a self-signed certificate for testing (not recommended for distribution)" -ForegroundColor Gray
    Write-Host "  3. Use Azure Key Vault or similar for cloud-based signing" -ForegroundColor Gray
}

if ($Help) {
    Show-Help
    exit 0
}

# Check if the binary exists
if (-not (Test-Path $BinaryPath)) {
    Write-Host "❌ Binary not found: $BinaryPath" -ForegroundColor Red
    Write-Host "Please run the build script first: npm run build:binaries" -ForegroundColor Yellow
    exit 1
}

# Function to verify signature
function Test-FileSignature {
    param([string]$FilePath)
    
    try {
        $signature = Get-AuthenticodeSignature -FilePath $FilePath
        switch ($signature.Status) {
            "Valid" { 
                Write-Host "✅ File is properly signed" -ForegroundColor Green
                Write-Host "   Certificate: $($signature.SignerCertificate.Subject)" -ForegroundColor Gray
                Write-Host "   Valid from: $($signature.SignerCertificate.NotBefore)" -ForegroundColor Gray
                Write-Host "   Valid until: $($signature.SignerCertificate.NotAfter)" -ForegroundColor Gray
                return $true
            }
            "NotSigned" { 
                Write-Host "❌ File is not signed" -ForegroundColor Red
                return $false
            }
            default { 
                Write-Host "⚠️  File signature status: $($signature.Status)" -ForegroundColor Yellow
                return $false
            }
        }
    }
    catch {
        Write-Host "❌ Error checking signature: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to sign the file
function Sign-File {
    param(
        [string]$FilePath,
        [string]$CertPath,
        [string]$CertPassword,
        [string]$TimestampUrl
    )
    
    try {
        Write-Host "🔐 Signing file: $FilePath" -ForegroundColor Cyan
        
        # Import the certificate
        $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($CertPath, $CertPassword)
        Write-Host "✅ Certificate loaded: $($cert.Subject)" -ForegroundColor Green
        
        # Sign the file using signtool
        $signtoolArgs = @(
            "sign",
            "/f", $CertPath,
            "/p", $CertPassword,
            "/t", $TimestampUrl,
            "/d", "lpop - Environment Variable Manager",
            "/du", "https://github.com/loggipop/lpop",
            $FilePath
        )
        
        Write-Host "🔧 Running signtool..." -ForegroundColor Yellow
        $result = & "signtool.exe" $signtoolArgs 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ File signed successfully!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Signing failed:" -ForegroundColor Red
            Write-Host $result -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ Error during signing: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Main execution
Write-Host "🔐 Windows Code Signing Tool for lpop" -ForegroundColor Green
Write-Host ""

if ($VerifyOnly) {
    Write-Host "🔍 Verifying signature..." -ForegroundColor Cyan
    $isValid = Test-FileSignature -FilePath $BinaryPath
    exit $(if ($isValid) { 0 } else { 1 })
}

# Check if signtool is available
try {
    $null = Get-Command "signtool.exe" -ErrorAction Stop
    Write-Host "✅ signtool.exe found" -ForegroundColor Green
} catch {
    Write-Host "❌ signtool.exe not found. Please install Windows SDK or Visual Studio." -ForegroundColor Red
    Write-Host "   Download from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/" -ForegroundColor Yellow
    exit 1
}

# Check if certificate parameters are provided
if (-not $CertificatePath -or -not $CertificatePassword) {
    Write-Host "❌ Certificate path and password are required for signing" -ForegroundColor Red
    Write-Host ""
    Show-Help
    exit 1
}

# Check if certificate file exists
if (-not (Test-Path $CertificatePath)) {
    Write-Host "❌ Certificate file not found: $CertificatePath" -ForegroundColor Red
    exit 1
}

# Verify current signature (if any)
Write-Host "🔍 Checking current signature..." -ForegroundColor Cyan
$currentSignature = Test-FileSignature -FilePath $BinaryPath

# Sign the file
$signSuccess = Sign-File -FilePath $BinaryPath -CertPath $CertificatePath -CertPassword $CertificatePassword -TimestampUrl $TimestampServer

if ($signSuccess) {
    Write-Host ""
    Write-Host "🔍 Verifying new signature..." -ForegroundColor Cyan
    $newSignature = Test-FileSignature -FilePath $BinaryPath
    
    if ($newSignature) {
        Write-Host ""
        Write-Host "✅ Code signing completed successfully!" -ForegroundColor Green
        Write-Host "📁 Signed file: $BinaryPath" -ForegroundColor Gray
    } else {
        Write-Host "❌ Signature verification failed after signing" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Code signing failed" -ForegroundColor Red
    exit 1
}
