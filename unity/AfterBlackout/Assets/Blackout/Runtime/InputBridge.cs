using UnityEngine;

namespace AfterBlackout
{
    public sealed class InputBridge : MonoBehaviour
    {
        public Vector2 Stick,TouchLook;public bool FireHeld,HeavyHeld,AimToggle,SprintToggle;
        bool jump,interact,touchDetected;public bool Touch { get { if(UnityEngine.Input.touchCount>0)touchDetected=true;return Application.isMobilePlatform||touchDetected; } }
        public Vector2 Move { get { return Vector2.ClampMagnitude(Stick+new Vector2(UnityEngine.Input.GetAxisRaw("Horizontal"),UnityEngine.Input.GetAxisRaw("Vertical")),1); } }
        public bool Fire { get { return FireHeld||(!Touch&&UnityEngine.Input.GetMouseButton(0)); } }
        public bool Heavy { get { return HeavyHeld||UnityEngine.Input.GetKey(KeyCode.F)||(!Touch&&UnityEngine.Input.GetMouseButton(1)); } }
        public bool Aim { get { return AimToggle||(!Touch&&UnityEngine.Input.GetMouseButton(1)); } }
        public bool Sprint { get { return SprintToggle||UnityEngine.Input.GetKey(KeyCode.LeftShift)||UnityEngine.Input.GetKey(KeyCode.RightShift); } }
        public Vector2 ConsumeLook()
        { var value=TouchLook;TouchLook=Vector2.zero;if(!Touch&&Cursor.lockState==CursorLockMode.Locked)value+=new Vector2(UnityEngine.Input.GetAxisRaw("Mouse X"),UnityEngine.Input.GetAxisRaw("Mouse Y"))*2;return value; }
        public void Jump() { jump=true; }public void Interact() { interact=true; }
        public bool TakeJump() { bool pressed=jump||UnityEngine.Input.GetKeyDown(KeyCode.Space);jump=false;return pressed; }
        public bool TakeInteract() { bool pressed=interact||UnityEngine.Input.GetKeyDown(KeyCode.E);interact=false;return pressed; }
        public void Clear() { Stick=TouchLook=Vector2.zero;FireHeld=HeavyHeld=AimToggle=SprintToggle=jump=interact=false; }
    }
}
