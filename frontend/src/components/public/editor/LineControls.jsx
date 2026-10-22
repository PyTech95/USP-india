import { useEffect, useState } from "react";
import { Minus, RotateCcw, Trash2 } from "lucide-react";
import { ColorField, SliderField } from "./ColorField";
import { LINE_KINDS } from "./lineKinds";

const KINDS = [["", "No line"], ["accent", "Short red line"], ["divider", "Thin line across"]];
const num = (v) => (v === undefined || v === null || v === "" ? undefined : parseFloat(v));

// A red line / divider that the stylesheet draws on this element (::before / ::after), if any.
export function builtInLine(el) {
  if (!el) return null;
  for (const pseudo of ["::after", "::before"]) {
    const c = window.getComputedStyle(el, pseudo);
    if (!c || c.content === "none" || c.display === "none") continue;
    const w = parseFloat(c.width) || 0, h = parseFloat(c.height) || 0;
    const bg = c.backgroundColor;
    const filled = bg && bg !== "transparent" && !/rgba\(\d+, \d+, \d+, 0\)/.test(bg);
    const thin = (h > 0 && h <= 12 && w >= 8) || (w > 0 && w <= 12 && h >= 8);
    if (filled && thin) return { pseudo, width: Math.round(w), height: Math.round(h), color: bg, vertical: w <= 12 && h > w };
  }
  return null;
}

/** Lines for the selected text, photo or section: add a line above/below, and resize, recolour or remove the built-in red line. */
export function LineControls({ st, setStyles, el, section = false }) {
  const [builtIn, setBuiltIn] = useState(null);
  useEffect(() => {
    // measured after the page has applied the current styles
    const id = requestAnimationFrame(() => setBuiltIn(builtInLine(el)));
    return () => cancelAnimationFrame(id);
  }, [el, st]);
  const added = !!(st.lineAbove || st.lineBelow);
  const kind = LINE_KINDS[st.lineAbove || st.lineBelow] || LINE_KINDS.accent;
  const removed = st.accentThickness === "0px";
  const showBuiltIn = section || builtIn || removed || st.accentLength || st.accentColor;
  return (
    <div className="live-lines" data-testid="live-lines">
      <div className="live-row">
        <label className="live-field">Line above
          <select value={st.lineAbove || ""} onChange={(e) => setStyles({ lineAbove: e.target.value })} data-testid="live-line-above">
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="live-field">Line below
          <select value={st.lineBelow || ""} onChange={(e) => setStyles({ lineBelow: e.target.value })} data-testid="live-line-below">
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      {added && <>
        <div className="header-style-sliders">
          {st.lineLength === "100%" || (!st.lineLength && kind.length === "100%")
            ? <div className="live-row"><span className="live-hint live-hint-small">Full width.</span><button type="button" className="live-btn" onClick={() => setStyles({ lineLength: "120px" })} data-testid="live-line-shorten">Make it shorter</button></div>
            : <SliderField label="Length (px)" min={8} max={1200} value={st.lineLength || ""} fallback={num(kind.length)} onChange={(v) => setStyles({ lineLength: v })} testid="live-line-length" />}
          <SliderField label="Thickness (px)" min={1} max={12} value={st.lineThickness || ""} fallback={num(kind.thickness)} onChange={(v) => setStyles({ lineThickness: v })} testid="live-line-thickness" />
          <SliderField label="Space from text (px)" min={0} max={120} value={st.lineGap || ""} fallback={num(kind.gap)} onChange={(v) => setStyles({ lineGap: v })} testid="live-line-gap" />
        </div>
        <div className="live-row">
          <ColorField label="Line colour" value={st.lineColor || ""} fallback={kind.color} onChange={(v) => setStyles({ lineColor: v })} testid="live-line-color" />
          <button type="button" className="live-btn" onClick={() => setStyles({ lineLength: "100%" })} title="Full width" data-testid="live-line-full"><Minus size={14} /> Full width</button>
        </div>
        <button type="button" className="live-btn" onClick={() => setStyles({ lineAbove: "", lineBelow: "", lineColor: "", lineLength: "", lineThickness: "", lineGap: "" })} data-testid="live-line-delete"><Trash2 size={14} /> Delete added line</button>
      </>}

      {showBuiltIn && <div className="live-lines-builtin" data-testid="live-line-builtin">
        <p className="live-label" style={{ margin: "10px 0 4px" }}>{section ? "Red lines in this section" : builtIn?.vertical ? "Red line beside this text" : "Red line on this text"}</p>
        {removed
          ? <div className="live-row"><span className="live-hint live-hint-small">Removed.</span><button type="button" className="live-btn" onClick={() => setStyles({ accentThickness: "" })} data-testid="live-accent-restore"><RotateCcw size={14} /> Bring it back</button></div>
          : <>
            <div className="header-style-sliders">
              {!builtIn?.vertical && <SliderField label="Length (px)" min={8} max={400} value={st.accentLength || ""} fallback={builtIn?.width || 42} onChange={(v) => setStyles({ accentLength: v })} testid="live-accent-length" />}
              <SliderField label="Thickness (px)" min={1} max={12} value={st.accentThickness || ""} fallback={builtIn ? (builtIn.vertical ? builtIn.width : builtIn.height) : 2} onChange={(v) => setStyles({ accentThickness: v })} testid="live-accent-thickness" />
              {!builtIn?.vertical && <SliderField label="Space from text (px)" min={0} max={120} value={st.accentGap || ""} fallback={30} onChange={(v) => setStyles({ accentGap: v })} testid="live-accent-gap" />}
            </div>
            <div className="live-row">
              <ColorField label="Colour" value={st.accentColor || ""} fallback="#a3234a" onChange={(v) => setStyles({ accentColor: v })} testid="live-accent-color" />
              <button type="button" className="live-btn" onClick={() => setStyles({ accentThickness: "0px" })} data-testid="live-accent-delete"><Trash2 size={14} /> {section ? "Remove red lines" : "Delete line"}</button>
            </div>
            {(st.accentLength || st.accentThickness || st.accentGap || st.accentColor) && <button type="button" className="live-btn" onClick={() => setStyles({ accentLength: "", accentThickness: "", accentGap: "", accentColor: "" })} data-testid="live-accent-reset"><RotateCcw size={14} /> Standard red line</button>}
          </>}
      </div>}
      {section && <div className="live-row" style={{ marginTop: 8 }}>
        <label className="live-field">Thin grey dividers in this section
          <select value={st.dividers || ""} onChange={(e) => setStyles({ dividers: e.target.value })} data-testid="live-dividers">
            <option value="">Show</option><option value="hide">Hide</option>
          </select>
        </label>
      </div>}
      <p className="live-hint live-hint-small">The length, thickness and space of every red line on the site are set in Edit Header → Red lines; changes here apply only to this {section ? "section" : "text"}.</p>
    </div>
  );
}
