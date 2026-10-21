// Iteration 28 responsive probe: real text (Range line rects) + image bounds, clipping, overlap, section containment, footer collision.
(() => {
  const vw = document.documentElement.clientWidth, sy = window.scrollY;
  const root = document.querySelector('#public-site') || document.body;
  const main = document.querySelector('main');
  const footer = document.querySelector('#site-footer');
  const header = document.querySelector('#site-header');
  const B = (r) => [Math.round(r.left), Math.round(r.top + sy), Math.round(r.width), Math.round(r.height)];
  const name = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const c = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter((x) => x && !/^(reveal|reveal-up|in-view|d\d)$/.test(x)).slice(0, 2);
    if (c.length) s += '.' + c.join('.');
    const t = el.getAttribute('data-testid'); if (t) s += `[data-testid=${t}]`;
    const e = el.getAttribute('data-edit'); if (e) s += `[data-edit=${e}]`;
    return s;
  };
  const csCache = new Map(); const CS = (el) => { let c = csCache.get(el); if (!c) { c = getComputedStyle(el); csCache.set(el, c); } return c; };
  const hidden = (el) => { for (let p = el; p && p !== document.body; p = p.parentElement) { const cs = CS(p); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return true; } return false; };
  const topSec = (el) => { if (!main.contains(el)) return el.closest('header') ? 'header' : el.closest('footer') ? 'footer' : 'other'; let s = el; while (s.parentElement && s.parentElement.parentElement !== main) s = s.parentElement; return s === el && s.parentElement === main ? 'main' : s; };
  const secName = (s) => typeof s === 'string' ? s : (s.getAttribute('data-sec') ? 'sec:' + (s.getAttribute('data-testid') || s.id || s.className.toString().split(' ').slice(0, 2).join('.')) : name(s));
  const inter = (a, b) => [Math.min(a.right, b.right) - Math.max(a.left, b.left), Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)];
  // collect text lines
  const lines = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.textContent.trim().length < 2) continue;
    const el = n.parentElement; if (!el || el.closest('.live-ui,script,style,noscript,.skip,.sr-only,[aria-hidden=true]')) continue;
    if (hidden(el)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) { if (r.width < 2 || r.height < 2 || r.left < -3000) continue; lines.push({ el, r }); }
  }
  const owners = [...new Set(lines.map((l) => l.el))];
  // A offscreen text, B ancestor clipping
  const clipAnc = (el) => { const out = []; for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) { const cs = CS(p); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') out.push(p); } return out; };
  const textOff = [], textClip = [];
  const seenOff = new Set(), seenClip = new Set();
  for (const { el, r } of lines) {
    if ((r.right > vw + 1 || r.left < -1) && !seenOff.has(el)) {
      const scroller = clipAnc(el).find((p) => /auto|scroll/.test(CS(p).overflowX) && p.scrollWidth > p.clientWidth);
      if (!scroller) { seenOff.add(el); textOff.push({ el: name(el), sec: secName(topSec(el)), line: B(r), over: Math.round(Math.max(r.right - vw, -r.left)), txt: el.textContent.trim().slice(0, 40) }); }
    }
    if (!seenClip.has(el)) {
      for (const p of clipAnc(el)) {
        const pr = p.getBoundingClientRect(); const cs = CS(p);
        if (/auto|scroll/.test(cs.overflowY) && /auto|scroll/.test(cs.overflowX)) continue; // scrollable, reachable
        const hx = cs.overflowX !== 'visible' && (r.left < pr.left - 2 || r.right > pr.right + 2);
        const hy = cs.overflowY !== 'visible' && !/auto|scroll/.test(cs.overflowY) && (r.top < pr.top - 2 || r.bottom > pr.bottom + 2);
        if (hx || hy) { seenClip.add(el); textClip.push({ el: name(el), by: name(p), sec: secName(topSec(el)), line: B(r), clipBox: B(pr), txt: el.textContent.trim().slice(0, 40) }); break; }
      }
    }
  }
  // C text-text overlap (different owners, neither contains other, overlap > 35% of smaller line height)
  const textOv = []; const ovKey = new Set();
  const L = lines.filter((l) => l.r.bottom > -1e4);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j]; if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const [w, h] = inter(a.r, b.r);
    if (w > 4 && h > 0.35 * Math.min(a.r.height, b.r.height)) {
      const k = name(a.el) + '|' + name(b.el); if (ovKey.has(k)) continue; ovKey.add(k);
      textOv.push({ a: name(a.el), b: name(b.el), sec: secName(topSec(a.el)), ia: [Math.round(w), Math.round(h)], aLine: B(a.r), bLine: B(b.r), at: a.el.textContent.trim().slice(0, 30), bt: b.el.textContent.trim().slice(0, 30) });
    }
  }
  // D images
  const imgs = [...main.querySelectorAll('img')].filter((im) => !hidden(im) && im.getBoundingClientRect().width > 2);
  const imgOff = [], textOnImg = [], imgBroken = [];
  for (const im of imgs) {
    const r = im.getBoundingClientRect();
    if (im.complete && im.naturalWidth === 0) imgBroken.push(im.currentSrc || im.src);
    const clipped = clipAnc(im).some((p) => { const pr = p.getBoundingClientRect(); return pr.left >= -2 && pr.right <= vw + 2 && (pr.left > r.left + 2 || pr.right < r.right - 2); });
    if ((r.left < -2 || r.right > vw + 2) && !clipped) imgOff.push({ img: name(im.closest('figure') || im), box: B(r) });
    const fig = im.closest('figure') || im.parentElement;
    const seen = new Set();
    for (const { el, r: tr } of lines) {
      if (!main.contains(el) || seen.has(el) || fig.contains(el)) continue;
      const [w, h] = inter(r, tr); if (w > 4 && h > 4) { seen.add(el); textOnImg.push({ img: name(fig), text: name(el), sec: secName(topSec(el)), line: B(tr), txt: el.textContent.trim().slice(0, 30) }); }
    }
  }
  // E section containment: top-level main blocks must not overlap each other; text must stay inside its block horizontally
  const blocks = [...main.querySelectorAll(':scope > div > *, :scope > div > div > [data-sec]')].filter((b) => !hidden(b) && b.getBoundingClientRect().height > 2);
  const tops = [...main.querySelectorAll(':scope > div > *')].filter((b) => !hidden(b) && b.getBoundingClientRect().height > 2 && !/fixed|absolute/.test(CS(b).position));
  const secOv = [];
  for (let i = 0; i + 1 < tops.length; i++) { const a = tops[i].getBoundingClientRect(), b = tops[i + 1].getBoundingClientRect(); if (a.bottom > b.top + 2 && inter(a, b)[0] > 4) secOv.push({ a: secName(tops[i]), b: secName(tops[i + 1]), overlap: Math.round(a.bottom - b.top) }); }
  const escape = []; const seenEsc = new Set();
  for (const { el, r } of lines) {
    if (!main.contains(el) || seenEsc.has(el)) continue; const s = topSec(el); if (typeof s === 'string') continue;
    const sr = s.getBoundingClientRect();
    if (r.left < sr.left - 2 || r.right > sr.right + 2 || r.top < sr.top - 2 || r.bottom > sr.bottom + 2) { seenEsc.add(el); escape.push({ el: name(el), sec: secName(s), line: B(r), secBox: B(sr), txt: el.textContent.trim().slice(0, 30) }); }
  }
  // F footer collision
  const fr = footer && footer.getBoundingClientRect(); const mr = main.getBoundingClientRect();
  const footHit = fr ? lines.filter((l) => main.contains(l.el) && l.r.bottom > fr.top + 1).slice(0, 5).map((l) => ({ el: name(l.el), line: B(l.r) })) : [];
  const mainBelowFooter = fr ? Math.round(Math.max(0, Math.max(...tops.map((t) => t.getBoundingClientRect().bottom)) - fr.top)) : 0;
  // G colored band rails
  const bands = [...main.querySelectorAll(':scope > div > .hb')].filter((b) => { const bg = CS(b).backgroundColor; return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'; }).map((b) => { const r = b.getBoundingClientRect(); return { b: secName(b), x: Math.round(r.left), r: Math.round(r.right), tf: CS(b).transform }; });
  const fx = fr ? [Math.round(fr.left), Math.round(fr.right)] : null;
  const heroEl = main.querySelector(':scope > div > *'); const hr = heroEl && heroEl.getBoundingClientRect();
  // H input fonts
  const smallInputs = [...root.querySelectorAll('input:not([type=hidden]),textarea,select')].filter((i) => !hidden(i) && i.getBoundingClientRect().width > 2 && parseFloat(CS(i).fontSize) < 16).map((i) => name(i) + ':' + CS(i).fontSize);
  const tiny = owners.filter((el) => parseFloat(CS(el).fontSize) < 12).map((el) => name(el) + ':' + CS(el).fontSize).slice(0, 6);
  return {
    vw, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, lines: lines.length,
    textOffN: textOff.length, textOff: textOff.slice(0, 8), textClipN: textClip.length, textClip: textClip.slice(0, 8),
    textOvN: textOv.length, textOv: textOv.slice(0, 8), imgOffN: imgOff.length, imgOff: imgOff.slice(0, 5), imgBroken: imgBroken.slice(0, 5),
    textOnImgN: textOnImg.length, textOnImg: textOnImg.slice(0, 6), secOvN: secOv.length, secOv: secOv.slice(0, 5),
    escapeN: escape.length, escape: escape.slice(0, 8), footHit, mainBelowFooter, bands, footerX: fx, heroX: hr ? [Math.round(hr.left), Math.round(hr.right)] : null,
    headerX: header ? [Math.round(header.getBoundingClientRect().left), Math.round(header.getBoundingClientRect().right)] : null,
    smallInputs, tiny, editorDock: !!document.querySelector('[data-testid=live-editor-dock]'), liveEditing: document.body.classList.contains('live-editing'),
    contentEditable: document.querySelectorAll('[contenteditable=true],[contenteditable=""]').length,
  };
})()
