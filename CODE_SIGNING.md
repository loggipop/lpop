# Windows Code Signing Guide

This guide explains how to sign the Windows `.exe` file for the lpop CLI tool using Authenticode certificates.

## Overview

Code signing is a security measure that verifies the authenticity and integrity of software. When a Windows executable is signed, users can trust that the file hasn't been tampered with and comes from a verified source.

## Prerequisites

### 1. Windows Development Environment

- **Windows SDK**: Required for the `signtool.exe` utility
  - Download from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
  - Or install Visual Studio with Windows development tools

### 2. Code Signing Certificate

You have several options for obtaining a certificate:

#### Option A: Commercial Certificate (Recommended for Distribution)
- **DigiCert**: https://www.digicert.com/code-signing/
- **Sectigo**: https://sectigo.com/code-signing-certificates
- **GlobalSign**: https://www.globalsign.com/en/code-signing-certificates

**Benefits:**
- Highest trust level
- No SmartScreen warnings
- Compatible with all Windows versions
- EV certificates provide the best user experience

#### Option B: Self-Signed Certificate (Testing Only)
```powershell
# Create a self-signed certificate for testing
New-SelfSignedCertificate -Type Custom -Subject "CN=lpop Code Signing" -KeyUsage DigitalSignature -FriendlyName "lpop Code Signing Certificate" -CertStoreLocation "Cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(3)
```

**Note:** Self-signed certificates will show warnings and are not recommended for distribution.

#### Option C: Azure Key Vault (Cloud-based)
- Use Azure Key Vault for cloud-based code signing
- Integrates with CI/CD pipelines
- No local certificate management required

## Usage

### Basic Code Signing

1. **Build the binaries:**
   ```bash
   bun run build:binaries
   ```

2. **Sign the Windows executable:**
   ```bash
   # Using the Bun wrapper
   bun run sign:windows sign path/to/certificate.pfx your_password
   
   # Or directly with PowerShell
   powershell -File scripts/sign-windows.ps1 -CertificatePath path/to/certificate.pfx -CertificatePassword your_password
   ```

### Integrated Build and Sign

```bash
# Build and sign in one command
bun run build:binaries -- --sign --cert=path/to/certificate.pfx --password=your_password
```

### Verify Signature

```bash
# Verify the signature
bun run verify:windows

# Or verify a specific file
bun run sign:windows verify dist/lpop-windows-x64.exe
```

## Certificate Requirements

### Authenticode Certificate
- Must be a valid Authenticode certificate
- Should be in `.pfx` (PKCS#12) format
- Must include the private key
- Should be from a trusted Certificate Authority

### Certificate Information
The signing process includes the following information in the signature:
- **Description**: "lpop - Environment Variable Manager"
- **URL**: https://github.com/loggipop/lpop
- **Timestamp**: Uses DigiCert timestamp server by default

## Advanced Configuration

### Custom Timestamp Server
```bash
# Use a different timestamp server
powershell -File scripts/sign-windows.ps1 -CertificatePath cert.pfx -CertificatePassword password -TimestampServer http://timestamp.sectigo.com
```

### Sign Different Binary
```bash
# Sign a different executable
bun run sign:windows sign cert.pfx password path/to/other.exe
```

## Troubleshooting

### Common Issues

#### 1. "signtool.exe not found"
**Solution:** Install Windows SDK or Visual Studio with Windows development tools.

#### 2. "Certificate file not found"
**Solution:** Ensure the certificate path is correct and the file exists.

#### 3. "Invalid certificate password"
**Solution:** Verify the certificate password is correct.

#### 4. "Certificate is not valid for code signing"
**Solution:** Ensure the certificate has the "Code Signing" extended key usage.

#### 5. "Timestamp server unavailable"
**Solution:** Try a different timestamp server or check network connectivity.

### Verification Commands

```powershell
# Check certificate details
Get-AuthenticodeSignature -FilePath dist/lpop-windows-x64.exe

# Verify with signtool
signtool.exe verify /pa dist/lpop-windows-x64.exe

# Check certificate in Windows Certificate Manager
certmgr.msc
```

## Security Best Practices

### 1. Certificate Storage
- Store certificates securely
- Use strong passwords
- Consider hardware security modules (HSM) for production

### 2. Private Key Protection
- Never share private keys
- Use secure storage solutions
- Rotate certificates regularly

### 3. Build Environment
- Use clean, secure build environments
- Sign only verified, tested code
- Maintain audit trails

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Build and Sign Windows Binary

on:
  release:
    types: [published]

jobs:
  build-and-sign:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
         - name: Setup Bun
       uses: oven-sh/setup-bun@v1
       with:
         bun-version: latest
    
         - name: Install dependencies
       run: bun install
     
     - name: Build binaries
       run: bun run build:binaries
     
     - name: Sign Windows executable
       run: |
         bun run sign:windows sign ${{ secrets.CERT_PATH }} ${{ secrets.CERT_PASSWORD }}
      env:
        CERT_PATH: ${{ secrets.CERT_PATH }}
        CERT_PASSWORD: ${{ secrets.CERT_PASSWORD }}
    
    - name: Upload signed binary
      uses: actions/upload-artifact@v3
      with:
        name: lpop-windows-x64-signed
        path: dist/lpop-windows-x64.exe
```

## Cost Considerations

### Certificate Costs (Annual)
- **Standard Code Signing**: $100-500
- **EV Code Signing**: $300-1000
- **Self-Signed**: Free (testing only)

### Recommended for lpop
- **Development/Testing**: Self-signed certificate
- **Beta Releases**: Standard code signing certificate
- **Production Releases**: EV code signing certificate

## Legal Considerations

- Ensure you have the right to sign the code
- Follow your organization's security policies
- Consider liability and warranty implications
- Keep certificates and private keys secure

## Additional Resources

- [Microsoft Code Signing Documentation](https://docs.microsoft.com/en-us/windows/win32/seccrypto/code-signing)
- [Authenticode Overview](https://docs.microsoft.com/en-us/windows/win32/seccrypto/authenticode)
- [Windows SmartScreen](https://docs.microsoft.com/en-us/windows/security/threat-protection/windows-defender-smartscreen/windows-defender-smartscreen-overview)
- [Code Signing Best Practices](https://docs.microsoft.com/en-us/windows/win32/seccrypto/code-signing-best-practices)
