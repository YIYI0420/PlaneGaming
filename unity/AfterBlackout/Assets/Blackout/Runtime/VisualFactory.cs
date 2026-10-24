using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using AfterBlackout.Core;

namespace AfterBlackout
{
    public static class VisualFactory
    {
        static readonly Dictionary<string,Material> materials=new Dictionary<string,Material>();
        public static ArtSet Art { get { return Resources.Load<ArtSet>("ArtSet"); } }
        public static Material Material(string color,float metallic=0,float smoothness=.3f,bool glow=false)
        {
            string key=color+metallic+smoothness+glow;Material m;if(materials.TryGetValue(key,out m))return m;
            m=new Material(Shader.Find("Universal Render Pipeline/Lit"));Color c;ColorUtility.TryParseHtmlString(color,out c);m.SetColor("_BaseColor",c);m.SetFloat("_Metallic",metallic);m.SetFloat("_Smoothness",smoothness);
            if(glow){m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",c*2);}materials[key]=m;return m;
        }
        public static GameObject Part(Transform parent,string name,PrimitiveType shape,Vector3 position,Vector3 size,Material material,bool collider=false)
        {
            var obj=GameObject.CreatePrimitive(shape);obj.name=name;obj.transform.SetParent(parent,false);obj.transform.localPosition=position;obj.transform.localScale=size;obj.GetComponent<Renderer>().sharedMaterial=material;
            if(!collider){var c=obj.GetComponent<Collider>();if(Application.isPlaying)Object.Destroy(c);else Object.DestroyImmediate(c);}return obj;
        }
        public static GameObject Weapon(Transform parent,string id,bool melee)
        {
            var prefab=Art==null?null:Art.Weapon(id);if(prefab!=null){var loaded=Object.Instantiate(prefab,parent);if(melee){var support=loaded.transform.Find("SupportGlove");if(support!=null)loaded.AddComponent<ViewArms>().Initialize(parent,id,support.gameObject);}SetLayer(loaded,10);return loaded;}
            var group=new GameObject("Fallback_"+id);group.transform.SetParent(parent,false);
            Material steel=Material("#53636a",.8f,.38f),dark=Material("#172326",.6f,.3f),grip=Material("#263b35",0,.2f),edge=Material("#b5bec0",.9f,.48f);
            System.Action<string,Vector3,Vector3,Material> box=(n,p,s,m)=>Part(group.transform,n,PrimitiveType.Cube,p,s,m);
            if(!melee)
            {
                float length=id=="awm"?.82f:id=="pistol"?.3f:.6f;box("Receiver",new Vector3(0,0,.12f),new Vector3(.085f,.12f,length*.55f),dark);box("Stock",new Vector3(0,-.02f,-.22f),new Vector3(.075f,.14f,.25f),dark);
                var barrel=Part(group.transform,"Barrel",PrimitiveType.Cylinder,new Vector3(0,.025f,length*.66f),new Vector3(.027f,length*.3f,.027f),steel);barrel.transform.localRotation=Quaternion.Euler(90,0,0);
                box("Handguard",new Vector3(0,.01f,length*.39f),new Vector3(.082f,.085f,length*.4f),id=="ak"?Material("#635344",0,.15f):dark);
                box("Magazine",new Vector3(0,-.15f,.12f),new Vector3(.06f,.25f,.09f),steel);box("Grip",new Vector3(0,-.15f,-.02f),new Vector3(.06f,.17f,.075f),grip);
                for(int i=0;i<8;i++){box("Rail",new Vector3(0,.07f,.10f+i*.025f),new Vector3(.09f,.012f,.009f),steel);box("Vent",new Vector3(.044f,.02f,.22f+i*.02f),new Vector3(.007f,.035f,.01f),edge);}
                // Sight aperture is physically centred on the camera ray when ADS offsets Y by -.16.
                box("SightLeft",new Vector3(-.048f,.16f,.08f),new Vector3(.013f,.085f,.045f),dark);box("SightRight",new Vector3(.048f,.16f,.08f),new Vector3(.013f,.085f,.045f),dark);box("SightTop",new Vector3(0,.205f,.08f),new Vector3(.108f,.013f,.045f),dark);
                var dot=Part(group.transform,"RedDot",PrimitiveType.Sphere,new Vector3(0,.16f,.095f),Vector3.one*.0035f,Material("#ff2d14",0,.1f,true));dot.GetComponent<Renderer>().shadowCastingMode=ShadowCastingMode.Off;
            }
            else
            {
                var pivot=new GameObject("Grip").transform;pivot.SetParent(group.transform,false);bool reverse=id=="combat"||id=="karambit";pivot.localPosition=Vector3.up*(reverse?-.1f:.1f);pivot.localRotation=Quaternion.Euler(0,0,reverse?180:0);
                float length=id=="katana"?.65f:id=="machete"?.5f:id=="axe"?.5f:.32f;Part(pivot,"Handle",PrimitiveType.Cylinder,Vector3.down*.08f,new Vector3(.055f,id=="axe"?.2f:.10f,.055f),grip);
                if(id=="axe"){Part(pivot,"Shaft",PrimitiveType.Cylinder,new Vector3(0,.18f,0),new Vector3(.04f,.28f,.04f),Material("#705541"));Part(pivot,"AxeHead",PrimitiveType.Cube,new Vector3(.09f,.46f,0),new Vector3(.28f,.18f,.055f),edge);}
                else if(id=="karambit")
                { for(int i=0;i<9;i++){float a=i/8f*1.6f;var blade=Part(pivot,"CurvedEdge",PrimitiveType.Cube,new Vector3(-.04f+Mathf.Sin(a)*.16f,.03f+Mathf.Cos(a)*.22f,0),new Vector3(.045f,.07f,.014f),edge);blade.transform.localRotation=Quaternion.Euler(0,0,-a*Mathf.Rad2Deg);} }
                else{Part(pivot,"Blade",PrimitiveType.Cube,Vector3.up*(length*.5f),new Vector3(id=="machete"?.09f:.045f,length,.015f),edge);Part(pivot,"Guard",PrimitiveType.Cube,Vector3.zero,new Vector3(.13f,.02f,.065f),steel);}
                Part(group.transform,"RightGlove",PrimitiveType.Cube,Vector3.zero,new Vector3(.11f,.10f,.13f),grip);
                var support=Part(group.transform,"SupportGlove",PrimitiveType.Cube,new Vector3(-.02f,-.17f,0),new Vector3(.11f,.10f,.13f),grip);support.SetActive(id=="katana");group.AddComponent<ViewArms>().Initialize(parent,id,support);
            }
            SetLayer(group,10);return group;
        }
        public static Transform Actor(Transform parent,EnemyKind kind,string bossColor,ref Renderer core)
        {
            GameObject prefab=Art==null?null:Art.Actor(kind);if(prefab!=null){var loaded=Object.Instantiate(prefab,parent);foreach(var r in loaded.GetComponentsInChildren<Renderer>())if(r.name=="Core")core=r;return loaded.transform;}
            var model=new GameObject("Fallback_"+kind).transform;model.SetParent(parent,false);float s=kind==EnemyKind.Boss?2:kind==EnemyKind.Runner?.85f:kind==EnemyKind.Armor?1.08f:1;
            Material skin=Material("#7f8271",0,.16f),cloth=Material(kind==EnemyKind.Boss?bossColor:"#41494a",.08f,.17f);Part(model,"Torso",PrimitiveType.Capsule,new Vector3(0,1.03f*s,0),new Vector3(.5f,.4f,.3f)*s,cloth);Part(model,"Head",PrimitiveType.Sphere,new Vector3(0,1.65f*s,0),new Vector3(.36f,.4f,.35f)*s,skin);
            for(int side=-1;side<=1;side+=2){Part(model,"Leg",PrimitiveType.Capsule,new Vector3(side*.14f*s,.43f*s,0),new Vector3(.18f,.43f,.2f)*s,cloth);Part(model,"Arm",PrimitiveType.Capsule,new Vector3(side*.37f*s,.98f*s,.10f*s),new Vector3(.17f,.4f,.17f)*s,skin);}
            if(kind==EnemyKind.Armor||kind==EnemyKind.Boss)Part(model,"Armor",PrimitiveType.Cube,new Vector3(0,1.12f*s,.17f*s),new Vector3(.5f,.48f,.13f)*s,Material("#475a5c",.55f,.22f));
            if(kind==EnemyKind.Boss)core=Part(model,"Core",PrimitiveType.Sphere,new Vector3(0,1.2f*s,.27f*s),Vector3.one*.22f,Material("#ff8b35",.3f,.6f,true)).GetComponent<Renderer>();return model;
        }
        public static void SetLayer(GameObject obj,int layer) { foreach(var t in obj.GetComponentsInChildren<Transform>(true))t.gameObject.layer=layer; }
        public static GameObject WarningCircle(Vector3 at,float radius,Color color)
        {
            var obj=new GameObject("SkillRadius");obj.transform.position=at+Vector3.up*.035f;obj.transform.localScale=new Vector3(radius*2,.025f,radius*2);
            var vertices=new Vector3[128];var triangles=new int[64*6];for(int i=0;i<64;i++){float a=i*Mathf.PI*2/64;vertices[i*2]=new Vector3(Mathf.Sin(a)*.47f,0,Mathf.Cos(a)*.47f);vertices[i*2+1]=new Vector3(Mathf.Sin(a)*.5f,0,Mathf.Cos(a)*.5f);int n=(i+1)%64;int t=i*6;triangles[t]=i*2;triangles[t+1]=n*2;triangles[t+2]=i*2+1;triangles[t+3]=i*2+1;triangles[t+4]=n*2;triangles[t+5]=n*2+1;}
            var mesh=new Mesh();mesh.vertices=vertices;mesh.triangles=triangles;mesh.RecalculateNormals();obj.AddComponent<MeshFilter>().sharedMesh=mesh;obj.AddComponent<MeshRenderer>().sharedMaterial=WarningMaterial(color);obj.AddComponent<DisposeVisual>();return obj;
        }
        static Material WarningMaterial(Color c)
        { var m=new Material(Shader.Find("Universal Render Pipeline/Unlit"));m.SetColor("_BaseColor",c);m.SetFloat("_Surface",1);m.SetFloat("_SrcBlend",(float)BlendMode.SrcAlpha);m.SetFloat("_DstBlend",(float)BlendMode.OneMinusSrcAlpha);m.SetFloat("_ZWrite",0);m.SetFloat("_Cull",0);m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");m.renderQueue=3000;return m; }
        public static GameObject WarningLane(Vector3 origin,Vector3 direction,float length)
        { var obj=Part(null,"ChargeWarning",PrimitiveType.Cube,origin+direction*length*.5f+Vector3.up*.03f,new Vector3(2,.025f,length),WarningMaterial(new Color(1,.3f,.1f,.25f)));obj.transform.rotation=Quaternion.LookRotation(direction);obj.AddComponent<DisposeVisual>();return obj; }
        public static void Tracer(Vector3 from,Vector3 to,Color color)
        { var obj=new GameObject("Tracer");var line=obj.AddComponent<LineRenderer>();line.positionCount=2;line.SetPositions(new[]{from,to});line.startWidth=.012f;line.endWidth=.005f;line.sharedMaterial=Material("#ffd28c",0,.2f,true);Object.Destroy(obj,.07f); }
        public static void Impact(Vector3 position,Vector3 normal,bool flesh)
        { var dot=Part(null,"Impact",PrimitiveType.Sphere,position,Vector3.one*(flesh?.08f:.045f),Material(flesh?"#9a493a":"#ffc873",0,.1f,!flesh));Object.Destroy(dot,.15f); }
    }


}
