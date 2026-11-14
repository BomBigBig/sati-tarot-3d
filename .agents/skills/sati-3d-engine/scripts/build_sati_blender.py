"""
Blender 5.3 Studio Stylized Low-Poly Character & Living Rig Builder for SATI (สำรับแห่งสติ)
Generates `public/models/sati_custom.glb` with sculpted faceted craftsmanship matching the
reference turnaround & tent art, packed 1024px UV embroidery/eye/card atlases, open hollow sleeves,
5-fingered hands, palm crystal orb stand, and 4 unified NLA animation clips (`Idle`, `Shuffle`,
`Thinking`, `Talk`) combining Bone Animation + Eye Gaze + Eyelid Blink & Jaw/Mouth Morph Targets.

Run:
  blender -b --factory-startup --python .agents/skills/sati-3d-engine/scripts/build_sati_blender.py -- --preview
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", "..", ".."))
OUT_GLB = os.path.join(ROOT_DIR, "public", "models", "sati_custom.glb")
PREVIEW_DIR = os.path.join(ROOT_DIR, "tools", "blender_preview")


# =============================================================================
# 1. PROCEDURAL NUMPY TEXTURE GENERATION (PACKED INTO GLB)
# =============================================================================
def _draw_filled_poly(buf, pts, rgba):
    h, w, _ = buf.shape
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0 = max(0, int(min(xs)) - 1)
    x1 = min(w - 1, int(max(xs)) + 1)
    y0 = max(0, int(min(ys)) - 1)
    y1 = min(h - 1, int(max(ys)) + 1)
    if x1 < x0 or y1 < y0:
        return
    yy, xx = np.mgrid[y0 : y1 + 1, x0 : x1 + 1]
    inside = np.zeros(xx.shape, dtype=bool)
    n = len(pts)
    j = n - 1
    for i in range(n):
        xi, yi = pts[i]
        xj, yj = pts[j]
        cond = ((yi > yy) != (yj > yy)) & (
            xx < (xj - xi) * (yy - yi) / (yj - yi + 1e-12) + xi
        )
        inside ^= cond
        j = i
    buf[y0 : y1 + 1, x0 : x1 + 1][inside] = rgba


def _draw_star8(buf, cx, cy, r_out, r_in, rgba):
    pts = []
    for i in range(16):
        r = r_out if i % 2 == 0 else r_in
        a = i * math.pi / 8.0 - math.pi / 2.0
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    _draw_filled_poly(buf, pts, rgba)


def _draw_diamond(buf, cx, cy, rx, ry, rgba):
    _draw_filled_poly(
        buf, [(cx, cy - ry), (cx + rx, cy), (cx, cy + ry), (cx - rx, cy)], rgba
    )


def _draw_crescent(buf, cx, cy, r, facing, fg_rgba):
    h, w, _ = buf.shape
    x0 = max(0, int(cx - r * 1.3))
    x1 = min(w - 1, int(cx + r * 1.3))
    y0 = max(0, int(cy - r * 1.3))
    y1 = min(h - 1, int(cy + r * 1.3))
    if x1 < x0 or y1 < y0:
        return
    yy, xx = np.mgrid[y0 : y1 + 1, x0 : x1 + 1]
    d1 = (xx - cx) ** 2 + (yy - cy) ** 2 <= r**2
    ox = cx + facing * r * 0.42
    oy = cy + r * 0.08
    d2 = (xx - ox) ** 2 + (yy - oy) ** 2 <= (r * 0.80) ** 2
    buf[y0 : y1 + 1, x0 : x1 + 1][d1 & (~d2)] = fg_rgba


def make_bpy_image(name, buf_float):
    h, w, _ = buf_float.shape
    img = bpy.data.images.new(name, width=w, height=h, alpha=False)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(buf_float[:, :, :3], 0.0, 1.0)
    img.pixels.foreach_set(np.flipud(rgba).ravel())
    img.pack()
    return img


def create_textures():
    textures = {}

    # A. Robe + Lavender Apron Atlas (1024x1024)
    # Note: image row 0 = TOP (UV V=1.0), row 1023 = BOTTOM (UV V=0.0)
    W, H = 1024, 1024
    buf = np.zeros((H, W, 3), dtype=np.float32)
    y_norm = np.linspace(0.0, 1.0, H)[:, None, None]
    burgundy = np.array([0.36, 0.11, 0.15], dtype=np.float32) * (1.0 - 0.15 * y_norm)
    buf[:, :, :] = burgundy

    ax0, ax1 = int(0.39 * W), int(0.61 * W)
    apron = np.array([0.44, 0.19, 0.58], dtype=np.float32) * (1.0 - 0.12 * y_norm)
    buf[:, ax0:ax1, :] = apron

    gold = np.array([0.85, 0.67, 0.22], dtype=np.float32)
    gold_hi = np.array([0.95, 0.79, 0.36], dtype=np.float32)
    violet_bright = np.array([0.64, 0.36, 0.80], dtype=np.float32)
    crimson_sash = np.array([0.55, 0.13, 0.23], dtype=np.float32)

    # Bottom wide gold border trim (row 880..985 near V=0.04..0.14)
    buf[885:980, :ax0] = gold
    buf[885:980, ax1:] = gold
    buf[878:886, :ax0] = gold_hi
    buf[878:886, ax1:] = gold_hi
    buf[932:980, ax0:ax1] = np.array([0.30, 0.12, 0.42], dtype=np.float32)

    # Crimson waist sash across upper waist UV (row 105..215, V ~ 0.80..0.90)
    buf[105:215, :] = crimson_sash
    buf[98:106, :] = np.array([0.66, 0.19, 0.29], dtype=np.float32)

    # Center purple apron vertical geometric diamonds & stars
    acx = (ax0 + ax1) // 2
    for row_y in range(285, 865, 118):
        _draw_diamond(buf, acx, row_y, 40, 44, violet_bright)
        _draw_star8(buf, acx, row_y, 14, 5, np.array([0.82, 0.62, 0.96], dtype=np.float32))
        _draw_diamond(buf, acx - 54, row_y + 56, 16, 20, np.array([0.31, 0.12, 0.42], dtype=np.float32))
        _draw_diamond(buf, acx + 54, row_y + 56, 16, 20, np.array([0.31, 0.12, 0.42], dtype=np.float32))

    # Gold front vertical trim bands framing apron
    buf[215:890, ax0 - 22 : ax0 + 6] = gold
    buf[215:890, ax1 - 6 : ax1 + 22] = gold

    # Gold Stars & Crescent Moons prominently on front burgundy lapels (matching reference!)
    for side, x_base in [(-1, 315), (1, W - 315)]:
        _draw_star8(buf, x_base, 395, 34, 13, gold)
        _draw_crescent(buf, x_base + side * 6, 585, 38, -side, gold)
        _draw_star8(buf, x_base - side * 24, 735, 22, 8, gold_hi)
        _draw_diamond(buf, x_base + side * 6, 290, 10, 16, gold_hi)
    # Outer side panel stars/moons (visible in 3/4 turn)
    for side, x_side in [(-1, 130), (1, W - 130)]:
        _draw_star8(buf, x_side, 500, 28, 10, gold)
        _draw_crescent(buf, x_side, 710, 32, side, gold)

    textures["robe"] = make_bpy_image("RobeCustomAtlas", buf)

    # B. Purple Stole Scarf with Gold Zigzag & Coral Accent (512x512)
    SW, SH = 512, 512
    stole = np.zeros((SH, SW, 3), dtype=np.float32)
    sy = np.linspace(0.0, 1.0, SH)[:, None, None]
    stole[:, :, :] = np.array([0.46, 0.18, 0.64], dtype=np.float32) * (1.0 - 0.12 * sy)
    stole[348:376, :] = np.array([0.84, 0.49, 0.24], dtype=np.float32)
    stole[376:438, :] = np.array([0.28, 0.08, 0.22], dtype=np.float32)
    for x in range(36, SW, 72):
        _draw_filled_poly(stole, [(x - 28, 434), (x, 382), (x + 28, 434)], gold)
    stole[438:464, :] = gold
    stole[464:, :] = np.array([0.36, 0.13, 0.50], dtype=np.float32)
    textures["stole"] = make_bpy_image("StoleTrimAtlas", stole)

    # C. Expressive Realistic Stylized Eye Texture (256x256)
    EW = 256
    eye = np.ones((EW, EW, 3), dtype=np.float32) * np.array([0.96, 0.94, 0.91], dtype=np.float32)
    yy, xx = np.mgrid[0:EW, 0:EW]
    cx, cy = EW * 0.5, EW * 0.5
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    eye[dist <= 64] = np.array([0.14, 0.08, 0.06], dtype=np.float32)
    eye[dist <= 55] = np.array([0.38, 0.22, 0.13], dtype=np.float32)
    eye[dist <= 31] = np.array([0.04, 0.03, 0.04], dtype=np.float32)
    glint = ((xx - (cx - 17)) ** 2 + (yy - (cy - 17)) ** 2) <= 10**2
    eye[glint] = np.array([1.0, 0.99, 0.96], dtype=np.float32)
    textures["eye"] = make_bpy_image("SatiEyeIris", eye)

    # D. 3D Tarot Card Back Texture for Shuffling Cascade (256x384) matching parchment-gold deck
    CW, CH = 256, 384
    parchment = np.array([0.93, 0.89, 0.80], dtype=np.float32)
    card = np.ones((CH, CW, 3), dtype=np.float32) * np.array([0.10, 0.11, 0.25], dtype=np.float32)
    card[:8, :] = parchment; card[CH - 8:, :] = parchment
    card[:, :8] = parchment; card[:, CW - 8:] = parchment
    card[10:CH - 10, 10:19] = gold
    card[10:CH - 10, CW - 19:CW - 10] = gold
    card[10:19, 10:CW - 10] = gold
    card[CH - 19:CH - 10, 10:CW - 10] = gold
    _draw_star8(card, CW // 2, CH // 2, 54, 18, gold)
    _draw_crescent(card, CW // 2, 74, 19, 1, gold_hi)
    _draw_crescent(card, CW // 2, CH - 74, 19, -1, gold_hi)
    textures["card"] = make_bpy_image("ShuffleCardBack", card)

    return textures


# =============================================================================
# 2. PRINCIPLED PBR MATERIALS (sRGB -> Linear conversion for exact color match)
# =============================================================================
def _srgb(r, g, b, a=1.0):
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)


def _make_mat(name, srgb_color=(0.5, 0.5, 0.5, 1.0), rough=0.72, metal=0.04, tex_img=None, emission=None, emit_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    lin_col = srgb_color if tex_img is not None else _srgb(*srgb_color)
    mat.diffuse_color = lin_col
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = lin_col
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Specular IOR Level"].default_value = 0.34
    if emission is not None and emit_strength > 0.0:
        bsdf.inputs["Emission Color"].default_value = _srgb(*emission)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if tex_img is not None:
        tex_node = nt.nodes.new("ShaderNodeTexImage")
        tex_node.image = tex_img
        nt.links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def create_materials(textures):
    return {
        "skin": _make_mat("SatiSkin", (0.78, 0.58, 0.49, 1.0), rough=0.74, metal=0.02),
        "skin_socket": _make_mat("SatiSkinSocket", (0.64, 0.44, 0.37, 1.0), rough=0.82, metal=0.02),
        "nose_warm": _make_mat("SatiNoseWarm", (0.74, 0.51, 0.43, 1.0), rough=0.74, metal=0.02),
        "mouth_dark": _make_mat("SatiMouthInterior", (0.16, 0.05, 0.07, 1.0), rough=0.92, metal=0.0),
        "lip_tone": _make_mat("SatiLipTone", (0.64, 0.38, 0.34, 1.0), rough=0.76, metal=0.02),
        "beard": _make_mat("SatiBeardSilver", (0.76, 0.78, 0.82, 1.0), rough=0.74, metal=0.04),
        "beard_inner": _make_mat("SatiBeardInner", (0.58, 0.60, 0.65, 1.0), rough=0.80, metal=0.04),
        "eye": _make_mat("SatiEyeMat", (1.0, 1.0, 1.0, 1.0), rough=0.14, metal=0.02, tex_img=textures["eye"]),
        "turban_maroon": _make_mat("TurbanMaroon", (0.40, 0.14, 0.19, 1.0), rough=0.78, metal=0.04),
        "turban_dark": _make_mat("TurbanDark", (0.31, 0.10, 0.14, 1.0), rough=0.82, metal=0.04),
        "turban_gold": _make_mat("TurbanGold", (0.83, 0.63, 0.19, 1.0), rough=0.45, metal=0.32),
        "turban_band": _make_mat("TurbanInnerBand", (0.86, 0.84, 0.80, 1.0), rough=0.82, metal=0.0),
        "jewel_glow": _make_mat(
            "TurbanJewelGlow", (0.78, 0.26, 0.60, 1.0), rough=0.18, metal=0.12,
            emission=(0.95, 0.45, 0.72, 1.0), emit_strength=1.5
        ),
        "ear_cyan": _make_mat(
            "EarringCyan", (0.22, 0.80, 0.74, 1.0), rough=0.18, metal=0.15,
            emission=(0.25, 0.82, 0.78, 1.0), emit_strength=0.45
        ),
        "ear_violet": _make_mat(
            "EarringViolet", (0.66, 0.24, 0.88, 1.0), rough=0.18, metal=0.15,
            emission=(0.72, 0.28, 0.92, 1.0), emit_strength=0.55
        ),
        "gold_metal": _make_mat("SatiGoldTrim", (0.85, 0.66, 0.22, 1.0), rough=0.34, metal=0.68),
        "robe": _make_mat("SatiRobeAtlas", (1.0, 1.0, 1.0, 1.0), rough=0.78, metal=0.05, tex_img=textures["robe"]),
        "burgundy": _make_mat("SatiBurgundySleeve", (0.36, 0.11, 0.15, 1.0), rough=0.80, metal=0.04),
        "sleeve_inside": _make_mat("SatiSleeveInner", (0.14, 0.04, 0.07, 1.0), rough=0.92, metal=0.0),
        "stole": _make_mat("SatiStoleAtlas", (1.0, 1.0, 1.0, 1.0), rough=0.76, metal=0.05, tex_img=textures["stole"]),
        "cape_purple": _make_mat("SatiCapePurple", (0.46, 0.19, 0.62, 1.0), rough=0.78, metal=0.04),
        "boot_leather": _make_mat("SatiBoots", (0.30, 0.18, 0.12, 1.0), rough=0.74, metal=0.05),
        "wood_stand": _make_mat("OrbWoodStand", (0.46, 0.26, 0.13, 1.0), rough=0.74, metal=0.04),
        "crystal_orb": _make_mat(
            "CrystalOrbIridescent", (0.84, 0.90, 1.0, 1.0), rough=0.14, metal=0.08,
            emission=(0.45, 0.56, 0.92, 1.0), emit_strength=0.55
        ),
        "card_back": _make_mat("ShuffleCardMat", (1.0, 1.0, 1.0, 1.0), rough=0.62, metal=0.08, tex_img=textures["card"]),
    }


# =============================================================================
# 3. BMESH COLLECTOR & SCULPTING PRIMITIVES
# =============================================================================
class PartCollector:
    def __init__(self, name, mats):
        self.name = name
        self.mats = mats
        self.bm = bmesh.new()
        self.uv_layer = self.bm.loops.layers.uv.new("UVMap")
        self.vg_map = {}

    def add_bmesh(self, sub_bm, bone_name, mat_idx, smooth=False, uv_fn=None):
        self.add_part_weights(sub_bm, lambda _co, b=bone_name: {b: 1.0}, mat_idx, smooth=smooth, uv_fn=uv_fn)

    def add_part_weights(self, sub_bm, weight_fn, mat_idx, smooth=False, uv_fn=None):
        sub_bm.verts.ensure_lookup_table()
        v_map = {}
        start_idx = len(self.bm.verts)
        for i, v in enumerate(sub_bm.verts):
            nv = self.bm.verts.new(v.co)
            nv.index = start_idx + i
            v_map[v] = nv
            for bname, w in weight_fn(v.co).items():
                if w > 1e-4:
                    self.vg_map.setdefault(bname, []).append((nv.index, float(w)))
        sub_bm.faces.ensure_lookup_table()
        for f in sub_bm.faces:
            try:
                nf = self.bm.faces.new([v_map[v] for v in f.verts])
                nf.material_index = mat_idx
                nf.smooth = smooth
                for loop in nf.loops:
                    if uv_fn is not None:
                        loop[self.uv_layer].uv = uv_fn(loop.vert.co)
                    else:
                        co = loop.vert.co
                        loop[self.uv_layer].uv = (co.x + 0.5, co.z + 0.5)
            except ValueError:
                pass
        sub_bm.free()

    def finalize(self):
        self.bm.normal_update()
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.collection.objects.link(obj)
        for m in self.mats:
            obj.data.materials.append(m)
        for bname, pairs in self.vg_map.items():
            vg = obj.vertex_groups.new(name=bname)
            for vidx, w in pairs:
                vg.add([vidx], w, "ADD")
        return obj


def _xf_bm(bm, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    S = Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
    R = Euler(rot, "XYZ").to_matrix().to_4x4()
    T = Matrix.Translation(loc)
    bmesh.ops.transform(bm, matrix=T @ R @ S, verts=bm.verts)
    return bm


def _make_cone(r1, r2, h, segs=10, loc=(0, 0, 0), rot=(0, 0, 0), cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=cap, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=h
    )
    return _xf_bm(bm, loc=loc, rot=rot)


def _make_open_sleeve_cone(r_top, r_bot, h, segs=10, wall=0.018):
    """Builds a hollow conical sleeve shell with an inner dark cuff rim so hands emerge cleanly!"""
    bm = bmesh.new()
    # 3 loops: outer top, outer bottom, inner cuff bottom, inner sleeve throat
    r_inner_bot = max(0.03, r_bot - wall)
    r_inner_top = max(0.03, r_top - wall)
    z_top, z_bot = h * 0.5, -h * 0.5
    ring_ot, ring_ob, ring_ib, ring_it = [], [], [], []
    for i in range(segs):
        a = (i / segs) * 2.0 * math.pi
        ca, sa = math.cos(a), math.sin(a)
        ring_ot.append(bm.verts.new((ca * r_top, sa * r_top, z_top)))
        ring_ob.append(bm.verts.new((ca * r_bot, sa * r_bot, z_bot)))
        ring_ib.append(bm.verts.new((ca * r_inner_bot, sa * r_inner_bot, z_bot)))
        ring_it.append(bm.verts.new((ca * r_inner_top, sa * r_inner_top, z_top * 0.55)))
    outer_faces = []
    inner_faces = []
    for i in range(segs):
        ni = (i + 1) % segs
        outer_faces.append(bm.faces.new([ring_ot[i], ring_ob[i], ring_ob[ni], ring_ot[ni]]))
        rim_f = bm.faces.new([ring_ob[i], ring_ib[i], ring_ib[ni], ring_ob[ni]])
        outer_faces.append(rim_f)
        inner_faces.append(bm.faces.new([ring_ib[i], ring_it[i], ring_it[ni], ring_ib[ni]]))
    bm.faces.new(list(reversed(ring_ot)))
    return bm, set(inner_faces)


def _make_icosphere(subdiv=1, r=0.1, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    return _xf_bm(bm, loc=loc, rot=rot, scale=scale)


def _make_uv_sphere(u=12, v=8, r=0.1, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
    return _xf_bm(bm, loc=loc, rot=rot, scale=scale)


def _make_cube(size=1.0, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=size)
    return _xf_bm(bm, loc=loc, rot=rot, scale=scale)


def _make_torus_ring(R=0.22, r=0.06, major_segs=14, minor_segs=6, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    bm = bmesh.new()
    grid = []
    for i in range(major_segs):
        theta = (i / major_segs) * 2.0 * math.pi
        row = []
        for j in range(minor_segs):
            phi = (j / minor_segs) * 2.0 * math.pi
            d = R + r * math.cos(phi)
            vx = d * math.cos(theta)
            vy = d * math.sin(theta)
            vz = r * math.sin(phi)
            row.append(bm.verts.new((vx, vy, vz)))
        grid.append(row)
    for i in range(major_segs):
        ni = (i + 1) % major_segs
        for j in range(minor_segs):
            nj = (j + 1) % minor_segs
            bm.faces.new([grid[i][j], grid[ni][j], grid[ni][nj], grid[i][nj]])
    return _xf_bm(bm, loc=loc, rot=rot, scale=scale)


def _make_prism_lock(w, d, h, loc=(0, 0, 0), rot=(0, 0, 0), taper_bottom=0.12):
    """Crisp faceted pyramid/wedge lock tapering cleanly down toward -Z tip."""
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=5, radius1=taper_bottom * w, radius2=w, depth=h
    )
    return _xf_bm(bm, loc=loc, rot=rot, scale=(1.0, d / max(w, 1e-4), 1.0))


# =============================================================================
# 4. BUILD SCULPTED BODY, OPEN SLEEVES, 5-FINGERED HANDS, HEAD, EYES, ORB & CARDS
# =============================================================================
def build_sati_meshes(mats):
    mat_list = [
        mats["robe"],           # 0
        mats["burgundy"],       # 1
        mats["stole"],          # 2
        mats["cape_purple"],    # 3
        mats["sleeve_inside"],  # 4
        mats["gold_metal"],     # 5
        mats["boot_leather"],   # 6
        mats["skin"],           # 7
        mats["skin_socket"],    # 8
        mats["nose_warm"],      # 9
        mats["mouth_dark"],     # 10
        mats["lip_tone"],       # 11
        mats["beard"],          # 12
        mats["beard_inner"],    # 13
        mats["turban_maroon"],  # 14
        mats["turban_dark"],    # 15
        mats["turban_gold"],    # 16
        mats["turban_band"],    # 17
        mats["jewel_glow"],     # 18
        mats["ear_cyan"],       # 19
        mats["ear_violet"],     # 20
        mats["eye"],            # 21
        mats["wood_stand"],     # 22
        mats["crystal_orb"],    # 23
        mats["card_back"],      # 24
    ]

    # -------------------------------------------------------------------------
    # A. BODY, TAILORED ROBE, OPEN SLEEVES & 5-FINGERED HANDS (`SatiBody`)
    # Total height = 2.45m; Ground Z = 0.0; Front = -Y; +X = Sati's Left (viewer RIGHT)
    # -------------------------------------------------------------------------
    body = PartCollector("SatiBody", mat_list)

    for sgn in (-1, 1):
        boot = _make_cube(1.0, loc=(sgn * 0.145, -0.06, 0.065), scale=(0.13, 0.25, 0.13))
        body.add_bmesh(boot, "Root", mat_idx=6, smooth=False)

    # Flared A-line Embroidered Robe + Lavender Apron
    robe_bm = bmesh.new()
    rings = [
        (0.10, 0.42, 0.34),
        (0.32, 0.37, 0.31),
        (0.62, 0.32, 0.28),
        (0.92, 0.27, 0.25),
        (1.16, 0.26, 0.24),
        (1.42, 0.28, 0.24),
        (1.66, 0.25, 0.21),
    ]
    segs = 14
    ring_verts = []
    for rz, rx, ry in rings:
        row = []
        for i in range(segs):
            a = -math.pi / 2.0 + (i / segs) * 2.0 * math.pi
            row.append(robe_bm.verts.new((math.cos(a) * rx, math.sin(a) * ry, rz)))
        ring_verts.append(row)
    for r in range(len(ring_verts) - 1):
        for i in range(segs):
            ni = (i + 1) % segs
            robe_bm.faces.new([ring_verts[r][i], ring_verts[r][ni], ring_verts[r + 1][ni], ring_verts[r + 1][i]])
    robe_bm.faces.new(list(reversed(ring_verts[0])))

    def robe_uv(co):
        ang = math.atan2(co.y, co.x)
        d = ang + math.pi / 2.0
        while d > math.pi:
            d -= 2.0 * math.pi
        while d < -math.pi:
            d += 2.0 * math.pi
        u = 0.5 + (d / math.pi) * 0.48
        v = np.clip((co.z - 0.10) / 1.15, 0.02, 0.98)
        return (float(u), float(v))

    def robe_weights(co):
        if co.z < 0.90:
            return {"Root": 1.0}
        elif co.z < 1.32:
            t = (co.z - 0.90) / 0.42
            return {"Root": 1.0 - t, "Spine": t}
        t = min(1.0, (co.z - 1.32) / 0.36)
        return {"Spine": 1.0 - t, "Chest": t}

    body.add_part_weights(robe_bm, robe_weights, mat_idx=0, smooth=False, uv_fn=robe_uv)

    # Waist Sash Knot
    sash = _make_cone(0.278, 0.282, 0.14, segs=14, loc=(0, -0.01, 1.13))
    body.add_bmesh(sash, "Spine", mat_idx=1, smooth=False)

    # Draped Scarf Collar Shawl (soft faceted torus wrap tucked smoothly onto shoulders!)
    shawl = _make_torus_ring(R=0.23, r=0.072, major_segs=14, minor_segs=6, loc=(0, -0.01, 1.66), rot=(0.14, 0, 0), scale=(1.16, 1.0, 0.85))
    body.add_bmesh(shawl, "Chest", mat_idx=3, smooth=False)
    # Soft back shoulder hood fold
    hood_back = _make_icosphere(subdiv=1, r=0.18, loc=(0, 0.14, 1.68), rot=(-0.25, 0, 0), scale=(1.25, 0.72, 0.65))
    body.add_bmesh(hood_back, "Chest", mat_idx=3, smooth=False)

    # Twin Vertical Stole Panels with Gold Zigzag & Tassels cleanly forward of chest (`y = -0.255`)
    def stole_uv(co):
        local_x = (co.x + 0.228) if co.x < 0 else (co.x - 0.102)
        u = np.clip(local_x / 0.125, 0.04, 0.96)
        v = np.clip((co.z - 1.04) / 0.58, 0.02, 0.98)
        return (float(u), float(v))

    for sgn in (-1, 1):
        strip = _make_cube(1.0, loc=(sgn * 0.165, -0.255, 1.33), rot=(-0.06, sgn * 0.04, 0), scale=(0.122, 0.032, 0.54))
        body.add_part_weights(strip, lambda co: {"Chest": 0.7, "Spine": 0.3}, mat_idx=2, smooth=False, uv_fn=stole_uv)
        for ti in (-1, 0, 1):
            tassel = _make_cone(0.016, 0.006, 0.072, segs=6, loc=(sgn * 0.165 + ti * 0.036, -0.272, 1.03))
            body.add_bmesh(tassel, "Spine", mat_idx=5, smooth=False)

    # Flowing Half-Wrap Back Cape (arcs strictly across back & flanks `theta in [-15°, 195°]` so NEVER pokes front!)
    cape_bm = bmesh.new()
    cape_rings = [(0.22, 0.44, 0.32), (0.65, 0.39, 0.28), (1.15, 0.34, 0.24), (1.64, 0.29, 0.20)]
    c_segs = 8
    c_rows = []
    for rz, rx, ry in cape_rings:
        row = []
        for ci in range(c_segs + 1):
            ang = math.radians(-12.0 + (ci / c_segs) * 204.0)  # +Y half arc behind torso
            row.append(cape_bm.verts.new((math.cos(ang) * rx, math.sin(ang) * ry + 0.10, rz)))
        c_rows.append(row)
    for r in range(len(c_rows) - 1):
        for ci in range(c_segs):
            cape_bm.faces.new([c_rows[r][ci], c_rows[r][ci + 1], c_rows[r + 1][ci + 1], c_rows[r + 1][ci]])
    body.add_part_weights(
        cape_bm,
        lambda co: {"Chest": max(0.0, min(1.0, (co.z - 0.85) / 0.65)), "Root": 1.0 - max(0.0, min(1.0, (co.z - 0.85) / 0.65))},
        mat_idx=3, smooth=False
    )

    # Twin Gold Beaded Necklaces + Amethyst Chest Pendant
    for nr, nz, ny in [(0.132, 1.56, -0.225), (0.150, 1.48, -0.242)]:
        chain = _make_torus_ring(R=nr, r=0.011, major_segs=12, minor_segs=5, loc=(0, ny, nz), rot=(0.45, 0, 0))
        body.add_bmesh(chain, "Chest", mat_idx=5, smooth=False)
    pendant = _make_icosphere(subdiv=1, r=0.040, loc=(0, -0.278, 1.41), scale=(0.65, 0.45, 1.35))
    body.add_bmesh(pendant, "Chest", mat_idx=20, smooth=False)

    neck = _make_cone(0.092, 0.086, 0.16, segs=10, loc=(0, -0.01, 1.76))
    body.add_bmesh(neck, "Neck", mat_idx=7, smooth=False)

    # Arms, Rounded Shoulders, Hollow Open Bell Sleeves & 5-Fingered Hands
    def build_arm(side_sgn, bone_pfx):
        sx = side_sgn * 0.31
        ex, ey, ez = sx + side_sgn * 0.085, -0.02, 1.24
        wx, wy, wz = sx + side_sgn * 0.10, -0.05, 0.94

        # Rounded Shoulder Dome blending smoothly into torso
        sh_cap = _make_icosphere(subdiv=1, r=0.125, loc=(sx + side_sgn * 0.02, -0.02, 1.60), scale=(1.05, 0.95, 0.95))
        body.add_part_weights(sh_cap, lambda co, bp=bone_pfx: {"Chest": 0.45, f"UpperArm_{bp}": 0.55}, mat_idx=1, smooth=False)

        # Upper Arm Sleeve (shoulder Z=1.60 -> elbow Z=1.24)
        u_arm = _make_cone(0.115, 0.125, 0.36, segs=10, loc=((sx + ex) * 0.5 + side_sgn * 0.01, -0.02, 1.42), rot=(0, -side_sgn * 0.14, 0))
        body.add_part_weights(
            u_arm,
            lambda co, bp=bone_pfx: {f"UpperArm_{bp}": 0.75, "Chest": 0.25} if co.z > 1.50 else {f"UpperArm_{bp}": 1.0},
            mat_idx=1, smooth=False
        )

        # OPEN HOLLOW Bell Forearm Sleeve + Sleek Gold Cuff Ring
        f_bm, inner_f = _make_open_sleeve_cone(r_top=0.112, r_bot=0.144, h=0.25, segs=10, wall=0.015)
        _xf_bm(f_bm, loc=((ex + wx) * 0.5, (ey + wy) * 0.5, (ez + wz) * 0.5 + 0.025), rot=(-0.10, -side_sgn * 0.04, 0))
        outer_bm = bmesh.new()
        inner_bm = bmesh.new()
        for src_f, target_bm in [(f, inner_bm if f in inner_f else outer_bm) for f in f_bm.faces]:
            verts = [target_bm.verts.new(v.co) for v in src_f.verts]
            target_bm.faces.new(verts)
        f_bm.free()
        body.add_bmesh(outer_bm, f"Forearm_{bone_pfx}", mat_idx=1, smooth=False)
        body.add_bmesh(inner_bm, f"Forearm_{bone_pfx}", mat_idx=4, smooth=False)

        cuff_bm, inner_c = _make_open_sleeve_cone(r_top=0.145, r_bot=0.152, h=0.050, segs=10, wall=0.016)
        _xf_bm(cuff_bm, loc=(wx, wy - 0.004, wz + 0.025), rot=(-0.10, -side_sgn * 0.04, 0))
        c_outer = bmesh.new(); c_inner = bmesh.new()
        for f in cuff_bm.faces:
            t_bm = c_inner if f in inner_c else c_outer
            t_bm.faces.new([t_bm.verts.new(v.co) for v in f.verts])
        cuff_bm.free()
        body.add_bmesh(c_outer, f"Forearm_{bone_pfx}", mat_idx=5, smooth=False)
        body.add_bmesh(c_inner, f"Forearm_{bone_pfx}", mat_idx=4, smooth=False)

        # Forearm Skin Wrist emerging naturally from inside cuff opening
        wrist = _make_cone(0.052, 0.062, 0.12, segs=8, loc=(wx, wy - 0.008, wz + 0.015), rot=(-0.10, -side_sgn * 0.04, 0))
        body.add_bmesh(wrist, f"Forearm_{bone_pfx}", mat_idx=7, smooth=False)

        # Sculpted Palm + Thumb + 4 Fingers (Z = 0.77 .. 0.92)
        palm = _make_cube(1.0, loc=(wx, wy - 0.015, 0.865), scale=(0.064, 0.098, 0.098))
        body.add_bmesh(palm, f"Hand_{bone_pfx}", mat_idx=7, smooth=False)
        thumb = _make_cube(1.0, loc=(wx - side_sgn * 0.042, wy - 0.052, 0.845), rot=(0.25, side_sgn * 0.35, 0), scale=(0.028, 0.030, 0.072))
        body.add_bmesh(thumb, f"Thumb_{bone_pfx}", mat_idx=7, smooth=False)
        for fi, off_y in enumerate([-0.040, -0.014, 0.014, 0.040]):
            flen = [0.068, 0.076, 0.070, 0.058][fi]
            finger = _make_cube(1.0, loc=(wx + side_sgn * 0.004, wy - 0.015 + off_y, 0.81 - flen * 0.45), rot=(0, -side_sgn * 0.10, 0), scale=(0.022, 0.021, flen))
            body.add_bmesh(finger, f"Fingers_{bone_pfx}", mat_idx=7, smooth=False)

    build_arm(-1, "R")
    build_arm(1, "L")
    body_obj = body.finalize()

    # -------------------------------------------------------------------------
    # B. SCULPTED HEAD, CHEEKBONES, WIDER NOSE, CLEAN TURBAN & FULL BEARD (`SatiHeadFace`)
    # -------------------------------------------------------------------------
    head = PartCollector("SatiHeadFace", mat_list)

    head_bm = bmesh.new()
    bmesh.ops.create_icosphere(head_bm, subdivisions=2, radius=0.185)
    head_bm.verts.ensure_lookup_table()
    for v in head_bm.verts:
        co = v.co
        co.x *= 0.95
        co.y *= 1.02
        co.z *= 1.12
        if co.y < -0.07 and 0.005 < co.z < 0.085 and 0.032 < abs(co.x) < 0.115:
            co.y += 0.034
        if co.y < -0.09 and 0.075 < co.z < 0.125 and abs(co.x) < 0.12:
            co.y -= 0.018
        if co.y < -0.06 and -0.04 < co.z < 0.02 and 0.06 < abs(co.x) < 0.14:
            co.y -= 0.018
            co.x *= 1.06
        if co.y < -0.10 and -0.09 < co.z < -0.025 and abs(co.x) < 0.065:
            co.y += 0.044
        v.co = co + Vector((0, -0.015, 1.945))

    head_bm.faces.ensure_lookup_table()
    head_vmap = {}
    h_start = len(head.bm.verts)
    for i, v in enumerate(head_bm.verts):
        nv = head.bm.verts.new(v.co)
        nv.index = h_start + i
        head_vmap[v] = nv
        if v.co.z < 1.865 and v.co.y < -0.03:
            head.vg_map.setdefault("Jaw", []).append((nv.index, 0.90))
            head.vg_map.setdefault("Head", []).append((nv.index, 0.10))
        else:
            head.vg_map.setdefault("Head", []).append((nv.index, 1.0))
    for f in head_bm.faces:
        nf = head.bm.faces.new([head_vmap[v] for v in f.verts])
        c = f.calc_center_median()
        # Only strictly recessed mouth interior under mustache gets dark mouth_dark — zero outer cheek blotches!
        if c.y > -0.145 and c.y < -0.090 and 1.855 < c.z < 1.908 and abs(c.x) < 0.048:
            nf.material_index = 10
        elif c.y < -0.115 and 1.948 < c.z < 2.020 and 0.036 < abs(c.x) < 0.105:
            nf.material_index = 8
        else:
            nf.material_index = 7
        nf.smooth = False
        for loop in nf.loops:
            loop[head.uv_layer].uv = (0.5, 0.5)
    head_bm.free()

    # Dedicated Deep Dark Mouth Cavity Plate hidden cleanly inside behind mustache & lips!
    mouth_back = _make_cube(1.0, loc=(0, -0.158, 1.878), scale=(0.088, 0.032, 0.045))
    head.add_bmesh(mouth_back, "Head", mat_idx=10, smooth=False)

    # Sculpted Chiseled Low-Poly Nose (beveled bridge + nostril wings + tip)
    nose_bridge = _make_cone(0.038, 0.024, 0.090, segs=6, loc=(0, -0.198, 1.955), rot=(0.24, 0, 0))
    head.add_bmesh(nose_bridge, "Head", mat_idx=9, smooth=False)
    nose_tip = _make_icosphere(subdiv=1, r=0.035, loc=(0, -0.214, 1.916), scale=(1.18, 0.92, 0.80))
    head.add_bmesh(nose_tip, "Head", mat_idx=9, smooth=False)

    # Sculpted Lower Lip attached firmly to Jaw!
    lower_lip = _make_cube(1.0, loc=(0, -0.168, 1.862), scale=(0.082, 0.036, 0.024))
    head.add_bmesh(lower_lip, "Jaw", mat_idx=11, smooth=False)

    # Tapered Low-Poly Ears
    for sgn in (-1, 1):
        ear = _make_icosphere(subdiv=1, r=0.048, loc=(sgn * 0.174, -0.012, 1.945), rot=(0.10, -sgn * 0.25, 0), scale=(0.45, 0.70, 1.15))
        head.add_bmesh(ear, "Head", mat_idx=9, smooth=False)

    # Asymmetric Faceted Crystal Earrings (Cyan viewer LEFT, Violet viewer RIGHT)
    for sgn, bname, mat_id in [(-1, "Earring_R", 19), (1, "Earring_L", 20)]:
        hook = _make_cone(0.010, 0.010, 0.025, segs=6, loc=(sgn * 0.192, -0.015, 1.878))
        head.add_bmesh(hook, bname, mat_idx=5, smooth=False)
        gem = _make_icosphere(subdiv=0, r=0.034, loc=(sgn * 0.195, -0.015, 1.832), scale=(0.68, 0.68, 1.52))
        head.add_bmesh(gem, bname, mat_idx=mat_id, smooth=False)

    # Bushy Faceted Silver Eyebrows
    for sgn, bname in [(-1, "Brow_R"), (1, "Brow_L")]:
        brow = _make_cube(1.0, loc=(sgn * 0.072, -0.188, 2.022), rot=(0.10, -sgn * 0.12, -sgn * 0.08), scale=(0.078, 0.036, 0.032))
        head.add_bmesh(brow, bname, mat_idx=12, smooth=False)

    # Sweeping Mustache Wings (Head/Jaw split so they flex when speaking)
    for sgn in (-1, 1):
        m_wing = _make_prism_lock(0.038, 0.032, 0.112, loc=(sgn * 0.056, -0.196, 1.874), rot=(0.16, -sgn * 1.18, sgn * 0.22), taper_bottom=0.16)
        head.add_part_weights(m_wing, lambda co: {"Head": 0.55, "Jaw": 0.45}, mat_idx=12, smooth=False)

    # 12-Lock Overlapping Dense Sculpted V-Pointed Silver Beard (ZERO gaps, reaches collar cleanly!)
    beard_specs = [
        # Center V-hero locks + overlapping sideburns
        (0.000, -0.172, 1.715, 0.072, 0.052, 0.28, 0.06, 0.00, 12),
        (-0.044, -0.168, 1.735, 0.058, 0.046, 0.25, 0.05, 0.10, 12),
        (0.044, -0.168, 1.735, 0.058, 0.046, 0.25, 0.05, -0.10, 12),
        (-0.085, -0.150, 1.770, 0.052, 0.042, 0.21, 0.03, 0.18, 12),
        (0.085, -0.150, 1.770, 0.052, 0.042, 0.21, 0.03, -0.18, 12),
        (-0.122, -0.115, 1.815, 0.045, 0.038, 0.17, 0.00, 0.24, 13),
        (0.122, -0.115, 1.815, 0.045, 0.038, 0.17, 0.00, -0.24, 13),
        # Thick inner chin & jaw backing locks so zero dark throat shows through!
        (0.000, -0.145, 1.745, 0.078, 0.054, 0.24, 0.02, 0.00, 13),
        (-0.045, -0.140, 1.765, 0.064, 0.048, 0.22, 0.02, 0.08, 13),
        (0.045, -0.140, 1.765, 0.064, 0.048, 0.22, 0.02, -0.08, 13),
        (-0.024, -0.162, 1.705, 0.042, 0.038, 0.24, 0.06, 0.04, 12),
        (0.024, -0.162, 1.705, 0.042, 0.038, 0.24, 0.06, -0.04, 12),
    ]
    for bx, by, bz, bw, bd, bh, rx, ry, mid in beard_specs:
        lock = _make_prism_lock(bw, bd, bh, loc=(bx, by, bz), rot=(rx, ry, 0), taper_bottom=0.14)
        head.add_part_weights(
            lock,
            lambda co: {"Jaw": 0.90, "Head": 0.10} if co.z > 1.66 else {"Jaw": 0.65, "Chest": 0.20, "Head": 0.15},
            mat_idx=mid, smooth=False
        )

    # Clean Twisted Low-Poly Turban + Flush Tucked White Trim + Tall Gold Crown Dome (zero air gap!)
    head.add_bmesh(_make_cone(0.166, 0.168, 0.036, segs=12, loc=(0, -0.015, 2.062), rot=(0.12, 0, 0)), "Head", mat_idx=17, smooth=False)
    head.add_bmesh(_make_torus_ring(R=0.184, r=0.074, major_segs=14, minor_segs=6, loc=(0, -0.015, 2.132), rot=(0.14, 0, 0), scale=(1.08, 1.05, 0.88)), "Head", mat_idx=14, smooth=False)
    head.add_bmesh(_make_torus_ring(R=0.172, r=0.064, major_segs=12, minor_segs=6, loc=(-0.035, -0.02, 2.172), rot=(0.12, 0.24, 0.12), scale=(1.02, 1.02, 0.82)), "Head", mat_idx=15, smooth=False)
    head.add_bmesh(_make_torus_ring(R=0.172, r=0.064, major_segs=12, minor_segs=6, loc=(0.035, -0.02, 2.172), rot=(0.12, -0.24, -0.12), scale=(1.02, 1.02, 0.82)), "Head", mat_idx=14, smooth=False)
    # Tall Golden Octagonal Crown Dome
    head.add_bmesh(_make_icosphere(subdiv=1, r=0.142, loc=(0, 0.0, 2.300), scale=(1.02, 1.02, 0.92)), "Head", mat_idx=16, smooth=False)
    # Ornate Front Forehead Gold Bezel + Glowing Amethyst Gem cleanly forward of folds
    head.add_bmesh(_make_cone(0.048, 0.042, 0.032, segs=8, loc=(0, -0.258, 2.172), rot=(1.35, 0, 0)), "Head", mat_idx=5, smooth=False)
    head.add_bmesh(_make_icosphere(subdiv=1, r=0.034, loc=(0, -0.276, 2.175), scale=(0.76, 0.62, 1.15)), "Head", mat_idx=18, smooth=False)

    head_obj = head.finalize()

    head_obj.shape_key_add(name="Basis")
    sk_mouth = head_obj.shape_key_add(name="MouthOpen")
    for idx, v in enumerate(head_obj.data.vertices):
        co = v.co
        if 1.62 < co.z < 1.88 and co.y < -0.10 and abs(co.x) < 0.09:
            sk_mouth.data[idx].co = co + Vector((0, -0.010, -0.028))
        elif 1.875 <= co.z < 1.915 and co.y < -0.15 and abs(co.x) < 0.09:
            sk_mouth.data[idx].co = co + Vector((0, -0.008, 0.012))

    # -------------------------------------------------------------------------
    # C. REAL 3D LIVING EYES (`SatiEyes`) & EYELIDS (`SatiEyelids`)
    # -------------------------------------------------------------------------
    eyes = PartCollector("SatiEyes", mat_list)
    for sgn, bname in [(-1, "Eye_R"), (1, "Eye_L")]:
        ex, ey, ez = sgn * 0.072, -0.168, 1.978
        ebm = _make_uv_sphere(u=16, v=12, r=0.028, loc=(ex, ey, ez))
        eyes.add_bmesh(
            ebm, bname, mat_idx=21, smooth=True,
            uv_fn=lambda co, cx=ex, cz=ez: (0.5 + (co.x - cx) / 0.056, 0.5 + (co.z - cz) / 0.056)
        )
    eyes_obj = eyes.finalize()

    lids = PartCollector("SatiEyelids", mat_list)
    for sgn in (-1, 1):
        ex, ey, ez = sgn * 0.072, -0.168, 1.978
        ubm = bmesh.new()
        r = 0.0315
        rows, cols = 4, 8
        grid = []
        for ri in range(rows + 1):
            phi = 0.20 + (ri / rows) * (math.pi * 0.45)
            row = []
            for ci in range(cols + 1):
                theta = -math.pi * 0.42 + (ci / cols) * (math.pi * 0.84)
                row.append(ubm.verts.new((
                    ex + r * math.sin(theta) * math.cos(phi),
                    ey - r * math.cos(theta) * math.cos(phi),
                    ez + r * math.sin(phi),
                )))
            grid.append(row)
        for ri in range(rows):
            for ci in range(cols):
                ubm.faces.new([grid[ri][ci], grid[ri][ci + 1], grid[ri + 1][ci + 1], grid[ri + 1][ci]])
        lids.add_bmesh(ubm, "Head", mat_idx=8, smooth=True)
    lids_obj = lids.finalize()

    lids_obj.shape_key_add(name="Basis")
    sk_blink = lids_obj.shape_key_add(name="Blink")
    for idx, v in enumerate(lids_obj.data.vertices):
        ex = -0.072 if v.co.x < 0 else 0.072
        ey, ez = -0.168, 1.978
        rel = Vector((v.co.x - ex, v.co.y - ey, v.co.z - ez))
        closed_rel = Matrix.Rotation(math.radians(-48.0), 3, "X") @ rel
        sk_blink.data[idx].co = Vector((ex, ey, ez)) + closed_rel

    # -------------------------------------------------------------------------
    # D. ANIMATED 3D TAROT SHUFFLE CARDS (`SatiShuffleCards`)
    # Rest mesh centers MATCH their exact bone heads `(0, -0.50, 1.38)`!
    # -------------------------------------------------------------------------
    cards = PartCollector("SatiShuffleCards", mat_list)
    deck_l_pos = Vector((0.20, -0.50, 1.38))
    deck_r_pos = Vector((-0.20, -0.50, 1.38))
    card_center = Vector((0.0, -0.50, 1.40))

    def make_card_uv(cx, cy):
        return lambda co, x0=cx, y0=cy: (np.clip((co.x - x0) / 0.130 + 0.5, 0.0, 1.0), np.clip((co.y - y0) / 0.195 + 0.5, 0.0, 1.0))

    cards.add_bmesh(_make_cube(1.0, loc=deck_l_pos, scale=(0.125, 0.19, 0.042)), "ShuffleDeckL", mat_idx=24, smooth=False, uv_fn=make_card_uv(deck_l_pos.x, deck_l_pos.y))
    cards.add_bmesh(_make_cube(1.0, loc=deck_r_pos, scale=(0.125, 0.19, 0.042)), "ShuffleDeckR", mat_idx=24, smooth=False, uv_fn=make_card_uv(deck_r_pos.x, deck_r_pos.y))
    for ci in range(8):
        cards.add_bmesh(_make_cube(1.0, loc=card_center, scale=(0.12, 0.185, 0.008)), f"ShuffleCard_{ci}", mat_idx=24, smooth=False, uv_fn=make_card_uv(card_center.x, card_center.y))
    cards_obj = cards.finalize()

    return [body_obj, head_obj, eyes_obj, lids_obj, cards_obj], deck_l_pos, deck_r_pos, card_center


# =============================================================================
# 5. BUILD HIERARCHICAL SKELETAL ARMATURE RIG (ALL PROP BONES HAVE +Y IDENTITY AXES!)
# =============================================================================
def build_armature(mesh_objs, deck_l_pos, deck_r_pos, card_center):
    arm_data = bpy.data.armatures.new("SatiArmature")
    arm_obj = bpy.data.objects.new("SatiBlenderRig", arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")

    def add_bone(name, head_co, tail_co, parent_name=None, roll=0.0):
        eb = arm_data.edit_bones.new(name)
        eb.head = Vector(head_co)
        eb.tail = Vector(tail_co)
        eb.roll = roll
        if parent_name:
            eb.parent = arm_data.edit_bones[parent_name]
        return eb

    add_bone("Root", (0, 0, 0.0), (0, 0.1, 0.0))  # Identity local axes!
    add_bone("Spine", (0, 0, 0.90), (0, 0, 1.32), "Root")
    add_bone("Chest", (0, 0, 1.32), (0, 0, 1.70), "Spine")
    add_bone("Neck", (0, 0, 1.70), (0, 0, 1.84), "Chest")
    add_bone("Head", (0, -0.015, 1.84), (0, -0.015, 2.25), "Neck")

    add_bone("Jaw", (0, -0.02, 1.86), (0, -0.18, 1.74), "Head")
    add_bone("Eye_R", (-0.072, -0.168, 1.978), (-0.072, -0.228, 1.978), "Head")
    add_bone("Eye_L", (0.072, -0.168, 1.978), (0.072, -0.228, 1.978), "Head")
    add_bone("Brow_R", (-0.072, -0.188, 2.022), (-0.072, -0.228, 2.042), "Head")
    add_bone("Brow_L", (0.072, -0.188, 2.022), (0.072, -0.228, 2.042), "Head")
    add_bone("Earring_R", (-0.192, -0.015, 1.88), (-0.192, -0.015, 1.80), "Head")
    add_bone("Earring_L", (0.192, -0.015, 1.88), (0.192, -0.015, 1.80), "Head")

    for sgn, bp in [(-1, "R"), (1, "L")]:
        sx = sgn * 0.31
        ex, ey, ez = sx + side_sgn_val(sgn) * 0.085, -0.02, 1.24
        wx, wy, wz = sx + side_sgn_val(sgn) * 0.10, -0.05, 0.94
        add_bone(f"UpperArm_{bp}", (sx, -0.02, 1.60), (ex, ey, ez), "Chest")
        add_bone(f"Forearm_{bp}", (ex, ey, ez), (wx, wy, wz), f"UpperArm_{bp}")
        add_bone(f"Hand_{bp}", (wx, wy, wz), (wx, wy - 0.02, wz - 0.12), f"Forearm_{bp}")
        add_bone(f"Thumb_{bp}", (wx - sgn * 0.04, wy - 0.04, 0.87), (wx - sgn * 0.06, wy - 0.08, 0.82), f"Hand_{bp}")
        add_bone(f"Fingers_{bp}", (wx, wy - 0.015, 0.82), (wx, wy - 0.015, 0.74), f"Hand_{bp}")

    # Prop bones have tail = head + (0, +0.1, 0), roll=0 -> local space == WORLD (X, Y, Z) delta!
    add_bone("ShuffleDeckL", deck_l_pos, deck_l_pos + Vector((0, 0.1, 0)), "Root")
    add_bone("ShuffleDeckR", deck_r_pos, deck_r_pos + Vector((0, 0.1, 0)), "Root")
    for ci in range(8):
        add_bone(f"ShuffleCard_{ci}", card_center, card_center + Vector((0, 0.1, 0)), "Root")

    bpy.ops.object.mode_set(mode="OBJECT")
    for obj in mesh_objs:
        mod = obj.modifiers.new("Armature", "ARMATURE")
        mod.object = arm_obj
        obj.parent = arm_obj
    return arm_obj


def side_sgn_val(sgn):
    return sgn


# =============================================================================
# 6. ANIMATE 4 UNIFIED NLA CLIPS WITH AUTO-COMPUTED HAND PALM TARGETS
# =============================================================================
def _set_pose(arm, bone_name, frame, rot_deg=None, loc=None, scale=None):
    pb = arm.pose.bones[bone_name]
    pb.rotation_mode = "XYZ"
    if loc is not None:
        pb.location = Vector(loc)
        pb.keyframe_insert("location", frame=frame)
    if rot_deg is not None:
        pb.rotation_euler = Euler([math.radians(a) for a in rot_deg], "XYZ")
        pb.keyframe_insert("rotation_euler", frame=frame)
    if scale is not None:
        pb.scale = Vector(scale)
        pb.keyframe_insert("scale", frame=frame)


def _reset_all_bones(arm):
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)


def _hand_palm_world(arm, bp):
    bpy.context.view_layer.update()
    pb = arm.pose.bones[f"Hand_{bp}"]
    return (arm.matrix_world @ ((pb.head + pb.tail) * 0.5))


def _push_action_to_nla(arm_obj, head_obj, lids_obj, name, end_frame, build_fn):
    arm_obj.animation_data_create()
    act = bpy.data.actions.new(name + "_Arm")
    arm_obj.animation_data.action = act

    head_sk = head_obj.data.shape_keys
    head_sk.animation_data_create()
    h_act = bpy.data.actions.new(name + "_MouthSK")
    head_sk.animation_data.action = h_act

    lids_sk = lids_obj.data.shape_keys
    lids_sk.animation_data_create()
    l_act = bpy.data.actions.new(name + "_BlinkSK")
    lids_sk.animation_data.action = l_act

    _reset_all_bones(arm_obj)
    head_sk.key_blocks["MouthOpen"].value = 0.0
    lids_sk.key_blocks["Blink"].value = 0.0

    build_fn(arm_obj, head_sk, lids_sk, end_frame)

    for id_data, act_ref in [(arm_obj, act), (head_sk, h_act), (lids_sk, l_act)]:
        trk = id_data.animation_data.nla_tracks.new()
        trk.name = name
        strip = trk.strips.new(name, 1, act_ref)
        strip.action_frame_start = 1
        strip.action_frame_end = end_frame
        id_data.animation_data.action = None


def _hide_shuffle_cards(arm, frame):
    _set_pose(arm, "ShuffleDeckL", frame, loc=(0, 0.5, -2.5), scale=(0.0001, 0.0001, 0.0001))
    _set_pose(arm, "ShuffleDeckR", frame, loc=(0, 0.5, -2.5), scale=(0.0001, 0.0001, 0.0001))
    for ci in range(8):
        _set_pose(arm, f"ShuffleCard_{ci}", frame, loc=(0, 0.5, -2.5), scale=(0.0001, 0.0001, 0.0001))


def _insert_blink(lids_sk, frame):
    kb = lids_sk.key_blocks["Blink"]
    kb.value = 0.0; kb.keyframe_insert("value", frame=frame - 3)
    kb.value = 1.0; kb.keyframe_insert("value", frame=frame)
    kb.value = 0.0; kb.keyframe_insert("value", frame=frame + 4)


def animate_all_clips(arm, head_obj, lids_obj, deck_l_pos, deck_r_pos, card_center):
    # CLIP 1: IDLE (180f = 6.0s) — Serene poised fortune-teller breathing, glances, double blink!
    def build_idle(arm, h_sk, l_sk, end_f):
        for f in [1, 45, 90, 135, 180]:
            ph = (f - 1) / 180.0 * 2.0 * math.pi
            breath = math.sin(ph * 2.0)
            sway = math.sin(ph)
            _set_pose(arm, "Spine", f, rot_deg=(breath * 1.4, sway * 1.2, sway * 1.0))
            _set_pose(arm, "Chest", f, rot_deg=(breath * 1.8, 0, sway * 1.6))
            _set_pose(arm, "Head", f, rot_deg=(-2.0 + breath * 2.0, sway * 3.5, sway * 1.8))
            _set_pose(arm, "UpperArm_L", f, rot_deg=(-10.0, 0, 6.0 + sway * 1.5))
            _set_pose(arm, "Forearm_L", f, rot_deg=(-26.0 + breath * 2.0, 0, -8.0))
            _set_pose(arm, "Hand_L", f, rot_deg=(-6.0, 0, 4.0))
            _set_pose(arm, "Fingers_L", f, rot_deg=(-18.0 + breath * 3.0, 0, 0))
            _set_pose(arm, "Thumb_L", f, rot_deg=(-10.0, 0, 8.0))

            _set_pose(arm, "UpperArm_R", f, rot_deg=(-5.0, 0, -5.0 - sway * 1.5))
            _set_pose(arm, "Forearm_R", f, rot_deg=(-16.0 + breath * 2.0, 0, 6.0))
            _set_pose(arm, "Hand_R", f, rot_deg=(-8.0, 0, 0))
            _set_pose(arm, "Fingers_R", f, rot_deg=(-18.0 - breath * 3.0, 0, 0))
            _set_pose(arm, "Earring_L", f, rot_deg=(breath * 3.0, -sway * 4.0, 0))
            _set_pose(arm, "Earring_R", f, rot_deg=(breath * 3.0, -sway * 4.0, 0))
            _set_pose(arm, "Jaw", f, rot_deg=(0, 0, 0))
            h_sk.key_blocks["MouthOpen"].value = 0.0; h_sk.key_blocks["MouthOpen"].keyframe_insert("value", frame=f)

        for ef, erot in [(1, (0, 0, 0)), (40, (2, 0, -4)), (65, (8, 0, 2)), (85, (1, 0, 3)), (130, (0, 0, -3)), (180, (0, 0, 0))]:
            _set_pose(arm, "Eye_L", ef, rot_deg=erot)
            _set_pose(arm, "Eye_R", ef, rot_deg=erot)
        l_sk.key_blocks["Blink"].value = 0.0; l_sk.key_blocks["Blink"].keyframe_insert("value", frame=1)
        _insert_blink(l_sk, 34); _insert_blink(l_sk, 118); _insert_blink(l_sk, 130)
        l_sk.key_blocks["Blink"].value = 0.0; l_sk.key_blocks["Blink"].keyframe_insert("value", frame=180)
        _hide_shuffle_cards(arm, 1); _hide_shuffle_cards(arm, 180)

    # CLIP 2: SHUFFLE (72f = 2.4s) — Both hands reach forward & riffle 8 flying cards between exact palms!
    def build_shuffle(arm, h_sk, l_sk, end_f):
        for f in range(1, end_f + 1, 6):
            ph = (f - 1) / end_f * 2.0 * math.pi
            pump = math.sin(ph * 3.0)
            tilt = math.cos(ph * 3.0)
            _set_pose(arm, "Spine", f, rot_deg=(-7.0 + pump * 2.0, 0, tilt * 2.5))
            _set_pose(arm, "Chest", f, rot_deg=(-5.0, 0, -tilt * 2.0))
            _set_pose(arm, "Head", f, rot_deg=(7.0 + pump * 2.0, tilt * 4.0, 0))
            _set_pose(arm, "Brow_L", f, rot_deg=(0, 5.0, 0))
            _set_pose(arm, "Brow_R", f, rot_deg=(0, -5.0, 0))
            _set_pose(arm, "Eye_L", f, rot_deg=(8.0, 0, tilt * 6.0))
            _set_pose(arm, "Eye_R", f, rot_deg=(8.0, 0, tilt * 6.0))

            _set_pose(arm, "UpperArm_L", f, rot_deg=(-46.0 + pump * 4.0, 0, -14.0))
            _set_pose(arm, "Forearm_L", f, rot_deg=(-56.0 - pump * 6.0, 0, -22.0))
            _set_pose(arm, "Hand_L", f, rot_deg=(8.0, 12.0 * tilt, 24.0))
            _set_pose(arm, "Fingers_L", f, rot_deg=(-36.0 - pump * 12.0, 0, 0))
            _set_pose(arm, "Thumb_L", f, rot_deg=(-20.0, 0, 18.0))

            _set_pose(arm, "UpperArm_R", f, rot_deg=(-46.0 - pump * 4.0, 0, 14.0))
            _set_pose(arm, "Forearm_R", f, rot_deg=(-56.0 + pump * 6.0, 0, 22.0))
            _set_pose(arm, "Hand_R", f, rot_deg=(8.0, -12.0 * tilt, -24.0))
            _set_pose(arm, "Fingers_R", f, rot_deg=(-36.0 + pump * 12.0, 0, 0))
            _set_pose(arm, "Thumb_R", f, rot_deg=(-20.0, 0, -18.0))

            # Exact world positions of Left & Right palms! Tilt cards ~+50° toward viewer camera so art shines cleanly!
            palm_l = _hand_palm_world(arm, "L") + Vector((-0.035, -0.065, 0.015))
            palm_r = _hand_palm_world(arm, "R") + Vector((0.035, -0.065, 0.015))
            _set_pose(arm, "ShuffleDeckL", f, loc=palm_l - deck_l_pos, rot_deg=(46.0, 20.0, 12.0), scale=(1.0, 1.0, 1.0))
            _set_pose(arm, "ShuffleDeckR", f, loc=palm_r - deck_r_pos, rot_deg=(46.0, -20.0, -12.0), scale=(1.0, 1.0, 1.0))

            # 8 Flying Cards bridge linearly + parabolically between palm_r and palm_l below face level!
            for ci in range(8):
                t = ((f - 1) / end_f * 2.0 + ci / 8.0) % 1.0
                if ci % 2 == 1:
                    t_dir = 1.0 - t
                else:
                    t_dir = t
                pos = palm_r.lerp(palm_l, t_dir) + Vector((0, -0.065, 0.01 + math.sin(t_dir * math.pi) * 0.165))
                arc_ry = (0.5 - t_dir) * 58.0
                _set_pose(
                    arm, f"ShuffleCard_{ci}", f,
                    loc=pos - card_center,
                    rot_deg=(50.0 + math.sin(t_dir * math.pi) * 8.0, arc_ry, math.sin(t_dir * math.pi) * 14.0),
                    scale=(1.0, 1.0, 1.0)
                )

            _set_pose(arm, "Jaw", f, rot_deg=(0, 0, 0))
            h_sk.key_blocks["MouthOpen"].value = 0.0; h_sk.key_blocks["MouthOpen"].keyframe_insert("value", frame=f)

        l_sk.key_blocks["Blink"].value = 0.0; l_sk.key_blocks["Blink"].keyframe_insert("value", frame=1)
        _insert_blink(l_sk, 36)
        l_sk.key_blocks["Blink"].value = 0.0; l_sk.key_blocks["Blink"].keyframe_insert("value", frame=end_f)

    # CLIP 3: THINKING (120f = 4.0s) — Table crystal scrying & contemplation
    def build_thinking(arm, h_sk, l_sk, end_f):
        _hide_shuffle_cards(arm, 1); _hide_shuffle_cards(arm, end_f)
        for f in [1, 30, 60, 90, 120]:
            ph = (f - 1) / end_f * 2.0 * math.pi
            sw = math.sin(ph)
            _set_pose(arm, "Spine", f, rot_deg=(-4.0 + sw * 1.2, 0, 2.0))
            _set_pose(arm, "Chest", f, rot_deg=(-4.0, 0, 3.0))
            _set_pose(arm, "Head", f, rot_deg=(10.0 + sw * 1.5, -14.0, -4.0))
            _set_pose(arm, "Brow_L", f, rot_deg=(0, -8.0, 0), loc=(0, 0, -0.004))
            _set_pose(arm, "Brow_R", f, rot_deg=(0, 8.0, 0), loc=(0, 0, -0.004))
            _set_pose(arm, "Eye_L", f, rot_deg=(14.0, 0, -16.0))
            _set_pose(arm, "Eye_R", f, rot_deg=(14.0, 0, -16.0))
            _set_pose(arm, "UpperArm_L", f, rot_deg=(-18.0, 0, 10.0))
            _set_pose(arm, "Forearm_L", f, rot_deg=(-42.0 + sw * 2.5, 0, -16.0))
            _set_pose(arm, "Hand_L", f, rot_deg=(-8.0, 0, 8.0))
            _set_pose(arm, "Fingers_L", f, rot_deg=(-22.0, 0, 0))
            _set_pose(arm, "UpperArm_R", f, rot_deg=(-24.0, 0, -8.0))
            _set_pose(arm, "Forearm_R", f, rot_deg=(-72.0 - sw * 3.0, 0, 22.0))
            _set_pose(arm, "Hand_R", f, rot_deg=(10.0, 0, -14.0))
            _set_pose(arm, "Fingers_R", f, rot_deg=(-30.0, 0, 0))
            _set_pose(arm, "Jaw", f, rot_deg=(0, 0, 0))
            h_sk.key_blocks["MouthOpen"].value = 0.0; h_sk.key_blocks["MouthOpen"].keyframe_insert("value", frame=f)
        l_sk.key_blocks["Blink"].value = 0.0; l_sk.key_blocks["Blink"].keyframe_insert("value", frame=1)
        _insert_blink(l_sk, 48); _insert_blink(l_sk, 95)
        l_sk.key_blocks["Blink"].value = 0.0; l_sk.key_blocks["Blink"].keyframe_insert("value", frame=end_f)

    # CLIP 4: TALK (90f = 3.0s) — Warm expressive jaw, beard & mouth talk + brow & hand gesture!
    def build_talk(arm, h_sk, l_sk, end_f):
        _hide_shuffle_cards(arm, 1); _hide_shuffle_cards(arm, end_f)
        speech_curve = [
            (1, 0.15), (7, 0.90), (13, 0.25), (19, 1.00), (26, 0.15),
            (32, 0.78), (38, 0.35), (44, 0.95), (50, 0.12), (57, 0.08),
            (63, 0.85), (69, 0.30), (75, 0.92), (82, 0.22), (90, 0.15),
        ]
        for f, amp in speech_curve:
            _set_pose(arm, "Jaw", f, rot_deg=(14.0 * amp, 0, 0))  # positive X drops chin down (-Z)!
            h_sk.key_blocks["MouthOpen"].value = amp
            h_sk.key_blocks["MouthOpen"].keyframe_insert("value", frame=f)

        for f in [1, 18, 36, 54, 72, 90]:
            ph = (f - 1) / end_f * 2.0 * math.pi
            nod = math.sin(ph * 2.0)
            turn = math.sin(ph)
            _set_pose(arm, "Spine", f, rot_deg=(-3.0 + nod * 1.8, 0, turn * 2.0))
            _set_pose(arm, "Chest", f, rot_deg=(-2.0, 0, turn * 2.5))
            _set_pose(arm, "Head", f, rot_deg=(-2.5 + nod * 4.5, turn * 6.0, nod * 2.2))
            brow_lift = abs(math.sin(ph * 1.5)) * 0.008
            _set_pose(arm, "Brow_L", f, loc=(0, 0, brow_lift), rot_deg=(-8.0 * abs(nod), 0, 0))
            _set_pose(arm, "Brow_R", f, loc=(0, 0, brow_lift), rot_deg=(-8.0 * abs(nod), 0, 0))
            _set_pose(arm, "Eye_L", f, rot_deg=(-1.0 - nod * 2.0, 0, -turn * 3.0))
            _set_pose(arm, "Eye_R", f, rot_deg=(-1.0 - nod * 2.0, 0, -turn * 3.0))
            _set_pose(arm, "UpperArm_L", f, rot_deg=(-22.0 - nod * 4.0, 0, 10.0))
            _set_pose(arm, "Forearm_L", f, rot_deg=(-52.0 + nod * 5.0, 0, -10.0 - turn * 5.0))
            _set_pose(arm, "Hand_L", f, rot_deg=(-10.0 + nod * 6.0, 0, 8.0))
            _set_pose(arm, "Fingers_L", f, rot_deg=(-12.0 - abs(nod) * 10.0, 0, 0))
            _set_pose(arm, "UpperArm_R", f, rot_deg=(-28.0 + nod * 6.0, 0, -14.0))
            _set_pose(arm, "Forearm_R", f, rot_deg=(-58.0 - nod * 8.0, 0, 16.0 + turn * 8.0))
            _set_pose(arm, "Hand_R", f, rot_deg=(-18.0 + nod * 10.0, 0, -12.0))
            _set_pose(arm, "Fingers_R", f, rot_deg=(-10.0 - abs(nod) * 14.0, 0, 0))
            _set_pose(arm, "Earring_L", f, rot_deg=(nod * 5.0, -turn * 6.0, 0))
            _set_pose(arm, "Earring_R", f, rot_deg=(nod * 5.0, -turn * 6.0, 0))

        l_sk.key_blocks["Blink"].value = 0.0; l_sk.key_blocks["Blink"].keyframe_insert("value", frame=1)
        _insert_blink(l_sk, 42)
        l_sk.key_blocks["Blink"].value = 0.0; l_sk.key_blocks["Blink"].keyframe_insert("value", frame=end_f)

    _push_action_to_nla(arm, head_obj, lids_obj, "Idle", 180, build_idle)
    _push_action_to_nla(arm, head_obj, lids_obj, "Shuffle", 72, build_shuffle)
    _push_action_to_nla(arm, head_obj, lids_obj, "Thinking", 120, build_thinking)
    _push_action_to_nla(arm, head_obj, lids_obj, "Talk", 90, build_talk)


# =============================================================================
# 7. EXPORT GLB + EEVEE FULL-COLOR STUDIO PREVIEWS
# =============================================================================
def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    textures = create_textures()
    mats = create_materials(textures)
    mesh_objs, deck_l_pos, deck_r_pos, card_center = build_sati_meshes(mats)
    arm_obj = build_armature(mesh_objs, deck_l_pos, deck_r_pos, card_center)
    animate_all_clips(arm_obj, mesh_objs[1], mesh_objs[3], deck_l_pos, deck_r_pos, card_center)

    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,
        export_skins=True,
        export_morph=True,
        export_morph_animation=True,
        export_force_sampling=True,
        export_bake_animation=True,
    )
    kb = os.path.getsize(OUT_GLB) / 1024.0
    print(f"[SATI-BLENDER] Exported living rigged GLB -> {OUT_GLB} ({kb:.1f} KB)")

    if "--preview" in sys.argv:
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = 900
        scene.render.resolution_y = 900
        scene.world = bpy.data.worlds.new("PrevWorld")
        scene.world.use_nodes = True
        bg = scene.world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs[0].default_value = (0.09, 0.06, 0.11, 1.0)
            bg.inputs[1].default_value = 1.1

        # Add clean key + warm fill lights for full PBR preview
        key = bpy.data.lights.new("Key", type="SUN"); key.energy = 2.8; key.color = (1.0, 0.92, 0.84)
        kobj = bpy.data.objects.new("Key", key); kobj.rotation_euler = (0.85, 0.15, -0.5); scene.collection.objects.link(kobj)
        fill = bpy.data.lights.new("Fill", type="POINT"); fill.energy = 140.0; fill.color = (1.0, 0.85, 0.68)
        fobj = bpy.data.objects.new("Fill", fill); fobj.location = (0.2, -1.8, 2.2); scene.collection.objects.link(fobj)

        cam_data = bpy.data.cameras.new("PrevCam")
        cam = bpy.data.objects.new("PrevCam", cam_data)
        scene.collection.objects.link(cam)
        scene.camera = cam

        def aim_cam(loc, target):
            cam.location = Vector(loc)
            cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()

        for trk_name, frame, fname, cloc, ctarg in [
            ("Idle", 20, "idle_front.png", (0.35, -3.5, 1.55), (0.0, -0.05, 1.32)),
            ("Talk", 19, "talk_closeup.png", (0.14, -1.35, 1.96), (0.0, -0.10, 1.92)),
            ("Shuffle", 18, "shuffle_pose.png", (-0.85, -3.2, 1.78), (0.0, -0.28, 1.44)),
        ]:
            for obj in [arm_obj, mesh_objs[1].data.shape_keys, mesh_objs[3].data.shape_keys]:
                for t in obj.animation_data.nla_tracks:
                    t.mute = t.name != trk_name
            scene.frame_set(frame)
            aim_cam(cloc, ctarg)
            scene.render.filepath = os.path.join(PREVIEW_DIR, fname)
            bpy.ops.render.render(write_still=True)
            print(f"[SATI-BLENDER] EEVEE Preview rendered -> {scene.render.filepath}")


if __name__ == "__main__":
    main()
