---
name: ui-system
description: Sistema de diseño de Hornilla (glpWEB), dirección "Cocina de casa" — tokens claro y oscuro con contraste, color de marca por distribuidora (BrandTheme y su derivación), colores de estado, fuentes Gabarito y Figtree, escala tipográfica, radios, sombras, fotos, resalte, balón SVG, logo, mapa y marcadores, reglas de los tres ambientes (cliente, repartidor, central) y patrones de las pantallas maquetadas, en celular y escritorio. Cargar antes de crear o modificar cualquier pantalla, componente o estilo.
---

# Sistema de diseño de Hornilla

En la interfaz el producto se llama **Hornilla**; `glpWEB` no aparece en ningún texto visible.
Los valores viven en `src/index.css`. Si algo cambia, se cambia **primero aquí** y después allí.
Referencia visual: `docs/design/propuestas/b-cocina-de-casa/` (maqueta; sus capturas se
regeneran con `node docs/design/propuestas/b-cocina-de-casa/capturas.mjs`). Qué construir en cada
pantalla: `docs/design/DIRECCION.md`.

## 1. Contrato fijo
- Componentes: shadcn/ui (estilo `base-nova`, sobre Base UI) con Tailwind 4 (CSS-first, sin
  `tailwind.config`). Añadir con `npx shadcn@latest add <componente>`; ver skill `shadcn`.
  `components/ui/*` no se edita a mano: lo propio de Hornilla va en componentes que los envuelven.
- Iconos: `lucide-react`, una sola familia, trazo 1.75 (2.25–3 solo en glifos de ≤ 16 px dentro
  de chips e insignias).
- Movimiento: `motion/react` con `useReducedMotion()`; fichas en la skill `motion-system`.
- Colores solo por token (`bg-background`, `text-foreground`, `bg-primary`…); ningún hex en
  componentes. Las únicas excepciones son `public/favicon.svg` y los datos (color de marca de
  una distribuidora o de una marca de gas, que llegan como dato).
- Claro y oscuro por variables en `:root` y `.dark`. Los dos temas tienen el mismo rango: nada
  se da por terminado sin verse en ambos.
- Colores de estado y azul llama son del sistema: nunca dependen de la marca.

## 2. Dirección en cinco líneas
1. El gas no es un cilindro: es el almuerzo de hoy. Manda la foto de la cocina y de la gente.
2. Blanco limpio, mandarina de mercado y azul de llama. Nada de hueso, terracota ni serif.
3. Lo que dice "esto es gas" está dibujado por nosotros: el balón que toma el color de cada
   marca de gas, la corona de la hornilla del logo y el aro punteado.
4. Todo es redondo, grande y con el precio a la vista: lo entiende quien pide con la olla a medias.
5. Al sol manda la tinta, no la marca: el repartidor lee negro sobre blanco y la marca acompaña.

## 3. Adaptativo
- Puntos de corte: `<640` celular · `640–1023` tablet · `≥1024` (`lg:`) escritorio. Las
  maquetas cambian de composición en `lg:`.
- Celular: una columna, barra inferior (máx. 5), hojas desde abajo en vez de diálogos.
- Escritorio: barra lateral, contenido en 2–3 paneles, diálogos centrados. Ancho máximo de
  contenido público 1280 px (`max-w-7xl`), márgenes 16 px en celular y 32 px en escritorio.
- Objetivos táctiles ≥ 44 px (cliente 48, repartidor 56, botón crítico 72).
- Probar a 360, 390, 768 y 1440, en claro y oscuro.

## 4. Formato de textos
- `S/ 38.00` (miles con coma: `S/ 1,008.00`) · `3:30 p. m.` · `12 min` · `15–25 min` (raya
  corta, sin espacios) · `1,2 km` · `83 %` · `2 × Balón 10 kg` · pedido `#1047`.
- Cifras siempre tabulares: clase `tabular-nums` en todo precio, hora, cantidad, contador e
  indicador (comprobado en Gabarito y Figtree: todos los dígitos miden lo mismo).
- Español neutro, sin género asumido: "Tu repartidor", "Persona", "quien reparte". Tuteo.
- Vocabulario: "balón" (no cilindro ni bombona), "distribuidora", "repartidor", "central",
  "planta", "jornada", "cuadre de caja", "vacío" (el envase a cambio), "Ya llegué", "Pedir".
- Titulares: frase completa con punto final. Botones: verbo, sin punto, mayúscula solo inicial.
- Teléfonos de ejemplo `900 000 0xx` y correos `@example.com` en todo dato de demostración.

## 5. Color

### 5.1 Tokens (variable CSS → utilidad Tailwind → uso)

