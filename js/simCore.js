import { derive } from './data/aircraft.js';

export const SCENARIOS = [
  { id:'nominal', name:'Nominal mission', desc:'Calm day, 30 °C, sea level', env:{ wind:5, gust:8, cross:30, temp:30, elev:10, rain:0, vis:10, payloadPct:80, failure:'none', tod:10 } },
  { id:'monsoon', name:'Monsoon storm', desc:'Mumbai July — heavy rain, 35 kt gusts, lightning', env:{ wind:20, gust:35, cross:60, temp:26, elev:10, rain:30, vis:3, payloadPct:80, failure:'none', tod:15, lightning:true } },
  { id:'crosswind', name:'Severe crosswind', desc:'25 kt beam wind gusting 32 kt', env:{ wind:25, gust:32, cross:90, temp:30, elev:10, rain:0, vis:10, payloadPct:80, failure:'none', tod:11 } },
  { id:'motor', name:'Lift unit failure', desc:'One motor fails during take-off', env:{ wind:8, gust:12, cross:30, temp:32, elev:10, rain:0, vis:10, payloadPct:90, failure:'motor', tod:9 } },
  { id:'bird', name:'Bird strike', desc:'Kite strike damages a rotor in cruise', env:{ wind:8, gust:12, cross:20, temp:30, elev:10, rain:0, vis:10, payloadPct:80, failure:'bird', tod:8 } },
  { id:'thermal', name:'Battery thermal runaway', desc:'Cell fault mid-cruise — emergency landing', env:{ wind:6, gust:10, cross:20, temp:35, elev:10, rain:0, vis:10, payloadPct:80, failure:'thermal', tod:13 } },
  { id:'hothigh', name:'Hot & high (Leh)', desc:'3256 m elevation, 32 °C', env:{ wind:12, gust:18, cross:40, temp:32, elev:3256, rain:0, vis:10, payloadPct:80, failure:'none', tod:12 } },
  { id:'dust', name:'Andhi dust storm', desc:'Rajasthan May — 42 °C, 40 kt gusts, 1.5 km vis', env:{ wind:26, gust:40, cross:70, temp:42, elev:250, rain:0, vis:1.5, payloadPct:80, failure:'none', tod:17, dust:true } },
  { id:'fog', name:'Winter fog, cold soak', desc:'Delhi January dawn — 4 °C, 800 m vis', env:{ wind:3, gust:5, cross:10, temp:4, elev:216, rain:0, vis:0.8, payloadPct:80, failure:'none', tod:7.5 } },
  { id:'overload', name:'Overweight take-off', desc:'Payload at 160% of max — above MTOW', env:{ wind:8, gust:12, cross:30, temp:34, elev:10, rain:0, vis:10, payloadPct:160, failure:'none', tod:10 } },
  { id:'night', name:'Night city ops', desc:'Urban night sortie, light winds', env:{ wind:6, gust:10, cross:20, temp:27, elev:10, rain:0, vis:8, payloadPct:80, failure:'none', tod:20.5 } },
];

