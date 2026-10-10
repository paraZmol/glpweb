# Dirección C — «En ruta»

Propuesta de dirección visual para **Hornilla** (paso 1.2 del plan). Maquetas autónomas: abrir
`index.html` en el navegador. Parámetros: `?tema=claro|oscuro` y `?marca=<hex sin #>`.

## Manifiesto

1. **El gas viene en camino.** El mapa y la ruta son el contenido; el resto flota encima.
2. **Señalética, no decoración.** Titulares condensados y pesados, números gigantes (precio, minutos), etiquetas como placas.
3. **Lo que se toca es una ficha.** Contorno de tinta y sombra dura desplazada solo en lo pulsable y en lo que flota; lo demás es superficie quieta.
4. **Amarillo = movimiento.** El amarillo de ruta marca lo que está viniendo (ruta, tiempo, «en camino») y la acción de la plataforma. Nunca es adorno.
5. **La marca es de la distribuidora.** Su color pinta su portada, su monograma y su botón «Pedir»; los estados y la ruta son del sistema y no se mueven.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Índice de pantallas y muestrario de piezas |
| `0-inicio.html` … `5-repartidor.html` | Las seis pantallas |
| `ruta.css` | Tokens (`:root`, `.dark`) y componentes de la maqueta |
| `ruta.js` | Tema, derivación del color de marca, iconos, logo, balón SVG y mapa SVG |
| `capturas.mjs` | `node docs/design/propuestas/c-en-ruta/capturas.mjs [filtro]` |
| `capturas/` | 37 PNG: 6 pantallas × 390/1440 × claro/oscuro, más variantes de marca |

## Por qué amarillo vial

Se evaluaron tres firmas: lima, naranja de seguridad y amarillo vial (`#FFD60A`).

- El **naranja** choca con las marcas de gas más comunes (rojos y naranjas) y con el estado de alerta.
- El **lima** se confunde con el verde de «libre» y empuja el producto hacia lo «tecnológico/gamer».
- El **amarillo** es el de las señales preventivas y la línea central de la pista: se lee como
  «tránsito» sin explicarlo, da 13,6:1 con la tinta (legible al sol) y brilla igual en oscuro.

Regla de uso: el amarillo es siempre **relleno con texto de tinta y contorno de tinta**; nunca
texto amarillo sobre claro. En el mapa la ruta lleva **funda de tinta**, así se distingue por
forma y no solo por tono.

## Tokens

### Claro («concreto»)

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--background` | `#ECEEF0` | fondo | — |
| `--surface` | `#FFFFFF` | tarjetas, hojas | — |
| `--surface-2` | `#DFE3E7` | franjas hundidas (pie de tarjeta, panel del balón) | — |
| `--foreground` | `#0D0F12` | texto, tinta | 16,5 sobre fondo · 19,2 sobre superficie |
| `--foreground-2` | `#3D434C` | texto secundario | 8,6 sobre fondo · 7,7 sobre `surface-2` |
| `--muted-foreground` | `#59606A` | apoyo, etiquetas | 5,5 fondo · 6,4 superficie · 4,9 `surface-2` |
| `--border` | `#C3C9D0` | línea de tarjetas quietas (decorativa) | — |
| `--outline` / `--outline-fill` | `#0D0F12` | contorno de fichas | — |
| `--signal` / `--on-signal` | `#FFD60A` / `#0D0F12` | ruta, tiempo, acción de plataforma | 13,6 |

### Oscuro («asfalto»)

| Token | Valor | Contraste |
|---|---|---|
| `--background` | `#0F1114` | — |
| `--surface` | `#1B1E23` | — |
| `--surface-2` | `#272C33` | — |
| `--foreground` | `#F3F4F1` | 17,1 fondo · 15,1 superficie |
| `--foreground-2` | `#C6CBD2` | 10,2 superficie |
| `--muted-foreground` | `#A0A7B1` | 7,8 fondo · 6,9 superficie · 5,8 `surface-2` |
| `--border` | `#3A414B` | — |
| `--outline` | `#5B636F` | contorno de fichas sobre superficie (2,8:1 con la superficie) |
| `--outline-fill` / sombra | `#000000` | contorno de rellenos de color |
| `--signal` / `--on-signal` | `#FFD60A` / `#0D0F12` | 13,6 (14,9 sobre negro) |

### Estados (del sistema; no cambian con la marca)

Inspirados en señales: verde = libre, amarillo = en ruta, azul = estacionado, gris = sin señal,
rojo = alerta. Siempre son **relleno + icono + texto** dentro de una placa con contorno; nunca
texto de color suelto.

| Token | Relleno | Texto | Contraste | Icono | Rasgo extra |
|---|---|---|---|---|---|
| `--state-free` | `#22C55E` | tinta | 8,4 | check | — |
| `--state-busy` | `#FFD60A` | tinta | 13,6 | moto | es la firma: «con pedido» = en ruta |
| `--state-paused` | `#2F5BEA` | blanco | 5,5 | pausa | — |
| `--state-offline` | `#8A9099` | tinta | 6,0 | wifi tachado | contorno punteado, marcador al 80 % |
| `--state-danger` | `#D92D20` | blanco | 4,8 | triángulo | — |