| Variable | Claro | Oscuro | Utilidad | Uso |
|---|---|---|---|---|
| `--background` | `#FFFFFF` | `#0D111E` | `bg-background` | fondo de página |
| `--surface-soft` | `#F3F6FB` | `#121727` | `bg-surface-soft` | bandas alternas, fondo de la central |
| `--card` / `--popover` | `#FFFFFF` | `#191F31` | `bg-card` | tarjetas, hojas, paneles flotantes |
| `--muted` / `--secondary` / `--accent` | `#F3F6FB` | `#222A40` | `bg-muted` | huecos dentro de tarjetas, campos, botón secundario |
| `--foreground` | `#14182B` | `#F3F5FA` | `text-foreground` | texto; fondo del botón tinta |
| `--muted-foreground` | `#565E76` | `#A9B1C6` | `text-muted-foreground` | texto secundario |
| `--border` | `#E2E7F0` | `#2D3650` | `border-border` | divisores y contornos decorativos |
| `--input` | `#8891A6` | `#727C98` | `border-input` | contorno de campos (≥ 3:1) |
| `--ring` | `#1565E8` | `#3D85F5` | `outline-ring` | foco: 3 px, separación 2 px |
| `--primary` | `#FF6A13` | `#FF6A13` | `bg-primary` | acción principal, resalte, ruta, paso hecho |
| `--primary-foreground` | `#14182B` | `#14182B` | `text-primary-foreground` | texto sobre primario: **tinta, no blanco** |
| `--primary-text` | `#AD4D1A` | `#FF833B` | `text-primary-text` | primario como texto (etiquetas, enlaces de acción) |
| `--primary-soft` | `#FFF0E7` | `#453439` | `bg-primary-soft` | fondo teñido, navegación activa |
| `--flame` | `#1565E8` | `#3D85F5` | `bg-flame` | azul llama: pin "tu casa", corona del logo |
| `--flame-foreground` | `#FFFFFF` | `#0D111E` | `text-flame-foreground` | glifo sobre azul llama |
| `--flame-text` | `#0F52C4` | `#7FB0FF` | `text-flame-text` | iconos informativos, enlaces de información |
| `--flame-soft` | `#E8F0FE` | `#17274A` | `bg-flame-soft` | fondo informativo |
| `--aji` | `#FFC933` | `#FFC933` | `bg-aji` | sellos y estrellas, nada más |
| `--aji-foreground` | `#14182B` | `#14182B` | `text-aji-foreground` | texto del sello |
| `--destructive` | `#B42318` | `#FF8A80` | `text-destructive` | texto y contorno de acciones destructivas |
| `--band` | `#14182B` | `#191F31` | `bg-band` | banda oscura fija (pie, llamada a dueños) |
| `--band-foreground` | `#FFFFFF` | `#FFFFFF` | `text-band-foreground` | texto sobre la banda |

`--sidebar-*` y `--chart-*` existen para shadcn: la lateral usa `--card` de fondo, navegación
activa en `primary-soft` + `primary-text`; gráficos en orden mandarina, azul llama, verde, ámbar
de pausa, gris.

Reglas de uso:
- `text-primary` **está prohibido** para texto (2.9:1 sobre blanco): se usa `text-primary-text`.
  Por lo mismo no se usa la variante `link` del botón de shadcn.
- El primario no colorea palabras de un titular: lo subraya (ver "resalte", §9).
- `bg-foreground text-background` es el botón tinta: en oscuro se invierte solo.
- Sobre `--band` el logo usa corona `#3D85F5` (el `--flame` de oscuro) en los dos temas.

### 5.2 Contraste medido (WCAG 2.1)

| Par | Claro | Oscuro |
|---|---|---|
| texto / fondo | 17.6 | 17.3 (15.0 sobre tarjeta) |
| texto secundario / fondo | 6.4 (5.9 sobre `muted`) | 8.8 (7.6 tarjeta, 6.7 `muted`) |
| tinta sobre mandarina (botón) | 6.1 | 6.1 |
| `primary-text` sobre `primary-soft` | 4.9 (5.5 sobre fondo) | 4.8 (7.7 sobre fondo) |
| `flame-foreground` sobre `flame` | 5.2 | 5.3 |
| `flame-text` sobre `flame-soft` | 6.1 | 6.7 |
| `destructive` sobre su tinte al 10–20 % | 5.6–4.7 | 5.0 |
| texto de estado sobre su chip | 5.3–6.1 | 6.1–8.1 |
| contorno de campo / tarjeta | 3.2 | 3.9 |
| foco / fondo | 5.2 | 5.3 (4.6 sobre tarjeta) |
| "Ya llegué" (fondo sobre tinta) | 17.6 | 17.3 |
| texto secundario del repartidor | 12.1 | 13.5 (11.7 sobre tarjeta) |
| nombres de calle del mapa | 5.2 | 5.0 |

