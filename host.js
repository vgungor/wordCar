// ============ Öğretmen (host) — yarışın "sunucusu" bu sekmedir ============
const STORE = 'yazmayarisi-host';
const conns = new Map();          // slot -> peerId
let dirty = false;

// ---------- Durum ----------
function freshState() {
  return {
    code: randomCode(5),
    text: TEXTS[Math.floor(Math.random() * TEXTS.length)],
    status: 'waiting', startAt: 0, endAt: 0, raceId: 1,
    players: Array.from({ length: MAX_PLAYERS }, (_, i) => ({
      name: 'Öğrenci ' + (i + 1), pass: randomCode(4, 'abcdefghjkmnpqrstuvwxyz23456789'), color: COLORS[i], pos: 0, errors: 0, finish: null,
    })),
  };
}
let S;
try { S = JSON.parse(localStorage.getItem(STORE)); } catch (e) {}
if (!S || !Array.isArray(S.players) || S.players.length !== MAX_PLAYERS) S = freshState();
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} };
save();

function resetProgress() { S.players.forEach(p => { p.pos = 0; p.errors = 0; p.finish = null; p.inRace = false; }); }
const len = () => [...S.text].length;
const active = p => p.pass.trim() !== '';
const elapsedMs = () => S.status === 'running' ? Date.now() - S.startAt : S.status === 'finished' ? S.endAt - S.startAt : 0;

function publicPlayers() {
  return S.players.map((p, i) => ({
    slot: i, name: p.name, color: p.color, pos: p.pos, errors: p.errors, finish: p.finish,
    active: active(p), online: isOnline(i),
  }));
}

function checkFinished() {
  if (S.status !== 'running') return;
  const act = S.players.filter((p, i) => active(p) && (p.inRace || p.pos > 0));
  if (act.length && act.every(p => p.finish != null)) { S.status = 'finished'; S.endAt = Date.now(); save(); }
}

// ---------- Ağ ----------
let net = null;
const peers = new Set();          // odadaki tüm eşler (peerId)
const slotOf = new Map();         // peerId -> slot
const isOnline = i => conns.has(i) && peers.has(conns.get(i));

function startNet() {
  if (net) net.leave();
  peers.clear(); conns.clear(); slotOf.clear();
  $('roomCode').textContent = S.code;
  setNet('🟢 Oda açık — öğrenciler bağlanabilir', 'on');
  net = openRoom(S.code);
  net.onJoin(id => { peers.add(id); send(id, { t: 'hello' }); });
  net.onLeave(id => { peers.delete(id); });
  net.onMessage((msg, id) => onMessage(id, msg));
}
function setNet(msg, cls) { const el = $('netStatus'); el.textContent = msg; el.className = cls || 'muted'; }
function send(id, msg) { if (net && id) net.send(msg, id); }
function kick(slot, msg) {
  const id = conns.get(slot);
  if (!id) return;
  send(id, { t: 'kicked', msg });
  conns.delete(slot); slotOf.delete(id);
}

function onMessage(id, msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'login') {
    const pass = String(msg.pass || '').trim();
    const slot = S.players.findIndex(p => active(p) && p.pass === pass);
    if (slot < 0) { send(id, { t: 'error', msg: 'Şifre hatalı' }); return; }
    const old = conns.get(slot);
    if (old && old !== id && peers.has(old)) kick(slot, 'Bu şifreyle başka bir yerden giriş yapıldı.');
    if (slotOf.has(id) && slotOf.get(id) !== slot) conns.delete(slotOf.get(id));
    conns.set(slot, id); slotOf.set(id, slot);
    if (S.status === 'running') S.players[slot].inRace = true;   // yarış sırasında katılan da sayılır
    send(id, { t: 'welcome', slot });
    broadcast();
    return;
  }
  if (msg.t === 'progress') {
    const slot = slotOf.get(id);
    if (slot == null || conns.get(slot) !== id) return;
    if (msg.raceId !== S.raceId || S.status !== 'running') return;
    const now = Date.now();
    if (now < S.startAt) return;
    const p = S.players[slot];
    if (p.finish != null) return;
    const L = len();
    const maxAllowed = Math.ceil((now - S.startAt) / 1000 * MAX_CHARS_PER_SEC) + 3;
    p.pos = Math.max(p.pos, Math.min(+msg.pos || 0, L, maxAllowed));
    p.errors = Math.max(0, +msg.errors || 0);
    if (p.pos >= L) p.finish = Math.round(now - S.startAt) / 1000;
    checkFinished();
    save();
  }
}

function broadcast() {
  const msg = { t: 'state', raceId: S.raceId, text: S.text, status: S.status, elapsed: elapsedMs(), players: publicPlayers() };
  const ids = [...conns.values()].filter(id => peers.has(id));
  if (ids.length) net.send(msg, ids);
}
setInterval(broadcast, 250);

