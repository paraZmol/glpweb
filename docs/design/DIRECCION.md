# Dirección de diseño de Hornilla: qué construir

Dirección elegida el 2026-10-10: **"Cocina de casa"**, con el logo de la corona de la hornilla y
la gota de llama, y modo oscuro completo. La spec (tokens, tipografía, piezas, reglas) está en
`.claude/skills/ui-system/SKILL.md`; este documento dice **qué va en cada pantalla** y qué falta
decidir. El movimiento sigue la skill `motion-system`.

## Cómo leerlo

- **Maqueta**: `docs/design/propuestas/b-cocina-de-casa/<pantalla>.html`. Se abre directo en el
  navegador; admite `?tema=claro|oscuro` y `?marca=<hex sin #>`.
- **Capturas**: `docs/design/propuestas/b-cocina-de-casa/capturas/`, con nombre
  `<pantalla>-<movil|escritorio>-<claro|oscuro>[-marca-<nombre>].png`. No están en git: se
  generan con `node docs/design/propuestas/b-cocina-de-casa/capturas.mjs [pantalla…]`.
- La maqueta usa nombres de clase propios (`.btn`, `.card`, `--ink`…). En la app se usan los
  tokens y utilidades de `ui-system`; la maqueta es referencia de aspecto, no de código.
- Los datos de la maqueta son inventados (distribuidoras, marcas de gas, personas, teléfonos
  `900 000 0xx`). En la app salen de la distribuidora; nada de eso se escribe en un componente.
- Orden de construcción: el del plan (`docs/PLAN.md` §7). Aquí se indica el paso de cada pantalla.

## Piezas compartidas (antes de la primera pantalla)

| Pieza | Dónde | Notas |
|---|---|---|
| `HornillaLogo` | `src/components/brand/hornilla-logo.tsx` | Hecho. |
| `BrandTheme` + `deriveBrand(hex)` | `src/components/brand/brand-theme.tsx`, funciones puras en `src/domain/brand/` con test | Hecho, falta verificación visual. `ui-system` §6. `checkBrandColor` rechaza menos de 2:1 y propone un tono. |
| `GasCylinder` (balón), `BurnerRing` (aro), `Highlight` (resalte), `Monogram` | `src/components/brand/` | Hecho, falta verificación visual. `ui-system` §9. |
| Botón de Hornilla (primario, tinta, suave, línea, discreto; tres tamaños; estado de carga) y botón crítico | `src/components/common/button.tsx`, `critical-button.tsx` | Hecho, falta verificación visual. Envuelven `ui/button`. `ui-system` §8 y §13. |
| Chip de estado | `src/components/common/state-chip.tsx` | Hecho, falta verificación visual. `ui-system` §5.3. |
| Sello, chip de filtro, selector +/− | `src/components/common/` | Pendiente: se construyen con la primera pantalla que los use. |
| Campo, casilla, aviso en línea, vacío y error, esqueletos | `src/components/common/` | Hecho, falta verificación visual. |
| Hoja inferior / diálogo | shadcn + envoltorio | Pendiente. Con `motion-system`. |
| `PageTransition`, `Stagger`, barra de navegación en curso, avisos (`sonner`) | `src/components/motion/`, `src/components/common/app-toaster.tsx` | Hecho, falta verificación visual. Fichas en `src/lib/motion.ts`. |
| Mapa: capa base, ruta y los cuatro marcadores | `src/lib/map/` detrás de `MapProvider` | `ui-system` §12. Marcadores como `divIcon` con SVG en línea y tokens. |
| Contenedores de ambiente (`data-ambient`) y navegación por rol | `src/components/layout/` (`AppShell`, `PublicShell`, `RequireAccess`) | Hecho, falta verificación visual. Paso 2.4. |

## Pantallas maquetadas

### 0. Inicio del cliente (buscador) — paso 2.6
Capturas: `inicio-movil-claro.png`, `inicio-movil-oscuro.png`, `inicio-escritorio-claro.png`,
`inicio-escritorio-oscuro.png`. Marca de Hornilla (sin `BrandTheme`).

Construir:
- Cabecera con logo e "Ingresar"; en escritorio, además "Mis pedidos" y "Tengo una distribuidora".
- Titular "¿Se acabó el gas? Pídelo y míralo llegar." con resalte en la segunda frase.
- Foto de la tetera con sello ají "N distribuidoras abiertas en {ciudad}" (dato real; si es 0,
  ver estados vacíos).