Asumido por debajo de 3:1: la mandarina como superficie sobre blanco (2.9) y sobre las manzanas
del mapa (2.4). Por eso un botón primario siempre lleva texto en tinta y la ruta siempre lleva
borde (§12); ninguno depende solo del color.

### 5.3 Estados del sistema

| Estado | Token | Relleno claro / oscuro | Texto claro / oscuro | Glifo (lucide) |
|---|---|---|---|---|
| Libre | `state-free` | `#12A150` / `#2CC36B` | `#0A7038` / `#5BDC92` | `check` |
| Con pedido | `state-busy` | `#1565E8` / `#3D85F5` | `#0F52C4` / `#7FB0FF` | `navigation` |
| En pausa | `state-paused` | `#E6A100` / `#F2B632` | `#7D5200` / `#F7CB66` | `pause` |
| Sin señal | `state-offline` | `#7A8194` / `#8C94A8` | `#555C70` / `#AAB1C4` | `wifi-off` |
| Alerta | `state-danger` | `#D92D20` / `#F0554A` | `#B42318` / `#FF8A80` | `triangle-alert` |

Cada estado tiene tres variables: `--state-x` (relleno, aro del marcador, punto),
`--state-x-text` (texto sobre el chip teñido o sobre el fondo) y `--state-x-foreground` (glifo o
número sobre el relleno). Utilidades: `bg-state-free`, `text-state-free-text`,
`text-state-free-foreground`.

- **Chip de estado**: píldora, fondo `color-mix(in srgb, var(--state-x) 14%, var(--card))`,
  texto `state-x-text` 13 px peso 700, glifo de 12 px con trazo 2.5.
- **Glifo sobre relleno**: `state-x-foreground`. En claro es blanco salvo en pausa, que es tinta
  (blanco sobre ámbar da 2.2:1); en oscuro es azul noche `#0D111E` en los cinco (5.3–10.3:1).
- Sobre los rellenos libre y sin señal en claro solo van glifos, nunca texto (3.4–3.9:1).
- Siempre glifo **y** texto. El color nunca es el único dato, tampoco en el mapa.
- "Con pedido" y azul llama comparten valor a propósito: el azul es "está en movimiento".
- Espera de un pedido sin asignar: bajo el umbral, tono de pausa; al superarlo, alerta.

## 6. Color de marca por distribuidora: `BrandTheme`

`BrandTheme` envuelve todo lo que pertenece a una distribuidora (su página pública, el
seguimiento de sus pedidos, su panel y la app de sus repartidores). Fuera de él rige la mandarina
de Hornilla (portada para dueños, inicio y buscador, acceso, plataforma).

**Qué fija.** Calcula la derivación para claro y para oscuro y escribe ocho variables en línea
sobre un elemento con `data-brand`:
`--brand-fill-light`, `--brand-on-light`, `--brand-text-light`, `--brand-soft-light` y las
cuatro `-dark`. El CSS (`[data-brand]` y `.dark [data-brand]` en `src/index.css`) las convierte
en `--primary`, `--primary-foreground`, `--primary-text` y `--primary-soft`, y recalcula
`--sidebar-primary`, `--sidebar-accent` y `--chart-1`. Así el cambio de tema no necesita
volver a renderizar. Nada más cambia con la marca.

**`derivar(hex, tema)` paso a paso** (referencia ejecutable: `derivar` en
`docs/design/propuestas/b-cocina-de-casa/base.js`; en la app es una función pura con test):

Constantes: tinta `#14182B`; fondo `#FFFFFF` (claro) o `#0D111E` (oscuro); superficie de mezcla
`#FFFFFF` (claro) o `#222A40` (oscuro). Contraste = fórmula de luminancia relativa de WCAG 2.1.
`acercar(color, hacia, contra, mínimo)` = mezclar el color un 6 % hacia `hacia` (interpolación
lineal en sRGB) y repetir, hasta 40 veces, mientras su contraste con `contra` sea menor que
`mínimo`.

1. `relleno` = el color elegido.
2. Solo en oscuro: `relleno = acercar(relleno, blanco, fondo, 3)` para que se vea sobre el azul noche.
3. `sobre` = tinta si el contraste de `relleno` con tinta es mayor o igual que con blanco; si
   no, blanco.
4. `relleno = acercar(relleno, blanco si sobre es tinta / negro si sobre es blanco, sobre, 4.5)`:
   si el texto no llega a 4.5:1 se ajusta el relleno, no el texto.
5. `suave` = mezcla de la superficie con `relleno` al 10 % (claro) o 16 % (oscuro).
6. `texto = acercar(relleno, tinta en claro / blanco en oscuro, suave, 4.6)`.
7. Resultado: `relleno → --primary`, `sobre → --primary-foreground`, `suave → --primary-soft`,
   `texto → --primary-text`.

