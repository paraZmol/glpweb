# Propuesta B — «Cocina de casa»

## Manifiesto

1. El gas no es un cilindro: es el almuerzo de hoy. La foto de la cocina y de la gente manda.
2. Blanco limpio, mandarina de mercado y azul de llama. Nada de hueso, nada de terracota, nada de serif.
3. Lo que dice «esto es gas» está dibujado por nosotros: el balón que toma el color de cada marca y el aro de la hornilla.
4. Todo es redondo, grande y con el precio a la vista: lo entiende quien pide con la olla a medias.
5. Al sol manda la tinta, no la marca: el repartidor lee negro sobre blanco y la marca solo acompaña.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Índice de pantallas y piezas (símbolo, balones, estados) |
| `inicio.html` | 0 · Inicio del cliente (buscador) |
| `portada.html` | 1 · Portada para dueños |
| `distribuidora.html` | 2 · Página pública de una distribuidora (el `+/−` y el total funcionan) |
| `seguimiento.html` | 3 · Seguimiento del pedido |
| `monitor.html` | 4 · Monitor de la central |
| `repartidor.html` | 5 · Repartidor: pedido en curso |
| `base.css` | Tokens claro/oscuro y piezas compartidas |
| `base.js` | Tema, color de marca, iconos, balón SVG, logo y mapa SVG |
| `capturas.mjs` | `node docs/design/propuestas/b-cocina-de-casa/capturas.mjs [pantalla…]` |
| `capturas/` | `<pantalla>-<movil|escritorio>-<claro|oscuro>[-marca-<nombre>].png` |

Parámetros en cualquier pantalla: `?tema=claro|oscuro` y `?marca=<hex sin #>`.
Tailwind por CDN y Google Fonts solo valen para esta maqueta.

## Color

### Por qué mandarina y no rocoto
El primario de Hornilla es **mandarina `#FF6A13`** con texto en tinta. Rojo rocoto se descartó
porque en este producto el rojo ya tiene dueño: es el estado de alerta (pedido sin asignar,
cancelado, error). Un primario rojo obligaría a distinguir «marca» de «peligro» en el monitor.
La mandarina además deja libre el azul para lo que identifica al gas: la llama.

El secundario **azul llama `#1565E8`** es fijo del sistema (no cambia con la marca): pin de «tu
casa», enlaces informativos, llama del logo. El **ají `#FFC933`** solo se usa en sellos y estrellas.

### Tokens

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#0D111E` | fondo |
| `--bg-soft` | `#F3F6FB` | `#121727` | bandas y fondo de paneles |
| `--surface` | `#FFFFFF` | `#191F31` | tarjetas |
| `--surface-2` | `#F3F6FB` | `#222A40` | huecos dentro de tarjetas, campos |
| `--ink` | `#14182B` | `#F3F5FA` | texto |
| `--ink-2` | `#565E76` | `#A9B1C6` | texto secundario |
| `--line` | `#E2E7F0` | `#2D3650` | bordes |
| `--primary` | `#FF6A13` | `#FF6A13` | acción principal, ruta |
| `--on-primary` | `#14182B` | `#14182B` | texto sobre primario |
| `--primary-text` | `#AD4D1A` | `#FF833B` | primario usado como texto (solo etiquetas pequeñas) |
| `--primary-soft` | `#FFF0E7` | `#453439` | fondo teñido |
| `--secondary` | `#1565E8` | `#3D85F5` | azul llama |
| `--secondary-text` | `#0F52C4` | `#7FB0FF` | |
| `--aji` | `#FFC933` | `#FFC933` | sellos, estrellas |

Estados (del sistema; relleno / texto):

| Estado | Claro | Oscuro | Glifo |
|---|---|---|---|
| `--state-free` libre | `#12A150` / `#0A7038` | `#2CC36B` / `#5BDC92` | check |
| `--state-busy` con pedido | `#1565E8` / `#0F52C4` | `#3D85F5` / `#7FB0FF` | flecha |
| `--state-paused` en pausa | `#E6A100` / `#7D5200` | `#F2B632` / `#F7CB66` | pausa |
| `--state-offline` sin señal | `#7A8194` / `#555C70` | `#8C94A8` / `#AAB1C4` | wifi tachado |
| `--state-danger` alerta | `#D92D20` / `#B42318` | `#F0554A` / `#FF8A80` | triángulo |

Siempre van con glifo y texto. En el mapa el marcador es blanco con aro del color del estado y
una insignia con el glifo; el color nunca es el único dato.

### Contraste medido (WCAG 2.1)

