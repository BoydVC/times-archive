(function(){
'use strict';
const A = window.ARCHIVE, E = A.editions, SNAP = !!window.SNAPSHOT;
const $ = s => document.querySelector(s);
const app = $('#app'), tip = $('#tip');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const src = p => (window.IMGS && window.IMGS[p]) || p;
const byId = Object.fromEntries(E.map(e => [e.id, e]));
const byDate = {}; E.forEach(e => (byDate[e.date] = byDate[e.date] || []).push(e));
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const parseD = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fmtShort = s => { const d = parseD(s); return `${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`; };
const fmtLong = s => { const d = parseD(s); return `${d.toLocaleDateString('en-US',{weekday:'long'})}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
const lead = e => (e.headlines.find(h => h.kind === 'lead') || e.headlines[0] || {headline: '(no verified headline)'});
const STAMP = {printed: 'Printed', 'pdf-only': 'PDF only', unknown: 'No print log'};
const stamp = e => `<span class="stampx ${e.print.status}">${STAMP[e.print.status]}${e.print.planned ? '*' : ''}</span>`;
const todayISO = () => { const q = new URLSearchParams(location.hash.split('?')[1] || ''); return q.get('today') || iso(new Date()); };
const totalPages = E.reduce((a, e) => a + e.pages.length, 0);
const totalWords = E.reduce((a, e) => a + e.words, 0);
const last = E[E.length - 1];

$('#earR').innerHTML = `${E.length} editions · ${totalPages} pages<br>${fmtShort(A.range.first)} – ${fmtShort(A.range.last)}, ${A.range.last.slice(0,4)}`;
$('#dlL').textContent = fmtLong(todayISO());
$('#dlR').textContent = `Vol. 1 · Nos. 1–${last.num}`;
$('#built').textContent = 'Index built ' + A.built_at.replace('T', ' ').slice(0, 16) + ' ET';

function showTip(ev, html){ tip.innerHTML = html; tip.style.display = 'block'; const x = Math.min(ev.clientX + 14, innerWidth - 360); tip.style.left = x + 'px'; tip.style.top = (ev.clientY + 16) + 'px'; }
function hideTip(){ tip.style.display = 'none'; }
document.addEventListener('mouseover', ev => { const t = ev.target.closest('[data-tip]'); if (t) showTip(ev, t.dataset.tip); });
document.addEventListener('mousemove', ev => { const t = ev.target.closest('[data-tip]'); if (t) showTip(ev, t.dataset.tip); else hideTip(); });

/* ---------------- this day in Parent A history ---------------- */
function historyItems(D){
  const d = parseD(D), out = [];
  const add = (label, dt) => { const k = iso(dt); out.push({label, date: k, eds: byDate[k] || []}); };
  add('This date', d);
  const w1 = new Date(d); w1.setDate(d.getDate() - 7); add('One week ago', w1);
  const w2 = new Date(d); w2.setDate(d.getDate() - 14); add('Two weeks ago', w2);
  const w3 = new Date(d); w3.setDate(d.getDate() - 21); add('Three weeks ago', w3);
  const m1 = new Date(d); m1.setMonth(d.getMonth() - 1); if (m1.getDate() === d.getDate()) add('One month ago', m1);
  return out;
}
function historyCard(D){
  const items = historyItems(D);
  const rows = items.map(it => {
    if (!it.eds.length) {
      const why = it.date < A.range.first ? `before the first edition (${fmtShort(A.range.first)})` : (it.date > A.range.last ? 'not published yet' : 'no edition saved');
      return `<div class="hist-item" style="cursor:default;opacity:.62"><div></div><div><div class="when">${it.label} · ${fmtShort(it.date)}</div><div class="h" style="font-family:NewsDeck;font-style:italic">No paper — ${why}.</div></div></div>`;
    }
    return it.eds.map(e => `<div class="hist-item" onclick="location.hash='#/read/${e.id}'"><img src="${src(e.pages[0].thumb)}" alt=""><div><div class="when">${it.label} · ${e.weekday.slice(0,3)} ${fmtShort(e.date)} · No. ${e.num}</div><div class="h">${esc(lead(e).headline)}</div>${e.standing.dad_joke && it.label!=='This date' ? `<div class="note" style="margin-top:4px">Dad joke that day: ${esc(e.standing.dad_joke.text)}</div>` : ''}</div></div>`).join('');
  }).join('');
  return `<div class="card history"><div class="kick">This day in Parent A history</div><h3>${fmtLong(D)}</h3>
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="date" id="histDate" value="${D}" min="${A.range.first}" style="font-family:Franklin;border:1px solid var(--ink);background:transparent;padding:3px 6px"><button class="btn" id="histRand" style="padding:4px 9px">Surprise me</button></div>
    ${rows}</div>`;
}
function wireHistory(container){
  const inp = container.querySelector('#histDate'), r = container.querySelector('#histRand');
  const rerender = D => { const h = container.querySelector('.history'); h.outerHTML = historyCard(D); wireHistory(container); };
  if (inp) inp.onchange = () => rerender(inp.value);
  if (r) r.onclick = () => rerender(E[Math.floor(Math.random() * E.length)].date);
}

/* ---------------- front page ---------------- */
function viewHome(){
  const L = lead(last);
  const topicTot = {}; E.forEach(e => Object.entries(e.topics).forEach(([k, v]) => topicTot[k] = (topicTot[k] || 0) + v));
  const top = Object.entries(topicTot).sort((a, b) => b[1] - a[1]).slice(0, 6), mx = top[0][1];
  const printed = E.filter(e => e.print.status === 'printed').length, pdfo = E.filter(e => e.print.status === 'pdf-only').length;
  const recent = E.slice(-8).reverse();
  const sf = last.standing;
  app.innerHTML = `<div class="homegrid fadein">
   <section>
     <div class="kick">Latest edition · No. ${last.num} · ${esc(last.as_of || '')}</div>
     <h2 class="lead-hed"><a href="#/read/${last.id}">${esc(L.headline)}</a></h2>
     ${L.deck ? `<p class="deck">${esc(L.deck)}</p>` : ''}
     <img class="frontimg" src="${src(last.pages[0].img)}" alt="Front page ${last.date}" onclick="location.hash='#/read/${last.id}'">
   </section>
   <section>${historyCard(todayISO())}
     ${sf.dad_joke ? `<div style="margin-top:20px"><div class="kick">Today's dad joke, as printed</div><div class="quote">${esc(sf.dad_joke.text)}</div><div class="note">— ${esc(sf.dad_joke.attribution || '')}</div></div>` : ''}
     ${sf.verse ? `<div style="margin-top:14px"><div class="kick">Verse of the day</div><div class="quote">${esc(sf.verse.text)}</div><div class="note">${esc(sf.verse.citation || '')}</div></div>` : ''}
   </section>
   <section>
     <div class="kick">The archive in numbers</div>
     <div class="stats"><div class="stat"><b>${E.length}</b><span class="label">editions</span></div><div class="stat"><b>${totalPages}</b><span class="label">pages</span></div>
     <div class="stat"><b>${(totalWords/1000).toFixed(0)}k</b><span class="label">words printed</span></div><div class="stat"><b>${printed}<span style="font-size:20px"> / ${pdfo}</span></b><span class="label">printed / PDF-only</span></div></div>
     <div class="kick" style="margin-top:18px">Most-covered beats</div>
     ${top.map(([k, v]) => `<div class="barrow" style="grid-template-columns:130px 1fr 40px"><span style="font-size:13px">${esc(k)}</span><div class="bar" style="width:${(v / mx * 100).toFixed(0)}%"></div><span class="n">${v}</span></div>`).join('')}
     <div class="note" style="margin-top:4px">Mentions counted in the printed text. <a href="#/trends">All trends →</a></div>
     <div class="kick" style="margin-top:20px">Recent front pages</div>
     <ul class="briefs">${recent.map(e => `<li><a href="#/read/${e.id}" style="text-decoration:none"><span class="label">${e.weekday.slice(0,3)} ${fmtShort(e.date)}</span><br>${esc(lead(e).headline)}</a></li>`).join('')}</ul>
   </section></div>`;
  wireHistory(app);
}

/* ---------------- newsstand wall ---------------- */
let wallOrder = 'new';
function viewWall(){
  const list = wallOrder === 'new' ? E.slice().reverse() : E.slice();
  const perShelf = 6, shelves = [];
  for (let i = 0; i < list.length; i += perShelf) shelves.push(list.slice(i, i + perShelf));
  app.innerHTML = `<div class="fadein"><h2 class="sec">The Newsstand</h2><p class="deck">Every front page, racked by date. Pick one up to read it.</p>
   <div class="wallbar"><button class="btn ${wallOrder==='new'?'on':''}" data-o="new">Newest first</button><button class="btn ${wallOrder==='old'?'on':''}" data-o="old">Oldest first</button>
   <span class="legend" style="margin:0 0 0 auto"><span class="printed">Printed at home</span><span class="pdf-only">PDF only</span><span class="unknown">No print log</span></span></div>
   <div class="rack">${shelves.map(s => `<div class="shelf">${s.map(e => `<div class="paper" onclick="location.hash='#/read/${e.id}'" data-tip="<b>${esc(fmtLong(e.date))}</b><br>${esc(lead(e).headline)}<br><i>${esc(e.print.text || '')}</i>"><img loading="lazy" src="${src(e.pages[0].thumb)}" alt="${e.date}"><span class="stamp">${stamp(e)}</span><div class="tag">${e.weekday.slice(0,3)} · ${fmtShort(e.date)} · No.${e.num}</div></div>`).join('')}</div><div class="rackrail"></div>`).join('')}</div></div>`;
  app.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { wallOrder = b.dataset.o; viewWall(); });
}

/* ---------------- reader ---------------- */
let R = {id: null, page: 1, text: false, q: ''};
function hiRegex(q){
  const terms = parseQuery(q).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]").replace(/\s+/g, '\\s+'));
  return terms.length ? new RegExp('(' + terms.join('|') + ')', 'gi') : null;
}
function highlight(text, q){ const rx = hiRegex(q); const t = esc(text); return rx ? t.replace(rx, '<mark>$1</mark>') : t; }
function viewReader(id, page, q){
  const e = byId[id] || last; R.id = e.id; R.page = Math.max(1, Math.min(page || 1, e.pages.length)); if (q !== undefined) { R.q = q; if (q) R.text = true; }
  const idx = E.indexOf(e), prev = E[idx - 1], next = E[idx + 1], sf = e.standing;
  app.innerHTML = `<div class="reader fadein">
   <aside><div class="kick" style="margin-bottom:6px">All editions</div><div class="edlist">${E.slice().reverse().map(x => `<a href="#/read/${x.id}" class="${x.id===e.id?'on':''}"><small>${x.weekday.slice(0,3)} ${fmtShort(x.date)} · No. ${x.num}</small>${esc(lead(x).headline)}</a>`).join('')}</div></aside>
   <div>
     <div class="book" id="book"><img class="pg" id="pgimg" src="${src(e.pages[R.page-1].img)}" alt="page"><div class="hotL" id="hotL" title="Previous page"></div><div class="hotR" id="hotR" title="Next page"></div></div>
     <div class="flipnav"><button class="btn" id="bPrev">◀ Prev</button><span class="label" id="pglabel"></span><button class="btn" id="bNext">Next ▶</button><button class="btn ${R.text?'on':''}" id="bText">Read text</button></div>
     <div class="pagedots">${e.pages.map(p => `<img src="${src(p.thumb)}" data-p="${p.n}" title="Page ${p.n} · ${esc(p.section)}">`).join('')}</div>
     <div id="tp"></div>
   </div>
   <aside class="meta">
     <div class="kick">${esc(e.paper)} · ${esc(e.volume || '')}</div>
     <h3>${esc(fmtLong(e.date))}</h3>
     <div style="margin:-4px 0 10px">${stamp(e)} <span class="note">${esc(e.as_of || '')}</span></div>
     <div class="note" style="margin-bottom:12px">${esc(e.print.text || '')}${e.print.caveat ? ' · ' + esc(e.print.caveat) : ''}</div>
     ${e.weather ? `<div class="label" style="margin-bottom:10px">Forecast printed: ${e.weather.high}° / ${e.weather.low}°</div>` : ''}
     <div class="kick" style="margin-top:6px">Headlines in this edition</div>
     <ul class="hedlist">${e.headlines.map(h => `<li><span class="kick">${esc(h.kicker)}</span>${esc(h.headline)}</li>`).join('')}</ul>
     ${sf.dad_joke ? `<div class="kick" style="margin-top:14px">Dad joke</div><div class="quote" style="font-size:15px">${esc(sf.dad_joke.text)}</div>` : ''}
     ${sf.quote ? `<div class="kick" style="margin-top:10px">Sports quote</div><div class="quote" style="font-size:15px">“${esc(sf.quote.text)}” — ${esc(sf.quote.attribution || '')}</div>` : ''}
     <div style="display:flex;gap:6px;margin-top:16px;flex-wrap:wrap">${prev ? `<a class="btn" href="#/read/${prev.id}">◀ ${fmtShort(prev.date)}</a>` : ''}${next ? `<a class="btn" href="#/read/${next.id}">${fmtShort(next.date)} ▶</a>` : ''}${SNAP ? '' : `<a class="btn" href="/pdf/${e.id}" target="_blank">Open PDF</a>`}</div>
     ${e.variants.length ? `<div class="note" style="margin-top:10px">Also saved: ${e.variants.map(v => esc(v.split('/').pop())).join(', ')}</div>` : ''}
   </aside></div>`;
  const setLabel = () => { $('#pglabel').textContent = `Page ${R.page} of ${e.pages.length} · ${e.pages[R.page-1].section}`; app.querySelectorAll('.pagedots img').forEach(i => i.classList.toggle('on', +i.dataset.p === R.page)); renderText(); };
  const renderText = () => { const tp = $('#tp'); if (!R.text) { tp.innerHTML = ''; return; } tp.innerHTML = `<div class="textpane">${highlight(e.pages[R.page-1].text, R.q)}</div>`; const pane = tp.querySelector('.textpane'), m = tp.querySelector('mark'); if (m && R.q) pane.scrollTop = Math.max(0, m.offsetTop - pane.offsetTop - 80); };
  setLabel();
  let busy = false;
  const flip = (to) => {
    if (busy || to === R.page) return;
    if (to < 1) { if (prev) location.hash = `#/read/${prev.id}/${prev.pages.length}`; return; }
    if (to > e.pages.length) { if (next) location.hash = `#/read/${next.id}`; return; }
    busy = true; const book = $('#book'), img = $('#pgimg'), fwd = to > R.page;
    const leaf = document.createElement('div'); leaf.className = 'leaf';
    const cur = src(e.pages[R.page-1].img), tgt = src(e.pages[to-1].img);
    if (fwd) { leaf.innerHTML = `<div class="face"><img src="${cur}"></div><div class="face back"></div>`; img.src = tgt; leaf.style.transform = 'rotateY(0deg)'; }
    else { leaf.innerHTML = `<div class="face"><img src="${tgt}"></div><div class="face back"></div>`; leaf.style.transform = 'rotateY(-180deg)'; }
    book.appendChild(leaf); void leaf.offsetWidth;
    leaf.style.transform = fwd ? 'rotateY(-180deg)' : 'rotateY(0deg)';
    setTimeout(() => { img.src = tgt; leaf.remove(); busy = false; }, 870);
    R.page = to; history.replaceState(null, '', `#/read/${e.id}/${to}${R.q ? '?q=' + encodeURIComponent(R.q) : ''}`); setLabel();
  };
  $('#bPrev').onclick = $('#hotL').onclick = () => flip(R.page - 1);
  $('#bNext').onclick = $('#hotR').onclick = () => flip(R.page + 1);
  $('#bText').onclick = () => { R.text = !R.text; $('#bText').classList.toggle('on', R.text); renderText(); };
  app.querySelectorAll('.pagedots img').forEach(i => i.onclick = () => flip(+i.dataset.p));
  document.onkeydown = ev => { if (ev.target.tagName === 'INPUT') return; if (ev.key === 'ArrowRight') flip(R.page + 1); if (ev.key === 'ArrowLeft') flip(R.page - 1); };
  const on = app.querySelector('.edlist a.on'), el = app.querySelector('.edlist'); if (on && el) el.scrollTop = on.offsetTop - el.offsetTop - el.clientHeight / 2 + on.clientHeight / 2;
  // preload neighbours
  e.pages.forEach(p => { const im = new Image(); im.src = src(p.img); });
}

/* ---------------- search ---------------- */
const normT = s => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, '-').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const IDX = E.map(e => ({e, pages: e.pages.map(p => ({p, n: normT(p.text)})), heads: normT(e.headlines.map(h => h.headline).join(' \n '))}));
function parseQuery(q){ const out = []; (q || '').replace(/"([^"]+)"|(\S+)/g, (m, a, b) => { const t = normT((a || b).trim()); if (t) out.push(t); }); return out; }
function countIn(n, t){ let c = 0, i = 0; while ((i = n.indexOf(t, i)) !== -1) { c++; i += t.length; } return c; }
function snippet(text, term){
  const n = normT(text), i = n.indexOf(term); if (i < 0) return null;
  const a = Math.max(0, i - 90), b = Math.min(text.length, i + term.length + 110);
  return (a > 0 ? '…' : '') + text.slice(a, b).replace(/\s+/g, ' ') + (b < text.length ? '…' : '');
}
let S = {q: '', sec: 'All', sort: 'rel'};
function runSearch(){
  const terms = parseQuery(S.q); if (!terms.length) return [];
  const res = [];
  for (const it of IDX) {
    const pages = it.pages.filter(pp => S.sec === 'All' || pp.p.section.startsWith(S.sec));
    const all = pages.map(pp => pp.n).join('\n') + '\n' + it.heads;
    if (!terms.every(t => all.includes(t))) continue;
    let score = 0; const snips = [];
    pages.forEach(pp => terms.forEach(t => { const c = countIn(pp.n, t); score += c; if (c && snips.length < 4) { const s = snippet(pp.p.text, t); if (s) snips.push({page: pp.p.n, sec: pp.p.section, s}); } }));
    terms.forEach(t => score += countIn(it.heads, t) * 5);
    res.push({e: it.e, score, snips});
  }
  if (S.sort === 'rel') res.sort((a, b) => b.score - a.score || b.e.date.localeCompare(a.e.date));
  else if (S.sort === 'new') res.sort((a, b) => b.e.date.localeCompare(a.e.date) || b.e.num - a.e.num);
  else res.sort((a, b) => a.e.date.localeCompare(b.e.date) || a.e.num - b.e.num);
  return res;
}
const SUGGEST = ['Marty', 'Kid School', 'Ravens', 'HSPT', 'Picture Day', 'rain', 'Confirmation', 'nebula', 'Terps', '"Dear Times"', 'Orioles', 'Team Alpha'];
function viewSearch(q){
  if (q !== undefined) S.q = q;
  const secs = ['All', ...new Set(E.flatMap(e => e.pages.map(p => p.section.split(' · ')[0])))];
  app.innerHTML = `<div class="fadein"><h2 class="sec">Search the Archive</h2><p class="deck">Full text of every page of every edition. Use quotes for exact phrases.</p>
   <div class="searchbox"><input id="q" placeholder="Try Marty, Kid School, &quot;Picture Day&quot;…" value="${esc(S.q)}" autofocus></div>
   <div class="chips">${SUGGEST.map(s => `<button class="chip" data-s='${esc(s)}'>${esc(s)}</button>`).join('')}</div>
   <div class="wallbar"><span class="label">Section</span>${secs.map(s => `<button class="btn ${S.sec===s?'on':''}" data-sec="${esc(s)}" style="padding:4px 9px">${esc(s)}</button>`).join('')}
    <span class="label" style="margin-left:auto">Sort</span>${[['rel','Most hits'],['new','Newest'],['old','Oldest']].map(([k,l]) => `<button class="btn ${S.sort===k?'on':''}" data-sort="${k}" style="padding:4px 9px">${l}</button>`).join('')}</div>
   <div id="res"></div></div>`;
  const inp = $('#q'); let t;
  inp.oninput = () => { clearTimeout(t); t = setTimeout(() => { S.q = inp.value; history.replaceState(null, '', '#/search?q=' + encodeURIComponent(S.q)); renderRes(); }, 140); };
  app.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { inp.value = S.q = b.dataset.s; history.replaceState(null, '', '#/search?q=' + encodeURIComponent(S.q)); renderRes(); });
  app.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { S.sec = b.dataset.sec; viewSearch(); });
  app.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { S.sort = b.dataset.sort; viewSearch(); });
  inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
  renderRes();
}
function renderRes(){
  const box = $('#res'); if (!S.q.trim()) { box.innerHTML = `<p class="note">Type to search ${E.length} editions and ${totalPages} pages. Searching happens on this page, offline.</p>`; return; }
  const res = runSearch(), terms = parseQuery(S.q);
  const perEd = Object.fromEntries(res.map(r => [r.e.id, r.score])), mx = Math.max(1, ...res.map(r => r.score));
  const total = res.reduce((a, r) => a + r.score, 0);
  box.innerHTML = `<div class="label">${res.length} edition${res.length===1?'':'s'} · ${total} hit${total===1?'':'s'} for ${esc(S.q)}</div>
   <div class="hitbar">${E.map(e => `<div class="${perEd[e.id]?'':'z'}" style="height:${perEd[e.id] ? Math.max(6, perEd[e.id] / mx * 100) : 2}%" data-tip="${esc(fmtShort(e.date))}: ${perEd[e.id]||0} hits"></div>`).join('')}</div>
   ${res.map(r => `<div class="result"><img src="${src(r.e.pages[0].thumb)}" onclick="location.hash='#/read/${r.e.id}/1?q=${encodeURIComponent(S.q)}'"><div>
     <div class="label">${r.e.weekday} ${fmtShort(r.e.date)} · No. ${r.e.num} · ${r.score} hit${r.score===1?'':'s'}</div>
     <div class="h" onclick="location.hash='#/read/${r.e.id}/${(r.snips[0]||{page:1}).page}?q=${encodeURIComponent(S.q)}'">${highlight(lead(r.e).headline, S.q)}</div>
     ${r.snips.map(s => `<div class="snip"><a href="#/read/${r.e.id}/${s.page}?q=${encodeURIComponent(S.q)}"><span class="pg">P.${s.page} ${esc(s.sec.toUpperCase())}</span>${highlight(s.s, S.q)}</a></div>`).join('')}
   </div></div>`).join('') || '<p class="deck">No edition mentions that. Nothing invented to fill the space.</p>'}`;
}

