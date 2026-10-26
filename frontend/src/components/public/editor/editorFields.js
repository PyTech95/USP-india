export const getPath = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);
export const setPath = (obj, path, value) => {
  const keys = path.split("."), root = Array.isArray(obj) ? [...obj] : { ...obj };
  let current = root;
  keys.slice(0, -1).forEach((key) => {
    current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...(current[key] || {}) };
    current = current[key];
  });
  current[keys[keys.length - 1]] = value;
  return root;
};
// Boxes inside a section (a coloured band, a card): "_" + name. They are resized and coloured, not typed in.
export const isLayoutField = (field) => /^_[a-z_]+$/.test(field || "");
export const BOX_LABELS = { _section: "Whole section", _contact_card: "White contact card", _contact_hero: "Contact title box", _band: "Light band", _principles: "Principles box" };
export const isImageField = (field) => /(^|\.)(image\d*|cover|poster)$|^collage\.\d+$/.test(field || ""); // image, image2, …
// Styled in the live editor but filled from elsewhere (the Field Notes list shows each note's own words and photos).
export const isFixedField = (field) => /^list\./.test(field || "");
const SKIP = new Set(["media", "original", "edit_note", "notes", "media_id", "anchor", "layout", "style", "styles", "image_side", "slot", "crop", "cropMobile", "size", "placeholder_label", "id", "slug", "seo", "related", "tags"]);
export function editableFields(data, prefix = "") {
  const result = [];
  Object.entries(data || {}).forEach(([key, value]) => {
    if (SKIP.has(key)) return;
    const path = prefix ? `${prefix}.${key}` : key;
    if (isImageField(path)) {
      result.push({ path, kind: "image" });
      if (value && typeof value === "object") result.push(...editableFields(value, path));
    } else if (typeof value === "string") result.push({ path, kind: "text" });
    else if (value && typeof value === "object") result.push(...editableFields(value, path));
  });
  return result;
}