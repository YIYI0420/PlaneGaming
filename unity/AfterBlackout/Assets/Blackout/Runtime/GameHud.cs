using UnityEngine;
using AfterBlackout.Core;
using Rect = UnityEngine.Rect;

namespace AfterBlackout
{
    public sealed class GameHud : MonoBehaviour
    {
        GameRoot root;GUIStyle text,small,title,button;Font font;Vector2 scroll;float w,h;Texture2D scopeMask;
        void Awake(){root=GetComponent<GameRoot>();font=Resources.Load<Font>("UI/AfterBlackoutUI");BuildScope();}
        void Styles()
        {
            if(text!=null)return;text=new GUIStyle(GUI.skin.label){font=font,fontSize=20,wordWrap=true};small=new GUIStyle(text){fontSize=14};title=new GUIStyle(text){fontSize=36,fontStyle=FontStyle.Bold};button=new GUIStyle(GUI.skin.button){font=font,fontSize=19,wordWrap=true,padding=new RectOffset(12,12,10,10)};
        }
        void OnGUI()
        {
            if(root==null||root.Catalog==null)return;Styles();float scale=Mathf.Clamp(Screen.width/1200f,.7f,1.6f);w=Screen.width/scale;h=Screen.height/scale;GUI.matrix=Matrix4x4.Scale(new Vector3(scale,scale,1));
            if(root.Loading){Panel(new Rect(0,0,w,h),.98f);Label(new Rect(50,h*.4f,w-100,80),"正在进入 "+root.Catalog.Level(root.SelectedChapter).name,title);return;}
            if(root.Menu){Menu();return;}if(root.Session==null||root.Player==null)return;HUD();
            var session=root.Session;if(session.Stage==Stage.FacilityChoice)Choice(false);else if(session.Stage==Stage.UpgradeChoice)Choice(true);else if(session.Result!=null)Result();else if(session.Paused)Pause();
        }
        void Label(Rect rect,string message,GUIStyle style=null){GUI.Label(rect,message,style??text);}
        bool Button(Rect rect,string message,bool selected=false){Color before=GUI.backgroundColor;GUI.backgroundColor=selected?new Color(.9f,.65f,.29f):new Color(.22f,.31f,.32f);bool clicked=GUI.Button(rect,message,button);GUI.backgroundColor=before;return clicked;}
        void Panel(Rect rect,float alpha=.9f){Color old=GUI.color;GUI.color=new Color(.035f,.065f,.075f,alpha);GUI.DrawTexture(rect,Texture2D.whiteTexture);GUI.color=old;}
        void Bar(Rect rect,float fraction,Color color){Panel(rect,.8f);var old=GUI.color;GUI.color=color;GUI.DrawTexture(new Rect(rect.x,rect.y,rect.width*Mathf.Clamp01(fraction),rect.height),Texture2D.whiteTexture);GUI.color=old;}
        void Menu()
        {
            Panel(new Rect(0,0,w,h),.98f);float width=Mathf.Min(1100,w-36),x=(w-width)/2;scroll=GUI.BeginScrollView(new Rect(x,12,width,h-24),scroll,new Rect(0,0,width-22,1000));float y=12,cw=(width-38)/3;
            Label(new Rect(10,y,width-40,55),"断电之后 / AFTER THE BLACKOUT",title);y+=66;Label(new Rect(10,y,width-40,30),"Unity · URP / 选择关卡与装备",small);y+=36;
            for(int i=0;i<3;i++)if(Button(new Rect(10+i*(cw+4),y,cw,90),"0"+(i+1)+" / "+root.Catalog.chapters[i].name+"\n"+root.Catalog.chapters[i].subtitle,root.SelectedChapter==i))root.SelectedChapter=i;
            y+=105;Label(new Rect(10,y,width-40,60),root.Catalog.Level(root.SelectedChapter).story);y+=66;
            string[] guns={"m4","ak","awm"};for(int i=0;i<3;i++)if(Button(new Rect(10+i*(cw+4),y,cw,65),root.Catalog.Gun(guns[i]).name,root.Loadout.primary==guns[i]))root.Loadout.primary=guns[i];y+=82;
            string[] optics={"red","x4","x8"},names={"红点","四倍镜","八倍镜"};for(int i=0;i<3;i++)if(Button(new Rect(10+i*(cw+4),y,cw,52),names[i],root.Loadout.optic==optics[i]))root.Loadout.optic=optics[i];y+=69;
            float bw=(width-44)/5;for(int i=0;i<root.Catalog.melee.Length;i++){var blade=root.Catalog.melee[i];if(Button(new Rect(10+i*(bw+4),y,bw,65),blade.name,root.Loadout.melee==blade.id))root.Loadout.melee=blade.id;}y+=80;
            Label(new Rect(10,y,width-40,60),"左键轻击 / 右键或 F 重击 · Shift 奔跑 · 空格跳跃\n1 / 2 / 3 切枪与刀 · G 手雷 · E 交互 · Esc / P 暂停",small);y+=70;
            Options(10,y,width-38);y+=78;
            if(Button(new Rect(10,y,width-38,65),"进入第 "+(root.SelectedChapter+1)+" 关 →"))root.StartRun();y+=78;
            if(Button(new Rect(10,y,width-38,52),"首领训练 · "+root.Catalog.Level(root.SelectedChapter).bossName))root.StartRun(true);
            GUI.EndScrollView();
        }
        void Options(float x,float y,float width)
        {
            string[] names={"省电","标准","高清"};float cell=(width-12)/3;
            for(int i=0;i<3;i++)if(Button(new Rect(x+i*(cell+4),y,cell,44),names[i],root.Quality==i))root.ApplyQuality(i);
            root.AutoFire=GUI.Toggle(new Rect(x,y+49,width*.55f,26),root.AutoFire,"触屏自动开火",text);root.Sound=GUI.Toggle(new Rect(x+width*.6f,y+49,width*.4f,26),root.Sound,"音效",text);
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
            Color old=GUI.color;GUI.color=Time.unscaledTime<weapon.HitUntil?Color.red:Color.white;GUI.DrawTexture(new Rect(w/2-8,h/2-1,16,2),Texture2D.whiteTexture);GUI.DrawTexture(new Rect(w/2-1,h/2-8,2,16),Texture2D.whiteTexture);GUI.color=old;
            if(session.Stage==Stage.Briefing&&Button(new Rect(w/2-130,h*.65f,260,45),"已了解 · 开始第一波"))session.SkipBriefing();
        }
        void Pause()
        {
            float width=Mathf.Min(520,w-32),x=(w-width)/2,y=Mathf.Max(25,(h-400)/2);Panel(new Rect(x-12,y-12,width+24,415));Label(new Rect(x+16,y+10,width-32,50),"暂时安全。",title);Options(x+16,y+80,width-32);
            string[] ids={"red","x4","x8"};for(int i=0;i<3;i++)if(Button(new Rect(x+16+i*(width-32)/3,y+168,(width-36)/3,44),i==0?"红点":i==1?"四倍":"八倍"))root.Player.Weapon.SetOptic(ids[i]);
            if(Button(new Rect(x+16,y+230,width-32,52),"继续生存 →"))root.Pause(false);if(Button(new Rect(x+16,y+292,(width-40)/2,45),"重试本关"))root.StartRun(root.Session.Training,true);if(Button(new Rect(x+24+(width-40)/2,y+292,(width-40)/2,45),"返回整备"))root.ReturnToMenu();
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
        void OnDestroy(){if(scopeMask!=null)Destroy(scopeMask);}
    }
}
