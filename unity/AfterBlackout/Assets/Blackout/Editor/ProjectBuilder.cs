using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.SceneManagement;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using AfterBlackout.Core;

namespace AfterBlackout.Editor
{
    [InitializeOnLoad]
    public static class ProjectBuilder
    {
        const string Generated="Assets/Blackout/Generated";
        const string Scenes="Assets/Blackout/Scenes";
        static ProjectBuilder(){EditorApplication.delayCall+=FirstImport;}
        static void FirstImport()
        {
            if(EditorApplication.isCompiling||EditorApplication.isUpdating){EditorApplication.delayCall+=FirstImport;return;}
            if(!File.Exists(Scenes+"/Boot.unity")&&!Application.isBatchMode)Generate();
        }
        [MenuItem("After Blackout/Generate project scenes and URP settings")]
        public static void Generate()
        {
            Directory.CreateDirectory(Generated+"/Materials");Directory.CreateDirectory(Generated+"/Navigation");Directory.CreateDirectory("Assets/Blackout/Resources/Settings");Directory.CreateDirectory(Scenes);AssetDatabase.Refresh();
            ConfigureLayers();ConfigurePlayer();CreatePipelines();CreateArtSet();CreateSkies();ArtUpgrade.Generate();
            var catalog=JsonUtility.FromJson<Catalog>(Resources.Load<TextAsset>("BlackoutCatalog").text);var buildScenes=new List<EditorBuildSettingsScene>();
            var boot=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);new GameObject("AfterBlackout").AddComponent<GameRoot>();EditorSceneManager.SaveScene(boot,Scenes+"/Boot.unity");buildScenes.Add(new EditorBuildSettingsScene(Scenes+"/Boot.unity",true));
            foreach(var chapter in catalog.chapters)
            {
                var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);WorldBuilder.Build(chapter);BakeNavigation(chapter);PersistSceneAssets(scene,chapter.index);
                string path=Scenes+"/"+chapter.SceneName+".unity";EditorSceneManager.SaveScene(scene,path);buildScenes.Add(new EditorBuildSettingsScene(path,true));
            }
            EditorBuildSettings.scenes=buildScenes.ToArray();AssetDatabase.SaveAssets();EditorSceneManager.OpenScene(Scenes+"/Boot.unity");Debug.Log("AfterBlackout: URP, materials, Boot and three baked chapter scenes generated.");
        }
        static void ConfigureLayers()
        {
            var tags=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/TagManager.asset")[0]);var layers=tags.FindProperty("layers");foreach(var pair in new[]{new KeyValuePair<int,string>(8,"Enemy"),new KeyValuePair<int,string>(9,"Head"),new KeyValuePair<int,string>(10,"ViewModel"),new KeyValuePair<int,string>(11,"Player")})layers.GetArrayElementAtIndex(pair.Key).stringValue=pair.Value;tags.ApplyModifiedPropertiesWithoutUndo();
            Physics.IgnoreLayerCollision(10,0,true);Physics.IgnoreLayerCollision(10,11,true);
        }
        static void ConfigurePlayer()
        {
            PlayerSettings.companyName="ORBIT";PlayerSettings.productName="After the Blackout";PlayerSettings.defaultInterfaceOrientation=UIOrientation.LandscapeLeft;PlayerSettings.colorSpace=ColorSpace.Linear;PlayerSettings.runInBackground=false;
            PlayerSettings.SetApiCompatibilityLevel(UnityEditor.Build.NamedBuildTarget.Standalone,ApiCompatibilityLevel.NET_Standard);
            PlayerSettings.WebGL.compressionFormat=WebGLCompressionFormat.Gzip;PlayerSettings.WebGL.decompressionFallback=true;PlayerSettings.WebGL.dataCaching=true;PlayerSettings.WebGL.exceptionSupport=WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;
            PlayerSettings.WebGL.template="PROJECT:Blackout";PlayerSettings.WebGL.nameFilesAsHashes=true;
            var settings=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset")[0]);var handler=settings.FindProperty("activeInputHandler");if(handler!=null)handler.intValue=0;settings.ApplyModifiedPropertiesWithoutUndo();
        }
        static void CreatePipelines()
        {
            string dataPath=Generated+"/ForwardRenderer.asset";var renderer=AssetDatabase.LoadAssetAtPath<UniversalRendererData>(dataPath);
            if(renderer==null){renderer=ScriptableObject.CreateInstance<UniversalRendererData>();AssetDatabase.CreateAsset(renderer,dataPath);}
            renderer.postProcessData=AssetDatabase.LoadAssetAtPath<PostProcessData>("Packages/com.unity.render-pipelines.universal/Runtime/Data/PostProcessData.asset");EditorUtility.SetDirty(renderer);
            UniversalRenderPipelineAsset standard=null;
            for(int i=0;i<3;i++)
            {
                string path="Assets/Blackout/Resources/Settings/Quality"+i+".asset";var asset=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(path);
                if(asset==null){asset=UniversalRenderPipelineAsset.Create(renderer);AssetDatabase.CreateAsset(asset,path);}asset.renderScale=i==0?.8f:1;asset.msaaSampleCount=i==0?2:4;asset.shadowDistance=i==0?0:i==1?35:60;asset.supportsHDR=i>0;asset.mainLightShadowmapResolution=i==2?2048:1024;EditorUtility.SetDirty(asset);if(i==1)standard=asset;
            }
            GraphicsSettings.defaultRenderPipeline=standard;QualitySettings.renderPipeline=standard;
        }
        static void CreateArtSet()
        {
            const string path="Assets/Blackout/Resources/ArtSet.asset";var art=AssetDatabase.LoadAssetAtPath<ArtSet>(path);if(art==null){art=ScriptableObject.CreateInstance<ArtSet>();AssetDatabase.CreateAsset(art,path);}
            art.concrete=ConcreteMaterial("Concrete",new Color(.8f,.82f,.8f),.2f);
            art.asphalt=ConcreteMaterial("Asphalt",new Color(.22f,.25f,.26f),.13f);
            if(art.metal==null){art.metal=new Material(Shader.Find("Universal Render Pipeline/Lit"));art.metal.SetColor("_BaseColor",new Color(.29f,.36f,.37f));art.metal.SetFloat("_Metallic",.75f);art.metal.SetFloat("_Smoothness",.4f);AssetDatabase.CreateAsset(art.metal,Generated+"/Materials/Metal.mat");}
            // Keep the runtime warning shader in player builds as well as the main Lit shader.
            const string warningPath="Assets/Blackout/Resources/Settings/Warning.mat";
            var warning=AssetDatabase.LoadAssetAtPath<Material>(warningPath);bool createWarning=warning==null;
            if(createWarning)warning=new Material(Shader.Find("Universal Render Pipeline/Unlit"));
            warning.SetFloat("_Surface",1);warning.SetFloat("_SrcBlend",(float)BlendMode.SrcAlpha);warning.SetFloat("_DstBlend",(float)BlendMode.OneMinusSrcAlpha);warning.SetFloat("_ZWrite",0);warning.SetFloat("_Cull",0);warning.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");warning.renderQueue=3000;
            if(createWarning)AssetDatabase.CreateAsset(warning,warningPath);else EditorUtility.SetDirty(warning);
            EditorUtility.SetDirty(art);AssetDatabase.SaveAssets();
        }
        static void CreateSkies()
        {
            for(int i=0;i<3;i++)
            {
                string path="Assets/Blackout/Resources/Settings/Sky"+i+".mat";var sky=AssetDatabase.LoadAssetAtPath<Material>(path);bool create=sky==null;
                if(create)sky=new Material(Shader.Find("Skybox/Procedural"));
                sky.SetColor("_SkyTint",i==1?new Color(.16f,.21f,.29f):i==2?new Color(.42f,.35f,.29f):new Color(.47f,.49f,.48f));
                sky.SetColor("_GroundColor",new Color(.12f,.14f,.16f));sky.SetFloat("_Exposure",i==1?.45f:.8f);sky.SetFloat("_AtmosphereThickness",i==1?1.4f:1.15f);sky.SetFloat("_SunDisk",0);sky.SetFloat("_SunSize",.02f);
                if(create)AssetDatabase.CreateAsset(sky,path);else EditorUtility.SetDirty(sky);
            }
        }
        static Material ConcreteMaterial(string name,Color tint,float smoothness)
        {
            string path=Generated+"/Materials/"+name+".mat";var material=AssetDatabase.LoadAssetAtPath<Material>(path);bool create=material==null;
            if(create)material=new Material(Shader.Find("Universal Render Pipeline/Lit"));material.SetColor("_BaseColor",tint);material.SetFloat("_Smoothness",smoothness);material.SetTextureScale("_BaseMap",Vector2.one*4);
            const string source="Assets/Blackout/Art/Concrete/Concrete030_1K-JPG_";
            var color=AssetDatabase.LoadAssetAtPath<Texture2D>(source+"Color.jpg");var normal=AssetDatabase.LoadAssetAtPath<Texture2D>(source+"NormalGL.jpg");var ao=AssetDatabase.LoadAssetAtPath<Texture2D>(source+"AmbientOcclusion.jpg");
            if(color!=null)material.SetTexture("_BaseMap",color);if(normal!=null){material.SetTexture("_BumpMap",normal);material.EnableKeyword("_NORMALMAP");material.SetFloat("_BumpScale",.65f);}if(ao!=null){material.SetTexture("_OcclusionMap",ao);material.SetFloat("_OcclusionStrength",.65f);}
            var packed=PackedSmoothness(source+"Roughness.jpg");if(packed!=null){material.SetTexture("_MetallicGlossMap",packed);material.EnableKeyword("_METALLICSPECGLOSSMAP");material.SetFloat("_Smoothness",.65f);}
            if(create)AssetDatabase.CreateAsset(material,path);else EditorUtility.SetDirty(material);return material;
        }
        static Texture2D PackedSmoothness(string roughnessPath)
        {
            string output=Generated+"/ConcreteSmoothness.png";var existing=AssetDatabase.LoadAssetAtPath<Texture2D>(output);if(existing!=null)return existing;
            if(!File.Exists(roughnessPath))return null;var image=new Texture2D(2,2,TextureFormat.RGBA32,false,true);ImageConversion.LoadImage(image,File.ReadAllBytes(roughnessPath));
            var pixels=image.GetPixels32();for(int i=0;i<pixels.Length;i++)pixels[i]=new Color32(0,0,0,(byte)(255-pixels[i].r));image.SetPixels32(pixels);image.Apply();File.WriteAllBytes(output,image.EncodeToPNG());UnityEngine.Object.DestroyImmediate(image);
            AssetDatabase.ImportAsset(output);var importer=(TextureImporter)AssetImporter.GetAtPath(output);importer.sRGBTexture=false;importer.alphaSource=TextureImporterAlphaSource.FromInput;importer.maxTextureSize=1024;importer.SaveAndReimport();return AssetDatabase.LoadAssetAtPath<Texture2D>(output);
        }
        static void BakeNavigation(Chapter chapter)
        {
            var sources=new List<NavMeshBuildSource>();NavMeshBuilder.CollectSources(null,1<<0,NavMeshCollectGeometry.PhysicsColliders,0,new List<NavMeshBuildMarkup>(),sources);
            var settings=NavMesh.GetSettingsByID(0);if(settings.agentTypeID<0)settings=NavMesh.CreateSettings();settings.agentRadius=.45f;settings.agentHeight=1.8f;settings.agentClimb=.35f;settings.agentSlope=46;
            var bounds=new Bounds(new Vector3((chapter.bounds.x1+chapter.bounds.x2)/2,4,(chapter.bounds.z1+chapter.bounds.z2)/2),new Vector3(chapter.bounds.x2-chapter.bounds.x1+8,20,chapter.bounds.z2-chapter.bounds.z1+8));
            var data=NavMeshBuilder.BuildNavMeshData(settings,sources,bounds,Vector3.zero,Quaternion.identity);if(data==null)throw new Exception("NavMesh bake failed for "+chapter.id);
            string path=Generated+"/Navigation/"+chapter.id+".asset";var old=AssetDatabase.LoadAssetAtPath<NavMeshData>(path);if(old!=null){EditorUtility.CopySerialized(data,old);UnityEngine.Object.DestroyImmediate(data);data=old;EditorUtility.SetDirty(old);}else AssetDatabase.CreateAsset(data,path);
            var component=UnityEngine.Object.FindFirstObjectByType<LevelNavigation>();component.Data=data;EditorUtility.SetDirty(component);
            // Sample targets beside their solid console/case; height matters on the reactor mezzanine.
            var instance=NavMesh.AddNavMeshData(data);foreach(var target in new[]{chapter.spawn,chapter.box,chapter.exit}){NavMeshHit hit;Vector3 at=GameRoot.ToVector(target);if(!NavMesh.SamplePosition(at,out hit,3,NavMesh.AllAreas))throw new Exception("Unreachable navigation target in "+chapter.id+": "+at);}instance.Remove();
        }
        static void PersistSceneAssets(Scene scene,int index)
        {
            foreach(var renderer in UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include))foreach(var material in renderer.sharedMaterials)
                if(material!=null&&!AssetDatabase.Contains(material))AssetDatabase.CreateAsset(material,AssetDatabase.GenerateUniqueAssetPath(Generated+"/Materials/Scene"+index+"_"+material.name.Replace('/','_')+".mat"));
            foreach(var volume in UnityEngine.Object.FindObjectsByType<Volume>(FindObjectsSortMode.None))if(volume.sharedProfile!=null&&!AssetDatabase.Contains(volume.sharedProfile))
            { var profile=volume.sharedProfile;string path=AssetDatabase.GenerateUniqueAssetPath(Generated+"/Chapter"+index+"Volume.asset");AssetDatabase.CreateAsset(profile,path);foreach(var component in profile.components)if(!AssetDatabase.Contains(component))AssetDatabase.AddObjectToAsset(component,profile);EditorUtility.SetDirty(profile);}
        }
        [MenuItem("After Blackout/Build Web for GitHub Pages")]
        public static void BuildWeb()
        {
            if(!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.WebGL,BuildTarget.WebGL))throw new Exception("Web Build Support is missing. Unity Hub > Installs > 6000.6.7f1 > Add modules > Web Build Support.");
            ConfigurePlayer();AssetDatabase.Refresh();EnsureGenerated();string output=Path.GetFullPath(Path.Combine(Application.dataPath,"../../../unity-game"));Directory.CreateDirectory(output);
            var options=new BuildPlayerOptions {scenes=EnabledScenes(),locationPathName=output,target=BuildTarget.WebGL,options=BuildOptions.None};var report=BuildPipeline.BuildPlayer(options);
            if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Unity Web build failed: "+report.summary.result);
            File.WriteAllText(Path.Combine(output,".nojekyll"),"");File.WriteAllText(Path.Combine(output,"build-info.json"),"{\"engine\":\"Unity "+Application.unityVersion+"\",\"pipeline\":\"URP\",\"chapters\":3}");Debug.Log("Unity Web build ready: "+output);
        }
        [MenuItem("After Blackout/Build Windows player")]
        public static void BuildWindows()
        { EnsureGenerated();Directory.CreateDirectory("Builds/Windows");var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=EnabledScenes(),locationPathName="Builds/Windows/AfterBlackout.exe",target=BuildTarget.StandaloneWindows64});if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Windows build failed"); }
        static void EnsureGenerated(){if(!File.Exists(Scenes+"/Boot.unity")||!File.Exists(Scenes+"/Chapter03.unity"))Generate();}
        static string[] EnabledScenes(){var list=new List<string>();foreach(var scene in EditorBuildSettings.scenes)if(scene.enabled)list.Add(scene.path);return list.ToArray();}
    }
    public sealed class PbrTextureImporter : AssetPostprocessor
    {
        void OnPreprocessTexture()
        { if(!assetPath.StartsWith("Assets/Blackout/Art/"))return;var importer=(TextureImporter)assetImporter;importer.maxTextureSize=1024;importer.textureCompression=TextureImporterCompression.Compressed;importer.mipmapEnabled=true;
            string lower=assetPath.ToLowerInvariant();
            if(lower.Contains("normal")){importer.textureType=TextureImporterType.NormalMap;importer.sRGBTexture=false;}else if(lower.Contains("ambientocclusion")||lower.Contains("roughness")||lower.Contains("metallic")||lower.Contains("metalness")||lower.Contains("especular"))importer.sRGBTexture=false; }
    }
}
