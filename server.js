/**
 * Gruppen-Urlaubsabstimmung – Orte + Terminabstimmung + Ergebnis-Seite
 * - Seite 1: Zielwahl (mit Crossfade-Slideshow)
 * - Seite 2: Terminübersicht (10.–31.05.2025), Verfügbarkeiten je Tag speichern & anzeigen
 * - Seite 3: Ergebnis – Top-Ort + Konfetti + bester Zeitraum (max. Überschneidung)
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
@keyframes pulseIn { 0%{transform:scale(0.95);opacity:0} 100%{transform:scale(1);opacity:1} }
.pulse-in{animation:pulseIn .6s ease-out both}
</style>`;

const PUBLIC_HTML = `<!doctype html><html lang='de'><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width, initial-scale=1'/>${baseStyles}<title>Urlaubsabstimmung</title></head><body class='bg-gray-50 text-gray-900'><div class='max-w-5xl mx-auto p-6'>
<h1 class='text-3xl font-bold mb-2'>Urlaubsabstimmung 2025</h1><p class='text-sm text-gray-600 mb-6'>Wähle deine Favoriten. Mehrfachwahl erlaubt. Stimmen nur für Admin sichtbar.</p>
<form id='voteForm' class='space-y-6 bg-white rounded-2xl shadow p-6'>
<div><label for='name' class='block text-sm font-medium'>Dein Name</label><input id='name' name='name' type='text' required placeholder='z. B. Alex' class='mt-1 w-full border rounded-lg p-2'/></div>
<div class='grid sm:grid-cols-2 gap-4'>
${OPTIONS.map(o=>
  "<div class='border rounded-xl bg-gray-50 p-3 pulse-in'>" +
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
  if(form){ form.addEventListener('submit', function(e){ e.preventDefault(); status.textContent=''; var name=document.getElementById('name').value.trim(); var selections=[].slice.call(document.querySelectorAll("input[name='selections']:checked")).map(function(cb){return cb.value;}); if(!name){ status.textContent='Bitte Name eingeben'; status.className='text-red-600'; return; } if(selections.length===0){ status.textContent='Bitte mindestens ein Ziel wählen'; status.className='text-red-600'; return; } fetch('/api/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,selections:selections})}).then(async function(r){const t=await r.text();let d;try{d=JSON.parse(t);}catch{} if(!r.ok||!(d&&d.ok)){throw new Error((d&&d.error)||t||'Fehler');} return d;}).then(function(){ window.location.href='/dates?name='+encodeURIComponent(name); }).catch(function(err){ status.textContent='Fehler: '+(err&&err.message?err.message:'Netzwerkfehler'); status.className='text-red-600'; }); }); }
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
      .then(async (r)=>{ const t = await r.text(); let d; try{ d=JSON.parse(t);}catch{} if(!r.ok||!(d&&d.ok)){ throw new Error((d&&d.error)||t||'Fehler'); } return d; })
      .then(()=>{ window.location.href = '/result?name='+encodeURIComponent(name); })
      .catch(()=>{ saveStatus.textContent='Fehler beim Speichern'; saveStatus.className='text-sm text-red-600'; });
  }

  saveBtn.addEventListener('click', save);

  // Initial laden
  fetchAvailability().then(function(map){ renderNames(map); fillOwn(map); });
})();
</script>
</body></html>`;

// ---------- Seite 3: Ergebnis ----------
const RESULT_HTML = `<!doctype html><html lang="de"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
${baseStyles}
<title>Ergebnis</title>
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
<style>
.reveal { opacity:0; transform: translateY(10px); transition: all .7s ease; }
.reveal.show { opacity:1; transform: translateY(0); }
.big { font-size: clamp(2rem, 6vw, 4rem); line-height:1.1; }
.sub { font-size: clamp(1.25rem, 3vw, 2rem); }
</style>
</head>
<body class="bg-gray-50 text-gray-900">
<div class="max-w-5xl mx-auto p-6">
  <div class="bg-white rounded-2xl shadow p-8 md:p-12 text-center">
    <div class="big font-extrabold mb-4">Wir fahren nach …</div>
    <div id="place" class="big text-black font-extrabold reveal mb-6"></div>
    <div id="hero" class="relative rounded-2xl overflow-hidden h-64 md:h-80 bg-gray-200 shadow reveal"></div>
    <div id="period" class="reveal mt-8 sub font-semibold"></div>
    <div id="explain" class="reveal mt-2 text-sm text-gray-600"></div>
    <div class="mt-10">
      <a href="/" class="text-sm text-gray-600 underline">← Zurück zur Zielabstimmung</a>
    </div>
  </div>
</div>
<script>
(function(){
  const OPTIONS = ${JSON.stringify(OPTIONS)};
  const DATE_LIST = ${JSON.stringify(DATE_LIST)};
  const params = new URLSearchParams(window.location.search);
  const me = params.get('name') || '';

  function optionMap(){ const m={}; OPTIONS.forEach(o=>m[o.id]=o); return m; }
  const OMAP = optionMap();

  function fetchJSON(u){ return fetch(u).then(r=>r.json()); }

  // API: votes-summary (get tally) + availability
  Promise.all([fetchJSON('/api/summary'), fetchJSON('/api/availability')]).then(([sum,av])=>{
    // 1) Top-Ort bestimmen
    const entries = Object.keys(sum.tally).map(k=>[k, sum.tally[k]]);
    entries.sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));
    const top = entries.length? entries[0][0] : null;
    const topOpt = top ? OMAP[top] : null;

    // Animation Place + Konfetti
    setTimeout(()=>{
      if(topOpt){
        document.getElementById('place').textContent = topOpt.title;
        document.getElementById('place').classList.add('show');
        // Konfetti
        const duration = 2000, end = Date.now() + duration;
        (function frame(){
          confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
          confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
          if(Date.now() < end) requestAnimationFrame(frame);
        })();
      } else {
        document.getElementById('place').textContent = '—';
        document.getElementById('place').classList.add('show');
      }
    }, 900);

    // 2) Hero-Slideshow
    const hero = document.getElementById('hero');
    function addImg(id){ const img=document.createElement('img'); img.className='absolute inset-0 w-full h-full object-cover fade-layer fade-hidden'; img.src=id; img.onload=()=>{}; hero.appendChild(img); return img; }
    function preload(url){ return new Promise(res=>{ const i=new Image(); i.onload=()=>res(true); i.onerror=()=>res(false); i.src=url; }); }
    function startHero(id){
      const base = '/images/'+id+'/';
      const candidates = []; for(let i=1;i<=10;i++) candidates.push(base+i+'.jpg');
      const imgs=[], urls=[];
      // container vorbereiten
      hero.innerHTML='';
      hero.classList.add('show');
      // lade gültige URLs nacheinander
      (async function(){
        for(const u of candidates){ if(await preload(u)) urls.push(u); }
        if(urls.length===0){ const fallback = OMAP[id]?.image; if(fallback){ urls.push(fallback); } }
        if(urls.length===0){ return; }
        // zwei Layer für Crossfade anlegen
        const A = addImg(urls[0]); const B = addImg(urls[0]);
        A.classList.remove('fade-hidden'); A.classList.add('fade-visible');
        let activeA = true, idx=0;
        setInterval(async ()=>{
          if(urls.length<2) return;
          idx=(idx+1)%urls.length; const next=urls[idx];
          const front = activeA?A:B, back=activeA?B:A;
          back.classList.add('fade-hidden'); back.classList.remove('fade-visible');
          // Preload ohne Blinken
          await preload(next); back.src = next;
          requestAnimationFrame(()=>{
            front.classList.add('fade-hidden'); front.classList.remove('fade-visible');
            back.classList.remove('fade-hidden'); back.classList.add('fade-visible');
            activeA = !activeA;
          });
        }, 5000);
      })();
    }
    if(top) startHero(top);

    // 3) Besten Zeitraum berechnen (Standard: 7 Nächte = 8 Tage)
    function bestWindow(avMap, daysList, nights){
      const len = nights + 1; // Nächte -> Tage
      const byDate = avMap.byDate || {};
      const bySet = {}; for(const d of daysList){ bySet[d] = new Set(byDate[d]||[]); }
      function intersectMany(arrDates){
        if(arrDates.length===0) return new Set();
        let inter = new Set(bySet[arrDates[0]]);
        for(let i=1;i<arrDates.length;i++){
          const s = bySet[arrDates[i]];
          inter = new Set([...inter].filter(x=>s.has(x)));
          if(inter.size===0) break;
        }
        return inter;
      }
      let best = { start:null, end:null, size:0, names:[] };
      for(let i=0;i+len-1<daysList.length;i++){
        const windowDates = daysList.slice(i, i+len);
        const inter = intersectMany(windowDates);
        const size = inter.size;
        if(size > best.size){
          best = { start: windowDates[0], end: windowDates[len-1], size, names: [...inter].sort() };
        }
      }
      return best;
    }
    const best = bestWindow(av, ${JSON.stringify(DATE_LIST)}, 7); // 7 Nächte

    // Anzeige Zeitraum
    function fmtDE(iso){
      const [y,m,d]=iso.split('-'); return d+'.'+m+'.'+y;
    }
    const period = document.getElementById('period');
    const explain = document.getElementById('explain');
    setTimeout(()=>{
      period.classList.add('show');
      if(best && best.start){
        period.innerHTML = "Bester Zeitraum: <span class='font-bold'>"+fmtDE(best.start)+"</span> bis <span class='font-bold'>"+fmtDE(best.end)+"</span>";
        explain.classList.add('show');
        const who = best.names.length ? (" ("+best.names.join(', ')+")") : "";
        explain.textContent = "An allen Tagen in diesem Zeitraum können "+best.size+" Personen"+who+".";
      } else {
        period.textContent = "Noch zu wenig Daten für eine Empfehlung.";
        explain.classList.add('show');
        explain.textContent = "Sobald mehr Verfügbarkeiten eingetragen sind, berechnen wir die beste Überschneidung.";
      }
    }, 1500);
  });
})();
</script>
</body></html>`;

// ---------- Routes ----------
app.get('/', (req,res)=>{ res.setHeader('Content-Type','text/html; charset=utf-8'); res.send(PUBLIC_HTML); });
app.get('/dates', (req,res)=>{ res.setHeader('Content-Type','text/html; charset=utf-8'); res.send(DATES_HTML); });
app.get('/result', (req,res)=>{ res.setHeader('Content-Type','text/html; charset=utf-8'); res.send(RESULT_HTML); });

// Zielabstimmung speichern
app.post('/api/vote', (req, res) => {
  const { name, selections } = req.body || {};
  if (!name || !Array.isArray(selections) || !selections.length) return res.status(400).json({ ok:false, error: 'Ungültig' });
  const validIds = new Set(OPTIONS.map(o => o.id));
  const cleaned = Array.from(new Set(selections.filter(id => validIds.has(id))));
  const store = readStore();
  const idx = store.ballots.findIndex(b => b.name.trim().toLowerCase() === name.trim().toLowerCase());
  const ballot = { name: name.trim(), selections: cleaned, ts: Date.now() };
  if (idx >= 0) store.ballots[idx] = ballot; else store.ballots.push(ballot);
  if (!writeStore(store)) return res.status(500).json({ ok:false, error:'Speichern fehlgeschlagen' });
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
});

app.post('/api/availability', (req,res)=>{
  const { name, days } = req.body || {};
  if (!name || !Array.isArray(days)) return res.status(400).json({ ok:false, error: 'Ungültig' });
  const set = new Set(DATE_LIST);
  const cleaned = Array.from(new Set(days.filter(d => set.has(d))));
  const store = readStore();
  if (!store.availability) store.availability = {};
  store.availability[name.trim()] = cleaned;
  if (!writeStore(store)) return res.status(500).json({ ok:false, error:'Speichern fehlgeschlagen' });
  return res.json({ ok: true });
});

// Summary für Ergebnis-Seite (Tally)
app.get('/api/summary', (req,res)=>{
  const store = readStore();
  const tally = {};
  for (const o of OPTIONS) tally[o.id] = 0;
  for (const b of store.ballots) {
    for (const id of b.selections) if (tally.hasOwnProperty(id)) tally[id] += 1;
  }
  res.json({ tally, totalBallots: store.ballots.length });
});

// ---------- Start ----------
app.listen(PORT, ()=>{ 
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
  console.log('🗓️  Terminseite: /dates');
  console.log('🏁 Ergebnis-Seite: /result');
});
