// Figma → Roblox : convertit la sélection en arbre d'UI Roblox (+ PNG pour ce que Roblox ne sait pas dessiner).
figma.showUI(__html__, { width: 280, height: 170 });

const RASTER_TYPES = ["VECTOR", "LINE", "STAR", "POLYGON", "ELLIPSE", "BOOLEAN_OPERATION"];

function rgb(c) {
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

function visibleEffects(n) {
  return "effects" in n ? n.effects.filter((e) => e.visible !== false) : [];
}

function visiblePaints(paints) {
  return paints === figma.mixed || !paints ? [] : paints.filter((p) => p.visible !== false);
}

// Ce que Roblox ne peut pas reproduire nativement → on exporte une image.
function needsRaster(n) {
  if (n.type === "TEXT") return n.rotation !== 0;
  if (RASTER_TYPES.includes(n.type)) return true;
  if ("rotation" in n && n.rotation !== 0) return true;
  if (visibleEffects(n).length) return true;
  // Un groupe fait uniquement de formes (une icône SVG) devient une seule image.
  if ("children" in n && n.children.length) {
    const leaves = n.findAll((d) => !("children" in d) || d.children.length === 0);
    if (leaves.length && leaves.every((d) => RASTER_TYPES.includes(d.type))) return true;
  }
  const fills = "fills" in n ? visiblePaints(n.fills) : [];
  if (fills.length > 1) return true;
  return fills.some((p) => p.type !== "SOLID" && p.type !== "GRADIENT_LINEAR");
}

function gradient(p, opacity) {
  const [[a, b]] = p.gradientTransform;
  const stops = p.gradientStops.slice(0, 20);
  return {
    rotation: Math.round((Math.atan2(b, a) * 180) / Math.PI),
    colors: stops.map((s) => ({ p: s.position, c: rgb(s.color) })),
    transparency: stops.map((s) => ({ p: s.position, t: 1 - s.color.a * (p.opacity ?? 1) * opacity })),
  };
}

function background(n, opacity) {
  const fill = "fills" in n ? visiblePaints(n.fills)[0] : null;
  if (!fill) return {};
  if (fill.type === "SOLID") {
    return { bg: { color: rgb(fill.color), transparency: 1 - (fill.opacity ?? 1) * opacity } };
  }
  // Fond blanc opaque + UIGradient qui porte couleurs et transparence.
  return { bg: { color: [255, 255, 255], transparency: 0 }, gradient: gradient(fill, opacity) };
}

function stroke(n, opacity) {
  const s = "strokes" in n ? visiblePaints(n.strokes)[0] : null;
  if (s && s.type === "SOLID" && typeof n.strokeWeight === "number" && n.strokeWeight > 0) {
    return { color: rgb(s.color), transparency: 1 - (s.opacity ?? 1) * opacity, thickness: n.strokeWeight };
  }
  // Ombre portée sombre sur un texte → contour fin, l'équivalent le plus proche dans Roblox.
  const shadow = visibleEffects(n).find((e) => e.type === "DROP_SHADOW" && e.color.r + e.color.g + e.color.b < 1.5);
  if (n.type === "TEXT" && shadow) {
    return { color: rgb(shadow.color), transparency: 1 - shadow.color.a * 0.8 * opacity, thickness: 1 };
  }
  return null;
}

function textData(n, opacity) {
  const seg = n.getStyledTextSegments(["fontName", "fontSize", "fills"])[0];
  const fill = visiblePaints(seg.fills).find((p) => p.type === "SOLID");
  return {
    content: n.characters,
    family: seg.fontName.family,
    style: seg.fontName.style,
    size: seg.fontSize,
    color: fill ? rgb(fill.color) : [255, 255, 255],
    transparency: 1 - (fill ? fill.opacity ?? 1 : 1) * opacity,
    alignX: n.textAlignHorizontal,
    alignY: n.textAlignVertical,
    wrap: n.textAutoResize === "HEIGHT" || n.textAutoResize === "NONE",
  };
}

async function serialize(n, parentBox, z, parentOpacity, images) {
  const opacity = parentOpacity * (n.opacity ?? 1);
  const raster = needsRaster(n);
  const box = (raster && n.absoluteRenderBounds) || n.absoluteBoundingBox;
  const out = {
    name: n.name,
    x: box.x - parentBox.x,
    y: box.y - parentBox.y,
    w: box.width,
    h: box.height,
    z,
  };

  if (raster) {
    const bytes = await n.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 2 } });
    const id = "img" + Object.keys(images).length;
    images[id] = figma.base64Encode(bytes);
    // L'opacité du calque est déjà dans le PNG.
    return Object.assign(out, { kind: "image", image: id, transparency: 0 });
  }

  if (n.type === "TEXT") {
    return Object.assign(out, { kind: "text", text: textData(n, opacity), stroke: stroke(n, opacity) });
  }

  Object.assign(out, { kind: "frame" }, background(n, opacity));
  out.stroke = stroke(n, opacity);
  if (typeof n.cornerRadius === "number" && n.cornerRadius > 0) out.corner = n.cornerRadius;
  out.clip = !!n.clipsContent;
  out.children = [];
  if ("children" in n) {
    let i = 1;
    for (const c of n.children) {
      if (c.visible) out.children.push(await serialize(c, n.absoluteBoundingBox, i++, opacity, images));
    }
  }
  return out;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type !== "export") return;
  const sel = figma.currentPage.selection;
  if (sel.length !== 1) {
    figma.ui.postMessage({ type: "error", text: "Sélectionne un seul frame." });
    return;
  }
  try {
    const images = {};
    const root = sel[0];
    const tree = await serialize(root, root.absoluteBoundingBox, 1, 1, images);
    tree.x = 0;
    tree.y = 0;
    figma.ui.postMessage({ type: "payload", payload: { name: root.name, tree, images } });
  } catch (e) {
    figma.ui.postMessage({ type: "error", text: String(e) });
  }
};
