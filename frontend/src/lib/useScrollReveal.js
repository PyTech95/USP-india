import { useEffect } from "react";

// Scroll reveal (styles/scroll-reveal.css): photos are revealed left to right; text and other blocks fade
// in and rise — each as it scrolls into view, so the whole site moves the same way.
const PHOTOS = [".photo"];
const UP = [".hero-text", ".prose", ".lede", ".eyebrow", ".h1", ".h2", ".h3", ".aside-statement", ".area-strip", ".invite-inner", ".hero-actions", ".split-text", ".image-body", ".pull-quote", ".work-card", ".note-card", ".note-item"];
const STEP = 0.1, MAX_DELAY = 0.5; // things that appear together follow one another (seconds)

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
    PHOTOS.forEach((sel) => scope.querySelectorAll(sel).forEach((el) => { el.classList.add("reveal", "reveal-img"); targets.add(el); }));
    UP.forEach((sel) => scope.querySelectorAll(sel).forEach((el) => { el.classList.add("reveal", "reveal-up"); targets.add(el); }));

    // Show a group of elements, top to bottom and left to right, each a moment after the one before.
    const show = (els) => {
      const list = els.filter((el) => !el.classList.contains("in-view")).map((el) => [el, el.getBoundingClientRect()])
        .sort((a, b) => (Math.abs(a[1].top - b[1].top) > 8 ? a[1].top - b[1].top : a[1].left - b[1].left));
      list.forEach(([el], i) => {
        el.style.setProperty("--rv-d", `${Math.min(i * STEP, MAX_DELAY).toFixed(2)}s`);
        el.classList.add("in-view");
        io.unobserve(el);
        targets.delete(el);
      });
    };

    const io = new IntersectionObserver((entries) => {
      show(entries.filter((e) => e.isIntersecting).map((e) => e.target));
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    targets.forEach((el) => io.observe(el));

    // Also check on scroll: shows anything in (or above) the visible part of the page. IntersectionObserver
    // can drop its first entry right after a route change, and a fast jump (a link to a section further
    // down) must never leave what is above the screen hidden.
    let frame = 0;
    const check = () => {
      frame = 0;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      show([...targets].filter((el) => el.getBoundingClientRect().top < vh * 0.94));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    const first = requestAnimationFrame(check);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // Printing (or saving as PDF) shows everything.
    const all = () => show([...targets]);
    window.addEventListener("beforeprint", all);

    return () => {
      io.disconnect();
      cancelAnimationFrame(first);
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("beforeprint", all);
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
