# Hornilla (glpWEB) — Plan maestro

> **Estado: APROBADO por el usuario el 2026-10-10.** Fases 0 y 1 cerradas; sigue la fase 2.

## Cómo usar este plan
- Es la única fuente de verdad. Lo que no está aquí va a "Ideas para después".
- Marcas: `[ ]` pendiente · `[x]` hecho + fecha · `[~]` a medias (anotar qué falta).
- Un paso está hecho cuando cumple sus criterios y pasaron los agentes de calidad que le tocan (§8).
- Si una decisión cambia, se cambia primero aquí (§11 "Registro de cambios") y después el código.

---

## 1. Visión

**Hornilla** (nombre comercial; `glpWEB` es el nombre interno del proyecto) es una plataforma única
donde la gente pide su gas a la distribuidora y marca que prefiera, y un SaaS para esas
distribuidoras de gas (GLP) en Perú. Cada distribuidora se da de alta
sola, configura su catálogo y su personal, recibe pedidos por la web/app y por teléfono, y ve en
un mapa en vivo dónde está cada repartidor. El cliente pide su balón y ve en tiempo real dónde
viene.

Una sola aplicación web, adaptativa (celular, tablet, escritorio) e instalable en el celular
como app (PWA). Todo debe funcionar con costo cero mientras sea piloto.

| Para quién | Promesa |
|---|---|
| Cliente | "Pide tu gas en 3 toques y mira dónde viene." |
| Repartidor | "Tus pedidos, la ruta y el cobro en una sola pantalla, con una mano." |
| Dueño / central | "Ve todos tus repartidores y pedidos en vivo; el cuadre de caja sale solo." |
| Plataforma (tú) | "Alta de distribuidoras sin intervención; control de planes y estado." |

## 2. De dónde sale (lo investigado)

| Proyecto | Qué es en realidad | Qué se reutiliza |
|---|---|---|
| `GLP-DEV` | 3 apps Flutter de demostración, offline en SQLite, para una sola empresa. Sin Firebase, sin GPS real, sin push. | **Todo el conocimiento del negocio**: estados del pedido, jornada del repartidor, aprobación de salida, cuadre de caja, stock de planta llenos/vacíos, pedido telefónico, KPIs, wireframes y casos de uso (`.agents/memory/*`, `docs/design/*`). |
| `glp2` | Solo login y registro (1 150 líneas). | Campos del registro peruano (DNI, teléfono, dirección + pin GPS). |
| `peluWeb` | SaaS multi-negocio (Laravel + React). | **La forma de trabajar**: `CLAUDE.md`, `docs/PLAN.md`, agentes de calidad y diseño, skills propias, proceso de diseño con maquetas y capturas, banco de fotos con licencia. |

Lecciones que se heredan como reglas:
- La lista de estados del pedido vive en **un solo archivo** (en GLP-DEV estaba repetida en 5 y causó doble asignación).
- Los modelos no se duplican entre apps (allá se desalinearon). Aquí hay una sola app y un solo `domain/`.
- Nada atado a una empresa: coordenadas de planta, teléfonos, marcas, pesos y límites son datos de cada distribuidora.
- El rol nunca lo decide el cliente (en glp2 lo decidía el APK instalado).

## 3. Roles

| Rol | Ámbito | Puede |
|---|---|---|
| **Super admin** | Plataforma | Ver/suspender distribuidoras, planes, métricas globales. Se concede solo por script, nunca desde la web. |
| **Dueño** | Su distribuidora | Todo lo de su distribuidora: perfil, catálogo, precios, personal, vehículos, aprobar salidas, liquidar caja, reportes. |
| **Central** (operador) | Su distribuidora | Pedidos telefónicos, asignar/reasignar, monitor en vivo. Sin acceso a caja ni precios. |
| **Repartidor** | Su distribuidora | Abrir jornada, aceptar y entregar pedidos, cobrar, pedir cierre. Publica su ubicación. |
| **Ayudante** | Su distribuidora | Solo existe como dato (acompaña al camión). No inicia sesión. |
| **Cliente** | Global | Pedir a cualquier distribuidora, seguir su pedido, calificar, repetir pedido. |

Una cuenta puede tener roles distintos en distribuidoras distintas (ej. dueño de una, cliente de otra).

## 4. Módulos del MVP