- Tarjeta "Entregar en" con la dirección activa y "Cambiar" (celular: montada sobre la foto;
  escritorio: buscador en píldora con "Mi ubicación" y "Ver quién llega").
- "Lo de siempre": último pedido con "Repetir" (solo con sesión e historial).
- Filtros en chips: peso (10, 15, 45 kg) y orden (más rápido, mejor precio, mejor calificada).
- Tarjeta de distribuidora: monograma con su color, nombre, calificación y distancia, sello
  opcional ("Llega primero", "Mejor precio"), balones de sus marcas de gas, "Balón 10 kg desde
  S/ …", "Llega en 15–25 min" y "Pedir". Solo la primera lleva botón primario.
- Esqueleto con la forma de la tarjeta mientras se buscan más.
- Escritorio: mapa de cobertura fijo a la derecha (plantas con su color, "Tu casa", círculo).
- "Tres toques y el almuerzo sigue." (3 pasos con foto) y banda para dueños con CTA.
- Barra inferior en celular: Inicio, Pedidos, Cuenta.

### 1. Portada para dueños — fase 2 (junto al alta)
Capturas: `portada-movil-claro.png`, `portada-movil-oscuro.png`, `portada-escritorio-claro.png`,
`portada-escritorio-oscuro.png`.

Construir, en este orden:
1. Promesa: sello "Para distribuidoras de gas", titular "Tus pedidos, tus motos y tu caja, en un
   solo mapa." con resalte, entradilla, CTA "Crear mi distribuidora" + "Ver una página de
   ejemplo", y tres garantías (30 días gratis, sin tarjeta, sin instalar nada). Foto con aro y
   tarjetas flotantes ("Pedido nuevo", "Caja cuadrada").
2. "Así se ve tu página": celular de muestra con `BrandTheme` propio y seis muestras de color
   que lo cambian en vivo; enlace de ejemplo con "Copiar".
3. "Lista en una tarde. De verdad.": tres pasos en tarjetas con número en primario.
4. Mapa en vivo con tarjeta flotante y dos indicadores (datos de demostración fijos).
5. Repartidor (foto con velo fuerte y botón "Ya llegué" de muestra) y cuadre de caja.
6. Barrio: foto limpia con tarjeta flotante.
7. Precio: "S/ 0" con sello "Prueba de 30 días", lista de lo incluido y CTA.
8. Pie en `band` con el símbolo, titular y CTA.

Un solo CTA primario repetido ("Crear mi distribuidora"); el resto, línea.

### 2. Página pública de una distribuidora (`/d/{slug}`) — paso 2.5
Capturas: `distribuidora-movil-claro.png`, `distribuidora-movil-oscuro.png`,
`distribuidora-escritorio-claro.png`, `distribuidora-escritorio-oscuro.png`, y las variantes
`-marca-rocoto`, `-marca-tinta` y `-marca-ambar` en los cuatro formatos. Dentro de `BrandTheme`.

Construir:
- Portada: foto con velo, botón volver, "con Hornilla" en píldora, monograma o logo, nombre y
  "Abierto · cierra a las 8:00 p. m." (chip de estado libre; cerrado: ver pendientes).
- Franja de tres datos: calificación, tiempo a tu dirección, forma de pago.
- "Elige tu balón" con chips de peso y de marca de gas, y la nota del precio con vacío a cambio.
- Tarjeta de producto: balón en su casilla teñida con el color de la marca de gas, sello
  opcional, "Balón 10 kg", marca con punto de color, precio y selector +/−.
- Cobertura (mini mapa con planta, casa y círculo) y horario con WhatsApp y teléfono.
- Celular: barra fija "Pedir" con contador, texto y total. Escritorio: resumen "Tu pedido" fijo
  con líneas, dirección, reparto, total y "Pedir".
- "Pedidos y seguimiento con Hornilla" al pie.

### 3. Seguimiento del pedido — paso 6.2
Capturas: `seguimiento-movil-claro.png`, `seguimiento-movil-oscuro.png`,
`seguimiento-escritorio-claro.png`, `seguimiento-escritorio-oscuro.png`,
`seguimiento-*-claro-marca-verde.png`. Dentro de `BrandTheme`.

