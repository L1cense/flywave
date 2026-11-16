import { REG_SECTIONS, TRACKS, GUIDE, INDIA_WX } from './data/regs.js';
import { store, session, esc } from './store.js';

const strip = h => h.replace(/<[^>]+>/g,' ').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ').trim();
const DOCS = [];
REG_SECTIONS.forEach(s => s.items.forEach(i => DOCS.push({ title:i.title, ref:i.ref, sec:s.title, text:strip(i.body), html:i.body, tags:(i.tags||[]).join(' ') })));
GUIDE.forEach(g => DOCS.push({ title:`Pilot guide — ${g.phase}`, ref:'flyWave guide', sec:'Guide', text:g.steps.join('. '), tags:'procedure checklist emergency' }));
INDIA_WX.forEach(w => DOCS.push({ title:`Weather season — ${w.name}`, ref:'India climatology', sec:'Weather', text:w.note, tags:'weather season monsoon fog' }));
const STOP = new Set('a an the is are of to in for on and or what how do i my me can should with be it this that does need when which who about tell explain'.split(' '));
const tok = s => s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w => w && !STOP.has(w)).map(w => w.replace(/(ing|es|s)$/,''));
const index = DOCS.map(d => ({ d, t: tok(d.title+' '+d.title+' '+d.tags+' '+d.tags+' '+d.text) }));
const df = {}; index.forEach(x => new Set(x.t).forEach(w => df[w] = (df[w]||0)+1));
const avg = index.reduce((s,x)=>s+x.t.length,0)/index.length;
function search(q, k=3){
  const qt = tok(q); const N = index.length;
  return index.map(x => { let s = 0; qt.forEach(w => { const f = x.t.filter(t=>t===w).length; if (!f) return; const idf = Math.log(1+(N-(df[w]||0)+0.5)/((df[w]||0)+0.5)); s += idf*f*2.2/(f+1.2*(0.25+0.75*x.t.length/avg)); }); return { ...x.d, s }; }).filter(x=>x.s>0.5).sort((a,b)=>b.s-a.s).slice(0,k);
}
function sentences(doc, q){
  const qt = new Set(tok(q)); const ss = doc.text.split(/(?<=[.;])\s+|(?=\s[A-Z][a-z]+ –)/).filter(s=>s.length>20);
  return ss.map(s => ({ s, sc: tok(s).filter(w=>qt.has(w)).length })).sort((a,b)=>b.sc-a.sc).slice(0,3).map(x=>x.s.trim());
}

function contextText(){
  const plan = session.plan ? store.get('lastPlan') : store.get('lastPlan');
  const sim = store.get('lastSim'), pilot = store.get('pilot',{}), checks = store.get('checks',{});
  const parts = [];
  if (plan) parts.push(`Current flight plan: ${plan.title}, ${plan.ac}, ${plan.dist?.toFixed?.(1)} km, verdict ${plan.verdict}, risk score ${plan.score}. Findings: ${plan.findings.map(f=>f.sev+': '+f.msg).join(' | ')}`);
  if (sim) parts.push(`Last simulation: ${sim.spec} in "${sim.scenario}", score ${sim.score}, outcome ${sim.outcome}. Criteria: ${sim.crit.map(c=>c.k+' '+c.v+' '+c.pass).join(' | ')}. Advice: ${sim.advice.join(' ')}`);
  if (pilot.medicalExpiry) parts.push(`Pilot Class ${pilot.medicalClass} medical valid until ${pilot.medicalExpiry}.`);
  const pend = TRACKS.map(t => `${t.title}: ${t.items.filter((_,i)=>!checks[t.id+i]).map(x=>x[0]).slice(0,3).join(', ')||'complete'}`);
  parts.push('Pending certification steps — '+pend.join('; '));
  return parts.join('\n');
}

