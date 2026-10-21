(() => {
  const sy = window.scrollY;
  const root = document.querySelector('#public-site') || document.body;
  const r4 = (r) => [Math.round(r.left), Math.round(r.top + sy), Math.round(r.width), Math.round(r.height)];
  const key = (el, i) => el.getAttribute('data-testid') || (el.id ? '#' + el.id : '') || `${el.tagName.toLowerCase()}.${(el.className || '').toString().trim().split(/\s+/).slice(0, 2).join('.')}@${i}`;
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const sections = [...root.querySelectorAll('header#site-header, main [data-sec], main > section, main > div > section, footer, #site-footer')].filter(vis).map((el, i) => ({ k: key(el, i), box: r4(el.getBoundingClientRect()), tf: getComputedStyle(el).transform }));
  const textSel = 'h1,h2,h3,h4,p,li,blockquote,figcaption,a.button,a.more-link,button.more-link,.eyebrow,[data-edit]';
  const texts = [...root.querySelectorAll(textSel)].filter((el) => !el.closest('.live-ui') && vis(el)).map((el, i) => {
    const cs = getComputedStyle(el);
    return { k: key(el, i), box: r4(el.getBoundingClientRect()), fs: cs.fontSize, lh: cs.lineHeight, fw: cs.fontWeight, ff: cs.fontFamily.split(',')[0], ls: cs.letterSpacing, ta: cs.textAlign, tf: cs.transform, txt: (el.textContent || '').trim().slice(0, 40) };
  });
  const imgs = [...root.querySelectorAll('main img, main figure')].filter(vis).map((el, i) => ({ k: key(el, i), box: r4(el.getBoundingClientRect()), of: getComputedStyle(el).objectFit, op: getComputedStyle(el).objectPosition }));
  return { vw: document.documentElement.clientWidth, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, sections, texts, imgs };
})()
