// Candidate vertiport / heliport sites (indicative coordinates).
export const PLACES = [
  { id:'bkc', name:'Mumbai — BKC', lat:19.0660, lon:72.8680, city:'Mumbai' },
  { id:'juhu', name:'Mumbai — Juhu Aerodrome', lat:19.0981, lon:72.8342, city:'Mumbai' },
  { id:'nmia', name:'Navi Mumbai Intl Airport', lat:18.9920, lon:73.0700, city:'Mumbai' },
  { id:'pune', name:'Pune — Hinjewadi', lat:18.5913, lon:73.7389, city:'Pune' },
  { id:'lonavala', name:'Lonavala', lat:18.7546, lon:73.4062, city:'Lonavala' },
  { id:'cp', name:'New Delhi — Sarai Kale Khan', lat:28.5890, lon:77.2560, city:'Delhi' },
  { id:'igi', name:'Delhi — IGI Airport', lat:28.5562, lon:77.1000, city:'Delhi' },
  { id:'cyber', name:'Gurugram — Cyber City', lat:28.4950, lon:77.0890, city:'Gurugram' },
  { id:'noida', name:'Noida — Sector 62', lat:28.6270, lon:77.3650, city:'Noida' },
  { id:'jewar', name:'Noida Intl Airport (Jewar)', lat:28.1700, lon:77.6100, city:'Jewar' },
  { id:'blr', name:'Bengaluru — Kempegowda Airport', lat:13.1986, lon:77.7066, city:'Bengaluru' },
  { id:'ecity', name:'Bengaluru — Electronic City', lat:12.8452, lon:77.6602, city:'Bengaluru' },
  { id:'whitefield', name:'Bengaluru — Whitefield', lat:12.9698, lon:77.7500, city:'Bengaluru' },
  { id:'mysuru', name:'Mysuru', lat:12.2958, lon:76.6394, city:'Mysuru' },
  { id:'hitec', name:'Hyderabad — HITEC City', lat:17.4435, lon:78.3772, city:'Hyderabad' },
  { id:'rgia', name:'Hyderabad — RGI Airport', lat:17.2403, lon:78.4294, city:'Hyderabad' },
  { id:'chennai', name:'Chennai — Guindy', lat:13.0067, lon:80.2206, city:'Chennai' },
  { id:'mahab', name:'Mahabalipuram', lat:12.6208, lon:80.1945, city:'Mahabalipuram' },
  { id:'kolkata', name:'Kolkata — Salt Lake', lat:22.5800, lon:88.4170, city:'Kolkata' },
  { id:'goa_n', name:'Goa — Mopa Airport', lat:15.7300, lon:73.8650, city:'Goa' },
  { id:'panaji', name:'Goa — Panaji', lat:15.4909, lon:73.8278, city:'Goa' },
  { id:'ahd', name:'Ahmedabad — GIFT City', lat:23.1600, lon:72.6800, city:'Gandhinagar' },
  { id:'agra', name:'Agra', lat:27.1767, lon:78.0081, city:'Agra' },
  { id:'jaipur', name:'Jaipur', lat:26.9124, lon:75.7873, city:'Jaipur' },
  { id:'kochi', name:'Kochi', lat:9.9312, lon:76.2673, city:'Kochi' },
  { id:'shimla', name:'Shimla', lat:31.1048, lon:77.1734, city:'Shimla' },
  { id:'chandigarh', name:'Chandigarh', lat:30.7333, lon:76.7794, city:'Chandigarh' },
  { id:'nashik', name:'Nashik', lat:19.9975, lon:73.7898, city:'Nashik' },
  { id:'surat', name:'Surat', lat:21.1702, lon:72.8311, city:'Surat' },
  { id:'vadodara', name:'Vadodara', lat:22.3072, lon:73.1812, city:'Vadodara' },
  { id:'udaipur', name:'Udaipur', lat:24.5854, lon:73.7125, city:'Udaipur' },
  { id:'ajmer', name:'Ajmer', lat:26.4499, lon:74.6399, city:'Ajmer' },
  { id:'indore', name:'Indore', lat:22.7196, lon:75.8577, city:'Indore' },
  { id:'bhopal', name:'Bhopal', lat:23.2599, lon:77.4126, city:'Bhopal' },
  { id:'gwalior', name:'Gwalior', lat:26.2183, lon:78.1828, city:'Gwalior' },
  { id:'nagpur', name:'Nagpur', lat:21.1458, lon:79.0882, city:'Nagpur' },
  { id:'aurangabad', name:'Chhatrapati Sambhajinagar', lat:19.8762, lon:75.3433, city:'Aurangabad' },
  { id:'kolhapur', name:'Kolhapur', lat:16.7050, lon:74.2433, city:'Kolhapur' },
  { id:'hubli', name:'Hubballi', lat:15.3647, lon:75.1240, city:'Hubballi' },
  { id:'vellore', name:'Vellore', lat:12.9165, lon:79.1325, city:'Vellore' },
  { id:'vijayawada', name:'Vijayawada', lat:16.5062, lon:80.6480, city:'Vijayawada' },
  { id:'kurnool', name:'Kurnool', lat:15.8281, lon:78.0373, city:'Kurnool' },
  { id:'coimbatore', name:'Coimbatore', lat:11.0168, lon:76.9558, city:'Coimbatore' },
  { id:'lucknow', name:'Lucknow', lat:26.8467, lon:80.9462, city:'Lucknow' },
  { id:'dehradun', name:'Dehradun', lat:30.3165, lon:78.0322, city:'Dehradun' },
  { id:'bhubaneswar', name:'Bhubaneswar', lat:20.2961, lon:85.8245, city:'Bhubaneswar' },
];

