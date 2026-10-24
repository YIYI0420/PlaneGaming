using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using AfterBlackout.Core;

namespace AfterBlackout
{
    // Runs in the editor to produce inspectable, saved scenes. Runtime gameplay does not rebuild maps.
    public static class WorldBuilder
    {
        static Transform world;static Chapter chapter;static Material concrete,steel,dark,asphalt;
        static GameObject Box(string name,Vector3 at,Vector3 size,Material mat,bool solid=true)
        { return VisualFactory.Part(world,name,PrimitiveType.Cube,at,size,mat,solid); }
        public static void Build(Chapter level)
        {
            chapter=level;world=new GameObject("Environment_"+level.id).transform;var art=VisualFactory.Art;
            concrete=art!=null&&art.concrete!=null?art.concrete:VisualFactory.Material("#858780",0,.2f);steel=art!=null&&art.metal!=null?art.metal:VisualFactory.Material("#596669",.75f,.35f);asphalt=art!=null&&art.asphalt!=null?art.asphalt:concrete;dark=VisualFactory.Material("#2d373a",.2f,.2f);
            if(level.index<2&&art!=null&&art.brick!=null)concrete=art.brick;
            float width=level.bounds.x2-level.bounds.x1,depth=level.bounds.z2-level.bounds.z1,cx=(level.bounds.x1+level.bounds.x2)/2,cz=(level.bounds.z1+level.bounds.z2)/2;
            var groundMaterial=new Material(asphalt);groundMaterial.name="Ground_"+level.id;groundMaterial.SetTextureScale("_BaseMap",new Vector2(width/3,depth/3));
            Box("Ground",new Vector3(cx,-.15f,cz),new Vector3(width,.3f,depth),groundMaterial);
            for(int side=-1;side<=1;side+=2)
            { float x=side<0?level.bounds.x1:level.bounds.x2;Box("Boundary",new Vector3(x,1.4f,cz),new Vector3(.3f,2.8f,depth),concrete);for(float z=level.bounds.z1;z<level.bounds.z2;z+=4)Box("FencePost",new Vector3(x,2.4f,z),new Vector3(.08f,2,.08f),steel,false); }
            Box("SouthBoundary",new Vector3(cx,1.5f,level.bounds.z2),new Vector3(width,3,.3f),concrete);
            float gateX=(level.gate.x1+level.gate.x2)/2;
            Box("ExitWallLeft",new Vector3((level.bounds.x1+level.gate.x1)/2,1.5f,level.bounds.z1),new Vector3(level.gate.x1-level.bounds.x1,3,.3f),concrete);
            Box("ExitWallRight",new Vector3((level.bounds.x2+level.gate.x2)/2,1.5f,level.bounds.z1),new Vector3(level.bounds.x2-level.gate.x2,3,.3f),concrete);
            foreach(var obstacle in level.obstacles)Obstacle(obstacle);
            Dress(level);
            if(level.index==0)Depot();else if(level.index==1)Harbor();else Reactor();
            var signal=new GameObject("WorldSignals").AddComponent<WorldSignals>();signal.Power=Box("PowerConsole",GameRoot.ToVector(level.box)+Vector3.up*.9f,new Vector3(1.2f,1.8f,.6f),steel).transform;
            Box("PowerDisplay",GameRoot.ToVector(level.box)+new Vector3(0,1.3f,-.32f),new Vector3(.65f,.34f,.03f),VisualFactory.Material("#b9d3a1",0,.3f,true),false);
            Facilities(signal,level);
            var gate=Box("ExitGate",new Vector3(gateX,1.8f,(level.gate.z1+level.gate.z2)/2),new Vector3(level.gate.x2-level.gate.x1,3.6f,.2f),steel);signal.Gate=gate.transform;signal.GateCollider=gate.GetComponent<Collider>();signal.Closed=gate.transform.position;
            signal.ExitGlow=Box("ExitZone",GameRoot.ToVector(level.exit)+Vector3.up*.02f,new Vector3(4,.025f,2),VisualFactory.Material("#73bf7c",0,.2f,true),false);signal.ExitGlow.SetActive(false);
            foreach(var pickup in level.pickups){var box=Box("Supply_"+pickup.id,GameRoot.ToVector(pickup)+Vector3.up*.28f,new Vector3(.75f,.55f,.5f),VisualFactory.Material(pickup.type=="ammo"?"#7b8c57":"#b8bdb1"),false);var p=box.AddComponent<SupplyPickup>();p.IsAmmo=pickup.type=="ammo";}
            for(float z=level.bounds.z1+4;z<level.bounds.z2-4;z+=5)Box("LanePaint",new Vector3(cx,.015f,z),new Vector3(.12f,.01f,2),VisualFactory.Material("#afaa83"),false);
            foreach(var point in level.portals){var glow=Box("SpawnMarker",GameRoot.ToVector(point)+Vector3.up*.02f,new Vector3(1.7f,.015f,1.7f),VisualFactory.Material("#754b3b"),false);glow.name="EnemyEntrance";}
            LightEnvironment(level);var nav=new GameObject("BakedNavigation").AddComponent<LevelNavigation>();nav.name="BakedNavigation_"+level.id;
        }
        static void Facilities(WorldSignals signal,Chapter level)
        {
            var grid=new GameObject("ActiveElectricGrid");grid.transform.SetParent(world,false);signal.GridEffect=grid;
            float cx=(level.grid.x1+level.grid.x2)/2,cz=(level.grid.z1+level.grid.z2)/2,width=level.grid.x2-level.grid.x1,depth=level.grid.z2-level.grid.z1;
            var electric=VisualFactory.Material("#5ddacb",.1f,.5f,true);
            foreach(float x in new[]{level.grid.x1,level.grid.x2})foreach(float z in new[]{level.grid.z1,level.grid.z2})
            {Box("GridPost",new Vector3(x,.7f,z),new Vector3(.16f,1.4f,.16f),steel,false);}
            for(float z=level.grid.z1;z<=level.grid.z2;z+=1.5f)VisualFactory.Part(grid.transform,"GridArc",PrimitiveType.Cube,new Vector3(cx,.08f,z),new Vector3(width,.045f,.035f),electric,false);
            foreach(float x in new[]{level.grid.x1,level.grid.x2})VisualFactory.Part(grid.transform,"GridBoundary",PrimitiveType.Cube,new Vector3(x,.07f,cz),new Vector3(.045f,.045f,depth),electric,false);
            grid.SetActive(false);
            var turret=new GameObject("ActiveTurret");turret.transform.SetParent(world,false);turret.transform.position=GameRoot.ToVector(level.turret);turret.transform.rotation=Quaternion.Euler(0,180,0);signal.Turret=turret;
            VisualFactory.Part(turret.transform,"Base",PrimitiveType.Cylinder,Vector3.up*.22f,new Vector3(.9f,.22f,.9f),steel,false);
            VisualFactory.Part(turret.transform,"Mount",PrimitiveType.Cube,Vector3.up*.8f,new Vector3(.28f,1.0f,.28f),steel,false);
            VisualFactory.Part(turret.transform,"Receiver",PrimitiveType.Cube,new Vector3(0,1.3f,0),new Vector3(.6f,.4f,.7f),dark,false);
            var barrel=VisualFactory.Part(turret.transform,"Barrel",PrimitiveType.Cylinder,new Vector3(0,1.3f,.6f),new Vector3(.12f,.55f,.12f),steel,false);barrel.transform.localRotation=Quaternion.Euler(90,0,0);
            VisualFactory.Part(turret.transform,"Status",PrimitiveType.Sphere,new Vector3(.32f,1.35f,0),Vector3.one*.12f,electric,false);turret.SetActive(false);
        }
        static void Dress(Chapter level)
        {
            var art=VisualFactory.Art;var wood=art!=null&&art.wood!=null?art.wood:dark;
            // Perimeter dressing is non-colliding and keeps the tested routes open.
            for(int side=-1;side<=1;side+=2)for(float z=level.bounds.z1+5;z<level.bounds.z2-4;z+=9)
            {
                float x=side<0?level.bounds.x1+1.1f:level.bounds.x2-1.1f;
                VisualFactory.Part(world,"WornBarrel",PrimitiveType.Cylinder,new Vector3(x,.55f,z),new Vector3(.7f,.55f,.7f),steel,false);
                foreach(float y in new[]{.15f,.95f})VisualFactory.Part(world,"BarrelBand",PrimitiveType.Cylinder,new Vector3(x,y,z),new Vector3(.73f,.025f,.73f),dark,false);
                for(int plank=0;plank<4;plank++)Box("PalletPlank",new Vector3(x,.11f,z+1.2f+plank*.22f),new Vector3(1.05f,.12f,.16f),wood,false);
                Box("WallPipe",new Vector3(x,2.2f,z+2),new Vector3(.09f,.09f,4),steel,false);
            }
            foreach(var o in level.obstacles)if(o.id.StartsWith("bus"))
            {
                bool across=o.x2-o.x1>o.z2-o.z1;float cx=(o.x1+o.x2)/2,cz=(o.z1+o.z2)/2;
                for(int axle=-1;axle<=1;axle+=2)for(int side=-1;side<=1;side+=2)
                {
                    var at=across?new Vector3(cx+axle*(o.x2-o.x1)*.32f,.48f,cz+side*(o.z2-o.z1)*.48f):new Vector3(cx+side*(o.x2-o.x1)*.48f,.48f,cz+axle*(o.z2-o.z1)*.32f);
                    var wheel=VisualFactory.Part(world,"BusWheel",PrimitiveType.Cylinder,at,new Vector3(.9f,.14f,.9f),dark,false);wheel.transform.rotation=across?Quaternion.Euler(90,0,0):Quaternion.Euler(0,0,90);
                }
                Box("BusRoofVent",new Vector3(cx,o.height+.07f,cz),new Vector3(across?2:.8f,.14f,across?.8f:2),steel,false);
                for(int side=-1;side<=1;side+=2)Box("BusBumper",across?new Vector3(side<0?o.x1:o.x2,.58f,cz):new Vector3(cx,.58f,side<0?o.z1:o.z2),across?new Vector3(.12f,.22f,o.z2-o.z1+.12f):new Vector3(o.x2-o.x1+.12f,.22f,.12f),steel,false);
            }
        }
        static void Obstacle(Obstacle o)
        {
            float width=o.x2-o.x1,depth=o.z2-o.z1;var centre=new Vector3((o.x1+o.x2)/2,o.height/2,(o.z1+o.z2)/2);var art=VisualFactory.Art;GameObject prefab=art==null?null:o.id.StartsWith("bus")?art.bus:o.id.StartsWith("container")?art.container:o.id.StartsWith("transformer")?art.transformer:null;
            if(prefab!=null)
            {
                var obj=Object.Instantiate(prefab,world);obj.name=o.id;obj.transform.position=centre;var renderers=obj.GetComponentsInChildren<Renderer>();if(renderers.Length>0){var bounds=renderers[0].bounds;foreach(var r in renderers)bounds.Encapsulate(r.bounds);obj.transform.localScale=Vector3.Scale(obj.transform.localScale,new Vector3(width/Mathf.Max(.01f,bounds.size.x),o.height/Mathf.Max(.01f,bounds.size.y),depth/Mathf.Max(.01f,bounds.size.z)));}
                Box(o.id+"_Collision",centre,new Vector3(width,o.height,depth),concrete).GetComponent<Renderer>().enabled=false;return;
            }
            if(o.id.StartsWith("bus"))
            {
                bool across=width>depth;Box(o.id,centre,new Vector3(width,o.height,depth),VisualFactory.Material(o.id.Contains("east")?"#9a8a65":"#476968",.35f,.3f));
                if(across)for(float x=o.x1+.5f;x<o.x2-.4f;x+=1.6f)Box("BusWindow",new Vector3(x,1.95f,o.z2+.015f),new Vector3(1.25f,.85f,.025f),VisualFactory.Material("#243a43",.5f,.82f),false);
                else for(float z=o.z1+.5f;z<o.z2-.4f;z+=1.6f)for(int side=-1;side<=1;side+=2)Box("BusWindow",new Vector3(centre.x+side*(width*.5f+.015f),1.95f,z),new Vector3(.025f,.85f,1.25f),VisualFactory.Material("#243a43",.5f,.82f),false);
            }
            else if(o.id.StartsWith("container"))
            { Box(o.id,centre,new Vector3(width,o.height,depth),steel);for(float z=o.z1+.2f;z<o.z2;z+=.55f)for(int side=-1;side<=1;side+=2)Box("Corrugation",new Vector3(centre.x+side*(width*.5f+.03f),o.height/2,z),new Vector3(.07f,o.height-.1f,.07f),dark,false); }
            else if(o.id.StartsWith("transformer")||o.id.StartsWith("reactor"))
            { Box(o.id,centre,new Vector3(width,o.height,depth),steel);for(float y=.3f;y<o.height;y+=.4f)Box("CoolingFin",new Vector3(centre.x,y,centre.z),new Vector3(width+.08f,.09f,depth+.08f),dark,false);for(int i=-1;i<=1;i+=2)VisualFactory.Part(world,"Insulator",PrimitiveType.Cylinder,new Vector3(centre.x+i*width*.3f,o.height+.4f,centre.z),new Vector3(.5f,.4f,.5f),VisualFactory.Material("#aeb8aa"),false); }
            else Box(o.id,centre,new Vector3(width,o.height,depth),concrete);
        }
        static void Depot()
        {
            Box("GarageRoof",new Vector3(17.7f,5,10),new Vector3(10,.25f,15),steel,false);
            for(float z=5;z<17;z+=3){Box("Workbench",new Vector3(21,.7f,z),new Vector3(1.2f,1.4f,2),steel);Lamp(new Vector3(18,4.7f,z),new Color(1,.82f,.6f),2);}
            for(int i=0;i<4;i++)Box("BuildingOutside",new Vector3(-31-i*2,4+i,15-i*13),new Vector3(7,8+i*2,8),dark,false);
            for(int i=0;i<3;i++){Box("ParkingBay",new Vector3(-4,.02f,15-i*7),new Vector3(8,.01f,.08f),VisualFactory.Material("#c4b583"),false);}
        }
        static void Harbor()
        {
            Box("WarehouseRoof",new Vector3(-21,5.2f,-3),new Vector3(20,.3f,31),steel,false);
            for(float z=-14;z<9;z+=6){Box("WarehouseShelf",new Vector3(-28,1.5f,z),new Vector3(1.6f,3,4),dark);Lamp(new Vector3(-21,4.8f,z),new Color(.6f,.8f,1),2);}
            Box("HarborWater",new Vector3(0,-.6f,-51),new Vector3(100,.15f,28),VisualFactory.Material("#244650",.5f,.9f),false);
            for(int i=0;i<3;i++){float x=-27+i*28;Box("CraneMast",new Vector3(x,11,-40),new Vector3(.6f,22,.6f),steel,false);Box("CraneBoom",new Vector3(x+7,21,-40),new Vector3(16,.5f,.5f),steel,false);Box("CraneCable",new Vector3(x+14,14,-40),new Vector3(.05f,14,.05f),dark,false);}
            var weather=new GameObject("Rain");weather.transform.position=new Vector3(0,17,0);var rain=weather.AddComponent<ParticleSystem>();var main=rain.main;main.maxParticles=650;main.startLifetime=1.5f;main.startSpeed=15;main.startSize=.025f;main.startColor=new Color(.6f,.75f,.85f,.4f);main.simulationSpace=ParticleSystemSimulationSpace.World;var shape=rain.shape;shape.shapeType=ParticleSystemShapeType.Box;shape.scale=new Vector3(65,.1f,65);weather.transform.rotation=Quaternion.Euler(90,0,0);var emission=rain.emission;emission.rateOverTime=400;var renderer=weather.GetComponent<ParticleSystemRenderer>();renderer.renderMode=ParticleSystemRenderMode.Stretch;renderer.lengthScale=1.5f;renderer.sharedMaterial=VisualFactory.Material("#829dab",0,.1f);
        }
        static void Reactor()
        {
            Box("ControlMezzanine",new Vector3(21,3,7),new Vector3(10,.4f,9),steel);
            for(int i=0;i<16;i++){float height=(i+1)*.2f;Box("Stair_"+i,new Vector3(21,height/2,17.8f-i*.4f),new Vector3(3,height,.4f),concrete);}
            for(float z=3;z<11.4f;z+=1.5f)for(int side=-1;side<=1;side+=2)Box("MezzanineRail",new Vector3(21+side*4.8f,3.7f,z),new Vector3(.08f,1,.08f),steel,false);
            Box("OverheadPipe",new Vector3(0,6.4f,-6),new Vector3(52,.6f,.6f),steel,false);
            for(int side=-1;side<=1;side+=2){VisualFactory.Part(world,"CoolingTower",PrimitiveType.Cylinder,new Vector3(side*37,8,-12),new Vector3(8,8,8),concrete,false);for(int i=0;i<3;i++)Box("PowerPylon",new Vector3(side*27,6,-5-i*10),new Vector3(.25f,12,.25f),steel,false);}
            for(int i=0;i<4;i++)Lamp(new Vector3(-7+i*5,5.8f,-18),new Color(1,.47f,.2f),2);
        }
        static void Lamp(Vector3 at,Color color,float intensity)
        { var obj=new GameObject("PracticalLight");obj.transform.SetParent(world);obj.transform.position=at;var light=obj.AddComponent<Light>();light.type=LightType.Point;light.color=color;light.intensity=intensity;light.range=12;light.shadows=LightShadows.None;VisualFactory.Part(world,"Lamp",PrimitiveType.Cube,at,new Vector3(.8f,.12f,.3f),VisualFactory.Material("#e2d2a5",0,.2f,true)); }
        static void LightEnvironment(Chapter level)
        {
            Color fog;ColorUtility.TryParseHtmlString(level.palette.fog,out fog);RenderSettings.fog=true;RenderSettings.fogColor=fog;RenderSettings.fogMode=FogMode.ExponentialSquared;RenderSettings.fogDensity=level.index==1?.013f:.006f;RenderSettings.ambientMode=AmbientMode.Trilight;RenderSettings.ambientSkyColor=level.index==1?new Color(.2f,.3f,.4f):new Color(.45f,.45f,.4f);RenderSettings.ambientGroundColor=new Color(.12f,.15f,.13f);
            LightingPreset.Apply(level);
            var sunObject=new GameObject("Sun");var sun=sunObject.AddComponent<Light>();sun.type=LightType.Directional;sun.intensity=level.index==1?.6f:1.5f;Color color;ColorUtility.TryParseHtmlString(level.palette.sun,out color);sun.color=color;sun.shadows=LightShadows.Soft;sunObject.transform.rotation=Quaternion.Euler(35,-32,0);RenderSettings.sun=sun;
            var fillObject=new GameObject("ReadableAmbientFill");var fill=fillObject.AddComponent<Light>();fill.type=LightType.Directional;fill.intensity=level.index==1?.95f:.8f;fill.color=level.index==1?new Color(.64f,.78f,1):new Color(.8f,.86f,.9f);fill.shadows=LightShadows.None;fillObject.transform.rotation=Quaternion.Euler(50,145,0);
            var volumeObject=new GameObject("GlobalVolume");var volume=volumeObject.AddComponent<Volume>();volume.isGlobal=true;var profile=ScriptableObject.CreateInstance<VolumeProfile>();profile.Add<Tonemapping>().mode.Override(TonemappingMode.ACES);var bloom=profile.Add<Bloom>();bloom.intensity.Override(.13f);bloom.threshold.Override(1.1f);volume.sharedProfile=profile;
            var probeObject=new GameObject("EnvironmentProbe");probeObject.transform.position=new Vector3(0,3,0);var probe=probeObject.AddComponent<ReflectionProbe>();probe.mode=ReflectionProbeMode.Realtime;probe.refreshMode=ReflectionProbeRefreshMode.OnAwake;probe.size=new Vector3(90,25,100);probe.resolution=128;probe.timeSlicingMode=ReflectionProbeTimeSlicingMode.AllFacesAtOnce;
            for(int side=-1;side<=1;side+=2)for(float z=level.bounds.z1+5;z<level.bounds.z2;z+=15)Lamp(new Vector3(side*(level.bounds.x2-3),5,z),level.index==1?new Color(.6f,.8f,1):new Color(1,.8f,.6f),1.5f);
        }
    }



}