/* ---------------- trends ---------------- */
const TOPIC_Q = {'Kid School':'Kid School','Ravens':'Ravens','Terps':'Terps','Orioles':'Orioles','Bravo / Blue baseball':'Blue','Team Alpha':'Team Alpha','Kid Club / Delta soccer':'Kid Club','Rain & storms':'rain','Sunshine':'sunny','School (Kid School / KS)':'Kid School','HSPT & high-school search':'HSPT','Faith (Mass / Confirmation)':'Confirmation','Space & science':'NASA','AI & tech':'AI','Work calendar':'Zoom','Puzzles & comics':'crossword','Parent A':'Parent A','Parent B':'Parent B','Kid B (Kid B)':'Kid B','Kid A (Kid A)':'Kid A','Marty (the dog)':'Marty'};
function heat(rows, getter){
  const months = E.map((e, i) => (i === 0 || E[i-1].date.slice(5,7) !== e.date.slice(5,7)) ? MONTHS[+e.date.slice(5,7)-1].slice(0,3) : '');
  return `<table class="heat"><tr><th></th>${E.map((e, i) => `<th>${months[i] ? `<span style="color:var(--red)">${months[i]}</span><br>` : '<br>'}${+e.date.slice(8)}</th>`).join('')}<th></th></tr>
   ${rows.map(name => { const vals = E.map(e => getter(e, name)); const mx = Math.max(1, ...vals), tot = vals.reduce((a, b) => a + b, 0);
     return `<tr><th class="row">${esc(name)}</th>${vals.map((v, i) => `<td style="background:rgba(23,21,18,${v ? (0.12 + 0.88 * v / mx).toFixed(2) : 0.03});color:${v / mx > .5 ? '#f3ecdc' : '#171512'}" data-tip="<b>${esc(name)}</b> · ${esc(fmtLong(E[i].date))}<br>${v} mention${v===1?'':'s'} · ${esc(lead(E[i]).headline)}" onclick="location.hash='#/search?q=${encodeURIComponent(TOPIC_Q[name] || name)}'">${v || ''}</td>`).join('')}<td class="tot">${tot}</td></tr>`; }).join('')}</table>`;
}
function viewTrends(){
  const topics = A.topics_def.map(t => t.name), people = A.people_def.map(p => p.name);
  const tTot = topics.map(n => [n, E.reduce((a, e) => a + e.topics[n], 0)]).sort((a, b) => b[1] - a[1]);
  const pTot = people.map(n => [n, E.reduce((a, e) => a + e.people[n], 0)]).sort((a, b) => b[1] - a[1]);
  const ap = A.auto_people.slice(0, 12), apMx = Math.max(1, ...ap.map(x => x.mentions)), pMx = pTot[0][1];
  // topic of the week (Mon-Sun)
  const weeks = {}; E.forEach(e => { const d = parseD(e.date); const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const k = iso(m); (weeks[k] = weeks[k] || []).push(e); });
  const wk = Object.entries(weeks).map(([k, eds]) => { const tot = {}; eds.forEach(e => topics.forEach(n => tot[n] = (tot[n] || 0) + e.topics[n])); const best = Object.entries(tot).sort((a, b) => b[1] - a[1])[0]; return {k, eds, best}; });
  app.innerHTML = `<div class="fadein"><h2 class="sec">Trends</h2><p class="deck">What the paper actually talked about, counted word by word from the printed pages. Darker means more mentions that day.</p>
   <div class="kick">Beats, edition by edition</div>${heat(topics, (e, n) => e.topics[n])}
   <p class="note">Click any cell to search it. Each beat is a fixed list of words matched in the PDF text (patterns are listed under Sources &amp; Gaps). “Rain &amp; storms” and “Sunshine” count weather words anywhere, including forecasts.</p>
   <div class="kick" style="margin-top:22px">The family, edition by edition</div>${heat(people, (e, n) => e.people[n])}
   <div class="twocol" style="margin-top:26px">
    <div><div class="kick">Family mentions, all editions</div>${pTot.map(([k, v]) => `<div class="barrow"><span>${esc(k)}</span><div class="bar" style="width:${(v / pMx * 100).toFixed(0)}%"></div><span class="n">${v}</span></div>`).join('')}
     <div class="kick" style="margin-top:20px">Other named people in print</div>${ap.map(x => `<div class="barrow"><span><a href="#/search?q=${encodeURIComponent('"' + x.name + '"')}">${esc(x.name)}</a></span><div class="bar" style="width:${(x.mentions / apMx * 100).toFixed(0)}%;background:var(--red)"></div><span class="n">${x.mentions}</span></div>`).join('')}
     <p class="note">Auto-detected two-word names (common first name + capitalized surname) seen in at least two editions, with schools and places screened out.</p></div>
    <div><div class="kick">Beat of the week</div>${wk.map(w => `<div class="hist-item" style="grid-template-columns:110px 1fr;cursor:default"><div class="when" style="padding-top:3px">Week of ${fmtShort(w.k)}</div><div><div class="h">${esc(w.best[0])} <span class="note">· ${w.best[1]} mentions in ${w.eds.length} edition${w.eds.length===1?'':'s'}</span></div></div></div>`).join('')}
     <div class="kick" style="margin-top:20px">Beat totals</div>${tTot.map(([k, v]) => `<div class="barrow"><span>${esc(k)}</span><div class="bar" style="width:${(v / tTot[0][1] * 100).toFixed(0)}%"></div><span class="n">${v}</span></div>`).join('')}</div>
   </div></div>`;
}

