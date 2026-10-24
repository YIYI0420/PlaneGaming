using UnityEngine;
using UnityEngine.AI;
using AfterBlackout.Core;

namespace AfterBlackout
{
    public sealed class Hazard : MonoBehaviour
    {
        static readonly System.Collections.Generic.List<Hazard> active=new System.Collections.Generic.List<Hazard>();
        GameRoot root;float radius,warning,life,tick,travel;bool shock,hit;GameObject visual;
        public static void Create(GameRoot game,Vector3 position,float radius,float warning,float life,bool shock)
        {
            var obj=new GameObject(shock?"Shockwave":"ToxicPool");obj.transform.position=position;var h=obj.AddComponent<Hazard>();h.root=game;h.radius=radius;h.warning=warning;h.life=life;h.shock=shock;h.visual=VisualFactory.WarningCircle(position,radius,new Color(1,.7f,.2f,.3f));h.visual.transform.SetParent(obj.transform,true);active.Add(h);
            if(active.Count>12&&active[0]!=null)Destroy(active[0].gameObject);
        }
        public static void ClearAll() { foreach(var h in active.ToArray())if(h!=null)Destroy(h.gameObject);active.Clear(); }
        void OnDestroy() { active.Remove(this); }
        void Update()
        {
            if(root==null||root.Menu||root.Session.Frozen)return;float dt=Time.deltaTime;if(warning>0){warning-=dt;return;}life-=dt;if(life<=0){Destroy(gameObject);return;}
            if(shock){float before=travel;travel+=7*dt;visual.transform.localScale=new Vector3(travel*2,.025f,travel*2);float d=Vector3.Distance(root.Player.transform.position,transform.position);if(!hit&&d>=before-.7f&&d<=travel+.7f&&!root.Player.Airborne&&Clear()){root.Player.Hurt(18);hit=true;}if(travel>=radius)Destroy(gameObject);}
            else{tick-=dt;if(tick<=0){tick=.8f;if(Vector3.Distance(root.Player.transform.position,transform.position)<radius&&!root.Player.Airborne)root.Player.Hurt(9);}}
        }
        bool Clear() { var d=root.Player.View.transform.position-transform.position;return !Physics.Raycast(transform.position+Vector3.up*.5f,d.normalized,d.magnitude-.1f,1<<0); }
    }
}
