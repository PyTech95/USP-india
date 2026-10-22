import { RotateCcw } from "lucide-react";
import { ColorField, px } from "./ColorField";

const FONTS = ["Public Sans", "Helvetica Neue", "Source Sans 3", "Work Sans", "Montserrat", "Poppins", "Raleway", "Noto Sans", "Atkinson Hyperlegible",
  "Lora", "Literata", "Cormorant", "Source Serif 4", "Libre Baskerville", "Playfair Display", "Merriweather", "DM Serif Display"];
const GROUPS = [
  ["Header bar", [["backgroundColor", "Header background", "#ffffff"], ["borderColor", "Line under the header", "#e6e1dc"]]],
  ["Logo / brand", [["brandColor", "Brand name (USP)", "#575757"], ["subtitleColor", "Subtitle (Urban Suburban Perspectives)", "#575757"]]],
  ["Menu", [["navBackgroundColor", "Menu bar background", "#ebe7eb"], ["color", "Menu text", "#606060"], ["activeColor", "Hover & current page", "#d41445"],
    ["separatorColor", "Lines between menu items", "#7a7a7a"]]],
  ["Dropdown & mobile menu", [["dropdownBackgroundColor", "Dropdown background", "#ffffff"], ["dropdownColor", "Dropdown text", "#606060"],
    ["mobileMenuBackgroundColor", "Mobile menu background", "#fdf2ee"]]],
];
const TYPE_SIZES = [["brandFontSize", "Brand size", 16, 72], ["subtitleFontSize", "Subtitle size", 8, 24], ["fontSize", "Menu text size", 10, 32], ["letterSpacing", "Menu letter spacing", 0, 8]];
const SPACING = [["minHeight", "Header height", 44, 240], ["logoHeight", "Logo height", 16, 160], ["paddingTop", "Space above", 0, 160],
  ["paddingBottom", "Space inside, below", 0, 160], ["paddingLeft", "Left padding", 0, 160], ["paddingRight", "Right padding", 0, 160],
  ["navGap", "Gap between menu items", 0, 48], ["navPaddingX", "Menu bar side padding", 0, 120], ["borderWidth", "Line under the header (thickness)", 0, 12],
  ["marginBottom", "Space below the header", 0, 160]];
const LINES = [["accentLineWidth", "Line length", 8, 240], ["accentLineThickness", "Line thickness", 1, 12], ["accentLineGap", "Space from text", 0, 120]];
const slug = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export const HeaderStyleFields = ({ styles, change, reset }) => {
  const sizes = (fields) => <div className="header-style-grid">{fields.map(([key, label, min, max]) => <label className="live-field" key={key}>{label} (px)
    <input type="number" min={min} max={max} value={px(styles[key])} placeholder="Default" onChange={(e) => change(key, e.target.value === "" ? "" : `${e.target.value}px`)} data-testid={`header-style-${slug(key)}`} />
  </label>)}</div>;
  const select = (key, label, options) => <label className="live-field">{label}<select value={styles[key] || ""} onChange={(e) => change(key, e.target.value)} data-testid={`header-style-${slug(key)}`}>
    <option value="">Default</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select></label>;
  return <div data-testid="header-style-fields">
    <p className="live-hint live-hint-small">Changes show on the page straight away. Press “Save header” to publish them on every page.</p>
    <details open className="header-editor-group"><summary data-testid="header-colours-toggle">Colours</summary>
      {GROUPS.map(([title, fields]) => <div key={title} className="header-colour-group"><p className="live-label" style={{ margin: "10px 0 4px" }}>{title}</p>
        {fields.map(([key, label, fallback]) => <ColorField key={key} label={label} value={styles[key]} fallback={fallback} onChange={(v) => change(key, v)} testid={`header-style-${slug(key)}`} />)}
      </div>)}
    </details>
    <details className="header-editor-group"><summary data-testid="header-typography-toggle">Fonts &amp; text</summary>
      {select("brandFontFamily", "Brand font", FONTS.map((f) => [f, f]))}
      {select("fontFamily", "Menu font", FONTS.map((f) => [f, f]))}
      {select("fontWeight", "Menu weight", [300, 400, 500, 600, 700, 800].map((w) => [String(w), String(w)]))}
      {select("textTransform", "Menu letters", [["uppercase", "UPPERCASE"], ["capitalize", "Capitalised"], ["none", "As typed"]])}
      {sizes(TYPE_SIZES)}
    </details>
    <details className="header-editor-group"><summary data-testid="header-spacing-toggle">Size &amp; spacing</summary>{sizes(SPACING)}
      {select("position", "When scrolling", [["relative", "Scroll away with the page"], ["sticky", "Stay at the top"]])}
    </details>
    <details className="header-editor-group"><summary data-testid="header-lines-toggle">Red lines (whole site)</summary>{sizes(LINES)}
      <p className="live-hint live-hint-small">Defaults: 42px long, 2px thick, 30px from the text. Thickness also sets the vertical lines.</p>
    </details>
    <button type="button" className="live-btn" onClick={reset} data-testid="header-styles-reset"><RotateCcw size={15} /> Reset header styles</button>
  </div>;
};
