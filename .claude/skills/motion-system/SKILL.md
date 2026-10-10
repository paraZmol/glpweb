---
name: motion-system
description: Sistema de movimiento de glpWEB — estados de carga (esqueletos, indicadores), transiciones entre pantallas y pasos, entrada de listas, hojas y diálogos, respuesta al toque, cambios de estado del pedido, movimiento del marcador en el mapa, avisos y celebraciones, con duraciones, curvas, reglas de rendimiento y movimiento reducido. Cargar antes de añadir o cambiar cualquier animación, pantalla de carga o transición, y al revisar si una pantalla se siente coherente.
---

# Movimiento

El movimiento aquí tiene tres trabajos: **decir que algo está pasando** (carga), **decir de dónde
viene y a dónde va** (transición) y **confirmar lo que hiciste** (respuesta). Si una animación no
hace ninguno de los tres, sobra. Coherencia antes que espectáculo: las mismas pocas piezas en
toda la app.

## 1. Fichas (únicas; viven en `src/lib/motion.ts` y como variables CSS)

| Ficha | Valor | Uso |
|---|---|---|
| `instant` | 100 ms | respuesta al toque, hover, foco |
| `fast` | 150 ms | chips, interruptores, aparición de avisos pequeños |
| `base` | 220 ms | entrada de tarjetas, cambio de pestaña, paso de asistente |
| `slow` | 320 ms | hojas inferiores, diálogos, cambio de pantalla |
| `map` | 900 ms lineal | deslizamiento del marcador entre dos posiciones |
| curva `out` | `cubic-bezier(0.22, 1, 0.36, 1)` | todo lo que **entra** |
| curva `in` | `cubic-bezier(0.4, 0, 1, 1)` | todo lo que **sale** (y sale más rápido: 0.7×) |
| resorte `tap` | rigidez 500, amortiguación 30 | presión de botones |
| escalonado | 40 ms entre elementos, máximo 8 | listas y rejillas |

Nadie escribe milisegundos ni curvas a mano en un componente. Las fichas concretas pueden
ajustarse cuando `design-director` fije la dirección; los nombres no cambian.

## 2. Carga — nunca una pantalla en blanco
- **Esqueleto** con la forma real del contenido (misma altura: sin saltos al llegar los datos)
  para listas, tarjetas, paneles. Brillo suave de 1,4 s. Componente `Skeleton` de shadcn.
- **Indicador pequeño dentro del botón** para acciones (aceptar, cobrar, guardar): el botón
  conserva su ancho, se deshabilita y muestra el indicador; nunca un velo a pantalla completa.
- **Barra fina superior** al navegar entre pantallas que cargan código o datos.
- **Regla de los 300 ms**: no mostrar nada de carga si responde antes de 300 ms (evita parpadeo);
  una vez mostrado, mantenerlo al menos 400 ms.
- **Mapa**: fondo neutro con la silueta de los paneles mientras llegan las teselas; los
  marcadores aparecen con escala 0.8→1 y opacidad.
- **Datos de la caché primero**: si Firestore tiene copia local, se muestra al instante y se
  actualiza en sitio, sin esqueleto.
- Carga larga (> 4 s): texto que explica ("Buscando repartidor cercano…"), no solo un giro.
- **Optimista** donde no hay riesgo (añadir al pedido, marcar favorito); **nunca** en lo que
  depende de una transacción (aceptar pedido, cobrar, aprobar): ahí se espera la confirmación.

## 3. Entre pantallas y pasos
- **Jerarquía espacial**: entrar a un detalle desliza desde la derecha (24 px + opacidad);
  volver, al revés. Cambiar de pestaña en la barra inferior: fundido cruzado, sin deslizar.
- **Asistentes** (pedido, alta de distribuidora, abrir jornada): el paso siguiente entra por la
  derecha, el anterior por la izquierda; la barra de progreso avanza con `base`.
- **Elemento compartido**: la tarjeta del producto o del pedido se transforma en la cabecera del
  detalle (`layoutId`). Solo en esos dos casos; no en todo.
