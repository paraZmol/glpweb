# Movimiento en las páginas públicas (portada, /para-distribuidoras, menú superior)

Autor: conversion-motion · Ronda 1 · 2026-10-16 · Debate con frontend-builder.
Fuentes de verdad: skill `motion-system`, `src/lib/motion.ts`, `docs/marketing/portada.md`.

## Objetivos

1. **Que se use el buscador**: llevar la mirada del titular a "Usar mi ubicación" en la primera vista (390 × 844).
2. **Elegir camino en 2 segundos**: "Quiero pedir gas" o "Tengo una distribuidora" (TwoPaths).
3. **Confianza**: la página se siente viva y cuidada sin parecer publicidad. El movimiento explica (pasos, seguridad) y no adorna.
4. **Dueños**: en `/para-distribuidoras`, que lleguen a "Registrar mi distribuidora" habiendo leído oferta y pasos.
5. **Sin coste**: el LCP (foto del héroe y titular) y el CLS no pueden empeorar en un Android de gama baja con 4G lenta.

Estado actual (capturas `.private/capturas-portada/`, código): solo hay `PageTransition`, `Stagger` en
WhatIsHornilla y OwnersOffer, presión en TwoPaths, el giro del chevron de FAQ, el menú móvil
(`dropdownVariants`) y la sombra del encabezado al hacer scroll. La página larga del celular (unas
14 pantallas) se lee como un bloque estático: ninguna sección "llega".

## Hallazgos con fuentes

Las fuentes se citaron de memoria en esta ronda (sin abrir los enlaces); frontend-builder o yo
debemos verificarlas en la ronda 2 antes del acuerdo.

| # | Hallazgo | Fuente (fecha) | Tipo |
|---|---|---|---|
| 1 | La animación sirve para atraer la atención a un cambio y para explicar relaciones; la que solo decora distrae y cansa con la repetición. | NN/g, A. Harley, "Animation for Attention and Comprehension" (2014-09); NN/g, P. Laubheimer, "The Role of Animation and Motion in UX" (2020-01) — nngroup.com | Dato |
| 2 | Duraciones útiles de UI: unos 100–500 ms; lo que pasa de ~500 ms se siente lento. | NN/g, "Executing UX Animations: Duration and Motion Characteristics" (2020-02) | Dato |
| 3 | Animaciones que mueven el layout (alto, margen, top) causan CLS; solo `transform`/`opacity` son seguras. | web.dev, "Optimize Cumulative Layout Shift" (2020, act. 2023); Lighthouse "Avoid non-composited animations" | Dato |
| 4 | INP es Core Web Vital desde marzo 2024; JS en el hilo principal al tocar lo empeora. | web.dev, "INP becomes a Core Web Vital" (2024-03-12) | Dato |
| 5 | El LCP no debe esperar a una animación: un elemento con `opacity:0` inicial retrasa o reasigna el LCP. | web.dev, "Optimize LCP" (2020, act. 2024) | Dato |
| 6 | Movimiento disparado por interacción debe poder desactivarse; respetar `prefers-reduced-motion`. | W3C WCAG 2.2, criterio 2.3.3 (2023-10); MDN `prefers-reduced-motion` | Norma |
| 7 | Más de la mitad de visitas móviles se abandonan si la página tarda más de 3 s. | Think with Google, "The need for mobile speed" (2016-09) | Dato (viejo, orientativo) |
| 8 | Los carruseles automáticos se ignoran o molestan y bajan la comprensión. | NN/g, "Auto-Forwarding Carousels and Accordions Annoy Users" (2013-01) | Dato |
| 9 | Sitios de delivery que convierten (Rappi, PedidosYa, iFood en móvil) usan movimiento mínimo: respuesta al toque, esqueletos de carga y entradas cortas; nada de héroes animados. | Observación propia, sin medición | Opinión |

Conclusión: en nuestro público el movimiento gana por **respuesta al toque y entrada corta de
secciones** y pierde por todo lo que retrase el contenido o gaste batería/datos.

## Propuesta por sección

Fichas de `src/lib/motion.ts`. "Al entrar" = una sola vez, cuando la sección cruza ~15 % de la
pantalla (IntersectionObserver, `once`). Nada de lo que está en la primera vista se oculta al cargar.

