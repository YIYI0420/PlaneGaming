using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using AfterBlackout.Core;

namespace AfterBlackout
{
    public sealed class WorldSignals : MonoBehaviour
    {
        public Transform Gate,Power;public Collider GateCollider;public GameObject ExitGlow,GridEffect,Turret;public Vector3 Closed;
        void Update(){var root=GameRoot.Instance;if(root==null||root.Menu||root.Session==null)return;bool open=root.Session.GateOpen;if(GateCollider!=null)GateCollider.enabled=!open;Gate.position=Vector3.Lerp(Gate.position,Closed+(open?Vector3.up*4:Vector3.zero),Time.deltaTime*3);ExitGlow.SetActive(open);
            if(GridEffect!=null)GridEffect.SetActive(root.Session.Facility==Facility.Grid);
            if(Turret!=null)Turret.SetActive(root.Session.Facility==Facility.Turret);
        }
    }
}
