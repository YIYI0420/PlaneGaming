using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering.Universal;
using AfterBlackout.Core;

namespace AfterBlackout
{
    public sealed class WeaponRig : MonoBehaviour
    {
        public GunState Primary,Pistol;public int Slot,Grenades=2;public MeleeAction Action;public bool Aiming;public float Zoom=1;
        public bool Attacking { get { return Action!=null; } }public GunState Gun { get { return Slot==1?Pistol:Primary; } }
        public MeleeDefinition Blade { get; private set; }public Camera Overlay;public Transform PoseRoot;public bool LastHead;
        public float HitUntil,Recoil;GameRoot root;PlayerRig player;GameObject model;Vector3 sightCenter=new Vector3(0,.16f,.095f);int combo;float grenadeCooldown,switchCooldown;bool wasFire;
        public GameObject Model { get { return model; } }public Transform SightAnchor { get; private set; }
        public Transform Muzzle { get; private set; }
        public string EquippedOptic { get { return Slot==2?"":Slot==1?"red":root.Session.Loadout.optic; } }
        public bool ScopeView { get { return Aiming&&Slot==0&&Zoom>2; } }
        public void Initialize(GameRoot game,PlayerRig rig)
        {
            root=game;player=rig;Primary=new GunState(game.Catalog.Gun(game.Session.Loadout.primary));Pistol=new GunState(game.Catalog.Gun("pistol"));Blade=game.Catalog.Blade(game.Session.Loadout.melee);
            var cameraObject=new GameObject("WeaponCamera");cameraObject.transform.SetParent(player.View.transform,false);Overlay=cameraObject.AddComponent<Camera>();Overlay.cullingMask=1<<10;Overlay.nearClipPlane=.025f;Overlay.farClipPlane=5;Overlay.fieldOfView=78;Overlay.GetUniversalAdditionalCameraData().renderType=CameraRenderType.Overlay;player.View.GetUniversalAdditionalCameraData().cameraStack.Add(Overlay);
            PoseRoot=new GameObject("WeaponWrist").transform;PoseRoot.SetParent(cameraObject.transform,false);Rebuild();Animate();
        }
        void Update()
        {
            if(root.Menu||root.Loading||root.Session.Frozen)return;float dt=Time.deltaTime;
            Primary.Tick(dt);Pistol.Tick(dt);switchCooldown=Mathf.Max(0,switchCooldown-dt);grenadeCooldown=Mathf.Max(0,grenadeCooldown-dt);Recoil=Mathf.Max(0,Recoil-dt*.5f);
            if(UnityEngine.Input.GetKeyDown(KeyCode.Alpha1))Switch(0);if(UnityEngine.Input.GetKeyDown(KeyCode.Alpha2))Switch(1);if(UnityEngine.Input.GetKeyDown(KeyCode.Alpha3)||UnityEngine.Input.GetKeyDown(KeyCode.V))Switch(2);
            if(UnityEngine.Input.GetKeyDown(KeyCode.Q)&&Slot!=2)root.Input.AimToggle=!root.Input.AimToggle;
            if(UnityEngine.Input.GetKeyDown(KeyCode.R))Reload();if(UnityEngine.Input.GetKeyDown(KeyCode.G))Grenade();
            Aiming=Slot!=2&&root.Input.Aim&&!player.Vitals.Sprinting&&!Gun.Reloading;Zoom=Aiming?OpticZoom(EquippedOptic):1;
            float fov=2*Mathf.Atan(Mathf.Tan(78*Mathf.Deg2Rad*.5f)/Zoom)*Mathf.Rad2Deg;player.View.fieldOfView=Mathf.Lerp(player.View.fieldOfView,fov,dt*16);Overlay.fieldOfView=player.View.fieldOfView;
            if(Action!=null){if(Action.Tick(dt))Contact();if(Action.Complete)Action=null;}
            bool fire=root.Input.Fire,pressed=fire&&!wasFire;wasFire=fire;
            if(switchCooldown<=0&&!player.Vitals.Sprinting)
            {
                bool automatic=root.Input.Touch&&root.AutoFire;
                if(Slot==2){if(root.Input.Heavy)Swing(true);else if(fire||(automatic&&MeleeTargets(false).Count>0))Swing(false);}
                else if((Slot==1?pressed:fire)||(automatic&&HasTarget()))Shoot();
            }
            if(Slot!=2&&Gun.Ammo==0&&!Gun.Reloading)Reload();if(Slot==0&&Primary.Ammo==0&&Primary.Reserve==0)Switch(1);
            Animate();
        }
        public void Switch(int slot)
        {
            int next=(slot+3)%3;if(next==Slot||Action!=null||root.Session.Frozen)return;
            Slot=next;Primary.CancelReload();Pistol.CancelReload();root.Input.AimToggle=false;Aiming=false;Zoom=1;Recoil=0;wasFire=root.Input.Fire;switchCooldown=.18f;
            player.View.fieldOfView=Overlay.fieldOfView=78;Rebuild();Animate();
        }
        void Rebuild()
        {
            if(model!=null){model.SetActive(false);Destroy(model);}model=VisualFactory.Weapon(PoseRoot,Slot==2?Blade.id:Slot==1?"pistol":Primary.Definition.id,Slot==2);Muzzle=model.transform.Find("Muzzle");RefreshOptic();
        }
        void RefreshOptic()
        { SightAnchor=Slot==2?null:OpticPresentation.Select(model,EquippedOptic,Slot==1);if(SightAnchor!=null)sightCenter=PoseRoot.InverseTransformPoint(SightAnchor.position); }
        public void Suspend()
        { Aiming=false;Zoom=1;wasFire=false;player.View.fieldOfView=Overlay.fieldOfView=78;Animate(); }
        public void Reload() { if(!root.Session.Frozen&&Slot!=2&&Gun.Reload(root.Session.Upgrade==Upgrade.Reload)){Aiming=false;Zoom=1;Animate();CombatAudio.Play("reload");} }
        bool HasTarget() { RaycastHit hit;return Physics.Raycast(player.View.ViewportPointToRay(new Vector3(.5f,.5f)),out hit,90,~((1<<10)|(1<<11)),QueryTriggerInteraction.Ignore)&&hit.collider.GetComponent<HitZone>()!=null; }
        void Shoot()
        {
            if(!Gun.Fire())return;root.Session.Shots++;Recoil=Gun.Definition.recoil;CombatAudio.Play("shot");
            // The ray is generated from the exact camera centre, including ADS and jump height.
            Ray ray=player.View.ViewportPointToRay(new Vector3(.5f,.5f));var hits=Physics.RaycastAll(ray,110,~((1<<10)|(1<<11)),QueryTriggerInteraction.Ignore);System.Array.Sort(hits,(a,b)=>a.distance.CompareTo(b.distance));
            Vector3 endpoint=ray.GetPoint(90);var struck=new HashSet<EnemyActor>();int penetration=0;
            foreach(var hit in hits)
            {
                var zone=hit.collider.GetComponent<HitZone>();endpoint=hit.point;
                if(zone==null){VisualFactory.Impact(hit.point,hit.normal,false);break;}
                if(!struck.Add(zone.Owner))continue;bool front=Vector3.Dot(zone.Owner.transform.forward,(player.transform.position-zone.Owner.transform.position).normalized)>.3f;
                float damage=Gun.Definition.damage;if(!zone.Owner.IsBoss){if(zone.Head)damage*=2.4f;else if(zone.Owner.Kind==EnemyKind.Armor&&front)damage*=.24f;}
                zone.Owner.Damage(damage,DamageSource.Bullet,zone.Head);root.Session.Hits++;LastHead=zone.Head;HitUntil=Time.unscaledTime+.12f;VisualFactory.Impact(hit.point,hit.normal,true);
                if(root.Session.Upgrade!=Upgrade.Pierce||zone.Owner.Kind!=EnemyKind.Walker||penetration++>=1)break;
            }
            VisualFactory.Tracer(Muzzle!=null?Muzzle.position:player.View.transform.TransformPoint(new Vector3(.15f,-.13f,.65f)),endpoint,new Color(1,.81f,.45f));
        }
        public void Swing(bool heavy)
        {
            if(Slot!=2||root.Session.Frozen||Action!=null||switchCooldown>0)return;var definition=heavy?Blade.heavy:Blade.light;
            if(heavy&&!player.Vitals.SpendHeavy(definition.duration)){root.Notify("重击需要 18 体力");return;}
            Action=new MeleeAction(definition,heavy,combo++%2);CombatAudio.Play(heavy?"heavy":"swing");
        }
        List<EnemyActor> MeleeTargets(bool heavy)
        {
            var result=new List<EnemyActor>();var attack=heavy?Blade.heavy:Blade.light;
            foreach(var enemy in root.Enemies)
            {
                if(enemy==null||enemy.Dead)continue;var delta=enemy.transform.position-player.transform.position;delta.y=0;
                if(delta.magnitude>Blade.range+attack.range+(enemy.IsBoss?.4f:.2f)||Vector3.Angle(player.transform.forward,delta)>attack.angle||!enemy.VisibleFrom(player.View.transform.position))continue;result.Add(enemy);
            }
            result.Sort((a,b)=>(a.transform.position-player.transform.position).sqrMagnitude.CompareTo((b.transform.position-player.transform.position).sqrMagnitude));return result;
        }
        void Contact()
        {
            var targets=MeleeTargets(Action.Heavy);int count=Mathf.Min(targets.Count,Action.Definition.cleave);
            for(int i=0;i<count;i++)
            { var e=targets[i];bool back=Vector3.Dot(e.transform.forward,(player.transform.position-e.transform.position).normalized)<-.3f;float damage=Blade.damage*Action.Definition.damage*(back?Blade.backstab:1)*((e.IsBoss||e.Kind==EnemyKind.Armor)?Blade.armor:1);e.Damage(damage,Action.Heavy?DamageSource.Heavy:DamageSource.Light,false,Blade.id=="axe");HitUntil=Time.unscaledTime+.12f;VisualFactory.Impact(e.AimPoint,-player.transform.forward,true); }
        }
        public void Grenade()
        {
            if(Grenades<=0||grenadeCooldown>0||root.Session.Frozen)return;Grenades--;grenadeCooldown=.65f;
            var obj=GameObject.CreatePrimitive(PrimitiveType.Sphere);obj.name="Grenade";obj.transform.position=player.View.transform.position+player.View.transform.forward*.6f;obj.transform.localScale=Vector3.one*.18f;var body=obj.AddComponent<Rigidbody>();body.mass=.4f;body.linearVelocity=player.View.transform.forward*8.7f+Vector3.up*2;obj.AddComponent<GrenadeProjectile>().Initialize(root);CombatAudio.Play("throw");
        }
        void Animate()
        {
            if(Slot==2){MeleePresentation.Apply(PoseRoot,Blade.id,Action);return;}
            model.SetActive(!ScopeView);
            float reload=Gun.Reloading?Mathf.Sin((1-Gun.ReloadRemaining/Gun.ReloadDuration)*Mathf.PI):0;
            PoseRoot.localPosition=new Vector3(Aiming?-sightCenter.x:Slot==1?.18f:.25f,(Aiming?-sightCenter.y:Slot==1?-.18f:-.23f)-reload*.25f,(Slot==1?.40f:.55f)-Recoil*.35f);PoseRoot.localRotation=Quaternion.Euler(reload*15,0,-reload*30);
            if(player.Vitals.Sprinting){PoseRoot.localPosition+=Vector3.down*.12f;PoseRoot.localRotation*=Quaternion.Euler(15,20,-25);}
        }
        public void SetOptic(string optic)
        {
            if(optic!="red"&&optic!="x4"&&optic!="x8")return;root.Session.Loadout.optic=optic;root.Loadout.optic=optic;PlayerPrefs.SetString("unity-optic",optic);PlayerPrefs.Save();
            if(Slot==0){RefreshOptic();Zoom=Aiming?OpticZoom(optic):1;player.View.fieldOfView=Overlay.fieldOfView=2*Mathf.Atan(Mathf.Tan(78*Mathf.Deg2Rad*.5f)/Zoom)*Mathf.Rad2Deg;Animate();}
        }
        public static float OpticZoom(string id) { return id=="x8"?8:id=="x4"?4:1.25f; }
    }


}
