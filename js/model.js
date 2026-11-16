import * as THREE from 'three';

function airfoil(chord, t=0.13, camber=0.03){
  const s = new THREE.Shape(); const n = 24, up = [], lo = [];
  for (let i=0;i<=n;i++){
    const x = (1-Math.cos(Math.PI*i/n))/2;
    const yt = 5*t*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x**3-0.1015*x**4);
    const yc = camber*(1-(2*x-1)**2);
    up.push([x, yc+yt]); lo.push([x, yc-yt]);
  }
  // leading edge toward +X
  const P = ([x,y]) => [chord*(0.5 - x), chord*y];
  s.moveTo(...P(up[0])); up.forEach(p=>s.lineTo(...P(p))); lo.reverse().forEach(p=>s.lineTo(...P(p)));
  return s;
}
function wingGeo(chord, span, t){
  const g = new THREE.ExtrudeGeometry(airfoil(chord,t), { depth:span, bevelEnabled:false, steps:1 });
  g.translate(0,0,-span/2); return g;
}

export function makeMaterials(color='#f2f2f2'){
  return {
    body: new THREE.MeshPhysicalMaterial({ color, metalness:0.25, roughness:0.28, clearcoat:1, clearcoatRoughness:0.08 }),
    dark: new THREE.MeshStandardMaterial({ color:0x15171a, metalness:0.6, roughness:0.35 }),
    carbon: new THREE.MeshStandardMaterial({ color:0x0b0b0c, metalness:0.3, roughness:0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color:0x0a0f18, metalness:0.9, roughness:0.04, clearcoat:1, envMapIntensity:1.6 }),
    blade: new THREE.MeshStandardMaterial({ color:0x1a1a1a, metalness:0.4, roughness:0.4 }),
    disc: new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.0, depthWrite:false, side:THREE.DoubleSide }),
    red: new THREE.MeshBasicMaterial({ color:0xff2a2a }),
    green: new THREE.MeshBasicMaterial({ color:0x2aff7a }),
    white: new THREE.MeshBasicMaterial({ color:0xffffff }),
    accent: new THREE.MeshBasicMaterial({ color:0x5ad1ff }),
  };
}

function makeRotor(dia, M, blades=5){
  const pivot = new THREE.Group();
  const spin = new THREE.Group(); pivot.add(spin);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(dia*0.06, dia*0.07, dia*0.08, 16), M.dark);
  spin.add(hub);
  const bladeGeo = new THREE.BoxGeometry(dia*0.47, dia*0.008, dia*0.055); bladeGeo.translate(dia*0.25,0,0);
  for (let i=0;i<blades;i++){ const b = new THREE.Mesh(bladeGeo, M.blade); b.rotation.y = i*2*Math.PI/blades; b.rotation.x = 0.12; b.castShadow = true; spin.add(b); }
  const disc = new THREE.Mesh(new THREE.RingGeometry(dia*0.08, dia*0.5, 48), M.disc.clone()); disc.rotation.x = -Math.PI/2; pivot.add(disc);
  return { pivot, spin, disc, dia, health:1, failed:false };
}