**Colores de prueba** (toda pantalla con marca se revisa con los tres primeros, en claro y oscuro):

| Color | Claro: relleno · sobre · contraste | Oscuro: relleno · sobre · contraste |
|---|---|---|
| tinta `#1F2937` (oscuro) | `#1F2937` · blanco · 14.7 | `#5B626C` · blanco · 6.2 |
| rocoto `#E11D48` (vivo) | `#E11D48` · blanco · 4.7 | `#E11D48` · blanco · 4.7 |
| ámbar `#F59E0B` (claro) | `#F59E0B` · tinta · 8.2 | `#F59E0B` · tinta · 8.2 |
| mandarina `#FF6A13` (por defecto) | `#FF6A13` · tinta · 6.1 | `#FF6A13` · tinta · 6.1 |
| verde `#0E8F6B` | `#1C9674` · tinta · 4.7 | `#1C9674` · tinta · 4.7 |
| azul `#1757D6` | `#1757D6` · blanco · 6.2 | `#1757D6` · blanco · 6.2 |

`texto` sobre `suave` queda entre 4.6 y 5.4 en todos; sobre el fondo, ≥ 5.1.

**Límite conocido.** La derivación garantiza el texto, no que el relleno se distinga del fondo
claro: un amarillo `#FFE600` queda a 1.3:1 del blanco y un blanco a 1:1. El selector de color
del alta debe rechazar colores con menos de 2:1 contra blanco ("Elige un color más intenso").

**Marca de gas del producto.** El balón no toma el color de la distribuidora sino el de la
marca de gas (dato del catálogo). Misma derivación, otro prefijo: el elemento lleva
`data-gas-brand` y las ocho variables `--gas-fill-light` … `--gas-soft-dark`; se usan con
`text-gas-brand` (cuerpo del balón), `bg-gas-brand-soft` (fondo de su casilla),
`text-gas-brand-foreground` y `text-gas-brand-text`. Sin `data-gas-brand` caen en la marca.

**Monograma** (logo de demostración o distribuidora sin logo): cuadrado de 48 px, radio 16,
fondo `primary`, sigla de dos letras en Gabarito 800 con `primary-foreground`.

## 7. Tipografía

| Rol | Fuente | Pesos | Utilidad |
|---|---|---|---|
| Titulares, precios, botones, indicadores | **Gabarito** | 700, 800 (900 solo en el "S/ 0" de la portada) | `font-heading` |
| Texto | **Figtree** | 400, 600, 700 | `font-sans` (por defecto) |

Carga: paquetes `@fontsource-variable/gabarito` y `@fontsource-variable/figtree`, importados en
`src/index.css` y servidos desde el propio proyecto (`font-display: swap`). Ninguna fuente por
CDN ni por Google Fonts en la app. `h1`, `h2` y `h3` reciben Gabarito, interlineado 1.08 y
`letter-spacing: -0.015em` desde la capa base; los tamaños `text-3xl` a `text-7xl` llevan ese
mismo interlineado.

Escala (celular → escritorio):

| Rol | Tamaño | Clases |
|---|---|---|
| Titular de portada | 42 → 72 | `text-[2.625rem] lg:text-7xl font-extrabold` |
| Título de sección | 34 → 52 | `text-[2.125rem] lg:text-[3.25rem] font-extrabold` |
| Título de pantalla de app | 34 → 40 (central 24 → 28) | `text-[2.125rem] lg:text-[2.5rem] font-extrabold` |
| Título de tarjeta | 20–24 | `text-xl font-bold` · `text-2xl font-extrabold` |
| Precio | 24–28 (60–72 en una tarjeta de precio destacada) | `font-heading text-2xl font-extrabold tabular-nums` |
| Cuerpo | 16 (central 14, repartidor 18) | `text-base` |
| Entradilla | 18 → 20 | `text-lg lg:text-xl text-muted-foreground` |
| Apoyo | 13–15 | `text-[0.8125rem]` · `text-sm` · `text-[0.9375rem]`, peso 600 |
| Botón | 17 (pequeño 15, grande 19, crítico 26) | `font-heading font-bold` |

No se crean nombres propios de tamaño (`text-hero`): `cn` los confunde con colores y los
descarta. Se usan los tamaños de Tailwind o valores entre corchetes.

## 8. Forma y profundidad

**Radios** (`--radius` = 16 px):

| Utilidad | Px | Uso |
|---|---|---|
| `rounded-sm` | 10 | chips de dato, esqueletos de texto |
| `rounded-md` | 12 | elementos de navegación, pestañas |
| `rounded-lg` | 16 | tarjeta de la central, botones del repartidor, monograma, huecos |
| `rounded-xl` | 24 | tarjeta del cliente, botón crítico |
| `rounded-2xl` | 32 | fotos, hojas, tarjetas destacadas, bandas |
| `rounded-3xl` | 44 | foto de portada en escritorio |
| `rounded-full` | — | botones, chips, selector +/−, sellos |

