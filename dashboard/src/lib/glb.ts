/**
 * Blender writes a texture with no picture in it when an image the model uses
 * was missing from the computer at export time. 3D viewers refuse the whole
 * file because of it. This removes those empty textures from the materials, so
 * the surface is drawn in its plain colour and the rest of the model loads.
 */

type Json = Record<string, unknown>;

const GLB_MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Removes every link from a material to a texture that has no picture. Returns how many. */
export function dropEmptyTextures(gltf: Json): number {
  const textures = Array.isArray(gltf.textures) ? gltf.textures : [];
  const empty = new Set<number>();
  textures.forEach((texture, index) => {
    if (!isObject(texture)) return;
    const extensions = isObject(texture.extensions) ? Object.values(texture.extensions) : [];
    const hasPicture =
      typeof texture.source === "number" ||
      extensions.some((extension) => isObject(extension) && typeof extension.source === "number");
    if (!hasPicture) empty.add(index);
  });
  if (!empty.size) return 0;

  let removed = 0;
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!isObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (
        /texture$/i.test(key) &&
        isObject(child) &&
        typeof child.index === "number" &&
        empty.has(child.index)
      ) {
        delete value[key];
        removed += 1;
      } else {
        walk(child);
      }
    }
  };
  walk(gltf.materials);
  return removed;
}

/** The same .glb file without empty textures, or null when nothing had to change. */
export function repairGlb(buffer: ArrayBuffer): ArrayBuffer | null {
  if (buffer.byteLength < 20) return null;
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(16, true) !== JSON_CHUNK) return null;
  const jsonLength = view.getUint32(12, true);
  const jsonEnd = 20 + jsonLength;
  if (jsonEnd > buffer.byteLength) return null;

  let gltf: unknown;
  try {
    gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  } catch {
    return null;
  }
  if (!isObject(gltf) || !dropEmptyTextures(gltf)) return null;

  // The description is padded with spaces to a multiple of four bytes.
  const text = new TextEncoder().encode(JSON.stringify(gltf));
  const padded = Math.ceil(text.length / 4) * 4;
  const rest = new Uint8Array(buffer, jsonEnd);
  const out = new Uint8Array(20 + padded + rest.length);
  out.set(new Uint8Array(buffer, 0, 12));
  out.fill(0x20, 20, 20 + padded);
  out.set(text, 20);
  out.set(rest, 20 + padded);
  const outView = new DataView(out.buffer);
  outView.setUint32(8, out.length, true);
  outView.setUint32(12, padded, true);
  outView.setUint32(16, JSON_CHUNK, true);
  return out.buffer;
}
