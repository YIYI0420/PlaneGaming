using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using AfterBlackout.Core;

namespace AfterBlackout
{
    public sealed class ViewArms : MonoBehaviour
    {
        Transform wrist;string id;GameObject support;readonly Transform[] arms=new Transform[2];
        public void Initialize(Transform root,string blade,GameObject hand)
        { wrist=root;id=blade;support=hand;for(int i=0;i<2;i++)arms[i]=VisualFactory.Part(root.parent,"Sleeve",PrimitiveType.Capsule,Vector3.zero,Vector3.one,VisualFactory.Material("#283d36",0,.1f)).transform; }
        void LateUpdate()
        {
            if(GameRoot.Instance==null||GameRoot.Instance.Player==null)return;var action=GameRoot.Instance.Player.Weapon.Action;bool two=id=="katana"||id=="axe"&&action!=null&&action.Heavy;support.SetActive(two);
            for(int i=0;i<2;i++){arms[i].gameObject.SetActive(i==0||two);Vector3 hand=wrist.TransformPoint(i==0?new Vector3(0,0,.06f):new Vector3(-.02f,-.17f,.06f));Vector3 elbow=wrist.parent.TransformPoint(new Vector3(i==0?.6f:-.5f,-.65f,.15f));arms[i].position=(hand+elbow)*.5f;arms[i].rotation=Quaternion.FromToRotation(Vector3.up,elbow-hand);arms[i].localScale=new Vector3(.1f,Vector3.Distance(hand,elbow)*.5f,.11f);VisualFactory.SetLayer(arms[i].gameObject,10);}
        }
        void OnDestroy() { foreach(var arm in arms)if(arm!=null)Destroy(arm.gameObject); }
    }
}
