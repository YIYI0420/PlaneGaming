param(
    [ValidateSet('Generate','Web','Windows','Test','PlayTest')][string]$Target='Web',
    [string]$EditorPath
)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
if (-not $EditorPath) {
    $candidates=@('E:\unityhubeditor\6000.6.7f1\Editor\Unity.exe','C:\Program Files\Unity\Hub\Editor\6000.6.7f1\Editor\Unity.exe')
    foreach($candidate in $candidates){if(Test-Path -LiteralPath $candidate){$EditorPath=$candidate;break}}
}
if (-not $EditorPath -or -not (Test-Path -LiteralPath $EditorPath)) {
    throw 'Unity Editor not found. Install Unity 6000.6.7f1 and Web Build Support, activate your license in Unity Hub, then pass -EditorPath with the full Unity.exe path.'
}
$logRoot=Join-Path $projectRoot 'Logs'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$logPath=Join-Path $logRoot ($Target+'.log')
$arguments=@('-batchmode','-projectPath',$projectRoot,'-logFile',$logPath)
if($Target -eq 'PlayTest'){$arguments+=@('-force-d3d11','-screen-width','1280','-screen-height','720')}
else{$arguments+='-nographics'}
if ($Target -in @('Test','PlayTest')) { $platform=if($Target -eq 'Test'){'EditMode'}else{'PlayMode'};$arguments+=@('-runTests','-testPlatform',$platform,'-testResults',(Join-Path $logRoot ($platform+'.xml'))) }
else {
    $method=switch($Target){'Generate'{'Generate'}'Web'{'BuildWeb'}'Windows'{'BuildWindows'}}
    $arguments+=@('-quit','-executeMethod',('AfterBlackout.Editor.ProjectBuilder.'+$method))
    if($Target -eq 'Web'){$arguments+=@('-buildTarget','WebGL')}
    if($Target -eq 'Windows'){$arguments+=@('-buildTarget','Win64')}
}
$quotedArguments=$arguments | ForEach-Object { '"' + $_.Replace('"','\"') + '"' }
$process=Start-Process -FilePath $EditorPath -ArgumentList $quotedArguments -PassThru -Wait -WindowStyle Hidden
if ($process.ExitCode -ne 0) { throw "Unity $Target failed (exit $($process.ExitCode)). See $logPath" }
if ($Target -in @('Test','PlayTest')) {
    $resultPath=Join-Path $logRoot ($platform+'.xml')
    if(-not(Test-Path -LiteralPath $resultPath)){throw 'Unity did not produce test results; inspect the editor log.'}
    [xml]$result=Get-Content -LiteralPath $resultPath -Raw
    if($result.'test-run'.result -ne 'Passed'){throw "Unity tests did not pass. See $resultPath"}
}
Write-Output "Unity $Target completed. Log: $logPath"