/* ---------------- print timeline ---------------- */
function viewTimeline(){
  const c = s => E.filter(e => e.print.status === s).length;
  app.innerHTML = `<div class="fadein"><h2 class="sec">The Print Log</h2><p class="deck">Which mornings the paper came off the home HP, and which stayed a PDF, taken from the bot's own logs and draft notes.</p>
   <div class="legend"><span class="printed">Printed (${c('printed')})</span><span class="pdf-only">PDF only (${c('pdf-only')})</span><span class="unknown">No print outcome logged (${c('unknown')})</span><span style="margin-left:auto">* planned PDF-only mode, no outcome logged</span></div>
   <div class="strip">${E.map(e => `<div class="${e.print.status}" data-tip="<b>${esc(fmtShort(e.date))} · No. ${e.num}</b><br>${esc(STAMP[e.print.status])}<br>${esc(e.print.text || '')}"></div>`).join('')}</div>
   <div style="display:flex;justify-content:space-between" class="label"><span>${fmtShort(A.range.first)}</span><span>${fmtShort(A.range.last)}</span></div>
   <div class="tl" style="margin-top:20px">${E.map(e => `<div class="day ${e.print.status}" onclick="location.hash='#/read/${e.id}'" data-tip="<b>${esc(fmtLong(e.date))}</b> · No. ${e.num}<br>${esc(e.print.text || '')}${e.print.caveat ? '<br><i>' + esc(e.print.caveat) + '</i>' : ''}<br><span style='opacity:.7'>Source: ${esc(e.print.source || 'none')}</span>"><div class="d">${e.weekday.slice(0,3)} ${fmtShort(e.date)}</div><img loading="lazy" src="${src(e.pages[0].thumb)}" alt="">${stamp(e)}</div>`).join('')}</div>
   <div class="kick" style="margin-top:28px">Evidence, edition by edition</div>
   <table class="heat" style="font-family:Franklin;font-size:12px;margin-top:6px">${E.map(e => `<tr><td class="tot" style="width:110px">${fmtShort(e.date)} · No. ${e.num}</td><td class="tot" style="width:110px">${stamp(e)}</td><td class="tot" style="font-weight:400;white-space:normal">${esc(e.print.text || '')}${e.print.caveat ? ' — ' + esc(e.print.caveat) : ''}<br><span class="note">${esc(e.print.source || 'no log source')}</span></td></tr>`).join('')}</table>
   <p class="note">“Printed” means the print queue reported the job complete. Every logged print also says the paper tray was not physically checked.</p></div>`;
}

