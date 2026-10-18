param(
    [ValidateSet("Lightweight", "Offline")]
    [string]$Type = "Lightweight",
    [switch]$SkipSidecarBuild = $false,
    [switch]$SkipBackendStaging = $false,
    [switch]$SkipZip = $false,
    [switch]$ForceZip = $false,
    [switch]$SkipArchive = $false,
    [switch]$ForceArchive = $false
)

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $PSScriptRoot

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  OMNITOME INSTALLER BUILD: $Type" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. Verify / Build PyInstaller Sidecar
$sidecarExe = Join-Path $rootDir "dist-sidecar\omnitome-sidecar\omnitome-sidecar.exe"
if (-not (Test-Path $sidecarExe) -and -not $SkipSidecarBuild) {
    Write-Host "`n[1/5] Building PyInstaller sidecar..." -ForegroundColor Yellow
    & "$rootDir\scripts\build-sidecar.ps1"
} else {
    Write-Host "`n[1/5] Using existing PyInstaller sidecar at $sidecarExe" -ForegroundColor Green
}

# 2. Pre-archive Sidecar into resources/sidecar.7z (Required to stay under 2GB NSIS limit)
$sidecar7z = Join-Path $rootDir "resources\sidecar.7z"
$sidecarDir = Join-Path $rootDir "dist-sidecar\omnitome-sidecar"

if (-not ($SkipZip -or $SkipArchive)) {
    $needsArchive = -not (Test-Path $sidecar7z) -or ((Get-Item $sidecar7z).Length -lt 10MB) -or $ForceZip -or $ForceArchive
    if ($needsArchive) {
        Write-Host "`n[2/5] Archiving sidecar into resources\sidecar.7z (bypasses 2GB NSIS limit)..." -ForegroundColor Yellow
        $resourcesDir = Join-Path $rootDir "resources"
        if (-not (Test-Path $resourcesDir)) {
            New-Item -ItemType Directory -Force -Path $resourcesDir | Out-Null
        }
        if (Test-Path $sidecar7z) {
            Remove-Item -Force $sidecar7z
        }
        $oldSidecarZip = Join-Path $rootDir "resources\sidecar.zip"
        if (Test-Path $oldSidecarZip) {
            Write-Host "  Removing obsolete resources\sidecar.zip..." -ForegroundColor Gray
            Remove-Item -Force $oldSidecarZip
        }

        $swZip = [System.Diagnostics.Stopwatch]::StartNew()
        $sevenZipCmd = Get-Command 7z.exe -ErrorAction SilentlyContinue
        $sevenZipFromPath = if ($sevenZipCmd) { $sevenZipCmd.Source } else { $null }
        $sevenZipCandidates = @(
            $sevenZipFromPath,
            "${env:ProgramFiles}\7-Zip\7z.exe",
            "${env:ProgramFiles(x86)}\7-Zip\7z.exe"
        ) | Where-Object { $_ -and (Test-Path $_) }

        if ($sevenZipCandidates) {
            $sevenZip = $sevenZipCandidates[0]
            Write-Host "  Using 7-Zip ($sevenZip) to compress $sidecarDir -> $sidecar7z..." -ForegroundColor Gray
            Push-Location $sidecarDir
            try {
                & $sevenZip a -t7z -mx=5 $sidecar7z * | Out-Null
                if ($LASTEXITCODE -ne 0) {
                    if (Test-Path $sidecar7z) { Remove-Item -Force $sidecar7z -ErrorAction SilentlyContinue }
                    throw "7-Zip failed to create $sidecar7z with exit code $LASTEXITCODE"
                }
            } finally {
                Pop-Location
            }
        } else {
            throw "7z.exe is required to create sidecar.7z but was not found in PATH or standard installation directories."
        }
        $swZip.Stop()
        $archiveSizeMB = [Math]::Round((Get-Item $sidecar7z).Length / 1MB, 2)
        Write-Host "  sidecar.7z created in $([Math]::Round($swZip.Elapsed.TotalSeconds, 1))s: $archiveSizeMB MB" -ForegroundColor Green
    } else {
        $archiveSizeMB = [Math]::Round((Get-Item $sidecar7z).Length / 1MB, 2)
        Write-Host "`n[2/5] Using existing sidecar.7z ($archiveSizeMB MB)" -ForegroundColor Green
    }
}

