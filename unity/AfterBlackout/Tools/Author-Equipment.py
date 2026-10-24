# Authored geometry; Blender 2.79 background exporter (no external scripts are executed).
import bpy, math, os
base=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'Assets','Blackout','Art','Weapons')
def reset():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def material(name,rgb):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.diffuse_color=rgb;return m
def box(name,at,size,mat,bevel=.008):
    bpy.ops.mesh.primitive_cube_add(location=at);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Machined edge','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def cylinder(name,at,radius,depth,mat,rotation=(0,0,0),vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=at,rotation=rotation);o=bpy.context.object;o.name=name;o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o
def export(name):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.fbx(filepath=base+'/'+name+'.fbx',use_selection=True,object_types={'MESH'},bake_anim=False,add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True)
reset();steel=material('ParkerizedSteel',(.12,.15,.16));edge=material('BrushedSteel',(.36,.39,.4));grip=material('RubberGrip',(.065,.075,.065));olive=material('OlivePolymer',(.2,.24,.16))
# Blender Y = barrel axis, Z = up. Resulting Unity prefab is normalized by the editor importer.
box('AWM chassis',(0,0,.055),(.11,.53,.11),olive)
box('Adjustable buttstock',(0,-.42,.035),(.095,.32,.18),olive,.018);box('Rubber shoulder pad',(0,-.60,.035),(.10,.025,.20),grip)
box('Cheek rest',(0,-.40,.15),(.105,.23,.05),grip)
handle=box('Pistol grip',(0,-.18,-.10),(.075,.105,.19),grip,.015);handle.rotation_euler.x=-.25
box('Detachable magazine',(0,.04,-.10),(.065,.13,.15),steel)
cylinder('Receiver',(0,.08,.13),.046,.40,steel,(math.pi/2,0,0))
cylinder('Free floated barrel',(0,.49,.13),.017,.55,edge,(math.pi/2,0,0))
cylinder('Muzzle brake',(0,.78,.13),.027,.07,steel,(math.pi/2,0,0))
for y in [.76,.78,.80]:box('Brake port',(0,y,.155),(.045,.008,.014),grip,.002)
for y in [-.08,.15]:box('Scope rail mount',(0,y,.19),(.08,.045,.035),edge,.002)
for i in range(13):box('Picatinny rail',(0,-.12+i*.021,.20),(.085,.010,.012),steel,.002)
cylinder('Bolt handle stem',(.07,-.03,.13),.009,.10,edge,(0,math.pi/2,0),16)
cylinder('Bolt knob',(.12,-.03,.13),.022,.035,grip,(0,math.pi/2,0),20)
for side in [-1,1]:
    leg=cylinder('Folded bipod',(side*.055,.35,.005),.012,.22,steel,(math.pi/2,0,side*.12),16)
    for i in range(5):box('Grip checkering',(side*.04,-.18,-.07-i*.022),(.007,.095,.006),edge,.001)
export('awm')
for kind,length,width in [('combat',.29,.045),('karambit',.23,.035),('machete',.48,.075),('katana',.70,.035),('axe',.52,.035)]:
    reset();handle_length=.28 if kind in ['katana','axe'] else .14
    cylinder('Textured grip',(0,0,-handle_length/2),.024,handle_length,grip)
    for i in range(9):cylinder('Grip ridge',(0,0,-handle_length+i*handle_length/9),.026,.005,steel,vertices=16)
    box('Guard',(0,0,0),(.12,.065,.018),edge,.003)
    if kind=='axe':
        cylinder('Steel shaft',(0,0,.22),.018,.48,steel);profile=[(-.035,.38),(.17,.34),(.23,.49),(.15,.58),(-.04,.52)]
    elif kind=='karambit':profile=[(-.018,0),(.018,0),(.08,.05),(.13,.12),(.11,.21),(.03,.25),(.07,.18),(.055,.12),(.01,.07)]
    else:profile=[(-width/2,0),(width/2,0),(width/2,length*.82),(0,length),(-width/2,length*.84)]
    thickness=.025 if kind=='axe' else .009
    verts=[(x,y,z) for y in [-thickness/2,thickness/2] for x,z in profile];n=len(profile);faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new('Forged blade');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Blade',mesh);bpy.context.scene.objects.link(o);o.data.materials.append(edge)
    bpy.context.scene.objects.active=o;o.select=True;mod=o.modifiers.new('Sharpened bevel','BEVEL');mod.width=.004;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
    if kind=='katana':
        for i in range(9):wrap=box('Tsuka wrapping',(0,0,-.25+i*.027),(.056,.05,.009),olive,.001);wrap.rotation_euler.z=.5
    export(kind)
reset();box('BeveledUnit', (0,0,0), (1,1,1), steel, .07);export('beveled')
