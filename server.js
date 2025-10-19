/**
 * Gruppen-Urlaubsabstimmung – Orte + Terminabstimmung
 * - Seite 1: Zielwahl (mit Crossfade-Slideshow)
 * - Seite 2: Terminübersicht (10.–31.05.2025), Verfügbarkeiten je Tag speichern & anzeigen
 */

const express = require('express');
const basicAuth = require('basic-auth');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

const DATA_DIR = process.env.DATA_DIR || process.env.TMPDIR || '/tmp';
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');


function initStore() {
  try {
    if (!fs.existsSync(VOTES_FILE)) {
      fs.writeFileSync(VOTES_FILE, JSON.stringify({ ballots: [], availability: {} }, null, 2));
    } else {
      // Migration: availability ergänzen, falls alt
      const data = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf-8'));
      if (!('availability' in data)) {
        data.availability = {};
        fs.writeFileSync(VOTES_FILE, JSON.stringify(data, null, 2));
      }
    }
  } catch (e) {
    console.error('initStore error:', e);
  }
}
function readStore() {
  initStore();
  try {
    return JSON.parse(fs.readFileSync(VOTES_FILE, 'utf-8'));
  } catch (e) {
    console.error('readStore error:', e);
    return { ballots: [], availability: {} };
  }
}
function writeStore(data) {
  try {
    fs.writeFileSync(VOTES_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('writeStore error:', e);
    return false;
  }
}

// ---------- Optionen (mit Vergleichsdaten) ----------
const OPTIONS = [
  { id: 'andalusien', title: '🇪🇸 Andalusien – Costa de la Luz', desc: 'Surfer-Vibe, lange Atlantikstrände, authentische Tapas-Kultur.', image: '/images/andalusien/1.jpg', info: { temp: '25 °C', sea: '20 °C', price: '€', vibe: 'Surfer / Entspannt', flight: '3 h ab D' } },
  { id: 'mallorca', title: '🇪🇸 Mallorca – Nord/Ostküste', desc: 'Vielseitig: Badebuchten, Altstädte, Nightlife möglich.', image: '/images/mallorca/1.jpg', info: { temp: '24 °C', sea: '20 °C', price: '€€', vibe: 'Gemischt / Aktiv', flight: '2,5 h ab D' } },
  { id: 'valencia', title: '🇪🇸 Valencia-Küste – Denia / Jávea', desc: 'Kombination aus Stadt, Strand & Tapas, gute Anbindung.', image: '/images/valencia/1.jpg', info: { temp: '26 °C', sea: '21 °C', price: '€€', vibe: 'Stadt & Strand', flight: '2,5 h ab D' } },
  { id: 'kanaren', title: '🇪🇸 Kanaren – Teneriffa / Fuerteventura', desc: 'Ganzjährig mild, sicheres Badewetter, weite Strände.', image: '/images/kanaren/1.jpg', info: { temp: '25 °C', sea: '21 °C', price: '€€', vibe: 'Entspannt / Sonne', flight: '4,5 h ab D' } },
  { id: 'tuerkei', title: '🇹🇷 Türkische Riviera – Antalya / Kemer', desc: 'Wärmstes Wasser, preiswert, viele Apartments.', image: '/images/tuerkei/1.jpg', info: { temp: '27 °C', sea: '22 °C', price: '€', vibe: 'Warm / Komfort', flight: '3 h ab D' } },
  { id: 'albanien', title: '🇦🇱 Albanische Riviera – Ksamil / Sarandë', desc: 'Türkisblaues Wasser, sehr günstig, unberührt.', image: '/images/albanien/1.jpg', info: { temp: '23 °C', sea: '19 °C', price: '€', vibe: 'Budget / Natürlich', flight: '3 h + Fähre' } },
  { id: 'montenegro', title: '🇲🇪 Montenegro – Budva / Kotor', desc: 'Dramatische Buchten & Altstädte, günstig.', image: '/images/montenegro/1.jpg', info: { temp: '23 °C', sea: '18 °C', price: '€', vibe: 'Historisch / Natur', flight: '2,5 h ab D' } },
  { id: 'sizilien', title: '🇮🇹 Sizilien – Cefalù / Catania-Küste', desc: 'Strand & Kultur, großartige Küche.', image: '/images/sizilien/1.jpg', info: { temp: '24 °C', sea: '19 °C', price: '€€', vibe: 'Kultur / Genuss', flight: '2,5 h ab D' } }
];

// ---------- App ----------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lokale Bilder ausliefern
const PUBLIC_DIR = path.join(__dirname, 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
app.use('/images', express.static(IMAGES_DIR));

// ---------- HTML (Seite 1: Orte) ----------
const baseStyles = `<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
<style>
.fade-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;transition:opacity 2.5s ease-in-out;}
.fade-hidden{opacity:0}
.fade-visible{opacity:1}
</style>`;

const PUBLIC_HTML = `<!doctype html><html lang='de'><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width, initial-scale=1'/>${baseStyles}<title>Urlaubsabstimmung</title></head><body class='bg-gray-50 text-gray-900'><div class='max-w-5xl mx-auto p-6'>
<h1 class='text-3xl font-bold mb-2'>Urlaubsabstimmung 2025</h1><p class='text-sm text-gray-600 mb-6'>Wähle deine Favoriten. Mehrfachwahl erlaubt. Stimmen nur für Admin sichtbar.</p>
<form id='voteForm' class='space-y-6 bg-white rounded-2xl shadow p-6'>
<div><label for='name' class='block text-sm font-medium'>Dein Name</label><input id='name' name='name' type='text' required placeholder='z. B. Alex' class='mt-1 w-full border rounded-lg p-2'/></div>
<div class='grid sm:grid-cols-2 gap-4'>
${OPTIONS.map(o=>
  "<div class='border rounded-xl bg-gray-50 p-3'>" +
  "<div class='relative rounded-lg overflow-hidden mb-3 h-72 sm:h-80 w-full bg-gray-200 shadow' style='min-height:260px'>" +
    "<img id='slide-"+o.id+"-a' src='"+o.image+"' alt='"+o.title+"' class='fade-layer fade-visible' onerror=\"this.style.display='none'\">" +
    "<img id='slide-"+o.id+"-b' src='"+o.image+"' alt='"+o.title+"' class='fade-layer fade-hidden' onerror=\"this.style.display='none'\">" +
  "</div>" +
  "<label class='flex items-start space-x-3'><input type='checkbox' name='selections' value='"+o.id+"' class='mt-1'>" +
  "<span><span class='font-semibold'>"+o.title+"</span><span class='block text-sm text-gray-600 mb-1'>"+o.desc+"</span>" +
  "<table class='text-xs text-gray-700 w-full'><tr><td>🌡️Temp:</td><td>"+o.info.temp+"</td></tr><tr><td>🌊Meer:</td><td>"+o.info.sea+"</td></tr><tr><td>💶Preis:</td><td>"+o.info.price+"</td></tr><tr><td>🎭Vibe:</td><td>"+o.info.vibe+"</td></tr><tr><td>✈️Flug:</td><td>"+o.info.flight+"</td></tr></table></span></label></div>"
).join('')}
</div>
<button type='submit' class='px-5 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800'>Abstimmen</button><p id='status' class='text-sm mt-3'></p></form></div>
<script>
(function(){
  var OPTION_IDS = ${JSON.stringify(OPTIONS.map(o=>o.id))};
  function preload(url){ return new Promise(function(resolve){ var img=new Image(); img.onload=function(){resolve({ok:true,url:url});}; img.onerror=function(){resolve({ok:false,url:url});}; img.src=url; }); }
  function initSlideshow(id, opts){
    opts=opts||{}; var max=opts.max||10; var interval=opts.interval||6000;
    var base='/images/'+id+'/'; var candidates=[]; for(var i=1;i<=max;i++){ candidates.push(base+i+'.jpg'); }
    var A=document.getElementById('slide-'+id+'-a'); var B=document.getElementById('slide-'+id+'-b'); if(!A||!B) return;
    var urls=[]; var p=Promise.resolve(); candidates.forEach(function(u){ p=p.then(function(){ return preload(u).then(function(r){ if(r.ok) urls.push(u); }); }); });
    p.then(function(){ if(urls.length===0){ return; } A.src=urls[0]; B.src=urls[0]; var activeIsA=true; var idx=0; setInterval(function(){ if(urls.length<2) return; idx=(idx+1)%urls.length; var nextUrl=urls[idx]; var front=activeIsA?A:B; var back=activeIsA?B:A; back.classList.add('fade-hidden'); back.classList.remove('fade-visible'); preload(nextUrl).then(function(){ back.src=nextUrl; requestAnimationFrame(function(){ front.classList.add('fade-hidden'); front.classList.remove('fade-visible'); back.classList.remove('fade-hidden'); back.classList.add('fade-visible'); activeIsA=!activeIsA; }); }); }, interval); });
  }
  document.addEventListener('DOMContentLoaded', function(){ OPTION_IDS.forEach(function(id){ initSlideshow(id,{max:10,interval:6000}); }); });

  // Submit leitet zur Terminseite weiter
  var form=document.getElementById('voteForm'); var status=document.getElementById('status');
  if(form){ form.addEventListener('submit', function(e){ e.preventDefault(); status.textContent=''; var name=document.getElementById('name').value.trim(); var selections=[].slice.call(document.querySelectorAll("input[name='selections']:checked")).map(function(cb){return cb.value;}); if(!name){ status.textContent='Bitte Name eingeben'; status.className='text-red-600'; return; } if(selections.length===0){ status.textContent='Bitte mindestens ein Ziel wählen'; status.className='text-red-600'; return; } fetch('/api/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,selections:selections})}).then(function(r){return r.json()}).then(function(data){ if(data&&data.ok){ window.location.href='/dates?name='+encodeURIComponent(name); } else { status.textContent='Fehler'; status.className='text-red-600'; } }).catch(function(){ status.textContent='Netzwerkfehler'; status.className='text-red-600'; }); }); }
})();
</script></body></html>`;

// ---------- Seite 2: Terminübersicht ----------
const DATE_START = new Date(Date.UTC(2025,4,10)); // 10.05.2025 (Monat 0-basiert)
const DATE_END   = new Date(Date.UTC(2025,4,31)); // 31.05.2025
function fmt(d){ return d.toISOString().slice(0,10); }
function listDates(){ const out=[]; let d=new Date(DATE_START); while(d<=DATE_END){ out.push(fmt(d)); d.setUTCDate(d.getUTCDate()+1); } return out; }
const DATE_LIST = listDates();

const DATES_HTML = `<!doctype html><html lang='de'><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width, initial-scale=1'/>${baseStyles}<title>Terminabstimmung</title></head>
<body class='bg-gray-50 text-gray-900'>
<div class='max-w-5xl mx-auto p-6'>
  <h1 class='text-3xl font-bold mb-2'>Terminübersicht: 10.–31. Mai 2025</h1>
  <p class='text-sm text-gray-600 mb-6'>Markiere die Tage, an denen du <strong>kannst</strong>. Deine Auswahl ist für alle sichtbar (nur Namen, keine Zeiten).</p>
  <div class='bg-white rounded-2xl shadow p-4 md:p-6'>
    <div class='flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4'>
      <div>
        <label class='text-sm block mb-1'>Dein Name</label>
        <input id='personName' type='text' class='border rounded-lg p-2 w-64' placeholder='z. B. Alex'>
      </div>
      <div class='text-xs text-gray-500'>Empfohlener Reisezeitraum: 17.–24.05.2025</div>
    </div>

    <div id='calendar' class='grid grid-cols-2 md:grid-cols-4 gap-3'></div>

    <div class='mt-6 flex items-center gap-3'>
      <button id='saveBtn' class='px-4 py-2 rounded-xl bg-black text-white hover:bg-gray-800'>Verfügbarkeit speichern</button>
      <a href='/' class='text-sm text-gray-600 underline'>← Zurück zur Zielabstimmung</a>
      <span id='saveStatus' class='text-sm'></span>
    </div>
  </div>
</div>
<script>
(function(){
  const DATE_LIST = ${JSON.stringify(DATE_LIST)};
  const calendar = document.getElementById('calendar');
  const nameInput = document.getElementById('personName');
  const saveBtn = document.getElementById('saveBtn');
  const saveStatus = document.getElementById('saveStatus');

  // Name aus Query übernehmen
  const params = new URLSearchParams(window.location.search); const qname = params.get('name'); if(qname){ nameInput.value = qname; }

  function dayLabel(iso){ const d=new Date(iso+'T00:00:00Z'); const wDays=['So','Mo','Di','Mi','Do','Fr','Sa']; return wDays[d.getUTCDay()]+' '+iso.slice(8,10)+'.05.'; }

  function setCardVisual(iso, checked){
    const card = document.querySelector("[data-card='"+iso+"']");
    if(!card) return;
    card.classList.toggle('ring-2', checked);
    card.classList.toggle('ring-black', checked);
    card.classList.toggle('bg-gray-100', checked);
  }

  // Kacheln aufbauen (ganze Box klickbar)
  DATE_LIST.forEach(function(iso){
    const card = document.createElement('div');
    card.className='border rounded-xl p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition';
    card.setAttribute('data-card', iso);
    card.innerHTML = "<div class='flex items-center justify-between mb-2'><div class='font-semibold'>"+dayLabel(iso)+"</div><label class='inline-flex items-center gap-2 text-sm select-none'><input type='checkbox' data-day='"+iso+"' class='w-4 h-4'><span>kann</span></label></div>"+
                     "<div class='text-xs text-gray-600'>Wer kann <span id='count-"+iso+"' class='inline-block px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 align-middle'>0</span>: <span id='list-"+iso+"' class='font-medium'></span></div>";
    calendar.appendChild(card);
    // Toggle, wenn die Karte geklickt wird (außer beim direkten Klick auf das Input)
    const cb = card.querySelector("input[type='checkbox'][data-day='"+iso+"']");
    card.addEventListener('click', function(ev){
      if(ev.target === cb) return; // direkter Checkbox-Klick: Standard lassen
      cb.checked = !cb.checked;
      setCardVisual(iso, cb.checked);
    });
    // Auch beim direkten Klick Stil aktualisieren
    cb.addEventListener('change', function(){ setCardVisual(iso, cb.checked); });
  });

  function fetchAvailability(){ return fetch('/api/availability').then(r=>r.json()); }
  function renderNames(map){
    DATE_LIST.forEach(function(iso){
      const span=document.getElementById('list-'+iso);
      const cspan=document.getElementById('count-'+iso);
      const arr=(map.byDate[iso]||[]);
      span.textContent = arr.join(', ');
      if(cspan){ cspan.textContent = String(arr.length); }
    });
  }
  function fillOwn(map){
    const me = nameInput.value.trim().toLowerCase();
    const mine = map.byPerson[me] || [];
    const set=new Set(mine);
    document.querySelectorAll("input[type='checkbox'][data-day]").forEach(function(cb){
      const iso = cb.getAttribute('data-day');
      cb.checked = set.has(iso);
      setCardVisual(iso, cb.checked);
    });
  }

  function save(){
    const name = nameInput.value.trim(); if(!name){ saveStatus.textContent='Bitte Name eingeben'; saveStatus.className='text-sm text-red-600'; return; }
    const days = Array.from(document.querySelectorAll("input[type='checkbox'][data-day]:checked")).map(cb=>cb.getAttribute('data-day'));
    fetch('/api/availability',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name, days})})
      .then(r=>r.json()).then(data=>{ saveStatus.textContent='Gespeichert!'; saveStatus.className='text-sm text-green-700'; return fetchAvailability(); })
      .then(map=>{ renderNames(map); fillOwn(map); })
      .catch(()=>{ saveStatus.textContent='Fehler beim Speichern'; saveStatus.className='text-sm text-red-600'; });
  }

  saveBtn.addEventListener('click', save);

  // Initial laden
  fetchAvailability().then(function(map){ renderNames(map); fillOwn(map); });
})();
</script>
</body></html>`;

// ---------- Routes ----------
app.get('/', (req,res)=>{ res.setHeader('Content-Type','text/html; charset=utf-8'); res.send(PUBLIC_HTML); });
app.get('/dates', (req,res)=>{ res.setHeader('Content-Type','text/html; charset=utf-8'); res.send(DATES_HTML); });

// Zielabstimmung speichern
app.post('/api/vote', (req, res) => {
  const { name, selections } = req.body || {};
  if (!name || !Array.isArray(selections) || !selections.length) return res.status(400).json({ error: 'Ungültig' });
  const validIds = new Set(OPTIONS.map(o => o.id));
  const cleaned = Array.from(new Set(selections.filter(id => validIds.has(id))));
  const store = readStore();
  const idx = store.ballots.findIndex(b => b.name.trim().toLowerCase() === name.trim().toLowerCase());
  const ballot = { name: name.trim(), selections: cleaned, ts: Date.now() };
  if (idx >= 0) store.ballots[idx] = ballot; else store.ballots.push(ballot);
  writeStore(store);
  res.json({ ok: true });

  if (!writeStore(store)) return res.status(500).json({ ok: false, error: 'Speichern fehlgeschlagen' });
  return res.json({ ok: true });

});

// Verfügbarkeiten lesen/schreiben
app.get('/api/availability', (req,res)=>{
  const store = readStore();
  const byPerson = {};
  for (const [person, arr] of Object.entries(store.availability || {})) {
    byPerson[person.toLowerCase()] = Array.from(new Set(arr));
  }
  const byDate = {};
  for (const [person, arr] of Object.entries(store.availability || {})) {
    for (const d of arr) {
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(person);
    }
  }
  res.json({ byPerson, byDate });

  if (!writeStore(store)) return res.status(500).json({ ok: false, error: 'Speichern fehlgeschlagen' });
  return res.json({ ok: true });

});

app.post('/api/availability', (req,res)=>{
  const { name, days } = req.body || {};
  if (!name || !Array.isArray(days)) return res.status(400).json({ error: 'Ungültig' });
  const set = new Set(DATE_LIST);
  const cleaned = Array.from(new Set(days.filter(d => set.has(d))));
  const store = readStore();
  if (!store.availability) store.availability = {};
  store.availability[name.trim()] = cleaned;
  writeStore(store);
  res.json({ ok: true });


  if (!writeStore(store)) return res.status(500).json({ ok: false, error: 'Speichern fehlgeschlagen' });
  return res.json({ ok: true });
  
});

// ---------- Start ----------
app.listen(PORT, ()=>{ console.log(`✅ Server läuft auf http://localhost:${PORT}`); console.log('🗓️  Terminseite: /dates'); });