| Sección | Qué se mueve | Disparador | Duración / ficha | Movimiento reducido | Objetivo |
|---|---|---|---|---|---|
| Menú superior escritorio | Subrayado del enlace activo se desliza entre enlaces (`layoutId`, transform) | Cambio de ruta/ancla | `base`, `EASE.out` | Cambia sin desplazarse | Orientar: dónde estoy |
| Menú superior celular | Ya existe (`dropdownVariants`); añadir icono hamburguesa ↔ X con giro corto y entrada escalonada de enlaces | Tocar | Icono `fast`; enlaces `listItemVariants` (stagger 40 ms) | Solo fundido | Que abrir el menú se sienta inmediato |
| Encabezado | Sin cambios (sombra al hacer scroll ya existe) | — | — | — | — |
| Héroe: titular y foto | **Nada al cargar.** Son el LCP | — | — | — | No retrasar LCP |
| Héroe: subrayado `Highlight` | El trazo se "dibuja" una vez (`scaleX` 0→1 desde la izquierda) | Al cargar, tras pintar | `slow` (320 ms), retraso 150 ms | Visible ya dibujado | Llevar la mirada a "quien llega a tu puerta" |
| Héroe: tarjeta "Entregar en" | Sube 8 px y aparece; botón "Usar mi ubicación" con presión `PRESS_SCALE` | Al cargar | `base` tras el subrayado (total < 500 ms) | Fundido `fast` | Guiar al botón principal |
| BurnerRing (escritorio) | Rotación lenta una sola vez de unos 20° al entrar (no bucle) | Al cargar | `slow` | Quieto | Calidez de marca, sin distraer |
| TwoPaths | Entrada escalonada de las dos tarjetas; flecha avanza 4 px al hover/tocar | Al entrar / tocar | `listItemVariants`; flecha `fast` | Fundido; flecha quieta | Elegir camino |
| Distribuidoras cerca de ti | Esqueleto mientras busca (ya en motion-system); resultados con `listItemVariants`; estado vacío con fundido | Llegan datos | `base`, stagger máx. 8 | Fundido | Carga percibida corta |
| OwnersBand (bloque oscuro) | Aparece subiendo 8 px; CTA con presión | Al entrar | `base` | Fundido | Que el dueño no lo salte |
| Qué es Hornilla | Ya tiene `Stagger`: mantener; iconos sin movimiento propio | Al entrar | `base` | Fundido | Comprensión |
| Así va a funcionar (pasos 1-2-3) | Los números entran en orden y la línea que los une crece (`scaleY`) | Al entrar | `slow` total, stagger 40 ms | Todo visible, sin crecer | Explicar secuencia |
| Recarga o balón completo | Entrada de las dos filas | Al entrar | `listItemVariants` | Fundido | Comprensión |
| Seguridad | Escudo hace un `STEP_BOUNCE` corto una vez | Al entrar | `slow` | Quieto | Atención a un mensaje de seguridad |
| FAQ | Mantener giro del chevron; abrir con fundido de la respuesta (no animar `height`) | Tocar | `fast` | Sin fundido | Lectura |
| `/para-distribuidoras` héroe | Igual que la portada: nada al cargar en titular; CTA y `TRIAL_NOTE` con fundido | Al cargar | `base` | Fundido | Registro |
| OwnersOffer | Mantener `Stagger` | Al entrar | `base` | Fundido | Ver la oferta |
| OwnersSteps | Mismo patrón que "Así va a funcionar" | Al entrar | `slow` | Visible | Quitar miedo: "es fácil" |
| CTA final de dueños | Flecha del botón avanza 4 px en hover/foco | Hover/foco | `fast` | Quieta | Clic |
| Cambio de página | Mantener `PageTransition` | Navegar | `slow` | Fundido `fast` | Continuidad |

## Presupuesto de rendimiento

- Solo `transform` y `opacity`. Nada de `height`, `top`, `filter`, `box-shadow` animados.
- Ninguna librería nueva: `motion` ya está (con `LazyMotion`/`m`); el "al entrar" usa `whileInView` o un IntersectionObserver propio.
- Titular, foto del héroe y texto principal se pintan sin animación: el LCP no cambia (medir antes/después en Lighthouse móvil, 4G lenta, CPU ×4).
- CLS 0 por animación: el hueco de cada sección existe antes de animar.
- INP: el toque responde por CSS (`press`), sin trabajo en JS.
- Máximo 2 cosas moviéndose a la vez en la primera vista; nada pasa de 500 ms acumulados.
- Ningún bucle nuevo (motion-system los prohíbe salvo carga y marcador).
- Fuera de pantalla no se anima nada; `once: true` para no repetir al volver.

## Lo que NO haremos

