/* Hornilla · Direccion B "Cocina de casa" · utilidades de la maqueta (tema, marca, iconos, balon, mapa) */
(function () {
  const q = new URLSearchParams(location.search);
  const root = document.documentElement;
  const oscuro = q.get('tema') === 'oscuro';
  if (oscuro) root.classList.add('dark');

  if (window.tailwind) {
    window.tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            bg: 'var(--bg)',
            soft: 'var(--bg-soft)',
            surface: 'var(--surface)',
            surface2: 'var(--surface-2)',
            ink: 'var(--ink)',
            muted: 'var(--ink-2)',
            line: 'var(--line)',
            primary: 'var(--primary)',
            onprimary: 'var(--on-primary)',
            ptext: 'var(--primary-text)',
            psoft: 'var(--primary-soft)',
            secondary: 'var(--secondary)',
            stext: 'var(--secondary-text)',
            ssoft: 'var(--secondary-soft)',
            aji: 'var(--aji)',
          },
          fontFamily: {
            display: ['Gabarito', 'Figtree', 'system-ui', 'sans-serif'],
            sans: ['Figtree', 'system-ui', 'sans-serif'],
          },
          boxShadow: { s1: 'var(--sh-1)', s2: 'var(--sh-2)', s3: 'var(--sh-3)' },
          screens: { xs: '380px' },
        },
      },
    };
  }

  /* ---------- color de marca ---------- */
  const INK = '#14182b';
  const rgb = (h) => {
    h = h.replace('#', '');
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const lum = (h) => {
    const [r, g, b] = rgb(h).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contraste = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const mezcla = (a, b, t) => {
    const [A, B] = [rgb(a), rgb(b)];
    return hex(A.map((v, i) => v + (B[i] - v) * t));
  };
  const hasta = (color, hacia, fondo, min) => {
    let c = color;
    for (let i = 0; i < 40 && contraste(c, fondo) < min; i++) c = mezcla(c, hacia, 0.06);
    return c;
  };

  function derivar(marca) {
    const fondo = oscuro ? '#0d111e' : '#ffffff';
    const superficie = oscuro ? '#222a40' : '#ffffff';
    let fill = marca;
    if (oscuro) fill = hasta(fill, '#ffffff', fondo, 3);
    let on = contraste(fill, INK) >= contraste(fill, '#ffffff') ? INK : '#ffffff';
    fill = hasta(fill, on === INK ? '#ffffff' : '#000000', on, 4.5);
    const soft = mezcla(superficie, fill, oscuro ? 0.16 : 0.1);
    const text = hasta(fill, oscuro ? '#ffffff' : INK, soft, 4.6);
    return { fill, on, soft, text };
  }
  function aplicarMarca(el, marca, p) {
    const d = derivar(marca);
    const n = p ? { fill: '--m', on: '--on-m', text: '--m-text', soft: '--m-soft' }
      : { fill: '--primary', on: '--on-primary', text: '--primary-text', soft: '--primary-soft' };
    Object.keys(n).forEach((k) => el.style.setProperty(n[k], d[k]));
    return d;
  }
  const MARCA_HORNILLA = '#ff6a13';
  const marcaQ = q.get('marca');
  const marca = marcaQ && /^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(marcaQ) ? '#' + marcaQ : MARCA_HORNILLA;
  aplicarMarca(root, marca, false);

  /* ---------- iconos (trazo 1.75, familia lucide) ---------- */
  const I = {
    'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'chev-r': '<path d="m9 18 6-6-6-6"/>',
    'chev-l': '<path d="m15 18-6-6 6-6"/>',
    'chev-d': '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    nav: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    locate: '<line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    list: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    box: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/>',
    chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    'wifi-off': '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    cel: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
    cash: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    'arrow-r': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    headset: '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>',
    repeat: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    moto: '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M8.5 17h5l2.2-6.5H19"/><path d="M14.5 6.5H17l1.5 10.5"/><path d="M5 11.5h5.5l2 3"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    dot: '<circle cx="12" cy="12" r="4"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  };
  const ic = (n, cls = '') =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || I.dot}</svg>`;

  /* ---------- logo: aro de hornilla + llama ---------- */
  const LLAMA = 'M24 13.2c1 3.7 6.6 6.1 6.6 11.5a6.6 6.6 0 0 1-13.2 0c0-2.6 1.3-4.5 2.8-5.7 0 1.9.7 3.1 1.8 3.5-.4-3.5.6-6.8 2-9.3z';
  const simbolo = (t = 32, aro = 'var(--primary)', llama = 'var(--secondary)') =>
    `<svg viewBox="0 0 48 48" width="${t}" height="${t}" aria-hidden="true"><circle cx="24" cy="24" r="18" fill="none" stroke="${aro}" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="17.3 10.97" transform="rotate(-27.5 24 24)"/><path d="${LLAMA}" fill="${llama}"/></svg>`;
  const logo = (t = 32) =>
    `<span class="inline-flex items-center gap-2">${simbolo(t)}<span class="font-display font-extrabold tracking-tight text-ink" style="font-size:${t * 0.72}px;line-height:1">Hornilla</span></span>`;

  /* ---------- balon generico: toma el color de --m ---------- */
  let nBalon = 0;
  function balon(kg, alto) {
    const d = { 10: { w: 78, h: 86 }, 15: { w: 78, h: 116 }, 45: { w: 62, h: 176 } }[kg] || { w: 78, h: 86 };
    const H = d.h + 62;
    const x = (120 - d.w) / 2;
    const y = 46;
    const rx = Math.min(d.w / 2, kg === 45 ? 24 : 30);
    const id = 'bg' + ++nBalon;
    const pw = d.w * 0.7;
    return `<svg class="balon" viewBox="0 0 120 ${H}" ${alto ? `height="${alto}"` : ''} role="img" aria-label="Balón de ${kg} kg">
      <defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".38" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>
      <ellipse cx="60" cy="${y + d.h + 8}" rx="${d.w * 0.52}" ry="5" fill="#14182b" opacity=".12"/>
      <rect x="${(120 - pw) / 2}" y="${y + d.h - 12}" width="${pw}" height="20" rx="5" fill="currentColor"/>
      <rect x="${(120 - pw) / 2}" y="${y + d.h - 12}" width="${pw}" height="20" rx="5" fill="#000" opacity=".3"/>
      <rect x="54" y="24" width="12" height="24" rx="3" fill="#9aa3b5"/>
      <rect x="49" y="22" width="22" height="7" rx="3.5" fill="#6d7589"/>
      <rect x="41" y="14" width="38" height="40" rx="11" fill="none" stroke="currentColor" stroke-width="7"/>
      <rect x="41" y="14" width="38" height="40" rx="11" fill="none" stroke="#000" stroke-opacity=".16" stroke-width="7"/>
      <rect x="${x}" y="${y}" width="${d.w}" height="${d.h}" rx="${rx}" fill="currentColor"/>
      <rect x="${x}" y="${y}" width="${d.w}" height="${d.h}" rx="${rx}" fill="url(#${id})"/>
      <path d="M${x + 2} ${y + d.h * 0.62}h${d.w - 4}" stroke="#000" stroke-opacity=".16" stroke-width="2"/>
      <rect x="${x + 9}" y="${y + 20}" width="6" height="${d.h - 46}" rx="3" fill="#fff" opacity=".4"/>
      <rect x="36" y="${y + d.h * 0.62 - 34}" width="48" height="22" rx="11" fill="#fff" opacity=".94"/>
      <text x="60" y="${y + d.h * 0.62 - 18.5}" text-anchor="middle" font-family="Gabarito, sans-serif" font-weight="800" font-size="13" fill="#14182b">${kg} kg</text>
    </svg>`;
  }

  /* ---------- mapa estilizado ---------- */
  const CW = 120, CH = 90, ANG = -8;
  const esAv = (k) => ((k % 4) + 4) % 4 === 0;
  const g = (k) => (esAv(k) ? 26 : 11);
  const hash = (c, r) => Math.abs((c * 73856093) ^ (r * 19349663)) % 97;
  const NOMBRES_H = ['Av. Los Olivos', 'Av. El Sol', 'Av. Las Retamas'];
  const NOMBRES_V = ['Av. Central', 'Jr. Los Cedros', 'Jr. Las Flores'];

  function trazo(pts, radio = 16) {
    const P = pts.map(([c, r]) => [c * CW, r * CH]);
    let d = `M${P[0][0]} ${P[0][1]}`;
    for (let i = 1; i < P.length - 1; i++) {
      const [a, b, c] = [P[i - 1], P[i], P[i + 1]];
      const u = (p, q) => {
        const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
        return [(q[0] - p[0]) / l, (q[1] - p[1]) / l, l];
      };
      const [ux, uy, l1] = u(b, a);
      const [vx, vy, l2] = u(b, c);
      const k = Math.min(radio, l1 / 2, l2 / 2);
      d += ` L${(b[0] + ux * k).toFixed(1)} ${(b[1] + uy * k).toFixed(1)} Q${b[0]} ${b[1]} ${(b[0] + vx * k).toFixed(1)} ${(b[1] + vy * k).toFixed(1)}`;
    }
    const z = P[P.length - 1];
    return d + ` L${z[0]} ${z[1]}`;
  }
  const icSvg = (n, t, color, sw = 2) =>
    `<svg x="${-t / 2}" y="${-t / 2}" width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
  const pildora = (txt, y, fuerte) => {
    const w = txt.length * 6.6 + 18;
    return `<g transform="translate(0 ${y})"><rect x="${-w / 2}" y="-11" width="${w}" height="22" rx="11" fill="${fuerte ? 'var(--ink)' : 'var(--surface)'}" stroke="var(--rim)"/><text y="4" text-anchor="middle" font-size="12" font-weight="700" fill="${fuerte ? 'var(--bg)' : 'var(--ink)'}">${txt}</text></g>`;
  };
  const GLIFO = { libre: 'check', ocupado: 'nav', pausa: 'pause', sinsenal: 'wifi-off', alerta: 'alert' };
  const M = {
    repartidor: (m) => `<g data-estado="${m.estado || 'libre'}" ${m.estado === 'sinsenal' ? 'opacity=".72"' : ''}>
      ${m.activo ? '<circle r="22" fill="var(--c)" class="pulso"/>' : ''}
      <circle r="21" cy="2.5" fill="#0d111e" opacity=".2"/>
      <circle r="${m.grande ? 23 : 19}" fill="var(--surface)" stroke="var(--c)" stroke-width="${m.grande ? 5 : 4}"/>
      ${icSvg('moto', m.grande ? 24 : 20, 'var(--ink)')}
      <g transform="translate(15 -15)"><circle r="9" fill="var(--c)" stroke="var(--surface)" stroke-width="2"/>${icSvg(GLIFO[m.estado] || 'check', 10, '#fff', 3)}</g>
      ${m.nombre ? pildora(m.nombre, 34, m.activo) : ''}</g>`,
    casa: (m) => `<g><ellipse rx="9" ry="3.5" fill="#0d111e" opacity=".25"/>
      <path d="M0 0c-2-3.4-15-14.6-15-26a15 15 0 0 1 30 0c0 11.400-13 22.600-15 26z" fill="var(--secondary)" stroke="var(--surface)" stroke-width="2.5"/>
      <g transform="translate(0 -26)">${icSvg('home', 16, 'var(--on-secondary)', 2.25)}</g>
      ${m.nombre ? pildora(m.nombre, 18) : ''}</g>`,
    planta: (m) => `<g><rect x="-17" y="-15" width="34" height="34" rx="11" fill="#0d111e" opacity=".2"/>
      <rect x="-17" y="-17" width="34" height="34" rx="11" fill="${m.color || 'var(--ink)'}" stroke="var(--surface)" stroke-width="2.5"/>
      ${m.sigla ? `<text y="5" text-anchor="middle" font-family="Gabarito,sans-serif" font-size="13" font-weight="800" fill="${m.sobre || 'var(--bg)'}">${m.sigla}</text>` : icSvg('flame', 16, m.sobre || 'var(--bg)', 2.25)}
      ${m.nombre ? pildora(m.nombre, 32) : ''}</g>`,
    pedido: (m) => `<g data-estado="${m.estado || 'alerta'}"><circle r="15" cy="2" fill="#0d111e" opacity=".2"/>
      <circle r="14" fill="var(--c)" stroke="var(--surface)" stroke-width="2.5"/>
      <text y="4.5" text-anchor="middle" font-family="Gabarito,sans-serif" font-size="13" font-weight="800" fill="#fff">${m.n || ''}</text>
      ${m.nombre ? pildora(m.nombre, 28) : ''}</g>`,
  };

  function svgMapa(w, h, o) {
    const z = o.zoom || 1;
    const [cx, cy] = o.centro || [0, 0];
    const [ox, oy] = o.offset || [0, 0];
    const R = Math.hypot(w, h) / 2 / z + Math.hypot(ox, oy) / z + 40;
    const c0 = Math.floor((cx * CW - R) / CW) - 1, c1 = Math.ceil((cx * CW + R) / CW) + 1;
    const r0 = Math.floor((cy * CH - R) / CH) - 1, r1 = Math.ceil((cy * CH + R) / CH) + 1;
    let s = '';
    for (let c = c0; c < c1; c++)
      for (let r = r0; r < r1; r++) {
        const x = c * CW + g(c) / 2, y = r * CH + g(r) / 2;
        const bw = CW - g(c) / 2 - g(c + 1) / 2, bh = CH - g(r) / 2 - g(r + 1) / 2;
        const k = hash(c, r);
        if (k % 13 === 0) {
          s += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="9" fill="var(--map-park)"/>`;
          s += `<circle cx="${x + bw * 0.3}" cy="${y + bh * 0.4}" r="9" fill="var(--state-free)" opacity=".3"/><circle cx="${x + bw * 0.62}" cy="${y + bh * 0.62}" r="12" fill="var(--state-free)" opacity=".3"/><circle cx="${x + bw * 0.78}" cy="${y + bh * 0.3}" r="6" fill="var(--state-free)" opacity=".3"/>`;
        } else if (k % 5 === 0) {
          const m = bw * 0.46;
          s += `<rect x="${x}" y="${y}" width="${m}" height="${bh}" rx="6" fill="var(--map-block-2)"/><rect x="${x + m + 6}" y="${y}" width="${bw - m - 6}" height="${bh}" rx="6" fill="var(--map-block)"/>`;
        } else s += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6" fill="var(--map-block${k % 3 === 0 ? '-2' : ''})"/>`;
      }
    // rio y puentes
    s += `<path d="M-2600 640C-1500 720 -700 470 -100 530S900 380 2800 420" fill="none" stroke="var(--map-water)" stroke-width="44" stroke-linecap="round"/>`;
    for (let c = c0; c <= c1; c++)
      if (esAv(c)) s += `<path d="M${c * CW} ${r0 * CH}V${r1 * CH}" stroke="var(--map-street)" stroke-width="26"/>`;
    // nombres de calles
    const fs = 11 / Math.min(z, 1.25);
    for (let r = r0; r <= r1; r++)
      if (esAv(r))
        for (let c = c0; c <= c1; c++)
          if ((((c % 4) + 4) % 4) === 2)
            s += `<text x="${c * CW}" y="${r * CH + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="600" letter-spacing=".04em" fill="var(--map-label)">${NOMBRES_H[Math.abs(r / 4) % 3]}</text>`;
    for (let c = c0; c <= c1; c++)
      if (esAv(c))
        for (let r = r0; r <= r1; r++)
          if ((((r % 4) + 4) % 4) === 2)
            s += `<text transform="translate(${c * CW + fs * 0.36} ${r * CH}) rotate(-90)" text-anchor="middle" font-size="${fs}" font-weight="600" letter-spacing=".04em" fill="var(--map-label)">${NOMBRES_V[Math.abs(c / 4) % 3]}</text>`;
    // cobertura
    (o.circulos || []).forEach((k) => {
      s += `<circle cx="${k.c * CW}" cy="${k.r * CH}" r="${k.radio}" fill="${k.color || 'var(--primary)'}" fill-opacity=".08" stroke="${k.color || 'var(--primary)'}" stroke-opacity=".7" stroke-width="${2 / z}" stroke-dasharray="${6 / z} ${7 / z}"/>`;
    });
    // rutas
    const inv = `rotate(${-ANG}) scale(${1 / z})`;
    let movil = '';
    (o.rutas || (o.ruta ? [{ pts: o.ruta, progreso: o.progreso, movil: o.movil }] : [])).forEach((rt) => {
      const d = trazo(rt.pts);
      const p = Math.round((rt.progreso ?? 0) * 100);
      const col = rt.color || 'var(--primary)';
      const a = rt.ancho || 7;
      s += `<path d="${d}" fill="none" stroke="var(--map-casing)" stroke-width="${(a + 6) / z}" stroke-linecap="round" stroke-linejoin="round" ${rt.tenue ? 'opacity=".7"' : ''}/>`;
      if (o.contraste) s += `<path d="${d}" fill="none" stroke="var(--ink)" stroke-width="${(a + 3) / z}" stroke-linecap="round" stroke-linejoin="round"/>`;
      s += `<path class="ruta-trazo" pathLength="100" d="${d}" fill="none" stroke="${col}" stroke-width="${a / z}" stroke-linecap="round" stroke-linejoin="round" ${rt.tenue ? 'opacity=".55"' : ''}/>`;
      if (p > 0 && !o.contraste) s += `<path pathLength="100" d="${d}" fill="none" stroke="var(--map-casing)" stroke-opacity=".62" stroke-width="${(a + 0.5) / z}" stroke-dasharray="${p} 100" stroke-linejoin="round"/>`;
      if (rt.movil)
        movil += `<g class="viaja" style="offset-path:path('${d}');offset-distance:${p}%;offset-rotate:0deg;--desde:${Math.max(0, p - 16)}%"><g transform="${inv}">${M.repartidor(rt.movil)}</g></g>`;
    });
    (o.marcadores || []).forEach((m) => {
      s += `<g transform="translate(${m.c * CW} ${m.r * CH}) ${inv}">${M[m.tipo](m)}</g>`;
    });
    s += movil;
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${o.titulo || 'Mapa'}"><rect width="${w}" height="${h}" fill="var(--map-street)"/><g transform="translate(${w / 2 + ox} ${h / 2 + oy}) rotate(${ANG}) scale(${z}) translate(${-cx * CW} ${-cy * CH})">${s}</g></svg>`;
  }
  function mapa(sel, cfg) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return;
    const pintar = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w && h) el.innerHTML = svgMapa(w, h, typeof cfg === 'function' ? cfg(w, h) : cfg);
    };
    pintar();
    let t;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(pintar, 120); });
  }

  const soles = (cent) => 'S/ ' + (cent / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function hidratar(raiz = document) {
    raiz.querySelectorAll('[data-marca]').forEach((el) => aplicarMarca(el, el.dataset.marca, true));
    raiz.querySelectorAll('i[data-i]').forEach((el) => {
      const t = document.createElement('template');
      t.innerHTML = ic(el.dataset.i, el.className);
      el.replaceWith(t.content.firstChild);
    });
    raiz.querySelectorAll('[data-logo]').forEach((el) => (el.innerHTML = logo(+el.dataset.logo || 32)));
    raiz.querySelectorAll('[data-simbolo]').forEach((el) => (el.innerHTML = simbolo(+el.dataset.simbolo || 32)));
    raiz.querySelectorAll('[data-balon]').forEach((el) => (el.innerHTML = balon(+el.dataset.balon, el.dataset.alto)));
    raiz.querySelectorAll('.entra-grupo').forEach((gr) => [...gr.children].forEach((c, i) => { c.classList.add('entra'); c.style.setProperty('--i', i); }));
    if (location.search) raiz.querySelectorAll('a[href$=".html"]').forEach((a) => (a.href = a.getAttribute('href') + location.search));
  }
  document.addEventListener('DOMContentLoaded', () => hidratar());

  window.H = { ic, logo, simbolo, balon, mapa, soles, hidratar, aplicarMarca, derivar, contraste, oscuro, marca };
})();
