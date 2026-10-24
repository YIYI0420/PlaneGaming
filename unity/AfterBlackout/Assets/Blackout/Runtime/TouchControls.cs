using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace AfterBlackout
{
    public sealed class TouchControls : MonoBehaviour
    {
        Canvas canvas;GameRoot root;Text aimText;Font font;
        void Start()
        {
            root=GetComponent<GameRoot>();font=Resources.Load<Font>("UI/AfterBlackoutUI");var obj=new GameObject("Touch HUD");obj.transform.SetParent(transform,false);canvas=obj.AddComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.sortingOrder=10;var scaler=obj.AddComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(1280,720);scaler.matchWidthOrHeight=.5f;obj.AddComponent<GraphicRaycaster>();
            if(FindFirstObjectByType<EventSystem>()==null){var events=new GameObject("EventSystem");events.transform.SetParent(transform);events.AddComponent<EventSystem>();events.AddComponent<StandaloneInputModule>();}
            var look=Panel("Look",new Vector2(.45f,0),Vector2.one,Vector2.zero,Vector2.zero,new Color(0,0,0,.001f));look.gameObject.AddComponent<TouchSurface>().Initialize(root.Input,false);
            var stick=Panel("Move",Vector2.zero,Vector2.zero,new Vector2(120,125),new Vector2(170,170),new Color(.15f,.25f,.25f,.35f));stick.gameObject.AddComponent<TouchSurface>().Initialize(root.Input,true);
            HoldButton("轻击 / 射击",new Vector2(-100,170),()=>root.Input.FireHeld=true,()=>root.Input.FireHeld=false);
            aimText=HoldButton("开镜",new Vector2(-235,170),()=>{if(root.Player.Weapon.Slot==2)root.Input.HeavyHeld=true;else root.Input.AimToggle=!root.Input.AimToggle;},()=>root.Input.HeavyHeld=false);
            HoldButton("跳跃",new Vector2(-100,310),()=>root.Input.Jump(),()=>{});
            HoldButton("换弹",new Vector2(-105,65),()=>root.Player.Weapon.Reload(),()=>{});HoldButton("切换",new Vector2(-235,65),()=>root.Player.Weapon.Switch((root.Player.Weapon.Slot+1)%3),()=>{});
            HoldButton("手雷",new Vector2(-365,65),()=>root.Player.Weapon.Grenade(),()=>{});HoldButton("交互",new Vector2(-365,170),()=>root.Input.Interact(),()=>{});
            var sprint=Panel("Sprint",Vector2.zero,Vector2.zero,new Vector2(120,275),new Vector2(100,70),new Color(.2f,.3f,.3f,.6f));AddText(sprint,"奔跑");sprint.gameObject.AddComponent<TouchHold>().Initialize(()=>root.Input.SprintToggle=!root.Input.SprintToggle,()=>{});
        }
        RectTransform Panel(string name,Vector2 min,Vector2 max,Vector2 position,Vector2 size,Color color)
        { var obj=new GameObject(name,typeof(RectTransform));obj.transform.SetParent(canvas.transform,false);var rect=(RectTransform)obj.transform;rect.anchorMin=min;rect.anchorMax=max;rect.pivot=new Vector2(.5f,.5f);rect.anchoredPosition=position;rect.sizeDelta=size;obj.AddComponent<Image>().color=color;return rect; }
        Text AddText(RectTransform rect,string name)
        { var obj=new GameObject("Label",typeof(RectTransform));obj.transform.SetParent(rect,false);var r=(RectTransform)obj.transform;r.anchorMin=Vector2.zero;r.anchorMax=Vector2.one;r.offsetMin=r.offsetMax=Vector2.zero;var t=obj.AddComponent<Text>();t.font=font;t.text=name;t.fontSize=24;t.color=Color.white;t.alignment=TextAnchor.MiddleCenter;t.raycastTarget=false;return t; }
        Text HoldButton(string name,Vector2 position,System.Action down,System.Action up)
        { var rect=Panel(name,new Vector2(1,0),new Vector2(1,0),position,new Vector2(110,85),new Color(.23f,.31f,.28f,.6f));var label=AddText(rect,name);rect.gameObject.AddComponent<TouchHold>().Initialize(down,up);return label; }
        void Update(){if(canvas==null)return;canvas.enabled=root.Input.Touch&&!root.Menu&&!root.Loading&&root.Session!=null&&!root.Session.Frozen;if(aimText!=null&&root.Player!=null)aimText.text=root.Player.Weapon.Slot==2?"重击":"开镜";}
    }


}
