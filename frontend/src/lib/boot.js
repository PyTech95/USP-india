import { useEffect } from "react";

// Opening a page: the server sends a plain version of the page for search engines (backend/ssr.py). For
// visitors, ssr.py hides the page (html.booting) from the first moment, so neither that plain version nor a
// half-built page (header without its logo, empty content) is ever seen. This shows the finished page in
// one soft fade once the site settings and the page content are in and the fonts are ready (or after a
// short wait). ssr.py shows the plain version at once if the site's script fails to load, and after 15 s
// whatever happens; visitors without JavaScript (and search engines reading the HTML) always get it.
const MAX_WAIT = 2500; // after the site settings are in (ms)

export function useBootReveal(site) {
  useEffect(() => {
    const html = document.documentElement;
    if (!html.classList.contains("booting") || !site) return undefined;
    let done = false, observer = null;
    const ready = () => {
      const main = document.getElementById("main");
      return !!main && main.children.length > 0 && !main.querySelector('[aria-busy="true"]');
    };
    const show = () => {
      if (done) return;
      done = true;
      if (observer) observer.disconnect();
      clearTimeout(cap);
      const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      Promise.race([fonts, new Promise((r) => setTimeout(r, 700))])
        .then(() => requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove("booting"))));
    };
    const cap = setTimeout(show, MAX_WAIT);
    if (ready()) show();
    else {
      observer = new MutationObserver(() => { if (ready()) show(); });
      observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-busy"] });
    }
    return () => { if (observer) observer.disconnect(); clearTimeout(cap); };
  }, [site]);
}
