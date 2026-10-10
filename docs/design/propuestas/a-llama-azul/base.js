/* Hornilla · Direction A "Llama azul" — mockup helpers (theme, brand color, icons, logo, cylinder, map).
   Mockup only. Query: ?tema=claro|oscuro  ?marca=<hex without #> */
(function () {
  const params = new URLSearchParams(location.search);
  const root = document.documentElement;

  // ---------- Theme ----------
  const theme = params.get('tema') === 'claro' ? 'claro' : 'oscuro';
  root.classList.toggle('dark', theme === 'oscuro');
  root.dataset.tema = theme;

  // ---------- Tailwind (layout utilities only; preflight off, tokens come from base.css) ----------
  window.tailwind = window.tailwind || {};
  window.tailwind.config = {
    darkMode: 'class',
    corePlugins: { preflight: false },
    theme: {
      extend: {
        screens: { sm: '640px', lg: '1024px', xl: '1280px' },
        colors: {
          bg: 'var(--background)',
          card: 'var(--card)',
          elevated: 'var(--elevated)',
          line: 'var(--border)',
          ink: 'var(--foreground)',
          mute: 'var(--muted-foreground)',
          flame: 'var(--flame)',
          ember: 'var(--action)',
        },
      },
    },
  };

  // ---------- Color math ----------
  const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
  };
  const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const INK = [10, 19, 48];
  const WHITE = [255, 255, 255];
  const CARD_DARK = [11, 19, 36];
  const CARD_LIGHT = [255, 255, 255];

  /** Pushes a brand color toward white (dark theme) or ink (light theme) until it reads at 4.5:1. */
  function readable(rgb, surface, toward) {
    let out = rgb;
    for (let t = 0; t <= 1 && contrast(out, surface) < 4.6; t += 0.04) out = mix(rgb, toward, t);
    return out;
  }
  function brandVars(hex) {
    const rgb = hexToRgb(hex);
    const fg = contrast(rgb, INK) >= contrast(rgb, WHITE) ? INK : WHITE;
    const textDark = readable(rgb, CARD_DARK, WHITE);
    const textLight = readable(rgb, CARD_LIGHT, INK);
    return {
      '--brand': rgbToHex(rgb),
      '--brand-foreground': rgbToHex(fg),
      '--brand-text-dark': rgbToHex(textDark),
      '--brand-text-light': rgbToHex(textLight),
      '--brand-soft-dark': `rgba(${textDark.map(Math.round).join(',')},0.14)`,
      '--brand-soft-light': `rgba(${textLight.map(Math.round).join(',')},0.1)`,
    };
  }
  function applyBrand(el, hex) {
    const vars = brandVars(hex);
    Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
    el.style.setProperty('--mk', vars['--brand']);
    el.style.setProperty('--mk-fg', vars['--brand-foreground']);
  }

  const DEFAULT_BRAND = '2D7FF9';
  const rawBrand = (params.get('marca') || DEFAULT_BRAND).replace('#', '');
  const brand = /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(rawBrand) ? rawBrand : DEFAULT_BRAND;
  applyBrand(root, brand);

  // ---------- Icons (lucide geometry, 24 px grid, stroke 1.75) ----------
  const I = {
    'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'arrow-right': '<path d="M5 12h14m-7-7 7 7-7 7"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    bike: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    list: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    'wifi-off': '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    locate: '<line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 12v8h16v-8"/><path d="M9 20v-5h6v5"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
    map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
    dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    headset: '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>',
    timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
    signal: '<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    repeat: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    filter: '<path d="M3 6h18M7 12h10M10 18h4"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  };
  const icon = (name, cls = '') =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name] || ''}</svg>`;

  // ---------- Hornilla symbol: the burner crown seen from above, flame in the middle ----------
  let uid = 0;
  function logo(size = 32) {
    const id = 'lg' + ++uid;
    return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FFB224"/><stop offset=".42" stop-color="#FF9A1F"/>
        <stop offset=".62" stop-color="#5CC8FF"/><stop offset="1" stop-color="#2A6BFF"/></linearGradient></defs>
      <circle cx="16" cy="16" r="12.4" fill="none" stroke="var(--flame)" stroke-width="3.4" stroke-dasharray="2.1 3.465" transform="rotate(-8 16 16)"/>
      <path d="M16 7.6c2.9 3.3 4.9 5.6 4.9 8.5a4.9 4.9 0 0 1-9.8 0c0-2.9 2-5.200 4.9-8.500z" fill="url(#${id})"/>
    </svg>`;
  }

  // ---------- Gas cylinder ("balon") drawn in the product's brand color ----------
  const BALON = {
    10: { w: 120, h: 150, bw: 88, bh: 100, rx: 30 },
    15: { w: 120, h: 172, bw: 88, bh: 122, rx: 30 },
    45: { w: 120, h: 236, bw: 66, bh: 186, rx: 26 },
  };
  function balon(kg, color) {
    const d = BALON[kg] || BALON[10];
    const id = 'bl' + ++uid;
    const cx = d.w / 2;
    const bx = cx - d.bw / 2;
    const by = 28;
    const cw = d.bw * 0.5;
    const footW = d.bw * 0.74;
    const labelY = by + d.bh * 0.44;
    return `<svg viewBox="0 0 ${d.w} ${d.h}" role="img" aria-label="Balón de ${kg} kg">
      <defs>
        <linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/>
          <stop offset=".2" stop-color="#fff" stop-opacity=".42"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/>
          <stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient>
        <clipPath id="${id}c"><rect x="${bx}" y="${by}" width="${d.bw}" height="${d.bh}" rx="${d.rx}"/></clipPath>
      </defs>
      <ellipse cx="${cx}" cy="${d.h - 7}" rx="${d.bw * 0.52}" ry="6" fill="#000" opacity=".35"/>
      <rect x="${cx - footW / 2}" y="${by + d.bh - 10}" width="${footW}" height="17" rx="4" fill="${color}"/>
      <rect x="${cx - footW / 2}" y="${by + d.bh - 10}" width="${footW}" height="17" rx="4" fill="#000" opacity=".42"/>
      <rect x="${cx - 5}" y="9" width="10" height="20" rx="2" fill="#B9C2D3"/>
      <rect x="${cx - 9}" y="12" width="18" height="6" rx="2" fill="#8D97AB"/>
      <path d="M${cx - cw / 2} 30V13a6 6 0 0 1 6-6h${cw - 12}a6 6 0 0 1 6 6v17" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/>
      <path d="M${cx - cw / 2} 30V13a6 6 0 0 1 6-6h${cw - 12}a6 6 0 0 1 6 6v17" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="6" stroke-linecap="round"/>
      <rect x="${bx}" y="${by}" width="${d.bw}" height="${d.bh}" rx="${d.rx}" fill="${color}"/>
      <g clip-path="url(#${id}c)">
        <rect x="${bx}" y="${by}" width="${d.bw}" height="${d.bh}" fill="url(#${id}s)"/>
        <path d="M${bx} ${by + d.bh * 0.24}h${d.bw}" stroke="#000" stroke-opacity=".2" stroke-width="2"/>
        <path d="M${bx} ${by + d.bh * 0.82}h${d.bw}" stroke="#000" stroke-opacity=".2" stroke-width="2"/>
      </g>
      <rect x="${cx - d.bw * 0.31}" y="${labelY - 13}" width="${d.bw * 0.62}" height="26" rx="6" fill="#fff" opacity=".94"/>
      <text x="${cx}" y="${labelY + 5.5}" text-anchor="middle" font-family="Sora, sans-serif" font-weight="700" font-size="14" fill="#0A1330">${kg} kg</text>
    </svg>`;
  }

  // ---------- Stylised city map (no tiles): grid of blocks, avenues, river, park ----------
  const W = 2600;
  const H = 1800;
  const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const XS = [];
  const YS = [];
  (function () {
    const r = rng(7);
    for (let x = 60; x < W; x += 118 + Math.floor(r() * 5) * 12) XS.push(x);
    for (let y = 50; y < H; y += 104 + Math.floor(r() * 4) * 12) YS.push(y);
  })();
  const isAve = (i) => i % 4 === 2;
  const sw = (i) => (isAve(i) ? 26 : 13);
  const lerpIdx = (arr, f) => {
    const i = Math.floor(f);
    const t = f - i;
    return t === 0 ? arr[i] : arr[i] + (arr[i + 1] - arr[i]) * t;
  };
  /** Grid node (fractions allowed) to map coordinates. */
  const node = ([i, j]) => [lerpIdx(XS, i), lerpIdx(YS, j)];
  const pathD = (pts) => pts.map((p, k) => (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function split(pts, t) {
    const total = pts.slice(1).reduce((s, p, k) => s + dist(pts[k], p), 0);
    let left = total * t;
    const done = [pts[0]];
    for (let k = 1; k < pts.length; k++) {
      const seg = dist(pts[k - 1], pts[k]);
      if (left >= seg) {
        done.push(pts[k]);
        left -= seg;
        continue;
      }
      const f = left / seg;
      const at = [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f];
      return { done: [...done, at], rest: [at, ...pts.slice(k)], at };
    }
    return { done, rest: [pts[pts.length - 1]], at: pts[pts.length - 1] };
  }

  const PARKS = { '9,5': 1, '4,8': 1, '13,3': 1, '6,2': 1, '11,9': 1 };
  const AVENUES = { x: { 6: 'Av. Los Olivos', 10: 'Av. Principal', 14: 'Av. El Sol', 2: 'Av. Los Pinos' }, y: { 2: 'Av. La Paz', 6: 'Av. Central', 10: 'Av. Las Flores' } };

  function baseLayer() {
    const r = rng(42);
    let blocks = '';
    let buildings = '';
    for (let i = 0; i < XS.length - 1; i++) {
      for (let j = 0; j < YS.length - 1; j++) {
        const x = XS[i] + sw(i) / 2;
        const y = YS[j] + sw(j) / 2;
        const w = XS[i + 1] - sw(i + 1) / 2 - x;
        const h = YS[j + 1] - sw(j + 1) / 2 - y;
        const park = PARKS[i + ',' + j];
        blocks += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="var(${park ? '--map-park' : '--map-block'})"/>`;
        if (park) {
          for (let k = 0; k < 7; k++) buildings += `<circle cx="${x + 14 + r() * (w - 28)}" cy="${y + 14 + r() * (h - 28)}" r="${5 + r() * 5}" fill="var(--state-free)" opacity=".16"/>`;
          continue;
        }
        const n = 2 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const bw = 22 + r() * (w * 0.4);
          const bh = 18 + r() * (h * 0.36);
          buildings += `<rect x="${(x + 8 + r() * (w - bw - 16)).toFixed(0)}" y="${(y + 8 + r() * (h - bh - 16)).toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" rx="3" fill="var(--map-building)"/>`;
        }
      }
    }
    const river = `M-20 ${YS[10] + 40}C${XS[4]} ${YS[9]} ${XS[6]} ${YS[12] - 20} ${XS[9]} ${YS[11]}S${XS[14]} ${YS[9] + 30} ${XS[17]} ${YS[11]}S${W - 100} ${YS[10]} ${W + 20} ${YS[12]}`;
    let bridges = '';
    let labels = '';
    XS.forEach((x, i) => {
      if (!isAve(i)) return;
      bridges += `<path d="M${x} ${YS[8]}V${H}" stroke="var(--map-bg)" stroke-width="${sw(i)}"/>`;
      const name = AVENUES.x[i];
      if (name) [3, 7].forEach((j) => (labels += `<text class="m-label" transform="translate(${x + 3.5} ${YS[j] + (YS[j + 1] - YS[j]) / 2}) rotate(-90)" text-anchor="middle">${name}</text>`));
    });
    YS.forEach((y, j) => {
      const name = AVENUES.y[j];
      if (name) [3, 7, 11, 15].forEach((i) => (labels += `<text class="m-label" x="${XS[i] + (XS[i + 1] - XS[i]) / 2}" y="${y + 3.5}" text-anchor="middle">${name}</text>`));
    });
    return `<rect width="${W}" height="${H}" fill="var(--map-bg)"/>${blocks}${buildings}
      <path d="${river}" fill="none" stroke="var(--map-water)" stroke-width="54" stroke-linecap="round"/>
      <path d="${river}" fill="none" stroke="var(--flame)" stroke-opacity=".08" stroke-width="30" stroke-linecap="round"/>
      ${bridges}${labels}`;
  }

  const STATE_ICON = { free: 'check', busy: 'bike', paused: 'pause', offline: 'wifi-off' };
  function riderMarker(r) {
    const c = `var(--state-${r.state})`;
    const off = r.state === 'offline';
    const tagW = r.label ? r.label.length * 6.6 + 18 : 0;
    return `<g class="marker-in" opacity="${off ? 0.75 : 1}">
      ${r.pulse ? `<circle class="pulse" r="20" fill="${c}"/>` : ''}
      <circle r="24" fill="${c}" opacity=".16"/>
      <circle r="17" fill="var(--card)" stroke="${c}" stroke-width="3" ${off ? 'stroke-dasharray="4 4"' : ''}/>
      <g transform="translate(-9.500 -9.500) scale(.79)" fill="none" stroke="${c}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${I[STATE_ICON[r.state]]}</g>
      ${r.label ? `<g transform="translate(${-tagW / 2} 23)"><rect class="m-tag-bg" width="${tagW}" height="21" rx="10.5"/><text class="m-tag" x="${tagW / 2}" y="15" text-anchor="middle">${r.label}</text></g>` : ''}
    </g>`;
  }
  function pinMarker(p) {
    const kinds = {
      home: { c: 'var(--action)', fg: 'var(--action-foreground)', i: 'home' },
      order: { c: 'var(--action)', fg: 'var(--action-foreground)', i: 'package' },
      plant: { c: p.color || 'var(--brand)', fg: p.fg || 'var(--brand-foreground)', i: 'store' },
    };
    const k = kinds[p.kind] || kinds.home;
    const tagW = p.label ? p.label.length * 6.6 + 18 : 0;
    const small = p.kind === 'order';
    const s = small ? 0.8 : 1;
    return `<g class="marker-in"><g transform="scale(${s})">
      <ellipse cy="2" rx="9" ry="3.5" fill="#000" opacity=".4"/>
      ${p.kind === 'home' ? `<circle cy="-24" r="30" fill="${k.c}" opacity=".16"/>` : ''}
      <path d="M0 0C-5-8-17-15-17-27a17 17 0 0 1 34 0C17-15 5-8 0 0z" fill="${k.c}" stroke="var(--pin-edge)" stroke-width="2"/>
      <g transform="translate(-9.500 -37) scale(.79)" fill="none" stroke="${k.fg}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${I[k.i]}</g></g>
      ${p.label ? `<g transform="translate(${-tagW / 2} 8)"><rect class="m-tag-bg" width="${tagW}" height="21" rx="10.5"/><text class="m-tag" x="${tagW / 2}" y="15" text-anchor="middle">${p.label}</text></g>` : ''}
    </g>`;
  }

  /**
   * Draws a map into `el`. cfg: { route:[[i,j]…], progress, from, riders:[{at,state,label,pulse}],
   * pins:[{at,kind,label,color}], coverage:[{at,r,color}], view:{mobile:{c,z,dy}, desktop:{c,z,dx,dy}} }
   */
  function map(el, cfg) {
    const f = 'mf' + ++uid;
    let overlay = '';
    (cfg.coverage || []).forEach((c) => {
      const [x, y] = node(c.at);
      overlay += `<circle cx="${x}" cy="${y}" r="${c.r}" fill="${c.color}" fill-opacity=".06" stroke="${c.color}" stroke-opacity=".6" stroke-width="1.500" stroke-dasharray="3 6"/>`;
    });
    let moving = '';
    if (cfg.route) {
      const pts = cfg.route.map(node);
      const { done, rest } = split(pts, cfg.progress ?? 0.5);
      overlay += `<path d="${pathD(done)}" fill="none" stroke="var(--map-route-done)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 10"/>
        <path d="${pathD(rest)}" fill="none" stroke="var(--map-route-glow)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" filter="url(#${f})"/>
        <path class="route-draw" pathLength="100" d="${pathD(rest)}" fill="none" stroke="var(--map-route)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${pathD(rest)}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.200" stroke-linecap="round" stroke-linejoin="round"/>`;
      const to = (cfg.progress ?? 0.5) * 100;
      const from = (cfg.from ?? Math.max(0, (cfg.progress ?? 0.5) - 0.3)) * 100;
      moving = `<g class="rider-move" style="offset-path:path('${pathD(pts)}');--from:${from}%;--to:${to}%">${riderMarker({ state: 'busy', pulse: true, label: cfg.riderLabel })}</g>`;
    }
    (cfg.pins || []).forEach((p) => {
      const [x, y] = node(p.at);
      overlay += `<g transform="translate(${x} ${y})">${pinMarker(p)}</g>`;
    });
    (cfg.riders || []).forEach((r) => {
      const [x, y] = node(r.at);
      overlay += `<g transform="translate(${x} ${y})">${riderMarker(r)}</g>`;
    });
    el.insertAdjacentHTML(
      'afterbegin',
      `<svg role="img" aria-label="${cfg.label || 'Mapa'}" preserveAspectRatio="xMidYMid slice">
        <defs><filter id="${f}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter></defs>
        ${baseLayer()}${overlay}${moving}</svg>`,
    );
    const svg = el.querySelector('svg');
    const fit = () => {
      const desktop = window.innerWidth >= 1024;
      const v = (desktop ? cfg.view.desktop : cfg.view.mobile) || cfg.view.mobile;
      const [cx, cy] = node(v.c);
      const z = v.z || 1;
      const w = el.clientWidth / z;
      const h = el.clientHeight / z;
      svg.setAttribute('viewBox', `${cx - w / 2 + (v.dx || 0)} ${cy - h / 2 + (v.dy || 0)} ${w} ${h}`);
    };
    fit();
    window.addEventListener('resize', fit);
  }

  // ---------- ETA dial: the burner crown filling up ----------
  function dial(value, unit, fraction) {
    const id = 'dl' + ++uid;
    const ring = 'cx="58" cy="58" r="50" fill="none" stroke-width="9" stroke-dasharray="3.2 5.527"';
    return `<div class="dial" role="img" aria-label="${value} ${unit}">
      <svg viewBox="0 0 116 116"><defs>
        <mask id="${id}"><circle cx="58" cy="58" r="50" fill="none" stroke="#fff" stroke-width="14" pathLength="100" stroke-dasharray="${fraction * 100} 100" transform="rotate(-90 58 58)"/></mask>
        <filter id="${id}g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.500"/></filter></defs>
        <circle ${ring} stroke="var(--border-strong)"/>
        <g mask="url(#${id})"><circle ${ring} stroke="var(--map-route-glow)" filter="url(#${id}g)"/><circle ${ring} stroke="var(--flame)"/></g>
      </svg>
      <div style="text-align:center"><div class="dial-n">${value}</div><div class="dial-u">${unit}</div></div></div>`;
  }

  // ---------- Money ----------
  const soles = (cents) => 'S/ ' + (cents / 100).toFixed(2);

  // ---------- Boot ----------
  function boot() {
    document.querySelectorAll('[data-i]').forEach((el) => {
      el.outerHTML = icon(el.dataset.i, el.className);
    });
    document.querySelectorAll('[data-logo]').forEach((el) => (el.innerHTML = logo(+el.dataset.logo || 32)));
    document.querySelectorAll('[data-balon]').forEach((el) => {
      const color = el.dataset.color || 'var(--brand)';
      el.style.setProperty('--pc', color);
      el.innerHTML = balon(+el.dataset.balon, color);
    });
    document.querySelectorAll('[data-dial]').forEach((el) => {
      const [value, unit, fraction] = el.dataset.dial.split('|');
      el.outerHTML = dial(value, unit, +fraction);
    });
    document.querySelectorAll('[data-brand]').forEach((el) => applyBrand(el, el.dataset.brand));
    document.querySelectorAll('[data-brand-main]').forEach((el) => applyBrand(el, brand));
    // keep ?tema and ?marca while navigating between mockup pages
    const keep = new URLSearchParams();
    if (params.get('tema')) keep.set('tema', params.get('tema'));
    if (params.get('marca')) keep.set('marca', params.get('marca'));
    const qs = keep.toString();
    if (qs)
      document.querySelectorAll('a[href$=".html"]').forEach((a) => a.setAttribute('href', a.getAttribute('href') + '?' + qs));
  }

  window.Hornilla = { icon, logo, balon, map, dial, soles, applyBrand, brand: '#' + brand, theme, onReady: (fn) => document.addEventListener('DOMContentLoaded', () => { fn && fn(); boot(); }) };
})();
