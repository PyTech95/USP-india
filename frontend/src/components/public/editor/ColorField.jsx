import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export const FONTS = ["Public Sans", "Lora", "Source Serif 4", "Libre Baskerville", "Source Sans 3", "Noto Sans",
  "Atkinson Hyperlegible", "Cormorant", "Literata", "Playfair Display", "Merriweather", "DM Serif Display",
  "Montserrat", "Poppins", "Raleway", "Work Sans"];

export const px = (v) => (v ? parseInt(v, 10) : "");

const isHex = (v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v || "");
const RECENT_KEY = "usp-recent-colours";
const BRAND = ["#D41445", "#000000", "#2b2b2b", "#575757", "#ffffff", "#ebe7eb", "#edeae7", "#f5f3f1"];

const readRecent = () => { try { return JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]").filter(isHex).slice(0, 6); } catch { return []; } };
const remember = (hex) => {
  if (!isHex(hex)) return;
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify([hex.toLowerCase(), ...readRecent().filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, 6))); } catch { /* storage may be blocked */ }
};
// Site colours from Admin → Appearance (CSS variables on the page), then the brand set.
const sitePalette = () => {
  if (typeof document === "undefined") return BRAND;
  const cs = getComputedStyle(document.documentElement);
  const theme = ["--c-text", "--c-green", "--c-terracotta", "--c-ochre", "--c-surface", "--c-background"].map((v) => cs.getPropertyValue(v).trim()).filter(isHex);
  const seen = new Set();
  return [...theme, ...BRAND].filter((c) => { const k = c.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);
};

// Colour control: native picker + exact code, plus one-click site colours and recently used
// colours (shown while the field is active) and a clear button to go back to the default.
export function ColorField({ label, value, onChange, testid, fallback = "#ffffff" }) {
  const [recent, setRecent] = useState([]);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const set = (v) => {
    onChange(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { remember(v); }, 700);
  };
  const pick = (c) => { onChange(c); remember(c); setRecent(readRecent()); };
  return (
    <label className="live-field live-color-field" onFocus={() => setRecent(readRecent())}>{label}
      <span className="live-color-row">
        <input type="color" value={isHex(value) ? value : fallback} onChange={(e) => set(e.target.value)} data-testid={testid} aria-label="Pick colour" />
        <input type="text" className="live-color-hex" value={value || ""} placeholder={fallback} maxLength={24} onChange={(e) => set(e.target.value.trim())} data-testid={`${testid}-hex`} aria-label="Colour code" />
        {value ? <button type="button" className="live-color-clear" onClick={(e) => { e.preventDefault(); onChange(""); }} title="Back to the default colour" aria-label="Clear colour" data-testid={`${testid}-clear`}><X size={12} /></button> : null}
      </span>
      <span className="live-swatches" role="group" aria-label="Quick colours">
        {[...sitePalette(), ...recent.filter((c) => !sitePalette().map((p) => p.toLowerCase()).includes(c.toLowerCase()))].map((c) => (
          <button key={c} type="button" className={`live-swatch ${value && value.toLowerCase() === c.toLowerCase() ? "is-on" : ""}`} style={{ background: c }} title={c}
            onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.preventDefault(); pick(c); }} aria-label={`Use ${c}`} data-testid={`${testid}-swatch`} />
        ))}
      </span>
    </label>
  );
}

// Number box with a slider beside it, for smooth live adjustments.
export function SliderField({ label, value, onChange, min, max, step = 1, unit = "px", placeholder = "Default", testid, fallback }) {
  const n = value === "" || value === undefined || value === null ? "" : parseFloat(value);
  const emit = (v) => onChange(v === "" ? "" : `${v}${unit}`);
  return (
    <label className="live-field live-slider-field">{label}
      <span className="live-slider-row">
        <input type="range" min={min} max={max} step={step} value={n === "" || Number.isNaN(n) ? (Number.isFinite(parseFloat(fallback)) ? parseFloat(fallback) : min) : n} onChange={(e) => emit(e.target.value)} aria-label={`${typeof label === "string" ? label : "Value"} slider`} data-testid={testid ? `${testid}-range` : undefined} />
        <input type="number" min={min} max={max} step={step} value={Number.isNaN(n) ? "" : n} placeholder={placeholder} onChange={(e) => emit(e.target.value)} data-testid={testid} />
      </span>
    </label>
  );
}
