# Dirección A — "Llama azul"

Maqueta de la dirección visual A para Hornilla (paso 1.2 del plan). Abrir `index.html` en el navegador.
Parámetros: `?tema=claro|oscuro` y `?marca=<hex sin #>` (se conservan al navegar entre pantallas).

## Manifiesto

1. **La hornilla encendida es la interfaz**: fondo azul tinta casi negro, y la luz sale de lo que está activo (la ruta, el paso actual, el repartidor asignado).
2. **Azul es "está pasando", ámbar es "te toca"**: el azul-cian marca estado y movimiento; el ámbar de la punta de la llama queda reservado para la acción principal, el precio y el destino (tu casa, el pedido que espera).
3. **Profundidad, nunca plano**: tres planos (fondo, superficie, elevado) con brillo superior sutil, bordes translúcidos y vidrio sobre el mapa.
4. **Tecnología seria que cuida algo doméstico**: tipografía geométrica y números grandes, pero fotos de cocina real, palabras de casa ("balón", "lo de siempre", "Ya llegué") y un solo botón ámbar por pantalla.
5. **La marca de la distribuidora tiñe, no manda**: su color entra en el logo, el halo, la selección y el balón; nunca en los estados ni en el botón de pedir, así cualquier color funciona.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Índice con enlaces, cambio de tema y de color de marca, y las piezas sueltas |
| `0-inicio.html` | Inicio del cliente (buscador de distribuidoras) |
| `1-duenos.html` | Portada para dueños |
| `2-distribuidora.html` | Página pública de una distribuidora (el `+/−` y el total funcionan) |
| `3-seguimiento.html` | Seguimiento del pedido |
| `4-monitor.html` | Monitor de la central |
| `5-repartidor.html` | Repartidor: pedido en curso |
| `base.css` | Tokens (claro, oscuro), componentes y movimiento |
| `base.js` | Tema, color de marca, iconos, logo, balón SVG, mapa SVG, dial |
| `capturas.mjs` | `node docs/design/propuestas/a-llama-azul/capturas.mjs [filtro]` desde la raíz |
| `capturas/` | PNG a 390 y 1440, oscuro y claro, más variantes de marca |

## Tokens

Contraste medido con la fórmula WCAG sobre la superficie indicada. Todo el texto cumple AA (≥ 4.5:1).

### Oscuro (el modo natural)

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--background` | `#050A16` | Fondo (azul tinta), con dos resplandores radiales azules | — |
| `--card` | `#0B1324` | Superficie | — |
| `--elevated` | `#111C33` | Elevado (hojas, tarjeta "Tu pedido") | — |
| `--sunken` | `#070E1C` | Hundido (campos, filas internas, lateral) | — |
| `--glass` | `rgba(12,20,38,.80)` + desenfoque 18 px | Paneles sobre el mapa | — |
| `--border` / `--border-strong` | `rgba(148,184,255,.14)` / `.28` | Bordes translúcidos | — |
| `--foreground` | `#ECF2FF` | Texto | 16.5:1 sobre card |
| `--muted-foreground` | `#9AAACB` | Texto secundario | 7.9:1 sobre card |
| `--flame` | `#5CC8FF` | Activo, enlaces, ruta, paso actual | 9.9:1 sobre card |
| `--flame-foreground` | `#04101F` | Texto sobre azul | 10.2:1 |
| `--action` → `--action-hot` | `#FFB224` → `#FF8F1F` | Botón principal (degradado) | — |
| `--action-foreground` | `#1B1000` | Texto del botón principal | 10.4:1 / 8.2:1 |
| `--price` | `#FFC14D` | Precios | 11.5:1 sobre card |

### Claro ("la hornilla de día", no un invertido)

Papel frío azulado, superficies blancas, sombras azuladas en vez de resplandores. Los héroes con foto
y la portada de dueños siguen siendo de noche (clase `.night`): la hornilla es negra también de día.

| Token | Valor | Contraste |
|---|---|---|
| `--background` | `#EEF2FA` | — |
| `--card` / `--elevated` | `#FFFFFF` | — |
| `--sunken` | `#E3E9F5` | — |
| `--border` / `--border-strong` | `rgba(11,30,74,.12)` / `.24` | — |
| `--foreground` | `#0A1330` | 18.3:1 sobre card |
| `--muted-foreground` | `#4C5B7C` | 6.8:1 card · 6.0:1 fondo · 5.6:1 hundido |
| `--flame` | `#0A5BD9` | 6.0:1 card · 5.3:1 fondo |
| `--action` → `--action-hot` | `#FFB224` → `#FF9A1F`, borde `#C97A00` | texto `#1B1000` 10.4:1 |
| `--price` | `#A34A00` | 5.9:1 card · 4.9:1 hundido |

