// Indicative public figures, rounded. Use for planning study only.
export const AIRCRAFT = [
  { id:'shunya', name:'Sarla Shunya', maker:'Sarla Aviation', origin:'India', config:'liftcruise', rotors:8, seats:7,
    mtow:2600, emptyMass:1700, payload:680, batteryKWh:300, cruiseKmh:250, rangeKm:160, wingspan:15, length:10, rotorDia:2.6,
    twr:1.45, ld:11, maxWindKt:25, ceilingFt:10000, loadLimit:3.5, color:'#e8e8e8' },
  { id:'e200', name:'ePlane e200', maker:'The ePlane Company', origin:'India', config:'tilt', rotors:4, seats:2,
    mtow:1100, emptyMass:850, payload:200, batteryKWh:120, cruiseKmh:200, rangeKm:200, wingspan:9, length:7, rotorDia:2.0,
    twr:1.4, ld:12, maxWindKt:22, ceilingFt:8000, loadLimit:3.5, color:'#f4f4f4' },
  { id:'joby', name:'Joby S4', maker:'Joby Aviation', origin:'USA', config:'tilt', rotors:6, seats:5,
    mtow:2400, emptyMass:1800, payload:450, batteryKWh:280, cruiseKmh:320, rangeKm:240, wingspan:11.6, length:7.3, rotorDia:2.9,
    twr:1.5, ld:13, maxWindKt:28, ceilingFt:12000, loadLimit:3.8, color:'#ffffff' },
  { id:'midnight', name:'Archer Midnight', maker:'Archer Aviation', origin:'USA', config:'liftcruise', rotors:12, seats:5,
    mtow:3175, emptyMass:2400, payload:450, batteryKWh:320, cruiseKmh:240, rangeKm:160, wingspan:14.6, length:8, rotorDia:2.4,
    twr:1.45, ld:11, maxWindKt:25, ceilingFt:10000, loadLimit:3.5, color:'#dfe3e8' },
  { id:'volocity', name:'Volocopter VoloCity', maker:'Volocopter', origin:'Germany', config:'multi', rotors:18, seats:2,
    mtow:900, emptyMass:700, payload:110, batteryKWh:45, cruiseKmh:110, rangeKm:35, wingspan:11.3, length:9, rotorDia:2.3,
    twr:1.6, ld:4, maxWindKt:18, ceilingFt:3000, loadLimit:3.0, color:'#f2f2f2' },
  { id:'eh216', name:'EHang EH216-S', maker:'EHang', origin:'China', config:'multi', rotors:16, seats:2,
    mtow:650, emptyMass:430, payload:220, batteryKWh:40, cruiseKmh:130, rangeKm:30, wingspan:5.7, length:5.6, rotorDia:1.6,
    twr:1.6, ld:4, maxWindKt:16, ceilingFt:3000, loadLimit:3.0, color:'#f6f6f6' },
];

export const CONFIG_LABEL = { tilt:'Vectored thrust (tilt-rotor)', liftcruise:'Lift + cruise', multi:'Multicopter' };

const G = 9.80665;
export function derive(a){
  const usableKWh = a.batteryKWh * 0.9;
  const cruiseHr = a.rangeKm / a.cruiseKmh;
  const cruiseKW = Math.max(20, (usableKWh * 0.82) / cruiseHr);
  const diskArea = a.rotors * Math.PI * (a.rotorDia/2)**2;
  const ideal = Math.sqrt((a.mtow*G)**3 / (2*1.225*diskArea)) / 1000;
  const hoverKW = ideal / 0.7;
  return { usableKWh, cruiseKW, hoverKW, diskArea, diskLoading: a.mtow/diskArea, whPerKm: cruiseKW*1000/a.cruiseKmh };
}

export function getFleet(){
  const custom = JSON.parse(localStorage.getItem('fw.customAircraft')||'[]');
  return [...AIRCRAFT, ...custom];
}
export function saveCustom(ac){
  const custom = JSON.parse(localStorage.getItem('fw.customAircraft')||'[]').filter(x=>x.id!==ac.id);
  custom.push(ac); localStorage.setItem('fw.customAircraft', JSON.stringify(custom));
}
export function deleteCustom(id){
  const custom = JSON.parse(localStorage.getItem('fw.customAircraft')||'[]').filter(x=>x.id!==id);
  localStorage.setItem('fw.customAircraft', JSON.stringify(custom));
}
