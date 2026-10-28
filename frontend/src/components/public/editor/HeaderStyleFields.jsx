import { RotateCcw } from "lucide-react";
import { ColorField, SliderField } from "./ColorField";

const FONTS = ["Public Sans", "Helvetica Neue", "Source Sans 3", "Work Sans", "Montserrat", "Poppins", "Raleway", "Noto Sans", "Atkinson Hyperlegible",
  "Lora", "Literata", "Cormorant", "Source Serif 4", "Libre Baskerville", "Playfair Display", "Merriweather", "DM Serif Display"];
const GROUPS = [
  ["Header bar", [["backgroundColor", "Header background", "#ffffff"], ["borderColor", "Line under the header", "#e6e1dc"]]],
  ["Logo / brand", [["brandColor", "Brand name (USP)", "#575757"], ["subtitleColor", "Subtitle (Urban Suburban Perspectives)", "#575757"]]],
  ["Menu", [["navBackgroundColor", "Menu bar background", "#ebe7eb"], ["color", "Menu text", "#606060"], ["activeColor", "Hover & current page text", "#d41445"],
    ["hoverBackgroundColor", "Hover background", "#ffffff"], ["activeLineColor", "Current page underline", "#d41445"], ["separatorColor", "Lines between menu items", "#7a7a7a"]]],
  ["Dropdown & mobile menu", [["dropdownBackgroundColor", "Dropdown background", "#ffffff"], ["dropdownColor", "Dropdown text", "#606060"],
    ["dropdownHoverBackgroundColor", "Dropdown hover background", "#f5f3f1"], ["mobileMenuBackgroundColor", "Mobile menu background", "#fdf2ee"]]],
  ["Footer", [["footerBackgroundColor", "Footer background", "#E4CDAE"], ["footerStripColor", "Strip along the bottom (© and Privacy Policy)", "#e5dad4"],
    ["footerLineColor", "Line above © and Privacy Policy", "#b9b2a9"]]],
];
// Presets recolour the header only (the footer keeps its own colours)
const COLOUR_KEYS = GROUPS.filter(([group]) => group !== "Footer").flatMap(([, fields]) => fields.map(([key]) => key));
// One-click colour schemes; they change colours only (sizes and fonts stay).
const PRESETS = [
  ["Original", {}],
  ["Clean white", { backgroundColor: "#ffffff", navBackgroundColor: "#ffffff", color: "#3a3a3a", activeColor: "#d41445", activeLineColor: "#d41445", separatorColor: "#dddddd", borderColor: "#eeeeee", brandColor: "#2b2b2b", subtitleColor: "#6b6b6b" }],
  ["Warm sand", { backgroundColor: "#fbf8f4", navBackgroundColor: "#efe7dc", color: "#4a4036", activeColor: "#b5452f", activeLineColor: "#b5452f", separatorColor: "#cbbfae", brandColor: "#3d342b", subtitleColor: "#6e6255", dropdownBackgroundColor: "#fbf8f4", mobileMenuBackgroundColor: "#f4ece2" }],
  ["Charcoal", { backgroundColor: "#1f1f1f", brandColor: "#ffffff", subtitleColor: "#cfcfcf", navBackgroundColor: "#2b2b2b", color: "#f2f2f2", activeColor: "#ff9db2", activeLineColor: "#ff9db2", separatorColor: "#555555", borderColor: "#1f1f1f", dropdownBackgroundColor: "#2b2b2b", dropdownColor: "#f2f2f2", dropdownHoverBackgroundColor: "#3a3a3a", mobileMenuBackgroundColor: "#2b2b2b" }],
  ["USP red", { navBackgroundColor: "#d41445", color: "#ffffff", activeColor: "#ffe3ea", activeLineColor: "#ffffff", separatorColor: "#f08aa2", hoverBackgroundColor: "#b80f3a", dropdownBackgroundColor: "#ffffff", dropdownColor: "#2b2b2b" }],
];
const TYPE_SIZES = [["brandFontSize", "Brand size", 16, 72], ["subtitleFontSize", "Subtitle size", 8, 24], ["fontSize", "Menu text size", 10, 32], ["letterSpacing", "Menu letter spacing", 0, 8, 0.5]];
const SPACING = [["minHeight", "Header height", 44, 240], ["logoHeight", "Logo height", 16, 160], ["paddingTop", "Space above", 0, 160],
  ["paddingBottom", "Space inside, below", 0, 160], ["paddingLeft", "Left padding", 0, 160], ["paddingRight", "Right padding", 0, 160],
  ["navGap", "Gap between menu items", 0, 48], ["navPaddingX", "Menu bar side padding", 0, 120], ["borderWidth", "Line under the header (thickness)", 0, 12],
  ["marginBottom", "Space below the header", 0, 160]];
