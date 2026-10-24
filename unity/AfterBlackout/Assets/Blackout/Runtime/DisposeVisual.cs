using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using AfterBlackout.Core;

namespace AfterBlackout
{
    public sealed class DisposeVisual : MonoBehaviour
    { void OnDestroy(){var filter=GetComponent<MeshFilter>();if(filter!=null&&GetComponent<MeshRenderer>()!=null&&name=="SkillRadius")Destroy(filter.sharedMesh);var renderer=GetComponent<Renderer>();if(renderer!=null)Destroy(renderer.sharedMaterial);} }
}