1. **Cuenta**: registro/login con correo o Google, perfil, direcciones con pin en el mapa.
2. **Alta de distribuidora** (autoservicio): nombre, enlace propio (`/d/mi-gas`), WhatsApp, ubicación de planta, radio de cobertura, color y logo. Queda en prueba gratis.
3. **Inicio del cliente (buscador)**: el cliente pone su ubicación y ve las distribuidoras y marcas
   que atienden su zona, con precios, tiempo estimado y calificación; elige y pide. Es la entrada
   principal de la plataforma.
3b. **Página pública de la distribuidora** (`/d/{slug}`): catálogo con precios, horario, botón
   "Pedir". Es el enlace que cada distribuidora comparte con sus propios clientes.
4. **Catálogo y precios**: marcas, pesos (10/15/45 kg u otros), activo/inactivo. Cada producto se
   vende de dos formas: **recarga** (el cliente entrega su balón vacío y paga solo el gas) y
   **balón completo** (gas más el envase, para quien se muda o se independiza), cada una con su precio.
4b. **Promociones**: cada distribuidora crea las suyas desde "Añadir promoción" (precio especial,
   porcentaje, "lleva 2 paga 1", balón completo al precio de la recarga…), con vigencia, condiciones
   y límite por pedido a la vista. El cliente las ve en el buscador, en la página de la distribuidora
   y en el resumen del pedido.
5. **Personal y vehículos**: invitar por enlace, roles, moto/camión con capacidad.
6. **Pedidos**:
   - del cliente (web/app) con límite de balones configurable,
   - telefónico desde la central (autocompletar por teléfono, "lo de siempre"),
   - estados `pendiente → asignado → en camino → llegó → entregado` / `cancelado`,
   - asignación: el repartidor libre **acepta** el pedido (el primero gana) o la central lo asigna a mano.
7. **Jornada del repartidor** (control anti-robo): declara carga y kilometraje → el dueño aprueba contando → reparte → cuadre → el dueño liquida.
8. **Cobro en la entrega**: efectivo / Yape / Plin (solo se registra; sin pasarela). Cálculo de vuelto.
9. **Stock de planta**: llenos y vacíos por producto; se mueve al aprobar salida y al liquidar.
10. **Tiempo real**:
    - cliente: mapa con su repartidor, ruta y tiempo estimado;
    - dueño/central: mapa con **todos** sus repartidores (libre, con pedido, en pausa) y la cola de pedidos;
    - super admin: mapa de todas las distribuidoras.
11. **Reportes**: ventas del día, tiempos de entrega, cuadres, exportar CSV.
12. **Panel de plataforma**: lista de distribuidoras, estado, prueba/plan, suspender.
13. **Instalable**: PWA en Android, iOS y escritorio; avisos push.

Fuera del MVP (ver "Ideas para después"): pasarela de pago, fiado/deudas, zonas con tarifa de
reparto, agrupamiento de pedidos por ruta, facturación electrónica, app nativa en tiendas.

## 5. Arquitectura

### 5.1 Stack (todo gratis, sin tarjeta)

| Capa | Elección | Por qué |
|---|---|---|
| App | **React 19 + TypeScript + Vite** (SPA) | Mismo frontend que peluWeb: se reaprovechan skills y oficio. |
| UI | **Tailwind 4 + shadcn/ui + Motion + lucide** | Igual que peluWeb. |
| Instalable | **PWA** (`vite-plugin-pwa`, Workbox) | Android, iOS y escritorio sin tiendas ni costos. |
| Cuentas | **Firebase Auth** (correo + Google) | Gratis. SMS no: exige plan de pago. |
| Datos | **Cloud Firestore** | Tiempo real, reglas de seguridad, transacciones. |
| Ubicación en vivo | **Firebase Realtime Database** | Firestore gratis solo da 20 000 escrituras/día; un repartidor enviando su posición cada 5 s gasta ~5 700 por jornada. RTDB no cobra por escritura. |
| Hosting | **Firebase Hosting** | Gratis, HTTPS, dominio `*.web.app`. |
| Mapas | **Leaflet + OpenStreetMap**, rutas con **OSRM** público, búsqueda de direcciones con Nominatim/Photon | Google Maps exige tarjeta. Detrás de una interfaz `MapProvider` para cambiar de proveedor sin tocar pantallas. |
| Push | **Firebase Cloud Messaging** (web push) | Gratis. Enviar requiere un servidor → ver D2. |
| Servidor mínimo | **Cloudflare Workers** plan gratis (sin tarjeta), solo desde la fase 7 | Cloud Functions exige plan de pago. Se usa únicamente para enviar push y tareas que ningún cliente debe hacer. |
| Imágenes | Logo y fotos reducidas a WebP en el navegador y guardadas en Firestore (≤ 150 KB) | Firebase Storage ya no es gratis en proyectos nuevos. |
| Pruebas | **Vitest**, **Firebase Emulator Suite** + `@firebase/rules-unit-testing`, **Playwright** | Las reglas de seguridad se prueban como código. |
| CI | GitHub Actions (repo privado) | Gratis. |

