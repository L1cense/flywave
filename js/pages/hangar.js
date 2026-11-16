import { getFleet, deleteCustom, derive, CONFIG_LABEL } from '../data/aircraft.js';
import { store, esc, fmt, toast } from '../store.js';

export function mount(view){
  function render(){
    const fleet = getFleet(), log = store.get('logbook', []), p = store.get('pilot', {});
    const tot = log.filter(l=>l.type==='plan');
    view.innerHTML = `<div class="page">
      <div class="page-head"><div><div class="eyebrow">Fleet · Pilot · Records</div><h1>Hangar &amp; logbook</h1><p>Compare aircraft, keep your pilot profile current and review every saved plan and simulation.</p></div>
      <div class="row gap"><button class="btn btn-ghost btn-sm" id="exp">Export data</button><label class="btn btn-ghost btn-sm">Import<input type="file" id="imp" accept=".json" hidden/></label></div></div>
      <div class="grid g3" style="margin-bottom:16px">
        <div class="card corner"><h3>Pilot profile</h3>
          <label class="field"><span>Name</span><input id="pfName" value="${esc(p.name||'')}"/></label>
          <label class="field"><span>Licence</span><select id="pfLic">${['Student','CPL(A)','CPL(H)','ATPL','Remote Pilot Certificate'].map(x=>`<option ${p.licence===x?'selected':''}>${x}</option>`).join('')}</select></label>
          <label class="field"><span>Medical valid until</span><input type="date" id="pfMed" value="${p.medicalExpiry||''}"/></label>
          <label class="field"><span>Landings in last 90 days</span><input type="number" id="pfLdg" value="${p.landings90??0}" min="0"/></label>
          <button class="btn btn-sm" id="pfSave">Save profile</button>
          <div style="margin-top:12px" class="small">${(p.landings90??0) >= 3 ? '<span class="tag ok">Passenger-current</span>' : '<span class="tag warn">Not current — need 3 landings in 90 days</span>'}</div></div>
        <div class="card corner stat"><h3>Totals</h3><div class="v">${tot.length}</div><div class="l">Plans saved</div><div class="v" style="margin-top:12px">${fmt(tot.reduce((s,l)=>s+(l.km||0),0),0)}<small>km</small></div><div class="l">Planned distance</div><div class="v" style="margin-top:12px">${log.filter(l=>l.type==='sim').length}</div><div class="l">Simulations</div></div>
        <div class="card corner"><h3>Logbook</h3><div style="max-height:330px;overflow-y:auto"><table><tr><th>Date</th><th>Entry</th><th class="num">Result</th></tr>${log.map(l=>`<tr><td class="mono small">${new Date(l.date).toLocaleDateString('en-IN')}</td><td><span class="tag ${l.type==='sim'?'info':''}">${l.type}</span> ${esc(l.title)}</td><td class="num">${l.type==='plan'? `<span class="tag ${l.verdict==='go'?'ok':l.verdict==='caution'?'warn':'bad'}">${l.verdict}</span>` : l.score}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Empty</td></tr>'}</table></div>${log.length?'<button class="btn btn-ghost btn-sm" id="clr" style="margin-top:10px">Clear logbook</button>':''}</div>
      </div>
      <div class="card"><h3>Fleet comparison</h3><div style="overflow-x:auto"><table><tr><th>Aircraft</th><th>Origin</th><th>Config</th><th class="num">Seats</th><th class="num">MTOW kg</th><th class="num">Battery kWh</th><th class="num">Cruise km/h</th><th class="num">Range km</th><th class="num">Disk loading kg/m²</th><th class="num">Hover kW</th><th class="num">Wh/km</th><th></th></tr>
      ${fleet.map(a=>{ const D = derive(a); return `<tr><td><b>${esc(a.name)}</b><div class="dim small">${esc(a.maker)}</div></td><td>${esc(a.origin)}</td><td class="small">${CONFIG_LABEL[a.config]}</td><td class="num">${a.seats}</td><td class="num">${fmt(a.mtow)}</td><td class="num">${a.batteryKWh}</td><td class="num">${a.cruiseKmh}</td><td class="num">${a.rangeKm}</td><td class="num">${fmt(D.diskLoading)}</td><td class="num">${fmt(D.hoverKW)}</td><td class="num">${fmt(D.whPerKm)}</td><td class="num"><a class="btn btn-ghost btn-sm" href="#/sim?ac=${a.id}">Sim</a> ${a.maker==='Custom'?`<button class="btn btn-ghost btn-sm" data-del="${a.id}">✕</button>`:''}</td></tr>`; }).join('')}</table></div>
      <p class="small dim">Preset figures are rounded public estimates for study purposes. Hover power is derived from momentum theory (FM 0.7).</p></div></div>`;
    const $ = s => view.querySelector(s);
    $('#pfSave').onclick = () => { store.set('pilot', { ...store.get('pilot',{}), name:$('#pfName').value, licence:$('#pfLic').value, medicalExpiry:$('#pfMed').value, landings90:+$('#pfLdg').value }); toast('Profile saved'); render(); };
    $('#clr') && ($('#clr').onclick = () => { if (confirm('Clear logbook?')){ store.set('logbook', []); render(); } });
    view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { deleteCustom(b.dataset.del); render(); });
    $('#exp').onclick = () => { const d = {}; Object.keys(localStorage).filter(k=>k.startsWith('fw.')).forEach(k => d[k] = localStorage.getItem(k)); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)],{type:'application/json'})); a.download = 'flywave-data.json'; a.click(); };
    $('#imp').onchange = async e => { const d = JSON.parse(await e.target.files[0].text()); Object.entries(d).forEach(([k,v]) => k.startsWith('fw.') && localStorage.setItem(k, v)); toast('Data imported'); render(); };
  }
  render(); return {};
}
