import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAircraft } from '../model.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { PLACES } from '../data/geo.js';
import { TRACKS, INDIA_WX } from '../data/regs.js';
import { store, fmt, esc } from '../store.js';
import { openCopilot } from '../ai.js';

function hero(canvas){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.7;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000); scene.fog = new THREE.FogExp2(0x000000, 0.012);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
  scene.add(new THREE.AmbientLight(0x8899aa, 0.15));
  const key = new THREE.DirectionalLight(0xbfd8ff, 0.6); key.position.set(-20,30,10); scene.add(key);
  const rim = new THREE.DirectionalLight(0x5ad1ff, 1.4); rim.position.set(10,5,-30); scene.add(rim);

  // stars
  const sg = new THREE.BufferGeometry(); const sp = [];
  for (let i=0;i<2500;i++){ const r=600+Math.random()*300, th=Math.random()*Math.PI*2, ph=Math.random()*Math.PI*0.45; sp.push(r*Math.cos(th)*Math.sin(ph), r*Math.cos(ph)*0.9+20, r*Math.sin(th)*Math.sin(ph)); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp,3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color:0xffffff, size:1.2, sizeAttenuation:false, transparent:true, opacity:.8 })));

  // city lights
  const cg = new THREE.BufferGeometry(); const cp=[], cc=[]; const col = new THREE.Color();
  for (let k=0;k<26;k++){
    const cx = (Math.random()-0.5)*500, cz = -Math.random()*400 + 40, n = 300 + Math.random()*600, spread = 10+Math.random()*30;
    for (let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, r=Math.pow(Math.random(),1.6)*spread; cp.push(cx+Math.cos(a)*r, 0.2, cz+Math.sin(a)*r);
      col.setHSL(0.08+Math.random()*0.06, 0.9, 0.55+Math.random()*0.3); if (Math.random()<0.15) col.setRGB(.7,.85,1); cc.push(col.r,col.g,col.b); }
  }
  // roads
  for (let k=0;k<40;k++){ const x0=(Math.random()-0.5)*600, z0=-Math.random()*450+50, a=Math.random()*Math.PI; for(let i=0;i<220;i++){ cp.push(x0+Math.cos(a)*i*1.4, 0.2, z0+Math.sin(a)*i*1.4); cc.push(1,.75,.45);} }
  cg.setAttribute('position', new THREE.Float32BufferAttribute(cp,3)); cg.setAttribute('color', new THREE.Float32BufferAttribute(cc,3));
  scene.add(new THREE.Points(cg, new THREE.PointsMaterial({ size:1.6, vertexColors:true, sizeAttenuation:false, transparent:true, opacity:.9 })));
  const grid = new THREE.GridHelper(800, 160, 0x1a2a33, 0x0b1216); grid.material.transparent = true; grid.material.opacity=.5; scene.add(grid);

  // vertiport pad
  const pad = new THREE.Mesh(new THREE.RingGeometry(9, 9.3, 64), new THREE.MeshBasicMaterial({ color:0x5ad1ff })); pad.rotation.x=-Math.PI/2; pad.position.y=0.05; scene.add(pad);
  for (let i=0;i<24;i++){ const a=i/24*Math.PI*2; const l = new THREE.Mesh(new THREE.SphereGeometry(0.15,8,8), new THREE.MeshBasicMaterial({ color:0xffffff })); l.position.set(Math.cos(a)*10.5,0.15,Math.sin(a)*10.5); scene.add(l); }

  const ac = buildAircraft(AIRCRAFT[0]); scene.add(ac.object); ac.object.position.y = 6; ac.object.traverse(o => { if (o.material && 'envMapIntensity' in o.material) o.material.envMapIntensity = 0.35; });
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1,1), 0.7, 0.4, 0.97); composer.addPass(bloom); composer.addPass(new OutputPass());
  let raf, t0 = performance.now(), last = t0;
  function resize(){ const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w,h,false); composer.setSize(w,h); camera.aspect = w/h; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  function loop(now){
    const dt = Math.min(0.05,(now-last)/1000); last = now; const t = (now-t0)/1000;
    ac.object.position.y = 6 + Math.sin(t*0.8)*0.6; ac.object.rotation.y = t*0.12; ac.inner.rotation.z = Math.sin(t*0.6)*0.03;
    ac.update(dt, 1, 0);
    const a = t*0.05 + 0.6; camera.position.set(Math.cos(a)*24, 7 + Math.sin(t*0.2)*1.5, Math.sin(a)*24); camera.lookAt(0, 5.5, 0);
    composer.render(); raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); composer.dispose?.(); };
}