function offlineAnswer(q){
  const ql = q.toLowerCase();
  const plan = store.get('lastPlan'), sim = store.get('lastSim'), checks = store.get('checks',{});
  if (/(plan|route|flight).*(risk|safe|analy|summar|brief|go)|my (current )?(flight )?plan/.test(ql)){
    if (!plan) return { html:'No flight plan yet. Open the <a href="#/planner"><b>Flight planner</b></a>, choose A and B, and I will brief you on it.' };
    const bad = plan.findings.filter(f=>f.sev==='nogo'), c = plan.findings.filter(f=>f.sev==='caution');
    return { html:`<p><b>${plan.title}</b> (${esc(plan.ac)}): verdict <b>${plan.verdict.toUpperCase()}</b>, risk score ${plan.score}/100.</p>${bad.length?`<p class="c-bad">Blocking:</p><ul>${bad.map(f=>`<li>${esc(f.msg)}</li>`).join('')}</ul>`:''}${c.length?`<p>Watch items:</p><ul>${c.slice(0,5).map(f=>`<li>${esc(f.msg)}</li>`).join('')}</ul>`:''}<p>${bad.length?'Fix the blocking items first — try the departure-window optimiser or a different aircraft/route.':'File with FIC/ADC numbers and re-check NOTAMs before departure.'}</p>`, src:'Your flight plan' };
  }
  if (/(sim|simulation|stress|design|improve)/.test(ql) && sim){
    return { html:`<p><b>${esc(sim.spec)}</b> in <b>${esc(sim.scenario)}</b> scored <b>${sim.score}/100</b> (${sim.outcome}).</p><ul>${sim.crit.filter(c=>c.pass!=='pass').map(c=>`<li>${esc(c.k)}: ${esc(c.v)} — <b>${c.pass}</b></li>`).join('') || '<li>All criteria passed.</li>'}</ul><p>Recommendations:</p><ul>${sim.advice.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`, src:'Your last simulation' };
  }
  if (/(next|what should i do|roadmap|journey|progress)/.test(ql)){
    const lines = TRACKS.map(t => { const i = t.items.findIndex((_,k)=>!checks[t.id+k]); return i<0 ? `<li><b>${t.title}</b>: complete ✓</li>` : `<li><b>${t.title}</b>: next — ${esc(t.items[i][0])} <span class="dim">(${esc(t.items[i][1])})</span></li>`; });
    return { html:`<p>Your next certification steps:</p><ul>${lines.join('')}</ul><p>Tick items off in <a href="#/legal"><b>Regulations → Certification tracker</b></a>.</p>`, src:'Certification tracker' };
  }
  const m = ql.match(/from (.+?) to (.+?)(\?|$| in | with )/);
  if (m) return { html:`Open the planner with that route: <a href="#/planner"><b>Flight planner</b></a> — pick <b>${esc(m[1])}</b> as A and <b>${esc(m[2])}</b> as B (use search for places not in the list). I will produce the route, weather, energy budget and a go/no-go.` };
  const hits = search(q);
  if (!hits.length) return { html:'I could not find that in my DGCA knowledge base. Try terms like <i>medical validity</i>, <i>type certificate</i>, <i>FIC ADC</i>, <i>vertiport</i>, <i>VFR minima</i> or <i>Drone Rules</i>. Connect an LLM in ⚙ for free-form questions.' };
  const top = hits[0];
  const body = d => d.html || `<ul>${sentences(d, q).map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`;
  const second = hits[1] && hits[1].s > top.s*0.75 ? hits[1] : null;
  return { html:`<p><b>${esc(top.title)}</b> <span class="dim">— ${esc(top.ref)}</span></p>${body(top)}${second?`<p style="margin-top:10px"><b>${esc(second.title)}</b> <span class="dim">— ${esc(second.ref)}</span></p>${body(second)}`:''}${hits.slice(second?2:1).length?`<p class="small">Related: ${hits.slice(second?2:1).map(h=>esc(h.title)).join(' · ')}</p>`:''}`, src: hits.map(h=>h.sec).filter((v,i,a)=>a.indexOf(v)===i).join(', ') };
}

