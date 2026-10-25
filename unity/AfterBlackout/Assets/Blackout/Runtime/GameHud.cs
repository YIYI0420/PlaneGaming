using UnityEngine;
using AfterBlackout.Core;
using Rect = UnityEngine.Rect;

namespace AfterBlackout
{
    public sealed class GameHud : MonoBehaviour
    {
        GameRoot root;GUIStyle text,small,title,button,hero,kicker,card,muted;Font font;float w,h;int menuTab;Texture2D scopeMask,menuBackground,menuShade;
        static readonly Color Amber=new Color(.91f,.69f,.34f),Ink=new Color(.04f,.06f,.07f),Muted=new Color(.59f,.66f,.67f);
        void Awake(){root=GetComponent<GameRoot>();font=Resources.Load<Font>("UI/AfterBlackoutUI");menuBackground=Resources.Load<Texture2D>("UI/DepotMenu");BuildScope();menuShade=new Texture2D(128,1);for(int i=0;i<128;i++)menuShade.SetPixel(i,0,new Color(.018f,.03f,.04f,Mathf.Lerp(.9f,.25f,i/127f)));menuShade.Apply();}
        void Styles()
        {
            if(text!=null)return;text=new GUIStyle(GUI.skin.label){font=font,fontSize=20,wordWrap=true};text.normal.textColor=new Color(.90f,.92f,.9f);small=new GUIStyle(text){fontSize=14};title=new GUIStyle(text){fontSize=36,fontStyle=FontStyle.Bold};button=new GUIStyle(text){fontSize=18,alignment=TextAnchor.MiddleCenter,padding=new RectOffset(12,12,5,5)};
            hero=new GUIStyle(title){fontSize=58};kicker=new GUIStyle(small){fontSize=12};kicker.normal.textColor=Amber;card=new GUIStyle(text){fontSize=20};muted=new GUIStyle(small);muted.normal.textColor=Muted;
        }
        void OnGUI()
        {
            if(root==null||root.Catalog==null)return;Styles();float scale=Mathf.Min(Mathf.Clamp(Screen.width/1200f,.7f,1.6f),Screen.height/500f);w=Screen.width/scale;h=Screen.height/scale;GUI.matrix=Matrix4x4.Scale(new Vector3(scale,scale,1));
            if(root.Loading){Panel(new Rect(0,0,w,h),.98f);Label(new Rect(50,h*.4f,w-100,80),"正在进入 "+root.Catalog.Level(root.SelectedChapter).name,title);return;}
            if(root.Menu){Menu();return;}if(root.Session==null||root.Player==null)return;HUD();
            var session=root.Session;if(session.Stage==Stage.FacilityChoice)Choice(false);else if(session.Stage==Stage.UpgradeChoice)Choice(true);else if(session.Result!=null)Result();else if(session.Paused)Pause();
        }
        void Label(Rect rect,string message,GUIStyle style=null){GUI.Label(rect,message,style??text);}
        bool Button(Rect rect,string message,bool selected=false)
        {
            bool hover=rect.Contains(Event.current.mousePosition);Fill(rect,selected?new Color(.22f,.23f,.19f):hover?new Color(.16f,.21f,.22f):new Color(.09f,.13f,.15f));
            Fill(new Rect(rect.x,rect.yMax-1,rect.width,1),selected?Amber:new Color(.23f,.29f,.3f));if(selected)Fill(new Rect(rect.x,rect.y,3,rect.height),Amber);
            return GUI.Button(rect,message,button);
        }
        void Fill(Rect rect,Color color){Color old=GUI.color;GUI.color=color.linear;GUI.DrawTexture(rect,Texture2D.whiteTexture);GUI.color=old;}
        void Panel(Rect rect,float alpha=.9f){Color old=GUI.color;GUI.color=new Color(.035f,.065f,.075f,alpha);GUI.DrawTexture(rect,Texture2D.whiteTexture);GUI.color=old;}
        void Bar(Rect rect,float fraction,Color color){Panel(rect,.8f);var old=GUI.color;GUI.color=color;GUI.DrawTexture(new Rect(rect.x,rect.y,rect.width*Mathf.Clamp01(fraction),rect.height),Texture2D.whiteTexture);GUI.color=old;}
        void Menu()
        {
            if(menuBackground!=null)GUI.DrawTexture(new Rect(0,0,w,h),menuBackground,ScaleMode.ScaleAndCrop);else Panel(new Rect(0,0,w,h),1);
            GUI.DrawTexture(new Rect(0,0,w,h),menuShade);Fill(new Rect(0,h-36,w,36),new Color(.025f,.04f,.05f,.88f));
            float margin=Mathf.Max(24,(w-1100)/2),left=margin,right=w*.56f,rw=w-right-margin,lh=h-36;
            bool compact=h<510;float top=compact?18:32;hero.fontSize=compact?44:58;
            Label(new Rect(left,top,500,22),"AFTER THE BLACKOUT  /  SINGLE PLAYER",kicker);
            Label(new Rect(left,top+26,500,76),"断电之后",hero);
            Label(new Rect(left,top+(compact?84:105),w*.46f,30),"最后一班车不会来了。",muted);
            float chapterY=compact?145:183,cellH=Mathf.Clamp((lh-chapterY-104)/3,43,68),lw=right-left-42;
            Label(new Rect(left,chapterY-24,lw,20),"选择关卡 / 03",kicker);
            for(int i=0;i<3;i++)
            {
                var rect=new Rect(left,chapterY+i*(cellH+7),lw,cellH);bool selected=root.SelectedChapter==i;
                if(Button(rect,"",selected))root.SelectedChapter=i;
                Label(new Rect(rect.x+18,rect.y+10,46,30),"0"+(i+1),selected?card:muted);
                Label(new Rect(rect.x+68,rect.y+5,rect.width-100,34),root.Catalog.chapters[i].name,card);
                if(cellH>53)Label(new Rect(rect.x+68,rect.y+34,rect.width-85,24),root.Catalog.chapters[i].subtitle,muted);
            }
            var launch=new Rect(left,lh-76,lw*.65f,52);Fill(launch,Amber);var old=GUI.contentColor;GUI.contentColor=Ink;
            if(GUI.Button(launch,"开始行动  →",button))root.StartRun();GUI.contentColor=old;
            if(Button(new Rect(launch.xMax+10,launch.y,lw-launch.width-10,52),"首领训练"))root.StartRun(true);
            float panelY=top+4,panelH=lh-panelY-24;Fill(new Rect(right,panelY,rw,panelH),new Color(.035f,.055f,.065f,.92f));Fill(new Rect(right,panelY,3,32),Amber);
            float px=right+22,pw=rw-44,y=panelY+18;
            if(Button(new Rect(px,y,pw*.5f-4,38),"出战装备",menuTab==0))menuTab=0;
            if(Button(new Rect(px+pw*.5f+4,y,pw*.5f-4,38),"操作设置",menuTab==1)){menuTab=1;PlayerPrefs.Save();}y+=56;
            if(menuTab==0)
            {
                float row=compact?35:48,gap=compact?9:18;Label(new Rect(px,y,pw,22),"01 / 主武器",kicker);y+=26;
                string[] guns={"m4","ak","awm"};float cw=(pw-12)/3;
                for(int i=0;i<3;i++)if(Button(new Rect(px+i*(cw+6),y,cw,row),root.Catalog.Gun(guns[i]).shortName,root.Loadout.primary==guns[i]))root.Loadout.primary=guns[i];y+=row+5;
                Label(new Rect(px,y,pw,24),root.Catalog.Gun(root.Loadout.primary).desc,muted);y+=24+gap;
                Label(new Rect(px,y,pw,22),"02 / 瞄准镜",kicker);y+=26;string[] optics={"red","x4","x8"},names={"红点","四倍镜","八倍镜"};
                for(int i=0;i<3;i++)if(Button(new Rect(px+i*(cw+6),y,cw,row),names[i],root.Loadout.optic==optics[i]))root.Loadout.optic=optics[i];y+=row+gap;
                Label(new Rect(px,y,pw,22),"03 / 近战武器",kicker);y+=26;float bw=(pw-12)/3;
                for(int i=0;i<root.Catalog.melee.Length;i++){var blade=root.Catalog.melee[i];if(Button(new Rect(px+(i%3)*(bw+6),y+(i/3)*(row+6),bw,row),blade.name,root.Loadout.melee==blade.id))root.Loadout.melee=blade.id;}
            }
            else
            {
                Label(new Rect(px,y,pw,38),"视角灵敏度",card);y+=42;Sensitivity(px,y,pw);y+=65;
                Label(new Rect(px,y,pw,22),"画质与音效",kicker);y+=30;Options(px,y,pw);y+=104;
                Label(new Rect(px,y,pw,110),"WASD 移动 · 鼠标瞄准\n右键开镜 · 左键射击\nShift 奔跑 · 空格跳跃\n1 / 2 / 3 切枪与刀 · R 换弹",muted);
            }
            Label(new Rect(left+4,h-27,w-2*margin,24),root.Input.Touch?"横屏游玩 · 左侧移动 / 右侧转向":"WASD 移动    /    右键开镜    /    Shift 奔跑    /    Esc 暂停",muted);
            if(Event.current.rawType==EventType.MouseUp)PlayerPrefs.Save();
        }
        void Sensitivity(float x,float y,float width)
        {
            float next=GUI.HorizontalSlider(new Rect(x,y+5,width-88,20),root.Input.Sensitivity,.25f,2);
            if(Mathf.Abs(next-root.Input.Sensitivity)>.001f)root.Input.SetSensitivity(next);
            Label(new Rect(x+width-78,y-2,78,25),root.Input.Sensitivity.ToString("0.00")+" ×",small);
            Label(new Rect(x,y+25,width-105,24),"低速 ← 视角 → 高速",muted);
            if(Button(new Rect(x+width-84,y+26,84,28),"默认"))root.Input.SetSensitivity(1);
        }
        void Options(float x,float y,float width)
        {
            string[] names={"省电","标准","高清"};float cell=(width-12)/3;
            for(int i=0;i<3;i++)if(Button(new Rect(x+i*(cell+4),y,cell,44),names[i],root.Quality==i))root.ApplyQuality(i);
            if(Button(new Rect(x,y+49,width*.64f-4,35),"触屏自动开火 "+(root.AutoFire?"开":"关"),root.AutoFire))root.AutoFire=!root.AutoFire;
            if(Button(new Rect(x+width*.64f+4,y+49,width*.36f-4,35),"音效 "+(root.Sound?"开":"关"),root.Sound))root.Sound=!root.Sound;
        }
        void HUD()
        {
            var session=root.Session;var weapon=root.Player.Weapon;bool scope=weapon.Aiming&&weapon.Slot==0&&weapon.Zoom>2;
            if(scope)Scope();Panel(new Rect(12,12,w-24,68),.72f);Label(new Rect(24,22,w*.36f,46),"0"+(session.Level.index+1)+" / 03 · "+session.Level.name,small);Label(new Rect(w*.37f,22,w*.47f,50),root.Objective);if(Button(new Rect(w-95,23,68,42),"暂停"))root.Pause(true);
            if(session.Stage==Stage.Boss||session.Stage==Stage.BossIntro)
            {
                float bw=Mathf.Min(580,w*.7f),bx=(w-bw)/2;Panel(new Rect(bx-12,91,bw+24,87),.8f);Label(new Rect(bx,95,bw,27),session.Level.bossName+" / 阶段 "+session.Boss.Phase+" / "+Mathf.CeilToInt(session.Boss.Health),small);Bar(new Rect(bx,126,bw,7),session.Boss.Health/session.Boss.MaximumHealth,session.Boss.Exposed>0?Color.green:new Color(1,.55f,.3f));Bar(new Rect(bx,136,bw,3),session.Boss.Stagger/100,new Color(.9f,.8f,.45f));
                var boss=root.Enemies.Find(e=>e!=null&&e.IsBoss);if(boss!=null)Label(new Rect(bx,146,bw,30),boss.Warning,small);
            }
            if(Time.unscaledTime<root.NoticeUntil)Label(new Rect(w*.2f,190,w*.6f,60),root.Notice);
            float bottom=root.Input.Touch?170:90;Panel(new Rect(16,h-bottom-20,200,88),.75f);Label(new Rect(27,h-bottom-12,180,34),"生命 "+Mathf.CeilToInt(root.Player.Vitals.Health));Bar(new Rect(27,h-bottom+26,170,6),root.Player.Vitals.Health/100,new Color(.67f,.84f,.5f));Bar(new Rect(27,h-bottom+40,170,4),root.Player.Vitals.Stamina/100,new Color(.4f,.7f,.75f));
            Panel(new Rect(w-265,h-bottom-20,245,88),.75f);Label(new Rect(w-250,h-bottom-12,220,34),weapon.Slot==2?weapon.Blade.name:weapon.Gun.Definition.name);Label(new Rect(w-250,h-bottom+22,220,35),weapon.Slot==2?"左轻 / 右重 · 体力 18":weapon.Gun.Ammo+" / "+(weapon.Gun.Reserve<0?"∞":weapon.Gun.Reserve.ToString())+(weapon.Gun.Reloading?" 装填中":""),small);
            // A red-dot sight already supplies its own reticle; a second HUD cross obscures it.
            if(!weapon.Aiming||scope||Time.unscaledTime<weapon.HitUntil){Color old=GUI.color;GUI.color=Time.unscaledTime<weapon.HitUntil?Color.red:Color.white;GUI.DrawTexture(new Rect(w/2-8,h/2-1,16,2),Texture2D.whiteTexture);GUI.DrawTexture(new Rect(w/2-1,h/2-8,2,16),Texture2D.whiteTexture);GUI.color=old;}
            if(session.Stage==Stage.Briefing&&Button(new Rect(w/2-130,h*.65f,260,45),"已了解 · 开始第一波"))session.SkipBriefing();
        }
        void Pause()
        {
            float width=Mathf.Min(520,w-32),x=(w-width)/2,y=Mathf.Max(12,(h-450)/2);Panel(new Rect(x-12,y-8,width+24,445));Label(new Rect(x+16,y+10,width-32,50),"暂时安全。",title);Options(x+16,y+72,width-32);
            Label(new Rect(x+16,y+156,width-32,24),"视角灵敏度",small);Sensitivity(x+16,y+182,width-32);
            string[] ids={"red","x4","x8"};for(int i=0;i<3;i++)if(Button(new Rect(x+16+i*(width-32)/3,y+250,(width-36)/3,38),i==0?"红点":i==1?"四倍":"八倍"))root.Player.Weapon.SetOptic(ids[i]);
            if(Button(new Rect(x+16,y+307,width-32,48),"继续生存 →"))root.Pause(false);if(Button(new Rect(x+16,y+369,(width-40)/2,42),"重试本关"))root.StartRun(root.Session.Training,true);if(Button(new Rect(x+24+(width-40)/2,y+369,(width-40)/2,42),"返回整备"))root.ReturnToMenu();
            if(Event.current.rawType==EventType.MouseUp)PlayerPrefs.Save();
        }
        void Choice(bool upgrade)
        {
            Panel(new Rect(0,0,w,h),.85f);float width=Mathf.Min(850,w-40),x=(w-width)/2,y=h*.28f;Label(new Rect(x,y,width,65),upgrade?"选择强化":"电力只够支持一种设施",title);y+=82;int count=upgrade?3:2;float cell=(width-8*(count-1))/count;
            string[] names=upgrade?new[]{"穿透弹\n额外穿透一个普通敌人","快速装填\n换弹时间缩短 35%","电击手雷\n爆炸附带减速"}:new[]{"电网\n通道范围电击与减速","炮台\n固定方向自动攻击，弹药有限"};
            for(int i=0;i<count;i++)if(Button(new Rect(x+i*(cell+8),y,cell,130),names[i])){if(upgrade)root.Choose((Upgrade)(i+1));else root.Choose((Facility)(i+1));}
        }
        void Result()
        {
            Panel(new Rect(0,0,w,h),.94f);var result=root.Session.Result;float width=Mathf.Min(650,w-40),x=(w-width)/2,y=Mathf.Max(15,(h-470)/2);bool all=result.won&&!result.training&&result.chapter==2&&root.Completed.Count==2&&root.Completed[0].chapter==0&&root.Completed[1].chapter==1;
            Label(new Rect(x,y,width,65),all?"三关突破，天亮了。":result.won?"区域突破 · 撤离成功":"信号，在这里中断。",title);y+=78;
            float total=result.seconds;int kills=result.kills;if(all)foreach(var r in root.Completed){total+=r.seconds;kills+=r.kills;}
            Label(new Rect(x,y,width,95),(all?"三关总计":root.Session.Level.name)+"\n用时 "+Format(total)+" / 击杀 "+kills+" / 爆头 "+result.headshots+"\n近战 "+result.meleeKills+" / 设施 "+result.facilityKills);y+=110;
            if(result.won&&!result.training&&result.chapter<2){if(Button(new Rect(x,y,width,58),"继续第 "+(result.chapter+2)+" 关 · "+root.Catalog.Level(result.chapter+1).name+" →"))root.NextChapter();y+=70;}
            if(Button(new Rect(x,y,width,50),"重试本关"))root.StartRun(result.training,true);y+=62;if(Button(new Rect(x,y,width,50),"返回整备 / 重新选关"))root.ReturnToMenu();
        }
        void BuildScope()
        { scopeMask=new Texture2D(256,256,TextureFormat.RGBA32,false);var pixels=new Color32[256*256];for(int y=0;y<256;y++)for(int x=0;x<256;x++){float r=new Vector2(x-127.5f,y-127.5f).magnitude;pixels[y*256+x]=new Color32(0,0,0,r>119?byte.MaxValue:(byte)0);}scopeMask.SetPixels32(pixels);scopeMask.Apply(); }
        void Scope()
        { float size=Mathf.Min(w,h)*.94f,x=(w-size)/2,y=(h-size)/2;Panel(new Rect(0,0,x,h),1);Panel(new Rect(x+size,0,w-x-size,h),1);Panel(new Rect(x,0,size,y),1);Panel(new Rect(x,y+size,size,h-y-size),1);GUI.DrawTexture(new Rect(x,y,size,size),scopeMask); }
        static string Format(float seconds){int whole=(int)seconds;return (whole/60).ToString("00")+":"+(whole%60).ToString("00");}
        void OnDestroy(){if(scopeMask!=null)Destroy(scopeMask);if(menuShade!=null)Destroy(menuShade);}
    }
}
