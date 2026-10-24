param([switch]$SyntaxOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$corePaths = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'Assets/Blackout/Core') -Filter '*.cs' | Select-Object -ExpandProperty FullName
Add-Type -Path $corePaths
$syntaxErrors = @()
foreach ($sourceFile in Get-ChildItem -LiteralPath (Join-Path $projectRoot 'Assets/Blackout') -Recurse -Filter '*.cs') {
    $tree = [Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree]::ParseText([IO.File]::ReadAllText($sourceFile.FullName))
    foreach ($diagnostic in $tree.GetDiagnostics()) { if ($diagnostic.Severity.ToString() -eq 'Error') { $syntaxErrors += "$($sourceFile.Name): $diagnostic" } }
}
if ($syntaxErrors.Count) { throw ($syntaxErrors -join "`n") }
Write-Output 'PASS: all C# files parse; the engine-independent C# assembly compiles.'
if ($SyntaxOnly) { exit 0 }
$catalogOptions = [System.Text.Json.JsonSerializerOptions]::new()
$catalogOptions.IncludeFields = $true
$catalogPath = Join-Path $projectRoot 'Assets/Blackout/Resources/BlackoutCatalog.json'
$catalog = [System.Text.Json.JsonSerializer]::Deserialize([IO.File]::ReadAllText($catalogPath), [AfterBlackout.Core.Catalog], $catalogOptions)
function Assert-True($condition, $message) { if (-not $condition) { throw $message } }
function Assert-Near([float]$actual, [float]$expected, $message) { Assert-True ([Math]::Abs($actual-$expected) -lt 0.002) "$message ($actual vs $expected)" }
$damageType = [AfterBlackout.Core.DamageSource]
foreach ($definition in $catalog.guns) {
    $gun = [AfterBlackout.Core.GunState]::new($definition)
    Assert-True $gun.Fire() 'Gun must fire the first shot'
    Assert-True (-not $gun.Fire()) 'Cadence must prevent immediate second shot'
    $gun.Tick($definition.interval+0.01)
    Assert-True $gun.Fire() 'Cooldown must expire'
    $gun.Ammo = 0
    $gun.Reserve = $(if ($definition.id -eq 'pistol') { -1 } else { 3 })
    Assert-True $gun.Reload($false) 'Empty gun must reload'
    $gun.Tick($definition.reload+0.01)
    Assert-True ($gun.Ammo -eq $(if ($definition.id -eq 'pistol') { $definition.mag } else { 3 })) 'Reload must respect finite reserve'
}
Write-Output 'PASS: all four guns, cadence, reload, finite reserve and infinite pistol reserve.'
foreach ($blade in $catalog.melee) {
    foreach ($heavy in @($false,$true)) {
        $definition = $(if ($heavy) { $blade.heavy } else { $blade.light })
        $action = [AfterBlackout.Core.MeleeAction]::new($definition,$heavy,0)
        Assert-True (-not $action.Tick($definition.Contact-0.005)) 'Melee must not hit before contact'
        Assert-True $action.Tick(0.01) 'Melee must hit at the contact frame'
        Assert-True (-not $action.Tick(0.01)) 'Melee must not hit twice'
        $null = $action.Tick($definition.duration)
        Assert-True $action.Complete 'Recovery must complete'
    }
}
$vitals = [AfterBlackout.Core.Vitals]::new()
$vitals.Stamina = 17
Assert-True (-not $vitals.SpendHeavy(1.52)) 'Low stamina must block heavy attacks'
$vitals.Stamina = 100
Assert-True $vitals.SpendHeavy(1.52) 'Heavy attack must be allowed'
$vitals.Tick(1.5,$false,$false,$true,$false)
Assert-Near $vitals.Stamina 82 'No stamina regeneration during the heavy action'
$vitals.Stamina = 100
for ($i=0;$i -lt 251;$i++) { $vitals.Tick(0.02,$true,$true,$false,$false) }
Assert-True $vitals.Exhausted 'Sprint must exhaust stamina'
Assert-True (-not $vitals.Sprinting) 'Exhaustion must stop sprinting'
Write-Output 'PASS: ten delayed melee contacts, recovery, heavy cost and sprint exhaustion.'
$builds = 0
foreach ($chapter in $catalog.chapters) {
    foreach ($primary in @('m4','ak','awm')) { foreach ($facility in @([AfterBlackout.Core.Facility]::Grid,[AfterBlackout.Core.Facility]::Turret)) { foreach ($upgrade in @([AfterBlackout.Core.Upgrade]::Pierce,[AfterBlackout.Core.Upgrade]::Reload,[AfterBlackout.Core.Upgrade]::Shock)) {
        $loadout = [AfterBlackout.Core.Loadout]::new(); $loadout.primary=$primary; $loadout.melee='katana';$loadout.optic='x8'
        $game = [AfterBlackout.Core.Campaign]::new($chapter,$loadout)
        Assert-True ($null -eq $game.Next($catalog)) 'Cannot skip an unfinished chapter'
        $game.SkipBriefing()
        for ($wave=1;$wave -le 3;$wave++) {
            $spawned = 0; $guard = 0
            while ($game.Stage -eq [AfterBlackout.Core.Stage]::Wave -and $guard++ -lt 20000) {
                $game.Tick(0.1)
                $kind = [AfterBlackout.Core.EnemyKind]::Walker
                if ($game.TrySpawn([ref]$kind)) { $spawned++;$game.Kill($kind,[AfterBlackout.Core.DamageSource]::Bullet,$true) }
            }
            Assert-True ($spawned -eq $chapter.waves[$wave-1].Total) 'Wave composition must be preserved'
            if ($wave -eq 1) {
                Assert-True (-not $game.Interact($false,$false)) 'Power interaction requires proximity'
                Assert-True $game.Interact($true,$false) 'Power console opens selection'
                $before=$game.Time;$game.Tick(5);Assert-Near $game.Time $before 'Choice must freeze the simulation'
                Assert-True $game.ChooseFacility($facility) 'Facility choice starts wave two'
            } elseif ($wave -eq 2) { Assert-True $game.ChooseUpgrade($upgrade) 'Upgrade starts wave three' }
        }
        $game.Tick(3.1)
        Assert-Near $game.Boss.MaximumHealth $chapter.bossHp 'Chapter-specific boss health'
        $boss=$game.Boss
        $head=$boss.Hit(30,[AfterBlackout.Core.DamageSource]::Bullet,$true)
        Assert-Near $head.Damage 30 'Guarded boss head receives base gun damage'
        $boss.Exposed=2;$head=$boss.Hit(30,[AfterBlackout.Core.DamageSource]::Bullet,$true)
        Assert-Near $head.Damage 72 'Exposed boss head receives 2.4x damage'
        for ($phase=1;$phase -le 3;$phase++) {
            $hit=$boss.Hit(1000000,[AfterBlackout.Core.DamageSource]::Bullet,$true)
            if ($phase -lt 3) {
                Assert-True $hit.PhaseChanged 'Damage must stop at phase boundary'
                $hp=$boss.Health;$null=$boss.Hit(1000000,[AfterBlackout.Core.DamageSource]::Bullet,$true);Assert-Near $boss.Health $hp 'Regroup transition must stop damage'
                $game.Tick(1.21);Assert-True ($game.TakeAdds() -eq 2) 'New phase summons two adds'
            }
        }
        $game.Tick(0.01);Assert-True ($game.Stage -eq [AfterBlackout.Core.Stage]::ExitTravel) 'Boss victory must start extraction route'
        Assert-True (-not $game.Interact($false,$true)) 'Extraction has six-second buffer'
        $game.Tick(6.1);Assert-True $game.Interact($false,$true) 'Exit interaction starts opening'
        $before=$game.GateRemaining;$game.Paused=$true;$game.Tick(10);Assert-Near $game.GateRemaining $before 'Pause freezes gate timer';$game.Paused=$false
        $game.Tick($chapter.evacSeconds+0.01);$game.Exit($false);Assert-True ($null -eq $game.Result) 'Player must enter the exit'
        $game.Exit($true);Assert-True $game.Result.won 'Chapter must finish'
        $next=$game.Next($catalog)
        if ($chapter.index -lt 2) { Assert-True ($next.Level.index -eq $chapter.index+1) 'Next chapter order';Assert-True ($next.Loadout.melee -eq 'katana' -and $next.Loadout.primary -eq $primary -and $next.Loadout.optic -eq 'x8') 'Equipment carries forward';Assert-True ($next.Facility -eq [AfterBlackout.Core.Facility]::None) 'Facilities reset between maps' } else { Assert-True ($null -eq $next) 'No fourth chapter' }
        $builds++
    } } }
}
Assert-True ($builds -eq 54) 'Every chapter/gun/facility/upgrade combination must run'
$training=[AfterBlackout.Core.Campaign]::new($catalog.chapters[0],[AfterBlackout.Core.Loadout]::new(),$true)
$training.Tick(3.1)
for($phase=0;$phase -lt 3;$phase++){$null=$training.Boss.Hit(1000000,[AfterBlackout.Core.DamageSource]::Bullet,$true);$training.Tick(1.21)}
Assert-True ($training.Result.won -and $null -eq $training.Next($catalog)) 'Training finishes separately'
Write-Output "PASS: $builds chapter/gun/facility/upgrade combinations, three boss phases, extraction, chapter continuation and separate training."
Write-Output 'LIMIT: these are C# core/syntax checks. Unity API compilation, scenes, navigation bake, Web build and visuals require the Unity Editor.'