// Indicative airspace — NOT a substitute for AIP ENR 5.1, Digital Sky maps or NOTAMs.
export const ZONES = [
  // type: P = prohibited, R = restricted/military, CTR = controlled airport zone
  { name:'VIP Area New Delhi (VI-P1, indicative)', type:'P', lat:28.6143, lon:77.1994, r:4.5 },
  { name:'BARC Trombay (indicative)', type:'P', lat:19.0170, lon:72.9160, r:3 },
  { name:'Tarapur Atomic Power Stn (indicative)', type:'P', lat:19.8310, lon:72.6560, r:5 },
  { name:'Kalpakkam (indicative)', type:'P', lat:12.5578, lon:80.1750, r:5 },
  { name:'Sriharikota SHAR (indicative)', type:'P', lat:13.7199, lon:80.2304, r:15 },
  { name:'Kudankulam NPP (indicative)', type:'P', lat:8.1700, lon:77.7120, r:5 },
  { name:'Taj Mahal (indicative)', type:'P', lat:27.1751, lon:78.0421, r:2 },
  { name:'Hindan AFS (indicative)', type:'R', lat:28.7077, lon:77.3589, r:8 },
  { name:'Yelahanka AFS (indicative)', type:'R', lat:13.1355, lon:77.6060, r:6 },
  { name:'Ambala AFS (indicative)', type:'R', lat:30.3681, lon:76.8169, r:8 },
  { name:'HAL Bengaluru (VOBG)', type:'R', lat:12.9500, lon:77.6680, r:5 },
  { name:'Delhi IGI CTR (VIDP)', type:'CTR', lat:28.5562, lon:77.1000, r:10 },
  { name:'Mumbai CSMIA CTR (VABB)', type:'CTR', lat:19.0896, lon:72.8656, r:9 },
  { name:'Bengaluru KIA CTR (VOBL)', type:'CTR', lat:13.1986, lon:77.7066, r:10 },
  { name:'Chennai CTR (VOMM)', type:'CTR', lat:12.9941, lon:80.1709, r:9 },
  { name:'Hyderabad RGIA CTR (VOHS)', type:'CTR', lat:17.2403, lon:78.4294, r:10 },
  { name:'Kolkata CTR (VECC)', type:'CTR', lat:22.6547, lon:88.4467, r:9 },
  { name:'Pune CTR (VAPO)', type:'CTR', lat:18.5821, lon:73.9197, r:8 },
  { name:'Goa Dabolim CTR (VOGO)', type:'CTR', lat:15.3808, lon:73.8314, r:8 },
  { name:'Ahmedabad CTR (VAAH)', type:'CTR', lat:23.0772, lon:72.6347, r:8 },
  { name:'Kochi CTR (VOCI)', type:'CTR', lat:10.1520, lon:76.4019, r:8 },
  { name:'Jaipur CTR (VIJP)', type:'CTR', lat:26.8242, lon:75.8122, r:8 },
  { name:'Navi Mumbai CTR (VANM)', type:'CTR', lat:18.9920, lon:73.0700, r:8 },
  { name:'Noida Jewar CTR (VIDX)', type:'CTR', lat:28.1700, lon:77.6100, r:8 },
  { name:'Chandigarh CTR (VICG)', type:'CTR', lat:30.6735, lon:76.7885, r:8 },
];