// ---------- Kontroller ----------
$('startBtn').onclick = () => {
  if (dirty && !confirm('Kaydedilmemiş değişiklikler var. Kaydetmeden başlatılsın mı?')) return;
  if (!S.players.some(active)) return toast('Önce en az bir oyuncuya şifre verin', true);
  resetProgress();
  S.players.forEach((p, i) => { p.inRace = active(p) && isOnline(i); });
  S.status = 'running'; S.startAt = Date.now() + COUNTDOWN_MS; S.raceId++; save(); broadcast();
  $('settings').open = false;
};
$('stopBtn').onclick = () => { if (S.status === 'running') { S.status = 'finished'; S.endAt = Date.now(); save(); broadcast(); } };
$('resetBtn').onclick = () => { if (!confirm('İlerlemeler sıfırlansın mı?')) return; resetProgress(); S.status = 'waiting'; S.raceId++; save(); broadcast(); };
$('newCodeBtn').onclick = () => {
  if (S.status === 'running' && !confirm('Yarış sürüyor. Yeni oda açılırsa öğrencilerin yeniden girmesi gerekir. Devam edilsin mi?')) return;
  for (const i of [...conns.keys()]) kick(i, 'Öğretmen yeni bir oda açtı.');
  S.code = randomCode(5); S.status = 'waiting'; resetProgress(); S.raceId++; save(); startNet();
};

// ---------- Ayarlar formu ----------
function loadForm() {
  $('playerRows').innerHTML = '<b>#</b><b>Ad</b><b>Şifre</b><span></span><b>Durum</b>' + S.players.map((p, i) => `
    <span><span class="dot" style="background:${p.color}"></span>${i + 1}</span>
    <input data-i="${i}" data-f="name" value="${esc(p.name)}" maxlength="20">
    <input data-i="${i}" data-f="pass" value="${esc(p.pass)}" placeholder="(kapalı)">
    <button class="ghost" data-gen="${i}" type="button" title="Rastgele şifre">🎲</button>
    <span id="on${i}"></span>`).join('');
  $('adminText').value = S.text; countWords(); dirty = false;
}
function countWords() {
  const t = $('adminText').value;
  $('wc').textContent = `(${wordCount(t)} kelime, ${[...normText(t)].length} karakter)`;
}
$('playerRows').addEventListener('input', () => dirty = true);
$('playerRows').addEventListener('click', e => {
  const i = e.target.dataset.gen;
  if (i !== undefined) { document.querySelector(`input[data-i="${i}"][data-f="pass"]`).value = randomCode(4, 'abcdefghjkmnpqrstuvwxyz23456789'); dirty = true; }
});
$('genAllBtn').onclick = () => { document.querySelectorAll('input[data-f="pass"]').forEach(inp => { if (!inp.value.trim()) inp.value = randomCode(4, 'abcdefghjkmnpqrstuvwxyz23456789'); }); dirty = true; };
$('adminText').addEventListener('input', () => { dirty = true; countWords(); });
$('randomBtn').onclick = () => {
  let t; do { t = TEXTS[Math.floor(Math.random() * TEXTS.length)]; } while (TEXTS.length > 1 && t === $('adminText').value);
  $('adminText').value = t; countWords(); dirty = true;
};
$('saveBtn').onclick = () => {
  const text = normText($('adminText').value);
  if (!text) return toast('Metin boş olamaz', true);
  const rows = S.players.map((_, i) => ({
    name: document.querySelector(`input[data-i="${i}"][data-f="name"]`).value.trim().slice(0, 20) || 'Öğrenci ' + (i + 1),
    pass: document.querySelector(`input[data-i="${i}"][data-f="pass"]`).value.trim(),
  }));
  const pw = rows.map(r => r.pass).filter(Boolean);
  if (new Set(pw).size !== pw.length) return toast('Her oyuncunun şifresi farklı olmalı', true);
  rows.forEach((r, i) => {
    const p = S.players[i];
    if (p.pass !== r.pass) kick(i, 'Şifreniz değiştirildi.');
    p.name = r.name; p.pass = r.pass;
  });
  if (text !== S.text) { S.text = text; S.status = 'waiting'; resetProgress(); S.raceId++; }
  save(); loadForm(); broadcast(); toast('Kaydedildi');
};

function toast(msg, bad) { const t = $('toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); setTimeout(() => t.className = 'toast', 2200); }

// ---------- Ekran ----------
const track = new Track($('track'));
let lastRace = null, lastText = null;
function frame() {
  requestAnimationFrame(frame);
  const now = Date.now(), pl = publicPlayers();
  const reset = lastRace !== S.raceId; lastRace = S.raceId;
  let st;
  if (S.status === 'waiting') st = '⏳ Hazır — öğrenciler bağlanınca yarışı başlatın';
  else if (S.status === 'running' && now < S.startAt) st = '🚦 Geri sayım: ' + Math.ceil((S.startAt - now) / 1000);
  else if (S.status === 'running') st = '🟢 Yarış sürüyor — ' + fmt((now - S.startAt) / 1000);
  else st = '🏆 Yarış bitti';
  if ($('raceStatus').textContent !== st) $('raceStatus').textContent = st;
  if (lastText !== S.text) { lastText = S.text; renderTyped($('textBox'), S.text, ''); }
  track.draw({ players: pl, len: len(), meSlot: null, countdown: S.status === 'running' && now < S.startAt ? Math.ceil((S.startAt - now) / 1000) : null, reset });
}
setInterval(() => {
  const pl = publicPlayers();
  renderResults($('results'), pl, len(), Math.max(0, elapsedMs() / 1000), null);
  pl.forEach((p, i) => { const el = $('on' + i); if (el) el.innerHTML = !p.active ? '<span class="off">kapalı</span>' : p.online ? '<span class="on">● bağlı</span>' : '<span class="off">○ yok</span>'; });
}, 300);

$('joinUrl').textContent = new URL('index.html', location.href).href.replace(/\?.*$/, '');
loadForm();
startNet();
requestAnimationFrame(frame);