# 3. Stage Clean Production-Only Backend Runtime (Resolves 1.2 GB node_modules bloat)
$backendRuntimeDir = Join-Path $rootDir "resources\backend-runtime"
if (-not $SkipBackendStaging) {
    Write-Host "`n[3/5] Staging production-only backend runtime..." -ForegroundColor Yellow
    if (Test-Path $backendRuntimeDir) {
        Remove-Item -Recurse -Force $backendRuntimeDir
    }
    New-Item -ItemType Directory -Force -Path $backendRuntimeDir | Out-Null
    
    # Copy backend source tree
    Copy-Item -Recurse (Join-Path $rootDir "backend\*") $backendRuntimeDir
    # Copy root package manifests for dependency resolution
    Copy-Item (Join-Path $rootDir "package.json") $backendRuntimeDir -Force
    Copy-Item (Join-Path $rootDir "package-lock.json") $backendRuntimeDir -Force

    # Install production dependencies only (--omit=dev)
    Write-Host "  Running npm install --omit=dev in $backendRuntimeDir..." -ForegroundColor Gray
    Push-Location $backendRuntimeDir
    try {
        npm install --omit=dev --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            throw "npm install --omit=dev failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }

    Write-Host "  Pruning non-Windows binaries and test fixtures..." -ForegroundColor Gray
    $prunePaths = @(
        "$backendRuntimeDir\tests",
        "$backendRuntimeDir\node_modules\onnxruntime-node\bin\napi-v6\darwin",
        "$backendRuntimeDir\node_modules\onnxruntime-node\bin\napi-v6\linux",
        "$backendRuntimeDir\node_modules\onnxruntime-node\bin\napi-v6\win32\arm64",
        "$backendRuntimeDir\node_modules\onnxruntime-node\bin\napi-v6\win32\ia32",
        "$backendRuntimeDir\node_modules\onnxruntime-web\dist"
    )
    foreach ($p in $prunePaths) {
        if (Test-Path $p) {
            Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue
        }
    }
    Write-Host "  Clean backend staged successfully." -ForegroundColor Green
} else {
    Write-Host "`n[3/5] Skipping backend staging (requested)." -ForegroundColor Yellow
}

# 4. Stage Portable Node.js Executable
$nodeDir = Join-Path $rootDir "resources\node"
$stagedNode = "$nodeDir\node.exe"
$needsNodeStaging = -not (Test-Path $stagedNode) -or ((Get-Item $stagedNode).Length -lt 10MB)

if ($needsNodeStaging) {
    Write-Host "`n[4/5] Staging portable standalone node.exe..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
    
    $candidateNodes = @(
        "C:\Users\Godsa\AppData\Local\Author Software\nvm\installs\v22.23.2\node.exe",
        "${env:ProgramFiles}\nodejs\node.exe"
    )
    $hostNode = $null
    foreach ($c in $candidateNodes) {
        if (Test-Path $c) {
            $hostNode = $c
            break
        }
    }
    if (-not $hostNode) {
        $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
        if ($nodeCmd) { $hostNode = $nodeCmd.Source }
    }
    if (-not $hostNode -or -not (Test-Path $hostNode)) {
        throw "Could not locate a valid standalone node.exe to stage."
    }
    Copy-Item $hostNode $stagedNode -Force
    Write-Host "  Copied standalone node.exe ($hostNode, $([Math]::Round((Get-Item $stagedNode).Length/1MB, 1)) MB) to $stagedNode" -ForegroundColor Green
} else {
    Write-Host "`n[4/5] Portable node.exe already staged ($([Math]::Round((Get-Item $stagedNode).Length/1MB, 1)) MB)." -ForegroundColor Green
}

# 5. If Offline build, stage neural models
if ($Type -eq "Offline") {
    Write-Host "`n[5/5] Staging offline neural models..." -ForegroundColor Yellow
    # Stage pre-extracted models into resources/models
}

# 5. Execute Tauri NSIS Build
Write-Host "`n[Final] Executing Tauri NSIS build (compression: none)..." -ForegroundColor Yellow
npm run tauri:build
if ($LASTEXITCODE -ne 0) {
    throw "Tauri NSIS build failed with exit code $LASTEXITCODE"
}

$installerExe = Join-Path $rootDir "src-tauri\target\release\bundle\nsis\Omnitome_1.0.0_x64-setup.exe"
if (Test-Path $installerExe) {
    $sizeMB = [Math]::Round((Get-Item $installerExe).Length / 1MB, 2)
    Write-Host "Installer created: $installerExe ($sizeMB MB)" -ForegroundColor Green
}

Write-Host "================================================================" -ForegroundColor Green
Write-Host "  BUILD SUCCESSFUL!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green

