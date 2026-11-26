// hud.js — the instrument layer drawn over the 3D scene: heading ribbon,
// speed & altitude tapes, artificial horizon, throttle/fuel/damage bars,
// the mission card, waypoint markers, banners and warnings — plus a lit
// cockpit panel when flying the inside view.

import { COLORS } from './config.js';

const C = COLORS;
const TXT = rgbOf(C.hud);
const DIM = rgbOf(C.hudDim);
const AMBER = rgbOf(C.hudAmber);
const WARN = rgbOf(C.hudWarn);
const PANEL = 'rgba(14,20,30,0.78)';
const PANEL_LINE = 'rgba(120,150,190,0.35)';

function rgbOf(c) {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

export function drawHUD(ctx, W, H, st, cockpit = false) {
  ctx.save();
  ctx.textBaseline = 'middle';

  drawHeadingRibbon(ctx, W, st);
  drawMissionCard(ctx, st);
  drawTargetMarker(ctx, W, H, st);
  drawFlightPathMarker(ctx, W, H, st);
  drawBanners(ctx, W, H, st);
  drawWarnings(ctx, W, H, st);
  if (!cockpit) {
    drawSpeedTape(ctx, H, st);
    drawAltTape(ctx, W, H, st);
    drawEngineBlock(ctx, H, st);
    drawArtificialHorizon(ctx, W, H, st);
    drawControlHints(ctx, W, H, st);
  }

  ctx.restore();
}

// ---------- heading ribbon ----------
function drawHeadingRibbon(ctx, W, st) {
  const cx = W / 2;
  const y = 26;
  const w = 420;
  ctx.fillStyle = PANEL;
  roundRect(ctx, cx - w / 2, y - 14, w, 30, 8);
  ctx.fill();
  ctx.strokeStyle = PANEL_LINE;
  ctx.stroke();

  const hdg = st.hdgDeg;
  const pxPerDeg = w / 60; // 60° window
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2 + 4, y - 14, w - 8, 30);
  ctx.clip();
  ctx.font = '12px "Courier New", monospace';
  ctx.textAlign = 'center';
  for (let d = -40; d <= 40; d += 5) {
    let hd = (Math.round(hdg / 5) * 5 + d + 3600) % 360;
    const x = cx + d * pxPerDeg + (Math.round(hdg / 5) * 5 - hdg) * pxPerDeg;
    ctx.strokeStyle = DIM;
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x, y + 13);
    ctx.stroke();
    if (hd % 30 === 0) {
      const label = hd === 0 ? 'N' : hd === 90 ? 'E' : hd === 180 ? 'S' : hd === 270 ? 'W' : String(hd / 10);
      ctx.fillStyle = hd % 90 === 0 ? AMBER : TXT;
      ctx.fillText(label, x, y - 4);
    }
  }
  ctx.restore();
  // own heading marker + readout
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cx, y + 16);
  ctx.lineTo(cx - 6, y + 24);
  ctx.lineTo(cx + 6, y + 24);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(hdg)).padStart(3, '0'), cx, y - 30);
  // wind arrow
  const wa = st.windDir;
  ctx.save();
  ctx.translate(cx + w / 2 + 24, y + 2);
  ctx.rotate(wa - (st.hdg ?? 0));
  ctx.strokeStyle = DIM;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(0, 8);
  ctx.moveTo(0, 8);
  ctx.lineTo(-4, 2);
  ctx.moveTo(0, 8);
  ctx.lineTo(4, 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = DIM;
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`WND ${Math.round(st.windKts)}`, cx + w / 2 + 12, y + 16);
}