Construir:
- Mapa a pantalla completa: ruta con tramo recorrido, repartidor activo con pulso y "Nombre ·
  8 min", planta con sigla, "Tu casa". Botón "Centrar" (aparece si la persona movió el mapa).
- Píldora flotante con monograma, distribuidora y número de pedido.
- Hoja (celular) o panel flotante de 452 px (escritorio): chip de estado, "Tu gas llega en
  8 min" con resalte en el tiempo, frase con la hora estimada, línea de tiempo de cinco pasos
  (Recibido, Asignado, En camino, Llegó, Entregado; los nombres salen del dominio), tarjeta del
  repartidor con "Llamar" y "WhatsApp", resumen con balones, total y "Pagas al recibir".
- Escritorio: "Ten a la mano" (vacíos y monto) y "Cancelar pedido".
- "Ver sin mapa": vista simple con lo mismo, sin mapa (por diseñar, ver abajo).
- La región de estado anuncia los cambios (`aria-live="polite"`).

### 4. Monitor de la central — paso 6.3
Capturas: `monitor-movil-claro.png`, `monitor-movil-oscuro.png`, `monitor-escritorio-claro.png`,
`monitor-escritorio-oscuro.png`. Ambiente `office`, dentro de `BrandTheme`.

Construir:
- Lateral (escritorio): logo, selector de distribuidora con estado del plan, navegación
  (Monitor, Pedidos con contador de alerta, Repartidores, Caja y jornadas, Stock de planta,
  Reportes, Mi distribuidora), resumen de stock y cuenta. Celular: barra inferior de cinco.
- Cabecera: "Monitor", fecha y hora con "en vivo", buscador de pedido o teléfono, avisos y
  "Pedido telefónico" (primario; en celular, botón flotante).
- Indicadores: pedidos hoy, entregados, en camino, sin asignar (contorno de alerta si pasa el
  umbral), tiempo de entrega, ventas del día.
- Mapa: chips con el conteo por estado, repartidores, pedidos sin asignar numerados, planta,
  rutas (la del seleccionado, plena; las demás, tenues), lista flotante "Repartidores en
  jornada" con glifo de estado, detalle y balones a bordo; controles de acercar y alejar.
- Cola: pestañas Sin asignar / En curso / Entregados; tarjeta con posición, número, origen
  (Web o Teléfono), espera, dirección, referencia, artículos, total y "Asignar"; "En curso
  ahora" compacto; esqueleto al cargar más.

### 5. Repartidor: pedido en curso — paso 6.4
Capturas: `repartidor-movil-claro.png`, `repartidor-movil-oscuro.png`,
`repartidor-escritorio-claro.png`, `repartidor-escritorio-oscuro.png`. Ambiente `driver`.

Construir:
- Mapa: indicación en píldora de tinta ("1,2 km · 4 min", "Sigue por Av. …"), botón "Centrar"
  de 56 px, ruta con filete de tinta, chip "GPS activo · pantalla siempre encendida".
- Panel: etiqueta en tinta "Pedido #… · En camino", "Entrega N de hoy", dirección a 32 px,
  referencia, cliente con "Llamar" y "WhatsApp" de 56 px, caja con contorno de tinta (balón,
  cantidad, vacíos a recoger, "Cobrar", monto y medio de pago).
- Botón crítico "Ya llegué" de 72 px y debajo "Abrir en Maps" y "Tengo un problema".
- Tablet y escritorio: panel de 540 px a la derecha con "Después de este".

## Pantallas por diseñar (sin maqueta)

Se diseñan con las piezas de `ui-system` antes de construirlas; cada una pasa por
`visual-designer` a 390 y 1440, claro y oscuro. No tienen captura de referencia.

