// Compatibility for the exact saved geometry in the owner's October 16 reference.
// Those positions are now expressed by a responsive grid, not duplicate transforms.
// Other/new editor values remain untouched. Original captures are retained in assets.
const restoration = {
  body_html: { translateX: "-55.13330078125px", translateY: "-149.31666564941406px", width: "738px" },
  eyebrow: { translateX: "100.5999755859375px", translateY: "-505.95001220703125px" },
  heading: { translateX: "100.2667236328125px", translateY: "-483.43334197998047px" },
  image: { width: "694px" },
  "collage.0": { width: "338px", height: "382px" },
  "collage.1": { width: "158px", height: "301px", translateX: "33.56671142578125px", translateY: "7.9499969482421875px" },
  _section: { height: "1038px" },
};
const ambition = { body_html: { translateX: "0px", translateY: "-37.100006103515625px" } };

export const normalizeReferenceContent = (content) => {
  if (!content?.sections) return content;
  return { ...content, sections: content.sections.map((section) => {
    const captured = section.data?.layout === "haveli-reference-aligned" ? restoration
      : section.data?.layout === "rakhigarhi-ambition-aligned" ? ambition : null;
    if (!captured) return section;
    const styles = Object.fromEntries(Object.entries(section.styles || {}).map(([field, style]) => [field, { ...style }]));
    Object.entries(captured).forEach(([field, properties]) => {
      Object.entries(properties).forEach(([key, original]) => {
        if (styles[field]?.[key] === original) delete styles[field][key];
      });
    });
    if (section.data?.layout === "rakhigarhi-ambition-aligned" && typeof section.data.body_html === "string") {
      // Derive the three boxes from the current site content, never from a snapshot.
      const source = document.createElement("div");
      source.innerHTML = section.data.body_html;
      const boxes = [0, 1, 2].map(() => document.createElement("div"));
      [...source.childNodes].filter((node) => node.nodeType !== 3 || node.textContent.trim()).forEach((node, index) => {
        boxes[Math.min(index, 2)].appendChild(node);
      });
      const data = { ...section.data };
      delete data.body_html;
      const typography = Object.fromEntries(Object.entries(styles.body_html || {}).filter(([key]) =>
        ["fontFamily", "fontSize", "fontWeight", "fontStyle", "color", "textAlign", "textTransform", "lineHeight", "letterSpacing"].includes(key)));
      boxes.forEach((box, index) => {
        const field = `body_${index + 1}_html`;
        data[field] = box.innerHTML;
        styles[field] = { ...typography, ...styles[field] };
      });
      return { ...section, data, styles };
    }
    return { ...section, styles };
  }) };
};