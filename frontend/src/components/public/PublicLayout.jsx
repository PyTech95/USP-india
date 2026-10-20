import { HtmlDiv } from "./editor/HtmlDiv";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { useSite, PreviewCtx, SitePreviewProvider } from "../../lib/site";
import { media } from "../../lib/api";
import { LiveEditorProvider, useLiveEditor } from "./editor/LiveEditorProvider";
import { SiteChromeEditor } from "./editor/SiteChromeEditor";
import { HeaderEditor } from "./editor/HeaderEditor";
import { HeaderStyleTag } from "./editor/HeaderStyleTag";
import { SiteTextStyles } from "./editor/TextStyleTag";
import { SiteText } from "./editor/SiteText";

function Dropdown({ item, onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname, loc.hash]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const active = loc.pathname.startsWith(item.href);
  const timer = useRef(null);
  const desktop = (e) => e.pointerType === "mouse" && window.matchMedia("(min-width: 961px)").matches;
  const enter = (e) => { if (desktop(e)) { clearTimeout(timer.current); setOpen(true); } };
  const leave = (e) => { if (desktop(e)) timer.current = setTimeout(() => setOpen(false), 160); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <li ref={ref} style={{ position: "relative" }} onPointerEnter={enter} onPointerLeave={leave}
      onKeyDown={(e) => e.key === "Escape" && (setOpen(false), ref.current.querySelector("button").focus())}>
      <span style={{ display: "inline-flex" }}>
        <button type="button" className="nav-link" aria-current={active ? "page" : undefined} aria-expanded={open} onClick={(e) => setOpen((o) => (e.detail && desktop({ pointerType: "mouse" }) ? true : !o))} data-testid={`nav-${item.id}`}><SiteText path={item.editPath}>{item.label}</SiteText></button>
        <button type="button" className="nav-link" style={{ padding: "0 .5rem" }} aria-expanded={open} aria-label={`${item.label} submenu`}
          onClick={() => setOpen((o) => !o)} data-testid={`nav-${item.id}-toggle`}>
          <ChevronDown size={16} aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
        </button>
      </span>
      {open && (
        <ul className={`dropdown ${item.children.some((c) => c.children?.length) ? "mega" : ""}`} data-testid={`nav-${item.id}-menu`}>
          {item.children.map((c, ci) => (
            <li key={c.id} className={c.children?.length ? "mega-col" : undefined}>
              <Link to={c.href} onClick={onNavigate} className={c.children?.length ? "mega-head" : undefined} data-testid={`nav-${c.id}`}><SiteText path={`${item.editPath.replace(/\.label$/, "")}.children.${ci}.label`}>{c.label}</SiteText></Link>
              {c.children?.length > 0 && (
                <ul>{c.children.map((g, gi) => <li key={g.id}><Link to={g.href} onClick={onNavigate} data-testid={`nav-${g.id}`}><SiteText path={`${item.editPath.replace(/\.label$/, "")}.children.${ci}.children.${gi}.label`}>{g.label}</SiteText></Link></li>)}</ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Header({ site: savedSite }) {
  const { headerPreview } = useLiveEditor();
  const site = headerPreview || savedSite;
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <SitePreviewProvider site={site}><header className="header" id="site-header" data-testid="site-header">
      <HeaderStyleTag styles={site?.header_styles} />
      <div className="wrap header-inner">
        <Link to="/" className="brand" data-testid="brand-link">
          {site?.logo && <img src={media(site.logo.src)} alt="" width={site.logo.width} height={site.logo.height} style={{ height: 44, width: "auto" }} data-site-edit="logo_media_id" data-testid="header-logo" />}
          <span><SiteText path="brand_label" className="brand-name" data-testid="header-brand-name" fallback="USP" /><SiteText path="full_name" className="brand-sub" data-testid="header-brand-subtitle" /></span>
        </Link>
        <nav aria-label="Main">
          <button type="button" className="nav-link menu-toggle" aria-expanded={open} aria-controls="main-menu" onClick={() => setOpen(!open)} data-testid="mobile-menu-toggle">
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />} <SiteText name="menu" />
          </button>
          <ul id="main-menu" className={`nav-list ${open ? "open" : ""}`}>
            {(site?.menus?.main || []).map((i, index) =>
              i.children?.length ? <Dropdown key={i.id} item={{ ...i, editPath: `menus.main.${index}.label` }} onNavigate={close} /> : (
                <li key={i.id}><NavLink to={i.href} end={i.href === "/"} className="nav-link" onClick={close} data-testid={`nav-${i.id}`}><SiteText path={`menus.main.${index}.label`}>{i.label}</SiteText></NavLink></li>
              )
            )}
          </ul>
        </nav>
      </div>
    </header></SitePreviewProvider>
  );
}

const FacebookIcon = () => <svg width="10" height="17" viewBox="0 0 320 512" fill="currentColor" aria-hidden="true" className="fb"><path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z" /></svg>;
const InstagramIcon = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" /></svg>;
const SOCIALS = [{ key: "facebook", label: "Facebook", Icon: FacebookIcon }, { key: "instagram", label: "Instagram", Icon: InstagramIcon }];

function Footer({ site }) {
  const email = site?.contact?.email || "info@uspindia.org";
  return (
    <footer className="footer usp-footer" id="site-footer" data-testid="site-footer">
      <div className="usp-footer-row">
        <a href={`mailto:${email}`} className="usp-footer-email" data-site-edit="contact.email" data-testid="footer-email">{email}</a>
        <div className="usp-footer-social">
          {SOCIALS.map(({ key, label, Icon }) => {
            const url = (site?.social || []).find((s) => `${s.label} ${s.url}`.toLowerCase().includes(key))?.url || "#";
            return <a key={key} href={url} target={url === "#" ? undefined : "_blank"} rel="noopener noreferrer" aria-label={label} data-testid={`footer-social-${key}`}><Icon /></a>;
          })}
        </div>
      </div>
      <div className="usp-footer-row usp-footer-meta">
        <span data-site-style="display.copyright" data-testid="footer-copyright">© {new Date().getFullYear()} {site?.full_name || "Urban Suburban Perspectives"}</span>
        <details data-testid="footer-privacy" className="footer-privacy">
          <summary data-testid="footer-privacy-toggle">Privacy Policy</summary>
          <HtmlDiv data-site-edit="privacy_html" data-testid="footer-privacy-body" html={site?.privacy_html || ""} />
        </details>
      </div>
    </footer>
  );
}

function useHashScroll() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    let tries = 0;
    const t = setInterval(() => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el || ++tries > 30) {
        clearInterval(t);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
    return () => clearInterval(t);
  }, [pathname, hash]);
}

export default function PublicLayout({ preview = false }) {
  const site = useSite();
  useHashScroll();
  return (
    <PreviewCtx.Provider value={preview}><LiveEditorProvider preview={preview}>
      <div className="site" id="public-site">
        <SiteTextStyles />
        <a href="#main" className="skip" data-testid="skip-to-content"><SiteText name="skip" /></a>
        {(preview || site?.preview_banner) && (
          <div className="preview-banner" data-testid="preview-banner" role="note">
            <div className="wrap">{preview ? "Private draft preview — not visible to the public. Unapproved photographs are flagged." : "Private preview — content marked “Draft placeholder” is awaiting client approval."}</div>
          </div>
        )}
        <Header site={site} />
        <main id="main" tabIndex={-1}><Outlet /></main>
        <Footer site={site} />
        <SiteChromeEditor />
        <HeaderEditor />
      </div>
    </LiveEditorProvider></PreviewCtx.Provider>
  );
}