- Contadores falsos, "X personas pidiendo ahora", urgencia inventada.
- Carruseles automáticos, parallax, vídeo de fondo, Lottie, partículas, llamas animadas.
- Ocultar el héroe hasta que "aparezca" (retrasa el LCP).
- Animar al hacer scroll de forma continua (scroll-linked): pesa en gama baja.
- Rebotes o bucles que llamen la atención permanentemente.
- Analítica o pruebas A/B para medir (cookies.md promete que no hay rastreo); se valida con capturas, Lighthouse y role-walker.

## Objeciones de frontend-builder

Ronda 2 · 2026-10-16. Lo comprobé en el código: `LazyMotion features={domAnimation} strict` en
`root-layout.tsx` (ya cubre `whileInView` y `whileHover`, así que no hay coste extra de paquete);
`Stagger` hoy anima **al montar**, no al entrar en pantalla: en el celular las secciones de abajo
ya terminaron de animar cuando la persona llega. Los componentes de `landing/` miden 39–59 líneas:
hay margen bajo el límite de 150.

**Regla base que propongo:** una sola pieza nueva, `Reveal` (envoltorio con `whileInView`,
`viewport={{ once: true, amount: 0.15 }}`, variantes de `listItemVariants`), y que `Stagger`
reciba la opción `inView`. Un solo observador por sección (Motion comparte un IntersectionObserver
por opciones), nunca uno por tarjeta. Sin `layout`/`layoutId` en páginas públicas.

| Ítem | Veredicto | Motivo / cómo |
|---|---|---|
| Subrayado activo del menú de escritorio (`layoutId`) | **Cambiar** | `layoutId` usa la proyección de layout: necesita `domMax` (≈ +10–15 kB gz) en vez de `domAnimation`. Hacerlo con CSS: el subrayado de cada enlace hace `scaleX` 0→1 con `--motion-base` al quedar activo. Reducido: aparece sin escalar. |
| Hamburguesa ↔ X y enlaces escalonados | **Aceptar** | Icono con cruce de `opacity`/`rotate` en `fast`; enlaces con `listItemVariants` (máx. 6). Foco se mueve al primer enlace al abrir (ya debería; verificar). |
| Héroe titular y foto: nada | **Aceptar** | Es el LCP. |
| Subrayado `Highlight` que se dibuja | **Cambiar** | Hacerlo en CSS puro (`@keyframes` con `transform: scaleX`, `animation-delay` por variable), no con Motion: así corre antes de hidratar y no depende de JS. Debe ser pseudo-elemento o elemento aparte del texto, para no tocar el LCP. Reducido: `@media (prefers-reduced-motion)` lo deja dibujado. |
| Tarjeta "Entregar en" sube y aparece | **Cambiar** | Nada de `opacity: 0` inicial: está en la primera vista a 390 px, puede ser candidata a LCP y además es el objetivo nº 1 (botón "Usar mi ubicación"); si el JS tarda en 4G lenta, el botón estaría invisible. Solo `translateY` 8 px → 0 en CSS, siempre opaca. Presión `PRESS_SCALE` en el botón: aceptar (ya lo da `Button`). |
| BurnerRing gira 20° | **Rechazar** | Decoración pura (hallazgo 1), sin objetivo de conversión; un elemento grande que gira en escritorio compite con el titular. Si se quiere calidez, mejor nada. |
| TwoPaths escalonado + flecha 4 px | **Cambiar** | En 390 px TwoPaths queda a la altura del pliegue: aplicar `Reveal` solo si está fuera de la primera vista (`amount` bajo, `once`). Flecha: CSS `group-hover`/`group-focus-visible` con `translateX`, en `fast`; nada en JS (INP). Aceptar. |
| Resultados cerca de ti | **Aceptar** | Ya existe el patrón (`Stagger` + esqueleto con `LOADING_FEEDBACK`). Solo cuidar que el esqueleto tenga la misma altura que el resultado (CLS). |
| OwnersBand aparece | **Aceptar** | Con `Reveal`. |
| Qué es Hornilla / OwnersOffer: mantener `Stagger` | **Cambiar** | Pasar a `Stagger inView`; hoy animan al montar y nadie lo ve en el celular. |
| Pasos 1-2-3 con línea que crece (`scaleY`) | **Aceptar con cambio** | La línea en escritorio es horizontal (`scaleX`), en celular vertical: dos variantes por breakpoint, no la misma. Total ≤ `slow` + 3 × 40 ms. Reducido: todo visible. Un componente `StepsTimeline` compartido entre portada y OwnersSteps (≈ 60 líneas). |
| Recarga o balón: entrada de filas | **Aceptar** | `Reveal`/`Stagger inView`. |
| Escudo con `STEP_BOUNCE` | **Rechazar** | `STEP_BOUNCE` es la ficha del paso actual del seguimiento del pedido (dirección B); reusarla en la portada le quita significado. Además lleva 600 ms de retraso + 320 ms: pasa el presupuesto de 500 ms. El bloque de seguridad entra con `Reveal` como los demás. |
| FAQ: fundido de la respuesta | **Aceptar** | Si usa `Collapsible` de `components/ui/*`, no lo edito: fundido por clase `data-[state=open]:animate-in fade-in` en la página. Sin `height`. |
| `/para-distribuidoras` héroe: CTA y `TRIAL_NOTE` con fundido | **Cambiar** | Mismo argumento que "Entregar en": el CTA principal en la primera vista no arranca invisible. Sin animación de entrada. |
| OwnersSteps | **Aceptar** | Mismo `StepsTimeline`. |
| Flecha del CTA final | **Aceptar** | CSS, `fast`, reducido quieta. |
| Cambio de página | **Aceptar** | Mantener. |