Sin servidor propio: **las reglas de seguridad de Firestore/RTDB son el backend**. Toda regla de
negocio que importe (aislamiento entre distribuidoras, transiciones de estado, precios
congelados, quién aprueba qué) se hace cumplir en reglas + transacciones y tiene test.

### 5.2 Límites reales del plan gratis (para no llevarse sorpresas)

| Recurso | Límite gratis | Qué significa |
|---|---|---|
| Firestore | 50 000 lecturas y 20 000 escrituras por día, 1 GB | Alcanza para un piloto de 2–5 distribuidoras pequeñas. Se diseña ahorrando lecturas (listas acotadas por día, sin escuchar colecciones enteras). |
| Realtime Database | 100 conexiones simultáneas, 1 GB, 10 GB/mes de descarga | La app solo se conecta a RTDB mientras hay un mapa abierto o un repartidor en jornada. |
| Hosting | 360 MB/día de transferencia | Sobra con caché de PWA. |
| OSM / OSRM / Nominatim públicos | Uso moderado | Bien para piloto; al crecer se cambia de proveedor (interfaz `MapProvider`). |

Al superar el piloto se pasa a Blaze (pago por uso, con la misma cuota gratis incluida). El
diseño no cambia.

### 5.3 Limitación importante: GPS con la pantalla apagada

Una PWA **no puede** seguir enviando la ubicación con la app en segundo plano o la pantalla
apagada (ni en Android ni en iPhone). En el MVP el repartidor lleva la app abierta durante el
reparto y la pantalla se mantiene encendida sola (Wake Lock). Si se queda sin señal o cierra la
app, el mapa lo muestra como "sin señal desde hace X min".

Solución definitiva (fase 11, también gratis): empaquetar la misma web con **Capacitor** para
generar un APK con seguimiento en segundo plano. No se reescribe nada.

### 5.4 Multi-distribuidora

Una sola base. Todo dato de negocio cuelga de su distribuidora:

```
/users/{uid}                              perfil global (nombre, teléfono, foto)
/users/{uid}/addresses/{id}               direcciones con punto en el mapa
/platformAdmins/{uid}                     super admins (solo por script)
/slugs/{slug}                             → distributorId (enlace único)
/distributors/{d}                         perfil, planta, cobertura, marca, estado, prueba
/distributors/{d}/members/{uid}           rol (owner|dispatcher|driver), activo
/distributors/{d}/invites/{token}         invitaciones de personal
/distributors/{d}/helpers/{id}            ayudantes (sin cuenta)
/distributors/{d}/vehicles/{id}           tipo, placa, capacidad
/distributors/{d}/products/{id}           marca, pesoKg, priceCents, activo
/distributors/{d}/plantStock/{productId}  llenos, vacíos
/distributors/{d}/customers/{id}          ficha del cliente en esa distribuidora (teléfono, "lo de siempre")
/distributors/{d}/orders/{id}             pedido (items con precio congelado, estado, tiempos, cobro)
/distributors/{d}/orders/{id}/history     bitácora de cambios de estado
/distributors/{d}/shifts/{id}             jornada (declarado, aprobado, devuelto, caja, km)
```

Realtime Database (solo posiciones):
```
/locations/{d}/{driverUid}     lat, lng, rumbo, velocidad, hora, estado  → lo lee el personal de {d}
/orderTracking/{orderId}       posición del repartidor de ese pedido     → lo lee solo su cliente
/staff/{d}/{uid}               espejo mínimo del rol para las reglas de RTDB
```

Reglas base:
- El rol se lee de `members/{uid}` **en las reglas**, nunca del cliente.
- Un test por colección demuestra que la distribuidora A no lee ni escribe lo de B.
- Distribuidora suspendida o con prueba vencida: solo lectura, hecho cumplir en reglas.
- Enlaces: público `/d/{slug}`; los paneles no llevan la distribuidora en la URL (se elige en un selector si la cuenta tiene varias).

