using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace AfterBlackout
{
    // All optic variants share a receiver mount, but only the selected variant is visible.
    public static class OpticPresentation
    {
        static readonly Dictionary<string,Mesh> tubes=new Dictionary<string,Mesh>();
        public static Transform Select(GameObject weapon,string optic,bool pistol)
        {
            var mount=weapon.transform.Find("OpticAssembly");if(mount==null)return null;
            var red=mount.Find("RedDotSight");
            if(red==null)
            {
                red=new GameObject("RedDotSight").transform;red.SetParent(mount,false);
                var children=new List<Transform>();foreach(Transform child in mount)if(child!=red)children.Add(child);
                foreach(var child in children)child.SetParent(red,false);
                if(!pistol){BuildScope(mount,"x4",false);BuildScope(mount,"x8",true);}
            }
            string selected=pistol?"red":optic;
            red.gameObject.SetActive(selected=="red");
            foreach(string id in new[]{"x4","x8"}){var scope=mount.Find(id);if(scope!=null)scope.gameObject.SetActive(selected==id);}
            VisualFactory.SetLayer(mount.gameObject,10);
            return selected=="red"?red.Find("RedDot"):mount.Find(selected+"/AimPoint");
        }
        static void Box(Transform parent,string name,Vector3 at,Vector3 size,Material material)
        {VisualFactory.Part(parent,name,PrimitiveType.Cube,at,size,material);}
        static void BuildScope(Transform parent,string id,bool eight)
        {
            var group=new GameObject(id).transform;group.SetParent(parent,false);
            var steel=VisualFactory.Material("#253035",.75f,.32f);var rubber=VisualFactory.Material("#10191c",.1f,.2f);
            Box(group,"OpticBase",new Vector3(0,.006f,0),new Vector3(.074f,.016f,.105f),steel);
            float height=.065f,length=eight?.28f:.17f,radius=eight?.024f:.027f;
            foreach(float z in new[]{-.038f,.038f})
            {
                Box(group,"ScopeSupport",new Vector3(0,.025f,z),new Vector3(.046f,.03f,.019f),steel);
                Tube(group,"MountRing",new Vector3(0,height,z),radius+.006f,radius-.001f,.018f,steel);
            }
            Tube(group,"ScopeTube",new Vector3(0,height,0),radius,radius-.004f,length,steel);
            Tube(group,"Eyepiece",new Vector3(0,height,-length*.5f),.033f,.027f,.038f,rubber);
            Tube(group,"Objective",new Vector3(0,height,length*.5f),eight?.039f:.034f,eight?.032f:.027f,eight?.065f:.035f,steel);
            Box(group,"ElevationTurret",new Vector3(0,height+.032f,0),new Vector3(.025f,.024f,.028f),rubber);
            Box(group,"WindageTurret",new Vector3(.032f,height,0),new Vector3(.024f,.025f,.028f),rubber);
            if(eight)Tube(group,"ZoomRing",new Vector3(0,height,-.095f),.029f,.024f,.036f,rubber);
            var centre=new GameObject("AimPoint").transform;centre.SetParent(group,false);centre.localPosition=new Vector3(0,height,0);
        }
        static void Tube(Transform parent,string name,Vector3 position,float outer,float inner,float length,Material material)
        {
            string key=outer+"/"+inner+"/"+length;Mesh mesh;
            if(!tubes.TryGetValue(key,out mesh))
            {
                const int sides=32;var vertices=new Vector3[sides*4];var indices=new List<int>();
                for(int i=0;i<sides;i++)
                {
                    float a=i*Mathf.PI*2/sides;var direction=new Vector3(Mathf.Cos(a),Mathf.Sin(a),0);
                    vertices[i*4]=direction*outer+Vector3.back*length*.5f;vertices[i*4+1]=direction*outer+Vector3.forward*length*.5f;
                    vertices[i*4+2]=direction*inner+Vector3.back*length*.5f;vertices[i*4+3]=direction*inner+Vector3.forward*length*.5f;
                    int next=(i+1)%sides;
                    Quad(indices,i*4,next*4,next*4+1,i*4+1);Quad(indices,i*4+3,next*4+3,next*4+2,i*4+2);
                    Quad(indices,i*4+2,next*4+2,next*4,i*4);Quad(indices,i*4+1,next*4+1,next*4+3,i*4+3);
                }
                mesh=new Mesh{name="Hollow optic tube"};mesh.vertices=vertices;mesh.triangles=indices.ToArray();mesh.RecalculateNormals();mesh.RecalculateBounds();tubes[key]=mesh;
            }
            var obj=new GameObject(name,typeof(MeshFilter),typeof(MeshRenderer));obj.transform.SetParent(parent,false);obj.transform.localPosition=position;
            obj.GetComponent<MeshFilter>().sharedMesh=mesh;var renderer=obj.GetComponent<MeshRenderer>();renderer.sharedMaterial=material;renderer.shadowCastingMode=ShadowCastingMode.Off;
        }
        static void Quad(List<int> indices,int a,int b,int c,int d){indices.AddRange(new[]{a,b,c,a,c,d});}
    }
}
