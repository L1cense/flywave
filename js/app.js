import { $, $$ } from './store.js';
import { initCopilot } from './ai.js';

const routes = {
  dashboard: () => import('./pages/dashboard.js'),
  legal: () => import('./pages/legal.js'),
  planner: () => import('./pages/planner.js'),
  sim: () => import('./pages/sim.js'),
  hangar: () => import('./pages/hangar.js'),
};
let current = null;

async function render(){
  const hash = location.hash.replace(/^#\/?/, '');
  const [name, query] = hash.split('?');
  const key = routes[name] ? name : 'dashboard';
  if (current?.destroy) { try { current.destroy(); } catch(e){ console.error(e); } }
  const view = $('#view'); view.innerHTML = '';
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.route === key));
  $('#nav').classList.remove('open');
  window.scrollTo(0,0);
  const mod = await routes[key]();
  current = await mod.mount(view, new URLSearchParams(query||''));
}

function tick(){
  const t = new Date().toLocaleTimeString('en-GB', { timeZone:'Asia/Kolkata', hour12:false });
  $('#clock').textContent = t + ' IST';
}
setInterval(tick, 1000); tick();
$('#hamburger').onclick = () => $('#nav').classList.toggle('open');
window.addEventListener('hashchange', render);
initCopilot();
render();