| Pantalla | Paso | Punto de partida | Qué debe resolver |
|---|---|---|---|
| Pedido, paso 2: dónde (pin) | 4.1, 4.2 | mapa a pantalla completa + hoja, como el seguimiento | pin fijo al centro y mapa que se mueve debajo, dirección detectada, campo de referencia, "Usar mi ubicación", aviso de fuera de cobertura, direcciones guardadas |
| Pedido, paso 3: confirmar | 4.2 | resumen "Tu pedido" de la página de la distribuidora | líneas con balón, vacíos a entregar, medio de pago (tarjetas, no desplegable), "con cuánto pagas" para el vuelto, total, un botón "Confirmar pedido", y la confirmación (marca que se dibuja) |
| Acceso y registro | 2.1 | tarjeta destacada centrada, logo arriba | solo "Continuar con Google" (PLAN 2.1, 2026-10-12): un botón, su línea legal y el error bajo el botón; `/registro` es la misma pantalla con otro título |
| Alta de distribuidora | 2.2 | asistente de pasos con vista previa en vivo (el celular de muestra de la portada) | nombre y enlace (disponibilidad del slug), WhatsApp, planta con pin, radio de cobertura sobre el mapa, color (muestras + hex con la validación de §6) y logo |
| Seguimiento sin mapa | 6.2 | hoja del seguimiento a página completa | lo mismo sin mapa; también es la alternativa cuando no hay posición |
| Aviso de pedido nuevo (repartidor) | 4.5 | tarjeta en tinta con botón crítico "Aceptar" | cuenta atrás en anillo, distancia, artículos, cobro; rechazo discreto |
| Cobro en la entrega (repartidor) | 5.4 | panel del pedido en curso | medio de pago en tres botones de 56 px, monto recibido con teclado numérico grande, vuelto en grande, vacíos recibidos con +/−, botón crítico "Cobrado" |
| Jornada: abrir, pausa, cuadre | 5.1–5.5 | selector +/− por producto, a tamaño repartidor | carga declarada, kilometraje, espera de aprobación, pausa con motivo, cuadre |
| Aprobar salida y liquidar (dueño) | 5.2, 5.5 | tarjeta de cuadre de la portada | conteo por producto, descuadre con nota, total |
| Pedido telefónico (central) | 4.4 | diálogo de dos columnas (hoja en celular) | buscar por teléfono, "lo de siempre", dirección con pin, asignar al crear |
| Listas de la central: pedidos, repartidores, stock, catálogo, reportes | fases 3, 4 y 8 | tarjetas de radio 16 sobre `surface-soft`, tablas compactas | densidad a 14 px, filtros en chips, estados con chip |
| Panel de plataforma | fase 9 | igual que la central, con la marca de Hornilla | lista de distribuidoras, estado del plan, suspender |
| Instalación de la PWA | 7.1 | hoja con el símbolo | iconos de la app (el símbolo sobre fondo claro y sobre `band`, con margen para recorte) |

### Estados que toda pantalla necesita

| Estado | Patrón |
|---|---|
| Cargando | Esqueleto con la forma del contenido; nunca un giro a pantalla completa (`motion-system` §2). |
| Vacío | Balón o símbolo de un solo color en `muted-foreground` a 56–72 px, una frase que dice qué pasa y un botón con la salida. Ej.: "Todavía no llega ninguna distribuidora a esta dirección." + "Cambiar dirección". Sin ilustraciones nuevas. |
| Error | Tarjeta con icono `triangle-alert` en `state-danger-text`, qué falló en lenguaje llano y "Reintentar". Errores de campo: mensaje bajo el campo con icono, contorno `destructive`. |
| Sin conexión | Franja fija arriba, fondo tinta y texto claro: "Sin conexión. Mostrando lo último que se guardó." Los botones que necesitan red se deshabilitan y lo dicen. |
| Sin señal (posición vieja) | Marcador al 72 % con "hace N min", chip "Sin señal" y, en el seguimiento, la frase "Perdimos la señal de {nombre}. Última posición hace N min." en vez del tiempo estimado. Nunca se muestra como actual. |
| Distribuidora cerrada o suspendida | Chip neutro "Cerrado · abre a las 7:00 a. m."; catálogo visible, "Pedir" deshabilitado con el motivo. |
| Fuera de cobertura | En el pin: chip de alerta y la distancia; se ofrecen otras distribuidoras que sí llegan. |

## Decisiones de producto pendientes

1. **"Ventas del día" para el rol central.** El monitor muestra el indicador a quien entre. Si
   la central no debe ver dinero, el indicador (y "Caja y jornadas", "Reportes") se ocultan por
   rol y la fila queda en cinco. La regla de fondo va en las reglas de seguridad, no en la vista.
