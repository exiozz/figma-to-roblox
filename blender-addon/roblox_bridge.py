"""Blender → Roblox : envoie la sélection (ou la scène) vers Roblox via l'application FigmaRoblox.

L'add-on exporte en .glb ou .fbx dans un fichier temporaire, puis l'envoie à l'application
locale (http://localhost:7777) qui le met en ligne sur Roblox avec ta clé Open Cloud.
Dans Roblox Studio : onglet Figma → « Importer modèles et images ».
"""

bl_info = {
    "name": "Roblox Bridge (FigmaRoblox)",
    "author": "exiozz",
    "version": (1, 1, 0),
    "blender": (4, 2, 0),
    "location": "Vue 3D > Barre latérale (N) > Roblox",
    "description": "Envoie des modèles 3D vers Roblox Studio en un clic",
    "category": "Import-Export",
    "doc_url": "https://github.com/exiozz/figma-to-roblox",
}

import json
import os
import re
import tempfile
import threading
import urllib.error
import urllib.parse
import urllib.request

import bpy

BRIDGE = "http://localhost:7777"
MAX_SIZE = 20 * 1024 * 1024  # limite Roblox par fichier

# Résultat du dernier envoi, lu par le panneau (l'envoi se fait dans un thread).
_status = {"text": "", "error": False, "busy": False}


def send_file(file_path, file_name):
    """Envoie un fichier à l'application locale. Renvoie l'entrée créée ou lève une exception."""
    with open(file_path, "rb") as f:
        data = f.read()
    if len(data) > MAX_SIZE:
        raise RuntimeError(f"Fichier de {len(data) / 1e6:.1f} Mo : Roblox accepte 20 Mo maximum.")
    query = urllib.parse.urlencode({"name": file_name, "source": "Blender"})
    req = urllib.request.Request(
        f"{BRIDGE}/upload?{query}",
        data=data,
        method="POST",
        headers={"Content-Type": "application/octet-stream", "X-FigmaRoblox": "1"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            return json.loads(res.read())["asset"]
    except urllib.error.HTTPError as e:
        try:
            message = json.loads(e.read()).get("error", str(e))
        except ValueError:
            message = str(e)
        raise RuntimeError(message) from None
    except urllib.error.URLError:
        raise RuntimeError("Application FigmaRoblox injoignable : lance FigmaRoblox.exe.") from None


def export_model(context, settings, file_path):
    """Exporte la sélection (ou la scène) au format choisi."""
    selection_only = settings.selection_only
    if settings.file_format == "GLB":
        bpy.ops.export_scene.gltf(
            filepath=file_path,
            export_format="GLB",
            use_selection=selection_only,
            export_apply=settings.apply_modifiers,
            export_yup=True,
        )
    else:
        bpy.ops.export_scene.fbx(
            filepath=file_path,
            use_selection=selection_only,
            use_mesh_modifiers=settings.apply_modifiers,
            global_scale=1.0,
            apply_scale_options="FBX_SCALE_ALL",
            path_mode="COPY",
            embed_textures=True,
        )


def asset_name(context, settings):
    if settings.asset_name.strip():
        name = settings.asset_name.strip()
    elif settings.selection_only and context.active_object:
        name = context.active_object.name
    else:
        name = bpy.path.display_name_from_filepath(bpy.data.filepath) or "Scene"
    return re.sub(r'[\\/:*?"<>|]', "_", name)[:50]


class RobloxBridgeSettings(bpy.types.PropertyGroup):
    file_format: bpy.props.EnumProperty(
        name="Format",
        items=[
            ("GLB", "glTF binaire (.glb)", "Recommandé : textures et matériaux inclus dans un seul fichier"),
            ("FBX", "FBX (.fbx)", "Textures incluses dans le fichier"),
        ],
        default="GLB",
    )
    selection_only: bpy.props.BoolProperty(
        name="Sélection uniquement", default=True,
        description="N'envoyer que les objets sélectionnés (sinon toute la scène)",
    )
    apply_modifiers: bpy.props.BoolProperty(
        name="Appliquer les modificateurs", default=True,
        description="Exporter le résultat des modificateurs (Subdivision, Mirror…)",
    )
    asset_name: bpy.props.StringProperty(
        name="Nom", default="",
        description="Nom de l'asset dans Roblox (vide : nom de l'objet actif)",
    )


class ROBLOX_OT_send(bpy.types.Operator):
    bl_idname = "roblox_bridge.send"
    bl_label = "Envoyer vers Roblox"
    bl_description = "Exporte et met en ligne sur Roblox, prêt à importer dans Studio"

    @classmethod
    def poll(cls, context):
        settings = context.scene.roblox_bridge
        return not _status["busy"] and (not settings.selection_only or context.selected_objects)

    def execute(self, context):
        settings = context.scene.roblox_bridge
        name = asset_name(context, settings)
        ext = ".glb" if settings.file_format == "GLB" else ".fbx"
        tmp_dir = tempfile.mkdtemp(prefix="roblox_bridge_")
        file_path = os.path.join(tmp_dir, name + ext)

        try:
            export_model(context, settings, file_path)
        except Exception as e:  # l'export Blender peut échouer pour des raisons variées
            self.report({"ERROR"}, f"Export impossible : {e}")
            return {"CANCELLED"}

        _status.update(text=f"Envoi de « {name} »…", error=False, busy=True)

        # L'upload Roblox prend quelques secondes : on ne bloque pas l'interface.
        def worker():
            try:
                asset = send_file(file_path, name + ext)
                _status.update(text=f"En ligne : {name} ({asset['assetId']}). "
                               "Dans Studio : Importer modèles et images.", error=False)
            except Exception as e:
                _status.update(text=str(e), error=True)
            finally:
                _status["busy"] = False
                try:
                    os.remove(file_path)
                    os.rmdir(tmp_dir)
                except OSError:
                    pass

        threading.Thread(target=worker, daemon=True).start()
        bpy.app.timers.register(_refresh_ui, first_interval=0.5)
        return {"FINISHED"}


def _refresh_ui():
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                area.tag_redraw()
    return 0.5 if _status["busy"] else None


class ROBLOX_PT_panel(bpy.types.Panel):
    bl_label = "Roblox"
    bl_idname = "ROBLOX_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Roblox"

    def draw(self, context):
        layout = self.layout
        settings = context.scene.roblox_bridge
        layout.prop(settings, "file_format", text="")
        layout.prop(settings, "asset_name")
        layout.prop(settings, "selection_only")
        layout.prop(settings, "apply_modifiers")

        row = layout.row()
        row.scale_y = 1.5
        label = "Envoi en cours…" if _status["busy"] else "Envoyer vers Roblox"
        row.operator(ROBLOX_OT_send.bl_idname, text=label, icon="EXPORT")

        if _status["text"]:
            box = layout.box()
            icon = "ERROR" if _status["error"] else ("TIME" if _status["busy"] else "CHECKMARK")
            for i, line in enumerate(_wrap(_status["text"], 34)):
                box.label(text=line, icon=icon if i == 0 else "BLANK1")


def _wrap(text, width):
    words, lines, line = text.split(), [], ""
    for w in words:
        if len(line) + len(w) + 1 > width and line:
            lines.append(line)
            line = w
        else:
            line = f"{line} {w}".strip()
    return lines + [line] if line else lines


classes = (RobloxBridgeSettings, ROBLOX_OT_send, ROBLOX_PT_panel)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.roblox_bridge = bpy.props.PointerProperty(type=RobloxBridgeSettings)


def unregister():
    del bpy.types.Scene.roblox_bridge
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