### Color de marca por distribuidora

`BrandTheme` (en la maqueta, `brandVars()` de `ruta.js`) recibe un hex y fija:

| Variable | Cómo se calcula |
|---|---|
| `--brand` | El color tal cual. En oscuro, si se pierde contra el asfalto (< 2,2:1), se aclara hasta lograrlo |
| `--on-brand` | Blanco si da ≥ 4,5:1; si no, tinta. Si ninguno llega, la marca se oscurece hasta que el blanco pase |
| `--brand-text` | La marca como texto sobre superficie, corregida hasta 4,5:1 |
| `--brand-tint` | Mezcla 12 % (claro) / 24 % (oscuro) con la superficie |

Dónde entra la marca: bloque de portada, monograma, botón «Pedir», botón `+`, tinte de la foto
de portada, ficha de la planta en el mapa y círculo de cobertura. Dónde **no** entra: ruta,
estados, tiempo estimado, botón «Ya llegué», navegación.

**Choques resueltos**

- *Marca parecida al amarillo* (tono 26°–74° y saturada, p. ej. `#F59E0B`): el contenedor recibe
  `data-clash="1"` y las placas de señal se invierten (fondo tinta, texto amarillo). La marca
  conserva su color; cede el sistema. Ver `capturas/2-distribuidora-390-claro-marca-F59E0B.png`.
- *Marca parecida a un estado* (verde, azul, rojo): los estados nunca aparecen como bloque ni
  como botón; son placas pequeñas con icono y texto, y los marcadores del monitor llevan además
  una insignia con el icono del estado. La marca nunca pinta un marcador de repartidor.
- *Marca casi negra en oscuro* (`#1F2937`): se aclara sola. Ver
  `capturas/2-distribuidora-1440-oscuro-marca-1F2937.png`.
- Todo relleno de color lleva contorno de tinta, así un botón amarillo, ámbar o blanco se sigue
  leyendo como botón.

## Tipografía

Una superfamilia, tres anchos, un ancho por ambiente. Barlow nace de las placas y la señalética
de carretera: es la referencia exacta de la dirección.

| Rol | Fuente | Uso |
|---|---|---|
| Titulares y números | **Barlow Condensed** 700/800, mayúsculas, interlineado 0,88 | h1–h3, precios, minutos, placas, botones |
| Datos densos | **Barlow Semi Condensed** 500/600 | central, tablas, textos de apoyo, etiquetas del mapa |
| Lectura | **Barlow** 400/500/600 | párrafos del cliente y de la portada |

Escala (celular → escritorio): titular de portada 60–68 → 96–112 px · título de sección 34–48 →
52–80 · título de tarjeta 26–30 · número gigante 36–76 (precio, minutos) · cuerpo 17–18 · apoyo
14–15 · etiqueta 13 con espaciado 0,08 em. Repartidor: cuerpo 18–21 px. Números siempre con
`tabular-nums`. En la app se sirven como WOFF2 locales (subconjunto latino, 8 archivos); nada de
Google Fonts en producción.

## Radios

`--r-plate` 6 px (placas, estados) · `--r-control` 10 px (botones, campos, contador) ·
`--r-card` 14 px (tarjetas, fichas) · `--r-sheet` 22 px (hoja inferior). Píldora solo en chips
de filtro. Radios firmes: redondeado de señal, no de burbuja.

## Sombras y profundidad

Tres planos, y una regla: **lo duro es lo que se toca o lo que flota**.

| Plano | Clase | Borde | Sombra |
|---|---|---|---|
| Fondo | — | — | — |
| Superficie quieta | `.card` | 1 px `--border` | `0 1px 0` del borde |
| Ficha (pulsable o elegida) | `.ficha`, `.btn`, `.plate`, `.mono` | 2–3 px tinta | dura: `2px 2px 0`, `4px 4px 0`, `6px 6px 0` |
| Ficha flotante sobre mapa | `.ficha--float` | 2 px tinta | `5px 5px 0` + ambiente `0 18px 40px` al 22 % |

Recortes: diagonal en fotos de portada (`clip-path`), marco desplazado amarillo detrás de fotos a
color, franja vial (`.hazard`) solo como cierre de la portada y del pie. Un producto pasa de
`.card` a `.ficha` cuando tiene cantidad: lo elegido se levanta.

## Fotos

Solo del banco `docs/design/images/` (ver `CREDITS.md`).

| Tratamiento | Clase | Cuándo |
|---|---|---|
| Duotono ruta (gris + multiplicar amarillo) | `.photo--duo` | Portada de dueños, secciones sobre tinta; motos, calles, carga |
| Tinte de marca (gris + mezcla de color de la marca) | `.photo--duo.photo--brand` | Portada de cada distribuidora: cualquier foto de archivo queda «de la marca» |
| Color natural con marco desplazado | `.frame > .photo` | Personas (clienta con celular): calidez, sin teñir rostros de amarillo |
| Velo | `.photo--veil`, `.photo--veil-l` | Obligatorio si hay texto encima |