**Sombras** (dos capas con tinte de tinta, más un filo de 1 px; en oscuro son negras y el filo
pasa a blanco al 8 %):

| Utilidad | Uso |
|---|---|
| `shadow-card` | tarjeta en reposo |
| `shadow-raised` | tarjeta destacada, barra fija, botones flotantes sobre el mapa |
| `shadow-float` | lo que flota sobre mapa o foto |
| `shadow-sheet` | hoja inferior (proyecta hacia arriba) |
| `shadow-brand` | halo del botón primario (su propio color al 32 %) |

No se usan las sombras por defecto de Tailwind en componentes propios.

**Tres planos**: fondo → tarjeta → flotante. Nunca tarjeta con sombra dentro de tarjeta: dentro
se usa `bg-muted` sin sombra, o un contorno interior de 1.5 px en `border`.

**Piezas base** (las construye `frontend-builder` envolviendo shadcn):
- **Botón**: píldora, alto 48 (pequeño 40, grande 56), Gabarito 700. Variantes: primario
  (`bg-primary text-primary-foreground shadow-brand`), tinta (`bg-foreground text-background`),
  suave (`bg-primary-soft text-primary-text`), línea (`bg-card` + contorno interior 1.5 px
  `border`). Un solo primario por pantalla. El botón de shadcn tal cual (32–36 px) solo vale
  para la central en escritorio.
- **Chip de filtro**: píldora de 40 px con contorno; activo en tinta (`aria-pressed`).
- **Sello**: píldora 13 px peso 700; neutro (`bg-muted`), de marca (`bg-primary-soft`) o ají.
- **Selector +/−**: píldora `bg-muted` con dos botones redondos de 40 px (36 en escritorio);
  "−" en `bg-card` con `shadow-card`, "+" en primario; cantidad en Gabarito 700 tabular. "−"
  deshabilitado en 0. Máximo por producto: dato de la distribuidora.
- **Hoja**: `bg-card`, radio 32 arriba, `shadow-sheet`, asa de 44 × 5 px en `border`.
- **Campo**: fondo `bg-muted`, contorno `border-input`, alto 48, radio 16.
- **Esqueleto**: `bg-muted` con la forma exacta de lo que llega (ver `motion-system` §2).

## 9. Firma gráfica

### 9.1 Logo
Componente `HornillaLogo` (`src/components/brand/hornilla-logo.tsx`); favicon en
`public/favicon.svg`.

- **Geometría** (rejilla de 32): corona de la hornilla vista desde arriba = círculo de radio
  12.4 centrado en (16, 16), trazo 3.4, discontinuo `2.1 3.465` (14 dientes), girado −8°. Al
  centro, la gota de llama:
  `M16 7.6c2.9 3.3 4.9 5.6 4.9 8.5a4.9 4.9 0 0 1-9.8 0c0-2.9 2-5.2 4.9-8.5z`.
- **Colores**: corona en `--flame`. Gota con degradado vertical, de la punta a la base:
  `--logo-flame-tip` `#FFB224` (0) → `--logo-flame-mid` `#FF9A1F` (0.42) → `--logo-flame-glow`
  `#5CC8FF` (0.62) → `--logo-flame-base` `#2A6BFF` (1). El degradado es igual en los dos temas.
- **Palabra**: "Hornilla" en Gabarito 800, `tracking-tight`, a 0.72 × la altura del símbolo,
  separada 0.25 × esa altura, en el color del texto.
- **Variantes** (`variant`): `symbol` (solo el símbolo) y `lockup` (símbolo + palabra).
- **Un solo color** (`tone="mono"`): corona y gota en el color de texto actual. Obligatoria
  sobre el color de marca, sobre fotos y en impresión a una tinta.
- **Sobre claro y oscuro**: a color sobre `background`, `card`, `muted` y `surface-soft` en
  ambos temas. Sobre `band`: a color con la corona en `#3D85F5`. Sobre primario o sobre foto:
  un solo color, nunca el degradado (la base azul sobre mandarina da 1.6:1).
- **Tamaños mínimos**: símbolo 20 px; símbolo + palabra 24 px de alto. Por debajo, no se usa.
  Zona de respeto: un cuarto de la altura por cada lado.
- **Prohibido**: recolorear la gota con el color de una distribuidora, girarlo, ponerle sombra,
  encerrarlo en un círculo, escribir la palabra con otra fuente.
- **Accesibilidad**: el componente expone `role="img"` con nombre "Hornilla".