2. **Precio con y sin balón vacío.** La maqueta asume "Precios con tu balón vacío a cambio".
   Falta decidir si se vende el envase (primer balón), con qué precio y cómo se muestra.
3. **Precio del plan (D6).** La portada dice "Plan mensual fijo · precio por definir".
4. **Calificaciones.** La maqueta enseña estrellas y número de opiniones en buscador, página y
   seguimiento. Falta decidir desde cuántas opiniones se muestran y si se califica a la
   distribuidora, al repartidor o a ambos (paso 4.6).
5. **Sellos del buscador** ("Llega primero", "Mejor precio", "El más pedido", "Para negocio"):
   quién los calcula y con qué regla, o si se quitan en el piloto.
6. **Tiempo estimado antes de pedir** ("Llega en 15–25 min"): no hay todavía de dónde sale.
7. **Costo de reparto.** El resumen muestra "Reparto · Gratis"; las zonas con tarifa están fuera
   del MVP. Decidir si la línea se muestra u oculta.
8. **Logo subido por la distribuidora.** Sin Storage en el plan gratis: dónde se guarda, tamaño
   máximo y si en el piloto solo hay monograma.
9. **Foto de portada de la distribuidora.** Propuesta: elegir entre 4–6 fotos del banco.
10. **Colores de marca demasiado claros.** Propuesta de `ui-system` §6: rechazar los que den
    menos de 2:1 contra blanco. Confirmar el umbral y el texto del aviso.
11. **Marcas de gas de demostración** (Cumbregas, Brasa, Nevado, Solcito) y nombres de
    distribuidoras: comprobar que no coinciden con marcas registradas antes de usarlas en datos
    públicos de demostración.
12. **Pesos fuera de 10, 15 y 45 kg.** El balón tiene tres siluetas; falta decidir si hacen
    falta más (por ejemplo 5 kg).
13. **Umbral de espera** que pasa un pedido sin asignar de pausa a alerta: dato por distribuidora
    o fijo.
14. **"Abrir en Maps"** desde el repartidor: qué aplicación abre (elección del sistema o lista).
15. **Tema**: hoy sigue al sistema. Decidir si hay selector manual (y si el repartidor fuerza
    el claro de día).
16. **Proveedor de teselas** claro y oscuro que se parezca al mapa de la maqueta, gratuito y con
    licencia compatible con uso comercial. Mientras no se elija, teselas estándar de
    OpenStreetMap; en oscuro no hay todavía un equivalente sin costo decidido.

## Riesgos al construir

- **`text-primary` como texto.** La mandarina sobre blanco no llega a 3:1. Cualquier componente
  de shadcn que pinte texto con `text-primary` (variante `link` del botón, enlaces de algunos
  bloques) hay que envolverlo con `text-primary-text`.
- **Tamaños de shadcn.** Sus botones miden 32–36 px; los de Hornilla, 48 (72 el crítico). No se
  edita `components/ui/*`: se envuelve. Sin esa capa, las pantallas salen con aspecto de panel.
- **`cn` y los nombres propios.** Descarta clases `text-<nombre>` desconocidas al combinarlas
  con un color de texto. Los tamaños se escriben con la escala de Tailwind o entre corchetes.
- **Variables de marca.** `BrandTheme` debe escribir las ocho `--brand-*`; si falta alguna, ese
  token hereda la mandarina de Hornilla en vez de romperse, y el fallo pasa inadvertido. Test
  que lo compruebe.
- **Mapa real frente a maqueta.** La maqueta dibuja el mapa en SVG. Con teselas reales el
  contraste de la ruta y de los nombres cambia: revisar el borde de la ruta y los marcadores
  sobre el proveedor elegido, sobre todo en oscuro.
- **Logo pequeño.** A menos de 20 px los 14 dientes se empastan. Donde la maqueta lo usa a 18 px
  ("Pedidos y seguimiento con Hornilla"), en la app va a 20.
- **Fotos.** Pesan; cargar la de portada con prioridad y el resto en diferido, con `bg-muted`
  de fondo y dimensiones fijas para que no salte el contenido.
- **Oscuro y marcas oscuras.** En oscuro el relleno de una marca muy oscura se aclara (tinta
  `#1F2937` pasa a `#5B626C`): la distribuidora verá "otro color". Explicarlo en el alta.
