using NUnit.Framework;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using AfterBlackout.Core;

namespace AfterBlackout.Tests
{
    public sealed class SceneGameTests
    {
        [TestCase(0)] [TestCase(1)] [TestCase(2)]
        public void SavedChapterHasWalkablePowerRouteAndEnemyEntrances(int index)
        {
            var catalog=JsonUtility.FromJson<Catalog>(Resources.Load<TextAsset>("BlackoutCatalog").text);
            var chapter=catalog.Level(index);
            EditorSceneManager.OpenScene("Assets/Blackout/Scenes/"+chapter.SceneName+".unity");
            var navigation=Object.FindAnyObjectByType<LevelNavigation>();Assert.That(navigation,Is.Not.Null);Assert.That(navigation.Data,Is.Not.Null);
            var instance=NavMesh.AddNavMeshData(navigation.Data);
            try
            {
                NavMeshHit origin;Assert.That(NavMesh.SamplePosition(GameRoot.ToVector(chapter.spawn),out origin,2,NavMesh.AllAreas),Is.True);
                foreach(var point in new[]{chapter.box,chapter.bossSpawn})CheckRoute(origin.position,GameRoot.ToVector(point),chapter.id);
                foreach(var point in chapter.portals)CheckRoute(origin.position,GameRoot.ToVector(point),chapter.id);
                var signals=Object.FindAnyObjectByType<WorldSignals>();Assert.That(signals.GateCollider,Is.Not.Null);Assert.That(signals.GridEffect,Is.Not.Null);Assert.That(signals.Turret,Is.Not.Null);
                foreach(var renderer in Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include))foreach(var material in renderer.sharedMaterials)Assert.That(material,Is.Not.Null,"missing saved material on "+renderer.name);
                Assert.That(Object.FindAnyObjectByType<Volume>().sharedProfile.TryGet<Tonemapping>(out var tone),Is.True);
                Assert.That(tone.mode.value,Is.EqualTo(TonemappingMode.ACES));
            }
            finally{instance.Remove();EditorSceneManager.OpenScene("Assets/Blackout/Scenes/Boot.unity");}
        }
        static void CheckRoute(Vector3 origin,Vector3 target,string chapter)
        {
            NavMeshHit end;Assert.That(NavMesh.SamplePosition(target,out end,2.5f,NavMesh.AllAreas),Is.True,chapter+" nav target "+target);
            var path=new NavMeshPath();Assert.That(NavMesh.CalculatePath(origin,end.position,NavMesh.AllAreas,path),Is.True);
            Assert.That(path.status,Is.EqualTo(NavMeshPathStatus.PathComplete),chapter+" disconnected route to "+target);
        }
        [Test] public void BuildScenesAndRenderResourcesArePresent()
        {
            Assert.That(EditorBuildSettings.scenes.Length,Is.EqualTo(4));
            foreach(var entry in EditorBuildSettings.scenes)Assert.That(AssetDatabase.LoadAssetAtPath<SceneAsset>(entry.path),Is.Not.Null);
            for(int i=0;i<3;i++)Assert.That(Resources.Load<UniversalRenderPipelineAsset>("Settings/Quality"+i),Is.Not.Null);
            Assert.That(Resources.Load<Material>("Settings/Warning"),Is.Not.Null);
            Assert.That(Resources.Load<Font>("UI/AfterBlackoutUI"),Is.Not.Null);
            Assert.That(Resources.Load<ArtSet>("ArtSet").concrete.GetTexture("_BumpMap"),Is.Not.Null);
            var art=Resources.Load<ArtSet>("ArtSet");foreach(var prefab in new[]{art.walker,art.runner,art.armor,art.boss}){Assert.That(prefab,Is.Not.Null);Assert.That(prefab.GetComponentInChildren<SkinnedMeshRenderer>(),Is.Not.Null);Assert.That(prefab.GetComponentInChildren<Animator>().runtimeAnimatorController,Is.Not.Null);}
            foreach(var prefab in new[]{art.m4,art.ak,art.awm,art.pistol,art.combat,art.karambit,art.machete,art.katana,art.axe})Assert.That(prefab,Is.Not.Null);
            Assert.That(Resources.Load<Texture2D>("UI/DepotMenu"),Is.Not.Null);
        }
        [TestCase("m4")] [TestCase("ak")] [TestCase("awm")] [TestCase("pistol")]
        public void OpticBaseContactsReceiverInsteadOfFloating(string gun)
        {
            var instance=Object.Instantiate(Resources.Load<ArtSet>("ArtSet").Weapon(gun));
            try
            {
                var mesh=instance.transform.Find("Mesh");foreach(var filter in mesh.GetComponentsInChildren<MeshFilter>())filter.gameObject.AddComponent<MeshCollider>().sharedMesh=filter.sharedMesh;
                Physics.SyncTransforms();var assembly=instance.transform.Find("OpticAssembly");Assert.That(assembly,Is.Not.Null);
                var mount=assembly.Find("OpticBase").GetComponent<Renderer>().bounds;float nearest=float.MaxValue;
                foreach(float z in new[]{-.025f,0,.025f})
                {
                    var origin=assembly.TransformPoint(new Vector3(0,.4f,z));RaycastHit hit;
                    if(Physics.Raycast(origin,Vector3.down,out hit,1,~0,QueryTriggerInteraction.Ignore)&&hit.collider.transform.IsChildOf(mesh))nearest=Mathf.Min(nearest,mount.min.y-hit.point.y);
                }
                Assert.That(nearest,Is.InRange(-.012f,.004f),gun+" optic base must touch the actual receiver surface");
            }
            finally{Object.DestroyImmediate(instance);}
        }
    }
}
