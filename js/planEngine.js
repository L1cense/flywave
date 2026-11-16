import { PLACES, ZONES, dist, bearing, lerp, buildRoute, routeLength } from './data/geo.js';
import { derive } from './data/aircraft.js';

const KT = 1.852;
const STORM = [95,96,99], HEAVY = [65,82,67,75,86];
export const WMO = { 0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Drizzle',53:'Drizzle',55:'Dense drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',80:'Showers',81:'Showers',82:'Violent showers',95:'Thunderstorm',96:'Thunderstorm + hail',99:'Thunderstorm + hail' };

async function getJSON(url, ms=9000){
  const c = new AbortController(); const h = setTimeout(()=>c.abort(), ms);
  try { const r = await fetch(url, { signal:c.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(h); }
}

export async function fetchWeather(points){
  const lat = points.map(p=>p.lat.toFixed(4)).join(','), lon = points.map(p=>p.lon.toFixed(4)).join(',');
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,wind_speed_80m,wind_direction_80m,visibility,cloud_cover_low,precipitation,weather_code&daily=sunrise,sunset&forecast_days=3&wind_speed_unit=kn&timezone=Asia%2FKolkata`;
  try { const j = await getJSON(u); return { live:true, data: Array.isArray(j) ? j : [j] }; }
  catch { return { live:false, data: points.map(()=>null) }; }
}
export async function fetchElevations(points){
  try {
    const j = await getJSON(`https://api.open-meteo.com/v1/elevation?latitude=${points.map(p=>p.lat.toFixed(4)).join(',')}&longitude=${points.map(p=>p.lon.toFixed(4)).join(',')}`);
    return j.elevation;
  } catch { return points.map(()=>0); }
}
export async function geocode(q){
  const local = PLACES.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  if (local.length) return local.map(p=>({ ...p }));
  try {
    const j = await getJSON(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`, 6000);
    return j.map(r => ({ id:'geo'+r.place_id, name:r.display_name.split(',').slice(0,2).join(','), lat:+r.lat, lon:+r.lon }));
  } catch { return []; }
}

function hourIndex(series, t){
  if (!series?.hourly) return -1;
  const target = t.getTime(); let best = 0, bd = Infinity;
  series.hourly.time.forEach((s,i) => { const d = Math.abs(new Date(s+':00+05:30').getTime() - target); if (d<bd){bd=d;best=i;} });
  return best;
}
function wxAt(series, t){
  const i = hourIndex(series, t);
  if (i < 0) return { synthetic:true, temp:30, wind10:8, dir10:270, gust:14, wind80:12, dir80:270, vis:10, cloudLow:20, precip:0, code:1 };
  const h = series.hourly;
  return { temp:h.temperature_2m[i], wind10:h.wind_speed_10m[i], dir10:h.wind_direction_10m[i], gust:h.wind_gusts_10m[i], wind80:h.wind_speed_80m[i] ?? h.wind_speed_10m[i]*1.3, dir80:h.wind_direction_80m[i] ?? h.wind_direction_10m[i], vis:(h.visibility[i]??10000)/1000, cloudLow:h.cloud_cover_low[i], precip:h.precipitation[i], code:h.weather_code[i], time:h.time[i] };
}
function sunTimes(series, t){
  if (!series?.daily) return null;
  const day = t.toLocaleDateString('en-CA', { timeZone:'Asia/Kolkata' });
  const i = series.daily.time.indexOf(day); if (i<0) return null;
  return { sunrise:new Date(series.daily.sunrise[i]+':00+05:30'), sunset:new Date(series.daily.sunset[i]+':00+05:30') };
}
function windTriangle(tc, tasKt, wDir, wKt){
  const rad = Math.PI/180, wa = (wDir - tc)*rad;
  const xw = wKt*Math.sin(wa), hw = wKt*Math.cos(wa);
  const wca = Math.asin(Math.max(-1,Math.min(1, xw/tasKt)))/rad;
  const gs = tasKt*Math.cos(wca*rad) - hw;
  return { wca, gs:Math.max(20, gs), hw, xw };
}
function densityRatio(elevM, tempC){
  const p = 101325*Math.pow(1-2.25577e-5*elevM, 5.25588), rho = p/(287.05*(tempC+273.15));
  return rho/1.225;
}
function battDerate(tempC){ if (tempC < 0) return 0.78; if (tempC < 10) return 0.88; if (tempC > 45) return 0.9; return 1; }

function sectorEnergyRough(d, ac, D){ return D.cruiseKW*(d/ac.cruiseKmh) + D.hoverKW*(150/3600); }

// Insert charging stops at known vertiport sites when the direct leg exceeds usable energy
export function chargingStops(from, to, ac, opts){
  const D = derive(ac); const usable = D.usableKWh*(opts.soh/100)*(opts.startSoc/100) - D.cruiseKW*(opts.reserveMin/60);
  const stops = []; let cur = from, guard = 0;
  while (sectorEnergyRough(routeLength(buildRoute(cur,to).pts), ac, D)*1.12 > usable && guard++ < 12){
    const cands = PLACES.filter(p => p.id !== cur.id && dist(p,to) < dist(cur,to) - 5)
      .map(p => ({ p, e: sectorEnergyRough(dist(cur,p)*1.08, ac, D)*1.12 }))
      .filter(c => c.e <= usable)
      .sort((a,b) => dist(a.p,to) - dist(b.p,to));
    if (!cands.length) return { stops, feasible:false };
    stops.push(cands[0].p); cur = cands[0].p;
  }
  return { stops, feasible: true };
}

export async function computePlan(input){
  const { from, to, ac, dep, payload, altFt, reserveMin, soh, startSoc } = input;
  const D = derive(ac);
  const cs = chargingStops(from, to, ac, { soh, startSoc:100, reserveMin });
  const nodes = [from, ...cs.stops, to];
  const sectors = []; const crossings = new Map();
  for (let i=0;i<nodes.length-1;i++){ const r = buildRoute(nodes[i], nodes[i+1]); sectors.push(r); r.crossings.forEach(z=>crossings.set(z.name,z)); }
  const allPts = []; sectors.forEach((s,i) => s.pts.forEach((p,j) => { if (i>0 && j===0) return; allPts.push(p); }));

  // sample points for weather & terrain
  const wxPts = []; sectors.forEach(s => { for (let i=0;i<s.pts.length-1;i++) wxPts.push(lerp(s.pts[i], s.pts[i+1], 0.5)); });
  const wxQuery = [from, to, ...wxPts].slice(0, 12);
  const prof = []; const total = sectors.reduce((s,x)=>s+routeLength(x.pts),0);
  for (let k=0;k<=48;k++){ // walk route by distance
    let target = total*k/48, acc = 0;
    outer: for (const s of sectors) for (let i=0;i<s.pts.length-1;i++){ const d = dist(s.pts[i], s.pts[i+1]); if (acc + d >= target){ prof.push({ ...lerp(s.pts[i], s.pts[i+1], d? (target-acc)/d : 0), km:target }); break outer; } acc += d; }
    if (prof.length < k+1) prof.push({ ...to, km: total });
  }
  const [wx, elev] = await Promise.all([fetchWeather(wxQuery), fetchElevations(prof)]);
  prof.forEach((p,i) => p.elev = elev[i] ?? 0);
  const maxElevFt = Math.max(...prof.map(p=>p.elev))*3.281;
  const minSafeFt = Math.ceil((maxElevFt + 1000)/100)*100;
  const cruiseFt = Math.max(altFt, minSafeFt);

  const wOrigin = wxAt(wx.data[0], dep);
  const massRatio = (ac.emptyMass + payload)/ac.mtow;
  const sigmaDep = densityRatio((prof[0].elev||0), wOrigin.temp);
  const hoverKW = D.hoverKW * Math.pow(massRatio,1.5) / Math.sqrt(sigmaDep);
  const tasKt = ac.cruiseKmh/KT;
  const legs = []; let t = new Date(dep.getTime() + 90*1000), wxIdx = 0, energy = 0, soc = startSoc;
  const usableTotal = D.usableKWh*(soh/100)*battDerate(wOrigin.temp);
  const legRows = [];
  sectors.forEach((s, si) => {
    let secEnergy = hoverKW*(150/3600);
    if (si === 0 || true){ energy += hoverKW*(60/3600); }
    for (let i=0;i<s.pts.length-1;i++){
      const a = s.pts[i], b = s.pts[i+1], d = dist(a,b), tc = bearing(a,b);
      const w = wxAt(wx.data[2 + wxIdx] ?? wx.data[0], t); wxIdx++;
      const tri = windTriangle(tc, tasKt, w.dir80, w.wind80);
      const hrs = d/(tri.gs*KT);
      const rainPen = w.precip > 0.5 ? 1.05 : 1, tempPen = w.temp > 38 ? 1.04 : 1;
      const kwh = D.cruiseKW*massRatio*rainPen*tempPen*hrs;
      energy += kwh; secEnergy += kwh; t = new Date(t.getTime() + hrs*3600e3);
      soc = startSoc - energy/usableTotal*100;
      legRows.push({ sector:si, from:a.name||'WP', to:b.name||'WP', a, b, d, tc, wca:tri.wca, th:(tc+tri.wca+360)%360, gs:tri.gs, hw:tri.hw, min:hrs*60, kwh, soc, wx:w });
    }
    energy += hoverKW*(90/3600); t = new Date(t.getTime() + 90*1000);
    legs.push({ from:s.pts[0], to:s.pts.at(-1), energy:secEnergy });
    if (si < sectors.length-1){ // recharge at stop
      t = new Date(t.getTime() + 25*60e3); energy = 0; soc = startSoc;
    }
  });
  const eta = t;
  const reserveKWh = D.cruiseKW*massRatio*(reserveMin/60);
  const lastSector = legs.at(-1);
  const sectorMax = Math.max(...legs.map(l=>l.energy));
  const required = sectorMax + reserveKWh;
  const available = usableTotal*(startSoc/100);
  const arrivalSoc = startSoc - (lastSector.energy/usableTotal*100);
  const reserveSoc = reserveKWh/usableTotal*100;

  // checks
  const findings = [];
  const add = (sev, area, msg) => findings.push({ sev, area, msg });
  const wxPoints = wx.data.map((s,i) => ({ s, w: wxAt(s, i===1 ? eta : dep), label: i===0 ? 'Departure' : i===1 ? 'Destination' : 'Enroute '+(i-1), p: wxQuery[i] }));
  wxPoints.forEach(({w,label}) => {
    if (w.vis < 5) add('nogo','Weather',`${label}: visibility ${w.vis.toFixed(1)} km below VFR minimum of 5 km`);
    if (STORM.includes(w.code)) add('nogo','Weather',`${label}: thunderstorm forecast — do not fly`);
    if (w.gust > ac.maxWindKt) add('nogo','Weather',`${label}: gusts ${Math.round(w.gust)} kt exceed aircraft limit ${ac.maxWindKt} kt`);
    else if (w.gust > ac.maxWindKt*0.75) add('caution','Weather',`${label}: gusts ${Math.round(w.gust)} kt — within 25% of the ${ac.maxWindKt} kt limit`);
    if (HEAVY.includes(w.code) || w.precip > 6) add('nogo','Weather',`${label}: heavy precipitation (${w.precip} mm/h)`);
    else if (w.precip > 0.5) add('caution','Weather',`${label}: rain ${w.precip} mm/h — reduced visibility and ~5% energy penalty`);
    if (w.cloudLow > 85) add('caution','Weather',`${label}: low cloud cover ${w.cloudLow}% — verify ceiling ≥ 1500 ft`);
    if (w.temp > 40) add('caution','Battery',`${label}: ${Math.round(w.temp)} °C — monitor pack temperature, reduced hover margin`);
    if (w.temp < 5) add('caution','Battery',`${label}: ${Math.round(w.temp)} °C — cold battery capacity derate`);
  });
  if (!wx.live) add('caution','Weather','Live weather unavailable — using placeholder values. Obtain an official MET briefing.');
  const sun = sunTimes(wx.data[0], dep);
  if (sun){
    if (dep < sun.sunrise || eta > new Date(sun.sunset.getTime())) add('nogo','Daylight',`Flight is outside daylight (${sun.sunrise.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})}–${sun.sunset.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})} IST). Day VFR only.`);
    else if (eta > new Date(sun.sunset.getTime()-30*60e3)) add('caution','Daylight','Arrival within 30 min of sunset');
  }
  if (!cs.feasible) add('nogo','Energy','No charging stop chain found within range — choose a closer destination or larger battery.');
  if (required > available) add('nogo','Energy',`Sector energy ${required.toFixed(1)} kWh (incl. ${reserveMin}-min reserve) exceeds available ${available.toFixed(1)} kWh`);
  else if (required > available*0.9) add('caution','Energy','Energy margin under 10% beyond reserve');
  if (cs.stops.length) add('info','Energy',`${cs.stops.length} charging stop(s) inserted: ${cs.stops.map(s=>s.name).join(', ')} (≈25 min DC fast charge each)`);
  if (payload > ac.payload) add('nogo','Weight',`Payload ${payload} kg exceeds max ${ac.payload} kg`);
  const crossList = [...crossings.values()];
  crossList.forEach(z => {
    if (z.type==='P') add('nogo','Airspace',`Origin/destination inside prohibited area: ${z.name}`);
    else if (z.type==='R') add('caution','Airspace',`Route touches restricted/military area ${z.name} — prior permission required`);
    else add('caution','Airspace',`Transits ${z.name} — ATC clearance and two-way RT required`);
  });
  const detours = allPts.filter(p=>p.name?.startsWith('AVOID')).length;
  if (detours) add('info','Airspace',`${detours} avoidance waypoint(s) added to stay clear of prohibited/restricted areas`);
  if (cruiseFt > altFt) add('info','Terrain',`Cruise raised to ${cruiseFt} ft to keep 1000 ft above highest terrain (${Math.round(maxElevFt)} ft)`);
  if (cruiseFt > ac.ceilingFt) add('nogo','Terrain',`Required altitude ${cruiseFt} ft exceeds service ceiling ${ac.ceilingFt} ft`);
  if (sigmaDep < 0.85) add('caution','Performance',`High density altitude at departure (σ = ${sigmaDep.toFixed(2)}) — hover power +${Math.round((1/Math.sqrt(sigmaDep)-1)*100)}%`);
  const month = dep.getMonth(); if (month>=5 && month<=8) add('info','Season','South-west monsoon season — expect rapidly changing weather; carry diversion options.');
  if ((month===11||month<=1) && from.lat > 24) add('info','Season','Winter fog season in North India — morning visibility often below minima.');

  const score = Math.max(0, Math.min(100, 100 - findings.reduce((s,f)=> s + (f.sev==='nogo'?35:f.sev==='caution'?9:1), 0)));
  const verdict = findings.some(f=>f.sev==='nogo') ? 'nogo' : findings.some(f=>f.sev==='caution') ? 'caution' : 'go';
  const totalDist = legRows.reduce((s,l)=>s+l.d,0);
  const flightMin = legRows.reduce((s,l)=>s+l.min,0) + sectors.length*2.5;
  const directDist = dist(from,to);
  const maxRangeKm = Math.max(0, (D.usableKWh*(soh/100) - reserveKWh - hoverKW*150/3600) / (D.cruiseKW*massRatio) * ac.cruiseKmh);

  const plan = { id: Date.now(), input:{ ...input, from, to, dep:dep.toISOString() }, ac, derived:D, sectors, stops:cs.stops, allPts, legRows, prof, maxElevFt, minSafeFt, cruiseFt,
    wx:{ live:wx.live, points:wxPoints.map(x=>({ label:x.label, p:x.p, w:x.w })), sun, raw:wx.data }, findings, score, verdict, eta:eta.toISOString(),
    totalDist, directDist, flightMin, energyRequired:required, energyAvailable:available, reserveKWh, arrivalSoc, reserveSoc, hoverKW, massRatio, sigmaDep, maxRangeKm, crossings:crossList };
  plan.windows = bestWindows(plan); plan.fpl = buildFPL(plan); plan.brief = aiBrief(plan); plan.checklist = buildChecklist(plan);
  return plan;
}

function dm(v, pos, neg, degW){ const a = Math.abs(v), d = Math.floor(a), m = Math.round((a-d)*60); return String(d).padStart(degW,'0')+String(m===60?59:m).padStart(2,'0')+(v>=0?pos:neg); }
const coord = p => dm(p.lat,'N','S',2) + dm(p.lon,'E','W',3);
export function buildFPL(plan){
  const dep = new Date(plan.input.dep), utc = dep.toISOString().slice(11,16).replace(':','');
  const eet = Math.round(plan.flightMin), eetS = String(Math.floor(eet/60)).padStart(2,'0')+String(eet%60).padStart(2,'0');
  const spd = 'N'+String(Math.round(plan.ac.cruiseKmh/1.852)).padStart(4,'0');
  const lvl = 'A'+String(Math.round(plan.cruiseFt/100)).padStart(3,'0');
  const route = plan.allPts.slice(1,-1).map(p=>coord(p)).join(' DCT ');
  const date = dep.toISOString().slice(2,10).replace(/-/g,'');
  return `(FPL-VTFWV-VN\n-ZZZZ/L-SDFGRY/S\n-ZZZZ${utc}\n-${spd}${lvl} DCT${route? ' '+route+' DCT':''}\n-ZZZZ${eetS} ZZZZ\n-DEP/${coord(plan.input.from)} ${plan.input.from.name.toUpperCase().replace(/[^A-Z0-9 ]/g,'')} DEST/${coord(plan.input.to)} ${plan.input.to.name.toUpperCase().replace(/[^A-Z0-9 ]/g,'')} DOF/${date} TYP/${plan.ac.name.toUpperCase().replace(/[^A-Z0-9 ]/g,'')} EVTOL ALTN/${plan.stops[0] ? coord(plan.stops[0]) : 'NIL'} RMK/ELECTRIC VTOL FIC/____ ADC/____ ENDURANCE ${Math.round(plan.reserveKWh/plan.derived.cruiseKW*60 + plan.flightMin)}MIN)`;
}

export function buildChecklist(plan){
  const c = [
    'Obtain FIC and ADC numbers; insert in flight plan item 18',
    'File flight plan with AAI ≥ 60 min before EOBT',
    'Check NOTAMs for route, VIP movements and temporary restrictions',
    `Official MET briefing; confirm visibility ≥ 5 km and gusts < ${plan.ac.maxWindKt} kt`,
    `Departure SoC ≥ ${Math.min(100, Math.ceil(100 - plan.arrivalSoc + plan.reserveSoc + 5))}% (trip + ${plan.input.reserveMin}-min reserve + 5% margin)`,
    'Battery pack temperature 15–35 °C, no cell imbalance warnings',
    `Weight & balance: payload ${plan.input.payload} kg ≤ ${plan.ac.payload} kg`,
    'Pilot: medical valid, 3 landings in 90 days, breath-analyser test done',
  ];
  plan.crossings.filter(z=>z.type==='CTR').forEach(z => c.push(`ATC clearance for ${z.name}`));
  plan.crossings.filter(z=>z.type==='R').forEach(z => c.push(`Prior permission from controlling authority: ${z.name}`));
  plan.stops.forEach(s => c.push(`Confirm charger slot & availability at ${s.name}`));
  c.push('Brief diversion vertiport and lost-comms procedure (7600)');
  return c;
}

function bestWindows(plan){
  const raws = plan.wx.raw; if (!raws[0]?.hourly) return [];
  const start = new Date(); const out = [];
  for (let h=0; h<36; h++){
    const t = new Date(start.getTime() + h*3600e3);
    let risk = 0; let worst = null;
    [0,1,2].forEach(i => { const s = raws[i]; if (!s) return; const w = wxAt(s, t);
      risk += Math.max(0, w.gust - 10)*1.5 + Math.max(0, 5 - w.vis)*12 + w.precip*6 + (STORM.includes(w.code)?60:0) + Math.max(0,w.cloudLow-60)*0.2;
      worst = worst && worst.gust > w.gust ? worst : w; });
    const sun = sunTimes(raws[0], t); const day = sun ? (t > sun.sunrise && new Date(t.getTime()+plan.flightMin*60e3) < sun.sunset) : true;
    if (!day) risk += 100;
    out.push({ t, risk: Math.round(risk), day, gust: worst?.gust ?? 0 });
  }
  return out;
}

export function aiBrief(plan){
  const p = plan, i = p.input, f = p.findings;
  const nogo = f.filter(x=>x.sev==='nogo'), caut = f.filter(x=>x.sev==='caution');
  const wDep = p.wx.points[0]?.w, wDest = p.wx.points[1]?.w;
  const head = p.legRows.reduce((s,l)=>s+l.hw*l.d,0)/Math.max(1,p.totalDist);
  const lines = [];
  lines.push(`<b>${p.verdict==='go'?'GO':'' }${p.verdict==='caution'?'GO WITH CAUTION':''}${p.verdict==='nogo'?'NO-GO':''}</b> — ${i.from.name} → ${i.to.name} in the ${p.ac.name}, ${p.totalDist.toFixed(1)} km (${(p.totalDist/1.852).toFixed(0)} NM) over ${Math.round(p.flightMin)} min, risk score <b>${p.score}/100</b>.`);
  lines.push(`Route ${p.allPts.length>2 ? `uses ${p.allPts.length-2} intermediate waypoint(s)` : 'is direct'}${p.totalDist > p.directDist*1.02 ? `, ${((p.totalDist/p.directDist-1)*100).toFixed(0)}% longer than great-circle to respect airspace${p.stops.length?' and charging':''}`:''}. Cruise ${p.cruiseFt} ft; highest terrain ${Math.round(p.maxElevFt)} ft.`);
  if (wDep) lines.push(`Weather at departure: ${WMO[wDep.code]||'—'}, ${Math.round(wDep.temp)} °C, wind ${String(Math.round(wDep.dir10)).padStart(3,'0')}°/${Math.round(wDep.wind10)} kt gusting ${Math.round(wDep.gust)} kt, visibility ${wDep.vis>=10?'10+':wDep.vis.toFixed(1)} km. ${wDest?`At destination: ${WMO[wDest.code]||'—'}, gusts ${Math.round(wDest.gust)} kt.`:''} Average ${head>0?'headwind':'tailwind'} component ${Math.abs(head).toFixed(0)} kt.`);
  lines.push(`Energy: ${p.energyRequired.toFixed(1)} kWh needed for the longest sector incl. ${i.reserveMin}-min reserve vs ${p.energyAvailable.toFixed(1)} kWh available; expected arrival SoC <b>${p.arrivalSoc.toFixed(0)}%</b> (reserve ≈ ${p.reserveSoc.toFixed(0)}%).`);
  if (nogo.length) lines.push(`Blocking issues: ${nogo.map(x=>x.msg).join('; ')}.`);
  if (caut.length) lines.push(`Watch items: ${caut.slice(0,4).map(x=>x.msg).join('; ')}${caut.length>4?` (+${caut.length-4} more)`:''}.`);
  const best = (p.windows||[]).slice().sort((a,b)=>a.risk-b.risk)[0];
  if (best && p.verdict!=='go') lines.push(`Recommendation: the lowest-risk departure window in the next 36 h is around <b>${best.t.toLocaleString('en-IN',{weekday:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})} IST</b>.`);
  else if (p.verdict==='go') lines.push('Recommendation: proceed after filing the flight plan with FIC/ADC numbers and a final NOTAM check.');
  return lines;
}