### 5.5 Asignación de pedidos

- **MVP**: el pedido entra como `pendiente`. Lo ven los repartidores con jornada aprobada, sin
  pedido activo y con stock; **el primero que acepta se lo queda** (transacción: si otro ya lo
  tomó, falla). La central puede asignar o reasignar a mano con motivo.
- **Después**: asignación automática al más cercano (necesita el Worker, D2) y agrupamiento por ruta.

### 5.6 Estructura del código

```
src/
  domain/        lógica pura y tipos (estados, dinero, stock, ETA) — sin Firebase ni React
  data/          repositorios Firestore/RTDB (único lugar que importa firebase/*)
  features/      auth, onboarding, catalog, staff, orders, shifts, tracking, reports, platform
  pages/         public · customer · driver · office · platform
  components/    ui/ (shadcn) y por dominio
  lib/           mapas, formato, pwa, permisos
firebase/        firestore.rules, database.rules.json, índices, tests de reglas
worker/          Cloudflare Worker (fase 7)
tests/e2e/       Playwright
docs/            este plan, diseño, fotos con licencia
```

Convenciones: código en inglés, textos de interfaz en español neutro, dinero en céntimos enteros
(`S/ 38.00` solo al mostrar), fechas en UTC, zona horaria por distribuidora (`America/Lima`).

## 6. Diseño

- **Adaptativo de verdad**: cada pantalla se diseña a 390 px (celular) y 1440 px (escritorio), en claro y oscuro.
- Tres ambientes sobre una misma base, heredados de GLP-DEV:
  cliente (amable, luminoso) · repartidor (alto contraste, botones grandes, uso con una mano y al sol) · central/dueño (sobrio, denso, mapa protagonista).
- Cada distribuidora pone su **color de marca y logo**; el sistema garantiza contraste.
- Proceso (igual que peluWeb): `image-scout` consigue fotos con licencia → `design-director`
  propone 2–3 direcciones con maquetas y capturas reales → **tú eliges** → se escribe la spec
  (skill `ui-system`) → `frontend-builder` construye → `visual-designer` corrige con capturas →
  `ux-reviewer` opina.
- Prohibido: aspecto plano de panel genérico, paleta "chat de Claude", fotos sacadas de Google sin licencia.
- **Movimiento** (skill `motion-system`): la app nunca muestra una pantalla en blanco ni salta de
  golpe. Esqueletos con la forma del contenido al cargar, transición entre pantallas y entre pasos
  que indica de dónde vienes, listas que entran escalonadas, respuesta al toque, línea de tiempo
  del pedido animada, marcador que se desliza en el mapa, confirmaciones y errores con gesto
  propio. Las mismas pocas piezas en toda la app, rápidas en la pantalla del repartidor y
  apagables para quien tiene "reducir movimiento" activado.

## 7. Fases

Estimación: una persona con Claude, ~25 h/semana.

| Fase | Contenido | Semanas |
|---|---|---|
| 0 | Preparación | 0,5 |
| 1 | Dirección de diseño | 1 |
| 2 | Cuentas, distribuidoras y aislamiento | 1,5 |
| 3 | Catálogo, personal, vehículos, stock | 1 |
| 4 | Pedidos | 2 |
| 5 | Jornada, cobro y liquidación | 1,5 |
| 6 | Tiempo real y mapas | 1,5 |
| 7 | Instalable, sin conexión y push | 1 |
| 8 | Reportes | 1 |
| 9 | Panel de plataforma y planes | 1 |
| 10 | Lanzamiento | 0,5 |
| 11 | APK con Capacitor (opcional) | 1 |

