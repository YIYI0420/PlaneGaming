using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace AfterBlackout
{
    public sealed class TouchSurface : MonoBehaviour,IPointerDownHandler,IPointerUpHandler,IDragHandler
    {
        InputBridge input;bool joystick;Vector2 origin;int pointer=int.MinValue;
        public void Initialize(InputBridge bridge,bool move){input=bridge;joystick=move;}
        public void OnPointerDown(PointerEventData e){if(pointer!=int.MinValue)return;pointer=e.pointerId;origin=e.position;}
        public void OnDrag(PointerEventData e){if(e.pointerId!=pointer)return;if(joystick)input.Stick=Vector2.ClampMagnitude((e.position-origin)/75,1);else input.TouchLook+=e.delta*.16f;}
        public void OnPointerUp(PointerEventData e){if(e.pointerId!=pointer)return;pointer=int.MinValue;if(joystick)input.Stick=Vector2.zero;}
        void OnDisable(){pointer=int.MinValue;if(input!=null&&joystick)input.Stick=Vector2.zero;}
    }
}
