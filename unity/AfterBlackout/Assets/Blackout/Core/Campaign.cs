using System;
using System.Collections.Generic;

namespace AfterBlackout.Core
{
    [Serializable] public sealed class Result
    { public bool won,training;public int chapter,kills,headshots,facilityKills,meleeKills,shots,hits;public float seconds; }
    public sealed class Campaign
    {
        public readonly Chapter Level; public readonly Loadout Loadout; public readonly bool Training;
        public Stage Stage { get; private set; } public Facility Facility { get; private set; } public Upgrade Upgrade { get; private set; }
        public bool Paused;public float Time,StageTime,GateRemaining;public int Wave,Alive,TotalKills,Headshots,FacilityKills,MeleeKills,Shots,Hits;
        public int Remaining { get { return Alive+queue.Count; } }
        public bool Frozen { get { return Paused||Stage==Stage.FacilityChoice||Stage==Stage.UpgradeChoice||Stage==Stage.Won||Stage==Stage.Lost; } }
        public bool Combat { get { return Stage==Stage.Wave||Stage==Stage.Boss||Stage==Stage.Extraction||Stage==Stage.Escape; } }
        public BossBattle Boss { get; private set; } public Result Result { get; private set; }
        public int PendingAdds { get; private set; } public bool GateOpen { get { return Stage==Stage.Escape||Stage==Stage.Won; } }
        readonly Queue<EnemyKind> queue=new Queue<EnemyKind>();float spawnTimer;
        public Campaign(Chapter level,Loadout loadout,bool training=false)
        { Level=level;Loadout=loadout.Copy();Training=training;GateRemaining=level.evacSeconds;SetStage(training?Stage.BossIntro:Stage.Briefing);if(training)Boss=new BossBattle(level.bossHp); }
        void SetStage(Stage stage) { Stage=stage;StageTime=0; }
        public void SkipBriefing() { if(Stage==Stage.Briefing)StartWave(1); }
        void StartWave(int wave)
        {
            Wave=wave;queue.Clear();Alive=0;var def=Level.waves[wave-1];int w=def.walkers,r=def.runners,a=def.armor;
            while(w+r+a>0){for(int i=0;i<3&&w>0;i++,w--)queue.Enqueue(EnemyKind.Walker);if(r-->0)queue.Enqueue(EnemyKind.Runner);else r=0;if(a-->0)queue.Enqueue(EnemyKind.Armor);else a=0;}
            spawnTimer=.5f;SetStage(Stage.Wave);
        }
        public void Tick(float dt)
        {
            if(Frozen||dt<=0)return;Time+=dt;StageTime+=dt;spawnTimer-=dt;
            if(Stage==Stage.Briefing&&StageTime>=15)StartWave(1);
            if(Stage==Stage.Wave&&queue.Count==0&&Alive==0)
            { if(Wave==1)SetStage(Stage.FacilityTravel);else if(Wave==2)SetStage(Stage.UpgradeChoice);else{Boss=new BossBattle(Level.bossHp);SetStage(Stage.BossIntro);} }
            if(Stage==Stage.BossIntro&&StageTime>=3)SetStage(Stage.Boss);
            if(Stage==Stage.Boss)
            {
                bool regroup=Boss.Transition>0;Boss.Tick(dt);if(regroup&&Boss.Transition<=0)PendingAdds+=2;
                if(Boss.Dead){if(Training)Finish(true);else SetStage(Stage.ExitTravel);}
            }
            if(Stage==Stage.Extraction){GateRemaining=Math.Max(0,GateRemaining-dt);if(GateRemaining<=0)SetStage(Stage.Escape);}
        }
        public bool TrySpawn(out EnemyKind kind)
        {
            kind=EnemyKind.Walker;if(Frozen||Stage!=Stage.Wave||queue.Count==0||Alive>=8||spawnTimer>0)return false;
            kind=queue.Dequeue();Alive++;spawnTimer=Wave==1?3.4f:Wave==2?2.2f:2.1f;return true;
        }
        public int TakeAdds() { int count=PendingAdds;PendingAdds=0;return count; }
        public void Kill(EnemyKind kind,DamageSource source,bool head)
        {
            if(Stage==Stage.Wave)Alive=Math.Max(0,Alive-1);TotalKills++;if(head)Headshots++;
            if(source==DamageSource.Facility)FacilityKills++;if(source==DamageSource.Light||source==DamageSource.Heavy)MeleeKills++;
        }
        public bool Interact(bool nearPower,bool nearExit)
        {
            if(Frozen)return false;if(Stage==Stage.FacilityTravel&&nearPower){SetStage(Stage.FacilityChoice);return true;}
            if(Stage==Stage.ExitTravel&&StageTime>=6&&nearExit){GateRemaining=Level.evacSeconds;SetStage(Stage.Extraction);return true;}return false;
        }
        public bool ChooseFacility(Facility facility)
        { if(Stage!=Stage.FacilityChoice||facility==Facility.None||Facility!=Facility.None)return false;Facility=facility;StartWave(2);return true; }
        public bool ChooseUpgrade(Upgrade upgrade)
        { if(Stage!=Stage.UpgradeChoice||upgrade==Upgrade.None||Upgrade!=Upgrade.None)return false;Upgrade=upgrade;StartWave(3);return true; }
        public void Exit(bool nearExit) { if(!Frozen&&Stage==Stage.Escape&&nearExit)Finish(true); }
        public void Finish(bool won)
        {
            if(Stage==Stage.Won||Stage==Stage.Lost)return;SetStage(won?Stage.Won:Stage.Lost);
            Result=new Result {won=won,training=Training,chapter=Level.index,kills=TotalKills,headshots=Headshots,facilityKills=FacilityKills,meleeKills=MeleeKills,shots=Shots,hits=Hits,seconds=Time};
        }
        public Campaign Next(Catalog catalog)
        { return Stage==Stage.Won&&!Training&&Level.index<catalog.chapters.Length-1?new Campaign(catalog.Level(Level.index+1),Loadout):null; }
    }
}
