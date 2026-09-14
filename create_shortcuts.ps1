# 创建「图片站」桌面快捷方式（与 comic_monitor\create_shortcuts.ps1 同一套路）
$ErrorActionPreference = 'Stop'
$base = $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$ws = New-Object -ComObject WScript.Shell

$icon = Join-Path $base 'logo\favicon.ico'
if (-not (Test-Path $icon)) { $icon = Join-Path $base 'logo\favicon.png' }

function New-Shortcut {
    param([string]$Name, [string]$Target, [string]$WorkDir, [string]$Icon, [string]$Desc)
    $lnkPath = Join-Path $desktop ($Name + '.lnk')
    $s = $ws.CreateShortcut($lnkPath)
    $s.TargetPath = $Target
    $s.WorkingDirectory = $WorkDir
    if ($Icon -and (Test-Path $Icon)) { $s.IconLocation = "$Icon,0" }
    $s.Description = $Desc
    $s.Save()
    Write-Host ("  已创建: " + $lnkPath)
}

# 改名只需改这里的 Name（例如想叫「白圣女与黑牧师伊甸园（W）」）
New-Shortcut -Name '图片站（W）' -Target (Join-Path $base '启动本地预览.bat') `
             -WorkDir $base -Icon $icon -Desc '图片站 · 本地预览（起本地服务并打开浏览器）'

Write-Host ''
Write-Host '完成。若图标没立刻刷新，注销或重启资源管理器即可。'