### Fase 0 — Preparación
- [x] 0.1 Investigar proyectos previos y escribir este plan (2026-10-10)
- [x] 0.2 `CLAUDE.md`, agentes y skills propias en `.claude/` (2026-10-10)
- [x] 0.3 (2026-10-10) `git init`, `.gitignore`, repo en GitHub `paraZmol/glpweb` (**público** por decisión del usuario: nada sensible entra al repo)
- [x] 0.4 (2026-10-10) Proyecto Firebase `glpweb-app`: app web, Auth (correo + Google), Firestore (`southamerica-west1`), Realtime Database (`us-central1`) y Hosting. Reglas de ambas bases en denegar todo
- [x] 0.5 (2026-10-10) Esqueleto Vite + React + TS + Tailwind 4 + shadcn + router; lint, formato y tipos
- [x] 0.6 (2026-10-10) Emuladores de Firebase + primer test de reglas + Playwright (móvil y escritorio)
- [x] 0.7 (2026-10-10) Servidor MCP de Firebase en `.mcp.json`; skills oficiales instaladas: `firebase-firestore`, `firestore-rules-creation`, `firebase-security-rules-auditor`, `firebase-hosting-basics`, `firebase-auth-basics`, `shadcn`
- [x] 0.8 (2026-10-10) Página "en construcción" publicada en https://glpweb-app.web.app; CI en GitHub Actions en verde en su primera corrida
- *Criterio*: `npm run check` en verde, emuladores arrancan, URL pública responde.

### Fase 1 — Dirección de diseño
- [x] 1.1 (2026-10-10) `image-scout`: banco de 31 fotos con licencia libre y `CREDITS.md` en `docs/design/images/`. No hay foto libre de un balón ni de un repartidor de gas peruano: el balón es una ilustración SVG
- [x] 1.2 (2026-10-10) Tres propuestas maquetadas en `docs/design/propuestas/` (A Llama azul, B Cocina de casa, C En ruta) con página comparativa
- [x] 1.3 (2026-10-10) Elegida **B · Cocina de casa con el logo de A y modo oscuro**. Spec en la skill `ui-system`, tokens y fuentes en `src/index.css`, logo en `src/components/brand/`, lista por pantalla y decisiones de producto pendientes en `docs/design/DIRECCION.md`
- *Criterio*: dirección elegida por ti y escrita como spec.

### Fase 2 — Cuentas, distribuidoras y aislamiento
- [ ] 2.1 Registro/login (correo + Google), verificación de correo, perfil
- [ ] 2.2 Alta de distribuidora (slug único, prueba gratis, dueño)
- [ ] 2.3 Reglas: roles por `members`, aislamiento A/B, solo lectura si suspendida
- [ ] 2.4 Selector de distribuidora y navegación por rol (celular: barra inferior; escritorio: lateral)
- [ ] 2.4b Base de movimiento (incluye los tres ajustes que pide la dirección B: presión 0.9 del selector +/−, rebote del paso actual, pulso del marcador activo): fichas en `src/lib/motion.ts`, `PageTransition` en el enrutador, esqueletos, botón con carga, barra de navegación, avisos (`motion`, `sonner`)
- [ ] 2.4c Base de pruebas: semilla A/B con un usuario por rol, utilidades de varios actores, axe y presupuestos en el CI
- [ ] 2.5 Página pública `/d/{slug}`
- [ ] 2.6 Inicio del cliente: distribuidoras que atienden mi ubicación (cobertura = distancia a la planta ≤ radio), con marcas y precios. En el piloto se filtra en el navegador sobre la lista de distribuidoras activas (acotada); al crecer, índice por geohash
- [ ] 2.7 Páginas legales en la app a partir de los borradores de `docs/legal/` (términos, privacidad, cookies): enlaces en el pie y en el registro; el registro y el alta de distribuidora exigen aceptar los términos y guardan versión y fecha; aviso informativo de almacenamiento la primera vez. Se muestran marcadas como borrador hasta la revisión legal
- *Criterio*: tests de reglas prueban que A no toca nada de B; nadie puede darse un rol.

### Fase 3 — Catálogo, personal, vehículos, stock
- [x] 3.0 (2026-10-10; decisiones D1–D15 cerradas en el propio documento) `marketing-advisor`: cómo nombrar y presentar recarga y balón completo, qué tipos de promoción ofrecer y sus textos (`docs/marketing/oferta-y-promociones.md`)
- [ ] 3.1 Productos y precios: precio de recarga y precio de balón completo por producto
- [ ] 3.2 Invitaciones de personal y roles; ayudantes
- [ ] 3.3 Vehículos y capacidad
- [ ] 3.4 Stock de planta (llenos/vacíos, ajustes con motivo)
- [ ] 3.5 Promociones: "Añadir promoción" del dueño (tipo, productos, vigencia, límite por pedido, vista previa), cálculo en `src/domain/pricing/` y validación en reglas