const WMO = { 0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Drizzle',53:'Drizzle',55:'Dense drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',80:'Showers',81:'Showers',82:'Violent showers',95:'Thunderstorm',96:'Thunderstorm + hail',99:'Thunderstorm + hail' };
export { WMO };

async function loadWx(el, place){
  el.innerHTML = '<div class="muted small">Fetching live weather…</div>';
  try{
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,weather_code,cloud_cover&wind_speed_unit=kn&timezone=Asia%2FKolkata`;
    const c = (await (await fetch(u)).json()).current;
    const vis = c.visibility/1000, gust = c.wind_gusts_10m;
    const vfr = vis >= 5 && gust < 25 && ![95,96,99,65,82].includes(c.weather_code);
    el.innerHTML = `
      <div class="row between"><div><div class="stat"><div class="v">${fmt(c.temperature_2m,0)}<small>°C</small></div><div class="l">${WMO[c.weather_code]||'—'}</div></div></div>
      <span class="tag ${vfr?'ok':'warn'}">${vfr?'VFR likely':'Check minima'}</span></div>
      <table style="margin-top:12px"><tr><td class="muted">Wind</td><td class="num">${String(Math.round(c.wind_direction_10m)).padStart(3,'0')}° / ${fmt(c.wind_speed_10m)} kt</td></tr>
      <tr><td class="muted">Gusts</td><td class="num">${fmt(gust)} kt</td></tr><tr><td class="muted">Visibility</td><td class="num">${vis>=10?'10+':fmt(vis,1)} km</td></tr>
      <tr><td class="muted">Cloud / RH</td><td class="num">${c.cloud_cover}% / ${c.relative_humidity_2m}%</td></tr></table>`;
  }catch(e){ el.innerHTML = '<div class="muted small">Weather unavailable offline.</div>'; }
}

export function mount(view){
  const checks = store.get('checks', {});
  const total = TRACKS.reduce((s,t)=>s+t.items.length,0);
  const done = TRACKS.reduce((s,t)=>s+t.items.filter((_,i)=>checks[t.id+i]).length,0);
  const pct = Math.round(done/total*100);
  const log = store.get('logbook', []);
  const pilot = store.get('pilot', {});
  const month = new Date().getMonth();
  const season = INDIA_WX.find(s => s.months.includes(month));
  let medStatus = '<span class="tag">Not set</span>';
  if (pilot.medicalExpiry){ const d = (new Date(pilot.medicalExpiry) - new Date())/864e5; medStatus = d<0?'<span class="tag bad">Expired</span>': d<30?`<span class="tag warn">${Math.round(d)} days</span>`:`<span class="tag ok">${Math.round(d)} days</span>`; }

  view.innerHTML = `
  <section class="hero">
    <canvas id="heroCanvas"></canvas>
    <div class="hero-content">
      <div class="eyebrow">Advanced Air Mobility · India</div>
      <h1>Plan. Comply.<br/>Simulate. Fly.</h1>
      <p>flyWave is the operations platform for eVTOL aircraft in India — DGCA compliance, AI-assisted route planning and a physics-based stress-test lab in one mission console.</p>
      <div class="row gap wrap"><a class="btn btn-solid" href="#/planner">Plan a flight</a><a class="btn" href="#/sim">Open simulation lab</a><button class="btn btn-ghost" id="askAi">Ask copilot</button></div>
    </div>
  </section>
  <div class="page">
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card corner stat"><div class="v">${pct}<small>%</small></div><div class="l">Certification readiness</div><div class="bar" style="margin-top:12px"><i style="width:${pct}%"></i></div></div>
      <div class="card corner stat"><div class="v">${log.filter(l=>l.type==='plan').length}</div><div class="l">Flight plans filed</div></div>
      <div class="card corner stat"><div class="v">${log.filter(l=>l.type==='sim').length}</div><div class="l">Simulation runs</div></div>
      <div class="card corner stat"><div class="v" style="font-size:22px;margin:6px 0 4px">${medStatus}</div><div class="l">Class 1 medical</div></div>
    </div>
    <div class="grid g3" style="margin-bottom:16px">
      <a class="card hover tile corner" href="#/legal"><div><div class="num">01</div><h2>Regulations</h2><p>DGCA framework, licensing, medical, airspace, vertiports and a certification tracker for pilot, aircraft, operator and vertiport.</p></div><div class="go">Explore →</div></a>
      <a class="card hover tile corner" href="#/planner"><div><div class="num">02</div><h2>Flight planner</h2><p>Point A to B with airspace avoidance, live weather, terrain, energy &amp; reserve budget, ICAO flight plan and an AI go/no-go brief.</p></div><div class="go">Plan →</div></a>
      <a class="card hover tile corner" href="#/sim"><div><div class="num">03</div><h2>Simulation lab</h2><p>Enter your specs or upload a 3D model, then stress-test in monsoon storms, motor failure, Leh-altitude heat and more.</p></div><div class="go">Simulate →</div></a>
    </div>
    <div class="grid g3">
      <div class="card">
        <div class="row between" style="margin-bottom:12px"><h3 style="margin:0">Live weather</h3><select id="wxPlace" style="width:auto;padding:5px 8px;font-size:12px">${PLACES.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
        <div id="wx"></div>
      </div>
      <div class="card">
        <h3>Quick plan</h3>
        <label class="field"><span>From</span><select id="qFrom">${PLACES.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
        <label class="field"><span>To</span><select id="qTo">${PLACES.map(p=>`<option value="${p.id}" ${p.id==='pune'?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Aircraft</span><select id="qAc">${AIRCRAFT.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label>
        <button class="btn btn-solid" id="qGo" style="width:100%">Generate plan</button>
      </div>
      <div class="card">
        <h3>Seasonal advisory</h3>
        <div class="tag info" style="margin-bottom:10px">${esc(season.name)}</div>
        <p class="muted" style="line-height:1.55;margin:0 0 16px">${esc(season.note)}</p>
        <h3>Recent activity</h3>
        <ul class="list-plain">${log.slice(0,4).map(l=>`<li><span class="tag ${l.type==='sim'?'info':''}">${l.type}</span><span class="grow">${esc(l.title)}</span><span class="dim small mono">${new Date(l.date).toLocaleDateString('en-IN')}</span></li>`).join('') || '<li class="muted">No activity yet — generate your first plan.</li>'}</ul>
      </div>
    </div>
  </div>
  <footer class="foot"><span>flyWave · eVTOL operations platform for India</span><span>Reference tool — verify with DGCA, AAI and NOTAMs before flight. <a href="https://app.devin.ai/sessions/51fbf110f0194cf281d078c5ba616903" target="_blank" rel="noopener" class="muted">Request changes</a></span></footer>`;
  const stop = hero(view.querySelector('#heroCanvas'));
  const wxSel = view.querySelector('#wxPlace'); wxSel.value = 'bkc';
  const wx = view.querySelector('#wx'); const lw = () => loadWx(wx, PLACES.find(p=>p.id===wxSel.value)); wxSel.onchange = lw; lw();
  view.querySelector('#qGo').onclick = () => { location.hash = `#/planner?from=${qFrom.value}&to=${qTo.value}&ac=${qAc.value}&auto=1`; };
  const qFrom = view.querySelector('#qFrom'), qTo = view.querySelector('#qTo'), qAc = view.querySelector('#qAc');
  view.querySelector('#askAi').onclick = () => openCopilot();
  return { destroy: stop };
}
