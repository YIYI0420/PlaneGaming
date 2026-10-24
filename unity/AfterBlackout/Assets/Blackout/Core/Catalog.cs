using System;

namespace AfterBlackout.Core
{
    [Serializable] public class Point { public float x, y, z; }
    [Serializable] public class Rect { public float x1, x2, z1, z2; public bool Contains(float x,float z) { return x>=x1&&x<=x2&&z>=z1&&z<=z2; } }
    [Serializable] public class Obstacle : Rect { public string id; public float height; }
    [Serializable] public class Pickup : Point { public int id; public string type; }
    [Serializable] public class Wave { public int walkers,runners,armor; public int Total { get { return walkers+runners+armor; } } }
    [Serializable] public class Palette { public string top,horizon,fog,sun,ground; }
    [Serializable] public class Chapter
    {
        public int index; public string id,name,subtitle,story,bossName,bossColor;
        public Obstacle[] obstacles; public Point box,turret,exit,spawn,bossSpawn; public Point[] portals;
        public Pickup[] pickups; public Rect grid,gate,bounds; public Wave[] waves;
        public float bossHp,skillRate,evacSeconds; public int toxicExtra,shockPhase; public string[] bossSkills; public Palette palette;
        public string SceneName { get { return "Chapter0"+(index+1); } }
    }
    [Serializable] public class GunDefinition
    {
        public string id,name,shortName; public int mag,reserve,supply,cap; public float damage,interval,reload,recoil,spread;
    }
    [Serializable] public class AttackDefinition
    { public float duration,windup,active,damage,range,angle; public int cleave; public float Contact { get { return windup+active*.5f; } } }
    [Serializable] public class MeleeDefinition
    { public string id,name,color,desc; public float damage,range,backstab,armor; public AttackDefinition light,heavy; }
    [Serializable] public class Catalog
    {
        public GunDefinition[] guns; public MeleeDefinition[] melee; public Chapter[] chapters;
        public GunDefinition Gun(string id) { foreach(var item in guns)if(item.id==id)return item;return guns[0]; }
        public MeleeDefinition Blade(string id) { foreach(var item in melee)if(item.id==id)return item;return melee[0]; }
        public Chapter Level(int index) { return chapters[Math.Max(0,Math.Min(chapters.Length-1,index))]; }
    }
    public enum Stage { Briefing,Wave,FacilityTravel,FacilityChoice,UpgradeChoice,BossIntro,Boss,ExitTravel,Extraction,Escape,Won,Lost }
    public enum EnemyKind { Walker,Runner,Armor,Boss }
    public enum DamageSource { Bullet,Light,Heavy,Grenade,Facility }
    public enum Facility { None,Grid,Turret }
    public enum Upgrade { None,Pierce,Reload,Shock }
    [Serializable] public class Loadout
    { public string primary="m4",optic="red",melee="combat"; public Loadout Copy() { return new Loadout {primary=primary,optic=optic,melee=melee}; } }
}