### Fase 4 — Pedidos
- [ ] 4.1 Direcciones del cliente con pin y búsqueda
- [ ] 4.2 Pedido del cliente (límite de balones, cobertura, recarga o balón completo por línea, promoción aplicada, precios congelados)
- [ ] 4.3 Máquina de estados en `domain/` + reglas + bitácora
- [ ] 4.4 Pedido telefónico de la central
- [ ] 4.5 Aceptación por el repartidor (transacción) y asignación/reasignación manual
- [ ] 4.6 Cancelación con motivo; historial; "pedir lo mismo"; calificación
- *Criterio*: dos repartidores aceptando a la vez → solo uno gana (test); ninguna transición inválida pasa las reglas.

### Fase 5 — Jornada, cobro y liquidación
- [ ] 5.1 Abrir jornada: carga declarada, kilometraje, ayudante
- [ ] 5.2 Aprobación de salida (descuenta stock de planta en la misma transacción)
- [ ] 5.3 Pausa/reanudar
- [ ] 5.4 Cobro: efectivo/Yape/Plin, vuelto, comprobante
- [ ] 5.5 Cuadre del repartidor y liquidación del dueño (devueltos, vacíos, descuadre con nota)
- *Criterio*: el repartidor no puede aprobar ni cerrar su propia jornada; el stock siempre cuadra (test).

### Fase 6 — Tiempo real y mapas
- [ ] 6.1 Publicar ubicación del repartidor (RTDB, cada 5 s / 10 m con pedido; cada 30 s libre; Wake Lock)
- [ ] 6.2 Seguimiento del cliente: mapa, ruta, tiempo estimado, vista simple sin mapa
- [ ] 6.0 Prueba de mapa: MapLibre GL + OpenFreeMap (estilos claro y oscuro, sin clave) frente a Leaflet + OpenStreetMap; se queda el que se parezca a la maqueta y cargue bien en un celular modesto
- [ ] 6.3 Monitor de la central: todos los repartidores, cola, indicadores del día (las ventas y la caja solo las ve el dueño)
- [ ] 6.4 Navegación del repartidor (ruta, "Ya llegué", abrir en Google Maps/Waze)
- [ ] 6.5 "Sin señal": posición vieja se marca, nunca se muestra como actual
- *Criterio*: un cliente no puede leer la ubicación de un repartidor que no lleva su pedido (test).

### Fase 7 — Instalable, sin conexión y push
- [ ] 7.1 Manifest, iconos, pantalla de instalación (Android/iOS/escritorio)
- [ ] 7.2 Caché de la app y avisos de "sin conexión"
- [ ] 7.3 Worker de Cloudflare + FCM: pedido nuevo (repartidores), cambios de estado (cliente), salida por aprobar (dueño)
- [ ] 7.4 Sonido/vibración en primer plano

### Fase 8 — Reportes
- [ ] 8.1 Resumen del día y por rango; tiempos de entrega; por repartidor
- [ ] 8.2 Exportar CSV (pedidos, jornadas)

### Fase 9 — Plataforma y planes
- [ ] 9.1 Panel del super admin: distribuidoras, estado, mapa global
- [ ] 9.2 Planes y límites; activación manual (pago por Yape/transferencia)
- [ ] 9.3 Avisos de vencimiento

### Fase 10 — Lanzamiento
- [ ] 10.1 Auditoría completa (todos los agentes), corregir CRÍTICO/ALTO
- [ ] 10.2 Revisión por un profesional de `docs/legal/` (responsabilidad por promociones de las distribuidoras, frase sobre unidades, datos personales y ubicación, Libro de Reclamaciones), razón social y datos de contacto; datos de demostración
- [ ] 10.3 Dominio propio (opcional, único costo posible)

### Fase 11 — APK con Capacitor (opcional)
- [ ] 11.1 Empaquetado Android con ubicación en segundo plano

## 8. Proceso de calidad

