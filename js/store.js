const listeners = {};
export const bus = {
  on(ev, fn){ (listeners[ev] ||= []).push(fn); },
  emit(ev, data){ (listeners[ev]||[]).forEach(f=>f(data)); },
};
export const store = {
  get(k, d=null){ try{ const v = localStorage.getItem('fw.'+k); return v==null ? d : JSON.parse(v); }catch{ return d; } },
  set(k, v){ localStorage.setItem('fw.'+k, JSON.stringify(v)); bus.emit('store:'+k, v); },
};
export const session = { plan:null, sim:null };

export function toast(msg){
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 2600);
}
export const $ = (s, r=document) => r.querySelector(s);
export const $$ = (s, r=document) => [...r.querySelectorAll(s)];
export const fmt = (n, d=0) => Number(n).toLocaleString('en-IN', { maximumFractionDigits:d, minimumFractionDigits:d });
export const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function addLog(entry){
  const log = store.get('logbook', []);
  log.unshift({ id: Date.now(), date: new Date().toISOString(), ...entry });
  store.set('logbook', log.slice(0, 200));
}

// Minimal line chart for telemetry
export function lineChart(canvas, series, opts={}){
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = w*dpr; canvas.height = h*dpr;
  const c = canvas.getContext('2d'); c.scale(dpr,dpr); c.clearRect(0,0,w,h);
  const pad = { l:34, r:8, t:10, b:18 };
  const all = series.flatMap(s => s.data.map(p=>p[1]));
  const xs = series.flatMap(s => s.data.map(p=>p[0]));
  if (!all.length) return;
  let ymin = opts.min ?? Math.min(...all), ymax = opts.max ?? Math.max(...all);
  if (ymax - ymin < 1e-6){ ymax += 1; ymin -= 1; }
  const xmin = Math.min(...xs), xmax = Math.max(...xs) || 1;
  const X = x => pad.l + (x - xmin)/(xmax - xmin || 1)*(w-pad.l-pad.r);
  const Y = y => pad.t + (1-(y - ymin)/(ymax - ymin))*(h-pad.t-pad.b);
  c.strokeStyle = 'rgba(255,255,255,.08)'; c.fillStyle='rgba(255,255,255,.4)'; c.font = '10px JetBrains Mono, monospace'; c.lineWidth=1;
  for (let i=0;i<=3;i++){ const v = ymin + (ymax-ymin)*i/3, y=Y(v); c.beginPath(); c.moveTo(pad.l,y); c.lineTo(w-pad.r,y); c.stroke(); c.fillText(v.toFixed(Math.abs(ymax-ymin)<5?1:0), 2, y+3); }
  (opts.lines||[]).forEach(l => { c.strokeStyle = l.color; c.setLineDash([4,4]); c.beginPath(); c.moveTo(pad.l,Y(l.y)); c.lineTo(w-pad.r,Y(l.y)); c.stroke(); c.setLineDash([]); });
  series.forEach(s => {
    if (s.fill){
      const g = c.createLinearGradient(0,pad.t,0,h-pad.b); g.addColorStop(0, s.fill); g.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); s.data.forEach((p,i)=> i? c.lineTo(X(p[0]),Y(p[1])) : c.moveTo(X(p[0]),Y(p[1])));
      c.lineTo(X(s.data.at(-1)[0]), h-pad.b); c.lineTo(X(s.data[0][0]), h-pad.b); c.fill();
    }
    c.strokeStyle = s.color || '#fff'; c.lineWidth = 1.5; c.beginPath();
    s.data.forEach((p,i)=> i? c.lineTo(X(p[0]),Y(p[1])) : c.moveTo(X(p[0]),Y(p[1]))); c.stroke();
  });
  if (opts.xlabel){ c.fillStyle='rgba(255,255,255,.35)'; c.fillText(opts.xlabel, w-pad.r-c.measureText(opts.xlabel).width, h-4); }
}