**Huecos que veo en reducido y a11y:** `whileInView` con `opacity: 0` deja contenido invisible si
el observador nunca dispara (impresión, lector de pantalla saltando con el cursor virtual, captura
de página completa). Mitigación: con movimiento reducido `Reveal` no oculta nada (render directo, sin
`initial`); con movimiento normal, `once` y `amount` 0.15, y una prueba E2E que haga scroll al final y compruebe que todo es visible. Los E2E actuales que leen
texto de secciones bajas podrían fallar si el elemento está a `opacity: 0` (Playwright lo considera
visible, pero las capturas no): revisar `tests/e2e` de la portada.

**Lo que añadiría para atraer más (dentro de las reglas):**
1. Respuesta inmediata en "Usar mi ubicación": al tocar, el icono pasa a un indicador de carga a
   los 300 ms (`LOADING_FEEDBACK`) y el texto a "Buscando…". Es el momento de mayor abandono.
2. Las tarjetas de distribuidora cercana con presión y `hover` de elevación por CSS (sombra
   estática que cambia de token, sin animar `box-shadow`: se cruza opacidad de una capa).
3. Al pulsar "Tengo una distribuidora" en TwoPaths, `PageTransition` `forward` ya cuenta la
   historia; no hace falta más.

**Esfuerzo estimado:** `Reveal` + `Stagger inView` + test: 0,5 día. Héroe (Highlight CSS, tarjeta,
flechas, subrayado de menú, hamburguesa): 0,5 día. `StepsTimeline` en dos páginas: 0,5 día.
Capturas 390/1440 claro/oscuro, Lighthouse móvil antes/después y ajustes: 0,5 día. Total ≈ 2 días.
Sin dependencias nuevas; cambio de paquete ≈ 0 (todo cabe en `domAnimation` + CSS).

## Respuesta de conversion-motion (ronda 3, 2026-10-16)

### Fuentes verificadas (abiertas el 2026-10-16)

| # | Estado | Fuente comprobada |
|---|---|---|
| 1 | **Corregida** | NN/g, P. Laubheimer, "The Role of Animation and Motion in UX" (2020-01-12): la animación debe ser "unobtrusive, brief, and subtle"; sirve para dar respuesta, mostrar cambio de estado y orientar; usarla para secuestrar la atención (cuenta atrás parpadeante) es patrón oscuro. https://www.nngroup.com/articles/animation-purpose-ux/ . Se **retira** la cita a Harley 2014 (no la abrí). |
| 2 | **Corregida** | NN/g, P. Laubheimer, "Executing UX Animations: Duration and Motion Characteristics" (2020-02-09): la mayoría entre 100 y 400 ms; 500 ms como techo. https://www.nngroup.com/articles/animation-duration/ |
| 3 | Confirmada | web.dev, "Optimize Cumulative Layout Shift" (2020-05-05, act. 2025-02-07): no animar `top`/`left`/`box-shadow`; `transform` no cuenta para CLS. https://web.dev/articles/optimize-cls |
| 4 | **Corregida (enlace)** | web.dev, "Interaction to Next Paint becomes a Core Web Vital on March 12" (2024): INP reemplaza a FID el 12-03-2024. https://web.dev/blog/inp-cwv-march-12 |
| 5 | **Matizada** | web.dev, "Optimize LCP" (2020-04-30, act. 2025-03-31): un elemento LCP "oculto hasta que termina de cargar el JS" suma retraso de render. No habla de `opacity:0` en concreto; lo de opacidad queda como inferencia nuestra. https://web.dev/articles/optimize-lcp |
| 6 | **Corregida** | W3C, WCAG 2.2, 2.3.3 "Animation from Interactions" es nivel **AAA** (no AA): lo tomamos como meta, no como obligación. https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html · MDN `prefers-reduced-motion` (Baseline desde 2020-01). https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion |
| 7 | **Retirada** | Think with Google 2016: no la verifiqué; no se usa para decidir. |
| 8 | **Corregida (título)** | NN/g, "Auto-Forwarding Carousels and Accordions Annoy Users and Reduce Visibility" (2013-01-19). https://www.nngroup.com/articles/auto-forwarding/ |
| 9 | Sigue opinión | Observación de apps de delivery, sin medición. |

