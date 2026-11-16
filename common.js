// ============ Ortak yardımcılar, pist çizimi, sıralama ============
const $ = id => document.getElementById(id);
const PEER_PREFIX = 'yazmayarisi-tr-';
const MAX_PLAYERS = 5;
const COUNTDOWN_MS = 5000;
const MAX_CHARS_PER_SEC = 25;
const COLORS = ['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#9b5de5'];

// Test/özel sunucu için: ?server=host:port (varsayılan: PeerJS'in ücretsiz bulut sunucusu)
function peerOptions() {
  const sv = new URLSearchParams(location.search).get('server');
  if (!sv) return { debug: 1 };
  const [host, port] = sv.split(':');
  return { host, port: +port || 9000, path: '/', secure: false, debug: 1 };
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const trimTo = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
function fmt(sec) {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return m ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${s.toFixed(1)} sn`;
}
const wordCount = t => t.trim().split(/\s+/).filter(Boolean).length;
const randomCode = (n, abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') => Array.from({ length: n }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
const normText = t => t.replace(/\s+/g, ' ').trim();

// Şapkalı harfler ve kesme işaretleri için hoşgörü (â = a, ’ = ' ...)
const LOOSE = { 'â': 'a', 'Â': 'A', 'î': 'i', 'Î': 'İ', 'û': 'u', 'Û': 'U', '’': "'", '‘': "'", '“': '"', '”': '"', '…': '.' };
const same = (a, b) => a === b || (LOOSE[a] || a) === (LOOSE[b] || b);

// Yazılan metni hedefle karşılaştırıp boyalı HTML üretir
function renderTyped(el, text, typedStr) {
  const target = [...text], typed = [...typedStr];
  let p = 0;
  while (p < typed.length && same(typed[p], target[p])) p++;
  let html = '';
  for (let i = 0; i < target.length; i++) {
    const c = esc(target[i]);
    if (i < p) html += `<span class="ok">${c}</span>`;
    else if (i < typed.length) html += `<span class="bad">${target[i] === ' ' ? '&nbsp;' : c}</span>`;
    else if (i === typed.length) html += `<span class="cur">${c}</span>`;
    else html += `<span class="rest">${c}</span>`;
  }
  el.innerHTML = html;
  return p;
}

// players: [{slot,name,color,pos,errors,finish,active,online}]
function renderResults(tbody, players, len, elapsedSec, meSlot) {
  const list = players.filter(p => p.active).slice().sort((a, b) =>
    (a.finish ?? 1e9) - (b.finish ?? 1e9) || b.pos - a.pos);
  tbody.innerHTML = list.map((p, i) => {
    const t = p.finish ?? elapsedSec;
    const wpm = t > 0 ? Math.round((p.pos / 5) / (t / 60)) : 0;
    const acc = p.pos + p.errors > 0 ? Math.round(100 * p.pos / (p.pos + p.errors)) : 100;
    const rank = p.finish != null ? (['🥇', '🥈', '🥉'][i] || i + 1) : i + 1;
    const durum = p.finish != null ? '🏁 Bitirdi' : (p.online ? '<span class="on">● bağlı</span>' : '<span class="off">○ bağlı değil</span>');
    return `<tr${p.slot === meSlot ? ' style="background:#334155"' : ''}><td>${rank}</td>
      <td><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</td><td>${durum}</td>
      <td>%${len ? Math.round(100 * p.pos / len) : 0}</td><td>${p.finish != null ? fmt(p.finish) : '—'}</td>
      <td>${wpm} kel/dk</td><td>%${acc}</td></tr>`;
  }).join('') || '<tr><td colspan="7" class="muted">Henüz şifre verilmiş oyuncu yok.</td></tr>';
}

// ---------- Pist ----------
class Track {
  constructor(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.shown = []; }

  // opts: {players, len, meSlot, myPos, countdown (sn|null), reset}
  draw(o) {
    const { cv, ctx } = this, LANE_H = 64, PAD = 14, n = o.players.length;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = n * LANE_H + PAD * 2;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px'; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#14532d'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#374151'; ctx.fillRect(0, PAD, W, n * LANE_H);
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.setLineDash([18, 14]);
    for (let i = 1; i < n; i++) { ctx.beginPath(); ctx.moveTo(0, PAD + i * LANE_H); ctx.lineTo(W, PAD + i * LANE_H); ctx.stroke(); }
    ctx.setLineDash([]);

    const startX = 110, finishX = W - 40, carW = 60, sq = 8;
    ctx.fillStyle = '#fff'; ctx.fillRect(startX - 3, PAD, 3, n * LANE_H);
    for (let y = PAD; y < PAD + n * LANE_H; y += sq)
      for (let k = 0; k < 2; k++) { ctx.fillStyle = ((y - PAD) / sq + k) % 2 ? '#000' : '#fff'; ctx.fillRect(finishX + k * sq, y, sq, Math.min(sq, PAD + n * LANE_H - y)); }

    const order = o.players.filter(p => p.finish != null).sort((a, b) => a.finish - b.finish).map(p => p.slot);
    o.players.forEach((p, i) => {
      const y = PAD + i * LANE_H + LANE_H / 2;
      let frac = o.len ? p.pos / o.len : 0;
      if (i === o.meSlot && o.myPos != null) frac = o.len ? o.myPos / o.len : 0;
      if (this.shown[i] === undefined || o.reset) this.shown[i] = frac;
      this.shown[i] += (frac - this.shown[i]) * 0.18;
      const x = startX + this.shown[i] * (finishX - startX - carW + 6);

      ctx.globalAlpha = p.active ? 1 : 0.3;
      ctx.fillStyle = '#fff'; ctx.font = '600 13px system-ui'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(trimTo(p.name, 12), 8, y - 8);
      ctx.font = '11px system-ui'; ctx.fillStyle = p.online ? '#86efac' : '#9ca3af';
      ctx.fillText(p.active ? (p.online ? '● bağlı' : '○ bekleniyor') : 'boş şerit', 8, y + 9);
      this.car(x, y, p.color, i === o.meSlot);
      ctx.globalAlpha = 1;

      const r = order.indexOf(p.slot);
      if (r >= 0) {
        ctx.fillStyle = '#facc15'; ctx.font = '700 13px system-ui'; ctx.textAlign = 'right';
        ctx.fillText(`${r + 1}. ${fmt(p.finish)}`, finishX - 8, y - LANE_H / 2 + 11);
      }
    });

    if (o.countdown != null) {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#facc15'; ctx.font = '800 90px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.countdown, W / 2, H / 2);
    }
  }

  car(x, y, color, isMe) {
    const ctx = this.ctx, w = 60, h = 28, top = y - h / 2;
    ctx.fillStyle = '#111';
    [[x + 9, top - 3], [x + w - 21, top - 3], [x + 9, top + h - 3], [x + w - 21, top + h - 3]].forEach(([a, b]) => this.rr(a, b, 13, 6, 2, true));
    ctx.fillStyle = color; this.rr(x, top, w, h, 8, true);
    if (isMe) { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3; this.rr(x, top, w, h, 8, false, true); }
    ctx.fillStyle = 'rgba(0,0,0,.25)'; this.rr(x + 16, top + 4, 26, h - 8, 5, true);
    ctx.fillStyle = '#bfdbfe'; this.rr(x + 36, top + 6, 7, h - 12, 2, true); this.rr(x + 15, top + 6, 5, h - 12, 2, true);
    ctx.fillStyle = '#fef08a'; ctx.fillRect(x + w - 4, top + 4, 3, 5); ctx.fillRect(x + w - 4, top + h - 9, 3, 5);
  }
  rr(x, y, w, h, r, fill, stroke) {
    const c = this.ctx; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); if (fill) c.fill(); if (stroke) c.stroke();
  }
}
