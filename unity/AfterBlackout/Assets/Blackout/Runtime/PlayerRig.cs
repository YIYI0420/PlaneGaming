using UnityEngine;
using AfterBlackout.Core;
using UnityEngine.Rendering.Universal;

namespace AfterBlackout
{
    [DefaultExecutionOrder(-100)]
    public sealed class PlayerRig : MonoBehaviour
    {
        public readonly Vitals Vitals=new Vitals();public WeaponRig Weapon;public Camera View;public CharacterController Controller;public bool Airborne { get { return airborneHeight>.5f; } }
        GameRoot root;float yaw=180,pitch,vertical,airborneHeight;int portrait;
        public void Initialize(GameRoot game,Point spawn)
        {
            root=game;gameObject.layer=11;transform.position=GameRoot.ToVector(spawn)+Vector3.up*.05f;transform.rotation=Quaternion.Euler(0,yaw,0);
            Controller=gameObject.AddComponent<CharacterController>();Controller.height=1.8f;Controller.radius=.32f;Controller.center=Vector3.up*.9f;Controller.stepOffset=.32f;Controller.slopeLimit=46;
            var cameraObject=new GameObject("PlayerCamera");cameraObject.transform.SetParent(transform,false);cameraObject.transform.localPosition=Vector3.up*1.65f;View=cameraObject.AddComponent<Camera>();View.nearClipPlane=.055f;View.farClipPlane=180;View.fieldOfView=78;View.cullingMask=~(1<<10);View.tag="MainCamera";View.allowHDR=true;View.GetUniversalAdditionalCameraData().renderPostProcessing=true;cameraObject.AddComponent<AudioListener>();
            Weapon=gameObject.AddComponent<WeaponRig>();Weapon.Initialize(game,this);portrait=Screen.width>Screen.height?0:1;
            var lampObject=new GameObject("WeaponLight");lampObject.transform.SetParent(cameraObject.transform,false);lampObject.transform.localPosition=new Vector3(.12f,-.12f,.2f);var lamp=lampObject.AddComponent<Light>();lamp.type=LightType.Spot;lamp.intensity=12;lamp.range=24;lamp.spotAngle=58;lamp.innerSpotAngle=32;lamp.color=new Color(.91f,.95f,1);lamp.shadows=LightShadows.None;lamp.cullingMask=~(1<<10);lamp.renderMode=LightRenderMode.ForcePixel;
        }
        void Update()
        {
            if(root.Menu||root.Loading||root.Session==null||root.Session.Frozen)return;
            int orientation=Screen.width>Screen.height?0:1;if(orientation!=portrait){portrait=orientation;root.Pause(true);return;}
            var input=root.Input;float dt=Time.deltaTime;Vector2 movement=input.Move;bool attack=Weapon.Attacking||input.Fire||input.Heavy;
            Vitals.Tick(dt,input.Sprint,movement.sqrMagnitude>.02f,attack,Weapon.Slot!=2&&root.Input.Aim);
            Vector2 look=input.ConsumeLook();float scale=1/Weapon.Zoom;yaw+=look.x*scale;pitch=Mathf.Clamp(pitch-look.y*scale,-60,65);transform.rotation=Quaternion.Euler(0,yaw,0);View.transform.localRotation=Quaternion.Euler(pitch,0,0);
            if(Controller.isGrounded){vertical=-2;if(input.TakeJump()){vertical=4.8f;CombatAudio.Play("jump");}}
            else input.TakeJump();vertical-=13*dt;Vector3 delta=transform.right*movement.x+transform.forward*movement.y;delta=Vector3.ClampMagnitude(delta,1)*(Vitals.Sprinting?6.4f:3.8f);delta.y=vertical;Controller.Move(delta*dt);
            RaycastHit ground;if(Physics.Raycast(transform.position+Vector3.up*.08f,Vector3.down,out ground,8,1<<0,QueryTriggerInteraction.Ignore))airborneHeight=Mathf.Max(0,ground.distance-.08f);else airborneHeight=2;
            if(input.TakeInteract())root.Interact();if(Vitals.Health<=0)root.Session.Finish(false);
        }
        public void Hurt(float amount) { if(root.Session.Frozen||!Vitals.Hurt(amount))return;CombatAudio.Play("hurt");if(Vitals.Health<=0)root.Session.Finish(false); }
    }
}