| Par | Claro | Oscuro |
|---|---|---|
| texto / fondo | 17.6 | 17.3 (15.0 sobre tarjeta) |
| texto secundario / fondo | 6.4 (5.9 sobre `bg-soft`) | 7.6 (6.7 sobre `surface-2`) |
| tinta sobre mandarina (botón) | 6.1 | 6.1 |
| `primary-text` sobre `primary-soft` | 4.9 | 4.8 |
| blanco sobre azul llama | 5.2 | 5.3 (tinta sobre azul) |
| texto de estado sobre su chip teñido | 5.3 – 6.1 | 6.1 – 8.1 |
| botón «Ya llegué» (blanco sobre tinta) | 17.6 | 17.3 |
| texto secundario del repartidor | 12.1 | 11.7 |
| nombres de calles del mapa | 5.2 | 5.0 |

Por debajo de 3:1 y asumido: la mandarina sobre las manzanas del mapa (2.4). Por eso la ruta lleva
siempre un borde (blanco en cliente y central; **tinta** en el repartidor) y nunca depende solo
del color.

## Cómo entra el color de marca de cada distribuidora

`base.js → derivar(hex)` es el borrador de lo que hará `BrandTheme`:

1. `--primary` = el color elegido. En oscuro, si no llega a 3:1 contra el fondo, se aclara.
2. `--on-primary` = tinta o blanco, el que dé más contraste; si ninguno llega a 4.5:1 se ajusta el
   relleno un paso.
3. `--primary-soft` = 10 % del color sobre la superficie (16 % en oscuro).
4. `--primary-text` = el color oscurecido (aclarado en oscuro) hasta 4.6:1 sobre `primary-soft`.

Probado (ver `capturas/distribuidora-*-marca-*.png`):

| Marca | Sobre primario | Contraste | Nota |
|---|---|---|---|
| mandarina `#FF6A13` | tinta | 6.1 | por defecto |
| rocoto `#E11D48` | blanco | 4.7 | |
| tinta `#1F2937` | blanco | 14.7 | en oscuro el relleno sube a `#5B626C` para verse |
| ámbar `#F59E0B` | tinta | 8.2 | |
| verde `#0E8F6B` | tinta | 4.7 | el relleno se aclara a `#1C9674` |

Lo que **no** toma el color de la distribuidora: estados, azul llama, ají, y el color de cada
balón, que es el de la **marca de gas** del producto (`--m`, dato del catálogo).

## Tipografía

| Rol | Fuente | Pesos | Uso |
|---|---|---|---|
| Titulares, precios, botones | **Gabarito** | 700, 800 (900 solo en «S/ 0») | sans geométrica de terminales redondeados: amable sin ser infantil |
| Texto | **Figtree** | 400, 600, 700 | muy legible a 14–18 px |

Ambas tienen cifras tabulares (comprobado): clase `.num` = `font-variant-numeric: tabular-nums`
en todo precio, hora, cantidad e indicador. Carga en la app: `@fontsource-variable/gabarito` y
`@fontsource-variable/figtree` (sin Google Fonts en producción).

Escala (celular → escritorio): titular de portada 42 → 72 · h2 34 → 52 · h3 20–24 · precio 24–28 ·
cuerpo 16 (central 14, repartidor 18) · apoyo 13–15. Interlineado de titulares 1.08,
`letter-spacing: -0.015em`.

## Forma

- **Radios**: 10 (chips de dato) · 16 (tarjeta de central, botones del repartidor) · 24 (tarjeta) ·
  32 (fotos, hojas, tarjetas destacadas) · 44 (foto de portada en escritorio) · píldora (botones,
  chips, stepper).
- **Sombras** (dos capas, tinte azul tinta, más un filo de 1 px):
  `--sh-1` tarjeta en reposo · `--sh-2` tarjeta destacada y barra fija · `--sh-3` lo que flota
  sobre mapa o foto. El botón primario lleva además un halo de su propio color (32 %).
  En oscuro las sombras son negras y el filo pasa a blanco 8 %.
- **Tres planos**: fondo → tarjeta → flotante. Nunca tarjeta dentro de tarjeta con sombra: dentro
  se usa `surface-2` sin sombra.

## Firma gráfica

- **Símbolo** (decisión del 2026-10-10: sustituye al aro de cuatro arcos): la corona de la hornilla vista
  desde arriba, 14 dientes en azul llama, con la gota de llama al centro, azul abajo y punta ámbar.
  Versiones: a color, de un solo color sobre la marca y sobre tinta (`index.html`). La spec vigente
  está en `.claude/skills/ui-system/SKILL.md`.
- **Aro punteado**: el mismo aro, grande y discontinuo, asoma detrás de las fotos. Máximo uno por
  sección.
