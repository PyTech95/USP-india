import { useEffect } from "react";
import { loadFont } from "../../../lib/site";

// Two stable IDs outrank reference selectors containing :has(#page-reference).
export const HeaderStyleTag = ({ styles = {} }) => {
  useEffect(() => { if (styles.fontFamily) loadFont(styles.fontFamily); }, [styles.fontFamily]);
  useEffect(() => { if (styles.brandFontFamily) loadFont(styles.brandFontFamily); }, [styles.brandFontFamily]);
  const font = (f) => (f ? `'${f}', Helvetica, Arial, sans-serif` : "");
  const border = styles.borderWidth && styles.borderWidth !== "0px" ? `${styles.borderWidth} solid ${styles.borderColor || "#e6e1dc"}` : styles.borderWidth === "0px" ? "0" : (styles.borderColor ? `1px solid ${styles.borderColor}` : "");
  const rules = [];
  const rule = (selectors, declarations) => {
    const css = Object.entries(declarations).filter(([, v]) => v && /^[#0-9a-zA-Z .,%()\-'\"]{1,100}$/.test(v))
      .map(([k, v]) => `${k}: ${v} !important`).join("; ");
    if (css) rules.push(`${selectors.map((s) => `html body #public-site#public-site#public-site.site #site-header#site-header${s}`).join(", ")} { ${css}; }`);
  };
  rule([""], { background: styles.backgroundColor, "padding-top": styles.paddingTop, "padding-bottom": styles.paddingBottom, position: styles.position,
    top: styles.position === "sticky" ? "0" : "", "z-index": styles.position === "sticky" ? "40" : "", "border-bottom": border, "margin-bottom": styles.marginBottom });
  rule([" .header-inner"], { background: styles.backgroundColor, "padding-left": styles.paddingLeft, "padding-right": styles.paddingRight, "min-height": styles.minHeight });
  rule([" .nav-link", " .dropdown a", " .menu-toggle"], { color: styles.color }); // menu text only — the brand has its own colours
  rule([" .brand-name"], { "font-size": styles.brandFontSize, color: styles.brandColor, "font-family": font(styles.brandFontFamily) });
  rule([" .brand-sub"], { "font-size": styles.subtitleFontSize, color: styles.subtitleColor, "font-family": font(styles.brandFontFamily) });
  rule([" .nav-link", " .dropdown a"], { "font-size": styles.fontSize, "font-weight": styles.fontWeight, "font-family": font(styles.fontFamily),
    "letter-spacing": styles.letterSpacing, "text-transform": styles.textTransform });
  rule([" .nav-list > li::before"], { "border-left-color": styles.separatorColor });
  rule([" .dropdown a"], { color: styles.dropdownColor });
  rule([" nav[aria-label=Main]"], { "padding-left": styles.navPaddingX, "padding-right": styles.navPaddingX });
  rule([" .brand img"], { height: styles.logoHeight });
  // Logo moved with the header editor: desktop header only (phones keep the logo in its place)
  const lx = /^-?\d+(\.\d+)?px$/.test(styles.logoOffsetX || "") ? styles.logoOffsetX : "0px";
  const ly = /^-?\d+(\.\d+)?px$/.test(styles.logoOffsetY || "") ? styles.logoOffsetY : "0px";
  if (lx !== "0px" || ly !== "0px") rules.push(`@media (min-width: 961px) { html body #public-site#public-site#public-site.site #site-header#site-header .brand img { position: relative !important; z-index: 2 !important; transform: translate(${lx}, ${ly}) !important; } }`);
  rule([" nav[aria-label=Main]", " .nav-list"], { background: styles.navBackgroundColor });
  rule([" .nav-list"], { gap: styles.navGap });
  rule([" .dropdown"], { background: styles.dropdownBackgroundColor });
  if (styles.mobileMenuBackgroundColor) rules.push(`@media (max-width: 960px) { html body #public-site#public-site#public-site.site #site-header#site-header .nav-list.open { background: ${styles.mobileMenuBackgroundColor} !important; } }`);
  rule([" .nav-link[aria-current=page]", " .nav-link:hover", " .dropdown a:hover"], { color: styles.activeColor });
  rule([" .nav-list > li > .nav-link:hover", " .nav-list > li > span > .nav-link:hover"], { background: styles.hoverBackgroundColor });
  rule([" .nav-list > li > .nav-link[aria-current=page]"], { "box-shadow": styles.activeLineColor ? `inset 0 -2px 0 ${styles.activeLineColor}` : "" });
  rule([" .dropdown a:hover"], { background: styles.dropdownHoverBackgroundColor });
  rule([""], { "box-shadow": { none: "none", soft: "0 2px 12px rgba(0, 0, 0, 0.06)", strong: "0 6px 24px rgba(0, 0, 0, 0.14)" }[styles.headerShadow] || "" });
  const lines = Object.entries({ "--accent-line-w": styles.accentLineWidth, "--accent-line": styles.accentLineThickness, "--accent-line-gap": styles.accentLineGap })
    .filter(([, v]) => /^\d+(\.\d+)?px$/.test(v || "")).map(([k, v]) => `${k}: ${v} !important`).join("; ");
  if (lines) rules.push(`html body #public-site, html body .fn-overlay { ${lines}; }`);
  // Footer colours: the footer box, the strip along its bottom ("skirting") and the line above it
  const footer = Object.entries({ "--footer-bg": styles.footerBackgroundColor, "--footer-strip": styles.footerStripColor, "--footer-line": styles.footerLineColor })
    .filter(([, v]) => /^(#[0-9a-fA-F]{3,8}|transparent)$/.test(v || "")).map(([k, v]) => `${k}: ${v} !important`).join("; ");
  if (footer) rules.push(`html body #public-site #site-footer { ${footer}; }`);
  return rules.length ? <style data-testid="header-style-overrides">{rules.join("\n")}</style> : null;
};