### Respuesta a cada objeción

| Ítem | Respuesta |
|---|---|
| Subrayado del menú con `layoutId` | **Acepto** CSS `scaleX` con `--motion-base`. No vale +10–15 kB por un subrayado. |
| Hamburguesa y enlaces | Acepto. |
| Héroe titular y foto quietos | Acepto. |
| `Highlight` en CSS puro | **Acepto**: mejor que mi versión (corre antes de hidratar). Pseudo-elemento, `slow`, retraso 150 ms. |
| "Entregar en" siempre opaca, solo `translateY` | **Acepto**. Fuente 5 lo respalda. Además quito el `translateY`: un desplazamiento que corre antes de que la persona mire no aporta y gasta un cuadro en gama baja. La guía hacia el botón la hace el subrayado. |
| BurnerRing | **Acepto rechazarlo**. Era decoración (fuente 1). |
| TwoPaths con `Reveal` solo fuera de la primera vista | **Contrapropongo**: TwoPaths **sin** `Reveal` en ningún tamaño. Medir "si está en la primera vista" depende del alto del celular y de la fuente; si falla, el camino nº 2 aparece invisible. Se queda con la flecha CSS al tocar, que sí persigue el objetivo. |
| Resultados cerca de ti | Acepto, con esqueleto de igual alto. |
| OwnersBand con `Reveal` | Acepto. |
| `Stagger inView` | Acepto. |
| `StepsTimeline` con dos ejes | Acepto. |
| Recarga o balón | Acepto. |
| Escudo sin `STEP_BOUNCE` | **Acepto**: la ficha es del seguimiento; reusarla le quita significado. |
| FAQ fundido por clase | Acepto. |
| `/para-distribuidoras` CTA sin entrada | Acepto. |
| OwnersSteps, flecha CTA, `PageTransition` | Acepto. |
| Hueco de a11y con `opacity:0` | Acepto la mitigación y añado: `Reveal` parte de `opacity:0` **solo si** hay JS y no hay movimiento reducido; sin JS o con reducido, render directo. Desplazamiento de entrada 8 px máx. (no 16+), para no marear. |
| Tus 3 añadidos | **Acepto 1** ("Buscando…" a los 300 ms en "Usar mi ubicación": es el punto de mayor abandono) y **2** (capa de sombra con opacidad). 3: de acuerdo, nada más. |

## Acuerdo final

Firmado por conversion-motion (ronda 3, 2026-10-16). Preguntas respondidas por el usuario el 2026-10-16 (ver al final).
Reglas comunes: solo `transform`/`opacity`; fichas de `src/lib/motion.ts`; sin dependencias
nuevas; `domAnimation` (sin `layout`/`layoutId`); `once: true`, `amount: 0.15`; desplazamiento de
entrada ≤ 8 px; nada en la primera vista arranca invisible; ningún bucle nuevo; con movimiento
reducido todo se muestra en su sitio final (como mucho fundido `fast`).

### Lo que se construye

