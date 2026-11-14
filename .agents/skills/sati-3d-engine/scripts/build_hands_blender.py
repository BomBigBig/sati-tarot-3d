"""
Blender 5.3 Studio Low-Poly Sculpted & Rigged First-Person Player Hands Builder for SATI
Generates `public/models/player_hands_custom.glb` (< 180 KB) with:
- Sculpted organic faceted low-poly palms, curved thumbs, tapered octagonal fingers + fingernails
- Crimson burgundy velvet flared sleeves with gold trim cuffs + braided gold bracelets
- Faceted gold bezel rings with Emerald (Index) and Ruby (Ring) gemstones skinned to finger bones
- Full skeletal Armature rig (`Wrist_L/R`, `Palm_L/R`, `Thumb1/2`, `Index1/2`, `Middle1/2`, `Ring1/2`, `Pinky1/2`)
- Smooth vertex weight skinning so fingers curl seamlessly with zero joint gaps

Run:
  blender -b --factory-startup --python .agents/skills/sati-3d-engine/scripts/build_hands_blender.py -- --preview
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", "..", ".."))
OUT_GLB = os.path.join(ROOT_DIR, "public", "models", "player_hands_custom.glb")
PREVIEW_DIR = os.path.join(ROOT_DIR, "tools", "blender_preview")


def make_mat(name, base_col, roughness=0.72, metallic=0.05, emissive=None, em_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*base_col, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emissive is not None and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emissive, 1.0)
            bsdf.inputs["Emission Strength"].default_value = em_strength
    return mat


def srgb_to_lin(col):
    return tuple(((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92 for c in col)


def create_materials():
    return {
        "skin_light": make_mat("PlayerSkin", srgb_to_lin((0.77, 0.54, 0.42)), roughness=0.64, metallic=0.03),
        "skin_shade": make_mat("PlayerSkinShade", srgb_to_lin((0.63, 0.41, 0.30)), roughness=0.70, metallic=0.03),
        "nail": make_mat("PlayerFingernail", srgb_to_lin((0.86, 0.68, 0.57)), roughness=0.40, metallic=0.04),
        "sleeve": make_mat("PlayerSleeve", srgb_to_lin((0.35, 0.09, 0.16)), roughness=0.84, metallic=0.04),
        "sleeve_inner": make_mat("PlayerSleeveInner", srgb_to_lin((0.20, 0.09, 0.28)), roughness=0.88, metallic=0.04),
        "gold": make_mat("PlayerCuffGold", srgb_to_lin((0.88, 0.67, 0.22)), roughness=0.30, metallic=0.76),
        "emerald": make_mat(
            "PlayerGemEmerald",
            srgb_to_lin((0.08, 0.62, 0.30)),
            roughness=0.14,
            metallic=0.10,
            emissive=srgb_to_lin((0.06, 0.46, 0.22)),
            em_strength=0.45,
        ),
        "ruby": make_mat(
            "PlayerGemRuby",
            srgb_to_lin((0.74, 0.11, 0.24)),
            roughness=0.14,
            metallic=0.10,
            emissive=srgb_to_lin((0.55, 0.08, 0.20)),
            em_strength=0.45,
        ),
    }


def add_loft(bm, rings, mat_idx=0, cap_start=True, cap_end=True, vertex_mat_fn=None):
    """Build an airtight flat-faceted lofted tube through ring point lists."""
    vert_rings = []
    n_pts = len(rings[0])
    for r in rings:
        row = [bm.verts.new(Vector(p)) for p in r]
        vert_rings.append(row)

    for ri in range(len(vert_rings) - 1):
        r0 = vert_rings[ri]
        r1 = vert_rings[ri + 1]
        for si in range(n_pts):
            sn = (si + 1) % n_pts
            try:
                f = bm.faces.new((r0[si], r0[sn], r1[sn], r1[si]))
                f.material_index = vertex_mat_fn(ri, si, f) if vertex_mat_fn else mat_idx
            except ValueError:
                pass

    if cap_start and len(vert_rings) > 0:
        try:
            fc = bm.faces.new(list(reversed(vert_rings[0])))
            fc.material_index = mat_idx
        except ValueError:
            pass
    if cap_end and len(vert_rings) > 0:
        try:
            fc = bm.faces.new(vert_rings[-1])
            fc.material_index = mat_idx
        except ValueError:
            pass
    return vert_rings


def add_faceted_gem_ring(bm, center, radius, thickness, tangent_dir, up_dir, mat_gold, mat_gem):
    """Create a 6-sided beveled gold ring band with a raised faceted jewel bezel on dorsal side."""
    axis_y = tangent_dir.normalized()
    axis_z = up_dir.normalized()
    axis_x = axis_y.cross(axis_z).normalized()
    axis_z = axis_x.cross(axis_y).normalized()

    def to_world(lx, ly, lz):
        return center + axis_x * lx + axis_y * ly + axis_z * lz

    segs = 8
    r_in = radius * 0.90
    r_out = radius * 1.15
    half_w = thickness * 0.5

    outer_rings = []
    for y_off in (-half_w, half_w):
        ring = []
        for s in range(segs):
            a = s * 2.0 * math.pi / segs + math.pi / segs
            # Slightly flatten ring profile vertically while proud on dorsal crown
            ring.append(to_world(math.cos(a) * r_out, y_off, math.sin(a) * r_out * 0.96))
        outer_rings.append(ring)

    inner_rings = []
    for y_off in (-half_w, half_w):
        ring = []
        for s in range(segs):
            a = s * 2.0 * math.pi / segs + math.pi / segs
            ring.append(to_world(math.cos(a) * r_in, y_off, math.sin(a) * r_in * 0.96))
        inner_rings.append(ring)

    v_out0 = [bm.verts.new(p) for p in outer_rings[0]]
    v_out1 = [bm.verts.new(p) for p in outer_rings[1]]
    v_in0 = [bm.verts.new(p) for p in inner_rings[0]]
    v_in1 = [bm.verts.new(p) for p in inner_rings[1]]

    for s in range(segs):
        sn = (s + 1) % segs
        for quad in [
            (v_out0[s], v_out0[sn], v_out1[sn], v_out1[s]),
            (v_in1[s], v_in1[sn], v_in0[sn], v_in0[s]),
            (v_in0[s], v_in0[sn], v_out0[sn], v_out0[s]),
            (v_out1[s], v_out1[sn], v_in1[sn], v_in1[s]),
        ]:
            try:
                f = bm.faces.new(quad)
                f.material_index = mat_gold
            except ValueError:
                pass

    # Dorsal Gold Bezel Crown + Faceted Octagonal Cushion Gem (sleek & jewel-proportioned)
    crown_base = [
        to_world(-0.0085, -0.0085, r_out * 0.90),
        to_world(0.0085, -0.0085, r_out * 0.90),
        to_world(0.0085, 0.0085, r_out * 0.90),
        to_world(-0.0085, 0.0085, r_out * 0.90),
    ]
    crown_top = [
        to_world(-0.0098, -0.0098, r_out * 1.18),
        to_world(0.0098, -0.0098, r_out * 1.18),
        to_world(0.0098, 0.0098, r_out * 1.18),
        to_world(-0.0098, 0.0098, r_out * 1.18),
    ]
    add_loft(bm, [crown_base, crown_top], mat_idx=mat_gold)

    gem_base = [
        to_world(-0.0076, -0.0076, r_out * 1.16),
        to_world(0.0076, -0.0076, r_out * 1.16),
        to_world(0.0076, 0.0076, r_out * 1.16),
        to_world(-0.0076, 0.0076, r_out * 1.16),
    ]
    gem_table = [
        to_world(-0.0044, -0.0044, r_out * 1.46),
        to_world(0.0044, -0.0044, r_out * 1.46),
        to_world(0.0044, 0.0044, r_out * 1.46),
        to_world(-0.0044, 0.0044, r_out * 1.46),
    ]
    add_loft(bm, [gem_base, gem_table], mat_idx=mat_gem)


def build_single_hand(side, suffix, mats):
    """
    Build one sculpted faceted low-poly hand + forearm sleeve + skeleton Armature.
    Blender local space:
      Origin = Wrist pivot (0, 0, 0)
      +Y = forward toward cards/crystal ball (-Z in glTF)
      -Y = forearm back toward player camera (+Z in glTF)
      +Z = dorsal hand top (+Y in glTF)
      side = -1 for Left Hand (thumb on +X inner side), +1 for Right Hand (thumb on -X inner side)
    """
    hand_root = bpy.data.objects.new(
        "PlayerLeftHand" if side < 0 else "PlayerRightHand", None
    )
    bpy.context.scene.collection.objects.link(hand_root)
    # Default world staging position (scene engine overrides per frame, fallback sane!)
    hand_root.location = (side * 0.78, -2.08, 1.18)

    arm_data = bpy.data.armatures.new(f"HandRig_{suffix}")
    arm_obj = bpy.data.objects.new(f"HandArmature_{suffix}", arm_data)
    arm_obj.parent = hand_root
    bpy.context.scene.collection.objects.link(arm_obj)

    mesh_data = bpy.data.meshes.new(f"HandMeshData_{suffix}")
    mesh_obj = bpy.data.objects.new(f"HandMesh_{suffix}", mesh_data)
    mesh_obj.parent = arm_obj
    bpy.context.scene.collection.objects.link(mesh_obj)

    mat_keys = ["skin_light", "skin_shade", "nail", "sleeve", "sleeve_inner", "gold", "emerald", "ruby"]
    for mk in mat_keys:
        mesh_data.materials.append(mats[mk])
    M = {k: i for i, k in enumerate(mat_keys)}

    bm = bmesh.new()
    inner = -side  # +1 for Left Hand (thumb toward center), -1 for Right Hand

    # --- 1. Sculpted Long Crimson Forearm Sleeve + Gold Cuff + Bracelet (-Y behind wrist) ---
    sleeve_rings = []
    # Extended forearm (-1.05m back from wrist) so sleeves stay continuously anchored off-screen even during deep forward reach!
    sleeve_specs = [
        (-1.05, 0.115, 0.095, -0.095, 0.008),
        (-0.68, 0.098, 0.080, -0.058, 0.009),
        (-0.36, 0.084, 0.068, -0.028, 0.008),
        (-0.18, 0.070, 0.056, -0.013, 0.006),
        (-0.056, 0.060, 0.047, -0.004, 0.003),
        (-0.048, 0.050, 0.035, -0.002, 0.0),
    ]
    for y, rx, rz, z_off, fold in sleeve_specs:
        ring = []
        for s in range(10):
            a = s * 2.0 * math.pi / 10.0 + math.pi / 10.0
            wave = math.sin(a * 5.0) * fold
            ring.append((math.cos(a) * (rx + wave), y, z_off + math.sin(a) * (rz + wave)))
        sleeve_rings.append(ring)
    add_loft(bm, sleeve_rings, mat_idx=M["sleeve"], cap_start=True, cap_end=True)

    # Wide Sculpted Gold Cuff Ring + Inner Plum Sleeve Lining
    cuff_rings = []
    for y, rx, rz in [(-0.055, 0.062, 0.049), (-0.025, 0.056, 0.044)]:
        cuff_rings.append([
            (math.cos(s * 2.0 * math.pi / 10.0 + math.pi / 10.0) * rx, y, math.sin(s * 2.0 * math.pi / 10.0 + math.pi / 10.0) * rz - 0.003)
            for s in range(10)
        ])
    add_loft(bm, cuff_rings, mat_idx=M["gold"], cap_start=True, cap_end=True)

    # Braided Gold Wrist Bracelet cleanly circling wrist ahead of sleeve cuff (y = -0.022 .. -0.008)
    brc_rings = []
    for y, rx, rz in [(-0.022, 0.048, 0.030), (-0.008, 0.046, 0.028)]:
        brc_rings.append([
            (math.cos(s * 2.0 * math.pi / 10.0) * rx, y, math.sin(s * 2.0 * math.pi / 10.0) * rz)
            for s in range(10)
        ])
    add_loft(bm, brc_rings, mat_idx=M["gold"], cap_start=True, cap_end=True)

    bm.verts.ensure_lookup_table()
    wrist_vert_end = len(bm.verts)

    # --- 2. Anatomical Low-Poly Sculpted Palm (wrist y=-0.012 -> knuckle bridge y=+0.104) ---
    # Tapered trapezoid palm with distinct beveled knuckle arch and recessed pinky corner
    palm_specs = [
        (-0.012, 0.040, 0.021, -0.019, 0.0, 0.0),
        (0.025, 0.049, 0.024, -0.021, inner * 0.006, 0.003),
        (0.066, 0.056, 0.025, -0.020, inner * 0.005, 0.006),
        (0.102, 0.051, 0.021, -0.017, inner * 0.002, 0.003),
    ]
    palm_rings = []
    for y, hw, zt, zb, xoff, zarch in palm_specs:
        # 10-point anatomical cross section (dorsal arch top, flattened/cupped underside, chamfered edges)
        pts_norm = [
            (0.95, 0.15), (0.72, 0.78), (0.25, 1.00), (-0.25, 1.00), (-0.72, 0.75),
            (-0.95, 0.12), (-0.70, -0.82), (-0.20, -0.78), (0.20, -0.78), (0.70, -0.85),
        ]
        ring = []
        for nx, nz in pts_norm:
            px = xoff + nx * hw
            pz = zarch + (nz * zt if nz >= 0 else abs(nz) * zb)
            ring.append((px, y, pz))
        palm_rings.append(ring)

    def palm_mat_fn(ri, si, f):
        return M["skin_shade"] if si in (5, 6, 7, 8, 9) and f.calc_center_median().z < -0.006 else M["skin_light"]

    add_loft(bm, palm_rings, mat_idx=M["skin_light"], vertex_mat_fn=palm_mat_fn)
    bm.verts.ensure_lookup_table()
    palm_vert_end = len(bm.verts)

    # --- 3. Sculpted 5 Fingers (Proximal + Distal Tapered Prisms + Fingernails) ---
    finger_specs = [
        (
            "Thumb",
            Vector((inner * 0.042, 0.028, -0.003)),
            Vector((inner * 0.52, 0.78, -0.20)).normalized(),
            0.048,
            0.042,
            0.014,
            None,
        ),
        (
            "Index",
            Vector((inner * 0.040, 0.098, 0.003)),
            Vector((inner * 0.10, 0.99, -0.08)).normalized(),
            0.056,
            0.052,
            0.0120,
            "emerald",
        ),
        (
            "Middle",
            Vector((inner * 0.014, 0.103, 0.005)),
            Vector((inner * 0.02, 0.99, -0.09)).normalized(),
            0.062,
            0.056,
            0.0124,
            None,
        ),
        (
            "Ring",
            Vector((-inner * 0.015, 0.099, 0.004)),
            Vector((-inner * 0.06, 0.99, -0.11)).normalized(),
            0.057,
            0.052,
            0.0115,
            "ruby",
        ),
        (
            "Pinky",
            Vector((-inner * 0.041, 0.092, 0.001)),
            Vector((-inner * 0.16, 0.97, -0.13)).normalized(),
            0.050,
            0.046,
            0.0102,
            None,
        ),
    ]

    finger_joints = {}
    finger_vert_ranges = {}

    for fname, p_start, fdir, len1, len2, rb, ring_gem in finger_specs:
        bm.verts.ensure_lookup_table()
        f_vstart = len(bm.verts)
        axis_y = fdir.normalized()
        up_approx = Vector((0, 0, 1)) if fname != "Thumb" else Vector((-inner * 0.25, 0.1, 0.95)).normalized()
        axis_x = axis_y.cross(up_approx).normalized()
        axis_z = axis_x.cross(axis_y).normalized()

        # Subtle downward natural curve at distal joint
        dist_dir = (axis_y - axis_z * 0.14).normalized()
        d_x = dist_dir.cross(axis_z).normalized()
        d_z = d_x.cross(dist_dir).normalized()

        p_mid = p_start + axis_y * len1
        p_end = p_mid + dist_dir * len2

        finger_joints[fname] = (p_start, p_mid, p_end)

        def cyl_ring(center, ax_x, ax_z, r_scale_x, r_scale_z):
            pts = []
            for s in range(6):
                a = s * 2.0 * math.pi / 6.0 + math.pi / 6.0
                pts.append(center + ax_x * (math.cos(a) * r_scale_x) + ax_z * (math.sin(a) * r_scale_z))
            return pts

        rings = [
            cyl_ring(p_start - axis_y * 0.006, axis_x, axis_z, rb * 1.06, rb * 0.98),
            cyl_ring(p_start + axis_y * (len1 * 0.55), axis_x, axis_z, rb * 0.92, rb * 0.88),
            cyl_ring(p_mid, axis_x, axis_z, rb * 0.96, rb * 0.90),  # Knuckle joint ridge
            cyl_ring(p_mid + dist_dir * (len2 * 0.52), d_x, d_z, rb * 0.82, rb * 0.78),
            cyl_ring(p_end - dist_dir * 0.007, d_x, d_z, rb * 0.70, rb * 0.60),
            cyl_ring(p_end, d_x, d_z, rb * 0.42, rb * 0.36),
        ]

        def f_mat_fn(ri, si, f):
            # Subtle fingernail facet on distal dorsal face + underside shading
            if ri == 4 and si in (1, 2):
                return M["nail"]
            if si in (4, 5):
                return M["skin_shade"]
            return M["skin_light"]

        add_loft(bm, rings, mat_idx=M["skin_light"], vertex_mat_fn=f_mat_fn)
        bm.verts.ensure_lookup_table()
        f_tube_end = len(bm.verts)

        if ring_gem:
            ring_pos = p_start + axis_y * (len1 * 0.52)
            add_faceted_gem_ring(
                bm, ring_pos, rb * 0.95, 0.011, axis_y, axis_z, M["gold"], M[ring_gem]
            )

        bm.verts.ensure_lookup_table()
        finger_vert_ranges[fname] = (f_vstart, f_tube_end, len(bm.verts))

    bm.normal_update()
    bm.to_mesh(mesh_data)
    bm.free()

    # Keep razor crisp flat-shaded facets matching sati_custom.glb!
    for poly in mesh_data.polygons:
        poly.use_smooth = False

    # --- 4. Skeletal Armature Setup & Deterministic Clean Bone Skinning ---
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    ebones = arm_data.edit_bones

    def make_bone(name, head, tail, parent_bone=None):
        b = ebones.new(name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        b.roll = 0.0
        if parent_bone is not None:
            b.parent = parent_bone
            b.use_connect = False
        return b

    b_wrist = make_bone(f"Wrist_{suffix}", (0.0, -0.34, 0.0), (0.0, -0.01, 0.0))
    b_palm = make_bone(f"Palm_{suffix}", (0.0, 0.0, 0.0), (0.0, 0.105, 0.0), b_wrist)

    bone_segments = {}
    for fname, (p_start, p_mid, p_end) in finger_joints.items():
        b1 = make_bone(f"{fname}1_{suffix}", p_start, p_mid, b_palm)
        b2 = make_bone(f"{fname}2_{suffix}", p_mid, p_end, b1)
        bone_segments[fname] = (p_start, p_mid, p_end, b1.name, b2.name)

    bpy.ops.object.mode_set(mode="OBJECT")

    # Surgical mesh-segment vertex group skinning (zero cross-finger or knuckle bleeding!)
    vgroups = {name: mesh_obj.vertex_groups.new(name=name) for name in [
        f"Wrist_{suffix}", f"Palm_{suffix}",
        *[f"{fn}1_{suffix}" for fn in finger_joints],
        *[f"{fn}2_{suffix}" for fn in finger_joints],
    ]}

    # 1) Sleeve + Cuff + Bracelet -> 100% Wrist
    if wrist_vert_end > 0:
        vgroups[f"Wrist_{suffix}"].add(list(range(0, wrist_vert_end)), 1.0, "REPLACE")
    # 2) Sculpted Palm -> 100% Palm
    if palm_vert_end > wrist_vert_end:
        vgroups[f"Palm_{suffix}"].add(list(range(wrist_vert_end, palm_vert_end)), 1.0, "REPLACE")

    # 3) Each Finger tube & its ring strictly skinned to its own Phalanx bones
    verts = mesh_data.vertices
    for fname, (p0, p1, p2, bn1, bn2) in bone_segments.items():
        v_start, v_tube_end, v_total_end = finger_vert_ranges[fname]
        # Ring vertices (v_tube_end .. v_total_end) ride 100% rigidly on Proximal bone bn1
        if v_total_end > v_tube_end:
            vgroups[bn1].add(list(range(v_tube_end, v_total_end)), 1.0, "REPLACE")
        # 6 hex rings * 6 verts per ring:
        # ring 0 (base), ring 1 (mid prox), ring 2 (PIP knuckle), ring 3 (mid dist), ring 4..5 (tip)
        for vi in range(v_start, v_tube_end):
            ring_idx = (vi - v_start) // 6
            if ring_idx == 0:
                vgroups[f"Palm_{suffix}"].add([vi], 0.35, "REPLACE")
                vgroups[bn1].add([vi], 0.65, "REPLACE")
            elif ring_idx == 1:
                vgroups[bn1].add([vi], 1.0, "REPLACE")
            elif ring_idx == 2:
                vgroups[bn1].add([vi], 0.50, "REPLACE")
                vgroups[bn2].add([vi], 0.50, "REPLACE")
            else:
                vgroups[bn2].add([vi], 1.0, "REPLACE")

    arm_mod = mesh_obj.modifiers.new(name="ArmatureSkin", type="ARMATURE")
    arm_mod.object = arm_obj

    return hand_root, arm_obj, mesh_obj


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    mats = create_materials()
    l_root, l_arm, l_mesh = build_single_hand(-1.0, "L", mats)
    r_root, r_arm, r_mesh = build_single_hand(1.0, "R", mats)

    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_skins=True,
        export_animations=False,
    )
    kb = os.path.getsize(OUT_GLB) / 1024.0
    print(f"[SATI-HANDS-BLENDER] Exported -> {OUT_GLB} ({kb:.1f} KB)")

    if "--preview" in sys.argv:
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        # Position hands close together for clean studio preview framing
        l_root.location = (-0.16, 0.0, 0.0)
        r_root.location = (0.16, 0.0, 0.0)

        scene = bpy.context.scene
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = 900
        scene.render.resolution_y = 640
        scene.world = bpy.data.worlds.new("HandsWorld")
        scene.world.use_nodes = True
        bg = scene.world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs[0].default_value = (0.10, 0.05, 0.12, 1.0)
            bg.inputs[1].default_value = 1.2

        key = bpy.data.lights.new("Key", type="SUN")
        key.energy = 3.2
        key.color = (1.0, 0.90, 0.80)
        kobj = bpy.data.objects.new("Key", key)
        kobj.rotation_euler = (0.7, 0.2, -0.4)
        scene.collection.objects.link(kobj)

        fill = bpy.data.lights.new("Fill", type="POINT")
        fill.energy = 65.0
        fill.color = (0.76, 0.65, 1.0)
        fobj = bpy.data.objects.new("Fill", fill)
        fobj.location = (0.0, 0.35, 0.85)
        scene.collection.objects.link(fobj)

        cam_data = bpy.data.cameras.new("PrevCam")
        cam = bpy.data.objects.new("PrevCam", cam_data)
        scene.collection.objects.link(cam)
        scene.camera = cam
        cam.location = Vector((0.0, -0.48, 0.42))
        cam.rotation_euler = (Vector((0.0, 0.04, 0.0)) - cam.location).to_track_quat("-Z", "Y").to_euler()

        scene.render.filepath = os.path.join(PREVIEW_DIR, "hands_preview.png")
        bpy.ops.render.render(write_still=True)
        print(f"[SATI-HANDS-BLENDER] Preview rendered -> {scene.render.filepath}")

        # Second preview: pose Left hand in pinch & Right hand curled cupping crystal to verify skinning!
        for arm_o, sfx in [(l_arm, "L"), (r_arm, "R")]:
            for fn, rx1, rx2 in [("Index", -0.45, -0.65), ("Thumb", -0.25, -0.55), ("Middle", -0.35, -0.55), ("Ring", -0.45, -0.65), ("Pinky", -0.55, -0.75)]:
                for j, ang in [(1, rx1), (2, rx2)]:
                    pb = arm_o.pose.bones.get(f"{fn}{j}_{sfx}")
                    if pb:
                        pb.rotation_mode = "XYZ"
                        pb.rotation_euler = Euler((ang, 0.0, 0.0), "XYZ")
        l_root.rotation_euler = (0.18, 0.0, -0.42)
        r_root.rotation_euler = (0.18, 0.0, 0.42)
        scene.render.filepath = os.path.join(PREVIEW_DIR, "hands_curled_preview.png")
        bpy.ops.render.render(write_still=True)
        print(f"[SATI-HANDS-BLENDER] Curled pose preview rendered -> {scene.render.filepath}")


if __name__ == "__main__":
    main()
