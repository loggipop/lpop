# Test script for Windows Code Signing Setup
# This script helps verify that your code signing environment is properly configured

Write-Host "🔍 Testing Windows Code Signing Setup" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

# Test 1: Check if signtool is available
Write-Host "1️⃣ Checking signtool availability..." -ForegroundColor Cyan
try {
    $signtoolVersion = & "signtool.exe" "verify" "/?" 2>&1 | Select-String "Usage:"
    if ($signtoolVersion) {
        Write-Host "✅ signtool.exe is available" -ForegroundColor Green
    } else {
        Write-Host "❌ signtool.exe not found or not working" -ForegroundColor Red
        Write-Host "   Please install Windows SDK or Visual Studio with Windows development tools" -ForegroundColor Yellow
        Write-Host "   Download from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ signtool.exe not found" -ForegroundColor Red
    Write-Host "   Please install Windows SDK or Visual Studio with Windows development tools" -ForegroundColor Yellow
}

Write-Host ""

# Test 2: Check if PowerShell execution policy allows script execution
Write-Host "2️⃣ Checking PowerShell execution policy..." -ForegroundColor Cyan
$executionPolicy = Get-ExecutionPolicy
Write-Host "   Current execution policy: $executionPolicy" -ForegroundColor Gray

if ($executionPolicy -eq "Restricted") {
    Write-Host "⚠️  Execution policy is restricted. You may need to run:" -ForegroundColor Yellow
    Write-Host "   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Gray
} else {
    Write-Host "✅ Execution policy allows script execution" -ForegroundColor Green
}

Write-Host ""

# Test 3: Check if the signing script exists
Write-Host "3️⃣ Checking signing script availability..." -ForegroundColor Cyan
$scriptPath = Join-Path $PSScriptRoot "sign-windows.ps1"
if (Test-Path $scriptPath) {
    Write-Host "✅ Signing script found: $scriptPath" -ForegroundColor Green
} else {
    Write-Host "❌ Signing script not found: $scriptPath" -ForegroundColor Red
}

Write-Host ""

# Test 4: Check if Node.js wrapper exists
Write-Host "4️⃣ Checking Node.js wrapper availability..." -ForegroundColor Cyan
$nodeScriptPath = Join-Path $PSScriptRoot "sign-windows.js"
if (Test-Path $nodeScriptPath) {
    Write-Host "✅ Node.js wrapper found: $nodeScriptPath" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js wrapper not found: $nodeScriptPath" -ForegroundColor Red
}

Write-Host ""

# Test 5: Check if there's a binary to sign
Write-Host "5️⃣ Checking for Windows binary..." -ForegroundColor Cyan
$binaryPath = "dist/lpop-windows-x64.exe"
if (Test-Path $binaryPath) {
    Write-Host "✅ Windows binary found: $binaryPath" -ForegroundColor Green
    
    # Check if it's already signed
    try {
        $signature = Get-AuthenticodeSignature -FilePath $binaryPath
        switch ($signature.Status) {
            "Valid" { 
                Write-Host "   ✅ Binary is already signed" -ForegroundColor Green
                Write-Host "   Certificate: $($signature.SignerCertificate.Subject)" -ForegroundColor Gray
            }
            "NotSigned" { 
                Write-Host "   ⚠️  Binary is not signed" -ForegroundColor Yellow
            }
            default { 
                Write-Host "   ⚠️  Binary signature status: $($signature.Status)" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "   ⚠️  Could not check signature: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Windows binary not found: $binaryPath" -ForegroundColor Red
    Write-Host "   Run 'bun run build:binaries' first" -ForegroundColor Yellow
}

Write-Host ""

# Test 6: Check for common certificate locations
Write-Host "6️⃣ Checking for common certificate locations..." -ForegroundColor Cyan
$certPaths = @(
    "cert.pfx",
    "certificate.pfx", 
    "code-signing.pfx",
    "lpop-cert.pfx"
)

$foundCerts = @()
foreach ($certPath in $certPaths) {
    if (Test-Path $certPath) {
        $foundCerts += $certPath
        Write-Host "   ✅ Found certificate: $certPath" -ForegroundColor Green
    }
}

if ($foundCerts.Count -eq 0) {
    Write-Host "   ⚠️  No common certificate files found" -ForegroundColor Yellow
    Write-Host "   Place your .pfx certificate file in the project root" -ForegroundColor Gray
} else {
    Write-Host "   Found $($foundCerts.Count) certificate file(s)" -ForegroundColor Green
}

Write-Host ""

# Test 7: Check Windows SDK installation
Write-Host "7️⃣ Checking Windows SDK installation..." -ForegroundColor Cyan
$sdkPaths = @(
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin\x64\signtool.exe",
    "${env:ProgramFiles}\Windows Kits\10\bin\x64\signtool.exe",
    "${env:ProgramFiles(x86)}\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools\x64\signtool.exe"
)

$sdkFound = $false
foreach ($sdkPath in $sdkPaths) {
    if (Test-Path $sdkPath) {
        Write-Host "   ✅ Windows SDK found: $sdkPath" -ForegroundColor Green
        $sdkFound = $true
        break
    }
}

if (-not $sdkFound) {
    Write-Host "   ⚠️  Windows SDK not found in common locations" -ForegroundColor Yellow
    Write-Host "   Make sure Windows SDK is installed and in PATH" -ForegroundColor Gray
}

Write-Host ""

# Summary
Write-Host "📋 Setup Summary" -ForegroundColor Green
Write-Host "===============" -ForegroundColor Green

$issues = @()

# Check for critical issues
try {
    $null = Get-Command "signtool.exe" -ErrorAction Stop
} catch {
    $issues += "signtool.exe not available"
}

if (-not (Test-Path $scriptPath)) {
    $issues += "Signing script missing"
}

if (-not (Test-Path $binaryPath)) {
    $issues += "Windows binary not built"
}

if ($issues.Count -eq 0) {
    Write-Host "✅ Setup looks good! You can now sign your Windows executable." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "1. Obtain a code signing certificate (.pfx file)" -ForegroundColor Gray
    Write-Host "2. Run: bun run sign:windows sign cert.pfx your_password" -ForegroundColor Gray
    Write-Host "3. Or build and sign together: bun run build:binaries -- --sign --cert=cert.pfx --password=your_password" -ForegroundColor Gray
} else {
    Write-Host "❌ Setup has issues that need to be resolved:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "   • $issue" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Please fix the issues above before proceeding with code signing." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📚 For more information, see: CODE_SIGNING.md" -ForegroundColor Cyan