### Estados (del sistema; no cambian con la marca; siempre con icono y texto)

| Estado | Oscuro | Claro | Icono | Contraste (oscuro / claro) |
|---|---|---|---|---|
| `--state-free` Libre | `#3DDC97` | `#0B7A4B` | check | 10.5 / 5.4 |
| `--state-busy` Con pedido | `#5CC8FF` | `#0A5BD9` | moto | 9.9 / 6.0 |
| `--state-paused` En pausa | `#B79CFF` | `#6B3FD4` | pausa | 8.1 / 6.4 |
| `--state-offline` Sin señal | `#8C9AB5` | `#56627A` | wifi tachado, aro punteado | 6.5 / 6.1 |
| `--state-danger` Demora / error | `#FF7A88` | `#C4213A` | alerta | 7.4 / 5.8 |

"En pausa" es violeta y no ámbar a propósito: el ámbar está reservado para lo que pide acción.

## Color de marca de cada distribuidora

`base.js → brandVars(hex)` calcula, a partir de un solo color:

| Variable | Cómo se obtiene | Dónde se usa |
|---|---|---|
| `--brand` | El color tal cual | Monograma/logo, pin de la planta, halo de la portada |
| `--brand-foreground` | Tinta `#0A1330` o blanco, el que dé más contraste | Texto sobre el color de marca |
| `--brand-text` | La marca empujada hacia blanco (oscuro) o tinta (claro) hasta 4.5:1 sobre la superficie | Chip seleccionado, `+`, enlaces "Cambiar", borde del producto elegido |
| `--brand-soft` | `--brand-text` al 14 % / 10 % | Fondo de chip y de `+` |

Reglas: la marca nunca pinta estados, ni el botón "Pedir" (siempre ámbar: en toda la plataforma "ámbar = pedir"),
ni la ruta del mapa (siempre azul llama). El balón lleva el color de la **marca del producto**, no el de la
distribuidora. Probado con `#2D7FF9`, `#E11D48` (vivo), `#F59E0B` (claro) y `#1F2937` (oscuro): ver `capturas/*-marca-*`.
En las pantallas de Hornilla (inicio, portada) cada tarjeta de distribuidora lleva su propio color.

## Tipografía

- **Display: Sora** (600–800), geométrica, con las redondas que repiten el aro de la hornilla. Títulos, botones, precios, números. Interletra −0.025 em.
- **Texto: Figtree** (400–700). Cuerpo 16 px; repartidor 18 px; central 14.5 px.
- Números tabulares (`tnum`, `lnum`) en precios, tiempos y cantidades (`.num`, `.price`).
- Escala: héroe `clamp(2.05rem, 4.4vw, 3.5rem)` · h1 `clamp(1.7rem, 3.4vw, 2.75rem)` · h2 `clamp(1.3rem, 2vw, 1.75rem)` · h3 1.125 rem · cuerpo 1 rem · pequeño 0.875 · mínimo 0.78.
- En la app: autoalojadas (`@fontsource-variable/sora`, `@fontsource-variable/figtree`), nunca desde Google.

## Radios y sombras

- Radios: `10` (etiquetas) · `16` (botones, filas) · `24` (tarjetas) · `32` (mapa, portada) · `999` (chips, contador). Botón del repartidor: 22.
- Oscuro: sombra de dos capas = brillo interior superior de 1 px + caída negra profunda. Lo activo además emite luz (`--glow-flame`: aro de 1 px + halo de 26 px).
- Claro: sombras azuladas suaves de dos capas; lo activo lleva aro azul y sombra azul.
- Botón principal: degradado ámbar, borde, brillo interior y halo cálido (`--shadow-action`).

## Piezas propias de la dirección

- **Símbolo**: la corona de la hornilla vista desde arriba (aro de 14 dientes azules) con la gota de llama al centro, azul abajo y ámbar en la punta. Palabra "hornilla" en minúsculas, Sora 700.
- **Dial de tiempo**: la misma corona; los dientes se encienden según avanza el pedido (`Hornilla.dial`).
- **Balón SVG** (`Hornilla.balon(kg, color)`): 10, 15 y 45 kg, genérico, con el color de la marca del producto, brillo lateral y etiqueta de peso. Sustituye a las fotos de balones del banco (son de otros países).
- **Iconos**: geometría de lucide, trazo 1.75 (en la app, `lucide-react`). La moto usa el icono `bike` hasta decidir uno propio.

