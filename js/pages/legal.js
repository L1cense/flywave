import { REG_SECTIONS, TRACKS, GUIDE } from '../data/regs.js';
import { store, esc, toast } from '../store.js';
import { openCopilot } from '../ai.js';

export function mount(view){
  let tab = 'framework', q = '';
  view.innerHTML = `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Section 01</div><h1>Regulations</h1>
      <p>Everything an eVTOL pilot, manufacturer and operator must clear to fly legally in India — laws, DGCA CARs, medical standards, airspace and vertiports — with a personal certification tracker.</p></div>
      <div style="min-width:280px"><input id="regSearch" placeholder="Search rules, e.g. medical validity, FIC, vertiport" /></div>
    </div>
    <div class="disclaimer" style="margin-bottom:22px">Reference summary for study and planning. Rules evolve — always confirm against current DGCA CARs, AIP India, eGCA and NOTAMs. eVTOL-specific DGCA requirements are still being finalised.</div>
    <div class="legal-layout">
      <nav class="side-nav" id="side"></nav>
      <div id="regContent"></div>
    </div>
  </div>`;
  const side = view.querySelector('#side'), content = view.querySelector('#regContent');
  const tabs = [...REG_SECTIONS.map(s=>({id:s.id,title:s.title})), {id:'tracker',title:'Certification tracker'}, {id:'guide',title:'Pilot basic guide'}, {id:'medcalc',title:'Medical calculator'}];

  function renderSide(){
    const checks = store.get('checks', {});
    side.innerHTML = tabs.map(t => {
      let badge = '';
      if (t.id==='tracker'){ const tot = TRACKS.reduce((s,x)=>s+x.items.length,0), d = TRACKS.reduce((s,x)=>s+x.items.filter((_,i)=>checks[x.id+i]).length,0); badge = `<span class="mono dim">${Math.round(d/tot*100)}%</span>`; }
      else { const s = REG_SECTIONS.find(r=>r.id===t.id); if (s) badge = `<span class="mono dim">${s.items.length}</span>`; }
      return `<button data-t="${t.id}" class="${tab===t.id && !q?'on':''}">${esc(t.title)}${badge}</button>`;
    }).join('');
    side.querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.t; q=''; view.querySelector('#regSearch').value=''; render(); });
  }
  function itemHTML(it, open=false){
    return `<details class="reg-item" ${open?'open':''}><summary><span class="t"><b>${esc(it.title)}</b><span>${esc(it.ref)}</span></span>${(it.tags||[]).slice(0,2).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</summary>
      <div class="reg-body">${it.body}<div style="margin-top:12px"><button class="btn btn-ghost btn-sm ask" data-q="Explain ${esc(it.title)} for eVTOL operations in India">Ask copilot</button></div></div></details>`;
  }
  function render(){
    renderSide();
    if (q){
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      const hits = REG_SECTIONS.flatMap(s => s.items.map(i => ({...i, sec:s.title}))).filter(i => { const txt = (i.title+' '+i.ref+' '+i.body+' '+(i.tags||[]).join(' ')).toLowerCase(); return terms.every(t => txt.includes(t)); });
      content.innerHTML = `<div class="eyebrow" style="margin-bottom:14px">${hits.length} result(s) for "${esc(q)}"</div>` + hits.map(h => itemHTML(h, hits.length<4)).join('') + (hits.length? '' : `<div class="card"><p class="muted">No direct match. <button class="btn btn-sm ask" data-q="${esc(q)}">Ask copilot instead</button></p></div>`);
    } else if (tab === 'tracker'){
      const checks = store.get('checks', {});
      content.innerHTML = `<div class="grid g2">${TRACKS.map(t => {
        const d = t.items.filter((_,i)=>checks[t.id+i]).length;
        return `<div class="card corner"><div class="row between"><h3 style="margin:0">${t.title} track</h3><span class="mono small">${d}/${t.items.length}</span></div>
        <div class="bar" style="margin:12px 0 6px"><i style="width:${d/t.items.length*100}%"></i></div>
        ${t.items.map(([a,b],i)=>`<label class="chk ${checks[t.id+i]?'done':''}"><input type="checkbox" data-k="${t.id+i}" ${checks[t.id+i]?'checked':''}/><span class="t"><b>${esc(a)}</b><span>${esc(b)}</span></span></label>`).join('')}</div>`; }).join('')}</div>
        <div class="row gap" style="margin-top:16px"><button class="btn btn-ghost btn-sm" id="aiNext">AI: what should I do next?</button><button class="btn btn-ghost btn-sm" id="resetChk">Reset tracker</button></div>`;
      content.querySelectorAll('input[type=checkbox]').forEach(c => c.onchange = () => { const ch = store.get('checks',{}); ch[c.dataset.k] = c.checked; store.set('checks', ch); render(); });
      content.querySelector('#resetChk').onclick = () => { store.set('checks', {}); render(); toast('Tracker reset'); };
      content.querySelector('#aiNext').onclick = () => openCopilot('What should I do next in my certification journey?', true);
    } else if (tab === 'guide'){
      content.innerHTML = `<div class="card corner" style="margin-bottom:16px"><h3>How an eVTOL flight works</h3><p class="muted" style="line-height:1.6;margin:0">A typical sortie: thrust-borne vertical take-off → transition to wing-borne flight (tilt or lift+cruise types) → cruise at ≥1000 ft over cities → reconversion → vertical landing. Energy, not fuel, is the limiting factor — battery SoC, temperature and reserve drive every decision.</p></div>
      <div class="timeline">${GUIDE.map(g => `<div class="tl"><b>${esc(g.phase)}</b><ul class="list-plain" style="margin-top:8px">${g.steps.map(s=>`<li><span class="dim mono">—</span>${esc(s)}</li>`).join('')}</ul></div>`).join('')}</div>`;
    } else if (tab === 'medcalc'){
      const p = store.get('pilot', {});
      content.innerHTML = `<div class="grid g2"><div class="card corner"><h3>Medical validity calculator</h3>
        <label class="field"><span>Medical class</span><select id="mClass"><option value="1">Class 1</option><option value="2">Class 2</option></select></label>
        <label class="field"><span>Date of birth</span><input type="date" id="mDob" value="${p.dob||''}"/></label>
        <label class="field"><span>Date of last examination</span><input type="date" id="mExam" value="${p.lastExam||''}"/></label>
        <label class="row gap small" style="margin-bottom:14px"><input type="checkbox" id="mSingle" checked/> Single-pilot commercial passenger operations</label>
        <button class="btn btn-solid" id="mCalc">Calculate &amp; save</button></div>
        <div class="card corner" id="mOut"><h3>Result</h3><p class="muted">Enter dates to calculate expiry. Values follow ICAO Annex 1 periods used in CAR Section 7 Series C — confirm on eGCA.</p></div></div>`;
      content.querySelector('#mCalc').onclick = () => {
        const cls = +content.querySelector('#mClass').value, dob = new Date(content.querySelector('#mDob').value), ex = new Date(content.querySelector('#mExam').value), single = content.querySelector('#mSingle').checked;
        if (isNaN(dob) || isNaN(ex)) return toast('Enter both dates');
        const age = (ex - dob)/(365.25*864e5);
        let months = cls===1 ? (age>=40 && single ? 6 : (age>=60 ? 6 : 12)) : (age<40 ? 60 : age<50 ? 24 : 12);
        const exp = new Date(ex); exp.setMonth(exp.getMonth()+months);
        const days = Math.round((exp - new Date())/864e5);
        store.set('pilot', { ...store.get('pilot',{}), dob: content.querySelector('#mDob').value, lastExam: content.querySelector('#mExam').value, medicalExpiry: exp.toISOString().slice(0,10), medicalClass: cls });
        content.querySelector('#mOut').innerHTML = `<h3>Result</h3><div class="stat"><div class="v">${exp.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div><div class="l">Class ${cls} valid until</div></div>
          <p style="margin-top:14px"><span class="tag ${days<0?'bad':days<45?'warn':'ok'}">${days<0?'Expired '+(-days)+' days ago':days+' days remaining'}</span></p>
          <p class="muted small" style="line-height:1.6">Age at exam: ${age.toFixed(1)} yrs · validity ${months} months. Book renewal through an empanelled examiner on eGCA at least 30 days before expiry. Saved to your pilot profile.</p>`;
        toast('Medical saved to profile');
      };
    } else {
      const s = REG_SECTIONS.find(r=>r.id===tab);
      content.innerHTML = `<div style="margin-bottom:16px"><h2>${esc(s.title)}</h2><p class="muted" style="margin:6px 0 0">${esc(s.summary)}</p></div>` + s.items.map((it,i)=>itemHTML(it, i===0)).join('');
    }
    content.querySelectorAll('.ask').forEach(b => b.onclick = (e) => { e.preventDefault(); openCopilot(b.dataset.q, true); });
  }
  let deb; view.querySelector('#regSearch').oninput = e => { clearTimeout(deb); deb = setTimeout(()=>{ q = e.target.value.trim(); render(); }, 200); };
  render();
  return {};
}