// ---------- vertical tapes ----------
function drawSpeedTape(ctx, H, st) {
  const x = 46;
  const y = H / 2;
  const h = 300;
  ctx.fillStyle = PANEL;
  roundRect(ctx, x - 34, y - h / 2, 68, h, 8);
  ctx.fill();
  ctx.strokeStyle = PANEL_LINE;
  ctx.stroke();
  const kts = st.v * 1.944;
  const pxPer10 = 34;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 30, y - h / 2 + 4, 60, h - 8);
  ctx.clip();
  ctx.font = '11px "Courier New", monospace';
  ctx.textAlign = 'left';
  const step = 20;
  const base = Math.round(kts / step) * step;
  for (let k = -5; k <= 5; k++) {
    const v = base + k * step;
    const yy = y - (v - kts) * (pxPer10 / 10);
    ctx.strokeStyle = DIM;
    ctx.beginPath();
    ctx.moveTo(x - 24, yy);
    ctx.lineTo(x - 14, yy);
    ctx.stroke();
    ctx.fillStyle = TXT;
    ctx.fillText(String(v), x - 6, yy);
  }
  ctx.restore();
  // current value box
  ctx.fillStyle = st.stalled ? WARN : AMBER;
  roundRect(ctx, x - 36, y - 12, 42, 24, 5);
  ctx.fill();
  ctx.fillStyle = '#10161f';
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(kts)), x - 15, y + 1);
  ctx.fillStyle = DIM;
  ctx.font = '10px monospace';
  ctx.fillText('KTS', x - 15, y + h / 2 + 14);
  // stall marker line
  const stallKt = st.stallSpeed * 1.944;
  const sy = y - (stallKt - kts) * (pxPer10 / 10);
  ctx.strokeStyle = WARN;
  ctx.beginPath();
  ctx.moveTo(x - 24, sy);
  ctx.lineTo(x + 26, sy);
  ctx.stroke();
}

function drawAltTape(ctx, W, H, st) {
  const x = W - 46;
  const y = H / 2;
  const h = 300;
  ctx.fillStyle = PANEL;
  roundRect(ctx, x - 34, y - h / 2, 68, h, 8);
  ctx.fill();
  ctx.strokeStyle = PANEL_LINE;
  ctx.stroke();
  const ft = Math.max(0, (st.alt - 0) * 3.281);
  const pxPerFt = 0.34;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 30, y - h / 2 + 4, 60, h - 8);
  ctx.clip();
  ctx.font = '11px "Courier New", monospace';
  ctx.textAlign = 'right';
  const step = 100;
  const base = Math.round(ft / step) * step;
  for (let k = -5; k <= 5; k++) {
    const v = base + k * step;
    if (v < 0) continue;
    const yy = y - (v - ft) * pxPerFt;
    ctx.strokeStyle = DIM;
    ctx.beginPath();
    ctx.moveTo(x + 24, yy);
    ctx.lineTo(x + 14, yy);
    ctx.stroke();
    ctx.fillStyle = TXT;
    ctx.fillText(String(v), x + 8, yy);
  }
  ctx.restore();
  ctx.fillStyle = AMBER;
  roundRect(ctx, x - 6, y - 12, 42, 24, 5);
  ctx.fill();
  ctx.fillStyle = '#10161f';
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(ft)), x + 15, y + 1);
  ctx.fillStyle = DIM;
  ctx.font = '10px monospace';
  ctx.fillText('ALT FT', x + 15, y + h / 2 + 14);
  // VSI
  const vy = y + h / 2 + 26;
  ctx.textAlign = 'center';
  ctx.fillStyle = st.vs < -4 ? WARN : DIM;
  ctx.font = '12px "Courier New", monospace';
  const vsi = Math.round(st.vs * 196.85 / 50) * 50;
  ctx.fillText(`VS ${vsi > 0 ? '+' : ''}${vsi}`, x, vy);
  ctx.font = '9px monospace';
  ctx.fillStyle = DIM;
  ctx.fillText('FPM', x, vy + 14);
}

