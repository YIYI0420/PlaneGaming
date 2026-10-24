using System;

namespace AfterBlackout.Core
{
    public sealed class GunState
    {
        public readonly GunDefinition Definition; public int Ammo,Reserve; public float Cooldown,ReloadRemaining,ReloadDuration;
        public bool Reloading { get { return ReloadRemaining>0; } }
        public GunState(GunDefinition definition) { Definition=definition;Ammo=definition.mag;Reserve=definition.reserve; }
        public bool Fire()
        { if(Cooldown>0||Reloading||Ammo<=0)return false;Ammo--;Cooldown=Definition.interval;return true; }
        public bool Reload(bool fast)
        { if(Reloading||Ammo>=Definition.mag||Reserve==0)return false;ReloadDuration=Definition.reload*(fast?.65f:1);ReloadRemaining=ReloadDuration;return true; }
        public void Tick(float dt)
        {
            Cooldown=Math.Max(0,Cooldown-dt);if(!Reloading)return;
            ReloadRemaining=Math.Max(0,ReloadRemaining-dt);if(ReloadRemaining>0)return;
            int needed=Definition.mag-Ammo,amount=Reserve<0?needed:Math.Min(needed,Reserve);Ammo+=amount;if(Reserve>=0)Reserve-=amount;
        }
        public void Supply(int amount) { if(Reserve>=0)Reserve=Math.Min(Definition.cap,Reserve+amount); }
        public void Fill() { Ammo=Definition.mag;Reserve=Definition.cap<0?-1:Definition.cap;ReloadRemaining=Cooldown=0; }
        public void CancelReload() { ReloadRemaining=0; }
    }
    public sealed class Vitals
    {
        public float Health=100,Stamina=100,Recovery,HitCooldown; public bool Exhausted,Sprinting;
        public bool Hurt(float amount) { if(HitCooldown>0||Health<=0)return false;Health=Math.Max(0,Health-amount);HitCooldown=.22f;return true; }
        public void Heal(float amount) { Health=Math.Min(100,Health+amount); }
        public bool SpendHeavy(float duration)
        { if(Stamina<18)return false;Stamina-=18;Recovery=duration+.35f;Sprinting=false;return true; }
        public void Tick(float dt,bool sprint,bool moving,bool attacking,bool aiming)
        {
            HitCooldown=Math.Max(0,HitCooldown-dt);Recovery=Math.Max(0,Recovery-dt);
            if(Exhausted&&Stamina>=25)Exhausted=false;
            Sprinting=sprint&&moving&&!attacking&&!aiming&&!Exhausted&&Stamina>0;
            if(Sprinting){Stamina=Math.Max(0,Stamina-20*dt);Recovery=.8f;if(Stamina<=0){Exhausted=true;Sprinting=false;}}
            else if(Recovery<=0)Stamina=Math.Min(100,Stamina+24*dt);
        }
    }
    public sealed class MeleeAction
    {
        public readonly AttackDefinition Definition; public readonly bool Heavy; public readonly int Combo;
        public float Elapsed { get; private set; } public bool HitDone { get; private set; }
        public bool Complete { get { return Elapsed>=Definition.duration; } }
        public MeleeAction(AttackDefinition definition,bool heavy,int combo) { Definition=definition;Heavy=heavy;Combo=combo; }
        public bool Tick(float dt)
        {
            Elapsed=Math.Min(Definition.duration,Elapsed+Math.Max(0,dt));
            if(!HitDone&&Elapsed>=Definition.Contact){HitDone=true;return true;}return false;
        }
    }
    public struct BossHit { public float Damage; public bool PhaseChanged,Staggered,Killed; }
    public sealed class BossBattle
    {
        public readonly float MaximumHealth; public float Health,Exposed,Transition,Stun,Stagger; public int Phase=1;
        public bool Dead { get { return Health<=0; } }
        public BossBattle(float health) { Health=MaximumHealth=health; }
        public void Tick(float dt) { Exposed=Math.Max(0,Exposed-dt);Transition=Math.Max(0,Transition-dt);Stun=Math.Max(0,Stun-dt); }
        public void OpenWindow(bool wall)
        { Exposed=wall?3:Phase==3?1.5f:2;Stun=wall?.7f:0; }
        public BossHit Hit(float baseDamage,DamageSource source,bool head,bool axe=false)
        {
            var hit=new BossHit();if(Dead||Transition>0)return hit;
            float multiplier;
            if(source==DamageSource.Bullet)multiplier=Exposed>0?(head?2.4f:1):(head?1:.4f);
            else if(source==DamageSource.Heavy)multiplier=Exposed>0?2:1.2f;
            else if(source==DamageSource.Light)multiplier=Exposed>0?1.5f:.75f;
            else if(source==DamageSource.Grenade)multiplier=Exposed>0?1.2f:.55f;
            else multiplier=Exposed>0?.9f:.45f;
            float floor=Phase<3?MaximumHealth*(3-Phase)/3:0;
            hit.Damage=Math.Max(0,Math.Min(baseDamage*multiplier,Health-floor));Health-=hit.Damage;
            if(source==DamageSource.Heavy||source==DamageSource.Light)
            {
                Stagger+=source==DamageSource.Light?4:axe?35:26;
                if(Stagger>=100){Stagger=0;Exposed=3;Stun=1.4f;hit.Staggered=true;}
            }
            if(Health>0&&Phase<3&&Health<=floor+.001f)
            { Phase++;Transition=1.2f;Stagger=Exposed=Stun=0;hit.PhaseChanged=true; }
            hit.Killed=Dead;return hit;
        }
    }
}