const G = 9.80665, KT = 0.514444;
function randn(){ let u=0,v=0; while(!u) u=Math.random(); while(!v) v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
function sigmaOf(elev, temp){ const p = 101325*Math.pow(1-2.25577e-5*elev,5.25588); return (p/(287.05*(temp+273.15)))/1.225; }

export class SimCore {
  constructor(spec, env, opts={}){
    this.spec = spec; this.env = { ...env }; this.opts = { distanceKm:30, cruiseAlt:457, reserveMin:20, ...opts };
    this.D = derive(spec);
    this.payload = spec.payload * env.payloadPct/100;
    this.m = spec.emptyMass + this.payload;
    this.sigma = sigmaOf(env.elev, env.temp); this.rho = 1.225*this.sigma;
    const liftRotors = spec.rotors; this.nLift = liftRotors;
    this.rotorHealth = Array(liftRotors).fill(1);
    this.TmaxRotor = spec.twr * spec.mtow * G / liftRotors;
    this.A = this.D.diskArea;
    this.V = spec.cruiseKmh/3.6;
    this.chord = Math.max(0.9, spec.wingspan*0.085); this.S = spec.config==='multi' ? 0 : spec.wingspan*this.chord;
    const derate = env.temp < 0 ? 0.78 : env.temp < 10 ? 0.88 : env.temp > 45 ? 0.9 : 1;
    this.usable = this.D.usableKWh*derate; this.E = this.usable;
    this.reserveKWh = this.D.cruiseKW*(this.m/spec.mtow)*(this.opts.reserveMin/60);
    this.distance = this.opts.distanceKm*1000;
    Object.assign(this, { t:0, x:0, y:0, z:0, vx:0, vy:0, vz:0, phase:'PREFLIGHT', battT:Math.max(env.temp, 20), power:0, n:1, tilt:0, wl:0,
      gU:0, gW:0, gV:0, alerts:[], events:[], done:false, outcome:null, roll:0, pitch:0, yaw:0, thrustMargin:0, minMargin:99, maxN:1, maxT:0, maxDev:0, touchVy:0, failedAt:null, runaway:false, samples:[], lastSample:-1, emergency:false, energyUsed:0 });
    this.decel = 1.4;
  }
  get soc(){ return Math.max(0, this.E/this.usable*100); }
  get remaining(){ return this.distance - this.x; }
  hoverMargin(){
    const Tavail = this.rotorHealth.reduce((s,h)=>s+h,0)*this.TmaxRotor*this.sigma;
    const asym = this.rotorHealth.some(h=>h<1) ? 0.92 : 1;
    return Tavail*asym/(this.m*G);
  }
  event(msg, sev='info'){ this.events.push({ t:this.t, msg, sev }); }
  step(dt){
    if (this.done) return;
    const e = this.env, s = this.spec; this.t += dt;
    // turbulence (Ornstein-Uhlenbeck)
    const sig = Math.max(0.3, (e.gust - e.wind)/2.2)*KT, tau = 2.5;
    const k = Math.sqrt(2*dt/tau);
    this.gU += (-this.gU/tau)*dt + sig*k*randn();
    this.gV += (-this.gV/tau)*dt + sig*k*randn();
    this.gW += (-this.gW/tau)*dt + sig*0.6*k*randn();
    const crossRad = e.cross*Math.PI/180, windMs = e.wind*KT;
    const head = windMs*Math.cos(crossRad) + this.gU, cross = windMs*Math.sin(crossRad) + this.gV;
    const altFactor = Math.min(1, 0.4 + this.y/150);
    const headW = head*altFactor, crossW = cross*altFactor, vertW = this.gW*altFactor;

    // failures
    if (e.failure==='motor' && !this.failedAt && this.phase==='TAKEOFF' && this.y > 18){ this.rotorHealth[0] = 0; this.failedAt = this.t; this.event('Lift unit #1 failed — motor shutdown', 'bad'); this.roll += 0.35; }
    if (e.failure==='bird' && !this.failedAt && this.phase==='CRUISE' && this.x > this.distance*0.35){ this.rotorHealth[1 % this.nLift] = 0.35; this.failedAt = this.t; this.event('Bird strike — rotor #2 damaged (35% thrust)', 'bad'); this.roll -= 0.25; this.vy -= 2; }
    if (e.failure==='thermal' && !this.runaway && this.phase==='CRUISE' && this.x > this.distance*0.5){ this.runaway = true; this.failedAt = this.t; this.emergency = true; this.phase = 'EMERGENCY'; this.event('Battery thermal runaway detected — emergency landing', 'bad'); }

    const V = this.V, Vt = 0.35*V;
    const mgr = this.m*G; let targetVx = this.vx, targetVy = 0;
    switch(this.phase){
      case 'PREFLIGHT': if (this.t > 2){ this.phase='TAKEOFF'; this.event('Take-off clearance — vertical climb'); } break;
      case 'TAKEOFF': targetVy = this.y < 40 ? 3 : 0; if (this.y >= 40){ this.phase='TRANSITION'; this.event('Transition to wing-borne flight'); } break;
      case 'TRANSITION': targetVx = V; targetVy = this.y < this.opts.cruiseAlt ? 5 : 0; if (this.vx >= V*0.98 && this.y >= this.opts.cruiseAlt-5){ this.phase='CRUISE'; this.event('Cruise established'); } break;
      case 'CRUISE': { targetVx = V; targetVy = (this.opts.cruiseAlt - this.y)*0.2; const gs = Math.max(5, this.vx - headW); const need = (this.vx*this.vx)/(2*this.decel) + (this.y-50)/4*gs*0.0; if (this.remaining <= Math.max(need*1.15, 600) + (this.y-60)*gs/5 ){ this.phase='APPROACH'; this.event('Top of descent — approach'); } break; }
      case 'APPROACH': { const gs = Math.max(1, this.vx - headW); targetVx = Math.max(0, Math.min(V, Math.sqrt(Math.max(0, 2*this.decel*Math.max(0,this.remaining-30))))); const tToGo = Math.max(1, this.remaining/Math.max(5,gs)); targetVy = -Math.min(6, Math.max(0,(this.y-45))/tToGo*1.2); if (this.remaining < 40 && this.vx < 3){ this.phase='LANDING'; this.event('Hover — vertical descent'); } break; }
      case 'EMERGENCY': targetVx = 0; targetVy = this.vx > V*0.3 ? -4 : -Math.min(6, Math.max(1.2, this.y/12)); if (this.y < 0.3) this.touchdown(); break;
      case 'LANDING': targetVx = 0; targetVy = -Math.min(3, Math.max(0.6, this.y/12)); break;
    }
    // longitudinal
    const ax = Math.max(-2.5, Math.min(2.5, (targetVx - this.vx)*0.6));
    this.vx = Math.max(0, this.vx + ax*dt);
    // lift share
    this.wl = s.config==='multi' ? 0 : Math.max(0, Math.min(1, (this.vx - Vt)/(0.4*V)));
    this.tilt = s.config==='multi' ? 0 : Math.min(1, this.vx/(0.7*V));
    // vertical control
    const margin = this.hoverMargin(); this.thrustMargin = margin;
    const needRotor = 1 - this.wl;
    let ay = (targetVy - this.vy)*1.2;
    if (needRotor > 0.05 && this.phase!=='PREFLIGHT'){
      const maxUp = (margin/needRotor - 1)*G; // available climb accel from rotors
      ay = Math.min(ay, maxUp);
      if (needRotor > 0.5 && margin < 1.15) this.minMargin = Math.min(this.minMargin, margin);
      else if (needRotor > 0.5) this.minMargin = Math.min(this.minMargin, margin);
    }
    ay += vertW*0.35*(this.wl>0.5?1.6:1)/1;
    if (this.phase==='PREFLIGHT'){ ay = 0; this.vy = 0; }
    this.vy += ay*dt; this.y += this.vy*dt;
    // lateral: crosswind pushes, controller corrects (crab)
    const az = (crossW - this.vz)*(this.wl>0.5?0.15:0.9) - this.z*0.06 - this.vz*0.35;
    this.vz += az*dt; this.z += this.vz*dt*(this.phase==='PREFLIGHT'?0:1);
    if (this.phase==='PREFLIGHT') { this.z = 0; this.vz = 0; }
    const gs = this.phase==='PREFLIGHT' ? 0 : Math.max(0, this.vx - headW*this.wl);
    this.x += gs*dt; this.gs = gs; this.headW = headW; this.crossW = crossW;
    if (this.y <= 0 && this.phase!=='PREFLIGHT' && this.phase!=='TAKEOFF'){ this.y = 0; this.touchdown(); }
    if (this.y < 0) { this.y = 0; this.vy = Math.max(0,this.vy); }

    // load factor
    if (this.wl > 0.3 && this.S > 0){
      const WS = mgr/this.S; const dn = (this.rho*this.vx*vertW*5.0)/(2*WS);
      this.n = 1 + dn + ay/G;
    } else this.n = 1 + ay/G + vertW*0.05;
    this.maxN = Math.max(this.maxN, Math.abs(this.n));
    this.maxDev = Math.max(this.maxDev, Math.abs(this.z));

    // power
    const T = mgr*needRotor*(1 + Math.max(0,ay)/G);
    const healthy = this.rotorHealth.reduce((a,h)=>a+h,0)/this.nLift;
    const Pind = Math.pow(Math.max(0,T),1.5)/Math.sqrt(2*this.rho*this.A*Math.max(0.3,healthy))/0.7/1000;
    const Pcr = this.D.cruiseKW*(this.m/s.mtow)*(1+0.003*e.rain)*(this.vx/V)**1.2;
    const Pclimb = Math.max(0, mgr*this.vy)/0.8/1000;
    this.power = this.phase==='PREFLIGHT' ? 3 : Math.max(5, Pind*(needRotor>0.02?1:0) + Pcr*this.wl + (s.config==='multi'? Pcr*0.6*(this.vx/V) : 0) + Pclimb);
    const dE = this.power*dt/3600; this.E -= dE; this.energyUsed += dE;
    // battery thermal
    const C = this.power/s.batteryKWh;
    const cool = this.vx > 10 ? 0.006 : 0.003;
    let dT = 0.022*C*C*(this.env.temp < 10 ? 1.4 : 1) - cool*(this.battT - e.temp);
    if (this.runaway) dT += 0.55;
    this.battT += dT*dt; this.maxT = Math.max(this.maxT, this.battT);

    // attitude for visuals
    this.pitch = -this.tilt*0.05 - ax*0.04*(1-this.wl) + (this.wl>0.5? this.vy*0.01:0);
    this.roll += (-this.roll*1.5 + (crossW - this.vz)*0.02 + this.gV*0.01)*dt;
    this.yaw = Math.atan2(crossW, Math.max(5, this.vx))*this.wl*0.8;

    // alerts
    this.alerts = [];
    if (this.battT > 60) this.alerts.push(this.runaway ? 'BATTERY FIRE' : 'BATTERY TEMP HIGH');
    if (this.soc < 100*this.reserveKWh/this.usable && this.phase!=='LANDED') this.alerts.push('RESERVE ENERGY');
    if (margin < 1.05 && needRotor > 0.5 && this.phase!=='LANDED') this.alerts.push('THRUST MARGIN');
    if (this.n > s.loadLimit) this.alerts.push('OVERSTRESS');
    if (this.E <= 0){ this.E = 0; this.event('Battery depleted', 'bad'); this.phase = 'EMERGENCY'; this.rotorHealth = this.rotorHealth.map(()=>0.2); }
    if (this.battT > 140){ this.event('Pack temperature critical — cell venting', 'bad'); this.finish('lost'); }
    if (this.n > s.loadLimit*1.5){ this.event('Structural limit exceeded', 'bad'); this.finish('lost'); }

    if (this.t - this.lastSample >= 1){ this.lastSample = this.t; this.samples.push({ t:this.t, alt:this.y, spd:this.vx/KT, soc:this.soc, temp:this.battT, margin, n:this.n, power:this.power, dev:this.z, x:this.x }); }
    if (this.t > 7200) this.finish('timeout');
  }
  touchdown(){
    if (this.done) return;
    this.touchVy = Math.abs(this.vy); this.y = 0; this.vy = 0; this.vx = 0;
    const atDest = this.remaining < 120;
    this.event(`Touchdown ${this.touchVy.toFixed(1)} m/s ${atDest?'at destination':'off-site'}`, this.touchVy > 3 ? 'bad' : 'ok');
    this.phase = 'LANDED';
    this.finish(this.touchVy > 6 ? 'crash' : atDest ? 'landed' : 'forced');
  }
  finish(outcome){ this.done = true; this.outcome = outcome; this.samples.push({ t:this.t, alt:this.y, spd:this.vx/KT, soc:this.soc, temp:this.battT, margin:this.thrustMargin, n:this.n, power:this.power, dev:this.z, x:this.x }); }

  report(){
    const s = this.spec, reserveSoc = 100*this.reserveKWh/this.usable;
    const crit = [
      { k:'Mission completed', v: this.outcome==='landed' ? 'At destination' : { forced:'Forced landing', crash:'Crash', lost:'Aircraft lost', timeout:'Timeout' }[this.outcome] || '—', pass: this.outcome==='landed' ? 'pass' : this.outcome==='forced' && this.runaway ? 'warn' : 'fail' },
      { k:'Take-off mass vs MTOW', v:`${Math.round(this.m)} / ${s.mtow} kg`, pass: this.m <= s.mtow ? 'pass' : this.m <= s.mtow*1.05 ? 'warn' : 'fail' },
      { k:'Energy reserve at landing', v:`${this.soc.toFixed(1)}% (need ${reserveSoc.toFixed(1)}%)`, pass: this.soc >= reserveSoc ? 'pass' : this.soc >= reserveSoc*0.5 ? 'warn' : 'fail' },
      { k:'Min hover thrust margin', v:`${this.minMargin===99?'—':this.minMargin.toFixed(2)} T/W`, pass: this.minMargin >= 1.15 ? 'pass' : this.minMargin >= 1.0 ? 'warn' : 'fail' },
      { k:'Peak load factor', v:`${this.maxN.toFixed(2)} g (limit ${s.loadLimit} g)`, pass: this.maxN <= s.loadLimit*0.85 ? 'pass' : this.maxN <= s.loadLimit ? 'warn' : 'fail' },
      { k:'Peak battery temperature', v:`${this.maxT.toFixed(0)} °C`, pass: this.maxT <= 55 ? 'pass' : this.maxT <= 65 ? 'warn' : 'fail' },
      { k:'Touchdown vertical speed', v:`${this.touchVy.toFixed(2)} m/s`, pass: this.touchVy <= 1.5 ? 'pass' : this.touchVy <= 3 ? 'warn' : 'fail' },
      { k:'Max track deviation', v:`${this.maxDev.toFixed(0)} m`, pass: this.maxDev <= 30 ? 'pass' : this.maxDev <= 80 ? 'warn' : 'fail' },
    ];
    const score = Math.round(crit.reduce((a,c)=>a + (c.pass==='pass'?1:c.pass==='warn'?0.5:0), 0)/crit.length*100);
    return { crit, score, outcome:this.outcome, energyUsed:this.energyUsed, flightTime:this.t, events:this.events, advice:this.advise(crit, reserveSoc) };
  }
  advise(crit, reserveSoc){
    const s = this.spec, a = [];
    if (this.m > s.mtow) a.push(`Weight: take-off mass ${Math.round(this.m)} kg exceeds MTOW ${s.mtow} kg by ${Math.round(this.m-s.mtow)} kg — not airworthy under the approved flight manual even if the aircraft can lift it.`);
    if (this.soc < reserveSoc){ const need = (reserveSoc - this.soc)/100*this.usable; a.push(`Energy: add ≈${Math.ceil(need*1.1)} kWh of usable battery (~${Math.ceil(need*1.1/0.25)} kg at 250 Wh/kg pack level) or cut mission length to ≈${Math.floor(this.opts.distanceKm*(1-(reserveSoc-this.soc)/100*1.2))} km.`); }
    if (this.minMargin < 1.15){ const needTW = 1.15/Math.max(0.1,this.minMargin)*s.twr; a.push(`Thrust: raise installed thrust-to-weight to ≥${needTW.toFixed(2)} (now ${s.twr}) or reduce take-off mass by ≈${Math.ceil(this.m*(1-this.minMargin/1.15))} kg so the aircraft keeps OEI hover capability. ${s.config==='multi'?'':'More, smaller lift units also reduce the impact of a single failure.'}`); }
    if (this.maxN > s.loadLimit*0.85){ a.push(`Structure: gust loads reached ${this.maxN.toFixed(2)} g. Increase limit load factor or lower wing loading (larger wing / lower cruise speed in turbulence — slow to ~${Math.round(s.cruiseKmh*0.7)} km/h in gusts).`); }
    if (this.maxT > 55){ a.push(`Thermal: pack peaked at ${this.maxT.toFixed(0)} °C. ${this.runaway?'Add cell-to-cell propagation barriers, venting paths and an automatic pack isolation; target touchdown within 90 s of detection.':'Add liquid cooling capacity, pre-cool the pack on the ground and minimise hover time in heat.'}`); }
    if (this.touchVy > 1.5) a.push('Landing: touchdown was firm — tune flare logic or increase hover thrust reserve near the ground.');
    if (this.maxDev > 30) a.push(`Handling: track deviation ${this.maxDev.toFixed(0)} m in crosswind — improve lateral control authority or set a crosswind limit of ~${Math.max(10, Math.round(this.env.wind*0.8))} kt.`);
    if (this.sigma < 0.8) a.push(`Density altitude: σ = ${this.sigma.toFixed(2)} cut available thrust by ${Math.round((1-this.sigma)*100)}%. Publish a hot & high performance chart and payload limits for high-altitude vertiports.`);
    if (!a.length) a.push('Design meets all stress criteria in this scenario. Run the full stress campaign to check the envelope.');
    return a;
  }
}

export function runHeadless(spec, env, opts){
  const sim = new SimCore(spec, env, opts); const dt = 0.05; let guard = 0;
  while (!sim.done && guard++ < 200000) sim.step(dt);
  return sim.report();
}
