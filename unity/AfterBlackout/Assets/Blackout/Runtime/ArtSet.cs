using UnityEngine;
namespace AfterBlackout
{
    [CreateAssetMenu(menuName="After Blackout/Art Set")]
    public sealed class ArtSet : ScriptableObject
    {
        [Header("Optional licensed prefabs, authored at 1 Unity unit = 1 metre")]
        public GameObject walker,runner,armor,boss,bus,container,transformer;
        public GameObject m4,ak,awm,pistol,combat,karambit,machete,katana,axe;
        public Material concrete,metal,asphalt,brick,wood;
        public GameObject Actor(AfterBlackout.Core.EnemyKind kind)
        { return kind==Core.EnemyKind.Boss?boss:kind==Core.EnemyKind.Armor?armor:kind==Core.EnemyKind.Runner?runner:walker; }
        public GameObject Weapon(string id)
        { switch(id){case "m4":return m4;case "ak":return ak;case "awm":return awm;case "pistol":return pistol;case "combat":return combat;case "karambit":return karambit;case "machete":return machete;case "katana":return katana;case "axe":return axe;default:return null;} }
    }
}
