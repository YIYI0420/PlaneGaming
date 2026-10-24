using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering.Universal;
using AfterBlackout.Core;

namespace AfterBlackout
{
    public sealed class GrenadeProjectile : MonoBehaviour
    {
        GameRoot root;float fuse=1.4f;public void Initialize(GameRoot game){root=game;}
        void Update()
        {
            if(root==null||root.Menu||root.Session.Frozen)return;fuse-=Time.deltaTime;if(fuse>0)return;
            var point=transform.position;foreach(var e in root.Enemies.ToArray())if(e!=null){float d=Vector3.Distance(point,e.transform.position);if(d<5&&e.VisibleFrom(point+Vector3.up*.3f)){e.Damage(150*(1-d/6),DamageSource.Grenade,false);if(root.Session.Upgrade==Upgrade.Shock)e.Slow(4,.4f);}}
            VisualFactory.Impact(point,Vector3.up,false);CombatAudio.Play("explosion");Destroy(gameObject);
        }
    }
}