const LINES = [["accentLineWidth", "Line length", 8, 240], ["accentLineThickness", "Line thickness", 1, 12], ["accentLineGap", "Space from text", 0, 120]];
const slug = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export const HeaderStyleFields = ({ styles, change, changeMany, reset }) => {
  const sliders = (fields) => <div className="header-style-sliders">{fields.map(([key, label, min, max, step]) => (
    <SliderField key={key} label={`${label} (px)`} value={styles[key] ?? ""} min={min} max={max} step={step || 1} onChange={(v) => change(key, v)} testid={`header-style-${slug(key)}`} />
  ))}</div>;
  const select = (key, label, options) => <label className="live-field">{label}<select value={styles[key] || ""} onChange={(e) => change(key, e.target.value)} data-testid={`header-style-${slug(key)}`}>
    <option value="">Default</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select></label>;
  const applyPreset = (colours) => {
    const next = { ...styles };
    COLOUR_KEYS.forEach((k) => { delete next[k]; });
    changeMany({ ...next, ...colours });
  };
  return <div data-testid="header-style-fields">
    <p className="live-hint live-hint-small">Changes show on the page straight away. Press “Save header” to publish them on every page.</p>
    <div className="header-presets" role="group" aria-label="Colour schemes">
      {PRESETS.map(([name, colours]) => (
        <button key={name} type="button" className="header-preset" onClick={() => applyPreset(colours)} title={`Use the “${name}” colours`} data-testid={`header-preset-${name.toLowerCase().replace(/\s+/g, "-")}`}>
          <span className="header-preset-swatch" style={{ background: `linear-gradient(90deg, ${colours.backgroundColor || "#ffffff"} 0 45%, ${colours.navBackgroundColor || "#ebe7eb"} 45% 100%)` }}>
            <i style={{ background: colours.activeColor || "#d41445" }} />
          </span>{name}
        </button>
      ))}
    </div>
    <details open className="header-editor-group"><summary data-testid="header-colours-toggle">Colours</summary>
      {GROUPS.map(([title, fields]) => <div key={title} className="header-colour-group" data-testid={`header-colour-group-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}><p className="live-label" style={{ margin: "10px 0 4px" }}>{title}</p>
        {fields.map(([key, label, fallback]) => <ColorField key={key} label={label} value={styles[key]} fallback={fallback} onChange={(v) => change(key, v)} testid={`header-style-${slug(key)}`} />)}
      </div>)}
      {select("headerShadow", "Shadow under the header", [["none", "None"], ["soft", "Soft"], ["strong", "Strong"]])}
    </details>
    <details className="header-editor-group"><summary data-testid="header-typography-toggle">Fonts &amp; text</summary>
      {select("brandFontFamily", "Brand font", FONTS.map((f) => [f, f]))}
      {select("fontFamily", "Menu font", FONTS.map((f) => [f, f]))}
      {select("fontWeight", "Menu weight", [300, 400, 500, 600, 700, 800].map((w) => [String(w), String(w)]))}
      {select("textTransform", "Menu letters", [["uppercase", "UPPERCASE"], ["capitalize", "Capitalised"], ["none", "As typed"]])}
      {sliders(TYPE_SIZES)}
    </details>
    <details className="header-editor-group"><summary data-testid="header-spacing-toggle">Size &amp; spacing</summary>{sliders(SPACING)}
      {select("position", "When scrolling", [["relative", "Scroll away with the page"], ["sticky", "Stay at the top"]])}
    </details>
    <details className="header-editor-group"><summary data-testid="header-lines-toggle">Red lines (whole site)</summary>{sliders(LINES)}
      <p className="live-hint live-hint-small">Defaults: 42px long, 2px thick, 30px from the text. Thickness also sets the vertical lines.</p>
    </details>
    <button type="button" className="live-btn" onClick={reset} data-testid="header-styles-reset"><RotateCcw size={15} /> Reset header styles</button>
  </div>;
};