## Fotos

- Solo de `docs/design/images/`. Usadas: llama azul (portada de dueños e inicio en oscuro), tetera con llama (inicio en claro, portada de la distribuidora), anillo de llama (sección de precio), motocarga en Cusco, tortillas con balón al fondo, plaza de Huaraz, moto con balón.
- Siempre `object-cover`, proporción fija, y **velo tinta** de abajo hacia arriba (`--veil`, 15 % → 90 %) cuando llevan texto.
- Las fotos documentales llevan además un baño azul (`.tint`: saturación 0.85 + degradado azul en multiplicar) para que convivan con la paleta.
- En la portada de una distribuidora, un resplandor del color de marca sube desde la esquina del logo.
- Ningún texto se atribuye a las personas de las fotos.

## Mapa y marcadores

La maqueta dibuja un mapa SVG propio (sin teselas). En la app será Leaflet + OSM con un estilo equivalente
(teselas oscuras o filtro CSS sobre las estándar; ver riesgos).

- Oscuro: manzanas `#070D1C`, calles `#0D1830`, edificios `#0A1326`, parque `#082323`, río `#0A2350`, rótulos `#6F82A8` en versalitas.
- Claro: manzanas `#F3F6FC`, calles `#DFE6F3`, parque `#D5ECDF`, río `#BCD6F7`.
- **Ruta**: tramo pendiente = trazo de 5 px en `--map-route` con halo desenfocado de 16 px y un filo blanco de 1 px (luz de neón sobria); tramo recorrido = puntos apagados.
- **Repartidor**: círculo de 34 px con aro del color de estado e icono según estado (moto, check, pausa, wifi tachado); sin señal = aro punteado y 75 % de opacidad; el asignado pulsa. Etiqueta con el nombre debajo.
- **Destino / pedido en espera**: pin ámbar (casa o paquete). **Planta**: pin del color de marca.
- **Cobertura**: círculo punteado del color de la distribuidora, relleno al 6 %.
- Los paneles flotan sobre el mapa en vidrio; viñeta suave en los bordes.

## Movimiento

Fichas como variables CSS (mismos nombres que `motion-system`):

| Ficha | Valor | Dónde se ve en la maqueta |
|---|---|---|
| `--dur-instant` | 100 ms | Presión: `scale(.97)` en botones, chips y tarjetas pulsables |
| `--dur-fast` | 150 ms | Hover, chips |
| `--dur-base` | 220 ms | Entrada escalonada de listas (`.stagger`: opacidad + 8 px), marcadores (0.8 → 1) |
| `--dur-slow` | 320 ms | Hoja inferior y tarjetas flotantes (`.sheet-in`) |
| `--dur-map` | 900 ms lineal | En la app, entre dos posiciones. En la maqueta el marcador recorre el tramo con `offset-path` en 9 s para que se aprecie |
| `--ease-out` / `--ease-in` | `cubic-bezier(.22,1,.36,1)` / `cubic-bezier(.4,0,1,1)` | Entradas / salidas |
| `--stagger` | 40 ms, máximo 8 | Listas de distribuidoras, productos, cola, repartidores |

Además: esqueleto con brillo de 1,4 s teñido de azul (`.skeleton`, última tarjeta del inicio); la ruta se dibuja
una vez (600 ms); pulso del marcador asignado (2 s); destello único ámbar del pedido recién entrado (`.flash`).
Con `prefers-reduced-motion` no hay animaciones ni escalas: el marcador aparece en su sitio, la ruta ya dibujada
y el esqueleto sin brillo. Las capturas se toman así.

## Tres ambientes

| Ambiente | Qué cambia sobre la misma base |
|---|---|
| Cliente | Fotos, 16 px, tarjetas de 24 px de radio, una acción ámbar |
| Repartidor | 18 px, texto secundario más fuerte, objetivos ≥ 56 px, "Ya llegué" de 76 px, barra de jornada fija, botón de modo sol (el claro es el recomendado de día) |
| Central | 14.5 px, radios de 16, lateral, tres paneles, filas con borde de estado, atajo de teclado en la acción |