| Sección | Qué se mueve | Disparador | Ficha / duración | Movimiento reducido | Cómo |
|---|---|---|---|---|---|
| Menú escritorio | Subrayado del enlace activo `scaleX` 0→1 | Ruta/ancla activa | `--motion-base`, `EASE.out` | Aparece sin escalar | CSS |
| Menú celular | Icono hamburguesa↔X (`opacity`+`rotate`); enlaces escalonados (máx. 6); foco al primer enlace | Tocar | Icono `fast`; enlaces `listItemVariants` | Solo fundido | Motion (ya montado) |
| Héroe titular, foto, tarjeta "Entregar en" | **Nada** | — | — | — | — |
| Héroe `Highlight` | Trazo `scaleX` 0→1 desde la izquierda, una vez | Al cargar | `slow`, retraso 150 ms | Ya dibujado | CSS `@keyframes`, pseudo-elemento |
| "Usar mi ubicación" | Presión; a los 300 ms sin respuesta, icono→indicador y texto "Buscando…" | Tocar | `PRESS_SCALE`, `LOADING_FEEDBACK` | Indicador sin girar (texto basta) | CSS + estado existente |
| TwoPaths | Solo flecha `translateX` 4 px | Hover / foco / toque | `fast` | Quieta | CSS `group-*` |
| Distribuidoras cerca | Esqueleto igual de alto; resultados escalonados (máx. 8); tarjeta con presión y capa de sombra por opacidad | Llegan datos / hover | `base`, `listItemVariants` | Fundido | `Stagger` + CSS |
| OwnersBand | Sube 8 px y aparece | Al entrar | `base` | Visible | `Reveal` |
| Qué es Hornilla, Recarga o balón, Seguridad, OwnersOffer | Entrada escalonada | Al entrar | `listItemVariants` | Visible | `Stagger inView` / `Reveal` |
| Pasos 1-2-3 y OwnersSteps | Números en orden; línea crece (`scaleY` celular, `scaleX` escritorio) | Al entrar | ≤ `slow` + 3×40 ms | Todo visible, línea completa | `StepsTimeline` compartido |
| FAQ | Chevron gira; respuesta con fundido (sin `height`) | Tocar | `fast` | Sin fundido | CSS por clase |
| `/para-distribuidoras` héroe | **Nada** de entrada | — | — | — | — |
| CTA final dueños | Flecha 4 px | Hover/foco | `fast` | Quieta | CSS |
| Cambio de página | `PageTransition` (sin cambios) | Navegar | `slow` | Fundido `fast` | Motion |

### Descartado y por qué

- `layoutId` en el menú: obliga a `domMax` (+10–15 kB) por un subrayado.
- Entrada de "Entregar en" y del CTA de `/para-distribuidoras`: el objetivo nº 1 no puede estar invisible ni moverse mientras carga (fuente 5).
- `Reveal` en TwoPaths: depende del alto del pliegue; riesgo de camino invisible.
- Giro de BurnerRing: decoración sin objetivo (fuente 1).
- `STEP_BOUNCE` en el escudo: ficha reservada al seguimiento; pasa de 500 ms (fuente 2).
- Carruseles automáticos (fuente 8), parallax, scroll-linked, vídeo, Lottie, llamas, contadores o "personas pidiendo ahora" (patrón oscuro, fuente 1), analítica o A/B (cookies.md).

### Comprobaciones para darlo por bueno

1. **E2E scroll al final**: en portada y `/para-distribuidoras`, a 390 y 1440, bajar hasta el pie y comprobar que cada sección tiene opacidad computada 1 y `transform` final; repetir con `reducedMotion: 'reduce'` y comprobar que nada parte oculto; repetir con JS de Motion lento (red throttled) y verificar que titular, "Usar mi ubicación" y los CTA de dueños son visibles antes de hidratar.
2. **Lighthouse móvil** (4G lenta, CPU ×4), antes y después, 3 corridas, mediana: LCP no sube más de 100 ms, CLS = 0,00 por animación, TBT/INP sin empeorar, sin aviso "Avoid non-composited animations".
3. **Capturas** 390 y 1440, claro y oscuro, en `.private/capturas-portada/` (antes/después), más una captura de página completa con movimiento normal (nada debe salir en blanco).
4. Pasan `perf-a11y-auditor`, `visual-designer`, `ux-reviewer` y `role-walker` (visitante y dueño).

### Preguntas al usuario (gusto)

1. ¿El subrayado de "quien llega a tu puerta" se dibuja al cargar o prefieres que esté quieto desde el principio?
2. ¿Las secciones de abajo "llegan" al bajar (subir 8 px y aparecer) o prefieres la página totalmente quieta y solo respuesta al toque?

### Respuestas del usuario (2026-10-16)

1. El subrayado **se dibuja al cargar**, una sola vez, en menos de 500 ms (retraso 150 ms + `slow`).
2. Las secciones de abajo **sí llegan al bajar** (subir 8 px y aparecer), una sola vez.
