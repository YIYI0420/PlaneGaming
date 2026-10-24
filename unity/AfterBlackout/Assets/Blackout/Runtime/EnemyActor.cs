using UnityEngine;
using UnityEngine.AI;
using AfterBlackout.Core;

namespace AfterBlackout
{
    public sealed class EnemyActor : MonoBehaviour
    {
        public EnemyKind Kind;public bool Dead;public bool IsBoss { get { return Kind==EnemyKind.Boss; } }
        public Vector3 AimPoint { get { return transform.position+Vector3.up*(IsBoss?2.3f:1.15f); } }
        public NavMeshAgent Agent;public Transform Model;public Renderer CoreGlow;public Animator Animator;
        GameRoot root;float health,speed,cooldown=.6f,windup,slow,slowFactor=1,skillTimer=2.5f,skillRemaining;int skillIndex,lastPhase=1;
        string skill="";Vector3 rushDirection,lockedPoint;bool rushHit;int chain;GameObject marker;
        public string Warning
        {
            get
            { if(!IsBoss)return "";var b=root.Session.Boss;if(b.Transition>0)return "护甲重组 · 注意随从";if(b.Exposed>0)return "弱点暴露 "+b.Exposed.ToString("0.0")+" 秒 · 集火头部";if(skill=="charge")return chain>0?"二次冲撞 · 再次横向躲避":"冲撞锁定 · 横向躲避，引诱撞墙";if(skill=="slam")return "震地蓄力 · 跳跃或离开圆圈";if(skill=="toxic")return "毒液落点 · 离开黄色预警";return "护甲防守 · 等待技能后弱点 / 重击破势"; }
        }
        public void Initialize(GameRoot game,EnemyKind kind)
        {
            root=game;Kind=kind;health=kind==EnemyKind.Walker?85:kind==EnemyKind.Runner?60:kind==EnemyKind.Armor?220:game.Session.Level.bossHp;speed=kind==EnemyKind.Runner?2.65f:kind==EnemyKind.Armor?.9f:kind==EnemyKind.Boss?1.55f:1.4f;
            gameObject.layer=8;var body=gameObject.AddComponent<CapsuleCollider>();body.radius=IsBoss?.72f:.3f;body.height=IsBoss?2.9f:1.45f;body.center=Vector3.up*(IsBoss?1.55f:.78f);gameObject.AddComponent<HitZone>().Owner=this;
            var head=new GameObject("HeadHitbox");head.layer=9;head.transform.SetParent(transform,false);head.transform.localPosition=Vector3.up*(IsBoss?3.5f:kind==EnemyKind.Runner?1.27f:kind==EnemyKind.Armor?1.88f:1.65f);var headCollider=head.AddComponent<SphereCollider>();headCollider.radius=IsBoss?.42f:.23f;var zone=head.AddComponent<HitZone>();zone.Owner=this;zone.Head=true;
            Model=VisualFactory.Actor(transform,kind,game.Session.Level.bossColor,ref CoreGlow);Animator=Model.GetComponentInChildren<Animator>();
            NavMeshHit hit;if(NavMesh.SamplePosition(transform.position,out hit,4,NavMesh.AllAreas))transform.position=hit.position;
            Agent=gameObject.AddComponent<NavMeshAgent>();Agent.radius=IsBoss?.72f:.31f;Agent.height=IsBoss?3.8f:1.8f;Agent.speed=speed;Agent.acceleration=18;Agent.angularSpeed=300;Agent.stoppingDistance=IsBoss?2.1f:1.1f;
            Agent.avoidancePriority=IsBoss?20:Random.Range(30,70);if(!Agent.isOnNavMesh)Debug.LogWarning("Enemy has no baked NavMesh at "+transform.position);
        }
        public void Freeze() { if(Agent!=null&&Agent.isOnNavMesh)Agent.isStopped=true; }
        void Update()
        {
            if(Dead||root==null||root.Menu||root.Session.Frozen||root.Player==null){Freeze();return;}
            float dt=Time.deltaTime;cooldown-=dt;slow=Mathf.Max(0,slow-dt);if(Agent.isOnNavMesh)Agent.speed=speed*(slow>0?slowFactor:1);
            if(IsBoss){UpdateBoss(dt);return;}
            float distance=Vector3.Distance(transform.position,root.Player.transform.position);
            if(distance<1.55f&&VisibleFrom(root.Player.View.transform.position))
            { Freeze();FacePlayer();if(windup>0){windup-=dt;if(windup<=0){if(distance<1.7f)root.Player.Hurt(Kind==EnemyKind.Armor?16:Kind==EnemyKind.Runner?9:8);cooldown=Kind==EnemyKind.Runner?1.05f:1.4f;}}else if(cooldown<=0){windup=.42f;if(Animator!=null)Animator.SetTrigger("Attack");} }
            else{windup=0;Chase();}
            if(Animator!=null)Animator.SetFloat("Speed",Agent.isOnNavMesh?Agent.velocity.magnitude:0);
            else Model.localRotation=Quaternion.Euler(Mathf.Sin(Time.time*7)*1.5f,0,Mathf.Sin(Time.time*3)*1.2f);
        }
        void FacePlayer() { Vector3 d=root.Player.transform.position-transform.position;d.y=0;if(d.sqrMagnitude>.01f)transform.rotation=Quaternion.LookRotation(d); }
        void Chase() { if(Agent.isOnNavMesh){Agent.isStopped=false;Agent.SetDestination(root.Player.transform.position);} }
        public bool VisibleFrom(Vector3 origin)
        { Vector3 delta=AimPoint-origin;return !Physics.Raycast(origin,delta.normalized,delta.magnitude-.1f,1<<0,QueryTriggerInteraction.Ignore); }
        public void Slow(float seconds,float factor) { slow=Mathf.Max(slow,seconds);slowFactor=factor; }
        public void Damage(float amount,DamageSource source,bool head,bool axe=false)
        {
            if(Dead||root.Session.Frozen)return;
            if(IsBoss)
            {
                if(root.Session.Stage!=Stage.Boss)return;var hit=root.Session.Boss.Hit(amount,source,head,axe);health=root.Session.Boss.Health;
                if(hit.PhaseChanged){CancelSkill();root.BossPhaseChanged();skillTimer=1;}else if(hit.Staggered){CancelSkill();skillTimer=3.4f;root.Notify("重击破势 · 弱点暴露 3 秒");}
            }
            else health-=amount;
            if(health>0)return;Dead=true;CancelSkill();Freeze();foreach(var c in GetComponentsInChildren<Collider>())c.enabled=false;
            if(IsBoss)Hazard.ClearAll();
            root.Died(this,source,head);if(Agent!=null)Agent.enabled=false;if(Animator!=null)Animator.SetTrigger("Death");else Model.localRotation=Quaternion.Euler(80,0,0);Destroy(gameObject,Animator!=null?5:2.5f);
        }
        void CancelSkill() { skill="";if(marker!=null)Destroy(marker); }
        void UpdateBoss(float dt)
        {
            if(Animator!=null)Animator.SetFloat("Speed",Agent.isOnNavMesh?Agent.velocity.magnitude:0);
            var state=root.Session.Boss;
            if(CoreGlow!=null){Color color=state.Exposed>0?new Color(.3f,1,.55f):state.Phase==3?Color.red:new Color(1,.45f,.1f);CoreGlow.material.SetColor("_EmissionColor",color*2);}
            if(root.Session.Stage!=Stage.Boss||state.Transition>0||state.Stun>0){Freeze();return;}
            if(lastPhase!=state.Phase){lastPhase=state.Phase;speed=state.Phase==3?2:1.7f;}
            if(skill.Length>0){TickSkill(dt);return;}
            skillTimer-=dt;if(skillTimer<=0){string[] pattern=root.Session.Level.bossSkills;string next=pattern[skillIndex++%pattern.Length];if(next=="slam"&&Vector3.Distance(transform.position,root.Player.transform.position)>8)next="toxic";BeginSkill(next);return;}
            if(state.Exposed>0){Freeze();return;}
            if(Vector3.Distance(transform.position,root.Player.transform.position)<2.5f)
            { Freeze();FacePlayer();if(windup>0){windup-=dt;if(windup<=0){if(Vector3.Distance(transform.position,root.Player.transform.position)<2.8f&&VisibleFrom(root.Player.View.transform.position))root.Player.Hurt(22);cooldown=1.7f;}}else if(cooldown<=0)windup=.65f; }
            else Chase();
        }
        void BeginSkill(string type,bool second=false)
        {
            if(Animator!=null)Animator.SetTrigger("Attack");
            Freeze();FacePlayer();CancelSkill();skill=type;chain=second?1:0;lockedPoint=transform.position;rushDirection=(root.Player.transform.position-transform.position).normalized;rushDirection.y=0;
            skillRemaining=type=="slam"?(root.Session.Boss.Phase==3?1:1.2f):type=="charge"?(second?.7f:root.Session.Boss.Phase==3?.8f:1.05f):1;
            if(type=="slam")marker=VisualFactory.WarningCircle(transform.position,5.5f,new Color(1,.4f,.12f,.25f));
            if(type=="charge")marker=VisualFactory.WarningLane(transform.position,rushDirection,18);
            if(type=="toxic")for(int i=0;i<root.Session.Boss.Phase+2+root.Session.Level.toxicExtra;i++)
            { var p=root.Player.transform.position+(i==0?Vector3.zero:new Vector3(Mathf.Cos(i*2.4f),0,Mathf.Sin(i*2.4f))*2.3f);Hazard.Create(root,p,1.8f,1.65f,5,false); }
            CombatAudio.Play("warning");root.Notify(Warning);
        }
        void TickSkill(float dt)
        {
            skillRemaining-=dt;
            if(skill=="rush")
            {
                float step=(root.Session.Boss.Phase==3?10.2f:9)*dt;RaycastHit hit;
                if(Physics.SphereCast(transform.position+Vector3.up*.85f,.73f,rushDirection,out hit,step+.08f,1<<0,QueryTriggerInteraction.Ignore))
                { CancelSkill();root.Session.Boss.OpenWindow(true);skillTimer=5.5f;root.Notify("冲撞撞墙！弱点暴露 3 秒");return; }
                if(Agent.isOnNavMesh)Agent.Move(rushDirection*step);
                if(!rushHit&&Vector3.Distance(transform.position,root.Player.transform.position)<1.8f){root.Player.Hurt(30);rushHit=true;}
            }
            if(skillRemaining>0)return;
            if(skill=="charge"){skill="rush";rushHit=false;skillRemaining=1.65f;return;}
            if(skill=="rush"&&root.Session.Boss.Phase>=2&&chain==0){BeginSkill("charge",true);return;}
            if(skill=="slam")
            {
                if(Vector3.Distance(transform.position,root.Player.transform.position)<5.5f&&!root.Player.Airborne&&VisibleFrom(root.Player.View.transform.position))root.Player.Hurt(28);
                if(root.Session.Boss.Phase>=root.Session.Level.shockPhase)Hazard.Create(root,transform.position,root.Session.Boss.Phase==3?9:8,.65f,2,true);CombatAudio.Play("explosion");
            }
            CancelSkill();root.Session.Boss.OpenWindow(false);skillTimer=root.Session.Boss.Exposed+(root.Session.Boss.Phase==3?1.7f:2.7f)*root.Session.Level.skillRate;
        }
    }

}