// ---------- engine / fuel block ----------
function drawEngineBlock(ctx, H, st) {
  const x = 46;
  const y = H - 120;
  ctx.fillStyle = PANEL;
  roundRect(ctx, x - 34, y - 20, 150, 96, 8);
  ctx.fill();
  ctx.strokeStyle = PANEL_LINE;
  ctx.stroke();
  // throttle bar
  bar(ctx, x - 20, y - 6, 90, 10, st.throttle, AMBER, 'THR');
  bar(ctx, x - 20, y + 20, 90, 10, st.rpm, '#8fd18a', 'RPM');
  // flaps + gear text
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = st.flaps > 0 ? AMBER : DIM;
  ctx.fillText(`FLP ${st.flaps === 0 ? 'UP' : st.flaps === 0.5 ? '½' : 'FULL'}`, x - 20, y + 46);
  ctx.fillStyle = DIM;
  ctx.fillText('GEAR ▼', x + 40, y + 46);
  // fuel + damage right side block
  const x2 = x + 132;
  ctx.fillStyle = PANEL;
  roundRect(ctx, x2 - 14, y - 20, 130, 96, 8);
  ctx.fill();
  ctx.strokeStyle = PANEL_LINE;
  ctx.stroke();
  bar(ctx, x2, y - 6, 100, 10, st.fuel / 100, st.fuel < 20 ? WARN : '#d8a94e', 'FUEL');
  bar(ctx, x2, y + 20, 100, 10, 1 - st.damage / 100, st.damage > 55 ? WARN : '#c9d4de', 'DMG');
  ctx.fillStyle = DIM;
  ctx.font = '10px monospace';
  ctx.fillText(`${Math.round(st.fuel)}%`, x2 + 46, y + 46);
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.strokeStyle = PANEL_LINE;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * Math.min(1, Math.max(0, frac))), h - 2);
  ctx.fillStyle = DIM;
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 6);
}

// ---------- mission card ----------
function drawMissionCard(ctx, st) {
  if (!st.mission) return;
  const x = 18;
  const y = 22;
  const w = 250;
  const m = st.mission;
  const lines = m.objectives.length;
  const h = 52 + lines * 18 + 22;
  ctx.fillStyle = PANEL;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = PANEL_LINE;
  ctx.stroke();
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = AMBER;
  ctx.fillText(m.name.toUpperCase(), x + 12, y + 20);
  ctx.fillStyle = DIM;
  ctx.textAlign = 'right';
  ctx.fillText(fmtTime(m.time), x + w - 12, y + 20);
  ctx.textAlign = 'left';
  ctx.font = '12px "Courier New", monospace';
  m.objectives.forEach((o, i) => {
    const oy = y + 44 + i * 18;
    if (o.state === 'done') {
      ctx.fillStyle = '#7fd18a';
      ctx.fillText('✓', x + 12, oy);
    } else if (o.state === 'active') {
      ctx.fillStyle = AMBER;
      ctx.fillText('▸', x + 12, oy);
    } else if (o.state === 'failed') {
      ctx.fillStyle = WARN;
      ctx.fillText('✗', x + 12, oy);
    } else {
      ctx.fillStyle = DIM;
      ctx.fillText('·', x + 12, oy);
    }
    ctx.fillStyle = o.state === 'active' ? TXT : DIM;
    ctx.fillText(o.label, x + 28, oy);
  });
  ctx.fillStyle = DIM;
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText(`SCORE ${st.score}`, x + 12, y + h - 12);
}

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------- waypoint marker ----------
function drawTargetMarker(ctx, W, H, st) {
  const t = st.target;
  if (!t || !t.screen) return;
  let { x, y } = t.screen;
  const onScreen = x > 20 && x < W - 20 && y > 60 && y < H - 60;
  if (!onScreen) {
    // edge arrow pointing at it
    const cx = W / 2;
    const cy = H / 2;
    const ang = Math.atan2(y - cy, x - cx);
    x = cx + Math.cos(ang) * (W / 2 - 60);
    y = cy + Math.sin(ang) * (H / 2 - 90);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  const color = t.color === 'checkpoint' ? rgbOf(C.checkpoint) : AMBER;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x + 12, y);
  ctx.lineTo(x, y + 12);
  ctx.lineTo(x - 12, y);
  ctx.closePath();
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.font = '11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(t.name, x, y - 20);
  ctx.fillText(`${Math.round(t.dist)}m`, x, y + 24);
}

