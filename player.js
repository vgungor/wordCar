// ============ Öğrenci ekranı ============
let peer = null, conn = null, mySlot = null, S = null;
let raceId = null, localStart = null;          // localStart: yarışın başladığı an (bu bilgisayarın saatiyle, ms)
let myPos = 0, myErrors = 0, prevLen = 0, lastSent = -1, myFinish = null;
let creds = null, joining = false;

// ---------- Bağlantı ----------
$('codeInp').value = localStorage.getItem('yazmayarisi-code') || '';
$('loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const code = $('codeInp').value.trim().toUpperCase(), pass = $('passInp').value.trim();
  if (!code || !pass) return ($('loginErr').textContent = 'Oda kodu ve şifre gerekli');
  localStorage.setItem('yazmayarisi-code', code);
  creds = { code, pass };
  join();
});

function join() {
  if (joining) return;
  joining = true;
  $('loginErr').textContent = ''; $('joinBtn').textContent = 'Bağlanıyor…';
  cleanup();
  const fail = msg => { joining = false; $('joinBtn').textContent = 'Giriş'; $('loginErr').textContent = msg; cleanup(); toLogin(); };
  const timer = setTimeout(() => fail('Odaya ulaşılamadı. Oda kodunu kontrol edin; öğretmenin sayfası açık olmalı.'), 15000);

  peer = new Peer(peerOptions());
  peer.on('error', err => {
    clearTimeout(timer);
    if (err.type === 'peer-unavailable') fail('Bu kodla açık bir oda bulunamadı.');
    else fail('Bağlantı hatası (' + err.type + '). Tekrar deneyin.');
  });
  peer.on('open', () => {
    conn = peer.connect(PEER_PREFIX + creds.code, { reliable: true });
    conn.on('open', () => send({ t: 'login', pass: creds.pass }));
    conn.on('data', msg => {
      if (msg.t === 'welcome') { clearTimeout(timer); joining = false; $('joinBtn').textContent = 'Giriş'; mySlot = msg.slot; toGame(); }
      else if (msg.t === 'error') { clearTimeout(timer); fail(msg.msg); }
      else if (msg.t === 'kicked') { mySlot = null; creds = null; fail(msg.msg); }
      else if (msg.t === 'state') onState(msg);
    });
    conn.on('close', () => {
      if (mySlot === null) return;
      $('statusLine').textContent = '⚠️ Bağlantı koptu, yeniden bağlanılıyor…';
      setTimeout(() => { if (creds && !joining) join(); }, 1500);
    });
  });
}
function cleanup() { try { conn && conn.close(); } catch (e) {} try { peer && peer.destroy(); } catch (e) {} conn = null; peer = null; }
function send(m) { try { if (conn && conn.open) conn.send(m); } catch (e) {} }
function toLogin() { show('loginView'); hide('gameView'); hide('logoutBtn'); $('whoami').textContent = ''; }
function toGame() { hide('loginView'); show('gameView'); show('logoutBtn'); }
$('logoutBtn').onclick = () => { creds = null; mySlot = null; cleanup(); raceId = null; toLogin(); };

// ---------- Sunucudan (öğretmenden) gelen durum ----------
function onState(s) {
  const est = Date.now() - s.elapsed;
  if (s.raceId !== raceId) {
    raceId = s.raceId; localStart = est;
    myPos = 0; myErrors = 0; prevLen = 0; lastSent = -1; myFinish = null;
    const me = s.players[mySlot];
    let typed = '';
    if (me && me.pos > 0) { myPos = prevLen = lastSent = me.pos; myErrors = me.errors; typed = [...s.text].slice(0, me.pos).join(''); }
    if (me && me.finish != null) myFinish = me.finish;
    $('typeInput').value = typed;
    renderTyped($('textBox'), s.text, typed);
  } else if (s.status === 'running') {
    localStart = Math.min(localStart, est);   // en az gecikmeli tahmini koru
  }
  S = s;
  const me = s.players[mySlot];
  if (me) $('whoami').innerHTML = `<span class="dot" style="background:${me.color}"></span>${esc(me.name)} &nbsp;`;
  if (me && me.finish != null) myFinish = me.finish;
  if (me && s.raceId === raceId && me.pos < myPos && lastSent === myPos) lastSent = me.pos;   // öğretmen almadıysa tekrar gönder
  renderResults($('results'), s.players, [...s.text].length, Math.max(0, elapsed()), mySlot);
}
const elapsed = () => !S ? 0 : S.status === 'running' ? (Date.now() - localStart) / 1000 : S.status === 'finished' ? S.elapsed / 1000 : 0;

// ---------- Yazma ----------
$('typeInput').addEventListener('input', e => {
  const inp = e.target, target = [...S.text];
  let typed = [...inp.value].slice(0, target.length);
  let p = 0;
  while (p < typed.length && same(typed[p], target[p])) p++;
  if (typed.length - p > 8) typed = typed.slice(0, p + 8);           // en fazla 8 hatalı karakter
  if (typed.length > prevLen && !same(typed[typed.length - 1], target[typed.length - 1])) myErrors++;
  prevLen = typed.length;
  const joined = typed.join('');
  if (joined !== inp.value) inp.value = joined;
  myPos = Math.max(myPos, p);
  renderTyped($('textBox'), S.text, joined);
  if (p === target.length) { myFinish = elapsed(); inp.disabled = true; sendProgress(); }
});
['paste', 'drop', 'contextmenu'].forEach(ev => $('typeInput').addEventListener(ev, e => e.preventDefault()));
$('textBox').addEventListener('click', () => { if (!$('typeInput').disabled) $('typeInput').focus(); });

function sendProgress() {
  if (!S || S.status !== 'running' || elapsed() < 0 || myPos === lastSent) return;
  send({ t: 'progress', pos: myPos, errors: myErrors, raceId });
  lastSent = myPos;
}
setInterval(sendProgress, 200);

// ---------- Ekran döngüsü ----------
const track = new Track($('track'));
let drawnRace = null;
function frame() {
  requestAnimationFrame(frame);
  if (!S || mySlot === null) return;
  const t = elapsed(), counting = S.status === 'running' && t < 0;
  const inp = $('typeInput');
  const canType = S.status === 'running' && !counting && myFinish == null;
  if (inp.disabled === canType) { inp.disabled = !canType; if (canType) inp.focus(); }

  let msg;
  if (S.status === 'waiting') msg = '⏳ Öğretmenin yarışı başlatması bekleniyor…';
  else if (counting) msg = `🚦 Hazır ol! ${Math.ceil(-t)}`;
  else if (S.status === 'running') msg = myFinish != null ? '🏁 Bitirdin! Diğerleri bekleniyor…' : '🟢 YAZ!';
  else msg = '🏆 Yarış bitti';
  if ($('statusLine').textContent !== msg && !$('statusLine').textContent.startsWith('⚠️')) $('statusLine').textContent = msg;
  else if ($('statusLine').textContent.startsWith('⚠️') && conn && conn.open) $('statusLine').textContent = msg;

  const shownT = myFinish != null ? myFinish : Math.max(0, t);
  $('stTime').textContent = fmt(shownT);
  $('stWpm').textContent = shownT > 0 ? Math.round((myPos / 5) / (shownT / 60)) : 0;
  $('stPct').textContent = '%' + Math.round(100 * myPos / [...S.text].length);
  $('stErr').textContent = myErrors;

  const reset = drawnRace !== raceId; drawnRace = raceId;
  track.draw({ players: S.players, len: [...S.text].length, meSlot: mySlot, myPos, countdown: counting ? Math.ceil(-t) : null, reset });
}
requestAnimationFrame(frame);
