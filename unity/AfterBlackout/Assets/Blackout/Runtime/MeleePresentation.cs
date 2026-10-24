using System.Collections.Generic;
using UnityEngine;
using AfterBlackout.Core;
namespace AfterBlackout {
 public static class MeleePresentation {
  static readonly Dictionary<string,float[][]> poses=new Dictionary<string,float[][]>{
            {"combat",new float[][] {new float[]{0.32f,-0.1f,-0.98f,0.1f,0.1f,-0.22f},new float[]{0.41f,-0.16f,-0.76f,0.4f,-0.35f,-0.4f},new float[]{0.03f,-0.02f,-1.13f,1.35f,0.18f,-0.12f},new float[]{-0.06f,-0.1f,-1.02f,1.5f,0.35f,0.2f},new float[]{0.4f,-0.04f,-0.65f,0.8f,-0.6f,-0.25f},new float[]{0f,0.02f,-1.28f,1.6f,0.05f,0f},new float[]{-0.08f,-0.15f,-1.08f,1.9f,0.35f,0.4f}}},
            {"karambit",new float[][] {new float[]{0.34f,-0.12f,-0.94f,0.2f,-0.3f,-0.5f},new float[]{0.48f,-0.08f,-0.82f,0.6f,-0.6f,-0.8f},new float[]{0.03f,-0.03f,-1.03f,1.1f,0.5f,0.45f},new float[]{-0.24f,-0.11f,-0.94f,0.5f,0.8f,1.1f},new float[]{0.4f,-0.37f,-0.75f,0.1f,-0.6f,-0.9f},new float[]{0.02f,0.06f,-1.12f,1.5f,0.25f,0.2f},new float[]{-0.16f,0.27f,-0.92f,2.1f,0.6f,0.9f}}},
            {"machete",new float[][] {new float[]{0.34f,-0.26f,-1.02f,-0.35f,-0.3f,-0.45f},new float[]{0.53f,-0.08f,-0.93f,-0.5f,-0.8f,-1.05f},new float[]{0.04f,-0.07f,-1.13f,-1.05f,0.1f,0.2f},new float[]{-0.35f,-0.2f,-1.02f,-0.9f,0.8f,1.1f},new float[]{0.47f,0.04f,-0.85f,-0.25f,-0.8f,-0.9f},new float[]{0.02f,-0.06f,-1.2f,-1.4f,0.1f,0.15f},new float[]{-0.29f,-0.35f,-1f,-1.75f,0.55f,0.9f}}},
            {"katana",new float[][] {new float[]{0.32f,-0.3f,-1.18f,-0.45f,-0.25f,-0.35f},new float[]{0.43f,0.03f,-1.03f,-0.3f,-0.45f,-0.85f},new float[]{0.02f,-0.04f,-1.3f,-1.15f,0.15f,0.15f},new float[]{-0.22f,-0.26f,-1.17f,-1.4f,0.5f,0.8f},new float[]{0.24f,-0.18f,-0.82f,-1.45f,0.1f,-0.1f},new float[]{0f,-0.08f,-1.48f,-1.5f,0f,0f},new float[]{-0.08f,-0.12f,-1.3f,-1.7f,0.1f,0.15f}}},
            {"axe",new float[][] {new float[]{0.34f,-0.28f,-1.1f,-0.2f,-0.3f,-0.25f},new float[]{0.42f,0.05f,-1f,-0.1f,-0.4f,-0.25f},new float[]{0.02f,-0.09f,-1.16f,-1.35f,0.1f,0.08f},new float[]{-0.08f,-0.38f,-1.02f,-1.9f,0.25f,0.3f},new float[]{0.24f,0.23f,-0.94f,0.2f,-0.15f,0f},new float[]{0f,-0.09f,-1.26f,-1.45f,0.05f,0f},new float[]{-0.08f,-0.42f,-1.08f,-2.05f,0.2f,0.2f}}}
  };
  static Vector3 Position(float[] p){return new Vector3(p[0],p[1],-p[2]);}
  static Quaternion Rotation(float[] p,bool mirror){return Quaternion.Euler(-p[3]*Mathf.Rad2Deg,-p[4]*Mathf.Rad2Deg,(mirror?-p[5]:p[5])*Mathf.Rad2Deg);}
  public static void Apply(Transform wrist,string id,MeleeAction action){
   var p=poses[id];if(action==null){wrist.localPosition=Position(p[0]);wrist.localRotation=Rotation(p[0],false);return;}
   var d=action.Definition;float[] times={0,d.windup,d.Contact,d.windup+d.active,d.duration};int segment=0;while(segment<3&&action.Elapsed>times[segment+1])segment++;
   int start=action.Heavy?4:1;int a=segment==0?0:start+segment-1,b=segment==3?0:start+segment;
   bool alternate=!action.Heavy&&action.Combo==1&&(id=="karambit"||id=="machete"||id=="katana");
   Vector3 pa=Position(p[a]),pb=Position(p[b]);if(alternate&&a!=0)pa.x=.07f-pa.x;if(alternate&&b!=0)pb.x=.07f-pb.x;
   float t=Mathf.Clamp01((action.Elapsed-times[segment])/Mathf.Max(.001f,times[segment+1]-times[segment]));t=t*t*(3-2*t);
   wrist.localPosition=Vector3.Lerp(pa,pb,t);wrist.localRotation=Quaternion.Slerp(Rotation(p[a],alternate&&a!=0),Rotation(p[b],alternate&&b!=0),t);
  }
 }
}
