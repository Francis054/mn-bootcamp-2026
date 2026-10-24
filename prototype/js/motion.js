/* Motion layer: reveals, split headlines, header state, timeline progress,
   the anniversary "10" drawing, light parallax. Honours reduced motion. */
(function(){
'use strict';
const MN = window.MN || {};
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Split headlines into masked lines: <h1 data-split>Line one<br>Line two</h1> */
document.querySelectorAll('[data-split]').forEach(el => {
  const parts = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = parts.map((p,i)=>`<span class="split-line" style="--l:${i}"><span>${p.trim()}</span></span>`).join('');
  if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal','fade');
});

/* Auto-stagger children of [data-stagger] */
document.querySelectorAll('[data-stagger]').forEach(g => {
  [...g.children].forEach((c,i) => { if(!c.hasAttribute('data-reveal')) c.setAttribute('data-reveal',g.dataset.stagger||''); c.style.setProperty('--i', i % 8); });
});

const targets = document.querySelectorAll('[data-reveal], .mask-reveal, [data-draw], .split-line');
if (reduced() || !('IntersectionObserver' in window)) {
  targets.forEach(t => t.classList.add('is-in'));
} else {
  /* clip-path hides an element from IntersectionObserver, so masked/split items are observed through their parent */
  const proxy = new Map();
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { (proxy.get(e.target)||[e.target]).forEach(t=>t.classList.add('is-in')); io.unobserve(e.target); } }), { rootMargin:'0px 0px -8% 0px', threshold:0.01 });
  targets.forEach(t => { if (t.classList.contains('mask-reveal')) { const p=t.parentElement; if(!proxy.has(p)) proxy.set(p,[]); proxy.get(p).push(t); io.observe(p); } else io.observe(t); });
}
MN.reveal = root => (root||document).querySelectorAll('[data-reveal]:not(.is-in)').forEach(t=>t.classList.add('is-in'));

/* Header: transparent over dark hero -> solid on scroll; hide on fast scroll down */
const h = document.querySelector('.site-header');
if (h) {
  let last = scrollY, ticking = false;
  const upd = () => {
    const y = scrollY;
    h.classList.toggle('is-solid', y > 24);
    if (!document.body.classList.contains('menu-open')) h.classList.toggle('is-hidden', y > 640 && y > last + 4);
    if (y < last - 4) h.classList.remove('is-hidden');
    last = y; ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(upd); ticking = true; } }, { passive:true });
  upd();
}

/* Timeline progress line follows scroll */
document.querySelectorAll('[data-tl]').forEach(tl => {
  const bar = tl.querySelector('.tl__progress'); const items=[...tl.querySelectorAll('.tl__item')];
  const upd = () => {
    const r = tl.getBoundingClientRect(); const mid = innerHeight*0.6;
    const p = Math.max(0, Math.min(1, (mid - r.top) / r.height));
    if (bar) bar.style.height = (p * (r.height-16)) + 'px';
    items.forEach(it => { const ir=it.getBoundingClientRect(); it.classList.toggle('is-reached', ir.top < mid); });
  };
  if (reduced()) { if(bar) bar.style.height='calc(100% - 16px)'; items.forEach(i=>i.classList.add('is-reached')); return; }
  addEventListener('scroll', () => requestAnimationFrame(upd), { passive:true }); upd();
});

/* Horizontal journey rail: progress + drag-to-scroll + buttons */
document.querySelectorAll('[data-rail]').forEach(rail => {
  const track = rail.querySelector('.rail__track'), fill = rail.querySelector('.rail__fill');
  const upd = () => { const max = track.scrollWidth - track.clientWidth; if (fill) fill.style.transform = `scaleX(${max>0? (track.scrollLeft/max)*0.85+0.15 : 1})`; };
  track.addEventListener('scroll', () => requestAnimationFrame(upd), { passive:true }); upd();
  rail.querySelectorAll('[data-rail-go]').forEach(b => b.addEventListener('click', () => track.scrollBy({ left: (+b.dataset.railGo) * track.clientWidth * 0.8, behavior: reduced()?'auto':'smooth' })));
  let down=false, sx=0, sl=0, moved=false;
  track.addEventListener('pointerdown', e => { if(e.pointerType!=='mouse')return; down=true; moved=false; sx=e.clientX; sl=track.scrollLeft; });
  addEventListener('pointermove', e => { if(!down)return; const dx=e.clientX-sx; if(Math.abs(dx)>4){moved=true; track.classList.add('is-dragging');} track.scrollLeft=sl-dx; });
  addEventListener('pointerup', () => { down=false; track.classList.remove('is-dragging'); });
  track.addEventListener('click', e => { if(moved){ e.preventDefault(); e.stopPropagation(); moved=false; } }, true);
});

/* Light parallax on [data-parallax] (transform only, rAF, skipped if reduced) */
const px = [...document.querySelectorAll('[data-parallax]')];
if (px.length && !reduced()) {
  let tick=false;
  const upd = () => { px.forEach(el => { const r=el.getBoundingClientRect(); if (r.bottom<0||r.top>innerHeight) return; const k=+el.dataset.parallax||0.08; el.style.transform=`translate3d(0,${(r.top+r.height/2-innerHeight/2)*-k}px,0)`; }); tick=false; };
  addEventListener('scroll', () => { if(!tick){ requestAnimationFrame(upd); tick=true; } }, { passive:true }); upd();
}

/* Network lines: pause drift animation when off-screen */
document.querySelectorAll('.netlines').forEach(n => {
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(([e]) => n.classList.toggle('is-paused', !e.isIntersecting)).observe(n);
});

/* Count-up for [data-count] (verified figures only) */
document.querySelectorAll('[data-count]').forEach(el => {
  const end = +el.dataset.count, suf = el.dataset.suffix||'';
  const fmt = v => Math.round(v).toLocaleString('en-GB') + suf;
  if (reduced()) { el.textContent = fmt(end); return; }
  el.textContent = fmt(0);
  new IntersectionObserver(([e], o) => { if (!e.isIntersecting) return; o.disconnect(); const t0=performance.now(), d=1600;
    const step = t => { const p=Math.min(1,(t-t0)/d); el.textContent=fmt(end*(1-Math.pow(1-p,4))); if(p<1) requestAnimationFrame(step); }; requestAnimationFrame(step); }, { threshold:.6 }).observe(el);
});

/* Replay control for the "10" drawing */
document.querySelectorAll('[data-replay]').forEach(b => b.addEventListener('click', () => {
  const t = document.querySelector(b.dataset.replay); t.classList.remove('is-in'); void t.offsetWidth; requestAnimationFrame(()=>t.classList.add('is-in'));
}));
})();
