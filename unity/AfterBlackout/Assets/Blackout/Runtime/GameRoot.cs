using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using AfterBlackout.Core;

namespace AfterBlackout
{
    [DefaultExecutionOrder(-200)]
    public sealed class GameRoot : MonoBehaviour
    {
        public static GameRoot Instance;
        public Catalog Catalog { get; private set; } public Campaign Session { get; private set; }
        public PlayerRig Player { get; private set; } public InputBridge Input { get; private set; }
        public bool Menu=true,Loading; public int SelectedChapter;public Loadout Loadout=new Loadout();
        public readonly List<EnemyActor> Enemies=new List<EnemyActor>(); public readonly List<Result> Completed=new List<Result>();
        public string Notice="";public float NoticeUntil; public bool AutoFire=true,Sound=true;public int Quality=1;
        float facilityClock,reinforcementClock,supplyClock;int turretAmmo;bool bossCreated;Stage previous;EnemyActor boss;
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)] static void EnsureRoot()
        { if(FindFirstObjectByType<GameRoot>()==null)new GameObject("AfterBlackout").AddComponent<GameRoot>(); }
        void Awake()
        {
            if(Instance!=null&&Instance!=this){Destroy(gameObject);return;}Instance=this;DontDestroyOnLoad(gameObject);
            var asset=Resources.Load<TextAsset>("BlackoutCatalog");if(asset==null){Debug.LogError("BlackoutCatalog.json is missing");enabled=false;return;}
            Catalog=JsonUtility.FromJson<Catalog>(asset.text);SelectedChapter=Mathf.Clamp(PlayerPrefs.GetInt("unity-chapter",0),0,2);
            Loadout.primary=PlayerPrefs.GetString("unity-gun","m4");Loadout.melee=PlayerPrefs.GetString("unity-blade","combat");Loadout.optic=PlayerPrefs.GetString("unity-optic","red");
            Input=gameObject.AddComponent<InputBridge>();gameObject.AddComponent<GameHud>();gameObject.AddComponent<TouchControls>();gameObject.AddComponent<CombatAudio>();
        }
        public void StartRun(bool training=false,bool retry=false)
        { if(!retry)Completed.Clear();StartCoroutine(LoadChapter(new Campaign(Catalog.Level(SelectedChapter),Loadout,training))); }
        public void NextChapter()
        {
            if(Loading||Session==null)return;var next=Session.Next(Catalog);if(next==null)return;
            Completed.Add(Session.Result);SelectedChapter=next.Level.index;Loadout=next.Loadout.Copy();StartCoroutine(LoadChapter(next));
        }
        IEnumerator LoadChapter(Campaign session)
        {
            if(Loading)yield break;Loading=true;Menu=false;resultRecorded=false;Time.timeScale=1;Input.Clear();
            foreach(var e in Enemies.ToArray())if(e!=null)Destroy(e.gameObject);Enemies.Clear();if(Player!=null)Destroy(Player.gameObject);
            Hazard.ClearAll();Session=session;bossCreated=false;boss=null;facilityClock=.5f;reinforcementClock=3;supplyClock=14;turretAmmo=120;
            PlayerPrefs.SetInt("unity-chapter",session.Level.index);PlayerPrefs.SetString("unity-gun",Loadout.primary);PlayerPrefs.SetString("unity-blade",Loadout.melee);PlayerPrefs.SetString("unity-optic",Loadout.optic);PlayerPrefs.Save();
            var operation=SceneManager.LoadSceneAsync(session.Level.SceneName,LoadSceneMode.Single);if(operation==null){Loading=false;Menu=true;yield break;}while(!operation.isDone)yield return null;
            LightingPreset.Apply(session.Level);
            var playerObject=new GameObject("Player");playerObject.transform.SetParent(transform);Player=playerObject.AddComponent<PlayerRig>();Player.Initialize(this,session.Level.spawn);
            previous=session.Stage;ApplyQuality(Quality);Loading=false;Cursor.lockState=Application.isMobilePlatform?CursorLockMode.None:CursorLockMode.Locked;Cursor.visible=Application.isMobilePlatform;
            Notify(session.Level.name+" · 保持移动，接通供电");
        }
        public void ReturnToMenu()
        {
            Menu=true;Time.timeScale=1;if(Session!=null)Session.Paused=true;Input.Clear();Cursor.lockState=CursorLockMode.None;Cursor.visible=true;
            if(Player!=null)Player.enabled=false;foreach(var e in Enemies)if(e!=null)e.Freeze();
        }
        public void Pause(bool paused)
        { if(Menu||Loading||Session==null||Session.Result!=null)return;Session.Paused=paused;Time.timeScale=paused?0:1;Input.Clear();Cursor.lockState=paused?CursorLockMode.None:Application.isMobilePlatform?CursorLockMode.None:CursorLockMode.Locked;Cursor.visible=paused||Application.isMobilePlatform; }
        void OnApplicationFocus(bool focus) { if(!focus)Pause(true); }
        void OnApplicationPause(bool paused) { if(paused)Pause(true); }
        void Update()
        {
            if(Menu||Loading||Session==null)return;
            if(UnityEngine.Input.GetKeyDown(KeyCode.Escape)||UnityEngine.Input.GetKeyDown(KeyCode.P))Pause(!Session.Paused);
            if(Session.Frozen){Time.timeScale=0;Cursor.lockState=CursorLockMode.None;Cursor.visible=true;if(Session.Result!=null)RecordResult();return;}
            float dt=Time.deltaTime;Session.Tick(dt);EnemyKind kind;while(Session.TrySpawn(out kind))Spawn(kind);
            if(Session.Stage==Stage.BossIntro&&!bossCreated)
            { bossCreated=true;Player.Vitals.Heal(40);Player.Weapon.Primary.Fill();Player.Weapon.Grenades=Mathf.Min(3,Player.Weapon.Grenades+1);RefreshPickups();boss=Spawn(EnemyKind.Boss,Session.Level.bossSpawn);CombatAudio.Play("boss"); }
            if(Session.Stage==Stage.Boss)
            {
                int count=Session.TakeAdds();for(int i=0;i<count&&Enemies.FindAll(e=>e!=null&&!e.IsBoss).Count<4;i++)Spawn(Session.Boss.Phase==3?EnemyKind.Runner:EnemyKind.Walker);
                supplyClock-=dt;if(supplyClock<=0){supplyClock=14;RefreshPickups(true);Notify("弹药箱已刷新");}
            }
            if(previous!=Session.Stage)
            {
                if(Session.Stage==Stage.Wave)RefreshPickups();
                if(Session.Stage==Stage.ExitTravel){Hazard.ClearAll();foreach(var add in Enemies.ToArray())if(add!=null&&!add.IsBoss){Enemies.Remove(add);Destroy(add.gameObject);}Notify("首领倒下 · 补给后启动撤离通道");}
                previous=Session.Stage;
            }
            if(Session.Stage==Stage.Extraction){reinforcementClock-=dt;if(reinforcementClock<=0&&Enemies.Count<6){Spawn(Random.value<.3f?EnemyKind.Runner:EnemyKind.Walker);reinforcementClock=3.5f;}}
            TickFacilities(dt);
            var pos=Player.transform.position;Session.Exit(Vector3.Distance(pos,ToVector(Session.Level.exit))<2.4f);
            if(Player.Vitals.Health<=0)Session.Finish(false);
        }
        bool resultRecorded;
        void RecordResult()
        {
            if(resultRecorded)return;resultRecorded=true;Input.Clear();CombatAudio.Play(Session.Result.won?"win":"hurt");
            if(Session.Result.won&&!Session.Training){string key="unity-best-"+Session.Level.id;float best=PlayerPrefs.GetFloat(key,float.MaxValue);if(Session.Time<best)PlayerPrefs.SetFloat(key,Session.Time);PlayerPrefs.Save();}
        }
        public EnemyActor Spawn(EnemyKind kind,Point at=null)
        {
            var level=Session.Level;if(at==null)at=level.portals[Random.Range(0,level.portals.Length)];
            var obj=new GameObject(kind.ToString());obj.transform.position=ToVector(at);var actor=obj.AddComponent<EnemyActor>();actor.Initialize(this,kind);Enemies.Add(actor);return actor;
        }
        public void Died(EnemyActor actor,DamageSource source,bool head)
        { Enemies.Remove(actor);Session.Kill(actor.Kind,source,head); }
        public void Notify(string message) { Notice=message;NoticeUntil=Time.unscaledTime+3; }
        public void Interact()
        {
            if(Player==null)return;Vector3 pos=Player.transform.position;
            Session.Interact(Vector3.Distance(pos,ToVector(Session.Level.box))<3,Vector3.Distance(pos,ToVector(Session.Level.exit))<4.5f);
        }
        public void Choose(Facility facility) { if(Session.ChooseFacility(facility)){Resupply();Notify(facility==Facility.Grid?"电网已接通":"炮台已启动");} }
        public void Choose(Upgrade upgrade) { if(Session.ChooseUpgrade(upgrade)){Resupply();if(upgrade==Upgrade.Shock)Player.Weapon.Grenades=Mathf.Min(3,Player.Weapon.Grenades+1);} }
        void Resupply() { Time.timeScale=1; Player.Vitals.Heal(18);Player.Weapon.Primary.Supply(Player.Weapon.Primary.Definition.supply);Cursor.lockState=Application.isMobilePlatform?CursorLockMode.None:CursorLockMode.Locked;Cursor.visible=Application.isMobilePlatform; }
        public void BossPhaseChanged() { Player.Vitals.Heal(25);Player.Weapon.Primary.Supply(Player.Weapon.Primary.Definition.supply*2);RefreshPickups();Hazard.ClearAll();Notify("护甲重组 · 新阶段，注意随从"); }
        void RefreshPickups(bool ammoOnly=false) { foreach(var p in FindObjectsByType<SupplyPickup>(FindObjectsSortMode.None))if(!ammoOnly||p.IsAmmo)p.Refresh(); }
        void TickFacilities(float dt)
        {
            if(!Session.Combat||Session.Facility==Facility.None)return;facilityClock-=dt;if(facilityClock>0)return;
            var l=Session.Level;
            if(Session.Facility==Facility.Grid)
            { facilityClock=2.8f;foreach(var e in Enemies.ToArray())if(e!=null&&l.grid.Contains(e.transform.position.x,e.transform.position.z)){e.Slow(2.6f,.45f);e.Damage(32,DamageSource.Facility,false);} }
            else
            {
                facilityClock=.25f;if(turretAmmo<=0)return;var origin=ToVector(l.turret)+Vector3.up*1.3f;EnemyActor target=null;float nearest=22;
                foreach(var e in Enemies){if(e==null)continue;Vector3 delta=e.AimPoint-origin;float dist=delta.magnitude;if(dist<nearest&&Vector3.Dot(delta.normalized,Vector3.back)>.64f&&e.VisibleFrom(origin)){nearest=dist;target=e;}}
                if(target!=null){turretAmmo--;target.Damage(target.Kind==EnemyKind.Armor?5.76f:24,DamageSource.Facility,false);VisualFactory.Tracer(origin,target.AimPoint,Color.cyan);}
            }
        }
        public void ApplyQuality(int value)
        { Quality=Mathf.Clamp(value,0,2);QualitySettings.SetQualityLevel(Quality,true);var pipeline=Resources.Load<UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset>("Settings/Quality"+Quality);if(pipeline!=null)QualitySettings.renderPipeline=pipeline;QualitySettings.shadows=Quality==0?ShadowQuality.Disable:ShadowQuality.All;QualitySettings.shadowDistance=Quality==0?0:Quality==1?35:60;Application.targetFrameRate=Quality==0?30:60; }
        public static Vector3 ToVector(Point p) { return new Vector3(p.x,p.y,p.z); }
        public string Objective
        {
            get
            {
                if(Session==null)return "选择关卡";switch(Session.Stage){case Stage.Briefing:return "熟悉操作 · 接通电力后撤离";case Stage.Wave:return "清除第 "+Session.Wave+" 波 · 剩余 "+Session.Remaining;case Stage.FacilityTravel:return "前往供电控制台 · 按 E 交互";case Stage.BossIntro:return Session.Level.bossName+"正在进入战场";case Stage.Boss:return "击败"+Session.Level.bossName+" · 留意技能预警";case Stage.ExitTravel:return Session.StageTime<6?"补给并准备撤离":"前往绿色通道 · 按 E 启动";case Stage.Extraction:return "守住 "+Mathf.CeilToInt(Session.GateRemaining)+" 秒";case Stage.Escape:return "出口已开启 · 进入绿色区域";default:return "";}
            }
        }
        public void ResetResultFlag() { resultRecorded=false; }
    }
}