// Builds a stylised eVTOL from specs. Nose +X, up +Y, starboard +Z.
export function buildAircraft(spec){
  const M = makeMaterials(spec.color);
  const root = new THREE.Group(); root.name = 'aircraft';
  const rotors = [], tilting = [], lights = { nav:[], strobe:[], beacon:[] };
  const L = spec.length, span = spec.wingspan, dia = spec.rotorDia;
  const cfg = spec.config;
  const fusR = cfg==='multi' ? Math.min(1.1, 0.45+spec.seats*0.12) : Math.min(1.0, 0.45 + spec.seats*0.09);
  const fusL = cfg==='multi' ? fusR*3.2 : L*0.82;

  // fuselage
  const prof = [];
  for (let i=0;i<=32;i++){
    const t = i/32; const x = t;
    let r = cfg==='multi' ? Math.sin(Math.PI*Math.pow(t,0.85))*fusR : Math.pow(Math.sin(Math.PI*Math.min(1,t*1.15)),0.6)*fusR*(1-0.75*Math.max(0,t-0.55)/0.45);
    prof.push(new THREE.Vector2(Math.max(0.001,r), x*fusL - fusL/2));
  }
  const fg = new THREE.LatheGeometry(prof, 48); fg.rotateZ(Math.PI/2);
  const fus = new THREE.Mesh(fg, M.body); fus.castShadow = true; fus.receiveShadow = true; root.add(fus);
  fus.scale.set(1, 0.92, 0.86);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(fusR*0.92, 48, 24, 0, Math.PI*2, 0, Math.PI*0.5), M.glass);
  canopy.scale.set(cfg==='multi'?1.25:1.9, 0.8, 0.86); canopy.position.set(fusL*(cfg==='multi'?0.12:0.24), fusR*0.18, 0); root.add(canopy);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(fusR*0.88, 0.025, 8, 48), M.accent);
  stripe.rotation.y = Math.PI/2; stripe.position.x = -fusL*0.05; stripe.scale.set(1,0.92,0.86); root.add(stripe);

  if (cfg === 'multi'){
    // halo ring with rotors
    const rings = spec.rotors > 12 ? [ { n: Math.round(spec.rotors*0.55), R: span/2 - dia*0.5 }, { n: spec.rotors - Math.round(spec.rotors*0.55), R: span/2 - dia*1.45 } ] : [ { n: spec.rotors, R: span/2 - dia*0.5 } ];
    const y = fusR*1.15;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08, fusR*0.6, 12), M.dark); mast.position.y = fusR*0.85; root.add(mast);
    rings.forEach((rg, ri) => {
      const torus = new THREE.Mesh(new THREE.TorusGeometry(rg.R, 0.05, 8, 96), M.carbon); torus.rotation.x = Math.PI/2; torus.position.y = y + ri*0.12; root.add(torus);
      for (let i=0;i<rg.n;i++){
        const a = (i+ri*0.5)/rg.n*Math.PI*2;
        const r = makeRotor(dia*0.95, M, 2); r.pivot.position.set(Math.cos(a)*rg.R, y+0.08+ri*0.12, Math.sin(a)*rg.R);
        r.dir = (i%2? 1:-1); root.add(r.pivot); rotors.push(r);
      }
      for (let i=0;i<6;i++){
        const a = i/6*Math.PI*2; const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,rg.R,8), M.carbon);
        arm.rotation.z = Math.PI/2; arm.rotation.y = -a; arm.position.set(Math.cos(a)*rg.R/2, y + ri*0.12, Math.sin(a)*rg.R/2); root.add(arm);
      }
    });
    // skids
    [-1,1].forEach(s => {
      const skid = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, fusL*1.1, 4, 8), M.dark); skid.rotation.z = Math.PI/2; skid.position.set(0, -fusR*1.05, s*fusR*0.9); root.add(skid);
      [-0.3,0.3].forEach(k => { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,fusR*0.55,6), M.dark); st.position.set(k*fusL, -fusR*0.78, s*fusR*0.75); st.rotation.x = s*0.35; root.add(st); });
    });
    const nl = (m, x,y,z, list) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.07,10,10), m); s.position.set(x,y,z); root.add(s); list.push(s); };
    nl(M.red, 0, y, -rings[0].R, lights.nav); nl(M.green, 0, y, rings[0].R, lights.nav); nl(M.white, -rings[0].R, y, 0, lights.strobe); nl(M.red, 0, -fusR*0.95, 0, lights.beacon);
  } else {
    const chord = Math.max(0.9, span*0.085);
    const wy = fusR*0.62, wx = cfg==='tilt' ? fusL*0.02 : -fusL*0.02;
    const wing = new THREE.Mesh(wingGeo(chord, span, 0.14), M.body); wing.position.set(wx, wy, 0); wing.castShadow = true; root.add(wing);
    // tail
    const tailX = -fusL*0.47;
    [-1,1].forEach(s => {
      const tf = new THREE.Mesh(wingGeo(chord*0.7, span*0.17, 0.11), M.body);
      tf.position.set(tailX, fusR*0.35 + span*0.04, s*span*0.06); tf.rotation.x = s*-0.6; tf.castShadow = true; root.add(tf);
    });
    if (cfg === 'tilt'){
      const nPerSide = Math.max(1, Math.round(spec.rotors/2));
      for (let s of [-1,1]){
        for (let i=0;i<nPerSide;i++){
          const front = nPerSide>2 ? i < nPerSide-1 : true;
          const z = s*(fusR*1.1 + dia*0.6 + i*( (span/2 - fusR*1.1 - dia*0.6) / Math.max(1,nPerSide-1) ));
          const zx = Math.abs(z) > span/2 ? s*span/2 : z;
          const nac = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, chord*1.1, 6, 12), M.body); nac.rotation.z = Math.PI/2; nac.position.set(wx, wy, zx); nac.castShadow = true; root.add(nac);
          const r = makeRotor(dia, M, 5); r.dir = (i+(s>0?1:0))%2 ? 1:-1;
          const hinge = new THREE.Group(); hinge.position.set(wx + chord*0.75, wy, zx); root.add(hinge);
          r.pivot.position.set(0, 0.0, 0); hinge.add(r.pivot); r.hinge = hinge; r.tilts = front;
          if (front){ tilting.push(r); } else { hinge.position.x = wx - chord*0.6; hinge.position.y = wy + 0.3; }
          rotors.push(r);
        }
      }
      // also V-tail rotors for 6-rotor layout
    } else {
      // lift + cruise: booms with lift rotors, pusher at tail
      const lift = spec.rotors; const boomsPerSide = Math.max(1, Math.ceil(lift/4));
      for (let s of [-1,1]){
        for (let b=0;b<boomsPerSide;b++){
          const z = s*(fusR*1.2 + dia*0.6 + b*(span/2 - fusR*1.2 - dia*0.9)/Math.max(1,boomsPerSide-1||1));
          const boomLen = dia*2.4 + chord;
          const boom = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, boomLen, 6, 10), M.body); boom.rotation.z = Math.PI/2; boom.position.set(wx, wy-0.05, z); boom.castShadow=true; root.add(boom);
          [1,-1].forEach((f, k) => {
            if (rotors.length >= lift) return;
            const r = makeRotor(dia, M, 2); r.dir = (b+k)%2 ? 1:-1; r.pivot.position.set(wx + f*(boomLen/2), wy + 0.12, z); root.add(r.pivot); r.liftOnly = true; rotors.push(r);
          });
        }
      }
      const pusher = makeRotor(dia*0.75, M, 5); pusher.pivot.rotation.z = -Math.PI/2; pusher.pivot.position.set(-fusL/2 - 0.12, 0, 0); pusher.cruiseOnly = true; root.add(pusher.pivot); rotors.push(pusher);
    }
    // gear
    [[fusL*0.25,0],[-fusL*0.12,-fusR*0.8],[-fusL*0.12,fusR*0.8]].forEach(([x,z]) => {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,fusR*0.7,8), M.dark); st.position.set(x,-fusR*0.95,z); root.add(st);
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.1,16), M.carbon); wh.rotation.x = Math.PI/2; wh.position.set(x,-fusR*1.3,z); root.add(wh);
    });
    const nl = (m, x,y,z, list) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.08,10,10), m); s.position.set(x,y,z); root.add(s); list.push(s); };
    nl(M.red, wx, wy, -span/2-0.05, lights.nav); nl(M.green, wx, wy, span/2+0.05, lights.nav);
    nl(M.white, tailX-0.3, fusR*0.35+span*0.08, 0, lights.strobe); nl(M.red, 0, fusR*0.92, 0, lights.beacon);
  }

  // ground clearance: lowest point at y=0
  const box = new THREE.Box3().setFromObject(root);
  const holder = new THREE.Group(); holder.add(root); root.position.y = -box.min.y;
  const size = box.getSize(new THREE.Vector3());

  let t = 0;
  return {
    object: holder, inner: root, rotors, size, materials: M, spec,
    tilt: 0,
    setTilt(v){ // 0 = hover (rotor axis up), 1 = cruise (axis forward)
      this.tilt = v; tilting.forEach(r => { r.hinge.rotation.z = -v*Math.PI/2; });
    },
    update(dt, power=1, cruise=0){
      t += dt;
      rotors.forEach(r => {
        let p = power;
        if (r.liftOnly) p = power * (1 - cruise*0.95);
        if (r.cruiseOnly) p = Math.max(0.1, cruise) * power;
        if (r.failed) p = 0; else p *= r.health;
        r.rate = THREE.MathUtils.lerp(r.rate||0, p*60, Math.min(1, dt*3));
        r.spin.rotation.y += (r.dir||1) * r.rate * dt;
        r.spin.visible = r.rate < 25;
        r.disc.material.opacity = THREE.MathUtils.clamp((r.rate-10)/60, 0, 0.22);
      });
      const blink = (t % 1.2) < 0.08;
      lights.strobe.forEach(s => s.visible = blink);
      lights.beacon.forEach(s => s.visible = (t % 1.0) < 0.5);
    },
  };
}

// Wrap an uploaded glTF as an aircraft; spins nodes whose name looks like a rotor.
export function wrapCustomModel(gltfScene, spec){
  const root = new THREE.Group(); root.add(gltfScene);
  gltfScene.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  let box = new THREE.Box3().setFromObject(gltfScene);
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.z) || 1;
  const target = Math.max(spec.length, spec.wingspan);
  gltfScene.scale.multiplyScalar(target/longest);
  box = new THREE.Box3().setFromObject(gltfScene);
  const c = box.getCenter(new THREE.Vector3());
  gltfScene.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  const spinners = [];
  gltfScene.traverse(o => { if (/rotor|prop|blade|fan/i.test(o.name)) spinners.push(o); });
  const holder = new THREE.Group(); holder.add(root);
  return {
    object: holder, inner: root, rotors: spinners.map(o => ({ spin:o, failed:false, health:1 })), size: box.getSize(new THREE.Vector3()), spec, tilt:0, custom:true,
    setTilt(v){ this.tilt = v; },
    update(dt, power=1){ spinners.forEach((o,i) => { o.rotation.y += (i%2?1:-1)*power*40*dt; }); },
  };
}
