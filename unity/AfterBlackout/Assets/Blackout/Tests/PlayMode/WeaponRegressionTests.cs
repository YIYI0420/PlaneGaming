using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using AfterBlackout.Core;

namespace AfterBlackout.Tests
{
    public sealed class WeaponRegressionTests
    {
        GameRoot root;
        [UnityTearDown] public IEnumerator Cleanup(){Time.timeScale=1;if(root!=null)Object.Destroy(root.gameObject);yield return null;}
        IEnumerator Load(string gun,string optic="red",string blade="combat")
        {
            if(root==null){root=GameRoot.Instance;if(root==null)root=new GameObject("WeaponRegression").AddComponent<GameRoot>();}
            root.Sound=false;root.SelectedChapter=0;root.Loadout=new Loadout{primary=gun,optic=optic,melee=blade};root.StartRun();
            float deadline=Time.realtimeSinceStartup+30;while(root.Loading&&Time.realtimeSinceStartup<deadline)yield return null;
            Assert.That(root.Loading,Is.False);root.Pause(false);yield return new WaitForSeconds(.25f);
        }
        static void CheckSight(WeaponRig weapon,string optic)
        {
            Assert.That(weapon.EquippedOptic,Is.EqualTo(optic));var mount=weapon.Model.transform.Find("OpticAssembly");
            Assert.That(mount.Find("RedDotSight").gameObject.activeSelf,Is.EqualTo(optic=="red"));
            if(weapon.Slot==0)foreach(string id in new[]{"x4","x8"})Assert.That(mount.Find(id).gameObject.activeSelf,Is.EqualTo(optic==id));
            Assert.That(weapon.SightAnchor,Is.Not.Null);
        }
        [UnityTest] public IEnumerator EveryPrimaryAndOpticHasMatchingModelZoomAndCleanWeaponSwitch()
        {
            foreach(string gun in new[]{"m4","ak","awm"})
            {
                string first=gun=="m4"?"red":gun=="ak"?"x4":"x8";yield return Load(gun,first);
                var weapon=root.Player.Weapon;CheckSight(weapon,first);
                foreach(string optic in new[]{"red","x4","x8"})
                {
                    weapon.SetOptic(optic);CheckSight(weapon,optic);Assert.That(weapon.Model.activeSelf,Is.True);
                    GameplaySmokeTests.Capture(root.Player.View,"equipment-"+gun+"-"+optic);
                    root.Input.AimToggle=true;yield return new WaitForSeconds(.25f);
                    Assert.That(weapon.Aiming,Is.True);Assert.That(weapon.Zoom,Is.EqualTo(WeaponRig.OpticZoom(optic)));
                    Assert.That(weapon.ScopeView,Is.EqualTo(optic!="red"));Assert.That(weapon.Model.activeSelf,Is.EqualTo(optic=="red"));
                    var centre=weapon.Overlay.WorldToViewportPoint(weapon.SightAnchor.position);
                    Assert.That(centre.x,Is.EqualTo(.5f).Within(.005f));Assert.That(centre.y,Is.EqualTo(.5f).Within(.005f));
                    int ammo=weapon.Primary.Ammo;root.Input.FireHeld=true;yield return new WaitForSeconds(.18f);root.Input.FireHeld=false;
                    Assert.That(weapon.Primary.Ammo,Is.LessThan(ammo),gun+" "+optic+" must fire in ADS");
                    var oldModel=weapon.Model;weapon.Switch(1);
                    Assert.That(oldModel.activeSelf,Is.False,"deferred Destroy must not leave a second visible gun");
                    Assert.That(weapon.Aiming,Is.False);Assert.That(weapon.Zoom,Is.EqualTo(1));Assert.That(weapon.Model.activeSelf,Is.True);CheckSight(weapon,"red");
                    Assert.That(root.Player.View.fieldOfView,Is.EqualTo(78));
                    var grip=weapon.Model.transform.Find("PistolGrip");Assert.That(grip,Is.Not.Null);
                    foreach(string palm in new[]{"PistolFiringPalm","PistolSupportPalm"})
                    {
                        var hand=weapon.Model.transform.Find(palm);Assert.That(Vector3.Distance(hand.localPosition,grip.localPosition),Is.LessThan(.06f));
                        Assert.That(hand.localPosition.z,Is.LessThan(weapon.Muzzle.localPosition.z-.025f),"pistol support hand must stay behind muzzle");
                    }
                    yield return new WaitForSeconds(.25f);root.Input.AimToggle=true;yield return new WaitForSeconds(.25f);
                    Assert.That(weapon.Zoom,Is.EqualTo(1.25f),"primary optic must not change the pistol zoom");
                    weapon.SetOptic(optic);CheckSight(weapon,"red");weapon.Switch(0);CheckSight(weapon,optic);
                    root.Input.Clear();yield return new WaitForSeconds(.25f);
                }
                root.Input.AimToggle=true;yield return new WaitForSeconds(.2f);root.Pause(true);
                Assert.That(weapon.Aiming,Is.False);Assert.That(weapon.Model.activeSelf,Is.True);Assert.That(weapon.Zoom,Is.EqualTo(1));
                weapon.SetOptic("x4");CheckSight(weapon,"x4");weapon.SetOptic("invalid");CheckSight(weapon,"x4");
                Assert.That(root.Session.Loadout.optic,Is.EqualTo("x4"));Assert.That(PlayerPrefs.GetString("unity-optic"),Is.EqualTo("x4"));
                root.ReturnToMenu();
            }
        }
        [UnityTest] public IEnumerator PistolClicksReloadPauseAndDryPrimaryBehaveConsistently()
        {
            yield return Load("m4");var weapon=root.Player.Weapon;weapon.Switch(1);yield return new WaitForSeconds(.25f);
            int ammo=weapon.Pistol.Ammo;root.Input.FireHeld=true;yield return new WaitForSeconds(.8f);
            Assert.That(weapon.Pistol.Ammo,Is.EqualTo(ammo-1),"pistol is semi automatic");
            root.Input.FireHeld=false;yield return new WaitForSeconds(.1f);root.Input.FireHeld=true;yield return new WaitForSeconds(.1f);root.Input.FireHeld=false;
            Assert.That(weapon.Pistol.Ammo,Is.EqualTo(ammo-2));
            root.Input.AimToggle=true;yield return new WaitForSeconds(.1f);weapon.Reload();
            Assert.That(weapon.Pistol.Reloading,Is.True);Assert.That(weapon.Aiming,Is.False);Assert.That(weapon.Model.activeSelf,Is.True);
            weapon.Switch(1);Assert.That(weapon.Pistol.Reloading,Is.True,"selecting the equipped slot must not cancel reload");
            root.Pause(true);float remaining=weapon.Pistol.ReloadRemaining;int grenades=weapon.Grenades;
            weapon.Grenade();weapon.Switch(2);weapon.Swing(true);yield return new WaitForSecondsRealtime(.25f);
            Assert.That(weapon.Grenades,Is.EqualTo(grenades));Assert.That(weapon.Slot,Is.EqualTo(1));Assert.That(weapon.Action,Is.Null);
            Assert.That(weapon.Pistol.ReloadRemaining,Is.EqualTo(remaining));root.Pause(false);yield return new WaitForSeconds(remaining+.1f);
            Assert.That(weapon.Pistol.Ammo,Is.EqualTo(weapon.Pistol.Definition.mag));Assert.That(weapon.Pistol.Reloading,Is.False);
            // The click used to dismiss a menu must be released before it can shoot.
            root.Input.Clear();root.Input.FireHeld=true;Assert.That(root.Input.Fire,Is.False);root.Input.FireHeld=false;Assert.That(root.Input.Fire,Is.False);
            root.Input.FireHeld=true;Assert.That(root.Input.Fire,Is.True);root.Input.FireHeld=false;yield return null;
            weapon.Switch(0);weapon.Primary.Ammo=0;weapon.Primary.Reserve=0;yield return new WaitForSeconds(.25f);
            Assert.That(weapon.Slot,Is.EqualTo(1),"a completely dry primary must hand over to the backup pistol");
            var at=root.Player.transform.position+root.Player.transform.forward*4;
            var target=root.Spawn(EnemyKind.Walker,new Point{x=at.x,y=at.y,z=at.z});target.enabled=false;target.Agent.enabled=false;
            root.Input.AimToggle=true;yield return new WaitForSeconds(.25f);
            for(int i=0;i<4&&target!=null&&!target.Dead;i++){root.Input.FireHeld=true;yield return new WaitForSeconds(.05f);root.Input.FireHeld=false;yield return new WaitForSeconds(.35f);}
            Assert.That(target==null||target.Dead,Is.True,"pistol centre reticle must hit a visible target");
        }
        [UnityTest] public IEnumerator ThreeActualScenesCompleteWavesChoicesBossAndChapterContinuation()
        {
            yield return Load("m4","x8");
            for(int chapter=0;chapter<3;chapter++)
            {
                Assert.That(root.Session.Level.index,Is.EqualTo(chapter));root.StartFirstWave();
                float deadline=Time.realtimeSinceStartup+35;
                while(root.Session.Result==null&&Time.realtimeSinceStartup<deadline)
                {
                    root.Player.Vitals.Heal(100);var session=root.Session;
                    if(session.Stage==Stage.Wave){session.Tick(4);yield return null;foreach(var e in root.Enemies.ToArray())if(e!=null&&!e.IsBoss)e.Damage(10000,DamageSource.Bullet,true);}
                    else if(session.Stage==Stage.FacilityTravel){Teleport(session.Level.box);root.Interact();Assert.That(session.Stage,Is.EqualTo(Stage.FacilityChoice));root.Choose(chapter==1?Facility.Turret:Facility.Grid);}
                    else if(session.Stage==Stage.UpgradeChoice)root.Choose(chapter==1?Upgrade.Shock:Upgrade.Pierce);
                    else if(session.Stage==Stage.BossIntro){yield return null;yield return null;Assert.That(root.Enemies.Exists(e=>e!=null&&e.IsBoss),Is.True);session.Tick(3.1f);}
                    else if(session.Stage==Stage.Boss){var boss=root.Enemies.Find(e=>e!=null&&e.IsBoss);Assert.That(boss,Is.Not.Null);session.Tick(1.3f);boss.Damage(1000000,DamageSource.Bullet,true);}
                    else if(session.Stage==Stage.ExitTravel){session.Tick(6.1f);Teleport(session.Level.exit);root.Interact();Assert.That(session.Stage,Is.EqualTo(Stage.Extraction));}
                    else if(session.Stage==Stage.Extraction)session.Tick(session.Level.evacSeconds+1);
                    yield return null;
                }
                Assert.That(root.Session.Result,Is.Not.Null,"chapter flow timed out at "+root.Session.Stage);
                Assert.That(root.Session.Result.won,Is.True);Assert.That(root.Session.Wave,Is.EqualTo(3));
                if(chapter<2){root.NextChapter();while(root.Loading)yield return null;root.Pause(false);yield return new WaitForSeconds(.1f);}
            }
            Assert.That(root.Completed.Count,Is.EqualTo(2));
        }
        [UnityTest] public IEnumerator FiveBladesContactOnlyDuringAttackAndGrenadeFusePauses()
        {
            foreach(string blade in new[]{"combat","karambit","machete","katana","axe"})
            {
                yield return Load("m4","red",blade);var weapon=root.Player.Weapon;weapon.Switch(2);yield return new WaitForSeconds(.25f);
                foreach(bool heavy in new[]{false,true})
                {
                    root.Player.Vitals.Stamina=100;var at=root.Player.transform.position+root.Player.transform.forward*1.2f;
                    var target=root.Spawn(EnemyKind.Walker,new Point{x=at.x,y=at.y,z=at.z});target.enabled=false;target.Agent.enabled=false;
                    weapon.HitUntil=0;weapon.Swing(heavy);Assert.That(weapon.Action,Is.Not.Null);Assert.That(weapon.HitUntil,Is.Zero);
                    var attack=weapon.Action;yield return new WaitForSeconds(attack.Definition.Contact+.025f);
                    Assert.That(attack.HitDone,Is.True);Assert.That(weapon.HitUntil,Is.GreaterThan(Time.unscaledTime),blade+" must contact the nearby target at its timed impact");
                    weapon.Switch(0);Assert.That(weapon.Slot,Is.EqualTo(2),"attack recovery must prevent cancelling a swing by switching");
                    yield return new WaitForSeconds(attack.Definition.duration-attack.Definition.Contact+.08f);Assert.That(weapon.Action,Is.Null);
                    if(target!=null&&!target.Dead)target.Damage(10000,DamageSource.Bullet,false);yield return null;
                }
            }
            root.Player.Weapon.Grenade();yield return null;var grenade=Object.FindFirstObjectByType<GrenadeProjectile>();Assert.That(grenade,Is.Not.Null);
            root.Pause(true);yield return new WaitForSecondsRealtime(1.55f);Assert.That(grenade!=null,Is.True,"grenade must not detonate during pause");
            root.Pause(false);yield return new WaitForSeconds(1.55f);Assert.That(grenade==null,Is.True);
        }
        [UnityTest] public IEnumerator BrowserMouseReleasePausesWithoutLosingWeaponOrReloadState()
        {
            yield return Load("m4","x8");var weapon=root.Player.Weapon;root.Input.AimToggle=true;yield return new WaitForSeconds(.2f);
            Assert.That(weapon.ScopeView,Is.True);root.BrowserPointerReleased();
            Assert.That(root.Session.Paused,Is.True);Assert.That(weapon.ScopeView,Is.False);Assert.That(weapon.Model.activeSelf,Is.True);
            root.BrowserPointerReleased();yield return null;Assert.That(root.Session.Paused,Is.True,"duplicate browser events must not resume gameplay");
            root.Pause(false);yield return new WaitForSeconds(.1f);weapon.Primary.Ammo-=2;weapon.Reload();float remaining=weapon.Primary.ReloadRemaining;
            root.BrowserPointerReleased();yield return new WaitForSecondsRealtime(.2f);
            Assert.That(weapon.Primary.ReloadRemaining,Is.EqualTo(remaining));root.Pause(false);yield return new WaitForSeconds(.1f);
            root.Input.FireHeld=true;root.BrowserPointerCaptured();Assert.That(root.Input.FireHeld,Is.False,"capturing the mouse must discard the click used for capture");
        }
        void Teleport(Point point){root.Player.Controller.enabled=false;root.Player.transform.position=GameRoot.ToVector(point);root.Player.Controller.enabled=true;}
    }
}
