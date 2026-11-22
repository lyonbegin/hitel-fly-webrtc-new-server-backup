# Read-only export of the deployed Fly.io webrtc-new SERVER.
# Does not touch iOS/Android/web clients, restart Fly machines, or upload to GitHub.
param(
    [string]$App = 'webrtc-new',
    [string]$Image = ''
)
$ErrorActionPreference = 'Stop'

foreach ($tool in @('fly', 'docker')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Missing command: $tool"
    }
}

Write-Host '[1/6] Fly.io operating image and machines' -ForegroundColor Cyan
& fly image show -a $App
if ($LASTEXITCODE -ne 0) { throw 'fly image show failed' }
& fly machine list -a $App
if ($LASTEXITCODE -ne 0) { throw 'fly machine list failed' }

if (-not $Image) {
    $Image = Read-Host 'Paste deployed image reference: registry.fly.io/webrtc-new:... (or @sha256:...)'
}
if ($Image -notmatch ('^registry\.fly\.io/' + [regex]::Escape($App) + '([:@]|$)')) {
    throw "Wrong image reference for the $App server"
}

Write-Host '[2/6] Authenticate and download existing image' -ForegroundColor Cyan
& fly auth docker
if ($LASTEXITCODE -ne 0) { throw 'fly auth docker failed' }
& docker pull $Image
if ($LASTEXITCODE -ne 0) { throw 'docker pull failed' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$root = Join-Path $env:USERPROFILE "FlyServerBackup\$App\$stamp"
$stage = Join-Path $root 'server-files'
New-Item -ItemType Directory -Force -Path $stage | Out-Null

Write-Host '[3/6] Save exact deployed container image locally' -ForegroundColor Cyan
$tar = Join-Path $root 'deployed-server-image.tar'
& docker save -o $tar $Image
if ($LASTEXITCODE -ne 0) { throw 'docker save failed' }
(Get-FileHash $tar -Algorithm SHA256).Hash |
    Set-Content (Join-Path $root 'image-tar-sha256.txt')

Write-Host '[4/6] Extract server-only files without starting container' -ForegroundColor Cyan
$workdir = (& docker image inspect --format '{{.Config.WorkingDir}}' $Image | Select-Object -First 1).Trim()
if (-not $workdir -or $workdir -eq '/') { $workdir = '/app' }
$workdir = $workdir.TrimEnd('/')
$cid = (& docker create $Image | Select-Object -Last 1).Trim()
if ($LASTEXITCODE -ne 0 -or -not $cid) { throw 'docker create failed' }

$paths = @(
    'src','dist','sql','prisma','migrations',
    'package.json','package-lock.json','npm-shrinkwrap.json',
    'pnpm-lock.yaml','yarn.lock','tsconfig.json',
    'tsconfig.build.json','nest-cli.json',
    'Dockerfile','fly.toml','server.js','index.js'
)
try {
    foreach ($rel in $paths) {
        $source = ('{0}:{1}/{2}' -f $cid, $workdir, $rel)
        $dest = Join-Path $stage $rel
        New-Item -ItemType Directory -Force (Split-Path -Parent $dest) | Out-Null
        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            & docker cp $source $dest 2>$null
            $copyExit = $LASTEXITCODE
        }
        finally { $ErrorActionPreference = $oldPreference }
        if ($copyExit -ne 0) {
            Remove-Item -LiteralPath $dest -Force -Recurse -ErrorAction SilentlyContinue
        }
    }
}
finally {
    & docker rm $cid | Out-Null
}

# Exclude obvious credential-related files from the review ZIP.
# A filename filter alone does not guarantee absence of embedded secrets.
$deny = '(?i)(^\.env($|\.)|\.pem$|\.key$|\.p12$|\.pfx$|\.jks$|\.keystore$|^\.npmrc$|id_rsa|id_ed25519|credential|service.account|adminsdk|firebase.*\.json$)'
$excluded = @()
Get-ChildItem $stage -Recurse -File | ForEach-Object {
    if ($_.Name -match $deny) {
        $excluded += $_.FullName.Substring($stage.Length + 1)
        Remove-Item $_.FullName -Force
    }
}
$files = @(Get-ChildItem $stage -Recurse -File)
if ($files.Count -eq 0) {
    throw "No src/dist/server files found at $workdir; image TAR is saved to $root"
}

Write-Host '[5/6] SHA-256 and potential secret scan' -ForegroundColor Cyan
$manifest = foreach ($file in $files) {
    [PSCustomObject]@{
        Path = $file.FullName.Substring($stage.Length + 1).Replace('\','/')
        SHA256 = (Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        Bytes = $file.Length
    }
}
$manifest | Export-Csv (Join-Path $root 'file-sha256.csv') -NoTypeInformation -Encoding UTF8
$Image | Set-Content (Join-Path $root 'image-ref.txt')
$pattern = '(?i)-----BEGIN [A-Z ]*PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[A-Za-z0-9-]{20,}'
$suspect = @()
foreach ($file in $files) {
    try {
        if (Select-String -LiteralPath $file.FullName -Pattern $pattern -Quiet) {
            $suspect += $file.FullName.Substring($stage.Length + 1)
        }
    } catch {
        $suspect += $file.FullName.Substring($stage.Length + 1)
    }
}
@(
    "Excluded filenames: $($excluded.Count)",
    "Potentially sensitive files: $($suspect.Count)",
    'Excluded names:', $excluded,
    'Review before any public upload:', $suspect
) | Set-Content (Join-Path $root 'sensitivity-report.txt')

Write-Host '[6/6] Build review archive (not publicly uploaded)' -ForegroundColor Cyan
$zip = Join-Path $root 'server-only-review.zip'
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
Write-Host "Local image TAR: $tar" -ForegroundColor Green
Write-Host "Server review ZIP: $zip"
Write-Host "Hash list: $(Join-Path $root 'file-sha256.csv')"
Write-Host "Sensitive-file report: $(Join-Path $root 'sensitivity-report.txt')"
Write-Host "Extracted files: $($files.Count); filtered filenames: $($excluded.Count); flagged content: $($suspect.Count)"
Write-Host 'Upload review ZIP and sensitivity-report.txt to the chat for inspection before GitHub publication.'