### 9.2 Aro punteado
El aro de la hornilla, grande y discontinuo, asoma por detrás de una foto o tarjeta. Utilidad
`burner-ring` (borde de 14 px discontinuo en primario, opacidad 0.9, posición absoluta);
`burner-ring-thin` (10 px, para aros de menos de 180 px) y `burner-ring-flame` (azul llama).
Tamaños de 130 a 260 px. Máximo uno por sección; queda cortado por el borde o por la foto,
nunca completo ni centrado. El contenedor de página lleva `overflow-x-clip`.

### 9.3 Resalte
Franja de primario bajo la frase clave del titular, como rotulador de cartel de mercado.
Utilidad `highlight-mark` en un `span`: ocupa del 64 % al 93 % de la altura de la línea, sigue
los saltos de línea, y en oscuro baja al 70 % de intensidad. Una vez por pantalla, en el `h1` (o
en el dato clave: "8 min"). Las palabras siguen en `foreground`.

### 9.4 Balón
Dibujo SVG propio; es **el producto** en tarjetas, resúmenes y listas. No se usan fotos de
balones. Referencia exacta: `balon(kg)` en `docs/design/propuestas/b-cocina-de-casa/base.js`
(se porta a un componente `GasCylinder`).

- Lienzo de 120 de ancho; cuerpo de 78 × 86 (10 kg), 78 × 116 (15 kg) o 62 × 176 (45 kg),
  esquinas de 30 (24 en 45 kg). Mismo dibujo, otra proporción: asa, válvula gris, cuerpo, pie
  más oscuro, franja de soldadura al 62 % de la altura, brillo lateral.
- Cuerpo en `currentColor` = `text-gas-brand` (la marca de gas). Etiqueta blanca al 94 % con el
  peso ("10 kg") en Gabarito 800 y tinta fija.
- Se apoya en una casilla `bg-gas-brand-soft` de radio 20, alineado abajo.
- Nombre accesible: "Balón de 10 kg". Alturas habituales: 46–56 en listas, 80–98 en tarjetas de
  celular, 132–164 en tarjetas de escritorio.
- Otros pesos del catálogo: se usa la silueta del peso inmediatamente inferior con su etiqueta
  real (pendiente de confirmar, ver `DIRECCION.md`).

## 10. Fotografía
- Solo de `docs/design/images/` con ficha en `CREDITS.md`, servidas desde el propio proyecto.
- Proporción fija (4:5, 4:3.6, 1:1, 21:9 en escritorio), `object-cover`, punto de interés con
  `object-position`. Radio 32 (44 en la portada de escritorio); fondo `bg-muted` mientras carga.
- Color natural: sin filtros ni duotonos. En oscuro, brillo al 92 % (`--photo-brightness`).
- Texto sobre foto solo con velo en degradado de azul noche: de 0 % al 30 % de la altura a 78 %
  abajo (velo fuerte: 15 % → 82 %). Si la foto es el argumento, el texto va en una tarjeta
  flotante y la foto queda limpia.
- Texto alternativo que describe la escena sin asumir género ("Persona cocinando…").

## 11. Movimiento
Fichas, cargas y reglas: skill `motion-system` (única fuente; aquí no se repiten valores).
Lo que esta dirección añade es dónde se ve: entrada escalonada en rejillas de tarjetas, trazo
de la ruta una vez, rebote del paso actual en la línea de tiempo, pulso solo en el marcador
activo, esqueletos con la forma de la tarjeta. Las capturas de referencia se toman con
movimiento reducido.

## 12. Mapa y marcadores
- **Base**: clara y limpia. Calles `--map-street`, manzanas en dos tonos (`--map-block`,
  `--map-block-alt`), parques `--map-park`, agua `--map-water`, nombres de calle pequeños en
  `--map-label`. En oscuro: manzanas casi negras y calles azul pizarra. Va detrás de
  `MapProvider`; el proveedor de teselas que más se acerque está por elegir (ver `DIRECCION.md`).
- **Ruta**: primario, 7 px, extremos redondos, con borde `--map-casing` de 3 px por lado. El
  tramo recorrido se aclara (velo del color del borde al 62 %). Rutas de otros repartidores:
  5 px al 55 %. En el repartidor, además, un filete de tinta de 1.5 px por lado.
- **Repartidor**: círculo de 38 px en `card` con aro de 4 px del color de estado, icono de moto
  en tinta e insignia de 18 px arriba a la derecha con el glifo del estado. El asignado o propio
  es más grande (46 px, aro de 5), lleva pulso y su nombre en píldora de tinta. Sin señal:
  72 % de opacidad y "hace N min" en la píldora.
- **Tu casa**: gota azul llama de 30 × 41 px con icono de casa y borde de 2.5 px en `card`.
- **Planta**: cuadrado de 34 px, radio 11, en el primario de la distribuidora (en tinta cuando
  el mapa muestra varias cosas, como en el monitor) con su sigla en Gabarito 800.
