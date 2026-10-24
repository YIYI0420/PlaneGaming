using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using AfterBlackout.Core;

namespace AfterBlackout
{
    public sealed class LevelNavigation : MonoBehaviour
    { public NavMeshData Data;NavMeshDataInstance instance;void OnEnable(){if(Data!=null)instance=NavMesh.AddNavMeshData(Data);}void OnDisable(){if(instance.valid)instance.Remove();} }
}