const R = 6371;
const rad = d => d*Math.PI/180, deg = r => r*180/Math.PI;
export function dist(a,b){
  const dLat = rad(b.lat-a.lat), dLon = rad(b.lon-a.lon);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
export function bearing(a,b){
  const y = Math.sin(rad(b.lon-a.lon))*Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat))*Math.sin(rad(b.lat)) - Math.sin(rad(a.lat))*Math.cos(rad(b.lat))*Math.cos(rad(b.lon-a.lon));
  return (deg(Math.atan2(y,x))+360)%360;
}
export function lerp(a,b,t){ return { lat:a.lat+(b.lat-a.lat)*t, lon:a.lon+(b.lon-a.lon)*t }; }
// local equirectangular projection around a reference, km
function toXY(p, ref){ return { x: rad(p.lon-ref.lon)*R*Math.cos(rad(ref.lat)), y: rad(p.lat-ref.lat)*R }; }
function fromXY(q, ref){ return { lat: ref.lat + deg(q.y/R), lon: ref.lon + deg(q.x/(R*Math.cos(rad(ref.lat)))) }; }

export function segZone(a,b,z){
  const A = toXY(a,z), B = toXY(b,z);
  const dx=B.x-A.x, dy=B.y-A.y, L2 = dx*dx+dy*dy || 1e-9;
  let t = -(A.x*dx+A.y*dy)/L2; t = Math.max(0,Math.min(1,t));
  const P = { x:A.x+dx*t, y:A.y+dy*t };
  return { d: Math.hypot(P.x,P.y), t, P, A, B };
}
export function inZone(p,z){ return dist(p,z) <= z.r; }

// Build a route that skirts prohibited/restricted zones; CTRs are flagged (ATC clearance), not avoided.
export function buildRoute(from, to, zones = ZONES){
  let pts = [from, to];
  const avoid = zones.filter(z => (z.type==='P' || z.type==='R') && !inZone(from,z) && !inZone(to,z));
  for (let iter=0; iter<8; iter++){
    let changed = false;
    for (let i=0;i<pts.length-1;i++){
      for (const z of avoid){
        const s = segZone(pts[i], pts[i+1], z);
        if (s.d < z.r*1.08 && s.t>0 && s.t<1){
          let nx = s.P.x, ny = s.P.y, n = Math.hypot(nx,ny);
          if (n < 1e-6){ const dx=s.B.x-s.A.x, dy=s.B.y-s.A.y, l=Math.hypot(dx,dy); nx=-dy/l; ny=dx/l; n=1; }
          const k = (z.r*1.35)/n;
          const wp = fromXY({x:nx*k, y:ny*k}, z);
          wp.name = 'AVOID '+z.name.split(' (')[0];
          pts.splice(i+1,0,wp); changed = true; break;
        }
      }
      if (changed) break;
    }
    if (!changed) break;
  }
  const crossings = [];
  for (const z of zones){
    let hit = inZone(from,z) || inZone(to,z);
    for (let i=0;i<pts.length-1 && !hit;i++){ if (segZone(pts[i],pts[i+1],z).d < z.r) hit = true; }
    if (hit) crossings.push(z);
  }
  return { pts, crossings };
}
export function routeLength(pts){ let d=0; for(let i=0;i<pts.length-1;i++) d+=dist(pts[i],pts[i+1]); return d; }
export function nearestPlace(p, exclude=[]){
  let best=null, bd=1e9;
  for (const pl of PLACES){ if (exclude.includes(pl.id)) continue; const d=dist(p,pl); if(d<bd){bd=d;best=pl;} }
  return { place:best, d:bd };
}