- **Pedido sin asignar**: círculo de 28 px numerado según la cola; tono de pausa, y alerta al
  pasar el umbral de espera. Número en `state-x-foreground`.
- **Cobertura**: círculo en primario al 8 % con borde discontinuo al 70 %.
- Todos los marcadores llevan una sombra corta y borde `card` para separarse del mapa. Las
  etiquetas son píldoras de 22 px: `card` con texto en tinta, o tinta con texto claro si es el activo.
- Controles sobre el mapa: botones redondos de 40–48 px en `card` con `shadow-raised`.

## 13. Tres ambientes
El contenedor de cada área lleva `data-ambient="customer" | "driver" | "office"`.

| | Cliente / público | Central / dueño / plataforma | Repartidor |
|---|---|---|---|
| Carácter | amable, luminoso, con fotos | sobrio, denso, mapa protagonista | alto contraste, una mano, al sol |
| Texto base | 16 px | 14 px | 18 px |
| Protagonista | foto y precio | mapa y cola | dirección y un botón |
| Radio de tarjeta | 24–32 | 16 | 16–24 |
| Primario | botones, resalte, ruta | un botón, ruta, navegación activa | acento del botón crítico y ruta |
| Objetivo táctil | ≥ 48 px | ≥ 36 px con ratón, ≥ 44 táctil | ≥ 56 px |

**Cliente.** Ver `design-craft`. Barra fija inferior "Pedir · S/ total" en celular; resumen
fijo a la derecha en escritorio. Barra inferior de tres destinos (Inicio, Pedidos, Cuenta).

**Repartidor.**
- Botón crítico ("Ya llegué", "Aceptar", "Cobrado"): **72 px** de alto, ancho completo, radio
  24, **fondo tinta** (`bg-foreground text-background`), Gabarito 800 a 26 px alineado a la
  izquierda, y a la derecha una casilla de 52 px, radio 18, en primario con el glifo de 28 px.
  La marca solo aparece en esa casilla. Uno por pantalla, pegado abajo.
- Texto secundario a 12:1 (`--muted-foreground` se oscurece dentro de `data-ambient="driver"`).
- Contornos de 2 px en tinta, no de 1.5 px en gris. Botones secundarios de 56 px, radio 16.
- Etiquetas de dato en fondo tinta ("Pedido #1047 · En camino"), no en chips teñidos.
- La ruta lleva filete de tinta. Nada de fotos ni de aro punteado. La mitad de adorno y
  respuestas en `instant`/`fast`.

**Central.**
- Fondo `surface-soft`, tarjetas de radio 16 con `shadow-card`.
- Escritorio: lateral de 224 px + cabecera + fila de indicadores + mapa y cola (372 px).
- Celular: indicadores en carrusel horizontal, mapa de 340 px, cola debajo, barra inferior de
  cinco destinos y botón flotante "Pedido telefónico".
- Un solo botón primario visible ("Pedido telefónico" o "Asignar" del pedido más urgente).

## 14. Patrones por pantalla
Detalle, capturas y pendientes en `docs/design/DIRECCION.md`. Resumen de composición:

| Pantalla | Celular (390) | Escritorio (1440) |
|---|---|---|
| Inicio del cliente | titular con resalte, foto 4:3 con sello ají, tarjeta "Entregar en" montada sobre la foto, "Lo de siempre", filtros en chips, lista de distribuidoras, barra inferior | dos columnas: titular + buscador en píldora / foto de radio 44 con foto cuadrada, tarjeta flotante y aro; debajo lista en rejilla + mapa de cobertura fijo de 440 px |
| Portada para dueños | promesa, foto con tarjeta flotante "Pedido nuevo", "así se ve tu página" con celular de muestra y muestras de color, 3 pasos, mapa en vivo, repartidor y caja, barrio, precio, pie | lo mismo en dos columnas alternas; 3 pasos en fila; mapa de 600 px con tarjeta flotante |
| Página de la distribuidora | foto de 330 px con velo, monograma y nombre encima, franja de tres datos montada, chips, productos en lista (balón a la izquierda), cobertura, horario, barra fija "Pedir" | nombre a 76 px a la izquierda, foto a la derecha con aro; productos en rejilla de 3; resumen "Tu pedido" fijo de 364 px |
| Seguimiento | mapa a pantalla completa, hoja inferior con chip de estado, "Tu gas llega en 8 min" con resalte, línea de tiempo de 5 pasos, repartidor con Llamar y WhatsApp, resumen del pedido | mapa a pantalla completa y panel flotante de 452 px a la izquierda con lo mismo más "Ten a la mano" y cancelar |
| Monitor de la central | cabecera, indicadores en carrusel, mapa con chips de estado, cola con pestañas, botón flotante, barra inferior | lateral, 6 indicadores en fila, mapa con lista de repartidores flotante, cola a la derecha |
| Repartidor: pedido en curso | mapa arriba con indicación en píldora de tinta, panel con dirección a 32 px, referencia, cliente con llamar y WhatsApp, caja de cobro con contorno de tinta, "Ya llegué" | mapa a la izquierda y panel de 540 px a la derecha, con "Después de este" |