/* ---------------- sources ---------------- */
function viewAbout(){
  const dropped = E.filter(e => e.dropped_unverified.length);
  app.innerHTML = `<div class="fadein" style="max-width:900px"><h2 class="sec">Sources &amp; Gaps</h2><p class="deck">Exactly what this archive was built from, and what's missing.</p>
   <div class="kick">Coverage</div><p>${E.length} editions (Nos. 1–${last.num}), ${fmtLong(A.range.first)} through ${fmtLong(A.range.last)}. ${A.range.missing_dates.length ? 'Days with no edition saved: ' + A.range.missing_dates.map(fmtShort).join(', ') + '.' : 'No calendar day in that span is missing.'} Sep 9 has two editions: No. 1, the first-run edition, printed under the name “The Family Times” (as of 6:46 P.M.), and No. 2, the first scheduled morning edition of The Family Times (as of 5:03 A.M.).</p>
   <div class="kick">Edition folders</div><p class="note">${A.sources.edition_dirs.length} folders: ${esc(A.sources.edition_dirs[0])} through ${esc(A.sources.edition_dirs[A.sources.edition_dirs.length-1].split('/').pop())}. Each has the edition PDF, content.json, DRAFT.md and the HTML it was rendered from.</p>
   <div class="kick">Print logs used</div><p class="note">${A.sources.logs.map(esc).join('<br>')}<br>plus each edition's DRAFT.md and content.json machine notes.</p>
   <div class="kick">Other copies found</div><p class="note">${A.sources.extra_pdfs.filter(x => x.duplicate_of).length} PDFs in the newspaper bot's attachments are byte-for-byte copies of the editions above, so they weren't counted twice.<br>Not editions, so left out: ${A.sources.excluded.map(esc).join('; ')}.</p>
   <div class="kick">Headline checks</div><p class="note">Headlines come from each edition's content.json and are kept only when they appear in the printed PDF text. Left out because they weren't found in print: ${dropped.map(e => `No. ${e.num}: ${e.dropped_unverified.map(esc).join('; ')}`).join(' · ') || 'none'}.</p>
   <div class="kick">Trend patterns</div><p class="note">${A.topics_def.concat(A.people_def).map(t => `<b>${esc(t.name)}</b>: <code>${esc(t.pattern)}</code>`).join('<br>')}</p>
   <div class="kick">Privacy</div><p class="note">Private family content. Served only on 127.0.0.1 on this box, with no outside requests: fonts, images and data are all local.</p></div>`;
}

/* ---------------- router ---------------- */
function route(){
  hideTip(); document.onkeydown = null;
  const h = location.hash.replace(/^#\/?/, ''), [path, qs] = h.split('?'), parts = path.split('/'), q = new URLSearchParams(qs || '');
  const r = parts[0] || '';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === r));
  if (r === 'wall') viewWall();
  else if (r === 'read') viewReader(parts[1] || last.id, +(parts[2] || 1), q.get('q') || '');
  else if (r === 'search') viewSearch(q.get('q') || S.q);
  else if (r === 'trends') viewTrends();
  else if (r === 'timeline') viewTimeline();
  else if (r === 'about') viewAbout();
  else viewHome();
  if (r !== 'read') scrollTo(0, 0);
}
addEventListener('hashchange', route); route();
window.__TA = {E, runSearch: q => { S.q = q; S.sec = 'All'; return runSearch().map(r => r.e.id); }, historyItems};
})();