- **Hojas inferiores** (celular): suben con `slow` y curva `out`, se arrastran para cerrar.
  **Diálogos** (escritorio): escala 0.96→1 + opacidad. Fondo oscurecido con `fast`.
- La posición de desplazamiento se conserva al volver.
- Implementación: `motion/react` (`AnimatePresence`, `layout`) con un componente
  `PageTransition` único en el enrutador; no animar cada página a mano.

## 4. Listas y contenido
- Primera aparición: escalonado (opacidad + 8 px hacia arriba). Solo la primera vez, no al volver.
- Elemento nuevo en vivo (pedido que entra a la cola): se abre espacio con `layout` y destella
  una vez con el color de estado. Elemento que sale: se pliega con `fast`.
- Reordenar (cola de pedidos): `layout`, nunca saltos.
- Números que cambian (total, tiempo estimado, indicadores): transición del dígito, con números
  tabulares para que no baile el ancho.

## 5. Respuesta y estado
- **Toque**: escala 0.97 con resorte `tap` en todo lo pulsable; ondas no.
- **Cambio de estado del pedido**: la línea de tiempo se llena hasta el nuevo punto, el icono del
  paso hace un rebote corto, el titular cambia con fundido cruzado.
- **Éxito** ("Pedido confirmado", "Entregado", "Caja cuadrada"): marca de verificación que se
  dibuja (trazo, 400 ms). Una sola celebración por flujo; sin confeti.
- **Error**: sacudida horizontal corta (6 px, 2 veces) del campo o del botón + mensaje. Nunca solo color.
- **Aviso de pedido nuevo al repartidor**: tarjeta que entra desde arriba con resorte, pulso suave
  del borde mientras espera respuesta, cuenta atrás como anillo que se vacía.
- **Sin conexión / sin señal**: el banner baja con `base`; el marcador se atenúa con `slow`.
- **Avisos (toast)**: `sonner`, entran desde abajo en celular y arriba a la derecha en escritorio.

## 6. Mapa
- El marcador se **desliza** entre posiciones (`map`, lineal) y gira hacia el rumbo; nunca salta.
  Si el salto es mayor a 300 m o la lectura es vieja, aparece en el sitio nuevo con fundido.
- La ruta se dibuja una vez al aparecer (trazo progresivo, 600 ms).
- Ajustar la vista (`fitBounds`) con animación solo cuando cambia el estado del pedido, no en
  cada lectura: el mapa no debe "pelear" con el dedo del usuario. Si el usuario movió el mapa,
  dejar de seguir y mostrar botón "Centrar".
- Pulso en el marcador propio y en el del repartidor asignado; los demás quietos.

## 7. Reglas técnicas
- Animar solo `transform` y `opacity` (y `clip-path`/trazo en SVG). Nunca `width`, `height`,
  `top`, `left`, sombras grandes ni filtros en listas.
- `prefers-reduced-motion`: `useReducedMotion()` → sin desplazamientos ni escalas; solo fundidos
  de ≤ 150 ms, marcador que salta con fundido, esqueleto sin brillo. La app sigue completa.
- Nada bloquea la interacción: toda animación es interrumpible; un toque durante una transición vale.
- Sin animaciones en bucle salvo indicadores de carga y el pulso del marcador activo.
- En la app del repartidor: mitad de adorno, respuestas más rápidas (`instant`/`fast`), nada que
  retrase un botón crítico.
- Celulares modestos: máximo 8 elementos animándose a la vez; listas largas sin escalonado.
- Sin Lottie ni vídeos; iconos animados con SVG + `motion`.

## 8. Lista antes de aceptar
1. ¿Cada animación carga, orienta o confirma?
2. ¿Usa las fichas (sin números sueltos)?
3. ¿Hay algún momento en blanco o un salto de contenido al cargar?
4. ¿Se entiende de dónde viene cada pantalla y cómo volver?
5. ¿Funciona igual de bien con movimiento reducido?
6. ¿Fluida en un celular modesto (sin tirones al desplazar)?
7. ¿La misma acción se anima igual en toda la app?
