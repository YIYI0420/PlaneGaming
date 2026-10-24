# Blender 2.79, background only; source blend auto-execution is disabled by the caller.
import bpy, os, json
from mathutils import Vector
base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
source = base + '/Tools/Downloads/SmallArms'
output = base + '/Assets/Blackout/Art/Weapons'
os.makedirs(output, exist_ok=True)
report = []
for name in ['ak47', 'm1911']:
    bpy.ops.wm.open_mainfile(filepath=source + '/' + name + '.blend', load_ui=False, use_scripts=False)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select = True
    coords = [obj.matrix_world * Vector(v) for obj in meshes for v in obj.bound_box]
    report.append({'id':name, 'min':[min(v[i] for v in coords) for i in range(3)], 'max':[max(v[i] for v in coords) for i in range(3)], 'objects':[(o.name,len(o.data.polygons)) for o in meshes]})
    bpy.ops.export_scene.fbx(filepath=output+'/'+name+'.fbx', use_selection=True, object_types={'MESH'}, bake_anim=False, add_leaf_bones=False, axis_forward='-Z', axis_up='Y', apply_unit_scale=True)
with open(base + '/Tools/Downloads/weapons-bounds.json','w') as f: json.dump(report,f,indent=2)
