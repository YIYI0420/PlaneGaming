using System.Collections;
using System.IO;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.Rendering;
using AfterBlackout.Core;

namespace AfterBlackout.Tests
{
    public sealed class GameplaySmokeTests
    {
        [UnityTest] public IEnumerator ThreeChaptersLoadMoveJumpSprintAndFireWhileAiming()
        {
            var root=GameRoot.Instance;
            if(root==null)root=new GameObject("SmokeTestGame").AddComponent<GameRoot>();
            root.Sound=false;
            var input=root.Input;float savedSensitivity=input.Sensitivity;
            input.SetSensitivity(1);Assert.That(input.MouseLook(Vector2.one).x,Is.EqualTo(.65f).Within(.001f));
            input.SetSensitivity(.5f);Assert.That(input.MouseLook(Vector2.one).x,Is.EqualTo(.325f).Within(.001f));
            Assert.That(PlayerPrefs.GetFloat("unity-look-sensitivity"),Is.EqualTo(.5f));
            input.SetSensitivity(999);Assert.That(input.Sensitivity,Is.EqualTo(2));input.SetSensitivity(savedSensitivity);
            yield return null;yield return null;
            Directory.CreateDirectory(Path.GetFullPath(Path.Combine(Application.dataPath,"../Logs/Screenshots")));
            ScreenCapture.CaptureScreenshot(Path.GetFullPath(Path.Combine(Application.dataPath,"../Logs/Screenshots/menu.png")));yield return null;yield return null;
            string[] guns={"m4","ak","awm"};string[] blades={"combat","katana","axe"};
            for(int chapter=0;chapter<3;chapter++)
            {
                root.SelectedChapter=chapter;root.Loadout=new Loadout{primary=guns[chapter],optic="red",melee=blades[chapter]};root.StartRun();
                float deadline=Time.realtimeSinceStartup+30;
                while(root.Loading&&Time.realtimeSinceStartup<deadline)yield return null;
                Assert.That(root.Loading,Is.False,"scene load timeout");root.Pause(false);
                yield return new WaitForSeconds(.5f);
                var player=root.Player;Assert.That(player.Controller.isGrounded,Is.True,"player must start on solid ground");
                var start=player.transform.position;root.Input.Stick=Vector2.up;
                yield return new WaitForSeconds(.4f);root.Input.Stick=Vector2.zero;
                float walk=Vector3.Distance(start,player.transform.position);Assert.That(walk,Is.GreaterThan(1));
                start=player.transform.position;root.Input.Stick=Vector2.up;root.Input.SprintToggle=true;
                yield return new WaitForSeconds(.4f);root.Input.Clear();
                Assert.That(Vector3.Distance(start,player.transform.position),Is.GreaterThan(walk*1.3f));
                float groundY=player.transform.position.y;root.Input.Jump();yield return new WaitForSeconds(.3f);
                Assert.That(player.transform.position.y-groundY,Is.GreaterThan(.45f));
                yield return new WaitForSeconds(.6f);
                root.Input.AimToggle=true;yield return new WaitForSeconds(.3f);
                Assert.That(player.Weapon.Aiming,Is.True);int ammo=player.Weapon.Primary.Ammo;
                root.Input.FireHeld=true;yield return new WaitForSeconds(.2f);root.Input.FireHeld=false;
                Assert.That(player.Weapon.Primary.Ammo,Is.LessThan(ammo),"ADS must allow firing");
                Assert.That(Vector3.Angle(player.View.ViewportPointToRay(new Vector3(.5f,.5f)).direction,player.View.transform.forward),Is.LessThan(.01f));
                Transform dot=null;foreach(var t in player.Weapon.PoseRoot.GetComponentsInChildren<Transform>(true))if(t.name=="RedDot")dot=t;Assert.That(dot,Is.Not.Null);
                var projection=player.Weapon.Overlay.WorldToViewportPoint(dot.position);Assert.That(projection.x,Is.EqualTo(.5f).Within(.005f));Assert.That(projection.y,Is.EqualTo(.5f).Within(.005f));
                Assert.That(dot.parent.name,Is.EqualTo("OpticAssembly"),"reticle must belong to the mounted sight");
                Assert.That(dot.parent.Find("OpticBase"),Is.Not.Null);Assert.That(dot.parent.Find("OpticRiser"),Is.Not.Null);
                Capture(player.View,"ads-"+guns[chapter]);yield return null;
                var viewRotation=player.View.transform.localRotation;player.View.transform.localRotation=Quaternion.Euler(-35,0,0);Capture(player.View,"ads-sky-"+guns[chapter]);player.View.transform.localRotation=viewRotation;
                if(chapter==0)
                {
                    player.Weapon.Switch(1);yield return new WaitForSeconds(.3f);root.Input.AimToggle=true;yield return new WaitForSeconds(.3f);
                    Transform pistolDot=player.Weapon.PoseRoot.Find("Weapon_pistol/OpticAssembly/RedDot");
                    foreach(var t in player.Weapon.PoseRoot.GetComponentsInChildren<Transform>())if(t.name=="RedDot")pistolDot=t;
                    Assert.That(pistolDot,Is.Not.Null);var pp=player.Weapon.Overlay.WorldToViewportPoint(pistolDot.position);Assert.That(pp.x,Is.EqualTo(.5f).Within(.005f));Assert.That(pp.y,Is.EqualTo(.5f).Within(.005f));
                    player.Weapon.Switch(0);yield return new WaitForSeconds(.3f);root.Input.AimToggle=true;yield return new WaitForSeconds(.3f);
                }
                var target=root.Spawn(EnemyKind.Walker,new Point{x=player.transform.position.x,y=player.transform.position.y,z=player.transform.position.z-4});target.enabled=false;target.Agent.enabled=false;
                root.Input.FireHeld=true;yield return new WaitForSeconds(2.4f);root.Input.FireHeld=false;
                Assert.That(target==null||target.Dead,Is.True,"centre ray must hit the visible target while aiming");
                root.Input.Clear();yield return new WaitForSeconds(.25f);
                Capture(player.View,"chapter"+(chapter+1));yield return null;
                player.Weapon.Switch(2);yield return new WaitForSeconds(.25f);player.Weapon.Swing(true);
                Assert.That(player.Weapon.Action,Is.Not.Null);Assert.That(player.Vitals.Stamina,Is.LessThan(100));
                yield return new WaitForSeconds(player.Weapon.Blade.heavy.duration+.05f);Assert.That(player.Weapon.Action,Is.Null);
                root.Pause(true);var stopped=player.transform.position;root.Input.Stick=Vector2.up;yield return new WaitForSecondsRealtime(.2f);Assert.That(player.transform.position,Is.EqualTo(stopped));root.Pause(false);
                root.ReturnToMenu();
            }
            root.SelectedChapter=0;root.StartRun(true);while(root.Loading)yield return null;root.Pause(false);
            var actor=root.Enemies.Find(e=>e!=null&&e.IsBoss);if(actor==null){yield return null;actor=root.Enemies.Find(e=>e!=null&&e.IsBoss);}Assert.That(actor,Is.Not.Null);
            root.Player.Controller.enabled=false;root.Player.transform.position=actor.transform.position+Vector3.forward*8;root.Player.Controller.enabled=true;
            yield return new WaitForSeconds(5.7f);Assert.That(root.Session.Stage,Is.EqualTo(Stage.Boss));Assert.That(actor.Warning.Contains("预警")||actor.Warning.Contains("蓄力")||actor.Warning.Contains("冲撞"),Is.True,"boss must telegraph its first configured skill");
            Capture(root.Player.View,"boss");yield return null;
            actor.Damage(100000,DamageSource.Bullet,true);Assert.That(root.Session.Boss.Phase,Is.EqualTo(2));Assert.That(actor.Dead,Is.False);yield return new WaitForSeconds(1.3f);
            actor.Damage(100000,DamageSource.Bullet,true);Assert.That(root.Session.Boss.Phase,Is.EqualTo(3));yield return new WaitForSeconds(1.3f);
            actor.Damage(100000,DamageSource.Bullet,true);yield return null;yield return null;Assert.That(root.Session.Result.won,Is.True);
            Time.timeScale=1;Object.Destroy(root.gameObject);yield return null;
        }
        static void Capture(Camera camera,string name)
        {
            string folder=Path.GetFullPath(Path.Combine(Application.dataPath,"../Logs/Screenshots"));Directory.CreateDirectory(folder);
            var target=RenderTexture.GetTemporary(1280,720,24,RenderTextureFormat.ARGB32);
            RenderPipeline.SubmitRenderRequest(camera,new RenderPipeline.StandardRequest{destination=target});
            var previous=RenderTexture.active;RenderTexture.active=target;var texture=new Texture2D(1280,720,TextureFormat.RGB24,false);texture.ReadPixels(new UnityEngine.Rect(0,0,1280,720),0,0);texture.Apply();File.WriteAllBytes(Path.Combine(folder,name+".png"),texture.EncodeToPNG());
            Object.Destroy(texture);RenderTexture.active=previous;RenderTexture.ReleaseTemporary(target);
        }
    }
}
