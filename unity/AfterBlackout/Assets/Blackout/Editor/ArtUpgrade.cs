using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;
using UnityEngine.Rendering;

namespace AfterBlackout.Editor
{
    public static class ArtUpgrade
    {
        const string Generated="Assets/Blackout/Generated/Art";
        const string Weapons="Assets/Blackout/Art/Weapons/";
        public static void Generate()
        {
            Directory.CreateDirectory(Generated);AssetDatabase.Refresh();
            var art=Resources.Load<ArtSet>("ArtSet");
            art.asphalt=Surface("Asphalt012",new Color(.75f,.78f,.8f));art.brick=Surface("Bricks052",Color.white);art.metal=Surface("MetalPlates006",new Color(.65f,.72f,.76f));art.wood=Surface("Wood051",new Color(.65f,.5f,.35f));
            var skin=Pbr("ZombieSkin","Assets/Blackout/Art/Zombie/difusse.jpg","Assets/Blackout/Art/Zombie/normal.JPG",null,null,new Color(.85f,.9f,.84f));skin.SetFloat("_Smoothness",.23f);EditorUtility.SetDirty(skin);
            var control=ZombieController();
            art.walker=Zombie("Walker",1.8f,skin,control,false,false);
            art.runner=Zombie("Runner",1.45f,skin,control,false,false);
            art.armor=Zombie("Armored",2.02f,skin,control,true,false);
            art.boss=Zombie("Brute",3.8f,skin,control,true,true);
            art.m4=Gun("m4",Weapons+"M4A1/M4A1.fbx",.84f);
            art.ak=Gun("ak",Weapons+"ak47.fbx",.88f);
            art.awm=Gun("awm",Weapons+"awm.fbx",1.1f);
            art.pistol=Gun("pistol",Weapons+"m1911.fbx",.24f);
            art.combat=Knife("combat");art.karambit=Knife("karambit");art.machete=Knife("machete");art.katana=Knife("katana");art.axe=Knife("axe");
            EditorUtility.SetDirty(art);AssetDatabase.SaveAssets();Debug.Log("ART_UPGRADE: textured skeletal enemies, 4 weapon prefabs, 5 forged blades and 4 PBR environment surfaces generated.");
        }
        static Material Surface(string id,Color tint)
        {
            string prefix="Assets/Blackout/Art/Surfaces/"+id+"/"+id+"_1K-JPG_";
            var material=Pbr(id,prefix+"Color.jpg",prefix+"NormalGL.jpg",prefix+"Roughness.jpg",prefix+"Metalness.jpg",tint);material.SetTextureScale("_BaseMap",Vector2.one*3);
            var ao=AssetDatabase.LoadAssetAtPath<Texture2D>(prefix+"AmbientOcclusion.jpg");if(ao!=null){material.SetTexture("_OcclusionMap",ao);material.SetFloat("_OcclusionStrength",.6f);}EditorUtility.SetDirty(material);return material;
        }
        static Material Pbr(string id,string colorPath,string normalPath,string roughnessPath,string metallicPath,Color tint)
        {
            string path=Generated+"/"+id+".mat";var material=AssetDatabase.LoadAssetAtPath<Material>(path);bool create=material==null;if(create)material=new Material(Shader.Find("Universal Render Pipeline/Lit"));
            material.SetColor("_BaseColor",tint);material.SetFloat("_Smoothness",.32f);
            if(colorPath!=null)material.SetTexture("_BaseMap",AssetDatabase.LoadAssetAtPath<Texture2D>(colorPath));
            var normal=normalPath==null?null:AssetDatabase.LoadAssetAtPath<Texture2D>(normalPath);if(normal!=null){material.SetTexture("_BumpMap",normal);material.EnableKeyword("_NORMALMAP");material.SetFloat("_BumpScale",.55f);}
            if(roughnessPath!=null&&File.Exists(roughnessPath))
            {
                string mapPath=Generated+"/"+id+"_MetalSmooth.png";var packed=AssetDatabase.LoadAssetAtPath<Texture2D>(mapPath);
                if(packed==null)
                {
                    var rough=new Texture2D(2,2,TextureFormat.RGBA32,false,true);ImageConversion.LoadImage(rough,File.ReadAllBytes(roughnessPath));var pixels=rough.GetPixels32();
                    Texture2D metal=null;if(metallicPath!=null&&File.Exists(metallicPath)){metal=new Texture2D(2,2,TextureFormat.RGBA32,false,true);ImageConversion.LoadImage(metal,File.ReadAllBytes(metallicPath));}
                    for(int y=0;y<rough.height;y++)for(int x=0;x<rough.width;x++){int i=y*rough.width+x;byte value=metal==null?(byte)0:(byte)(metal.GetPixelBilinear((float)x/rough.width,(float)y/rough.height).r*255);pixels[i]=new Color32(value,0,0,(byte)(255-pixels[i].r));}
                    rough.SetPixels32(pixels);rough.Apply();File.WriteAllBytes(mapPath,rough.EncodeToPNG());Object.DestroyImmediate(rough);if(metal!=null)Object.DestroyImmediate(metal);AssetDatabase.ImportAsset(mapPath);
                    var importer=(TextureImporter)AssetImporter.GetAtPath(mapPath);importer.sRGBTexture=false;importer.alphaSource=TextureImporterAlphaSource.FromInput;importer.maxTextureSize=1024;importer.SaveAndReimport();packed=AssetDatabase.LoadAssetAtPath<Texture2D>(mapPath);
                }
                material.SetTexture("_MetallicGlossMap",packed);material.EnableKeyword("_METALLICSPECGLOSSMAP");material.SetFloat("_Smoothness",.75f);
            }
            if(create)AssetDatabase.CreateAsset(material,path);else EditorUtility.SetDirty(material);return material;
        }
        static Material Finish(string name,Color color,float metal=.7f,float smooth=.32f)
        {
            var material=Pbr("Finish_"+name,null,null,null,null,color);material.SetFloat("_Metallic",metal);material.SetFloat("_Smoothness",smooth);EditorUtility.SetDirty(material);return material;
        }
        static AnimationClip Clip(string name,bool loop)
        {
            string path="Assets/Blackout/Art/Zombie/"+name+".FBX";var importer=(ModelImporter)AssetImporter.GetAtPath(path);var clips=importer.defaultClipAnimations;
            if(clips.Length>0){foreach(var c in clips){c.loopTime=loop;c.loopPose=loop;c.lockRootPositionXZ=true;c.lockRootRotation=true;c.keepOriginalPositionXZ=true;}importer.clipAnimations=clips;importer.SaveAndReimport();}
            return AssetDatabase.LoadAllAssetsAtPath(path).OfType<AnimationClip>().First(c=>!c.name.StartsWith("__preview__"));
        }
        static AnimatorController ZombieController()
        {
            string path=Generated+"/Zombie.controller";var existing=AssetDatabase.LoadAssetAtPath<AnimatorController>(path);if(existing!=null)return existing;
            var controller=AnimatorController.CreateAnimatorControllerAtPath(path);controller.AddParameter("Speed",AnimatorControllerParameterType.Float);controller.AddParameter("Attack",AnimatorControllerParameterType.Trigger);controller.AddParameter("Death",AnimatorControllerParameterType.Trigger);
            var machine=controller.layers[0].stateMachine;var walk=Clip("walk",true);var idle=machine.AddState("Idle");idle.motion=walk;idle.speed=0;var move=machine.AddState("Walk");move.motion=walk;
            var attack=machine.AddState("Attack");attack.motion=Clip("fury",false);attack.speed=2;var death=machine.AddState("Death");death.motion=Clip("dead",false);machine.defaultState=idle;
            var toMove=idle.AddTransition(move);toMove.hasExitTime=false;toMove.duration=.12f;toMove.AddCondition(AnimatorConditionMode.Greater,.12f,"Speed");
            var toIdle=move.AddTransition(idle);toIdle.hasExitTime=false;toIdle.duration=.12f;toIdle.AddCondition(AnimatorConditionMode.Less,.1f,"Speed");
            var dying=machine.AddAnyStateTransition(death);dying.hasExitTime=false;dying.duration=.08f;dying.canTransitionToSelf=false;dying.AddCondition(AnimatorConditionMode.If,0,"Death");
            var striking=machine.AddAnyStateTransition(attack);striking.hasExitTime=false;striking.duration=.07f;striking.canTransitionToSelf=false;striking.AddCondition(AnimatorConditionMode.If,0,"Attack");
            var recover=attack.AddTransition(idle);recover.hasExitTime=true;recover.exitTime=.96f;recover.duration=.1f;return controller;
        }
        static Bounds BoundsOf(GameObject obj)
        {var renderers=obj.GetComponentsInChildren<Renderer>();var bounds=renderers[0].bounds;foreach(var r in renderers)bounds.Encapsulate(r.bounds);return bounds;}
        static GameObject Zombie(string id,float height,Material skin,AnimatorController controller,bool armored,bool boss)
        {
            var root=new GameObject(id);var source=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Blackout/Art/Zombie/walk.FBX");var model=Object.Instantiate(source,root.transform);model.name="SkeletalZombie";
            model.transform.localRotation=Quaternion.Euler(0,-90,0);var bounds=BoundsOf(model);float scale=height/bounds.size.y;model.transform.localScale*=scale;bounds=BoundsOf(model);model.transform.localPosition-=new Vector3(bounds.center.x,bounds.min.y,bounds.center.z);
            foreach(var renderer in model.GetComponentsInChildren<Renderer>()){renderer.sharedMaterials=renderer.sharedMaterials.Select(m=>skin).ToArray();renderer.shadowCastingMode=ShadowCastingMode.On;}
            var animator=model.GetComponent<Animator>();if(animator==null)animator=model.AddComponent<Animator>();animator.runtimeAnimatorController=controller;animator.applyRootMotion=false;
            if(id=="Runner")animator.speed=1.65f;
            if(armored)
            {
                float s=height/1.8f;var armor=Finish(boss?"BruteArmor":"Armor",boss?new Color(.24f,.18f,.13f):new Color(.20f,.25f,.24f),.65f,.23f);
                Part(root.transform,"ChestPlate",new Vector3(0,1.2f*s,.14f*s),new Vector3(.52f,.46f,.16f)*s,armor);
                for(int side=-1;side<=1;side+=2)Part(root.transform,"ShoulderPlate",new Vector3(side*.32f*s,1.38f*s,0),new Vector3(.23f,.23f,.28f)*s,armor);
                if(boss){var glow=Finish("BossCore",new Color(.8f,.32f,.07f),.3f,.5f);glow.EnableKeyword("_EMISSION");glow.SetColor("_EmissionColor",new Color(1,.4f,.06f)*2);Part(root.transform,"Core",new Vector3(0,1.23f*s,.25f*s),Vector3.one*.11f*s,glow,PrimitiveType.Sphere);}
                var spine=model.GetComponentsInChildren<Transform>().FirstOrDefault(t=>t.name.ToLowerInvariant().Contains("spine"));
                if(spine!=null)foreach(var part in root.GetComponentsInChildren<Transform>().Where(t=>t.parent==root.transform&&t!=model.transform).ToArray())part.SetParent(spine,true);
            }
            return Save(root,id);
        }
        static GameObject Gun(string id,string path,float length)
        {
            var root=new GameObject("View_"+id);var source=AssetDatabase.LoadAssetAtPath<GameObject>(path);if(source==null)throw new System.Exception("Missing weapon model: "+path);
            var model=Object.Instantiate(source,root.transform);model.name="Mesh";var bounds=BoundsOf(model);
            if(bounds.size.x>bounds.size.z)model.transform.localRotation=Quaternion.Euler(0,90,0);
            if(id=="m4"||id=="ak")model.transform.localRotation*=Quaternion.Euler(0,180,0);
            if(id=="awm")model.transform.localRotation=Quaternion.Euler(0,180,0);
            bounds=BoundsOf(model);model.transform.localScale*=length/Mathf.Max(.01f,bounds.size.z);bounds=BoundsOf(model);model.transform.localPosition+=new Vector3(-bounds.center.x,-bounds.max.y+.085f,-bounds.center.z+.12f);
            Material m4=null;if(id=="m4")m4=Pbr("M4A1",Weapons+"M4A1/M4A1_Base_Color.png",Weapons+"M4A1/M4A1_Normal.png",Weapons+"M4A1/M4A1_Roughness.png",Weapons+"M4A1/M4A1_Metallic.png",Color.white);
            foreach(var renderer in model.GetComponentsInChildren<Renderer>())renderer.sharedMaterials=renderer.sharedMaterials.Select(m=>m4!=null?m4:ConvertMaterial(m)).ToArray();
            Sight(root.transform);Hands(root.transform,id);return Save(root,"Weapon_"+id);
        }
        static Material ConvertMaterial(Material source)
        {
            string name=source==null?"Steel":source.name.Replace('/','_');Color tint=source!=null&&source.HasProperty("_Color")?source.GetColor("_Color"):new Color(.18f,.2f,.21f);string lower=name.ToLowerInvariant();
            bool rubber=lower.Contains("rubber")||lower.Contains("grip"),polymer=lower.Contains("polymer"),edge=lower.Contains("brushed");
            if(lower.StartsWith("material")){
                bool wood=tint.r>tint.b*1.3f&&tint.g>tint.b*1.3f;
                if(wood)return Finish("WalnutFurniture",new Color(.24f,.11f,.045f),0,.23f);
                return Finish("SmallArmsSteel",new Color(.14f,.17f,.18f),.78f,.34f);
            }
            if(tint.maxColorComponent<.025f)tint=new Color(.13f,.15f,.16f);return Finish(name,tint,polymer||rubber?0:.8f,rubber?.15f:edge?.52f:.32f);
        }
        static GameObject Knife(string id)
        {
            var root=new GameObject("View_"+id);var source=AssetDatabase.LoadAssetAtPath<GameObject>(Weapons+id+".fbx");var model=Object.Instantiate(source,root.transform);model.name="ForgedMesh";
            foreach(var r in model.GetComponentsInChildren<Renderer>())r.sharedMaterials=r.sharedMaterials.Select(ConvertMaterial).ToArray();
            if(id=="combat"||id=="karambit"){model.transform.localRotation=Quaternion.Euler(0,0,180);model.transform.localPosition=Vector3.down*.1f;}
            Part(root.transform,"RightGlove",new Vector3(0,-.06f,0),new Vector3(.09f,.11f,.07f),Finish("Glove",new Color(.15f,.18f,.14f),0,.18f),PrimitiveType.Capsule);
            var support=Part(root.transform,"SupportGlove",new Vector3(0,-.21f,0),new Vector3(.09f,.11f,.07f),Finish("Glove",new Color(.15f,.18f,.14f),0,.18f),PrimitiveType.Capsule);support.SetActive(id=="katana");return Save(root,"Blade_"+id);
        }
        static void Sight(Transform root)
        {
            var dark=Finish("OpticFrame",new Color(.05f,.06f,.065f),.75f,.3f);
            Part(root,"SightLeft",new Vector3(-.043f,.16f,.08f),new Vector3(.011f,.075f,.04f),dark);Part(root,"SightRight",new Vector3(.043f,.16f,.08f),new Vector3(.011f,.075f,.04f),dark);Part(root,"SightTop",new Vector3(0,.198f,.08f),new Vector3(.096f,.011f,.04f),dark);
            var red=Finish("OpticDot",Color.red,0,.2f);red.EnableKeyword("_EMISSION");red.SetColor("_EmissionColor",Color.red*3);Part(root,"RedDot",new Vector3(0,.16f,.095f),Vector3.one*.0035f,red,PrimitiveType.Sphere);
        }
        static void Hands(Transform root,string id)
        {
            var glove=Finish("Glove",new Color(.15f,.18f,.14f),0,.18f);var sleeve=Finish("Sleeve",new Color(.1f,.15f,.12f),0,.16f);
            foreach(int side in new[]{-1,1})
            {
                var wrist=new Vector3(side*.065f,-.14f,side<0?.30f:-.03f);Part(root,"GlovedPalm",wrist,new Vector3(.08f,.08f,.13f),glove,PrimitiveType.Capsule);
                for(int f=0;f<4;f++)Part(root,"Finger",wrist+new Vector3(side*.038f,.018f,-.04f+f*.024f),new Vector3(.035f,.055f,.021f),glove,PrimitiveType.Capsule);
                var elbow=new Vector3(side*.29f,-.47f,-.26f);var arm=Part(root,"Sleeve",(wrist+elbow)/2,new Vector3(.10f,Vector3.Distance(wrist,elbow)/2,.11f),sleeve,PrimitiveType.Capsule);arm.transform.rotation=Quaternion.FromToRotation(Vector3.up,wrist-elbow);
            }
        }
        static GameObject Part(Transform parent,string name,Vector3 at,Vector3 size,Material material,PrimitiveType shape=PrimitiveType.Cube)
        {var obj=GameObject.CreatePrimitive(shape);obj.name=name;obj.transform.SetParent(parent,false);obj.transform.localPosition=at;obj.transform.localScale=size;Object.DestroyImmediate(obj.GetComponent<Collider>());obj.GetComponent<Renderer>().sharedMaterial=material;
            if(shape==PrimitiveType.Cube){var mesh=AssetDatabase.LoadAllAssetsAtPath(Weapons+"beveled.fbx").OfType<Mesh>().FirstOrDefault();if(mesh!=null){obj.GetComponent<MeshFilter>().sharedMesh=mesh;var s=mesh.bounds.size;obj.transform.localScale=new Vector3(size.x/s.x,size.y/s.y,size.z/s.z);}}return obj;}
        static GameObject Save(GameObject obj,string name)
        {var prefab=PrefabUtility.SaveAsPrefabAsset(obj,Generated+"/"+name+".prefab");Object.DestroyImmediate(obj);return prefab;}
        public static void Inspect()
        {
            foreach(string path in AssetDatabase.FindAssets("t:Model",new[]{"Assets/Blackout/Art"}).Select(AssetDatabase.GUIDToAssetPath))
            {
                var obj=AssetDatabase.LoadAssetAtPath<GameObject>(path);var instance=Object.Instantiate(obj);var renderers=instance.GetComponentsInChildren<Renderer>();
                var bounds=renderers.Length>0?renderers[0].bounds:new Bounds();foreach(var renderer in renderers)bounds.Encapsulate(renderer.bounds);
                Debug.Log("ART_INSPECT "+path+" bounds="+bounds+" clips="+string.Join(",",AssetDatabase.LoadAllAssetsAtPath(path).OfType<AnimationClip>().Select(c=>c.name+":"+c.length.ToString("0.00")))+" materials="+string.Join(",",renderers.SelectMany(r=>r.sharedMaterials).Where(m=>m!=null).Select(m=>m.name)));Object.DestroyImmediate(instance);
            }
        }
    }
}
