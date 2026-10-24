/* Admin helpers: data tables, form validation, dirty state, drag lists.
   Everything is simulated in the browser — nothing is stored or sent. */
(function(){
const A = MN.A = {};
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
A.esc = esc;
A.status = s => ({published:['success','Published'],done:['success','Published'],draft:['', 'Draft'],now:['lime','Live this week'],upcoming:['info','Scheduled'],review:['warning','In review'],scheduled:['info','Scheduled'],tbc:['danger','Needs confirmation'],verified:['success','Verified'],sample:['warning','Sample'],consent:['warning','Consent pending'],active:['success','Active']}[s]||['',s]);
A.badge = s => { const [t,l]=A.status(s); return `<span class="badge${t?' badge--'+t:''}"><span class="dot"></span>${l}</span>`; };
A.ago = i => ['2 min ago','18 min ago','1 h ago','3 h ago','Yesterday','2 days ago','3 days ago','Last week'][i%8];

/* ---------- Data table ----------
   opts: el (table), data, row(d), text(d), search, filters:[{el,get}], count, bulk, noun, primary */
A.table = opts => {
  const {el, row, noun='items'} = opts; let data = opts.data.slice(); const tbody = el.tBodies[0];
  let sortKey=null, dir=1; const sel=new Set();
  const cols = el.tHead.rows[0].cells.length;
  const visible = () => {
    const q=(opts.search&&opts.search.value||'').trim().toLowerCase();
    let out=data.filter(d=>(!q||opts.text(d).toLowerCase().includes(q)) && (opts.filters||[]).every(f=>!f.el.value||String(f.get(d))===f.el.value));
    if (sortKey) out.sort((a,b)=>{const x=a[sortKey],y=b[sortKey];return (x>y?1:x<y?-1:0)*dir});
    return out;
  };
  const render = () => {
    const v=visible();
    tbody.innerHTML = v.length ? v.map(d=>row(d)).join('') : `<tr class="empty-row"><td colspan="${cols}"><div class="empty" style="padding:24px"><div class="empty__art">${MN.icon('search')}</div><h3>No ${noun} match</h3><p>Try a different search or clear the filters.</p><button class="btn btn--ghost btn--sm" type="button" data-clear style="margin-top:12px">Clear filters</button></div></td></tr>`;
    tbody.querySelectorAll('tr[data-id]').forEach(tr=>{ const id=tr.dataset.id; const c=tr.querySelector('.row-chk'); if(c){c.checked=sel.has(id); tr.classList.toggle('is-selected',c.checked);} });
    if (opts.count) opts.count.textContent = `${v.length} of ${data.length} ${noun}`;
    syncBulk();
  };
  const all = el.querySelector('.all-chk');
  const syncBulk = () => {
    if (opts.bulk){ opts.bulk.classList.toggle('is-on', sel.size>0); const n=opts.bulk.querySelector('[data-n]'); if(n) n.textContent=sel.size; }
    if (all){ const ids=[...tbody.querySelectorAll('tr[data-id]')].map(t=>t.dataset.id); all.checked=ids.length>0&&ids.every(i=>sel.has(i)); all.indeterminate=!all.checked&&ids.some(i=>sel.has(i)); }
  };
  tbody.addEventListener('change', e => { const c=e.target.closest('.row-chk'); if(!c) return; const id=c.closest('tr').dataset.id; c.checked?sel.add(id):sel.delete(id); c.closest('tr').classList.toggle('is-selected',c.checked); syncBulk(); });
  if (all) all.addEventListener('change', () => { tbody.querySelectorAll('tr[data-id]').forEach(t=>{ all.checked?sel.add(t.dataset.id):sel.delete(t.dataset.id); }); render(); });
  const remove = (ids, label) => {
    ids.forEach(id=>{ const tr=tbody.querySelector(`tr[data-id="${id}"]`); if(tr) tr.classList.add('is-removing'); });
    setTimeout(()=>{ const removed=data.filter(d=>ids.includes(String(d.id))); data=data.filter(d=>!ids.includes(String(d.id))); ids.forEach(i=>sel.delete(i)); render();
      MN.toast('Deleted '+label, 'Prototype only — refresh to restore.'); opts.onChange&&opts.onChange(data); }, 380);
  };
  tbody.addEventListener('click', e => {
    if (e.target.closest('[data-clear]')) { if(opts.search) opts.search.value=''; (opts.filters||[]).forEach(f=>f.el.value=''); render(); return; }
    const b=e.target.closest('[data-del]'); if(!b) return;
    const id=b.closest('tr').dataset.id; const d=data.find(x=>String(x.id)===id);
    MN.confirm({title:`Delete “${opts.primary?opts.primary(d):id}”?`, text:'This removes it from the prototype view. Nothing is stored, so a refresh brings it back.'}).then(ok=>ok&&remove([id],'1 '+noun.replace(/s$/,'')));
  });
  if (opts.bulk) opts.bulk.addEventListener('click', e => {
    if (e.target.closest('[data-bulk-del]')) MN.confirm({title:`Delete ${sel.size} ${noun}?`, text:'Selected items will be removed from this prototype view.'}).then(ok=>ok&&remove([...sel],sel.size+' '+noun));
    if (e.target.closest('[data-bulk-pub]')) { MN.toast(`${sel.size} ${noun} marked as published`,'Simulated — no changes saved'); sel.clear(); render(); }
    if (e.target.closest('[data-bulk-clear]')) { sel.clear(); render(); }
  });
  el.tHead.querySelectorAll('th[data-sort]').forEach(th=>{ th.tabIndex=0; th.setAttribute('aria-sort','none');
    const go=()=>{ const k=th.dataset.sort; dir = sortKey===k ? -dir : 1; sortKey=k; el.tHead.querySelectorAll('th[data-sort]').forEach(x=>x.setAttribute('aria-sort','none')); th.setAttribute('aria-sort',dir>0?'ascending':'descending'); render(); };
    th.addEventListener('click',go); th.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}}); });
  if (opts.search) opts.search.addEventListener('input', render);
  (opts.filters||[]).forEach(f=>f.el.addEventListener('change', render));
  render();
  return {render, get data(){return data}};
};

