using NUnit.Framework;
using AfterBlackout.Core;

namespace AfterBlackout.Tests
{
    public sealed class CoreGameTests
    {
        [Test] public void ReloadRespectsReserveAndCadence()
        {
            var gun=new GunState(new GunDefinition{mag=30,reserve=3,interval=.125f,reload=1.75f});Assert.That(gun.Fire(),Is.True);Assert.That(gun.Fire(),Is.False);gun.Ammo=0;Assert.That(gun.Reload(false),Is.True);gun.Tick(2);Assert.That(gun.Ammo,Is.EqualTo(3));Assert.That(gun.Reserve,Is.Zero);
        }
        [Test] public void MeleeOnlyContactsOnceAtItsImpactTime()
        {
            var action=new MeleeAction(new AttackDefinition{duration=1.52f,windup=.6f,active=.22f},true,0);Assert.That(action.Tick(.70f),Is.False);Assert.That(action.Tick(.02f),Is.True);Assert.That(action.Tick(.02f),Is.False);Assert.That(action.Complete,Is.False);action.Tick(1);Assert.That(action.Complete,Is.True);
        }
        [Test] public void BossArmorAndPhaseBoundariesPreventInstantKill()
        {
            var boss=new BossBattle(9600);Assert.That(boss.Hit(30,DamageSource.Bullet,true).Damage,Is.EqualTo(30));boss.Exposed=2;Assert.That(boss.Hit(30,DamageSource.Bullet,true).Damage,Is.EqualTo(72));Assert.That(boss.Hit(1000000,DamageSource.Bullet,true).PhaseChanged,Is.True);Assert.That(boss.Health,Is.EqualTo(6400));Assert.That(boss.Hit(1000000,DamageSource.Bullet,true).Damage,Is.Zero);boss.Tick(1.21f);Assert.That(boss.Hit(1000000,DamageSource.Bullet,true).PhaseChanged,Is.True);Assert.That(boss.Health,Is.EqualTo(3200));
        }
        [Test] public void HeavyAttacksBuildStaggerAndSpendStamina()
        {
            var boss=new BossBattle(9600);BossHit hit=new BossHit();for(int i=0;i<4;i++)hit=boss.Hit(1,DamageSource.Heavy,false);Assert.That(hit.Staggered,Is.True);Assert.That(boss.Exposed,Is.EqualTo(3));var vitals=new Vitals();Assert.That(vitals.SpendHeavy(1.52f),Is.True);vitals.Tick(1.5f,false,false,true,false);Assert.That(vitals.Stamina,Is.EqualTo(82));
        }
        [Test] public void NextChapterRequiresVictoryAndPreservesEquipment()
        {
            var levels=new[]{new Chapter{index=0},new Chapter{index=1},new Chapter{index=2}};var catalog=new Catalog{chapters=levels};var game=new Campaign(levels[0],new Loadout{primary="awm",optic="x8",melee="axe"});Assert.That(game.Next(catalog),Is.Null);game.Finish(true);var next=game.Next(catalog);Assert.That(next.Level.index,Is.EqualTo(1));Assert.That(next.Loadout.primary,Is.EqualTo("awm"));Assert.That(next.Loadout.melee,Is.EqualTo("axe"));Assert.That(next.Facility,Is.EqualTo(Facility.None));
        }
        [Test] public void PauseStopsTheCampaignClock()
        { var game=new Campaign(new Chapter(),new Loadout());game.Paused=true;game.Tick(12);Assert.That(game.Time,Is.Zero); }
    }
}
