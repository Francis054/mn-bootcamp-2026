/* Shared components: icons, header, footer, admin shell, lightbox, modal,
   toast, tabs, dropdowns. Injected so every page stays consistent. */
(function(){
'use strict';
document.documentElement.classList.add('js');
const MN = window.MN = window.MN || {};
const body = document.body;
MN.root = body.dataset.root || '';
const R = MN.root;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
MN.reduced = () => reduce.matches;

/* ---------- Icons (stroke, 24 grid) ---------- */
const P = {
  'arrow-right':'<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left':'<path d="M19 12H5M11 6l-6 6 6 6"/>',
  'arrow-up-right':'<path d="M7 17L17 7M8 7h9v9"/>',
  'chevron-down':'<path d="M6 9l6 6 6-6"/>',
  'chevron-left':'<path d="M15 6l-6 6 6 6"/>',
  'chevron-right':'<path d="M9 6l6 6-6 6"/>',
  'x':'<path d="M6 6l12 12M18 6L6 18"/>',
  'menu':'<path d="M4 7h16M4 12h16M4 17h16"/>',
  'search':'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  'filter':'<path d="M4 5h16l-6 8v5l-4 2v-7z"/>',
  'plus':'<path d="M12 5v14M5 12h14"/>',
  'edit':'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  'trash':'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  'eye':'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  'map-pin':'<path d="M12 21s-7-6.1-7-11a7 7 0 0114 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'users':'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6.5 6.5 0 013.5 6"/>',
  'user':'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  'shield':'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  'lock':'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  'network':'<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v5M12 12l-6 5M12 12l6 5"/>',
  'terminal':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  'scan':'<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16"/>',
  'alert':'<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/>',
  'check':'<path d="M5 12.5l4.5 4.5L19 7"/>',
  'check-circle':'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 10"/>',
  'image':'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  'upload':'<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/>',
  'settings':'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  'home':'<path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
  'book':'<path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4zM20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z"/>',
  'layers':'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  'flag':'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  'grid':'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  'bell':'<path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 21h4"/>',
  'log-out':'<path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l-5-5 5-5M5 12h11"/>',
  'external':'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  'mail':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  'play':'<path d="M7 4l13 8-13 8z"/>',
  'download':'<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  'sidebar':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  'more':'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  'info':'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  'file':'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  'award':'<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',
  'sparkle':'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  'commit':'<circle cx="12" cy="12" r="3.5"/><path d="M3 12h5.5M15.5 12H21"/>',
  'copy':'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  'globe':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
  'cpu':'<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  'drag':'<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  'monitor':'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  'phone':'<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',
  'linkedin':'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.5M12 17v-4a2 2 0 014 0v4M12 10v7"/>',
  'facebook':'<path d="M14 8h3V4h-3a4 4 0 00-4 4v2H7v4h3v7h4v-7h3l1-4h-4V8z"/>',
  'instagram':'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5v.5"/>',
  'twitter':'<path d="M4 4l16 16M20 4L4 20"/>',
  'youtube':'<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5z"/>'
};
MN.icon = (n, cls) => `<svg class="i ${cls||''}" aria-hidden="true" focusable="false"><use href="#i-${n}"/></svg>`;
const sprite = document.createElement('div');
sprite.setAttribute('aria-hidden','true');
sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
sprite.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + Object.entries(P).map(([k,v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('') + '</svg>';
body.prepend(sprite);

/* Bootcamp wordmark mark (our community mark, not the official logo) */
MN.markSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8l7.5 2.9v5.6c0 4.8-3.2 8-7.5 9.9-4.3-1.9-7.5-5.1-7.5-9.9V5.7z"/><path d="M12 7.5v9M8.5 10.5L12 7.5l3.5 3"/></svg>';
MN.officialLogo = (w) => `<span class="logo-plate"><img src="${R}assets/logo/maxim-nyansa-foundation-logo.png" width="200" height="41" alt="Maxim Nyansa Foundation logo"${w?` style="width:${w}px"`:''}></span>`;
MN.lockup = (href) => `<a class="lockup" href="${href||R+'index.html'}" aria-label="2026 Cyber Bootcamp by Maxim Nyansa Foundation — home">
  <span class="wordmark"><span class="wordmark__mark">${MN.markSVG}</span><span class="wordmark__text"><b>Cyber Bootcamp</b><small>2026 · Accra</small></span></span>
  <span class="lockup__divider" aria-hidden="true"></span>${MN.officialLogo()}</a>`;
MN.avatar = (t, size) => `<span class="avatar ${size?'avatar--'+size:''}" style="--h:${t.hue}" aria-hidden="true">${t.initials}</span>`;

/* ---------- Public header ---------- */
const page = body.dataset.page || '';
const NAV = [
  { id:'home', label:'Home', href:'index.html' },
  { id:'bootcamp', label:'Bootcamp', menu:[
    { id:'overview', label:'Overview', href:'bootcamp.html', sub:'What the 2026 programme covers', ic:'shield' },
    { id:'journey', label:'Three-month journey', href:'journey.html', sub:'Oct – Dec 2026, phase by phase', ic:'commit' },
    { id:'classes', label:'Class archive', href:'classes.html', sub:'Weekly lessons and labs', ic:'book' },
    { id:'projects', label:'Projects & labs', href:'projects.html', sub:'Practical work from the cohort', ic:'terminal' } ]},
  { id:'trainees', label:'Trainees', href:'trainees.html' },
  { id:'events', label:'Events', href:'events.html' },
  { id:'gallery', label:'Gallery', href:'gallery.html' },
  { id:'anniversary', label:'10 Years', href:'anniversary.html' },
  { id:'about', label:'About', href:'about.html' }
];
const isCur = id => id===page ? ' aria-current="page"' : '';
const header = document.getElementById('site-header');
if (header) {
  const tone = body.dataset.headerTone || 'light';
  header.className = 'site-header';
  header.dataset.tone = tone;
  header.innerHTML = `<div class="container bar">${MN.lockup()}
    <nav class="nav" aria-label="Primary"><ul>${NAV.map(n => n.menu ? `<li class="has-menu"><button class="nav-link" aria-expanded="false" aria-haspopup="true"${n.menu.some(m=>m.id===page)?' aria-current="page"':''}>${n.label}${MN.icon('chevron-down','i--sm')}</button>
      <div class="dropdown" role="menu">${n.menu.map(m=>`<a role="menuitem" href="${R}${m.href}"${isCur(m.id)}><span class="ic">${MN.icon(m.ic)}</span><b>${m.label}</b><span>${m.sub}</span></a>`).join('')}</div></li>`
      : `<li><a class="nav-link" href="${R}${n.href}"${isCur(n.id)}>${n.label}</a></li>`).join('')}</ul></nav>
    <a class="btn btn--sm header-cta" href="${R}journey.html">Follow the cohort <span class="arrow">${MN.icon('arrow-right','i--sm')}</span></a>
    <button class="menu-toggle" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu"><span class="bars"><i></i><i></i><i></i></span></button></div>`;
  const mm = document.createElement('div');
  mm.className='mobile-menu'; mm.id='mobile-menu'; mm.setAttribute('aria-label','Menu'); mm.setAttribute('role','dialog'); mm.setAttribute('aria-modal','true');
  const flat = NAV.flatMap(n => n.menu ? n.menu : [n]);
  mm.innerHTML = `<nav aria-label="Mobile"><ol>${flat.map((n,i)=>`<li style="transition-delay:${120+i*40}ms"><a href="${R}${n.href}"${isCur(n.id)}>${n.label}</a></li>`).join('')}</ol></nav>
    <div class="mm-foot"><a class="btn" href="${R}journey.html">Follow the cohort <span class="arrow">${MN.icon('arrow-right','i--sm')}</span></a>
    <span class="label" style="color:#8FA597">Prototype · sample data</span></div>`;
  header.after(mm);
  const tgl = header.querySelector('.menu-toggle');
  const setMenu = open => {
    body.classList.toggle('menu-open', open);
    tgl.setAttribute('aria-expanded', open); tgl.setAttribute('aria-label', open?'Close menu':'Open menu');
    body.style.overflow = open ? 'hidden' : '';
    if (open) setTimeout(()=>mm.querySelector('a')?.focus(), 300);
  };
  tgl.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
  document.addEventListener('keydown', e => { if (e.key==='Escape' && body.classList.contains('menu-open')) { setMenu(false); tgl.focus(); } });
  window.addEventListener('resize', () => { if (innerWidth>1180 && body.classList.contains('menu-open')) setMenu(false); });
  // dropdowns: hover (pointer) + click + keyboard
  header.querySelectorAll('.has-menu').forEach(li => {
    const btn = li.querySelector('button'); let t;
    const set = o => { li.classList.toggle('is-open', o); btn.setAttribute('aria-expanded', o); };
    btn.addEventListener('click', () => set(!li.classList.contains('is-open')));
    li.addEventListener('mouseenter', () => { clearTimeout(t); set(true); });
    li.addEventListener('mouseleave', () => { t = setTimeout(()=>set(false), 160); });
    li.addEventListener('keydown', e => {
      const items=[...li.querySelectorAll('.dropdown a')]; const i=items.indexOf(document.activeElement);
      if (e.key==='Escape') { set(false); btn.focus(); }
      if (e.key==='ArrowDown') { e.preventDefault(); set(true); items[(i+1)%items.length].focus(); }
      if (e.key==='ArrowUp') { e.preventDefault(); items[(i-1+items.length)%items.length].focus(); }
    });
    li.addEventListener('focusout', e => { if (!li.contains(e.relatedTarget)) set(false); });
  });
}

/* ---------- Footer ---------- */
const footer = document.getElementById('site-footer');
if (footer) {
  footer.className = 'site-footer';
  footer.innerHTML = `<div class="container">
  <div class="footer-top">
    <div class="footer-brand">${MN.lockup()}
      <p>A community site for the free 2026 Cyber Security Bootcamp, run by the Maxim Nyansa Foundation — creating career perspectives for young people with information technology since 2016.</p></div>
    <div><h3>Bootcamp</h3><ul><li><a href="${R}bootcamp.html">Overview</a></li><li><a href="${R}journey.html">Journey</a></li><li><a href="${R}classes.html">Class archive</a></li><li><a href="${R}projects.html">Projects & labs</a></li><li><a href="${R}trainees.html">Trainees</a></li></ul></div>
    <div><h3>Community</h3><ul><li><a href="${R}events.html">Events</a></li><li><a href="${R}gallery.html">Gallery</a></li><li><a href="${R}anniversary.html">10 Years of Impact</a></li><li><a href="${R}about.html">About the Foundation</a></li><li><a href="https://maximnyansa.com/" target="_blank" rel="noopener">maximnyansa.com ${MN.icon('arrow-up-right','i--sm')}</a></li></ul></div>
    <div><h3>Visit</h3><ul><li>Coral Avenue – Tantra Hills<br>Accra, Ghana</li><li><a href="mailto:mninfo@maximnyansa.com">mninfo@maximnyansa.com</a></li><li><a href="${R}contact.html">Contact page</a></li></ul>
      <div class="socials" style="margin-top:20px">
        <a href="https://www.linkedin.com/company/maxim-nyansa-foundation" target="_blank" rel="noopener" aria-label="LinkedIn">${MN.icon('linkedin','i--sm')}</a>
        <a href="https://facebook.com/maximnyansa" target="_blank" rel="noopener" aria-label="Facebook">${MN.icon('facebook','i--sm')}</a>
        <a href="https://instagram.com/maxim_nyansa" target="_blank" rel="noopener" aria-label="Instagram">${MN.icon('instagram','i--sm')}</a>
        <a href="https://twitter.com/MaximNyansa" target="_blank" rel="noopener" aria-label="X (Twitter)">${MN.icon('twitter','i--sm')}</a>
        <a href="https://www.youtube.com/channel/UCTYJus0hr3iI9wvxqzHle-g" target="_blank" rel="noopener" aria-label="YouTube">${MN.icon('youtube','i--sm')}</a></div></div>
  </div>
  <div class="footer-big" aria-hidden="true">Secure the future.</div>
  <div class="footer-bottom"><span>© 2026 Maxim Nyansa Foundation · Design prototype — sample data, not a live site</span>
    <span><a href="${R}index-of-screens.html">All screens</a> · <a href="${R}design-system.html">Design system</a> · <a href="${R}motion-spec.html">Motion spec</a> · <a href="${R}admin/login.html">Admin</a></span></div></div>`;
}
if (!body.classList.contains('admin') && !body.dataset.noFlag) {
  const f=document.createElement('a'); f.className='proto-flag'; f.href=R+'index-of-screens.html'; f.textContent='Prototype · all screens'; f.setAttribute('aria-label','Prototype: index of all screens'); body.append(f);
}

/* ---------- Admin shell ---------- */
const sb = document.getElementById('admin-sidebar');
if (sb) {
  const cur = body.dataset.admin || '';
  const G = [
    ['Workspace',[['overview','Overview','grid','index.html']]],
    ['Content',[['classes','Classes','book','classes.html'],['trainees','Trainees','users','trainees.html'],['projects','Projects','terminal','projects.html'],['events','Events','calendar','events.html'],['media','Media library','image','media.html']]],
    ['Pages',[['content','Content editor','file','content.html'],['timeline','Timeline','commit','timeline.html'],['about','About & 10 Years','award','about.html']]],
    ['System',[['settings','Settings','settings','settings.html'],['states','UI states','layers','states.html']]]
  ];
  sb.className = 'admin-sidebar';
  sb.innerHTML = `<div class="sb-head"><a class="sb-brand" href="index.html"><span class="wordmark__mark">${MN.markSVG}</span><span class="sb-text"><b>Bootcamp CMS</b><small>2026 cohort</small></span></a>
    <button class="icon-btn sb-collapse" aria-label="Collapse sidebar" aria-expanded="true">${MN.icon('sidebar')}</button></div>
    <nav class="sb-nav" aria-label="Admin">${G.map(([g,items])=>`<div class="sb-group"><span class="sb-label">${g}</span>${items.map(([id,l,ic,h])=>`<a href="${h}" class="sb-link"${id===cur?' aria-current="page"':''} data-tip="${l}">${MN.icon(ic)}<span class="sb-text">${l}</span></a>`).join('')}</div>`).join('')}</nav>
    <div class="sb-foot"><div class="sb-logo sb-text">${MN.officialLogo(130)}</div><a class="sb-link" href="../index.html" data-tip="View site">${MN.icon('external')}<span class="sb-text">View public site</span></a></div>`;
  const shell = document.querySelector('.admin-shell');
  const col = sb.querySelector('.sb-collapse');
  if (localStorage.getItem('mn-sb')==='1' && innerWidth>960) shell.classList.add('is-collapsed');
  const syncCol = () => { const c=shell.classList.contains('is-collapsed'); col.setAttribute('aria-expanded', !c); col.setAttribute('aria-label', c?'Expand sidebar':'Collapse sidebar'); };
  syncCol();
  col.addEventListener('click', () => {
    if (innerWidth<=960) { shell.classList.remove('drawer-open'); return; }
    shell.classList.toggle('is-collapsed'); try{localStorage.setItem('mn-sb', shell.classList.contains('is-collapsed')?'1':'0')}catch(e){} syncCol();
  });
  const scrim = document.createElement('div'); scrim.className='sb-scrim'; shell.append(scrim);
  scrim.addEventListener('click', () => shell.classList.remove('drawer-open'));
  document.addEventListener('keydown', e => { if (e.key==='Escape') shell.classList.remove('drawer-open'); });
}
const tb = document.getElementById('admin-topbar');
if (tb) {
  const crumbs = (body.dataset.crumbs||'Overview').split('|');
  tb.className='admin-topbar';
  tb.innerHTML = `<button class="icon-btn tb-menu" aria-label="Open navigation">${MN.icon('menu')}</button>
    <ol class="crumbs" aria-label="Breadcrumb"><li><a href="index.html">Admin</a></li>${crumbs.map((c,i)=>{const [l,h]=c.split('>');return `<li>${h&&i<crumbs.length-1?`<a href="${h}">${l}</a>`:`<span${i===crumbs.length-1?' aria-current="page"':''}>${l}</span>`}</li>`}).join('')}</ol>
    <div class="tb-search input-icon">${MN.icon('search','i--sm')}<input class="input" type="search" placeholder="Search classes, trainees, events…" aria-label="Search admin"><kbd>/</kbd></div>
    <span class="badge badge--warning tb-proto">Prototype — sample data</span>
    <div class="tb-pop"><button class="icon-btn tb-bell" aria-label="Notifications" aria-expanded="false">${MN.icon('bell')}<span class="tb-dot"></span></button>
      <div class="popover" role="dialog" aria-label="Notifications"><div class="pop-head"><b>Notifications</b><button class="link" data-markread>Mark all read</button></div>
      <ul class="notif-list"><li class="is-unread">${MN.icon('check-circle')}<div><b>Sample: class published</b><span>Week 3 — sample lesson is live</span></div></li>
      <li class="is-unread">${MN.icon('image')}<div><b>Sample: 4 photos uploaded</b><span>Awaiting alt text</span></div></li>
      <li>${MN.icon('alert')}<div><b>Sample: consent pending</b><span>Photo release forms not yet recorded</span></div></li></ul></div></div>
    <div class="tb-pop"><button class="tb-user" aria-label="Account menu" aria-expanded="false"><span class="avatar avatar--sm" style="--h:95">AD</span><span class="tb-user-name">Sample Admin</span>${MN.icon('chevron-down','i--sm')}</button>
      <div class="popover popover--menu" role="menu"><a role="menuitem" href="settings.html">${MN.icon('settings','i--sm')} Settings</a><a role="menuitem" href="../index.html">${MN.icon('external','i--sm')} View site</a><a role="menuitem" href="login.html">${MN.icon('log-out','i--sm')} Sign out</a></div></div>`;
  const tbm=tb.querySelector('.tb-menu'); tbm.setAttribute('aria-expanded','false'); tbm.setAttribute('aria-controls','admin-sidebar');
  tbm.addEventListener('click', () => { document.querySelector('.admin-shell').classList.add('drawer-open'); tbm.setAttribute('aria-expanded','true');
    setTimeout(()=>{ const l=document.querySelector('#admin-sidebar .sb-link'); l&&l.focus(); },30); });
  new MutationObserver(()=>{ const open=document.querySelector('.admin-shell').classList.contains('drawer-open'); if(tbm.getAttribute('aria-expanded')==='true' && !open){ tbm.setAttribute('aria-expanded','false'); if(innerWidth<=960) tbm.focus(); } }).observe(document.querySelector('.admin-shell'),{attributes:true,attributeFilter:['class']});
  tb.querySelectorAll('.tb-pop').forEach(p => {
    const b=p.querySelector('button');
    b.addEventListener('click', e => { e.stopPropagation(); const o=!p.classList.contains('is-open'); document.querySelectorAll('.tb-pop.is-open').forEach(x=>{x.classList.remove('is-open');x.querySelector('button').setAttribute('aria-expanded','false')}); p.classList.toggle('is-open',o); b.setAttribute('aria-expanded',o); });
  });
  document.addEventListener('click', e => { if (!e.target.closest('.popover')) document.querySelectorAll('.tb-pop.is-open').forEach(x=>{x.classList.remove('is-open');x.querySelector('button').setAttribute('aria-expanded','false')}); });
  tb.querySelector('[data-markread]').addEventListener('click', () => { tb.querySelectorAll('.is-unread').forEach(x=>x.classList.remove('is-unread')); tb.querySelector('.tb-dot').remove(); MN.toast('All caught up','Notifications marked as read'); });
  const s = tb.querySelector('.tb-search input');
  document.addEventListener('keydown', e => { if (e.key==='/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); s.focus(); } });
  s.addEventListener('keydown', e => { if (e.key==='Enter') MN.toast('Search is simulated', `No live index in the prototype — you searched “${s.value||'…'}”`); });
}

/* ---------- Toasts ---------- */
let stack;
MN.toast = (title, msg, type) => {
  if (!stack) { stack=document.createElement('div'); stack.className='toast-stack'; stack.setAttribute('role','status'); stack.setAttribute('aria-live','polite'); body.append(stack); }
  const t=document.createElement('div'); t.className='toast'+(type==='error'?' toast--error':'');
  t.innerHTML=`${MN.icon(type==='error'?'alert':'check-circle')}<div><b>${title}</b>${msg||''}</div><button aria-label="Dismiss">${MN.icon('x','i--sm')}</button>`;
  stack.append(t);
  const kill=()=>{ t.classList.add('is-leaving'); setTimeout(()=>t.remove(), MN.reduced()?0:300); };
  t.querySelector('button').onclick=kill; setTimeout(kill, 4200);
};

/* ---------- Confirm modal ---------- */
MN.confirm = ({title='Delete item?', text='This cannot be undone.', ok='Delete', danger=true}={}) => new Promise(res => {
  const prev=document.activeElement;
  const m=document.createElement('div'); m.className='modal-backdrop';
  m.innerHTML=`<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mt" aria-describedby="md"><div class="modal__icon">${MN.icon(danger?'trash':'info')}</div><h2 id="mt">${title}</h2><p id="md" class="muted">${text}</p>
    <div class="modal__actions"><button class="btn btn--ghost btn--sm" data-x>Cancel</button><button class="btn btn--sm ${danger?'btn--danger':''}" data-ok>${ok}</button></div></div>`;
  body.append(m); requestAnimationFrame(()=>m.classList.add('is-open'));
  const close=v=>{ m.classList.remove('is-open'); document.removeEventListener('keydown',key); setTimeout(()=>m.remove(),300); prev&&prev.focus(); res(v); };
  const key=e=>{ if(e.key==='Escape') close(false); if(e.key==='Tab'){ const f=[...m.querySelectorAll('button')]; if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus()} else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus()} } };
  document.addEventListener('keydown',key);
  m.querySelector('[data-x]').onclick=()=>close(false); m.querySelector('[data-ok]').onclick=()=>close(true);
  m.addEventListener('click',e=>{ if(e.target===m) close(false); });
  setTimeout(()=>m.querySelector('[data-x]').focus(),50);
});

/* ---------- Lightbox ---------- */
let lb, lbList=[], lbI=0, lbPrev;
MN.lightbox = (list, i) => {
  lbList=list; lbI=i; lbPrev=document.activeElement;
  if (!lb) {
    lb=document.createElement('div'); lb.className='lightbox'; lb.setAttribute('role','dialog'); lb.setAttribute('aria-modal','true'); lb.setAttribute('aria-label','Photo viewer');
    lb.innerHTML=`<div class="lightbox__top"><span class="lb-count"></span><button class="lightbox__close" aria-label="Close (Esc)">${MN.icon('x')}</button></div>
      <div class="lightbox__stage"><button class="lightbox__nav lightbox__nav--prev" aria-label="Previous photo">${MN.icon('arrow-left')}</button><img alt=""><button class="lightbox__nav lightbox__nav--next" aria-label="Next photo">${MN.icon('arrow-right')}</button></div>
      <div class="lightbox__cap"><span class="lb-cap"></span><span class="tag lb-cat"></span></div>`;
    body.append(lb);
    lb.querySelector('.lightbox__close').onclick=MN.lightboxClose;
    lb.querySelector('.lightbox__nav--prev').onclick=()=>lbGo(-1);
    lb.querySelector('.lightbox__nav--next').onclick=()=>lbGo(1);
    lb.addEventListener('click',e=>{ if(e.target.classList.contains('lightbox__stage')) MN.lightboxClose(); });
    let x0=null; lb.addEventListener('touchstart',e=>x0=e.touches[0].clientX,{passive:true});
    lb.addEventListener('touchend',e=>{ if(x0===null)return; const dx=e.changedTouches[0].clientX-x0; if(Math.abs(dx)>50) lbGo(dx<0?1:-1); x0=null; });
    document.addEventListener('keydown',e=>{ if(!lb.classList.contains('is-open'))return;
      if(e.key==='Escape') MN.lightboxClose(); if(e.key==='ArrowRight') lbGo(1); if(e.key==='ArrowLeft') lbGo(-1);
      if(e.key==='Tab'){ const f=[...lb.querySelectorAll('button')]; const k=f.indexOf(document.activeElement); e.preventDefault(); f[(k+(e.shiftKey?-1:1)+f.length)%f.length].focus(); } });
  }
  lbRender(false); lb.classList.add('is-open'); body.style.overflow='hidden';
  setTimeout(()=>lb.querySelector('.lightbox__close').focus(),60);
};
function lbRender(anim){
  const it=lbList[lbI], img=lb.querySelector('img');
  const set=()=>{ img.src=it.src; img.alt=it.alt; img.width=it.w; img.height=it.h; lb.querySelector('.lb-count').textContent=`${String(lbI+1).padStart(2,'0')} / ${String(lbList.length).padStart(2,'0')}`; lb.querySelector('.lb-cap').textContent=it.cap; lb.querySelector('.lb-cat').textContent=it.cat||''; img.classList.remove('is-swapping'); };
  if(anim && !MN.reduced()){ img.classList.add('is-swapping'); setTimeout(set,180); } else set();
}
function lbGo(d){ lbI=(lbI+d+lbList.length)%lbList.length; lbRender(true); }
MN.lightboxClose = () => { lb.classList.remove('is-open'); body.style.overflow=''; lbPrev&&lbPrev.focus(); };
MN.photoItem = p => ({ src:MN.img(p.f,1600), alt:p.cap, cap:p.cap+' — names withheld', cat:MN.PHOTO_CATS[p.cat], w:p.w, h:p.h });
document.addEventListener('click', e => {
  const t=e.target.closest('[data-lb]'); if(!t) return;
  e.preventDefault();
  const scope=t.closest('[data-lb-scope]')||document;
  const items=[...scope.querySelectorAll('[data-lb]')].filter(x=>x.offsetParent!==null||x===t);
  MN.lightbox(items.map(x=>MN.photoItem(MN.PHOTOS.find(p=>p.f===x.dataset.lb))), items.indexOf(t));
});

/* ---------- Tabs (with sliding ink) ---------- */
MN.initTabs = root => (root||document).querySelectorAll('[role="tablist"]').forEach(tl => {
  if (tl.dataset.ready) return;
  const tabs=[...tl.querySelectorAll('[role="tab"]')]; if(!tabs.length) return; tl.dataset.ready=1;
  let ink=null; if (tl.classList.contains('tabs')) { ink=document.createElement('span'); ink.className='tab-ink'; tl.append(ink); }
  const place=t=>{ if(ink&&t){ ink.style.left=t.offsetLeft+'px'; ink.style.width=t.offsetWidth+'px'; } };
  const sel=(t,focus)=>{ tabs.forEach(x=>{ const on=x===t; x.setAttribute('aria-selected',on); x.tabIndex=on?0:-1; const p=document.getElementById(x.getAttribute('aria-controls')); if(p) p.hidden=!on; }); place(t); if(focus)t.focus(); tl.dispatchEvent(new CustomEvent('tabchange',{detail:t})); };
  tabs.forEach((t,i)=>{ t.addEventListener('click',()=>sel(t)); t.addEventListener('keydown',e=>{ if(e.key==='ArrowRight'){e.preventDefault();sel(tabs[(i+1)%tabs.length],1)} if(e.key==='ArrowLeft'){e.preventDefault();sel(tabs[(i-1+tabs.length)%tabs.length],1)} }); });
  const start=tabs.find(t=>t.getAttribute('aria-selected')==='true')||tabs[0];
  requestAnimationFrame(()=>sel(start)); addEventListener('resize',()=>place(tabs.find(t=>t.getAttribute('aria-selected')==='true')));
  if (document.fonts) document.fonts.ready.then(()=>place(tabs.find(t=>t.getAttribute('aria-selected')==='true')));
});

/* Animate a filtered list: hide non-matching children with a short fade */
MN.filterItems = (items, pred, emptyEl) => {
  let n=0;
  items.forEach(el => { const show=pred(el); if(show) n++;
    if (show) { el.hidden=false; el.classList.remove('is-filtered'); requestAnimationFrame(()=>el.classList.add('is-shown')); }
    else { el.hidden=true; el.classList.remove('is-shown'); } });
  if (emptyEl) emptyEl.hidden = n>0;
  return n;
};

/* Cover art for sample projects (abstract, not photography) */
MN.cover = (kind, label) => `<div class="cover cover--${kind}" aria-hidden="true"><div class="cover__art"></div><span class="cover__label">${label||''}</span></div>`;

/* ---------- Page transitions ---------- */
const veil=document.createElement('div'); veil.className='page-veil'; body.append(veil);
body.classList.add('page-enter');
document.addEventListener('click', e => {
  const a=e.target.closest('a[href]'); if(!a||e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0) return;
  const href=a.getAttribute('href'); if(!href||href.startsWith('#')||href.startsWith('mailto:')||a.target==='_blank'||/^https?:/.test(href)||a.hasAttribute('download')) return;
  if (MN.reduced()) return;
  e.preventDefault(); veil.classList.add('is-leaving'); setTimeout(()=>{ location.href=a.href; }, 380);
});
window.addEventListener('pageshow', e => { if (e.persisted) veil.classList.remove('is-leaving'); });

MN.initTabs();
})();
