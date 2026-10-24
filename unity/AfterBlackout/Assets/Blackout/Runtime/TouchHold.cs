using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace AfterBlackout
{
    public sealed class TouchHold : MonoBehaviour,IPointerDownHandler,IPointerUpHandler
    { System.Action down,up;public void Initialize(System.Action press,System.Action release){down=press;up=release;}public void OnPointerDown(PointerEventData e){down?.Invoke();}public void OnPointerUp(PointerEventData e){up?.Invoke();}void OnDisable(){up?.Invoke();} }
}
