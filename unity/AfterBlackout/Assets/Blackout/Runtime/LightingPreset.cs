using UnityEngine;
using UnityEngine.Rendering;
using AfterBlackout.Core;

namespace AfterBlackout
{
    public static class LightingPreset
    {
        // Explicit SH also works before a project has any baked LightingData asset.
        public static void Apply(Chapter chapter)
        {
            Color fill=chapter.index==1?new Color(.29f,.36f,.45f):new Color(.43f,.45f,.43f);
            RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=fill;
            var probe=new SphericalHarmonicsL2();probe.AddAmbientLight(fill);RenderSettings.ambientProbe=probe;
            RenderSettings.ambientIntensity=1;RenderSettings.reflectionIntensity=chapter.index==1?.35f:.5f;
            var sky=Resources.Load<Material>("Settings/Sky"+chapter.index);if(sky!=null)RenderSettings.skybox=sky;
        }
    }
}
