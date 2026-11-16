import * as L from '../../vendor/leaflet/dist/leaflet-src.esm.js';
import { PLACES, ZONES } from '../data/geo.js';
import { getFleet, derive } from '../data/aircraft.js';
import { computePlan, geocode, WMO } from '../planEngine.js';
import { store, session, toast, fmt, esc, addLog, lineChart } from '../store.js';
import { openCopilot } from '../ai.js';

const ZC = { P:'#ff5c5c', R:'#ffb547', CTR:'#5ad1ff' };

export function mount(view, params){
  const fleet = getFleet();
  const now = new Date(Date.now()+60*60e3); now.setMinutes(0,0,0);
  const local = new Date(now.getTime() - now.getTimezoneOffset()*60e3).toISOString().slice(0,16);
  view.innerHTML = `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Section 02</div><h1>Flight planner</h1>
      <p>Enter point A and point B. flyWave builds a DGCA-aware route around restricted airspace, pulls live weather and terrain, budgets battery energy with reserves, and briefs you with an AI go/no-go.</p></div>
      <div class="row gap"><span class="tag" style="border-color:${ZC.P};color:${ZC.P}">Prohibited</span><span class="tag" style="border-color:${ZC.R};color:${ZC.R}">Restricted</span><span class="tag" style="border-color:${ZC.CTR};color:${ZC.CTR}">Controlled</span></div>
    </div>
    <div class="planner">
      <div class="card corner">
        <h3>Route</h3>
        <div class="field"><span>From (A)</span><div class="row gap"><select id="pFrom" class="grow"></select><button class="icon-btn" id="pickFrom" title="Pick on map" style="width:auto;padding:0 8px;font-size:10px;letter-spacing:.12em">MAP</button></div></div>
        <div class="field"><span>To (B)</span><div class="row gap"><select id="pTo" class="grow"></select><button class="icon-btn" id="pickTo" title="Pick on map" style="width:auto;padding:0 8px;font-size:10px;letter-spacing:.12em">MAP</button></div></div>
        <div class="field"><span>Search any place in India</span><div class="row gap"><input id="pSearch" placeholder="e.g. Lonavala, Nashik"/><button class="btn btn-ghost btn-sm" id="pSearchBtn">Find</button></div><div id="pResults" class="small"></div></div>
        <h3 style="margin-top:20px">Aircraft &amp; mission</h3>
        <label class="field"><span>Aircraft</span><select id="pAc">${fleet.map(a=>`<option value="${a.id}">${esc(a.name)} — ${esc(a.maker)}</option>`).join('')}</select></label>
        <div id="acInfo" class="small muted" style="margin:-4px 0 12px"></div>
        <label class="field"><span>Departure (IST)</span><input type="datetime-local" id="pDep" value="${local}"/></label>
        <div class="field"><span>Payload</span><div class="range-row"><input type="range" id="pPay" min="0" max="800" step="10"/><output id="oPay"></output></div></div>
        <div class="grid g2" style="gap:10px">
          <label class="field"><span>Cruise alt (ft)</span><input type="number" id="pAlt" value="1500" step="100"/></label>
          <label class="field"><span>Reserve (min)</span><input type="number" id="pRes" value="20" min="5" max="45"/></label>
          <label class="field"><span>Battery SoH %</span><input type="number" id="pSoh" value="95" min="60" max="100"/></label>
          <label class="field"><span>Start SoC %</span><input type="number" id="pSoc" value="100" min="30" max="100"/></label>
        </div>
        <button class="btn btn-solid" id="pGo" style="width:100%;margin-top:6px">Generate flight plan</button>
        <p class="dim small" style="line-height:1.5;margin:12px 0 0">Reserve default 20 min is an assumption pending DGCA eVTOL energy rules. Airspace shown is indicative — verify with AIP ENR 5.1 and NOTAMs.</p>
      </div>
      <div>
        <div id="map" class="map"></div>
        <div class="row gap small muted" style="margin-top:8px" id="mapHint">Tip: press MAP then click the map to set a custom point.</div>
      </div>
    </div>
    <div id="results" style="margin-top:24px"></div>
  </div>`;
  const $ = s => view.querySelector(s);
  const opts = PLACES.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  $('#pFrom').innerHTML = opts; $('#pTo').innerHTML = opts;
  $('#pFrom').value = params.get('from') || 'bkc'; $('#pTo').value = params.get('to') || 'pune';
  if (params.get('ac')) $('#pAc').value = params.get('ac');
  const custom = {};
  const getPlace = sel => custom[sel.value] || PLACES.find(p=>p.id===sel.value);
  function addCustom(p){ custom[p.id] = p; ['#pFrom','#pTo'].forEach(s => { if (![...$(s).options].some(o=>o.value===p.id)) $(s).insertAdjacentHTML('afterbegin', `<option value="${p.id}">${esc(p.name)}</option>`); }); }

  const acSel = () => fleet.find(a=>a.id===$('#pAc').value);
  function acInfo(){
    const a = acSel(), D = derive(a);
    $('#pPay').max = a.payload*1.3; if (+$('#pPay').value > a.payload*1.3 || !$('#pPay').dataset.touched) $('#pPay').value = Math.round(a.payload*0.8/10)*10;
    $('#oPay').textContent = $('#pPay').value+' kg';
    $('#acInfo').innerHTML = `${a.seats} seats · ${a.rotors} rotors · ${a.batteryKWh} kWh · ${a.cruiseKmh} km/h · ${a.rangeKm} km range · max wind ${a.maxWindKt} kt · ${Math.round(D.whPerKm)} Wh/km`;
    drawRange();
  }
  $('#pAc').onchange = acInfo;
  $('#pPay').oninput = () => { $('#pPay').dataset.touched = 1; $('#oPay').textContent = $('#pPay').value+' kg'; };

  // map
  const map = L.map($('#map'), { zoomControl:true, attributionControl:true }).setView([19.0, 73.2], 8);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap contributors', maxZoom:18, className:'dark-tiles' }).addTo(map);
  ZONES.forEach(z => L.circle([z.lat,z.lon], { radius:z.r*1000, color:ZC[z.type], weight:1, opacity:.8, fillOpacity: z.type==='P'?.18:.06, dashArray: z.type==='CTR'?'4 4':null }).bindPopup(`<b>${esc(z.name)}</b><br>${z.type==='P'?'Prohibited':z.type==='R'?'Restricted / military':'Controlled airspace — ATC clearance'}<br>Radius ≈ ${z.r} km`).addTo(map));
  PLACES.forEach(p => L.circleMarker([p.lat,p.lon], { radius:3, color:'#fff', weight:1, fillOpacity:.6 }).bindTooltip(p.name).addTo(map));
  const layer = L.layerGroup().addTo(map); let rangeLayer = L.layerGroup().addTo(map);
  function drawRange(){
    rangeLayer.clearLayers(); const a = acSel(), f = getPlace($('#pFrom')); if (!f) return;
    const D = derive(a); const r = Math.max(0, (D.usableKWh*0.95 - D.cruiseKW*(20/60)) / D.cruiseKW * a.cruiseKmh);
    L.circle([f.lat,f.lon], { radius:r*1000, color:'#fff', weight:1, opacity:.35, fill:false, dashArray:'2 6' }).bindTooltip(`Approx. still-air range with 20-min reserve: ${Math.round(r)} km`).addTo(rangeLayer);
  }
  function preview(){
    layer.clearLayers(); const a = getPlace($('#pFrom')), b = getPlace($('#pTo'));
    [a,b].forEach(p => L.marker([p.lat,p.lon], { icon:L.divIcon({ className:'', html:'<div class="wp-icon"></div>', iconSize:[14,14], iconAnchor:[7,7] }) }).bindTooltip(p.name, { permanent:true, direction:'top', className:'' }).addTo(layer));
    L.polyline([[a.lat,a.lon],[b.lat,b.lon]], { color:'#fff', weight:1, opacity:.4, dashArray:'4 6' }).addTo(layer);
    map.fitBounds(L.latLngBounds([[a.lat,a.lon],[b.lat,b.lon]]).pad(0.4)); drawRange();
  }
  $('#pFrom').onchange = preview; $('#pTo').onchange = preview;
  let picking = null;
  $('#pickFrom').onclick = () => { picking = '#pFrom'; $('#mapHint').innerHTML = '<span class="c-info">Click the map to set point A</span>'; };
  $('#pickTo').onclick = () => { picking = '#pTo'; $('#mapHint').innerHTML = '<span class="c-info">Click the map to set point B</span>'; };
  map.on('click', e => { if (!picking) return; const p = { id:'pt'+Date.now(), name:`Point ${e.latlng.lat.toFixed(3)}, ${e.latlng.lng.toFixed(3)}`, lat:e.latlng.lat, lon:e.latlng.lng }; addCustom(p); $(picking).value = p.id; picking = null; $('#mapHint').textContent = 'Point set.'; preview(); });
  $('#pSearchBtn').onclick = async () => {
    const q = $('#pSearch').value.trim(); if (!q) return; $('#pResults').innerHTML = '<span class="muted">Searching…</span>';
    const r = await geocode(q);
    $('#pResults').innerHTML = r.length ? r.map((p,i)=>`<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border)"><span>${esc(p.name)}</span><span><button class="btn btn-ghost btn-sm" data-i="${i}" data-w="from">A</button> <button class="btn btn-ghost btn-sm" data-i="${i}" data-w="to">B</button></span></div>`).join('') : '<span class="muted">No results.</span>';
    $('#pResults').querySelectorAll('button').forEach(b => b.onclick = () => { const p = r[b.dataset.i]; addCustom(p); $(b.dataset.w==='from'?'#pFrom':'#pTo').value = p.id; preview(); $('#pResults').innerHTML=''; });
  };
  acInfo(); preview();

  let plan = null;
  async function generate(){
    const from = getPlace($('#pFrom')), to = getPlace($('#pTo'));
    if (from.id === to.id) return toast('Choose two different points');
    $('#pGo').disabled = true; $('#pGo').textContent = 'Computing…';
    $('#results').innerHTML = `<div class="card"><div class="eyebrow">AI planner</div><p class="muted">Building route · checking airspace · fetching weather &amp; terrain · budgeting energy…</p><div class="bar"><i style="width:60%;animation:pulse 1s infinite"></i></div></div>`;
    try {
      plan = await computePlan({ from, to, ac:acSel(), dep:new Date($('#pDep').value), payload:+$('#pPay').value, altFt:+$('#pAlt').value, reserveMin:+$('#pRes').value, soh:+$('#pSoh').value, startSoc:+$('#pSoc').value });
      session.plan = plan; store.set('lastPlan', { title:`${from.name} → ${to.name}`, verdict:plan.verdict, score:plan.score, dist:plan.totalDist, ac:plan.ac.name, brief:plan.brief, findings:plan.findings });
      drawPlan(); renderResults();
    } catch(e){ console.error(e); $('#results').innerHTML = `<div class="card c-bad">Planning failed: ${esc(e.message)}</div>`; }
    $('#pGo').disabled = false; $('#pGo').textContent = 'Generate flight plan';
  }
  $('#pGo').onclick = generate;

  function drawPlan(){
    layer.clearLayers();
    const ll = plan.allPts.map(p=>[p.lat,p.lon]);
    L.polyline(ll, { color:'#5ad1ff', weight:8, opacity:.15 }).addTo(layer);
    L.polyline(ll, { color:'#ffffff', weight:2, opacity:.95 }).addTo(layer);
    plan.allPts.forEach((p,i) => {
      const end = i===0 || i===plan.allPts.length-1, stop = plan.stops.some(s=>s.id===p.id);
      L.marker([p.lat,p.lon], { icon:L.divIcon({ className:'', html:`<div class="wp-icon ${end||stop?'':'mid'}"></div>`, iconSize:[14,14], iconAnchor:[7,7] }) })
        .bindTooltip((stop?'⚡ ':'')+(p.name||`WP${i}`), { permanent:end||stop, direction:'top' }).addTo(layer);
    });
    plan.wx.points.forEach(x => { if (!x.p) return; L.marker([x.p.lat,x.p.lon], { icon:L.divIcon({ className:'', html:`<div style="transform:translate(10px,-6px);font:11px JetBrains Mono;color:#9fe6ff;white-space:nowrap;text-shadow:0 0 4px #000">${String(Math.round(x.w.dir80)).padStart(3,'0')}°/${Math.round(x.w.wind80)}kt</div>`, iconSize:[0,0] }) }).addTo(layer); });
    map.fitBounds(L.latLngBounds(ll).pad(0.25));
  }

  let tab = 'brief';
  function renderResults(){
    const p = plan;
    const vText = { go:'Go', caution:'Caution', nogo:'No-go' }[p.verdict];
    const sevTag = s => `<span class="tag ${s==='nogo'?'bad':s==='caution'?'warn':'info'}">${s==='nogo'?'No-go':s}</span>`;
    $('#results').innerHTML = `
      <div class="verdict ${p.verdict}"><div class="big">${vText}</div><div class="grow"><div class="eyebrow">AI risk score ${p.score}/100</div><div class="muted small">${esc(p.input.from.name)} → ${esc(p.input.to.name)} · ${esc(p.ac.name)} · ETD ${new Date(p.input.dep).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'})} · ETA ${new Date(p.eta).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'})} IST</div></div>
        <div class="row gap wrap no-print"><button class="btn btn-sm" id="aSave">Save to logbook</button><button class="btn btn-sm" id="aSim">Simulate mission</button><button class="btn btn-ghost btn-sm" id="aAsk">Ask copilot</button><button class="btn btn-ghost btn-sm" id="aPrint">Print / PDF</button><button class="btn btn-ghost btn-sm" id="aJson">JSON</button></div></div>
      <div class="grid g4" style="margin:16px 0">
        <div class="card stat"><div class="v">${fmt(p.totalDist,1)}<small>km</small></div><div class="l">Route · ${fmt(p.totalDist/1.852,0)} NM</div></div>
        <div class="card stat"><div class="v">${Math.round(p.flightMin)}<small>min</small></div><div class="l">Block time${p.stops.length?` + ${p.stops.length*25} min charging`:''}</div></div>
        <div class="card stat"><div class="v ${p.arrivalSoc-p.reserveSoc<5?'c-bad':p.arrivalSoc-p.reserveSoc<12?'c-warn':''}">${fmt(Math.max(0,p.arrivalSoc),0)}<small>%</small></div><div class="l">Arrival SoC · reserve ${fmt(p.reserveSoc,0)}%</div></div>
        <div class="card stat"><div class="v">${p.cruiseFt}<small>ft</small></div><div class="l">Cruise · MSA ${p.minSafeFt} ft</div></div>
      </div>
      <div class="tabs no-print">${['brief','navlog','weather','energy','compliance','fpl','checklist'].map(t=>`<button data-t="${t}" class="${tab===t?'on':''}">${{brief:'AI brief',navlog:'Nav log',weather:'Weather',energy:'Energy & terrain',compliance:'Airspace & compliance',fpl:'ICAO flight plan',checklist:'Checklist'}[t]}</button>`).join('')}</div>
      <div id="tabBody"></div>`;
    $('#results').querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; renderResults(); });
    const body = $('#tabBody');
    if (tab==='brief'){
      body.innerHTML = `<div class="grid g2"><div class="card corner"><h3>Copilot briefing</h3><div class="ai-brief">${p.brief.map(l=>`<p style="margin:0 0 10px">${l}</p>`).join('')}</div></div>
        <div class="card corner"><h3>Findings</h3><ul class="list-plain">${p.findings.map(f=>`<li>${sevTag(f.sev)}<span class="dim small" style="min-width:74px">${f.area}</span><span>${esc(f.msg)}</span></li>`).join('') || '<li class="c-ok">No findings — all checks passed.</li>'}</ul>
        ${p.windows.length?`<h3 style="margin-top:18px">AI departure window optimiser · next 36 h</h3><canvas class="chart" id="winChart"></canvas><div class="small muted" id="winBest"></div>`:''}</div></div>`;
      if (p.windows.length){
        const data = p.windows.map((w,i)=>[i, Math.min(120,w.risk)]);
        requestAnimationFrame(()=>lineChart($('#winChart'), [{ data, color:'#5ad1ff', fill:'rgba(90,209,255,.25)' }], { min:0, xlabel:'hours from now → (lower = better)' }));
        const best = p.windows.slice().sort((a,b)=>a.risk-b.risk).slice(0,3);
        $('#winBest').innerHTML = 'Best windows: ' + best.map(b=>`<b class="c-ok">${b.t.toLocaleString('en-IN',{weekday:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})}</b>`).join(' · ') + ` <button class="btn btn-ghost btn-sm" id="useBest" style="margin-left:8px">Use best</button>`;
        $('#useBest').onclick = () => { const t = best[0].t; $('#pDep').value = new Date(t.getTime()-t.getTimezoneOffset()*60e3).toISOString().slice(0,13)+':00'; generate(); };
      }
    } else if (tab==='navlog'){
      body.innerHTML = `<div class="card" style="overflow-x:auto"><table><tr><th>#</th><th>From</th><th>To</th><th class="num">Dist km</th><th class="num">TC °</th><th class="num">WCA °</th><th class="num">TH °</th><th class="num">Wind</th><th class="num">GS kt</th><th class="num">Time min</th><th class="num">kWh</th><th class="num">SoC %</th></tr>
      ${p.legRows.map((l,i)=>`<tr><td class="mono dim">${i+1}</td><td>${esc((l.from||'').slice(0,28))}</td><td>${esc((l.to||'').slice(0,28))}</td><td class="num">${fmt(l.d,1)}</td><td class="num">${String(Math.round(l.tc)).padStart(3,'0')}</td><td class="num">${l.wca>=0?'+':''}${fmt(l.wca,0)}</td><td class="num">${String(Math.round(l.th)).padStart(3,'0')}</td><td class="num">${String(Math.round(l.wx.dir80)).padStart(3,'0')}/${Math.round(l.wx.wind80)}</td><td class="num">${fmt(l.gs,0)}</td><td class="num">${fmt(l.min,1)}</td><td class="num">${fmt(l.kwh,1)}</td><td class="num ${l.soc<p.reserveSoc+5?'c-warn':''}">${l.soc<0?'<span class="c-bad">0 ✕</span>':fmt(l.soc,0)}</td></tr>`).join('')}</table>
      <p class="small dim" style="margin:10px 0 0">True course/heading; wind at 80 m AGL from Open-Meteo. Take-off 60 s and landing 90 s hover at ${fmt(p.hoverKW,0)} kW are included in energy.${p.stops.length?' SoC resets after each charging stop.':''}</p></div>`;
    } else if (tab==='weather'){
      body.innerHTML = `<div class="grid g3">${p.wx.points.map(x => { const w=x.w; return `<div class="card corner"><div class="row between"><h3 style="margin:0">${x.label}</h3><span class="tag ${w.vis<5||w.gust>p.ac.maxWindKt?'bad':w.gust>p.ac.maxWindKt*.75||w.precip>.5?'warn':'ok'}">${WMO[w.code]||'—'}</span></div>
        <table style="margin-top:10px"><tr><td class="muted">Temperature</td><td class="num">${fmt(w.temp,0)} °C</td></tr><tr><td class="muted">Surface wind</td><td class="num">${String(Math.round(w.dir10)).padStart(3,'0')}°/${fmt(w.wind10)} kt</td></tr><tr><td class="muted">Wind 80 m</td><td class="num">${String(Math.round(w.dir80)).padStart(3,'0')}°/${fmt(w.wind80)} kt</td></tr><tr><td class="muted">Gusts</td><td class="num">${fmt(w.gust)} kt</td></tr><tr><td class="muted">Visibility</td><td class="num">${w.vis>=10?'10+':fmt(w.vis,1)} km</td></tr><tr><td class="muted">Low cloud</td><td class="num">${w.cloudLow}%</td></tr><tr><td class="muted">Precip</td><td class="num">${w.precip} mm/h</td></tr></table></div>`; }).join('')}</div>
        <p class="small dim">${p.wx.live?'Live model forecast (Open-Meteo) at the hour of passage.':'Offline placeholder values.'} ${p.wx.sun?`Sunrise ${p.wx.sun.sunrise.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})} · Sunset ${p.wx.sun.sunset.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})} IST.`:''} Not an official MET briefing.</p>`;
    } else if (tab==='energy'){
      const pct = Math.min(100, p.energyRequired/p.energyAvailable*100);
      body.innerHTML = `<div class="grid g2"><div class="card corner"><h3>Energy budget (longest sector)</h3>
        <div class="gauge"><div class="row"><span>Required incl. reserve</span><span>${fmt(p.energyRequired,1)} / ${fmt(p.energyAvailable,1)} kWh</span></div><div class="bar" style="height:8px"><i style="width:${pct}%;background:${pct>100?'var(--red)':pct>90?'var(--amber)':'#fff'}"></i></div></div>
        <table><tr><td class="muted">Hover power (σ=${p.sigmaDep.toFixed(2)})</td><td class="num">${fmt(p.hoverKW,0)} kW</td></tr><tr><td class="muted">Cruise power (mass ratio ${p.massRatio.toFixed(2)})</td><td class="num">${fmt(p.derived.cruiseKW*p.massRatio,0)} kW</td></tr><tr><td class="muted">Reserve energy (${p.input.reserveMin} min)</td><td class="num">${fmt(p.reserveKWh,1)} kWh</td></tr><tr><td class="muted">Usable battery (SoH ${p.input.soh}%)</td><td class="num">${fmt(p.derived.usableKWh*p.input.soh/100,1)} kWh</td></tr><tr><td class="muted">Est. max range at this payload</td><td class="num">${fmt(p.maxRangeKm,0)} km</td></tr><tr><td class="muted">Charging stops</td><td class="num">${p.stops.length? p.stops.map(s=>esc(s.name)).join(', ') : 'None'}</td></tr></table></div>
        <div class="card corner"><h3>State of charge along route</h3><canvas class="chart" id="socChart"></canvas><h3 style="margin-top:18px">Terrain profile &amp; cruise altitude</h3><canvas class="chart" id="terChart"></canvas></div></div>`;
      requestAnimationFrame(()=>{
        let acc=0; const soc=[[0,p.input.startSoc]]; p.legRows.forEach(l=>{acc+=l.d; soc.push([acc,l.soc]);});
        lineChart($('#socChart'), [{ data:soc, color:'#fff', fill:'rgba(255,255,255,.12)' }], { min:0, max:100, lines:[{ y:p.reserveSoc, color:'#ff5c5c' }], xlabel:'km' });
        lineChart($('#terChart'), [{ data:p.prof.map(x=>[x.km, x.elev*3.281]), color:'#ffb547', fill:'rgba(255,181,71,.2)' }, { data:p.prof.map(x=>[x.km, p.cruiseFt]), color:'#5ad1ff' }], { min:0, lines:[{ y:p.minSafeFt, color:'rgba(255,92,92,.6)' }], xlabel:'km · ft AMSL' });
      });
    } else if (tab==='compliance'){
      body.innerHTML = `<div class="grid g2"><div class="card corner"><h3>Airspace on route</h3><ul class="list-plain">${p.crossings.map(z=>`<li><span class="tag" style="color:${ZC[z.type]};border-color:${ZC[z.type]}">${z.type}</span><span>${esc(z.name)}</span></li>`).join('') || '<li class="c-ok">No controlled, restricted or prohibited airspace on route.</li>'}</ul>
        <h3 style="margin-top:18px">Legal requirements for this flight</h3><ul class="list-plain">
        <li><span class="dim mono">01</span>Valid CofR, CofA/ARC, radio station licence and insurance on board</li>
        <li><span class="dim mono">02</span>Pilot licence with eVTOL type rating, Class 1 medical, FRTOL</li>
        <li><span class="dim mono">03</span>Operator permit (NSOP/SOP) for commercial carriage</li>
        <li><span class="dim mono">04</span>Flight plan with FIC/ADC numbers filed with AAI</li>
        <li><span class="dim mono">05</span>Take-off and landing only at approved vertiports / heliports</li>
        <li><span class="dim mono">06</span>Maintain ≥1000 ft over congested areas; day VFR minima 5 km</li></ul></div>
        <div class="card corner"><h3>Detours added by the AI router</h3><ul class="list-plain">${p.allPts.filter(x=>x.name?.startsWith('AVOID')).map(x=>`<li><span class="tag warn">Detour</span>${esc(x.name)} · ${x.lat.toFixed(3)}, ${x.lon.toFixed(3)}</li>`).join('') || '<li class="muted">No detours required.</li>'}</ul>
        <div class="disclaimer" style="margin-top:16px">Airspace data in flyWave is indicative. Use AIP India ENR 5.1, AAI NOTAMs and the Digital Sky airspace map for operational decisions.</div></div></div>`;
    } else if (tab==='fpl'){
      body.innerHTML = `<div class="card corner"><div class="row between" style="margin-bottom:12px"><h3 style="margin:0">ICAO flight plan (draft)</h3><button class="btn btn-ghost btn-sm" id="copyFpl">Copy</button></div><div class="fpl">${esc(p.fpl)}</div>
        <p class="small dim" style="margin:10px 0 0">ZZZZ is used for vertiports without ICAO designators (DEP/DEST in item 18). Replace FIC/ADC placeholders before filing with AAI. Times are UTC.</p></div>`;
      $('#copyFpl').onclick = () => { navigator.clipboard?.writeText(p.fpl); toast('Flight plan copied'); };
    } else if (tab==='checklist'){
      const k = 'chkplan';
      const st = store.get(k, {});
      body.innerHTML = `<div class="card corner"><h3>Pre-departure checklist</h3>${p.checklist.map((c,i)=>`<label class="chk ${st[i]?'done':''}"><input type="checkbox" data-i="${i}" ${st[i]?'checked':''}/><span class="t"><b>${esc(c)}</b></span></label>`).join('')}</div>`;
      body.querySelectorAll('input').forEach(c => c.onchange = () => { const s = store.get(k,{}); s[c.dataset.i] = c.checked; store.set(k,s); c.closest('.chk').classList.toggle('done', c.checked); });
    }
    $('#aSave').onclick = () => { addLog({ type:'plan', title:`${p.input.from.name} → ${p.input.to.name}`, ac:p.ac.name, verdict:p.verdict, score:p.score, km:+p.totalDist.toFixed(1), min:Math.round(p.flightMin) }); toast('Saved to logbook'); };
    $('#aSim').onclick = () => { location.hash = `#/sim?ac=${p.ac.id}&km=${p.totalDist.toFixed(1)}&wind=${Math.round(p.wx.points[0]?.w.wind80||10)}&gust=${Math.round(p.wx.points[0]?.w.gust||15)}&temp=${Math.round(p.wx.points[0]?.w.temp||30)}&rain=${p.wx.points[0]?.w.precip||0}&elev=${Math.round(p.prof[0].elev||0)}&payload=${p.input.payload}&reserve=${p.input.reserveMin}`; };
    $('#aAsk').onclick = () => openCopilot('Analyse my current flight plan and tell me the key risks', true);
    $('#aPrint').onclick = () => window.print();
    $('#aJson').onclick = () => { const b = new Blob([JSON.stringify({ ...p, wx:{ ...p.wx, raw:undefined } }, null, 2)], { type:'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `flywave-plan-${p.id}.json`; a.click(); };
  }
  if (params.get('auto')) generate();
  return { destroy(){ map.remove(); } };
}