/* ---------- Forms ---------- */
A.form = (form, {onSave, savedMsg='Saved'}={}) => {
  const summary = form.querySelector('.error-summary');
  const bar = document.querySelector('.savebar');
  const setDirty = d => { if(!bar) return; bar.classList.toggle('is-dirty', d); const s=bar.querySelector('.status'); if(s) s.textContent = d ? 'Unsaved changes' : 'All changes saved · prototype'; };
  // counters
  form.querySelectorAll('[maxlength]').forEach(inp => { const c=document.createElement('div'); c.className='counter'; c.setAttribute('aria-live','polite'); inp.after(c);
    const up=()=>{ c.textContent=`${inp.value.length} / ${inp.maxLength}`; c.classList.toggle('is-over', inp.value.length>=inp.maxLength); }; inp.addEventListener('input',up); up(); });
  // slug
  form.querySelectorAll('[data-slug-from]').forEach(sl => { const src=form.querySelector(sl.dataset.slugFrom); let touched=false; sl.addEventListener('input',()=>touched=true);
    src.addEventListener('input',()=>{ if(!touched) sl.value=src.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }); });
  const check = f => {
    const inp=f.querySelector('input,select,textarea'); if(!inp) return null; const v=(inp.value||'').trim(); let msg='';
    if (inp.required && !v) msg = inp.dataset.req || 'This field is required.';
    else if (v && inp.type==='email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) msg='Enter a valid email address, like name@example.com.';
    else if (v && inp.type==='url' && !/^https?:\/\/\S+\.\S+/.test(v)) msg='Enter a full link starting with https://';
    else if (v && inp.dataset.min && v.length < +inp.dataset.min) msg=`Use at least ${inp.dataset.min} characters.`;
    f.classList.toggle('has-error', !!msg); f.classList.toggle('is-valid', !msg && !!v && inp.required);
    inp.setAttribute('aria-invalid', !!msg);
    let em=f.querySelector('.error-msg'); if(!em){ em=document.createElement('div'); em.className='error-msg'; em.id=(inp.id||Math.random().toString(36).slice(2))+'-err'; f.append(em); }
    em.innerHTML = msg ? MN.icon('alert','i--sm')+msg : ''; if (msg) inp.setAttribute('aria-describedby', em.id); 
    return msg ? {inp, msg, label:(f.querySelector('label')||{}).textContent||inp.name} : null;
  };
  form.addEventListener('input', e => { setDirty(true); const f=e.target.closest('.field'); if (f && f.classList.contains('has-error')) check(f); });
  form.addEventListener('focusout', e => { const f=e.target.closest('.field'); if (f && e.target.value) check(f); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const errs=[...form.querySelectorAll('.field')].map(check).filter(Boolean);
    if (summary) { summary.classList.toggle('is-on', errs.length>0);
      summary.innerHTML = errs.length ? `<h2>${MN.icon('alert','i--sm')} ${errs.length} ${errs.length>1?'fields need':'field needs'} attention</h2><ul>${errs.map(x=>`<li><a href="#${x.inp.id}">${esc(x.label.replace('*','').trim())}: ${esc(x.msg)}</a></li>`).join('')}</ul>` : '';
      if (errs.length) { summary.setAttribute('tabindex','-1'); summary.focus(); summary.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}); } }
    if (errs.length) { MN.toast('Check the highlighted fields', `${errs.length} problem${errs.length>1?'s':''} found`, 'error'); return; }
    const btns=[...document.querySelectorAll(`[form="${form.id}"][type=submit], #${form.id} [type=submit]`)];
    const btn=e.submitter||btns[0]; if(btn){ btn.classList.add('is-loading'); btn.disabled=true; }
    setTimeout(()=>{ if(btn){btn.classList.remove('is-loading'); btn.disabled=false;} setDirty(false); MN.toast(savedMsg, 'Prototype — nothing was stored'); onSave&&onSave(); }, 900);
  });
  setDirty(false);
  window.addEventListener('beforeunload', e => { if (bar && bar.classList.contains('is-dirty')) { e.preventDefault(); e.returnValue=''; } });
  return {check};
};

