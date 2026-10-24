param([string]$OutputDirectory)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
if(-not $OutputDirectory){$OutputDirectory=[IO.Path]::GetFullPath((Join-Path $projectRoot '../../output/afterblackout-unity'))}
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$sourceItems=@('Assets','Packages','ProjectSettings','README.md','THIRD_PARTY_NOTICES.md','.gitignore') | ForEach-Object {Join-Path $projectRoot $_}
$packageStage=Join-Path $OutputDirectory 'SourceStage'
New-Item -ItemType Directory -Path $packageStage -Force | Out-Null
$toolStage=Join-Path $packageStage 'Tools';New-Item -ItemType Directory -Path $toolStage -Force | Out-Null
Get-ChildItem -LiteralPath $PSScriptRoot -File | Copy-Item -Destination $toolStage -Force
$sourceItems+=@($toolStage)
$sourceZip=Join-Path $OutputDirectory 'AfterBlackout-Unity-Source.zip'
Compress-Archive -LiteralPath $sourceItems -DestinationPath $sourceZip -Force
$windowsRoot=Join-Path $projectRoot 'Builds/Windows'
if(Test-Path -LiteralPath (Join-Path $windowsRoot 'AfterBlackout.exe')){
    $licenses=Join-Path $windowsRoot 'Licenses';New-Item -ItemType Directory -Path $licenses -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot 'THIRD_PARTY_NOTICES.md') -Destination $licenses -Force
    Copy-Item -LiteralPath (Join-Path $projectRoot 'Assets/Blackout/Resources/UI/OFL.txt') -Destination (Join-Path $licenses 'Font-OFL.txt') -Force
    @'
断电之后 / Unity + URP 原型试玩

双击 AfterBlackout.exe。请保留本目录中的数据文件夹和 DLL，不能只复制 EXE。
WASD 移动；鼠标看向；左键射击/轻击；右键开镜/重击；F 重击。
Shift 奔跑；空格跳跃；1/2/3 切换；R 装填；G 手雷；E 交互；Esc/P 暂停。
菜单可选择三关、主武器、瞄准镜、近战武器和首领训练。

当前是功能原型，角色、武器和场景仍包含临时模型，尚未完成写实美术。
网页版本需要另装 Web Build Support 并构建；此压缩包是 Windows 版。
'@ | Set-Content -LiteralPath (Join-Path $windowsRoot '开始试玩.txt') -Encoding utf8
    $shipping=Get-ChildItem -LiteralPath $windowsRoot | Where-Object {$_.Name -notlike '*BackUpThisFolder*'}
    $windowsZip=Join-Path $OutputDirectory 'AfterBlackout-Windows.zip'
    Compress-Archive -LiteralPath $shipping.FullName -DestinationPath $windowsZip -Force
    Get-Item -LiteralPath $windowsZip | Select-Object FullName,Length
}
Get-Item -LiteralPath $sourceZip | Select-Object FullName,Length