async function llmAnswer(q, cfg, history){
  const hits = search(q, 4);
  const sys = `You are flyWave Copilot, an aviation assistant for eVTOL operations in India. Ground answers in DGCA regulations (Bharatiya Vayuyan Adhiniyam 2024, Aircraft Rules 1937, CARs), AAI procedures and the user's app context. Be concise, use bullet points, cite CAR sections when known, and say when something must be verified with DGCA. Never invent regulation numbers.\n\nKnowledge:\n${hits.map(h=>`[${h.title} — ${h.ref}] ${h.text}`).join('\n')}\n\nApp context:\n${contextText()}`;
  const r = await fetch((cfg.base||'https://api.openai.com/v1').replace(/\/$/,'')+'/chat/completions', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+cfg.key }, body: JSON.stringify({ model: cfg.model||'gpt-4o-mini', temperature:0.3, messages:[{ role:'system', content:sys }, ...history.slice(-6), { role:'user', content:q }] }) });
  if (!r.ok) throw new Error('LLM error '+r.status);
  const j = await r.json(); const txt = j.choices[0].message.content;
  return { html: esc(txt).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^[-*] (.+)$/gm,'<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, m=>`<ul>${m}</ul>`).replace(/\n/g,'<br/>'), src:`${cfg.model||'LLM'} + flyWave knowledge` };
}

const history = [];
let els;
function addMsg(role, html, src){ const d = document.createElement('div'); d.className = 'msg '+role; d.innerHTML = html + (src?`<div class="src">Source: ${esc(src)}</div>`:''); els.log.appendChild(d); els.log.scrollTop = 1e9; return d; }
async function ask(q){
  addMsg('user', esc(q)); history.push({ role:'user', content:q });
  const pending = addMsg('ai', '<span class="typing"></span>');
  const cfg = store.get('ai', {});
  let ans;
  try { ans = cfg.key ? await llmAnswer(q, cfg, history) : offlineAnswer(q); }
  catch(e){ ans = offlineAnswer(q); ans.src = (ans.src||'')+' (LLM unavailable: '+e.message+')'; }
  await new Promise(r=>setTimeout(r, 350));
  pending.innerHTML = ans.html + (ans.src?`<div class="src">Source: ${esc(ans.src)}</div>`:'');
  history.push({ role:'assistant', content: strip(ans.html) }); els.log.scrollTop = 1e9;
}
function modeLabel(){ const c = store.get('ai',{}); els.mode.innerHTML = c.key ? `<span class="c-info">●</span> LLM mode · ${esc(c.model||'gpt-4o-mini')}` : '<span class="c-ok">●</span> Offline aviation engine · DGCA knowledge base + your plans & sims'; }

export function openCopilot(prefill, send){
  els.panel.classList.add('open'); els.panel.setAttribute('aria-hidden','false');
  if (prefill && send) ask(prefill); else if (prefill) els.input.value = prefill;
  setTimeout(()=>els.input.focus(), 300);
}
export function initCopilot(){
  const g = id => document.getElementById(id);
  els = { panel:g('copilot'), log:g('aiLog'), input:g('aiInput'), mode:g('aiMode') };
  g('aiToggle').onclick = () => els.panel.classList.contains('open') ? els.panel.classList.remove('open') : openCopilot();
  g('aiClose').onclick = () => els.panel.classList.remove('open');
  g('aiSettingsBtn').onclick = () => { g('aiSettings').classList.toggle('hidden'); const c = store.get('ai',{}); g('aiBase').value = c.base||''; g('aiModel').value = c.model||''; g('aiKey').value = c.key||''; };
  g('aiSave').onclick = () => { store.set('ai', { base:g('aiBase').value.trim(), model:g('aiModel').value.trim(), key:g('aiKey').value.trim() }); g('aiSettings').classList.add('hidden'); modeLabel(); };
  g('aiClear').onclick = () => { store.set('ai', {}); g('aiSettings').classList.add('hidden'); modeLabel(); };
  g('aiForm').onsubmit = e => { e.preventDefault(); const q = els.input.value.trim(); if (!q) return; els.input.value=''; ask(q); };
  const sugg = ['Analyse my flight plan','Explain my simulation result','What medical do I need?','How do I get FIC and ADC numbers?','What should I do next?','VFR minima in India','Vertiport requirements'];
  g('aiSuggest').innerHTML = sugg.map(s=>`<button>${s}</button>`).join('');
  g('aiSuggest').querySelectorAll('button').forEach(b => b.onclick = () => ask(b.textContent));
  modeLabel();
  addMsg('ai', '<p>Namaste. I am <b>flyWave Copilot</b> — ask me about DGCA rules, licensing, medicals, airspace, or your current flight plan and simulation results.</p>');
}
