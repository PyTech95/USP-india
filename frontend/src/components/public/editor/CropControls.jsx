import { RotateCcw, Crosshair } from "lucide-react";

// Frame shapes offered for any photo. "Original" removes the editor crop and
// falls back to the layout's own shape.
export const SHAPES = [
  ["", "Original"], ["1/1", "Square"], ["4/3", "4:3"], ["3/2", "3:2"], ["16/9", "16:9"], ["3/4", "3:4"], ["4/5", "4:5"],
];

export const parsePos = (v) => {
  const m = String(v || "").match(/(-?[\d.]+)%\s+(-?[\d.]+)%/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [50, 50];
};

export function CropControls({ st, setStyles }) {
  const zoom = parseFloat(st.zoom) || 1;
  const [x, y] = parsePos(st.objectPosition);
  const shape = (st.aspectRatio || "").replace(/\s/g, "");
  return (
    <div className="live-crop" data-testid="live-crop">
      <div className="live-field" style={{ marginBottom: 8 }}>Shape
        <div className="live-chips" role="group" aria-label="Photo shape">
          {SHAPES.map(([value, label]) => (
            <button key={label} type="button" className={`live-chip ${shape === value ? "live-on" : ""}`} aria-pressed={shape === value}
              onClick={() => setStyles({ aspectRatio: value })} data-testid={`live-crop-shape-${label.replace(":", "x").toLowerCase()}`}>{label}</button>
          ))}
        </div>
      </div>
      <label className="live-field">
        <span className="live-zoom-label">Zoom <b>{Math.round(zoom * 100)}%</b></span>
        <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setStyles({ zoom: Number(e.target.value) > 1.001 ? String(Number(e.target.value).toFixed(2)) : "" })} data-testid="live-crop-zoom" />
      </label>
      <p className="live-hint live-hint-small">Drag the photo on the page to choose what shows. Position: {Math.round(x)}% · {Math.round(y)}%</p>
      <div className="live-row" style={{ marginBottom: 0 }}>
        <button type="button" className="live-btn" onClick={() => setStyles({ objectPosition: "" })} data-testid="live-crop-center"><Crosshair size={14} /> Centre</button>
        <button type="button" className="live-btn" onClick={() => setStyles({ aspectRatio: "", zoom: "", objectPosition: "" })} data-testid="live-crop-reset"><RotateCcw size={14} /> Reset crop</button>
      </div>
    </div>
  );
}