- **Resalte**: una franja de primario bajo la frase clave del titular (como rotulador de cartel
  de mercado). El primario no se usa como color de texto en titulares: oscurecido se vuelve
  marrón y se acerca a lo prohibido.
- **Balón SVG** (`H.balon(kg)`): 10, 15 y 45 kg, mismo dibujo con otra proporción; cuerpo en el
  color de la marca de gas, etiqueta blanca con el peso. Es el producto en tarjetas, resúmenes y
  listas del buscador.

## Fotografía

- Solo de `docs/design/images/`. Usadas: tetera con llama (inicio), persona con celular (inicio),
  plancha con balón al fondo (portada), cocina con ollas (distribuidora), moto de carga y plaza de
  Huaraz (portada).
- Proporción fija y `object-cover`; el punto de interés se fija con `object-position`.
- Sin filtros ni duotonos: color natural. En oscuro, brillo al 92 %.
- Texto sobre foto solo con velo en degradado de tinta (0 → 78 %). Si la foto es el argumento
  (sombrillas de Huaraz, llama de la tetera) el texto va en una tarjeta flotante y la foto queda limpia.
- Las fotos de balones del banco no se usan: son de otros países y de otro color.

## Mapa

- Claro y limpio: calles blancas, manzanas gris azulado en dos tonos, parques verde menta, río azul
  pálido, nombres de calle pequeños. En oscuro: manzanas casi negras y calles azul pizarra.
- **Ruta** en primario, 7 px, con borde blanco; el tramo recorrido se aclara. Rutas secundarias
  (otros repartidores en el monitor) más finas y al 55 %.
- **Repartidor**: círculo blanco con aro del color de estado, icono de moto e insignia con glifo.
  El activo lleva pulso y nombre en píldora de tinta. Sin señal: 72 % de opacidad y «hace N min».
- **Tu casa**: gota azul llama con casa. **Planta**: cuadrado redondeado con la sigla de la
  distribuidora. **Pedido sin asignar**: círculo numerado, rojo si pasa el umbral de espera.
- **Cobertura**: círculo punteado en primario al 8 %.
- En producción esto es un estilo de teselas claro sobre Leaflet; la maqueta lo dibuja en SVG.

## Tres ambientes

| | Cliente | Central / dueño | Repartidor |
|---|---|---|---|
| Base | 16 px | 14 px | 18 px |
| Protagonista | foto y precio | mapa y cola | dirección y un botón |
| Radio de tarjeta | 24–32 | 16 | 16–24 |
| Primario | botones, resaltes, ruta | un botón, ruta, navegación activa | solo el acento del botón y la ruta |
| Particular | barra fija «Pedir · S/ total» | lateral + indicadores + tres paneles | botón crítico de 72 px en tinta, bordes de 2 px, texto secundario a 12:1 |

## Movimiento

Fichas (mismos nombres que `motion-system`, como variables CSS en `base.css`):

| Ficha | Valor | Dónde se ve en la maqueta |
|---|---|---|
| `--t-instant` 100 ms | presión | `.btn`, `.chip`, `+/−`: escala 0.97 (0.9 en `+/−`) |
| `--t-fast` 150 ms | hover, color | botones |
| `--t-base` 220 ms + `--e-out` | entrada | `.entra`: opacidad + 8 px, escalonado `--stagger` 40 ms, tope 8 |
| `--t-slow` 320 ms | rebote del paso actual | línea de tiempo del seguimiento |
| `--t-map` 900 ms lineal | marcador | `.viaja`: el repartidor se desliza por la ruta con `offset-path` (tres tramos) |
| trazo 600 ms | ruta | `.ruta-trazo` se dibuja una vez |
| brillo 1,4 s | carga | `.skeleton` con la forma de la tarjeta (inicio y cola del monitor) |
| pulso 1,8 s | marcador activo | único bucle además del esqueleto |

`prefers-reduced-motion`: sin animaciones ni escalas; el marcador aparece en su sitio, el
esqueleto queda sin brillo y el pulso es un halo fijo. Las capturas se toman así.

## Lo que esta maqueta no resuelve

- Precio del plan (D6): la portada dice «Plan mensual fijo · precio por definir», sin monto.
- Dominio: se usa `hornilla.example`.
- Logo subido por la distribuidora: solo se muestran monogramas.
- Estados vacío, error y sin conexión; pasos del pedido (dirección con pin, confirmar); cobro.
- Mapa real: falta elegir un estilo de teselas claro gratuito que se parezca a este.
- Marcas de gas inventadas (Cumbregas, Brasa, Nevado, Solcito): revisar que no coincidan con
  marcas registradas antes de usarlas como datos de demostración públicos.