Piezas que acompañan a todas las pantallas:
- **Franja del aviso de almacenamiento** (`StorageNotice`): la primera visita, una franja en
  `flame-soft` **en el flujo** de la página, encima del marco de cada área. Celular: 40 px de
  alto, una línea corta ("Guardamos solo lo necesario. Sin rastreo.") con su enlace y el botón
  "Entendido"; escritorio: el texto completo en una o dos líneas. **Nunca flotante** ni fija
  sobre el borde inferior: flotando tapaba el control que quedara debajo ("Guardar cambios",
  "Usar mi ubicación", la barra de decisión de la plataforma). Empuja la pantalla, no la cubre.
- **Botones `sm`**: 40 px a la vista (32 dentro de la franja del aviso) y **44 px de área de
  toque**, con una zona invisible centrada sobre el botón (`before:` de 44 px de alto). No
  crecen ni en celular ni en escritorio; dos botones `sm` apilados necesitan al menos 4 px de
  separación para que sus áreas no se pisen.
- **Pregunta de confirmación** (`ConfirmPanel`): el segundo paso de todo lo que no se puede
  deshacer o sale hacia afuera (aprobar, pedir cambios, suspender, reactivar, guardar y volver
  a revisión, eliminar la cuenta). Ocupa el lugar del botón que la abrió, en `bg-muted` de
  radio 16, con título en Gabarito 700 a 18 px y lo que cuesta la respuesta debajo. Al abrirse
  se desplaza hasta quedar entera a la vista (libre de la barra inferior) y toma el foco. Sus
  respuestas van **alineadas a la derecha**, primero la que vuelve atrás (línea) y al final la
  que confirma (tinta): nunca donde estaba el botón que la abrió. Durante 600 ms ignoran el
  puntero, de modo que el segundo clic de un doble clic no responde nada. Ninguna confirmación
  se escribe a mano fuera de esta pieza.
- **Solo lectura** (distribuidora suspendida, con pago pendiente o prueba vencida): los
  formularios muestran sus campos deshabilitados con lo guardado (o lo escrito, si llegó a
  medio editar), sin botón de guardar, bajo el aviso que dice por qué. Nunca un botón que las
  reglas van a rechazar.

## 15. Lista de verificación
1. ¿Ningún hex en el componente y ningún `text-primary` usado como texto?
2. ¿Se ve bien en claro **y** en oscuro, a 390 y a 1440?
3. Si está dentro de `BrandTheme`: ¿probada con `#1F2937`, `#E11D48` y `#F59E0B`?
4. ¿Los estados usan `state-*` con glifo y texto, y no cambian con la marca?
5. ¿Precios, horas y contadores con `tabular-nums` y el formato de §4?
6. ¿Titulares en Gabarito, un solo resalte, un solo aro por sección, un solo botón primario?
7. ¿El balón lleva el color de la marca de gas y no el de la distribuidora?
8. ¿Logo a color solo sobre superficies neutras, y de un solo color sobre marca o foto?
9. ¿Tres planos como máximo, sin tarjeta con sombra dentro de tarjeta?
10. ¿Ambiente declarado con `data-ambient` y sus tamaños mínimos de toque respetados?
11. Repartidor: ¿botón crítico de 72 px en tinta, texto secundario a 12:1, contornos de 2 px?
12. ¿Fotos del banco, con proporción fija, velo si llevan texto y texto alternativo neutro?
13. ¿Cargando, vacío, error y sin conexión diseñados? ¿Foco visible con el teclado?
    ¿Solo lectura sin botones que las reglas rechazan? ¿Confirmaciones con `ConfirmPanel`?
14. ¿El texto dice "Hornilla" y nunca "glpWEB"?

## Decisiones posteriores
- **Color de marca ilegible** (2026-10-10): al dar de alta o editar una distribuidora se rechaza un
  color cuyo relleno dé menos de 2:1 contra el fondo claro o contra el oscuro, con un mensaje que
  proponga el tono más cercano que sí pasa. La validación vive en `src/domain/tenancy/` y se repite
  en el formulario.
- **Caja y ventas** (2026-10-10): los indicadores de dinero del monitor (ventas del día, efectivo)
  se muestran solo al dueño; para la central ese hueco no existe (no se muestra deshabilitado).
- **Recarga y balón completo** (2026-10-10): toda tarjeta de producto deja claro cuál de las dos se
  compra; la presentación exacta la define `marketing-advisor` (paso 3.0 del plan).
