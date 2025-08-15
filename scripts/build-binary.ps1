# Build script for creating lpop binaries for multiple operating systems using Bun
# PowerShell version for Windows compatibility

Write-Host "🔨 Building lpop binaries for multiple platforms with Bun..." -ForegroundColor Green

# Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
# Only remove binary files, not the entire dist directory
Get-ChildItem -Name "lpop*" -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path "dist" -Name "lpop*" -ErrorAction SilentlyContinue | Remove-Item -Force

# Create dist directory for binaries if it doesn't exist
if (-not (Test-Path "dist")) {
    New-Item -ItemType Directory -Force -Path "dist" | Out-Null
}

# Build targets: platform-architecture
$targets = @(
    "linux-x64"
    "linux-arm64"
    "darwin-x64"
    "darwin-arm64"
    "windows-x64"
)

Write-Host "📦 Building binaries for multiple platforms..." -ForegroundColor Green

foreach ($target in $targets) {
    Write-Host "🏗️  Building for $target..." -ForegroundColor Cyan
    
    # Extract platform and architecture
    $platform = $target.Split('-')[0]
    $arch = $target.Split('-')[1]
    
    # Set the target for Bun build
    if ($platform -eq "windows") {
        $binaryName = "lpop-$target.exe"
    } else {
        $binaryName = "lpop-$target"
    }
    
    # Build the binary for the specific target
    bun build src/index.ts --target=bun-$platform-$arch --compile --minify --outfile=dist/$binaryName
    
    Write-Host "✅ Built $binaryName" -ForegroundColor Green
}

# Build for current platform as default 'lpop' binary
Write-Host "🏗️  Building default binary for current platform..." -ForegroundColor Cyan
bun build src/index.ts --target=bun --compile --minify --outfile=lpop

# Make binaries executable (except Windows)
Write-Host "🔧 Making binaries executable..." -ForegroundColor Yellow
# Note: On Windows, we don't need to chmod, but we'll keep the structure similar

Write-Host ""
Write-Host "✅ All binaries build complete!" -ForegroundColor Green
Write-Host "📁 Binary locations:" -ForegroundColor White
Write-Host "   ./lpop (current platform)" -ForegroundColor Gray
Write-Host "   ./dist/lpop-linux-x64" -ForegroundColor Gray
Write-Host "   ./dist/lpop-linux-arm64" -ForegroundColor Gray
Write-Host "   ./dist/lpop-darwin-x64" -ForegroundColor Gray
Write-Host "   ./dist/lpop-darwin-arm64" -ForegroundColor Gray
Write-Host "   ./dist/lpop-windows-x64.exe" -ForegroundColor Gray
Write-Host ""
Write-Host "🚀 You can now run:" -ForegroundColor White
Write-Host "   ./lpop --help" -ForegroundColor Gray