// ---------- flight path marker + crosshair ----------
function drawFlightPathMarker(ctx, W, H, st) {
  if (!st.fpm) return;
  const { x, y } = st.fpm;
  if (x < 0 || x > W || y < 0 || y > H) return;
  ctx.strokeStyle = 'rgba(150,255,190,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.moveTo(x - 16, y);
  ctx.lineTo(x - 9, y);
  ctx.moveTo(x + 9, y);
  ctx.lineTo(x + 16, y);
  ctx.moveTo(x, y - 16);
  ctx.lineTo(x, y - 9);
  ctx.stroke();
  ctx.lineWidth = 1;
}

// ---------- artificial horizon ----------
function drawArtificialHorizon(ctx, W, H, st) {
  const r = 46;
  const x = W / 2;
  const y = H - 78;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  // sky/ground ball rotated by roll, offset by pitch
  ctx.translate(x, y);
  ctx.rotate(-st.roll);
  const pitchPx = st.pitch * 90;
  ctx.fillStyle = '#3f7dbd';
  ctx.fillRect(-r * 2, -r * 2 - pitchPx, r * 4, r * 2 + pitchPx);
  ctx.fillStyle = '#8a6b45';
  ctx.fillRect(-r * 2, -pitchPx, r * 4, r * 2 + pitchPx);
  ctx.strokeStyle = '#f4f1e6';
  ctx.beginPath();
  ctx.moveTo(-r * 2, -pitchPx);
  ctx.lineTo(r * 2, -pitchPx);
  ctx.stroke();
  // pitch ladder
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  for (const d of [-20, -10, 10, 20]) {
    const ly = -pitchPx - (d * Math.PI / 180) * 90;
    const w = Math.abs(d) === 10 ? 14 : 22;
    ctx.beginPath();
    ctx.moveTo(-w, ly);
    ctx.lineTo(w, ly);
    ctx.stroke();
    ctx.fillText(String(d), -w - 12, ly);
  }
  ctx.restore();
  // fixed aircraft symbol + roll pointer
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 26, y);
  ctx.lineTo(x - 8, y);
  ctx.moveTo(x + 8, y);
  ctx.lineTo(x + 26, y);
  ctx.moveTo(x, y - 3);
  ctx.lineTo(x, y + 3);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = PANEL_LINE;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  // roll arc ticks
  ctx.save();
  ctx.translate(x, y);
  for (const d of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const a = (d * Math.PI) / 180 - Math.PI / 2;
    const len = d === 0 || Math.abs(d) === 45 ? 9 : 5;
    ctx.strokeStyle = d === 0 ? AMBER : DIM;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a) * (r - len), Math.sin(a) * (r - len));
    ctx.stroke();
  }
  // roll indicator triangle
  ctx.rotate(-st.roll);
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(0, -r + 2);
  ctx.lineTo(-5, -r + 12);
  ctx.lineTo(5, -r + 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------- banners + warnings ----------
function drawBanners(ctx, W, H, st) {
  let y = H * 0.3;
  ctx.textAlign = 'center';
  for (const b of st.banners) {
    const a = Math.min(1, b.life / 0.6) * Math.min(1, b.maxLife ? b.life / b.maxLife : 1);
    ctx.globalAlpha = Math.min(1, a * 1.4);
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillStyle = b.color || AMBER;
    ctx.fillText(b.text, W / 2, y);
    y += 36;
  }
  ctx.globalAlpha = 1;
}

function drawWarnings(ctx, W, H, st) {
  const msgs = [];
  if (st.stalled) msgs.push('STALL');
  if (st.terrainWarn) msgs.push('TERRAIN · PULL UP');
  if (st.fuel < 15 && !st.crashed) msgs.push('LOW FUEL');
  if (st.engineDead && st.fuel <= 0) msgs.push('ENGINE OUT — GLIDE');
  if (st.damage > 55) msgs.push('AIRFRAME DAMAGE');
  if (!msgs.length) return;
  const blink = Math.floor(st.time * 3) % 2 === 0;
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Courier New", monospace';
  msgs.forEach((m, i) => {
    if (m === 'STALL' && !blink) return;
    ctx.fillStyle = WARN;
    ctx.fillText(m, W / 2, H * 0.62 + i * 28);
  });
}

function drawControlHints(ctx, W, H, st) {
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(190,205,225,0.55)';
  ctx.fillText(
    'ARROWS/MOUSE fly · W/S throttle · A/D rudder · F flaps · B brake · SPACE drop · C view · M mouse · R retry · ESC menu',
    W / 2,
    H - 12,
  );
}

// ---------- cockpit panel ----------
export function drawCockpitPanel(ctx, W, H, st) {
  const ph = Math.round(H * 0.36);
  const y0 = H - ph;
  // panel body
  ctx.fillStyle = '#12161d';
  ctx.fillRect(0, y0, W, ph);
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(70,80,95,0.5)');
  g.addColorStop(0.06, 'rgba(30,36,46,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, ph);
  // glare shield
  ctx.fillStyle = '#0a0d12';
  ctx.beginPath();
  ctx.moveTo(0, y0);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y0 + 8 + Math.sin(x * 0.02) * 3);
  ctx.lineTo(W, y0 - 14);
  ctx.lineTo(0, y0 - 14);
  ctx.closePath();
  ctx.fill();

  const gy = y0 + ph * 0.52;
  const gr = Math.min(52, ph * 0.32);
  drawDial(ctx, W * 0.10, gy, gr, 'AIRSPEED KTS', st.v * 1.944, 0, 220, st.stallSpeed * 1.944);
  drawAHDial(ctx, W * 0.28, gy, gr, st);
  drawDial(ctx, W * 0.46, gy, gr, 'ALT FT', Math.max(0, st.alt * 3.281), 0, 3000);
  drawCompassDial(ctx, W * 0.64, gy, gr, st);
  drawDial(ctx, W * 0.82, gy - gr * 0.28, gr * 0.72, 'RPM', st.rpm * 27, 0, 30, 0);
  drawDial(ctx, W * 0.82, gy + gr * 0.75, gr * 0.72, 'FUEL', st.fuel, 0, 100, 20);
  drawDial(ctx, W * 0.94, gy, gr * 0.72, 'DMG', st.damage, 0, 100, 60);

  // switches row text
  ctx.font = '10px monospace';
  ctx.fillStyle = DIM;
  ctx.textAlign = 'center';
  ctx.fillText(`FLAPS ${st.flaps === 0 ? 'UP' : st.flaps === 0.5 ? 'HALF' : 'FULL'}   THR ${Math.round(st.throttle * 100)}%   DMG ${Math.round(st.damage)}%`, W * 0.5, H - 8);
}

function drawDial(ctx, x, y, r, label, value, min, max, redline) {
  ctx.fillStyle = '#0d1118';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PANEL_LINE;
  ctx.stroke();
  const a0 = Math.PI * 0.75;
  const a1 = Math.PI * 2.25;
  // ticks
  for (let i = 0; i <= 10; i++) {
    const a = a0 + ((a1 - a0) * i) / 10;
    ctx.strokeStyle = DIM;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4));
    ctx.lineTo(x + Math.cos(a) * (r - 10), y + Math.sin(a) * (r - 10));
    ctx.stroke();
  }
  if (redline) {
    const ar = a0 + ((a1 - a0) * (redline - min)) / (max - min);
    ctx.strokeStyle = WARN;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r - 7, ar, a1);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  const av = a0 + ((a1 - a0) * (Math.min(max, Math.max(min, value)) - min)) / (max - min);
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(av) * (r - 12), y + Math.sin(av) * (r - 12));
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = TXT;
  ctx.font = `bold ${Math.max(10, r * 0.22)}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(value)), x, y + r * 0.5);
  ctx.fillStyle = DIM;
  ctx.font = '8px monospace';
  ctx.fillText(label, x, y + r - 6);
}

function drawAHDial(ctx, x, y, r, st) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-st.roll);
  const pitchPx = st.pitch * 70;
  ctx.fillStyle = '#3f7dbd';
  ctx.fillRect(-r * 2, -r * 2 - pitchPx, r * 4, r * 2 + pitchPx);
  ctx.fillStyle = '#8a6b45';
  ctx.fillRect(-r * 2, -pitchPx, r * 4, r * 2 + pitchPx);
  ctx.strokeStyle = '#f4f1e6';
  ctx.beginPath();
  ctx.moveTo(-r * 2, -pitchPx);
  ctx.lineTo(r * 2, -pitchPx);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y);
  ctx.lineTo(x - r * 0.2, y);
  ctx.moveTo(x + r * 0.2, y);
  ctx.lineTo(x + r * 0.55, y);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = PANEL_LINE;
  ctx.beginPath();
  ctx.arc(x, y, r - 2, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCompassDial(ctx, x, y, r, st) {
  ctx.fillStyle = '#0d1118';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PANEL_LINE;
  ctx.stroke();
  ctx.font = '10px "Courier New", monospace';
  ctx.textAlign = 'center';
  for (let d = 0; d < 360; d += 30) {
    const a = ((d - st.hdgDeg) * Math.PI) / 180 - Math.PI / 2;
    const lx = x + Math.cos(a) * (r - 12);
    const ly = y + Math.sin(a) * (r - 12);
    const label = d === 0 ? 'N' : d === 90 ? 'E' : d === 180 ? 'S' : d === 270 ? 'W' : String(d / 10);
    ctx.fillStyle = d % 90 === 0 ? AMBER : DIM;
    ctx.fillText(label, lx, ly);
  }
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(x, y - r + 2);
  ctx.lineTo(x - 5, y - r + 12);
  ctx.lineTo(x + 5, y - r + 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = TXT;
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillText(String(Math.round(st.hdgDeg)).padStart(3, '0'), x, y + 4);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- menus / overlays ----------
export function drawTitle(ctx, W, H, st) {
  ctx.fillStyle = 'rgba(10,14,22,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 56px "Courier New", monospace';
  ctx.fillText('C R O S S W I N D', W / 2, H * 0.24);
  ctx.fillStyle = TXT;
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText('a valley flight tour · pick a sortie', W / 2, H * 0.24 + 40);

  ctx.font = '15px "Courier New", monospace';
  st.missions.forEach((m, i) => {
    const y = H * 0.42 + i * 34;
    ctx.fillStyle = AMBER;
    ctx.fillText(`[${i + 1}]`, W / 2 - 170, y);
    ctx.fillStyle = TXT;
    ctx.textAlign = 'left';
    ctx.fillText(m.name, W / 2 - 140, y);
    ctx.fillStyle = DIM;
    ctx.fillText(m.blurb, W / 2 + 30, y);
    ctx.textAlign = 'center';
  });
  ctx.fillStyle = DIM;
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText('or press F for free flight · M toggles mouse-stick', W / 2, H * 0.42 + st.missions.length * 34 + 26);
  ctx.fillText('mouse + keyboard recommended', W / 2, H * 0.42 + st.missions.length * 34 + 48);
}

export function drawOverlay(ctx, W, H, st) {
  if (st.overlay === 'pause') {
    ctx.fillStyle = 'rgba(10,14,22,0.5)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = TXT;
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.font = '14px "Courier New", monospace';
    ctx.fillStyle = DIM;
    ctx.fillText('P resume · ESC menu', W / 2, H / 2 + 34);
  } else if (st.overlay === 'done' || st.overlay === 'crashed') {
    ctx.fillStyle = 'rgba(10,14,22,0.5)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = st.overlay === 'done' ? AMBER : WARN;
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.fillText(st.overlay === 'done' ? 'MISSION COMPLETE' : 'AIRFRAME LOST', W / 2, H * 0.4);
    ctx.fillStyle = TXT;
    ctx.font = '16px "Courier New", monospace';
    st.resultLines.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.4 + 40 + i * 26));
    ctx.fillStyle = DIM;
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('R fly again · ESC menu', W / 2, H * 0.4 + 60 + st.resultLines.length * 26);
  }
}
