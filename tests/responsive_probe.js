(() => {
  const vw = document.documentElement.clientWidth;
  const root = document.querySelector('#public-site') || document.body;
  const name = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const c = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(x => x && !/^(reveal|reveal-up|in-view|d\d)$/.test(x)).slice(0, 3);
    if (c.length) s += '.' + c.join('.');
    const t = el.getAttribute('data-testid'); if (t) s += `[data-testid=${t}]`;
    const e = el.getAttribute('data-edit'); if (e) s += `[data-edit=${e}]`;
    return s;
  };
  const sec = (el) => { const s = el.closest('[data-sec],section,header,footer'); return s ? (s.getAttribute('data-testid') || s.id || s.className.toString().split(' ')[0] || s.tagName) : ''; };
  const visible = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const clippedByInner = (el) => { let p = el.parentElement; while (p && p !== root) { const cs = getComputedStyle(p); if (/(hidden|auto|scroll|clip)/.test(cs.overflowX)) { const r = p.getBoundingClientRect(); if (r.right <= vw + 2 && r.left >= -2) return name(p); } p = p.parentElement; } return null; };
  const all = [...root.querySelectorAll('*')].filter(el => !el.closest('.live-ui') && !['SCRIPT','STYLE','SOURCE','BR','PATH','SVG','G','DEFS','USE'].includes(el.tagName.toUpperCase()) && !(el instanceof SVGElement));
  const vis = all.filter(visible);
  const sy = window.scrollY;
  const box = (r) => [Math.round(r.left), Math.round(r.top + sy), Math.round(r.width), Math.round(r.height)];
  // 1 horizontal offenders (outermost)
  const off = new Set(vis.filter(el => { const r = el.getBoundingClientRect(); return r.right > vw + 2 || r.left < -2; }));
  const outer = [...off].filter(el => !off.has(el.parentElement)).map(el => { const r = el.getBoundingClientRect(); return { el: name(el), sec: sec(el), box: box(r), over: Math.round(Math.max(r.right - vw, -r.left)), innerClip: clippedByInner(el), tf: getComputedStyle(el).transform !== 'none' ? getComputedStyle(el).transform.slice(0, 40) : '' }; }).filter(o => !o.innerClip);
  // 2 text overflow inside own box
  const textEls = vis.filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1));
  const tover = textEls.filter(el => { const cs = getComputedStyle(el); return cs.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 3 && el.clientWidth > 0 && cs.display !== 'inline'; }).map(el => ({ el: name(el), sec: sec(el), cw: el.clientWidth, sw: el.scrollWidth }));
  // 3 text vs text overlaps
  const blocks = textEls.filter(el => !['SPAN','A','STRONG','EM','B','I','LABEL'].includes(el.tagName) || getComputedStyle(el).display !== 'inline');
  const R = blocks.map(el => [el, el.getBoundingClientRect()]);
  const ov = [];
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const [a, ra] = R[i], [b, rb] = R[j];
    if (a.contains(b) || b.contains(a)) continue;
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 4 && h > 4) ov.push({ a: name(a), b: name(b), sec: sec(a), area: Math.round(w * h), ia: [Math.round(w), Math.round(h)], abox: box(ra), bbox: box(rb) });
  }
  ov.sort((x, y) => y.area - x.area);
  // 4 desktop geometry applied at this width
  const geo = vis.filter(el => /--ed-(t|w|h)/.test(el.getAttribute('style') || '')).map(el => { const cs = getComputedStyle(el); return { el: name(el), sec: sec(el), tf: cs.transform !== 'none', w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }; });
  // 5 tiny fonts
  const tiny = textEls.filter(el => parseFloat(getComputedStyle(el).fontSize) < 12).map(el => name(el) + ':' + getComputedStyle(el).fontSize).slice(0, 5);
  // 6 images clipped/cropped weird: images narrower than 40% vw on mobile with ed-w? skip
  return { vw, docW: document.documentElement.scrollWidth, bodyW: document.body.scrollWidth, siteW: root.scrollWidth, h: document.documentElement.scrollHeight,
    horiz: outer.slice(0, 8), horizN: outer.length, textOverflow: tover.slice(0, 6), textOverflowN: tover.length, overlaps: ov.slice(0, 6), overlapN: ov.length,
    geoTransformsActive: geo.filter(g => g.tf).length, geoN: geo.length, tiny, editorDock: !!document.querySelector('[data-testid=live-editor-dock]'), liveEditing: document.body.classList.contains('live-editing') };
})()