/* Local image preview (never uploaded) */
A.imagePicker = (input, img) => input.addEventListener('change', () => { const f=input.files[0]; if(!f) return; img.src=URL.createObjectURL(f); MN.toast('Image previewed locally','Not uploaded — prototype only'); input.dispatchEvent(new Event('input',{bubbles:true})); });

/* Tag input */
A.tags = (wrap, initial=[]) => {
  const input=wrap.querySelector('input'); let tags=initial.slice();
  const draw=()=>{ wrap.querySelectorAll('.tag').forEach(t=>t.remove()); tags.forEach((t,i)=>{ const s=document.createElement('span'); s.className='tag'; s.innerHTML=`${esc(t)}<button type="button" aria-label="Remove ${esc(t)}">×</button>`; s.querySelector('button').onclick=()=>{tags.splice(i,1);draw();input.dispatchEvent(new Event('input',{bubbles:true}));}; wrap.insertBefore(s,input); }); };
  input.addEventListener('keydown', e=>{ if((e.key==='Enter'||e.key===',')&&input.value.trim()){e.preventDefault(); tags.push(input.value.trim()); input.value=''; draw();} else if(e.key==='Backspace'&&!input.value&&tags.length){tags.pop();draw();} });
  draw(); return {get:()=>tags};
};

/* Segmented control */
A.seg = (el, cb) => el.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ el.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); cb&&cb(b.dataset.v,b); }));

/* Drag-and-drop list with keyboard fallback (Alt+↑/↓ or the move buttons) */
A.dragList = (list, onChange) => {
  let dragEl=null;
  const items = () => [...list.children];
  list.addEventListener('dragstart', e => { dragEl=e.target.closest('.drag-item'); if(!dragEl) return; dragEl.classList.add('is-dragging'); e.dataTransfer.effectAllowed='move'; try{e.dataTransfer.setData('text/plain','');}catch(_){} });
  list.addEventListener('dragend', () => { if(dragEl) dragEl.classList.remove('is-dragging'); items().forEach(i=>i.classList.remove('drag-over')); dragEl=null; onChange&&onChange(); });
  list.addEventListener('dragover', e => { e.preventDefault(); const over=e.target.closest('.drag-item'); if(!over||over===dragEl) return; items().forEach(i=>i.classList.toggle('drag-over',i===over)); const r=over.getBoundingClientRect(); list.insertBefore(dragEl, e.clientY < r.top+r.height/2 ? over : over.nextSibling); });
  const move = (li, d) => { const sib = d<0 ? li.previousElementSibling : li.nextElementSibling; if(!sib) return; d<0 ? list.insertBefore(li, sib) : list.insertBefore(sib, li); li.querySelector('.drag-handle').focus(); onChange&&onChange(); const n=items().indexOf(li)+1; MN.toast('Moved', `Now position ${n} of ${items().length}`); };
  list.addEventListener('keydown', e => { const li=e.target.closest('.drag-item'); if(!li||!e.target.classList.contains('drag-handle')) return; if(e.key==='ArrowUp'){e.preventDefault();move(li,-1);} if(e.key==='ArrowDown'){e.preventDefault();move(li,1);} });
  list.addEventListener('click', e => { const b=e.target.closest('[data-move]'); if(b) move(b.closest('.drag-item'), +b.dataset.move); });
};
})();
