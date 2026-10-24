using System.Collections.Generic;
using UnityEngine;
namespace AfterBlackout
{
    public sealed class CombatAudio : MonoBehaviour
    {
        static CombatAudio instance;AudioSource source;readonly Dictionary<string,AudioClip> clips=new Dictionary<string,AudioClip>();
        void Awake(){instance=this;source=gameObject.AddComponent<AudioSource>();source.spatialBlend=0;source.volume=.3f;}
        public static void Play(string id)
        {
            if(instance==null||GameRoot.Instance==null||!GameRoot.Instance.Sound)return;AudioClip clip;
            if(!instance.clips.TryGetValue(id,out clip)){int count=id=="boss"?22050:id=="warning"?11025:4400;var samples=new float[count];var rand=new System.Random(id.GetHashCode());float hz=id=="shot"?85:id=="hurt"?140:id=="warning"?310:id=="win"?640:180;
                for(int i=0;i<count;i++){float t=i/22050f;float envelope=Mathf.Exp(-t*(id=="boss"?4:18));samples[i]=(Mathf.Sin(t*hz*Mathf.PI*2)*.45f+(float)(rand.NextDouble()*2-1)*(id=="shot"||id=="explosion"?.5f:.1f))*envelope;}
                clip=AudioClip.Create(id,count,1,22050,false);clip.SetData(samples,0);instance.clips[id]=clip;}
            instance.source.PlayOneShot(clip);
        }
        void OnDestroy(){foreach(var clip in clips.Values)Destroy(clip);if(instance==this)instance=null;}
    }
}