| Agente | Cuándo | Qué hace |
|---|---|---|
| `backend-builder` | Datos, reglas, transacciones, Worker | Construye el lado Firebase. |
| `frontend-builder` | Pantallas | Construye sobre la spec de diseño. |
| `integrations-engineer` | Mapas, GPS, push, PWA, WhatsApp | Construye las conexiones externas. |
| `image-scout` | Antes de diseñar | Busca y descarga fotos con licencia. |
| `design-director` | Al definir o cambiar la dirección visual | Propone con maquetas; convierte la elegida en spec. |
| `visual-designer` | Después de cada pantalla | Mira capturas y corrige presentación. |
| `ux-reviewer` | Después del visual-designer | Solo opina (móvil, accesibilidad, textos). |
| `qa-tester` | Al terminar cada paso | Prueba por rol, móvil y escritorio. |
| `rules-breaker` | Cada vez que cambian reglas, pedidos, jornada o stock | Ataca las reglas y los invariantes; deja tests. |
| `security-auditor` | Al cerrar cada fase y antes de desplegar | Auditoría de solo lectura. |
| `flow-tester` | Cuando se toca el ciclo del pedido o la jornada | Cliente, repartidor, central y dueño a la vez; carreras; tiempo real. |
| `field-tester` | Cuando se toca ubicación, mapas, PWA o la pantalla del repartidor | Sin conexión, red lenta, GPS denegado o impreciso, segundo plano; lista de prueba en celular real. |
| `perf-a11y-auditor` | Pantalla importante, dependencia o animación nueva | Peso, velocidad, lecturas de Firestore, fluidez, accesibilidad. |
| `regression-guard` | Antes de unir cada rama a `main` | Batería completa desde cero, tests debilitados, criterios cubiertos. Da APTO / NO APTO. |
| `marketing-advisor` | Antes de diseñar productos, precios, promociones o textos de venta | Investiga y propone cómo nombrar, presentar y promocionar; vigila que las ofertas sean claras y honestas. |
| `publish-guard` | Antes de cada `git push` y cada despliegue | **Exclusivo**: que nada sensible llegue al repo público. Da PUBLICABLE / BLOQUEADO. |

Estrategia de pruebas completa en la skill `testing-strategy` (7 niveles, cobertura obligatoria,
presupuestos de rendimiento, qué corre cuándo).

Red automática para el repo público: `scripts/check-public.mjs` bloquea el commit (gancho de git)
y falla el CI si detecta correos, teléfonos, contraseñas, claves, archivos `.env` o de
credenciales, o rutas del equipo.

**Definición de terminado**: criterios del paso cumplidos, cada uno con su test · `npm run check`
en verde (guardián, formato, lint, tipos, tests unitarios y de reglas) · E2E del flujo en móvil y
escritorio · agentes aplicables sin hallazgos CRÍTICO/ALTO · `regression-guard` APTO y
`publish-guard` PUBLICABLE · paso marcado aquí con fecha.

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Sin servidor, un cliente modificado intenta saltarse reglas | Reglas estrictas con tests adversariales (`rules-breaker`); lo que no se pueda garantizar en reglas va al Worker. |
| Cuota gratis de Firestore | Consultas acotadas, posiciones en RTDB, panel de uso; pasar a Blaze al crecer. |
| GPS se corta con pantalla apagada | Wake Lock + estado "sin señal" + fase 11 (Capacitor). |
| Push en iPhone solo con la app instalada | Guía de instalación; respaldo por WhatsApp (`wa.me`). |
| Servicios públicos de mapas limitan el uso | Interfaz `MapProvider`; caché de rutas. |
| Yape/Plin no verificables | Igual que hoy en el negocio: lo confirma el repartidor; queda registrado. |

## 10. Decisiones abiertas

| # | Decisión | Supuesto actual | Responder antes de |
|---|---|---|---|
| D1 | ~~¿Página propia o buscador?~~ **Resuelta 2026-10-10**: plataforma única con buscador de distribuidoras cercanas como entrada principal, más la página propia de cada una. | — | — |
| D2 | ¿Aceptas usar Cloudflare Workers gratis como servidor mínimo para push? | Sí, desde la fase 7. | Fase 7 |
| D3 | "Ver dónde están todos mis distribuidores": ¿son los repartidores de cada dueño, o tú viendo todas las distribuidoras? | Ambos: monitor del dueño (fase 6) y mapa global del super admin (fase 9). | Fase 6 |
| D4 | Nombre comercial y dominio | **Hornilla** (elegido 2026-10-10). Sigue en `*.web.app`. | Fase 10 |
| D5 | ¿Proyecto Firebase nuevo o reutilizar `appglp2`? | Nuevo y limpio. | Fase 0.4 |
| D6 | Precios de los planes | Prueba 30 días; definir con estudio de mercado. | Fase 9 |

## 11. Registro de cambios

| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-10-10 | Plan inicial | — |
| 2026-10-10 | Plan aprobado; D2, D3 y D5 quedan con su supuesto (Worker sí, ambos mapas, proyecto nuevo `glpweb-app`) | Visto bueno del usuario |
| 2026-10-10 | shadcn/ui queda sobre Base UI (estilo `base-nova`), no Radix; lint con oxlint y formato con Prettier | Es el valor por defecto actual de shadcn |
| 2026-10-10 | Trabajo por ramas `fase-N/…`, `main` estable, etiqueta por fase (ver CLAUDE.md) | Pedido del usuario: ver las mejoras por separado y poder volver atrás |
| 2026-10-10 | Repo público en vez de privado | Decisión del usuario; regla de no subir nada personal ni secreto |
| 2026-10-10 | Se añaden 4 agentes de testeo (`flow-tester`, `field-tester`, `perf-a11y-auditor`, `regression-guard`), la skill `testing-strategy` y los pasos 2.4c | Pedido del usuario: evitar problemas después |
| 2026-10-10 | Se añade la skill `motion-system`, el punto de movimiento en §6 y el paso 2.4b | Pedido del usuario: cargas y transiciones coherentes |
| 2026-10-10 | Se añade el agente exclusivo `publish-guard` y el guardián automático `scripts/check-public.mjs` (gancho de commit + CI) | Pedido del usuario: el repo es público |
| 2026-10-10 | Nombre comercial **Hornilla**; D1 resuelta: buscador de distribuidoras como entrada principal (módulo 3, paso 2.6) | El usuario quiere una plataforma única donde la gente pida a distintas marcas |
| 2026-10-10 | Dirección visual: B · Cocina de casa, con el logo de A y modo oscuro | Elección del usuario |
| 2026-10-10 | Fuentes Gabarito y Figtree autoalojadas (`@fontsource-variable/*`); sale Geist | Son las de la dirección elegida |
| 2026-10-10 | Los nombres de distribuidoras y marcas de las maquetas se quedan como datos de demostración | Decisión del usuario: son el molde hasta tener datos reales |
| 2026-10-10 | Las maquetas quedan fuera del lint; sus capturas completas no se suben al repo | No son código de la app; pesan 80 MB y se regeneran |
| 2026-10-10 | La caja y las ventas las ve solo el dueño; la central no | Decisión del usuario: el dueño es quien hace el balance |
| 2026-10-10 | Dos formas de venta por producto: recarga y balón completo (gas + envase) | Decisión del usuario: hay quien se muda o se independiza y necesita el envase |
| 2026-10-10 | Promociones creadas por cada distribuidora (módulo 4b, pasos 3.0 y 3.5); nuevo agente `marketing-advisor` | Pedido del usuario |
| 2026-10-10 | Al dar de alta, se rechaza un color de marca que no se distinga del fondo (menos de 2:1) | Decisión del usuario: seguir al diseñador |
| 2026-10-10 | Mapa: primera opción MapLibre GL + OpenFreeMap, con Leaflet + OpenStreetMap de respaldo; se decide con la prueba 6.0 | El usuario lo dejó a criterio; las maquetas piden un fondo limpio en claro y oscuro |
| 2026-10-10 | Modelo de promociones cerrado: tipos `fixedPrice`, `percentOff`, `amountOff`, `buyXPayY`; tope total de unidades obligatorio en las dos más costosas; vigencia máxima 30 días | El usuario delegó las decisiones en la coordinación con `marketing-advisor`; el tope se adelanta para no lanzar "balón completo al precio del gas" sin límite |
| 2026-10-10 | Borradores de términos, privacidad y cookies en `docs/legal/`; paso 2.7 para llevarlos a la app. Los términos dicen que precios y promociones son responsabilidad de cada distribuidora y que Hornilla no responde por promociones engañosas | Pedido del usuario. Una cláusula no exime por sí sola: se revisa con un profesional en 10.2 |
| 2026-10-10 | Sin panel de consentimiento de cookies: solo aviso informativo, porque no hay analítica ni publicidad | Solo se usa almacenamiento necesario; si eso cambia, se pide consentimiento antes |
| 2026-10-10 | `npm audit` informativo en CI | Único hallazgo: `@grpc/grpc-js` vía `firebase` (solo build de Node, no llega al navegador) |

## Ideas para después
- Fiado y deudas por cliente; préstamo de envases.
- Zonas con tarifa de reparto y horarios de atención.
- Asignación automática al más cercano y agrupamiento de pedidos por ruta.
- Pasarela de pago, facturación electrónica.
- Publicación en Play Store / App Store.
- Validación de DNI.
