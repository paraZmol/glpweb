/* Hornilla · direccion C "En ruta" · utilidades de la maqueta: tema, color de marca, iconos, logo, balon y mapa SVG */
(function () {
  const q = new URLSearchParams(location.search);
  const root = document.documentElement;
  const dark = q.get('tema') === 'oscuro';
  root.classList.toggle('dark', dark);
  const marcaParam = (q.get('marca') || '').replace('#', '');
  const marca = /^[0-9a-fA-F]{6}$/.test(marcaParam) ? '#' + marcaParam : null;

  /* ---------- color ---------- */
  const INK = [13, 15, 18];
  const WHITE = [255, 255, 255];
  const BG = dark ? [15, 17, 20] : [236, 238, 240];
  const SURFACE = dark ? [27, 30, 35] : WHITE;
  const SIGNAL_HUE = 50;
  const rgb = (h) => {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const lum = (c) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const contrast = (a, b) => {
    const la = lum(a);
    const lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const hueSat = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
    }
    const l = (mx + mn) / 2;
    return { h: (h * 60 + 360) % 360, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0 };
  };

  /* Derivados de un color de marca. Garantiza >= 4.5:1 del texto sobre la marca. */
  function brandVars(value) {
    const base = rgb(value);
    let fill = base;
    // oscuro: una marca casi negra desapareceria sobre el asfalto; se aclara hasta 2.2:1
    for (let t = 0.06; dark && contrast(fill, BG) < 2.2 && t <= 1; t += 0.06) fill = mix(base, WHITE, t);
    let on = contrast(fill, WHITE) >= 4.5 ? WHITE : INK;
    for (let t = 0.04; contrast(fill, on) < 4.5 && t <= 1; t += 0.04) {
      fill = mix(fill, INK, 0.04);
      on = WHITE;
    }
    let text = base;
    const toward = dark ? WHITE : INK;
    for (let t = 0.05; contrast(text, SURFACE) < 4.5 && t <= 1; t += 0.05) text = mix(base, toward, t);
    const hs = hueSat(base);
    const clash = hs.s > 0.55 && Math.abs(hs.h - SIGNAL_HUE) <= 24;
    return {
      fill: hex(fill),
      on: hex(on),
      text: hex(text),
      tint: hex(mix(SURFACE, base, dark ? 0.24 : 0.12)),
      clash,
    };
  }
  function applyBrand(el) {
    const own = el.dataset.brand;
    const value = el.hasAttribute('data-brand-main') && marca ? marca : own;
    if (!value) return;
    const b = brandVars(value);
    el.style.setProperty('--brand', b.fill);
    el.style.setProperty('--on-brand', b.on);
    el.style.setProperty('--brand-text', b.text);
    el.style.setProperty('--brand-tint', b.tint);
    el.dataset.clash = b.clash ? '1' : '0';
    el.dataset.brandValue = value;
  }

  /* ---------- iconos (lucide, una sola familia) ---------- */
  const I = {
    'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    nav: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    locate: '<line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    nosignal: '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
    list: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    moto: '<circle cx="5" cy="16.5" r="3"/><circle cx="19" cy="16.5" r="3"/><path d="M8 16.5h5.5l3-6.5"/><path d="M5 16.5 8.5 10H14"/><path d="M14 6h2.5l2.5 10.5"/><path d="M8 7h3"/>',
    store: '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>',
    bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    cash: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    turn: '<path d="m15 14 5-5-5-5"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    signal: '<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    open: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  };
  const icon = (name, extra = '') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${I[name] || ''}</svg>`;

  /* ---------- logo: aro de la hornilla con la llama, como ficha ---------- */
  function logoMark() {
    let ports = '';
    for (let a = 0; a < 360; a += 30) {
      ports += `<line x1="20" y1="5.2" x2="20" y2="8.6" transform="rotate(${a} 20 20)"/>`;
    }
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="#FFD60A" stroke="#0D0F12" stroke-width="3"/><g stroke="#0D0F12" stroke-width="2.6" stroke-linecap="round">${ports}</g><circle cx="20" cy="20" r="9" fill="#0D0F12"/><path d="M20.2 13.6c.5 2.4 3.4 3.4 3.4 6.6a3.6 3.6 0 0 1-7.2 0c0-1.3.6-2.2 1.3-2.9.3.9.8 1.4 1.4 1.4.3-1.7-.1-3.2 1.1-5.100z" fill="#FFD60A"/></svg>`;
  }

  /* ---------- balon generico (10, 15, 45 kg): toma el color de la marca del producto ---------- */
  function balon(kg) {
    const k = Number(kg);
    const w = k >= 45 ? 70 : k >= 15 ? 88 : 92;
    const h = k >= 45 ? 196 : k >= 15 ? 132 : 108;
    const x = (120 - w) / 2;
    const top = 30;
    const rx = k >= 45 ? 26 : 30;
    const total = top + h + 16;
    const cw = k >= 45 ? 40 : 46;
    const line = 'var(--outline-fill, #0d0f12)';
    const ly = top + (k >= 45 ? 64 : h * 0.34);
    return `<svg viewBox="0 0 120 ${total}" role="img" aria-label="Balón de ${k} kg">
      <rect x="${x + 12}" y="${top + h - 8}" width="${w - 24}" height="20" rx="5" fill="var(--b,#888)" stroke="${line}" stroke-width="4"/>
      <rect x="${x + 12}" y="${top + h - 8}" width="${w - 24}" height="20" rx="5" fill="#000" opacity=".32"/>
      <rect x="${60 - cw / 2}" y="5" width="${cw}" height="36" rx="9" fill="var(--b,#888)" stroke="${line}" stroke-width="4"/>
      <rect x="${60 - cw / 2}" y="5" width="${cw}" height="36" rx="9" fill="#000" opacity=".22"/>
      <rect x="${60 - cw / 2 + 9}" y="13" width="${cw - 18}" height="13" rx="4" fill="${line}"/>
      <rect x="55" y="15" width="10" height="16" rx="2" fill="#d5dadf" stroke="${line}" stroke-width="2"/>
      <rect x="${x}" y="${top}" width="${w}" height="${h}" rx="${rx}" fill="var(--b,#888)" stroke="${line}" stroke-width="4"/>
      <rect x="${x + w - 20}" y="${top + 16}" width="12" height="${h - 34}" rx="6" fill="#000" opacity=".18"/>
      <rect x="${x + 10}" y="${top + 18}" width="9" height="${h * 0.5}" rx="4.500" fill="#fff" opacity=".38"/>
      <path d="M${x + 3} ${top + h * 0.72}h${w - 6}" stroke="#000" stroke-width="3" opacity=".22"/>
      <rect x="${60 - 23}" y="${ly}" width="46" height="26" rx="5" fill="#fff" stroke="${line}" stroke-width="3"/>
      <text x="60" y="${ly + 19.500}" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="19" fill="#0d0f12" letter-spacing=".5">${k} KG</text>
    </svg>`;
  }

  /* ---------- mapa estilizado ---------- */
  const ROT = -9;
  const VX = (i) => -500 + 170 * i;
  const HY = (j) => -400 + 130 * j;
  const P = (p) => [VX(p[0]), HY(p[1])];
  const PARKS = [[8, 6], [4, 3], [10, 8], [5, 9], [11, 2], [2, 6], [13, 5]];
  const LABELS = [
    { t: 'AV. LOS ANDES', p: [4.5, 5] },
    { t: 'AV. LOS ANDES', p: [10.5, 5] },
    { t: 'AV. CENTRAL', p: [7, 6.5], v: 1 },
    { t: 'AV. CENTRAL', p: [7, 2.5], v: 1 },
    { t: 'JR. LAS FLORES', p: [6.5, 8] },
    { t: 'JR. LOS PINOS', p: [8.5, 4] },
    { t: 'JR. EL SOL', p: [9, 7.5], v: 1 },
    { t: 'JR. LA UNIÓN', p: [5, 6.5], v: 1 },
    { t: 'AV. DEL RÍO', p: [8.5, 9] },
    { t: 'JR. LOS CEDROS', p: [5.5, 3] },
    { t: 'PSJE. 2', p: [10, 6.5], v: 1 },
    { t: 'AV. CIRCUNVALACIÓN', p: [12, 7.5], v: 1 },
    { t: 'AV. CIRCUNVALACIÓN', p: [2, 4.5], v: 1 },
  ];
  let baseCache = '';
  function baseLayers() {
    if (baseCache) return baseCache;
    let s = '<rect x="-3000" y="-3000" width="8000" height="8000" fill="var(--map-land)"/>';
    for (let i = -4; i < 24; i++) {
      for (let j = -6; j < 20; j++) {
        const hsh = (((i * 7 + j * 13) % 5) + 5) % 5;
        const x = VX(i) + 20;
        const y = HY(j) + 20;
        if (PARKS.some((b) => b[0] === i && b[1] === j)) {
          s += `<rect x="${x - 8}" y="${y - 8}" width="146" height="106" rx="10" fill="var(--map-park)"/>`;
          continue;
        }
        if (hsh === 0) s += `<rect x="${x}" y="${y}" width="130" height="90" rx="5" fill="var(--map-block)"/>`;
        else if (hsh === 1) s += `<rect x="${x}" y="${y}" width="58" height="90" rx="5" fill="var(--map-block)"/><rect x="${x + 72}" y="${y + 34}" width="58" height="56" rx="5" fill="var(--map-block)"/>`;
        else if (hsh === 2) s += `<rect x="${x}" y="${y}" width="130" height="38" rx="5" fill="var(--map-block)"/><rect x="${x}" y="${y + 52}" width="80" height="38" rx="5" fill="var(--map-block)"/>`;
        else if (hsh === 3) s += `<rect x="${x + 40}" y="${y}" width="90" height="90" rx="5" fill="var(--map-block)"/>`;
      }
    }
    s += '<path d="M1500 -1400C1330 -700 1560 -100 1370 420S1180 1200 1340 2300" fill="none" stroke="var(--map-water)" stroke-width="64" stroke-linecap="round"/>';
    for (let i = -4; i < 24; i++) {
      const w = ((i % 5) + 5) % 5 === 2 ? 32 : 15;
      s += `<line x1="${VX(i)}" y1="-1800" x2="${VX(i)}" y2="2800" stroke="var(--map-street)" stroke-width="${w}"/>`;
    }
    for (let j = -6; j < 20; j++) {
      const w = ((j % 4) + 4) % 4 === 1 ? 32 : 15;
      s += `<line x1="-2200" y1="${HY(j)}" x2="3800" y2="${HY(j)}" stroke="var(--map-street)" stroke-width="${w}"/>`;
    }
    for (const l of LABELS) {
      const [x, y] = P(l.p);
      s += `<text class="maplabel" x="${x}" y="${y}" ${l.v ? `transform="rotate(-90 ${x} ${y})"` : ''}>${l.t}</text>`;
    }
    baseCache = s;
    return s;
  }
  const pathOf = (pts) => pts.map((p, n) => (n ? 'L' : 'M') + P(p).join(' ')).join('');
  const STATE_ICON = { free: 'check', busy: 'moto', paused: 'pause', offline: 'nosignal', danger: 'alert' };

  function marker(m) {
    const line = 'var(--outline-fill)';
    let fill = 'var(--surface)';
    let on = 'var(--foreground)';
    let dashed = '';
    if (m.type === 'rider') {
      fill = `var(--state-${m.state || 'busy'})`;
      on = `var(--on-state-${m.state || 'busy'})`;
      if (m.state === 'offline') dashed = 'stroke-dasharray="5 4"';
    } else if (m.type === 'home') {
      fill = 'var(--foreground)';
      on = 'var(--background)';
    } else if (m.type === 'dist' || m.type === 'plant') {
      const b = brandVars(m.main && marca ? marca : m.brand || '#0d0f12');
      fill = b.fill;
      on = b.on;
    }
    let g = '';
    if (m.type === 'me') {
      g += '<circle class="pulse" r="22" fill="var(--state-paused)" opacity=".3"/>';
      g += `<circle r="11" fill="var(--state-paused)" stroke="#fff" stroke-width="4"/><circle r="13" fill="none" stroke="${line}" stroke-width="2"/>`;
    } else if (m.type === 'order') {
      const w = 16 + String(m.label).length * 8;
      const c = m.late ? 'var(--state-danger)' : 'var(--surface)';
      const t = m.late ? 'var(--on-state-danger)' : 'var(--foreground)';
      g += `<rect x="${-w / 2 + 2}" y="-22" width="${w}" height="24" rx="5" fill="${line}"/>`;
      g += `<rect x="${-w / 2}" y="-24" width="${w}" height="24" rx="5" fill="${c}" stroke="${line}" stroke-width="2"/>`;
      g += `<text x="0" y="-7" text-anchor="middle" class="mktext" fill="${t}" font-size="14">${m.label}</text>`;
    } else {
      const big = m.big ? 1.18 : 1;
      if (m.pulse) g += `<circle class="pulse" cx="0" cy="-29" r="30" fill="${fill}" opacity=".45"/>`;
      g += `<g transform="scale(${big})" ${m.state === 'offline' ? 'opacity=".8"' : ''}>`;
      g += `<path d="M-17 -46h40a3 3 0 0 1 3 3v34a3 3 0 0 1-3 3h-10l-7 9-7-9h-16z" fill="${line}"/>`;
      g += `<path d="M-13 -49h26a7 7 0 0 1 7 7v26a7 7 0 0 1-7 7h-6l-7 9-7-9h-6a7 7 0 0 1-7-7v-26a7 7 0 0 1 7-7z" fill="${fill}" stroke="${line}" stroke-width="2.500" stroke-linejoin="round" ${dashed}/>`;
      if (m.label) {
        g += `<text x="0" y="-22.500" text-anchor="middle" class="mktext" fill="${on}" font-size="17">${m.label}</text>`;
      } else {
        const ic = m.icon || (m.type === 'home' ? 'home' : m.type === 'plant' ? 'store' : STATE_ICON[m.state] || 'moto');
        g += `<svg x="-11" y="-40" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${on}" stroke-width="2.250" stroke-linecap="round" stroke-linejoin="round">${I[ic]}</svg>`;
      }
      if (m.badge) {
        g += `<g transform="translate(17 -47)"><circle r="9" fill="var(--state-${m.badge})" stroke="${line}" stroke-width="2"/><svg x="-5.500" y="-5.500" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--on-state-${m.badge})" stroke-width="3.500" stroke-linecap="round" stroke-linejoin="round">${I[STATE_ICON[m.badge]]}</svg></g>`;
      }
      g += '</g>';
      if (m.tag) {
        const w = 14 + m.tag.length * 6.9;
        const left = m.tagPos === 'l';
        const below = m.tagPos === 'b';
        const tx = below ? -w / 2 : left ? -26 * big - w : 26 * big;
        const ty = below ? 6 : -41 * big;
        const sig = m.tagSignal;
        g += `<rect x="${tx + 2}" y="${ty + 2}" width="${w}" height="23" rx="5" fill="${line}"/>`;
        g += `<rect x="${tx}" y="${ty}" width="${w}" height="23" rx="5" fill="${sig ? 'var(--signal)' : 'var(--surface)'}" stroke="${line}" stroke-width="2"/>`;
        g += `<text x="${tx + w / 2}" y="${ty + 16.500}" text-anchor="middle" class="mktext" fill="${sig ? 'var(--on-signal)' : 'var(--foreground)'}" font-size="13.500">${m.tag}</text>`;
      }
    }
    return `<g class="mk">${g}</g>`;
  }

  function drawMap(el, cfg) {
    const W = el.clientWidth;
    const H = el.clientHeight;
    if (!W || !H) return;
    const v = W < 700 || !cfg.view.d ? cfg.view.m : cfg.view.d;
    const k = 1 / Math.max(W / v[2], H / v[3]);
    let s = `<svg viewBox="${v.join(' ')}" preserveAspectRatio="${cfg.align || "xMidYMid"} slice" style="--k:${k.toFixed(4)};--unrot:${-ROT}deg" role="img" aria-label="${cfg.alt || 'Mapa'}">`;
    s += `<style>.maplabel{font:600 calc(10.500px * var(--k))/1 'Barlow Semi Condensed',sans-serif;letter-spacing:.09em;fill:var(--map-label);text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:var(--map-street);stroke-width:calc(3px * var(--k))}.mktext{font-family:'Barlow Condensed',sans-serif;font-weight:800;letter-spacing:.04em}</style>`;
    s += `<g transform="rotate(${ROT} 800 500)">` + baseLayers();
    if (cfg.coverage) {
      const [cx, cy] = P(cfg.coverage.at);
      const b = brandVars(cfg.coverage.main && marca ? marca : cfg.coverage.brand || '#0d0f12');
      s += `<circle cx="${cx}" cy="${cy}" r="${cfg.coverage.r}" fill="${b.fill}" opacity=".13"/>`;
      s += `<circle cx="${cx}" cy="${cy}" r="${cfg.coverage.r}" fill="none" stroke="var(--foreground)" stroke-width="2.500" stroke-dasharray="9 7" vector-effect="non-scaling-stroke"/>`;
    }
    for (const r of cfg.routes || []) {
      const d = pathOf(r.pts);
      const thin = r.thin;
      // stroke widths are screen pixels converted to map units (k), so dashes stay proportional
      const cw = (thin ? 8 : 14) * k;
      const iw = (thin ? 4 : 8) * k;
      const common = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
      s += `<path d="${d}" ${common} stroke="var(--outline-fill)" stroke-width="${cw}"/>`;
      s += `<path d="${d}" ${common} stroke="var(--signal)" stroke-width="${iw}" pathLength="100" class="${r.draw ? 'route-draw' : ''}"/>`;
      if (r.done) {
        s += `<path d="${d}" ${common} stroke="var(--map-done)" stroke-width="${iw}" pathLength="100" stroke-linecap="butt" stroke-dasharray="${r.done} 100"/>`;
      }
      if (r.rider) {
        const m = r.rider;
        s += `<g class="rider ${r.move ? 'is-moving' : ''}" style="offset-path:path('${d}');--at:${r.done || 50}%;--from:${r.from || r.done || 30}%;--to:${r.to || 80}%">${marker(m)}</g>`;
      }
    }
    for (const m of cfg.markers || []) {
      const [x, y] = P(m.at);
      s += `<g transform="translate(${x} ${y})">${marker(m)}</g>`;
    }
    s += '</g></svg>';
    el.querySelectorAll(':scope > svg').forEach((n) => n.remove());
    el.insertAdjacentHTML('afterbegin', s);
  }

  /* ---------- arranque ---------- */
  function boot() {
    document.querySelectorAll('[data-brand]').forEach(applyBrand);
    document.querySelectorAll('[data-i]').forEach((el) => (el.outerHTML = icon(el.dataset.i, el.className ? `class="${el.className}"` : '')));
    document.querySelectorAll('[data-logo]').forEach((el) => (el.innerHTML = logoMark() + (el.dataset.logo === 'mark' ? '' : '<span>Hornilla</span>')));
    document.querySelectorAll('[data-balon]').forEach((el) => (el.innerHTML = balon(el.dataset.balon)));
    const maps = window.RUTA_MAPS || {};
    document.querySelectorAll('[data-map]').forEach((el) => {
      const cfg = maps[el.dataset.map];
      if (!cfg) return;
      let t;
      const run = () => drawMap(el, cfg);
      run();
      new ResizeObserver(() => {
        clearTimeout(t);
        t = setTimeout(run, 60);
      }).observe(el);
    });
    // conserva ?tema y ?marca al navegar entre pantallas de la maqueta
    if (location.search) {
      document.querySelectorAll('a[href$=".html"]').forEach((a) => (a.href = a.getAttribute('href') + location.search));
    }
  }
  window.RUTA = { brandVars, icon, balon, contrast, rgb, marca, dark };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
