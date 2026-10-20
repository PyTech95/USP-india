import { useEffect } from "react";

// Images/cards slide in from the left; text blocks rise up — for a varied scroll.
const LEFT = [".photo", ".collage", ".mosaic", ".gallery", ".work-card", ".note-card", ".note-item"];
const UP = [".hero-text", ".prose", ".lede", ".eyebrow", ".h1", ".h2", ".h3", ".aside-statement", ".area-strip", ".invite-inner", ".hero-actions", ".split-text", ".image-body", ".pull-quote"];

export function useScrollReveal(deps = []) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const scope = document.querySelector("main");
    if (!scope) return undefined;

    // Reduced motion: never hide anything.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    // While the live editor is active, keep everything visible (don't hide for editing).
    if (document.body.classList.contains("live-editing")) {
      scope.querySelectorAll(".reveal").forEach((el) => el.classList.add("in-view"));
      return undefined;
    }

    document.documentElement.classList.add("motion-ready");

    const targets = new Set();
    scope.querySelectorAll(".reveal").forEach((el) => targets.add(el));
    LEFT.forEach((sel) => scope.querySelectorAll(sel).forEach((el) => { el.classList.add("reveal"); targets.add(el); }));
    UP.forEach((sel) => scope.querySelectorAll(sel).forEach((el) => { el.classList.add("reveal", "reveal-up"); targets.add(el); }));

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

    targets.forEach((el) => io.observe(el));

    // Immediately reveal anything already within (or above) the viewport. IntersectionObserver
    // can drop its initial entry when observe() runs right after a route change / repeated
    // dep-driven re-runs, which previously left SPA-navigated pages stuck invisible.
    const revealInView = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      targets.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh * 0.96) { el.classList.add("in-view"); io.unobserve(el); }
      });
    };
    revealInView();
    const raf = requestAnimationFrame(revealInView);

    // Safety net: if anything is missed, reveal it after a short while.
    const t = setTimeout(() => targets.forEach((el) => el.classList.add("in-view")), 2600);

    return () => { io.disconnect(); clearTimeout(t); cancelAnimationFrame(raf); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
