import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildAircraft, wrapCustomModel } from '../model.js';
import { getFleet, saveCustom, CONFIG_LABEL } from '../data/aircraft.js';
import { SimCore, SCENARIOS, runHeadless } from '../simCore.js';
import { store, session, toast, fmt, esc, addLog, lineChart, clamp } from '../store.js';
import { openCopilot } from '../ai.js';

const FIELDS = [
  ['rotors','Rotors',2,24,1], ['seats','Seats',1,8,1], ['mtow','MTOW kg',300,6000,10], ['emptyMass','Empty mass kg',200,5000,10], ['payload','Max payload kg',50,1500,10],
  ['batteryKWh','Battery kWh',20,600,5], ['cruiseKmh','Cruise km/h',60,400,5], ['rangeKm','Rated range km',20,400,5], ['rotorDia','Rotor dia m',0.8,4,0.1],
  ['wingspan','Span m',4,20,0.1], ['length','Length m',4,14,0.1], ['twr','Thrust / weight',1.1,2.2,0.01], ['loadLimit','Limit load g',2,5,0.1], ['maxWindKt','Max wind kt',10,45,1],
];

function canvasTex(w, h, draw){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function noise2(x, y){ return Math.sin(x*0.0011+Math.sin(y*0.0007)*2)*Math.cos(y*0.0013+x*0.0004)*0.6 + Math.sin(x*0.004+y*0.003)*0.25 + Math.sin(x*0.013-y*0.011)*0.08; }

export function mount(view, params){
  const fleet = getFleet();
  let spec = { ...(fleet.find(a=>a.id===params.get('ac')) || fleet[0]) };
  let scenario = SCENARIOS[0]; let env = { ...scenario.env };
  if (params.get('km')){ scenario = { id:'plan', name:'From flight plan', desc:'Weather & route from planner', env:{} };
    env = { wind:+params.get('wind'), gust:+params.get('gust'), cross:45, temp:+params.get('temp'), elev:+params.get('elev'), rain:+params.get('rain'), vis:10, payloadPct:Math.round(+params.get('payload')/spec.payload*100), failure:'none', tod:11 }; }
  let distanceKm = +(params.get('km') || 25), reserveMin = +(params.get('reserve') || 20);

  view.innerHTML = `
  <div class="sim">
    <div class="sim-panel">
      <div class="eyebrow">Section 03 · Simulation lab</div>
      <h3 style="margin-top:14px">Aircraft model</h3>
      <label class="field"><span>Preset</span><select id="sPreset">${fleet.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Configuration</span><select id="sConfig">${Object.entries(CONFIG_LABEL).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
      <div class="grid g2" style="gap:0 10px" id="specFields"></div>
      <label class="field"><span>Livery</span><input type="color" id="sColor" style="height:36px;padding:2px"/></label>
      <h3>3D design upload</h3>
      <label class="drop" id="drop">Drop a .glb / .gltf model or click to upload<br/><span class="dim">Nodes named rotor/prop spin automatically</span><input type="file" id="glb" accept=".glb,.gltf" hidden/></label>
      <div class="row gap" style="margin-top:8px"><button class="btn btn-ghost btn-sm grow" id="useProc">Procedural model</button><button class="btn btn-ghost btn-sm grow" id="saveAc">Save to hangar</button></div>
      <h3>Mission</h3>
      <div class="field"><span>Distance</span><div class="range-row"><input type="range" id="sDist" min="3" max="200" step="1" value="${distanceKm}"/><output id="oDist">${distanceKm} km</output></div></div>
      <div class="field"><span>Energy reserve</span><div class="range-row"><input type="range" id="sRes" min="5" max="40" step="1" value="${reserveMin}"/><output id="oRes">${reserveMin} min</output></div></div>
    </div>
    <div class="sim-stage" id="stage">
      <div class="hud" id="hud"></div>
      <div class="sim-controls">
        <button class="btn btn-solid btn-sm" id="run">Launch</button><button class="btn btn-sm" id="reset">Reset</button>
        <div class="seg" id="warp"><button data-w="1">1×</button><button data-w="5">5×</button><button data-w="20" class="on">Auto</button><button data-w="60">60×</button></div>
        <div class="seg" id="cam"><button data-c="chase" class="on">Chase</button><button data-c="orbit">Orbit</button><button data-c="cine">Cine</button><button data-c="pilot">Pilot</button></div>
      </div>
    </div>
    <div class="sim-panel right">
      <h3>Stress scenario</h3><div id="scen"></div>
      <h3>Environment</h3><div id="envFields"></div>
      <h3>Live telemetry</h3><div id="gauges"></div>
      <canvas class="chart" id="cAlt" style="height:90px"></canvas><canvas class="chart" id="cSoc" style="height:90px;margin-top:6px"></canvas><canvas class="chart" id="cTemp" style="height:90px;margin-top:6px"></canvas>
      <div id="report"></div>
      <button class="btn btn-ghost btn-sm" id="campaign" style="width:100%;margin-top:14px">Run full stress campaign (all scenarios)</button>
      <div id="campOut"></div>
    </div>
  </div>`;
  const $ = s => view.querySelector(s);

  // ---------- renderer & world ----------
  const stage = $('#stage');
  const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(1.75, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.55;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 40000);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.enabled = false;
  const sky = new Sky(); sky.scale.setScalar(30000); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 6; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.8;
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera, { left:-40, right:40, top:40, bottom:-40, near:1, far:2000 }); sun.shadow.bias = -0.0004; scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a3020, 0.6); scene.add(hemi);
  const flash = new THREE.AmbientLight(0xd8e4ff, 0); scene.add(flash);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const VIS_MID = 7000, PAD = 1200;
  let visLen = 0;
  const world = new THREE.Group(); scene.add(world);

  const groundTex = canvasTex(512, 512, (c,w,h) => { c.fillStyle = '#4a5a33'; c.fillRect(0,0,w,h); for (let i=0;i<9000;i++){ const g = 60+Math.random()*50; c.fillStyle = `rgba(${g+20},${g+35},${g-10},.35)`; c.fillRect(Math.random()*w, Math.random()*h, 2+Math.random()*5, 2+Math.random()*5); } for (let i=0;i<40;i++){ c.fillStyle = `rgba(${120+Math.random()*40},${100+Math.random()*30},60,.25)`; c.fillRect(Math.random()*w, Math.random()*h, 30+Math.random()*90, 20+Math.random()*60); } });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(220, 70);
  const winTex = canvasTex(64, 128, (c,w,h) => { c.fillStyle = '#05070a'; c.fillRect(0,0,w,h); for (let y=4;y<h;y+=8) for (let x=4;x<w;x+=8){ if (Math.random()<0.55){ const b = 150+Math.random()*105; c.fillStyle = `rgb(${b},${b*0.85},${b*0.6})`; c.fillRect(x,y,4,5); } } });
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  const padTex = canvasTex(512, 512, (c,w,h) => { c.fillStyle = '#2a2d31'; c.fillRect(0,0,w,h); c.strokeStyle = '#fff'; c.lineWidth = 14; c.beginPath(); c.arc(w/2,h/2,w*0.42,0,Math.PI*2); c.stroke(); c.strokeStyle = '#ffd400'; c.lineWidth = 8; c.setLineDash([30,20]); c.beginPath(); c.arc(w/2,h/2,w*0.47,0,Math.PI*2); c.stroke(); c.setLineDash([]); c.fillStyle = '#fff'; c.font = 'bold 260px Barlow, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('V', w/2, h/2+10); });
  const cloudTex = canvasTex(128, 128, (c,w,h) => { for (let i=0;i<14;i++){ const x = 30+Math.random()*68, y = 40+Math.random()*48, r = 18+Math.random()*26; const g = c.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,'rgba(255,255,255,.55)'); g.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0,0,w,h); } });

  let ground, cityMats = [], padLights = [], clouds, rain, dust, trail, trailPts = [], plannedLine;
  function buildWorld(){
    world.clear(); cityMats = []; padLights = [];
    const D = distanceKm*1000; visLen = D <= 2*PAD + VIS_MID ? D : 2*PAD + VIS_MID;
    const W = visLen + 8000, H = 9000;
    const g = new THREE.PlaneGeometry(W, H, 260, 90); g.rotateX(-Math.PI/2);
    const pos = g.attributes.position; const cols = [];
    for (let i=0;i<pos.count;i++){
      const x = pos.getX(i) + visLen/2, z = pos.getZ(i);
      const nearPad = Math.min(Math.hypot(x, z), Math.hypot(x-visLen, z));
      const flat = clamp((nearPad-700)/1500, 0, 1) * clamp((Math.abs(z)-150)/600, 0.25, 1);
      let h = (noise2(x, z)+0.4)*90*flat + Math.max(0, Math.abs(z)-2500)*0.08*flat;
      pos.setY(i, Math.max(-2, h));
      const t = clamp(h/120, 0, 1); cols.push(0.75+t*0.3, 0.85+t*0.1, 0.7+t*0.2);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
    ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map:groundTex, vertexColors:true, roughness:0.95 }));
    ground.position.x = visLen/2; ground.receiveShadow = true; world.add(ground);
    // river
    const river = new THREE.Mesh(new THREE.PlaneGeometry(260, H), new THREE.MeshStandardMaterial({ color:0x1d3346, metalness:0.6, roughness:0.15 }));
    river.rotation.x = -Math.PI/2; river.rotation.z = 0.3; river.position.set(visLen*0.55, 0.5, 0); world.add(river);
    // cities & pads at both ends
    [0, visLen].forEach((cx, ci) => {
      const n = 380; const geo = new THREE.BoxGeometry(1,1,1); geo.translate(0,0.5,0);
      const mat = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.45, metalness:0.5, emissive:0xffffff, emissiveMap:winTex, emissiveIntensity:0 });
      cityMats.push(mat);
      const im = new THREE.InstancedMesh(geo, mat, n); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); let k=0;
      for (let i=0;i<n*3 && k<n;i++){
        const r = 90 + Math.pow(Math.random(),0.7)*900, a = Math.random()*Math.PI*2; const x = cx + Math.cos(a)*r, z = Math.sin(a)*r;
        if (Math.abs(z) < 50 && Math.abs(x-cx) < 400) continue;
        const h = 12 + Math.pow(Math.random(),2.2)*(r<400?140:60), w = 14+Math.random()*22;
        m4.compose(new THREE.Vector3(x,0,z), q, new THREE.Vector3(w,h,w*(0.7+Math.random()*0.6))); im.setMatrixAt(k++, m4);
      }
      const bc = new THREE.Color(); for (let j=0;j<k;j++){ const t = Math.random(); bc.setHSL(0.58+Math.random()*0.06, 0.08+Math.random()*0.12, t<0.4 ? 0.08+Math.random()*0.08 : 0.18+Math.random()*0.14); im.setColorAt(j, bc); }
      im.count = k; im.castShadow = true; im.receiveShadow = true; world.add(im);
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(22, 23, 1.2, 64), [new THREE.MeshStandardMaterial({ color:0x1a1c1f }), new THREE.MeshStandardMaterial({ map:padTex, roughness:0.7 }), new THREE.MeshStandardMaterial({ color:0x1a1c1f })]);
      deck.position.set(cx, 0.6, 0); deck.receiveShadow = true; world.add(deck);
      for (let i=0;i<20;i++){ const a = i/20*Math.PI*2; const l = new THREE.Mesh(new THREE.SphereGeometry(0.35,8,8), new THREE.MeshBasicMaterial({ color: ci ? 0x2aff7a : 0x5ad1ff })); l.position.set(cx+Math.cos(a)*23.5, 1.3, Math.sin(a)*23.5); world.add(l); padLights.push(l); }
    });
    // trees
    const tg = new THREE.ConeGeometry(4, 14, 6); tg.translate(0,7,0); const tm = new THREE.MeshStandardMaterial({ color:0x2f4a26, roughness:1 });
    const trees = new THREE.InstancedMesh(tg, tm, 1500); const m4 = new THREE.Matrix4(); const ray = new THREE.Raycaster();
    for (let i=0;i<1500;i++){ let x, z, tries=0; do { x = Math.random()*visLen*1.1 - visLen*0.05; z = (Math.random()-0.5)*3000; } while ((Math.hypot(x,z) < 1100 || Math.hypot(x-visLen,z) < 1100 || Math.abs(z) < 120) && tries++ < 20); const s = 0.6+Math.random()*0.9; ray.set(new THREE.Vector3(x,500,z), new THREE.Vector3(0,-1,0)); const hit = ray.intersectObject(ground)[0]; m4.compose(new THREE.Vector3(x, hit?hit.point.y:0, z), new THREE.Quaternion(), new THREE.Vector3(s,s,s)); trees.setMatrixAt(i, m4); }
    trees.castShadow = true; world.add(trees);
    // clouds
    clouds = new THREE.Group(); world.add(clouds);
    for (let i=0;i<160;i++){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:cloudTex, transparent:true, depthWrite:false, opacity:0.75, fog:true })); const s = 250+Math.random()*450; sp.scale.set(s, s*0.55, 1); sp.position.set(Math.random()*(visLen+6000)-3000, 650+Math.random()*450, (Math.random()-0.5)*7000); clouds.add(sp); }
    // planned path & trail
    plannedLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,2,0), new THREE.Vector3(0,40,0), new THREE.Vector3(PAD*0.8,457,0), new THREE.Vector3(visLen-PAD*0.8,457,0), new THREE.Vector3(visLen,45,0), new THREE.Vector3(visLen,2,0)]), new THREE.LineDashedMaterial({ color:0x5ad1ff, dashSize:20, gapSize:14, transparent:true, opacity:0.5 }));
    plannedLine.computeLineDistances(); world.add(plannedLine);
    trailPts = []; trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.8 })); world.add(trail);
    // rain & dust
    const rg = new THREE.BufferGeometry(); const rp = new Float32Array(6000*6); for (let i=0;i<6000;i++){ const x=(Math.random()-0.5)*160, y=Math.random()*120, z=(Math.random()-0.5)*160; rp.set([x,y,z,x,y-2.2,z], i*6); }
    rg.setAttribute('position', new THREE.BufferAttribute(rp,3)); rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color:0xaabbd0, transparent:true, opacity:0.35 })); scene.add(rain);
    const dg = new THREE.BufferGeometry(); const dp = new Float32Array(1500*3); for (let i=0;i<1500;i++) { const a=Math.random()*Math.PI*2, r=4+Math.pow(Math.random(),0.5)*26; dp.set([Math.cos(a)*r, Math.random()*3, Math.sin(a)*r], i*3); }
    dg.setAttribute('position', new THREE.BufferAttribute(dp,3)); const dotTex = canvasTex(32,32,(c,w,h)=>{ const g=c.createRadialGradient(16,16,0,16,16,16); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=g; c.fillRect(0,0,w,h); });
    dust = new THREE.Points(dg, new THREE.PointsMaterial({ color:0xc8b48a, size:0.6, map:dotTex, transparent:true, depthWrite:false, opacity:0 })); scene.add(dust);
  }
  function mapX(x){ const D = distanceKm*1000; if (D <= 2*PAD + VIS_MID) return x; if (x < PAD) return x; if (x > D-PAD) return visLen - (D-x); return PAD + (x-PAD)*(VIS_MID/(D-2*PAD)); }
  function groundAt(x, z){ const r = new THREE.Raycaster(new THREE.Vector3(x,2000,z), new THREE.Vector3(0,-1,0)); const h = r.intersectObject(ground)[0]; return h ? h.point.y : 0; }

  function applyEnv(){
    const tod = env.tod ?? 11; const elev = Math.sin((tod-6)/12*Math.PI)*70 - 4; const az = 180 - (tod-12)*15;
    const night = elev < 2;
    const sunPos = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90-elev), THREE.MathUtils.degToRad(az));
    su.sunPosition.value.copy(sunPos);
    su.turbidity.value = env.dust ? 20 : env.rain > 5 ? 14 : 6; su.rayleigh.value = night ? 0.4 : env.rain > 5 ? 3 : 1.6;
    sun.intensity = night ? 0.05 : clamp(elev/20,0.2,1)*(env.rain>5||env.vis<2 ? 1.0 : 3.0);
    sun.color.set(elev < 12 ? 0xffb37a : 0xffffff);
    hemi.intensity = night ? 0.08 : env.rain > 5 ? 0.9 : 0.6;
    renderer.toneMappingExposure = night ? 0.9 : 0.55;
    const fogCol = env.dust ? new THREE.Color(0x9a7e58) : night ? new THREE.Color(0x05070c) : env.rain > 5 || env.vis < 3 ? new THREE.Color(0x7d858f) : new THREE.Color(0xb9cde0);
    scene.fog = new THREE.FogExp2(fogCol, Math.min(0.004, 1.2/(env.vis*1000)));
    if (env.vis < 3 || env.rain > 5 || env.dust){ scene.background = fogCol; sky.visible = false; } else { scene.background = null; sky.visible = true; }
    const envScene = new THREE.Scene(); const sk2 = new Sky(); sk2.scale.setScalar(1000); Object.keys(su).forEach(k => sk2.material.uniforms[k].value = su[k].value?.clone ? su[k].value.clone() : su[k].value); envScene.add(sk2);
    scene.environment?.dispose?.(); scene.environment = pmrem.fromScene(envScene).texture;
    cityMats.forEach(m => m.emissiveIntensity = night ? 1.1 : elev < 10 ? 0.4 : 0);
    rain.visible = env.rain > 0.5; rain.material.opacity = clamp(env.rain/40, 0.12, 0.45);
    dust.material.opacity = env.dust ? 0.6 : 0;
    clouds.children.forEach(c => { c.material.opacity = env.rain > 5 ? 0.95 : 0.7; c.material.color.set(env.rain>5? 0x6d737a : night ? 0x30343a : 0xffffff); c.visible = env.vis > 1.5 || env.rain>0; });
    bloom.strength = night ? 1.1 : 0.25; bloom.threshold = night ? 0.2 : 0.9;
    sunDir.copy(sunPos);
  }
  const sunDir = new THREE.Vector3(0,1,0);

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1,1,{ samples:4, type:THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1,1), 0.3, 0.4, 0.9); composer.addPass(bloom); composer.addPass(new OutputPass());

  // ---------- aircraft ----------
  let ac = null, customGltf = null;
  function rebuildAircraft(){
    if (ac) scene.remove(ac.object);
    ac = customGltf ? wrapCustomModel(customGltf.clone(true), spec) : buildAircraft(spec);
    scene.add(ac.object); placeAircraft();
  }
  let sim = null, running = false, warp = 20, camMode = 'chase', cineT = 0;
  function newSim(){ sim = new SimCore(spec, env, { distanceKm, reserveMin }); renderReport(null); trailPts = []; }
  function placeAircraft(){
    const s = sim || { x:0, y:0, z:0, pitch:0, roll:0, yaw:0 };
    const vx = mapX(s.x); const gy = (s.x < PAD || s.x > distanceKm*1000-PAD) ? 1.2 : 0;
    ac.object.position.set(vx, s.y + 1.2 + (s.y<1? 0 : 0), s.z);
    ac.object.rotation.set(0, -s.yaw, 0); ac.inner.rotation.set(s.roll, 0, s.pitch);
  }

  // ---------- UI: specs ----------
  function renderSpec(){
    $('#sPreset').value = fleet.some(a=>a.id===spec.id) ? spec.id : fleet[0].id; $('#sConfig').value = spec.config; $('#sColor').value = spec.color || '#f2f2f2';
    $('#specFields').innerHTML = FIELDS.map(([k,l,mi,ma,st]) => `<label class="field"><span>${l}</span><input type="number" data-k="${k}" min="${mi}" max="${ma}" step="${st}" value="${spec[k]}"/></label>`).join('');
    $('#specFields').querySelectorAll('input').forEach(i => i.onchange = () => { spec[i.dataset.k] = clamp(+i.value, +i.min, +i.max); i.value = spec[i.dataset.k]; if (spec.emptyMass + spec.payload > spec.mtow*1.05) toast('Empty + payload exceeds MTOW'); spec.id = 'custom-'+Date.now(); rebuildAircraft(); resetSim(); });
  }
  $('#sPreset').onchange = e => { spec = { ...fleet.find(a=>a.id===e.target.value) }; customGltf = null; renderSpec(); rebuildAircraft(); resetSim(); };
  $('#sConfig').onchange = e => { spec.config = e.target.value; rebuildAircraft(); resetSim(); };
  $('#sColor').oninput = e => { spec.color = e.target.value; ac.materials?.body.color.set(spec.color); };
  $('#sDist').oninput = e => { distanceKm = +e.target.value; $('#oDist').textContent = distanceKm+' km'; };
  $('#sDist').onchange = () => { buildWorld(); applyEnv(); resetSim(); };
  $('#sRes').oninput = e => { reserveMin = +e.target.value; $('#oRes').textContent = reserveMin+' min'; resetSim(); };
  $('#saveAc').onclick = () => { const name = prompt('Name for this aircraft', spec.name.includes('(custom)') ? spec.name : spec.name+' (custom)'); if (!name) return; spec = { ...spec, id:'c'+Date.now(), name, maker:'Custom', origin:'—' }; saveCustom(spec); toast('Saved to hangar'); };
  const drop = $('#drop'), fileIn = $('#glb');
  drop.onclick = () => fileIn.click();
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) loadModel(e.dataTransfer.files[0]); };
  fileIn.onchange = () => fileIn.files[0] && loadModel(fileIn.files[0]);
  function loadModel(file){
    const url = URL.createObjectURL(file);
    new GLTFLoader().load(url, g => { customGltf = g.scene; rebuildAircraft(); drop.innerHTML = `Loaded <b>${esc(file.name)}</b><br/><span class="dim">Physics uses the specs above</span>`; toast('3D model loaded'); }, undefined, err => toast('Could not load model: '+err.message));
  }
  $('#useProc').onclick = () => { customGltf = null; rebuildAircraft(); drop.innerHTML = 'Drop a .glb / .gltf model or click to upload'; };

  // ---------- UI: scenarios & env ----------
  const ENV_FIELDS = [['wind','Mean wind kt',0,45,1],['gust','Gusts kt',0,60,1],['cross','Wind angle ° (0 head, 90 beam)',0,180,5],['temp','Temperature °C',-10,50,1],['elev','Elevation m',0,4000,10],['rain','Rain mm/h',0,60,1],['vis','Visibility km',0.3,10,0.1],['payloadPct','Payload % of max',0,180,5],['tod','Time of day h',5,22,0.25]];
  function renderScen(){
    $('#scen').innerHTML = SCENARIOS.map(s => `<div class="scenario ${scenario.id===s.id?'on':''}" data-id="${s.id}"><b>${esc(s.name)}</b><span>${esc(s.desc)}</span></div>`).join('') + (scenario.id==='plan'?`<div class="scenario on"><b>From flight plan</b><span>Live weather from planner</span></div>`:'');
    $('#scen').querySelectorAll('[data-id]').forEach(d => d.onclick = () => { scenario = SCENARIOS.find(s=>s.id===d.dataset.id); env = { ...scenario.env }; renderScen(); renderEnv(); applyEnv(); resetSim(); });
  }
  function renderEnv(){
    $('#envFields').innerHTML = ENV_FIELDS.map(([k,l,mi,ma,st]) => `<div class="field"><span>${l}</span><div class="range-row"><input type="range" data-k="${k}" min="${mi}" max="${ma}" step="${st}" value="${env[k]??0}"/><output>${env[k]??0}</output></div></div>`).join('') +
      `<label class="field"><span>Injected failure</span><select id="fail">${['none','motor','bird','thermal'].map(f=>`<option ${env.failure===f?'selected':''} value="${f}">${{none:'None',motor:'Lift unit failure at take-off',bird:'Bird strike in cruise',thermal:'Battery thermal runaway'}[f]}</option>`).join('')}</select></label>`;
    $('#envFields').querySelectorAll('input').forEach(i => { i.oninput = () => { env[i.dataset.k] = +i.value; i.nextElementSibling.textContent = i.value; }; i.onchange = () => { applyEnv(); resetSim(); }; });
    $('#fail').onchange = e => { env.failure = e.target.value; resetSim(); };
  }
  $('#warp').querySelectorAll('button').forEach(b => b.onclick = () => { warp = +b.dataset.w; $('#warp').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b)); });
  $('#cam').querySelectorAll('button').forEach(b => b.onclick = () => { camMode = b.dataset.c; controls.enabled = camMode==='orbit'; $('#cam').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b)); });
  $('#run').onclick = () => { if (sim.done) resetSim(); running = !running; $('#run').textContent = running ? 'Pause' : 'Resume'; };
  $('#reset').onclick = () => resetSim();
  function resetSim(){ running = false; $('#run').textContent = 'Launch'; newSim(); placeAircraft(); }

  // ---------- HUD, gauges, report ----------
  function hud(){
    const s = sim; const ft = s.y*3.281; const D = distanceKm*1000;
    const al = s.alerts[0];
    $('#hud').innerHTML = `<div class="tl"><div class="phase">${s.phase}</div><div class="k" style="margin-top:4px">${esc(scenario.name)} · T+${fmtT(s.t)}</div></div>
      <div class="tr"><div class="k">Distance to go</div><div class="v">${fmt(Math.max(0,(D-s.x)/1000),1)} km</div><div class="k" style="margin-top:6px">${esc(spec.name)}${customGltf?' · custom 3D':''}</div></div>
      ${al?`<div class="alert">${al}</div>`:''}
      <div class="bl"><div class="row4"><div><div class="k">ALT</div><div class="v">${fmt(ft)} ft</div></div><div><div class="k">IAS</div><div class="v">${fmt(s.vx/0.5144)} kt</div></div><div><div class="k">V/S</div><div class="v">${s.vy>=0?'+':''}${fmt(s.vy*196.85)} fpm</div></div><div><div class="k">PWR</div><div class="v">${fmt(s.power)} kW</div></div></div></div>
      <div class="br"><div class="row4"><div><div class="k">SOC</div><div class="v ${s.soc<20?'c-bad':''}">${fmt(s.soc,1)}%</div></div><div><div class="k">PACK</div><div class="v ${s.battT>60?'c-bad':s.battT>50?'c-warn':''}">${fmt(s.battT)}°C</div></div><div><div class="k">T/W</div><div class="v ${s.thrustMargin<1.1?'c-warn':''}">${s.thrustMargin.toFixed(2)}</div></div><div><div class="k">LOAD</div><div class="v">${s.n.toFixed(2)} g</div></div></div>
      <div class="k" style="margin-top:8px">Wind ${fmt(Math.abs(s.headW||0)/0.5144)} kt ${ (s.headW||0)>=0?'head':'tail'} · ${fmt(Math.abs(s.crossW||0)/0.5144)} kt cross · dev ${fmt(s.z)} m</div></div>`;
    const g = (l,v,max,txt,warnAt) => `<div class="gauge"><div class="row"><span>${l}</span><span>${txt}</span></div><div class="bar"><i style="width:${clamp(v/max*100,0,100)}%;background:${warnAt && v>warnAt?'var(--red)':'#fff'}"></i></div></div>`;
    $('#gauges').innerHTML = g('Battery', s.soc, 100, fmt(s.soc,1)+'%') + g('Pack temp', s.battT, 100, fmt(s.battT)+' °C', 60) + g('Structural load', Math.abs(s.n), spec.loadLimit, s.n.toFixed(2)+' / '+spec.loadLimit+' g', spec.loadLimit*0.85) + g('Rotor health', s.rotorHealth.reduce((a,b)=>a+b,0), s.rotorHealth.length, s.rotorHealth.filter(h=>h<1).length+' degraded');
  }
  const fmtT = t => `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
  let lastChart = 0;
  function charts(){
    const S = sim.samples; if (S.length < 2) return;
    lineChart($('#cAlt'), [{ data:S.map(x=>[x.t,x.alt*3.281]), color:'#5ad1ff', fill:'rgba(90,209,255,.2)' }], { min:0, xlabel:'alt ft' });
    lineChart($('#cSoc'), [{ data:S.map(x=>[x.t,x.soc]), color:'#fff', fill:'rgba(255,255,255,.12)' }], { min:0, max:100, lines:[{ y:100*sim.reserveKWh/sim.usable, color:'#ff5c5c' }], xlabel:'SoC %' });
    lineChart($('#cTemp'), [{ data:S.map(x=>[x.t,x.temp]), color:'#ffb547' }], { lines:[{ y:60, color:'#ff5c5c' }], xlabel:'pack °C' });
  }
  function renderReport(r){
    if (!r){ $('#report').innerHTML = ''; return; }
    const tag = p => `<span class="tag ${p==='pass'?'ok':p==='warn'?'warn':'bad'}">${p}</span>`;
    $('#report').innerHTML = `<h3>Stress test report</h3><div class="verdict ${r.score>=85?'go':r.score>=55?'caution':'nogo'}" style="padding:12px 14px"><div class="big" style="font-size:24px">${r.score}</div><div class="small muted">${esc(scenario.name)} · ${fmtT(r.flightTime)} · ${fmt(r.energyUsed,1)} kWh used</div></div>
      <table style="margin-top:10px">${r.crit.map(c=>`<tr><td>${c.k}<div class="dim small">${c.v}</div></td><td class="num">${tag(c.pass)}</td></tr>`).join('')}</table>
      <h3>AI design advisor</h3><div class="ai-brief small">${r.advice.map(a=>`<p style="margin:0 0 8px">${esc(a)}</p>`).join('')}</div>
      <h3>Event log</h3><ul class="list-plain small">${r.events.map(e=>`<li><span class="mono dim">${fmtT(e.t)}</span><span class="${e.sev==='bad'?'c-bad':e.sev==='ok'?'c-ok':''}">${esc(e.msg)}</span></li>`).join('')}</ul>
      <div class="row gap" style="margin-top:10px"><button class="btn btn-ghost btn-sm grow" id="askSim">Ask copilot</button><button class="btn btn-ghost btn-sm grow" id="dlSim">Export</button></div>`;
    $('#askSim').onclick = () => openCopilot('Explain my last simulation result and how to improve the design', true);
    $('#dlSim').onclick = () => { const b = new Blob([JSON.stringify({ spec, env, scenario:scenario.name, report:r, samples:sim.samples }, null, 2)], { type:'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'flywave-sim-report.json'; a.click(); };
  }
  function onFinish(){
    const r = sim.report(); renderReport(r); charts();
    session.sim = { spec:spec.name, scenario:scenario.name, env, ...r };
    store.set('lastSim', { spec:spec.name, scenario:scenario.name, score:r.score, outcome:r.outcome, crit:r.crit, advice:r.advice });
    addLog({ type:'sim', title:`${spec.name} · ${scenario.name}`, score:r.score, outcome:r.outcome });
    running = false; $('#run').textContent = 'Run again';
  }
  $('#campaign').onclick = async () => {
    $('#campOut').innerHTML = '<p class="muted small">Running all scenarios headless…</p>'; await new Promise(r=>setTimeout(r,30));
    const rows = SCENARIOS.map(s => ({ s, r: runHeadless(spec, s.env, { distanceKm, reserveMin }) }));
    const cell = p => `<td class="num"><span style="display:inline-block;width:10px;height:10px;background:${p==='pass'?'var(--green)':p==='warn'?'var(--amber)':'var(--red)'}"></span></td>`;
    $('#campOut').innerHTML = `<h3>Stress envelope · ${esc(spec.name)}</h3><div style="overflow-x:auto"><table class="small"><tr><th>Scenario</th><th class="num">Score</th>${['Mis','MTOW','Res','T/W','g','°C','TD','Dev'].map(h=>`<th class="num">${h}</th>`).join('')}</tr>${rows.map(({s,r})=>`<tr><td>${esc(s.name)}</td><td class="num">${r.score}</td>${r.crit.map(c=>cell(c.pass)).join('')}</tr>`).join('')}</table></div>
      <p class="small muted">Envelope score: <b>${Math.round(rows.reduce((a,x)=>a+x.r.score,0)/rows.length)}</b>/100. Weakest: ${esc(rows.slice().sort((a,b)=>a.r.score-b.r.score)[0].s.name)}.</p>`;
    store.set('lastCampaign', { spec:spec.name, rows: rows.map(({s,r})=>({ scenario:s.name, score:r.score, fails:r.crit.filter(c=>c.pass==='fail').map(c=>c.k) })) });
  };

  // ---------- loop ----------
  function resize(){ const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w,h); composer.setSize(w,h); bloom.setSize(w,h); camera.aspect = w/h; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(resize); ro.observe(stage);
  const camPos = new THREE.Vector3(-30, 12, 18), tmp = new THREE.Vector3();
  let raf, last = performance.now(), lightningT = 0;
  function frame(now){
    const dt = Math.min(0.05, (now-last)/1000), simDt = Math.min(0.25, (now-last)/1000); last = now;
    if (running && !sim.done){
      const w = warp===20 ? (sim.phase==='CRUISE' ? 20 : 1.5) : warp;
      const steps = Math.ceil(w*simDt/0.02); for (let i=0;i<steps && !sim.done;i++) sim.step(w*simDt/steps);
      if (sim.done) onFinish();
      if (now - lastChart > 1000){ charts(); lastChart = now; }
    }
    placeAircraft();
    const cruise = sim.wl; const pwr = sim.phase==='PREFLIGHT' ? (running?0.3:0.0) : sim.phase==='LANDED' ? 0 : 1;
    ac.rotors.forEach((r,i) => { if (sim.rotorHealth[i] !== undefined){ r.failed = sim.rotorHealth[i] === 0; r.health = Math.max(0.3, sim.rotorHealth[i]); } });
    ac.setTilt(sim.tilt); ac.update(dt, pwr, cruise);
    const p = ac.object.position;
    if (sim.x > trailPts.length*8 && sim.phase!=='PREFLIGHT'){ trailPts.push(p.clone()); if (trailPts.length > 2000) trailPts.shift(); trail.geometry.setFromPoints(trailPts); }
    // camera
    const L = Math.max(spec.length, spec.wingspan);
    if (camMode==='chase'){ tmp.set(p.x - L*2.6, p.y + L*0.8, p.z + L*1.3); if (camPos.distanceTo(tmp) > L*6) camPos.copy(tmp); else camPos.lerp(tmp, 1-Math.pow(0.002, dt)); camera.position.copy(camPos); camera.lookAt(p.x + L*0.5, p.y, p.z); }
    else if (camMode==='orbit'){ controls.target.copy(p); if (camera.position.distanceTo(p) > L*20) camera.position.set(p.x-L*3, p.y+L, p.z+L*3); controls.update(); }
    else if (camMode==='pilot'){ camera.position.set(p.x + L*0.35, p.y + 1.6, p.z); camera.lookAt(p.x + 200, p.y - 20 - sim.vy*4, p.z); }
    else { cineT += dt; const k = Math.floor(cineT/7)%3; if (k===0) { camera.position.set(p.x + 60, Math.max(groundAt(p.x+60,-25)+2, 3), -25); } else if (k===1){ camera.position.set(p.x + Math.sin(cineT*0.3)*L*4, p.y + L*0.4, p.z + Math.cos(cineT*0.3)*L*4); } else { camera.position.set(p.x - L*0.2, p.y + L*5, p.z + L*0.6); } camera.lookAt(p); }
    sun.position.copy(p).addScaledVector(sunDir, 600); sun.target.position.copy(p);
    rain.position.set(camera.position.x, camera.position.y - 60, camera.position.z);
    if (rain.visible){ const ra = rain.geometry.attributes.position.array; const fall = (30 + env.rain*0.3)*dt, drift = env.wind*0.25*dt; for (let i=0;i<ra.length;i+=6){ ra[i+1]-=fall; ra[i+4]-=fall; ra[i]+=drift; ra[i+3]+=drift; if (ra[i+1] < 0){ ra[i+1]+=120; ra[i+4]+=120; } if (ra[i] > 80){ ra[i]-=160; ra[i+3]-=160; } } rain.geometry.attributes.position.needsUpdate = true; }
    // downwash dust near ground
    const low = sim.y < 25 && pwr > 0.2; dust.position.set(p.x, groundAt(p.x,p.z), p.z); dust.material.opacity = env.dust ? 0.5 : low && sim.y > 0.5 ? 0.22*(1 - sim.y/25) : 0; dust.rotation.y += dt*(low?2:0.2);
    if (env.lightning){ lightningT -= dt; if (lightningT < 0){ flash.intensity = 6; lightningT = 3 + Math.random()*6; } flash.intensity *= Math.pow(0.001, dt); }
    padLights.forEach((l,i) => l.visible = Math.floor(now/120 + i) % 20 !== 0);
    composer.render(); hud(); raf = requestAnimationFrame(frame);
  }

  buildWorld(); renderSpec(); renderScen(); renderEnv(); newSim(); rebuildAircraft(); applyEnv(); resize();
  raf = requestAnimationFrame(frame);
  return { destroy(){ cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); scene.traverse(o => { o.geometry?.dispose?.(); }); scene.remove(rain, dust); } };
}