Proporciones fijas (4:5, 16:9), `object-cover`, punto focal con `object-position`. Las fotos de
balones del banco son de otros países: el producto se muestra con el **balón SVG** propio
(`balon(kg)` en `ruta.js`; 10, 15 y 45 kg; toma el color de la marca de gas con `--b`).

## Mapa y marcadores

Maqueta: SVG propio (sin teselas). En la app: Leaflet con un estilo de teselas neutro y claro u
oscuro; todo lo de abajo se dibuja como capas propias.

- **Base** callada: manzanas en dos grises, calles blancas (claro) o gris asfalto (oscuro),
  parques y río apenas teñidos. Etiquetas en Barlow Semi Condensed, mayúsculas, 10,5 px.
- **Ruta**: funda de tinta de 14 px + núcleo amarillo de 8 px. El tramo ya recorrido se apaga a
  gris. En el monitor, rutas finas (8/4 px).
- **Marcadores = fichas**: cuadrado redondeado de 40 px con puntero, contorno de tinta y sombra
  dura. Repartidor: relleno del estado + iniciales o icono + insignia del estado. Casa: tinta.
  Planta/distribuidora: color de marca + monograma. Pedido pendiente: placa con número (roja si
  lleva mucho esperando). Mi ubicación: punto azul con halo.
- **Etiqueta de ficha**: placa pegada al marcador («WILLY · 8 MIN»); amarilla si es tiempo.
- Controles del mapa: `iconbtn` flotante («Centrar»), placa del pedido arriba.
- Iconos lucide con trazo 1,75; dentro de fichas de mapa y placas pequeñas sube a 2,25–2,5 para
  sostenerse junto a la tipografía pesada (único ajuste propuesto al contrato de `ui-system`).

## Movimiento

Mismos nombres de ficha que `motion-system`; cambia el gesto de presión.

| Ficha | Valor | En la maqueta |
|---|---|---|
| `instant` | 100 ms | presión de botón y ficha |
| `fast` | 150 ms | chips |
| `base` | 220 ms, curva `out` | entrada de tarjetas (`.stagger`: opacidad + 8 px) |
| `slow` | 320 ms | hojas |
| `map` | 900 ms lineal | deslizamiento del marcador (`.rider`, `offset-path`) |
| escalonado | 40 ms, máximo 8 | listas de distribuidoras, productos, cola |
| `tap` (redefinido) | botón se **hunde**: `translate(3px,3px)` y la sombra dura pasa de 4 a 1 px | reemplaza la escala 0,97 en `.btn` y `.ficha--tap`; en `+/−` sí escala 0,88 |

- **Esqueleto** (`.skel`): misma forma que la tarjeta real, brillo de 1,4 s por `transform`.
  Está en la lista de distribuidoras y en la cola del monitor.
- **Marcador en ruta**: se desliza por la ruta; en la maqueta va en bucle solo para demostrarlo.
  El asignado lleva pulso (`.pulse`); los demás, quietos.
- **Ruta**: se dibuja una vez al aparecer (600 ms).
- **Movimiento reducido**: sin animaciones ni desplazamientos; el marcador queda fijo en su punto
  de la ruta y el pulso se vuelve un halo estático. Las capturas se toman así.

## Tres ambientes, un producto

| Ambiente | Qué cambia | Qué no cambia |
|---|---|---|
| Cliente | Barlow normal, fotos, más aire, bloques de tinta o de marca | fichas, placas, amarillo, mapa |
| Repartidor | cuerpo 18–21 px, objetivos de 56 px, «Ya llegué» de 76 px, una sola tarjeta | ídem |
| Central | Barlow Semi Condensed, filas de 40 px, lateral de tinta, indicadores como placas | ídem |

## Lo que la maqueta no resuelve

- **Precio del plan** (decisión D6): la portada dice «S/ 0 por 30 días» y «plan mensual fijo»
  sin monto.
- **«Precio con cambio de balón vacío»** y «Recoge 2 vacíos»: se asumió canje de envase; falta
  confirmarlo en el dominio (¿venta de balón nuevo?, ¿préstamo de envase?).
- **«Ventas del día»** en el monitor: la central no ve caja; hay que ocultar ese indicador por rol.
- **Calificación** del repartidor y de la distribuidora, y «Edwin T. está libre a 600 m»
  (sugerencia de asignación): aparecen como dato, no están definidos en el plan del MVP.
- Estados no dibujados: vacío (sin distribuidoras en la zona), error, sin conexión, cerrado,
  pedido entregado/cancelado, «sin señal» en el seguimiento del cliente, vista sin mapa.
- Pasos intermedios del pedido (dirección con pin, confirmar) y alta de distribuidora.
- Fotos: no hay ninguna de un repartidor peruano con balón, ni de una central real; las de
  balones son de otros países. Conviene una corrida más de `image-scout` o fotos propias del piloto.
- El icono de moto es una aproximación al de lucide; verificar que la versión instalada lo trae.
- El logo es una propuesta de símbolo (aro de la hornilla visto desde arriba con la llama al
  centro, sobre ficha amarilla); falta probarlo a 16 px y como icono de PWA.
