using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using AfterBlackout.Core;

namespace AfterBlackout
{
    public sealed class SupplyPickup : MonoBehaviour
    {
        public bool IsAmmo;bool taken;public void Refresh(){taken=false;foreach(var r in GetComponentsInChildren<Renderer>())r.enabled=true;}
        void Update(){var root=GameRoot.Instance;if(taken||root==null||root.Menu||root.Player==null||root.Session.Frozen)return;if(Vector3.Distance(transform.position,root.Player.transform.position+Vector3.up*.3f)>1.3f)return;
            if(IsAmmo){if(root.Player.Weapon.Primary.Reserve>=root.Player.Weapon.Primary.Definition.cap)return;root.Player.Weapon.Primary.Supply(root.Player.Weapon.Primary.Definition.supply);}else{if(root.Player.Vitals.Health>=100)return;root.Player.Vitals.Heal(30);}taken=true;foreach(var r in GetComponentsInChildren<Renderer>())r.enabled=false;CombatAudio.Play("pickup");}
    }
}
