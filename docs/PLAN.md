# Hornilla (glpWEB) — Plan maestro

> **Estado: APROBADO por el usuario el 2026-10-10.** Fases 0 y 1 cerradas. Fase 2 construida y probada en la rama `fase-2/cuentas-y-distribuidoras`; de la tanda de correcciones 2.11 están hechos el lado de datos, reglas y herramientas, las pantallas y textos, y los cuatro huecos de datos que salieron al construir las pantallas (2026-10-11); faltan los agentes de calidad antes de cerrarla.

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
sola en minutos y se muestra al público tras una revisión de la plataforma; configura su catálogo
y su personal, recibe pedidos por la web/app y por teléfono, y ve en
un mapa en vivo dónde está cada repartidor. El cliente pide su balón y ve en tiempo real dónde
viene.

Una sola aplicación web, adaptativa (celular, tablet, escritorio) e instalable en el celular
como app (PWA). Todo debe funcionar con costo cero mientras sea piloto.

| Para quién | Promesa |
|---|---|
| Cliente | "Pide tu gas en 3 toques y mira dónde viene." |
| Repartidor | "Tus pedidos, la ruta y el cobro en una sola pantalla, con una mano." |
| Dueño / central | "Ve todos tus repartidores y pedidos en vivo; el cuadre de caja sale solo." |
| Plataforma (tú) | "Alta de distribuidoras en minutos, visibles tras una revisión; control de planes y estado." |

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
| **Super admin** | Plataforma | Ver, aprobar y suspender distribuidoras, planes, métricas globales. Se concede solo por script, nunca desde la web. |
| **Dueño** | Su distribuidora | Todo lo de su distribuidora: perfil, catálogo, precios, personal, vehículos, aprobar salidas, liquidar caja, reportes. |
| **Central** (operador) | Su distribuidora | Pedidos telefónicos, asignar/reasignar, monitor en vivo. Sin acceso a caja ni precios. |
| **Repartidor** | Su distribuidora | Abrir jornada, aceptar y entregar pedidos, cobrar, pedir cierre. Publica su ubicación. |
| **Ayudante** | Su distribuidora | Solo existe como dato (acompaña al camión). No inicia sesión. |
| **Cliente** | Global | Pedir a cualquier distribuidora, seguir su pedido, calificar, repetir pedido. |

Una cuenta puede tener roles distintos en distribuidoras distintas (ej. dueño de una, cliente de otra).

## 4. Módulos del MVP

1. **Cuenta**: registro/login con correo o Google, perfil, direcciones con pin en el mapa.
2. **Alta de distribuidora** (autoservicio): nombre, enlace propio (`/d/mi-gas`), WhatsApp, ubicación de planta, radio de cobertura, color y logo, más los datos que la plataforma revisa (RUC, razón social, número de ficha del Registro de Hidrocarburos; privados). Queda en prueba gratis y **en revisión**: aparece en el buscador y su página se ve cuando la plataforma la aprueba.
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
/users/{uid}/addresses/{a0..a9}           direcciones con punto en el mapa (10 casillas fijas: así las reglas imponen el tope)
/platformAdmins/{uid}                     super admins (solo por script)
/slugs/{slug}                             → distributorId (enlace único)
/distributors/{d}                         perfil PÚBLICO MIENTRAS ATIENDE PEDIDOS: nombre, slug, contacto, planta, cobertura, marca y `acceptingOrders` (puede operar y está aprobada). Sin estado de pago, fin de prueba ni cuenta fundadora. Si no atiende pedidos (sin aprobar, suspendida, prueba vencida) solo lo leen su personal y el super admin
/distributors/{d}/private/control         estado (trial|active|pastDue|suspended), fin de prueba, cuenta fundadora y aprobación de la ficha (`listingApproved`, `approvedAt`, `approvedBy`, `reviewNote`, y `correctedAt`: cuándo respondió su titular a esa nota), más copia del nombre y del enlace (`distributorName`, `slug`) para las listas de la plataforma: lo lee su personal y el super admin, y lo leen las reglas para decidir si se puede escribir y mostrar
/distributors/{d}/private/settings        datos de quien la fundó, plan y datos de verificación del negocio (RUC, razón social, registro de hidrocarburos): solo quien la fundó y el super admin
/distributors/{d}/members/{uid}           rol (owner|dispatcher|driver), activo, copia del nombre de la distribuidora
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
- Distribuidora sin aprobar, suspendida o con prueba vencida: su ficha no es legible para el público.
- Nada se guarda (perfil, consentimientos, direcciones) para una cuenta con el correo sin verificar.
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
- [~] 2.1 Registro/login (correo + Google), verificación de correo, perfil — (2026-10-10) lado de datos listo: repositorio de auth con errores de dominio, perfil y direcciones con reglas y tests (`src/data/auth-repo.ts`, `users-repo.ts`, `src/features/auth`). (2026-10-10) Pantallas construidas: `/ingresar`, `/registro`, `/restablecer`, `/verificar-correo`, `/aceptar-terminos` y `/cuenta` (`src/pages/public`, `src/pages/account`, `src/pages/customer`), con validación de formularios probada en `src/features/auth/auth-forms.ts`. **Falta verificación visual y E2E** (se construyeron sin navegador), direcciones del cliente (paso 4.1) y agentes de calidad. **Acción pendiente del usuario (consola de Firebase)**: el ingreso con Google por redirección (respaldo en celulares donde no abre la ventana emergente) falla en navegadores que bloquean almacenamiento de terceros mientras `authDomain` sea `glpweb-app.firebaseapp.com` y la app viva en `glpweb-app.web.app`; hay que usar el dominio de la app como `authDomain` y autorizar su URI de redirección en el cliente OAuth — (2026-10-10) verificadas con navegador a 390 y 1440, claro y oscuro; E2E del registro con las dos casillas hasta "verifica tu correo" (`tests/e2e/registration.spec.ts`). **Falta**: agentes de calidad y direcciones del cliente (4.1)
- [~] 2.2 Alta de distribuidora (slug único, prueba gratis, dueño) — (2026-10-10) lado de datos listo: transacción atómica distribuidora + slug + dueño + ajustes privados + tope por cuenta, con reglas y tests (`src/data/distributors-repo.ts`, `foundDistributor` en `src/features/tenancy`). **Falta**: pantalla de alta, E2E y agentes de calidad — (2026-10-10) **pantalla construida**: asistente de 4 pasos en `/distribuidora/nueva` (negocio y enlace con comprobación en vivo, planta y radio sin mapa, color con vista previa en claro y oscuro, revisar con las dos declaraciones), enlazado desde el inicio, la cabecera pública y `/cuenta`; al terminar lleva a `/central` con bienvenida y la lista "Completa tu distribuidora". E2E de principio a fin (`tests/e2e/found-distributor.spec.ts`). **Falta**: agentes de calidad; el mapa para marcar la planta (fase 6); logo (decisión 8 de `DIRECCION.md`); que el registro conserve el destino cuando quien llega desde "¿Tienes una distribuidora?" todavía no tiene cuenta
- [~] 2.3 Reglas: roles por `members`, aislamiento A/B, solo lectura si suspendida — (2026-10-10) reglas y 443 tests de reglas en verde para `users`, `addresses`, `platformAdmins`, `slugs`, `distributors`, `private/settings` y `members`. **Falta**: pasar `rules-breaker` y `security-auditor`
- [~] 2.4 Selector de distribuidora y navegación por rol (celular: barra inferior; escritorio: lateral) — (2026-10-10) construido: enrutador con un trozo de código por área (JS inicial 157 KB gzip), guardas como función pura con tests (`src/domain/auth/access.ts`: sesión → términos → correo verificado → rol), armazón con `data-ambient` y color de marca, barra inferior y lateral, selector de distribuidora, cabecera y pie públicos, 404, franja "sin conexión" e inicio mínimo de cada área (`/inicio`, `/pedidos`, `/reparto`, `/central`, `/plataforma`; `/app` lleva a cada cuenta a su área). **Falta verificación visual y E2E**, y agentes de calidad
- [~] 2.4b Base de movimiento (incluye los tres ajustes que pide la dirección B: presión 0.9 del selector +/−, rebote del paso actual, pulso del marcador activo): fichas en `src/lib/motion.ts`, `PageTransition` en el enrutador, esqueletos, botón con carga, barra de navegación, avisos (`motion`, `sonner`) — (2026-10-10) construido, con las fichas reflejadas como variables `--motion-*` en `src/index.css` y un test que las compara; piezas en `src/components/motion` y `src/components/common`. Los tres ajustes de la dirección B quedan como fichas y utilidades (`press-stepper`, `step-bounce`, `marker-pulse`) sin pantalla que los use todavía. **Falta verificación visual** (fluidez, movimiento reducido en un navegador real) y `perf-a11y-auditor`. Pendiente: que el escalonado no se repita al volver a una pantalla
- [~] 2.4c Base de pruebas: semilla A/B con un usuario por rol, utilidades de varios actores, axe y presupuestos en el CI — (2026-10-10) semilla determinista lista (`tests/seed/`, `npm run seed`) y tests de repositorio contra emulador dentro de `npm run check`. **Falta**: utilidades de varios actores para Playwright, axe y presupuestos en el CI
- [~] 2.5 Página pública `/d/{slug}` — (2026-10-10) datos listos: lectura pública por slug con reglas y tests (`useDistributorBySlug`). **Falta**: la página — (2026-10-10) **página construida** (`src/pages/public/distributor.tsx`): portada con el color de la distribuidora, quién vende, cobertura, horario y si atiende ahora, teléfono y WhatsApp, catálogo como estado vacío, aviso "no está recibiendo pedidos" sin motivo, 404 propia, título y descripción por distribuidora; tarjeta de producto con Recarga / Balón completo preparada (`src/components/catalog`) y sin uso hasta la fase 3. E2E en `tests/e2e/distributor-page.spec.ts`. **Falta**: agentes de calidad; mapa de cobertura (fase 6); foto de portada elegible (decisión 9); la hoja "Vas a comprar también el envase" (fase 3/4)
- [~] 2.6 (2026-10-10: datos listos — consulta pública acotada, cobertura y orden por distancia en `src/domain`, `useNearbyDistributors`; **falta** la pantalla) Inicio del cliente: distribuidoras que atienden mi ubicación (cobertura = distancia a la planta ≤ radio), con marcas y precios. En el piloto se filtra en el navegador sobre la lista de distribuidoras activas (acotada); al crecer, índice por geohash — (2026-10-10) **pantalla construida**: es `/` para todo el mundo y `/inicio` para el cliente con sesión. Ubicación sin mapa: "Usar mi ubicación" (permiso tras tocar, con explicación previa) o coordenadas escritas a mano; se recuerda en el dispositivo (`hornilla.lastLocation`) y se olvida al cerrar sesión. Lista por cercanía con esqueletos, vacío, error y sin conexión; en escritorio, el hueco del mapa. La búsqueda carga Firebase solo cuando hay un punto (JS inicial 180 KB gzip). E2E en `tests/e2e/finder.spec.ts`. **Falta**: agentes de calidad; declarar la clave nueva y el permiso de ubicación en `docs/legal/cookies.md` y `privacidad.md` (hoy dicen que la ubicación "todavía no se pide"); búsqueda por dirección (4.1) y mapa (6); filtros, calificaciones y tiempos de la maqueta (decisiones 4 a 6 de `DIRECCION.md`)
- [~] 2.7 (2026-10-10: lado de datos listo — el perfil y los ajustes privados de la distribuidora guardan versión y fecha de aceptación exigidas por reglas, `registerAccount`/`foundDistributor` exigen las casillas, `useUserProfile` avisa si falta aceptar y `acceptCurrentTerms` lo registra. 2026-10-10: construidas `/terminos`, `/privacidad` y `/cookies` a partir de `docs/legal/*.md` (lector propio sin HTML en `src/domain/legal/legal-markdown.ts`), con versión, fecha y franja "Borrador en revisión"; enlaces en el pie y en el registro; casilla sin marcar en el registro y en `/aceptar-terminos`; aviso informativo de almacenamiento. **Falta verificación visual y E2E**, la casilla del alta de distribuidora (paso 2.2) y decidir con `legal-compliance` la frase de `terminos.md` que dice que el texto no se publica en la aplicación hasta su revisión) Páginas legales en la app a partir de los borradores de `docs/legal/` (términos, privacidad, cookies): enlaces en el pie y en el registro; el registro y el alta de distribuidora exigen aceptar los términos y guardan versión y fecha; aviso informativo de almacenamiento la primera vez. Se muestran marcadas como borrador hasta la revisión legal
- [x] 2.8 (2026-10-10) Primera revisión de `legal-compliance`: documentos de `docs/legal/` corregidos para decir lo que la app hace hoy; hallazgos convertidos en los pasos 2.9 y 2.10
- [~] 2.9 Ajustes que pide la revisión legal (código) — (2026-10-10) **lado de datos listo**; faltan las pantallas, los textos, la CSP y los agentes de calidad:
  - [~] cerrar sesión borra la copia local de Firestore y la distribuidora recordada, también en otras pestañas y en cierres involuntarios — (2026-10-10) hecho: `endSession` y `restartApp` en `src/features/account/end-session.ts`, `useSignOut` ajustado, protocolo de borrado en `src/data/local-wipe.ts` (probado sin navegador) y `cookies.md`, `privacidad.md` §9 y `terminos.md` §10 al día. **Falta**: E2E del cierre con dos pestañas (caso entregado a `flow-tester`) y el texto de la pantalla de cuenta
  - [~] dos casillas en el registro (términos y edad; privacidad y uso de datos) y se guarda también la versión de privacidad aceptada (`privacy: { version, acceptedAt }`, con regla y test) — (2026-10-10) hecho en datos, reglas y validación de formularios (`acceptPrivacy`). **Falta la segunda casilla en `/registro` y `/aceptar-terminos`: mientras no esté, el formulario de registro actual no pasa la validación** — (2026-10-10) **hecho en pantalla**: `/registro` y `/aceptar-terminos` con las dos casillas y la versión
  - [~] en `/aceptar-terminos`: botón "No acepto: eliminar mi cuenta" y cuarta frase del resumen (el reclamo por una oferta es ante la distribuidora); bajo el botón de Google, qué datos entrega Google — (2026-10-10) operación lista: `discardUnacceptedAccount(uid)` en `src/features/auth/auth-actions.ts`; `Session` ya no expone la foto de Google. **Faltan el botón y los textos** — (2026-10-10) **hecho**: botón con confirmación, cuarta frase y línea bajo el botón de Google. La línea dice "nombre, correo y foto de perfil. La foto no la usamos" porque Google la sigue entregando a Firebase Auth aunque `Session` no la exponga; para no recibirla habría que borrarla tras el ingreso en `src/data/auth-repo.ts`
  - [~] ficha pública de la distribuidora sin estado de pago, fin de prueba ni identificador de cuenta — (2026-10-10) hecho: esos tres datos viven en `/distributors/{d}/private/control` y la ficha lleva solo `acceptingOrders`; tipos `PublicDistributor` (lo que ve cualquiera) y `Distributor` (lo que ve su personal). **Falta** el aviso "estos datos serán públicos" en el alta — (2026-10-10) aviso "serán públicos" **hecho** en el paso 4 del alta
  - [~] validar el color de marca en el dominio y en el alta (`checkBrandColor`) — (2026-10-10) conectado en `prepareNewDistributor` y `prepareProfilePatch`: `FieldIssue` con código `tooFaint` y `suggestion`. Las reglas no pueden calcular contraste: queda solo en el dominio (es estético, no de seguridad). **Falta** mostrar la sugerencia en el alta — (2026-10-10) **hecho**: el alta muestra el motivo y "Usar este tono"
  - [~] textos: franja de borrador, aviso de almacenamiento, "Hornilla no cobra tus pedidos", y que el registro solo prometa lo que ya funciona — (2026-10-10) **hecho** (pasa a `[~]` hasta la revisión de `legal-compliance`): franja, aviso compacto en celular, resumen de términos y tarjeta del registro con solo lo que ya funciona
  - [~] enlace "Contacto y reclamos" en el pie y en la cuenta — (2026-10-10) **hecho** (pendiente de revisión): `/contacto` lee el correo de `terminos.md` y, mientras siga entre corchetes, dice que el canal se publicará antes de abrir
  - [~] cabecera Content-Security-Policy en Hosting (con `security-auditor`) — (2026-10-11) añadida en `firebase.json` como `Content-Security-Policy-Report-Only`; pasa a obligatoria tras probarla en un canal de vista previa con el ingreso con Google (ver 2.11)
  - [x] (2026-10-10) pedidos por quien construyó las pantallas: el nombre de la distribuidora viaja en cada membresía (`members.distributorName`, sin lecturas extra en el selector) y `useCurrentDistributor` expone la membresía elegida mientras carga la distribuidora
- [~] 2.10 **Requisitos antes de registrar a una sola persona real** (piloto incluido): titular identificado y correo de contacto que funcione en `docs/legal/`; script local para eliminar o anonimizar una cuenta y otro para exportar sus datos; registro de solicitudes. Mientras no se cumpla, la app solo se usa con emuladores y datos de prueba — (2026-10-10) scripts listos y probados contra el emulador: `scripts/delete-account.mjs` y `scripts/export-account.mjs` (exigen `--project` y `--yes-real-project` para un proyecto real). **Falta**: titular y correo de contacto en `docs/legal/`, el registro de solicitudes (fuera del repo) y probar los scripts con credenciales reales el día que haga falta
- [~] 2.11 **Tanda de correcciones antes de cerrar la fase** (sale de `rules-breaker`, `security-auditor`, `legal-compliance` y `flow-tester`, 2026-10-10) — (2026-10-11) **lado de datos, reglas y herramientas hecho**; faltan las pantallas, los textos y los agentes de calidad:
  - [~] **Aprobación previa de distribuidoras** — (2026-10-11) hecho en dominio, reglas, repositorios, casos de uso y scripts: nacen sin listar (`listingApproved: false` en `private/control`, `acceptingOrders: false` en el alta); solo el super admin aprueba, y la aprobación va firmada (`approvedAt`, `approvedBy`); `acceptingOrders` solo puede escribirse igual a "puede operar **y** está aprobada"; sin aprobar, suspendida o con la prueba vencida, `/distributors/{d}` no es legible para el público (solo su personal activo y el super admin) y `/d/{slug}` responde "no encontrada"; cambiar nombre, teléfono o WhatsApp exige devolver la ficha a revisión en el mismo lote; el alta exige RUC (con dígito verificador en el dominio), razón social y número de ficha del Registro de Hidrocarburos, en `private/settings`, legibles solo por quien fundó y el super admin; operaciones de plataforma en `src/data/platform-repo.ts` y `src/features/platform` (altas pendientes, ficha de revisión, aprobar, devolver con nota, suspender, reactivar); `scripts/set-distributor-status.mjs`. El id de la distribuidora debe ser el que genera Firestore, y un titular con una distribuidora en solo lectura no puede fundar otra. **Falta**: campos de RUC, razón social y registro en el asistente del alta (`/distribuidora/nueva`), estado "en revisión" y nota en `/central`, pantalla de altas pendientes en `/plataforma`, y que ninguna pantalla diga "verificada". Sigue pendiente de confirmación del usuario: pedir RUC y registro — (2026-10-11) **pantallas hechas**: el paso "Negocio" del alta pide RUC (con el dígito verificador del dominio), razón social y número de ficha, con la nota de que no se publican; el paso de revisión dice qué pasa después; `/central` muestra el estado de la ficha (en revisión, cambios pedidos con la nota y la corrección de los tres datos por quien fundó, visible con su enlace y "Copiar enlace", sin operar); pantalla nueva `/central/ficha` para editar la ficha, que avisa antes de guardar cuando el cambio la devuelve a revisión y envía solo lo que cambió; `/plataforma` y `/plataforma/altas/:id` con las altas pendientes, la ficha de revisión y las decisiones Aprobar, Pedir cambios (nota obligatoria), Suspender y Reactivar, cada una con confirmación; `/d/{slug}` muestra a su personal la vista previa bajo la franja "Solo tú ves esta página". E2E en `tests/e2e/flows/listing-review.spec.ts`. **Falta**: agentes de calidad; que la lista de pendientes traiga el nombre de la distribuidora (hoy solo el documento de control: se ve fecha e identificador); una lista de todas las distribuidoras para llegar a una ya aprobada o suspendida sin su dirección (fase 9); saber si una cuenta tiene una distribuidora en solo lectura que no es la seleccionada — (2026-10-11) **cerrados los cuatro huecos de datos que encontraron las pantallas** (detalle y costos en §11): (1) el control lleva copia del nombre y del enlace, que las reglas solo aceptan iguales a la ficha pública (también al cambiar el nombre), y la lista de altas los muestra; (2) `/plataforma` tiene tres listas paginadas de 20 —en revisión, aprobadas y suspendidas (`?estado=aprobadas`, `?estado=suspendidas`)— con `usePlatformDistributors(filtro)`; (3) `useFoundingAvailability()` y `getFoundingAvailability(uid)` miran **todas** las distribuidoras que fundó la cuenta, no solo la seleccionada, y `/cuenta` y `/distribuidora/nueva` los usan; (4) al corregir con una nota pendiente, el control queda marcado con `correctedAt` y el estado pasa a `correctionsSent` ("Correcciones enviadas"): la nota sigue ahí, nada se aprueba y el super admin ve la fecha de la respuesta junto a su nota. Tests de reglas en `firebase/tests/platform-lists-and-corrections.rules.test.ts`, de repositorio en `src/data/platform-lists.emu.test.ts` y `src/features/tenancy/founding-availability.emu.test.ts`, y E2E en `listing-review.spec.ts` y `founding-limit.spec.ts`. **Falta**: pulido visual de las listas y del estado nuevo; agentes de calidad. **Las reglas no pueden garantizar** que la corrección marcada sea de fondo: solo que llega junto a una edición real de la ficha o de los datos de verificación, con hora del servidor
  - [~] **Correo verificado antes de guardar** — (2026-10-11) hecho: las reglas exigen correo verificado para crear o editar `users/{uid}` y sus direcciones; `registerAccount` crea solo la cuenta de inicio de sesión y envía la verificación; el perfil y los dos consentimientos se crean en `/aceptar-terminos` (`acceptLegalDocuments(uid, detalles?)`); el nombre y el celular del registro esperan en `sessionStorage` (`hornilla.pendingProfile`); guardas en orden sesión → correo verificado → términos → rol. **Falta**: que `/registro` deje de pedir las dos casillas (ya no registran nada) y que `/aceptar-terminos` muestre nombre y celular para confirmarlos (`suggestedProfileOf`) — (2026-10-11) **pantallas hechas**: `/registro` sin casillas, con la línea que dice dónde se aceptan los términos; `/aceptar-terminos` confirma nombre y celular y crea el perfil; `/verificar-correo` ofrece "No quiero continuar: eliminar mi cuenta"; una cuenta con perfil que no acepta una versión nueva va a `/contacto`
  - [x] (2026-10-11) **Compilación de pruebas aparte**: Playwright compila y sirve desde `dist-e2e-<carril>` (ignorada por git, prettier y lint); `firebase.json` lleva un `predeploy` que compila producción y ejecuta `scripts/check-dist.mjs`, que falla si `dist/` nombra el proyecto `demo-glpweb`, se conecta a `127.0.0.1` o trae sourcemaps (comprobado contra una compilación real de cada tipo)
  - [~] **App Check** — (2026-10-11) investigado, **no activado**; decisión pendiente del usuario. Respuesta: **sí puede usarse en el plan gratis sin tarjeta**, con reCAPTCHA Enterprise (hoy "Google Cloud Fraud Defense", nivel Essentials). Límites: 10 000 evaluaciones gratis por mes natural **por organización** (suma de todos los proyectos y sitios); sin cuenta de facturación, al pasar de 10 000 las evaluaciones devuelven error 429 hasta el día 1 del mes siguiente; en el plan Spark solo hay 4 niveles de puntuación (0.1, 0.3, 0.7 y 0.9) en lugar de 11; cada renovación del token de App Check gasta una evaluación, y por defecto se renueva dos veces por hora (vida del token configurable entre 30 minutos y 7 días). El proveedor reCAPTCHA v3 sigue existiendo, pero la documentación recomienda Enterprise para integraciones nuevas. **Riesgo que decide**: con App Check exigido ("enforced"), agotar la cuota deja a todos sin acceso a Firestore hasta el mes siguiente, y un atacante puede agotarla pidiendo tokens. Propuesta: activarlo primero solo en modo de medición (sin exigirlo), con vida del token de 1 día o más, y decidir con las métricas. Fuentes (consultadas 2026-10-11): firebase.google.com/pricing ("App Check: No-cost, subject to quotas and limits that vary based on attestation provider"; plan Spark: "No payment method needed"), firebase.google.com/docs/app-check (cuotas), firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider (niveles en Spark, renovación y vida del token), firebase.google.com/docs/app-check/web/recaptcha-provider (recomendación de Enterprise), cloud.google.com/recaptcha/docs/billing-information (nivel Essentials sin facturación y error 429 al pasar la cuota), cloud.google.com/recaptcha/docs/compare-tiers. Punto de enganche listo y apagado en `src/data/firebase.ts` (`VITE_APP_CHECK_SITE_KEY`; sin la variable el módulo ni se carga). **Falta**: decisión, alertas de uso y, si se activa, añadir los dominios de reCAPTCHA a la CSP y declararlo en `docs/legal/` (envía datos del dispositivo a Google)
  - [~] Defectos de `flow-tester` — (2026-10-11) corregidos los dos de datos: quien pierde la carrera por el tercer cupo recibe `DistributorLimitError` (`createDistributor` reconoce el tope tras el rechazo), con test de repositorio; `saveProfile` va por transacción con plazo de 8 s y lanza `OfflineError` sin dejar nada encolado, con su E2E ya sin `fixme`. **Faltan** (de pantalla): el registro pierde el destino "registrar mi distribuidora"; el reenvío de verificación sale habilitado justo tras registrar. El E2E de la carrera por el cupo sigue en `fixme` solo porque el asistente del alta aún no tiene los campos nuevos — (2026-10-11) **corregidos los dos de pantalla**: el destino viaja en el estado de navegación por el registro y los dos pasos pendientes (sobrevive a recargar la pestaña; no a abrir el enlace del correo en otra) y el reenvío queda en espera tras registrar. Los cinco `fixme` del alta y los dos del registro pasan
  - [~] Seguridad, menores — (2026-10-11) hecho: marca de borrado local antes de cerrar la sesión de Auth (se retira si el cierre falla) y barrido al arrancar sin sesión; `grant-platform-admin.mjs` con `readArguments` y `resolveTarget`; `--uid` y `--distributor` con patrón estricto en todos los scripts; `export-account.mjs` rechaza un `--out` dentro del repositorio; `private/settings` legible solo por quien fundó y el super admin; enlaces que contengan `hornilla` o `glpweb` reservados en dominio y reglas; acciones del CI fijadas por SHA (verificadas con `git ls-remote` contra los repositorios oficiales) y `firebase-tools` en versión exacta; el CI corre todos los recorridos con emuladores; la foto de Google se quita del perfil de la cuenta tras el ingreso; cabecera `Content-Security-Policy-Report-Only` en `firebase.json`. **Falta**: el punto de búsqueda con caducidad y 3 decimales (`src/lib/last-location.ts`, de pantalla); **la CSP pasa a obligatoria (`Content-Security-Policy`) después de probarla en un canal de vista previa con el ingreso con Google**; la copia de la foto que el servicio de inicio de sesión guarda entre los datos del proveedor no puede borrarse desde la app — (2026-10-11) el punto de búsqueda se guarda con 3 decimales y fecha, y se descarta a los 30 días (con sesión o sin ella: saber si hay sesión obligaría a cargar Firebase en el primer pintado)
  - [~] Textos: descripción de la página y titulares que prometen pedir y seguir el pedido; "30 días de prueba gratis" con lo que pasa después (pendiente de confirmación del usuario: sin cobro automático); aviso de almacenamiento que nombre el punto de búsqueda; "No acepto" con salida real cuando la cuenta ya tiene perfil; aviso de datos públicos del alta — (2026-10-11) **hechos** (pendientes de `legal-compliance`): descripción de la página, titular de la portada con el sello "En construcción" junto a él, título del registro, aviso de almacenamiento, texto de `/cuenta`, línea bajo el botón de Google, aviso de datos públicos y nota de la prueba en el alta, "Página en Hornilla" y "Reportar esta distribuidora" en `/d/{slug}`; `cookies.md` (sexta redacción) y `privacidad.md` al día con el punto de búsqueda y las salidas de "No acepto"
  - [~] Huecos de producto — (2026-10-11) cerrado en reglas y repositorio: un titular con una distribuidora suspendida, con pago pendiente o con la prueba vencida no puede fundar otra (`FoundingBlockedError`). **Falta**: que `/cuenta` no ofrezca registrar una distribuidora a quien llegó al tope o está bloqueado — (2026-10-11) **hecho**: `/cuenta` y `/distribuidora/nueva` no ofrecen el alta a quien llegó al tope o fundó una distribuidora en solo lectura (`foundingAvailabilityOf`), y `FoundingBlockedError` tiene su propio estado
  - [x] (2026-10-11) **Constancia de aceptación que sirva de prueba** (de `legal-compliance`, ALTO): versiones `0.2` con la regla "cada cambio de texto sube la versión" y su test de huellas; historial `users/{uid}/acceptances` atado al perfil por reglas; se renueva solo el texto pendiente; los scripts de borrado y exportación incluyen el historial (detalle en §11). **Queda para decidir**: las reglas aceptan cualquier versión de la lista, no solo la vigente; hoy cada lista tiene una sola, pero cuando haya dos una cuenta podría "aceptar" hoy la anterior (la app se lo volvería a pedir). Si la lista crece, separar "vigente" de "admitidas" en `firebase/firestore.rules`
  - [x] (2026-10-11) **Recorrido por roles, lo de datos**: la aprobación va atada a la versión de la ficha y de `private/settings` que el super admin tenía delante (`reviewedProfileAt`, `reviewedSettingsAt`, `StaleReviewError`); la ficha de revisión y los paneles de la central y del repartidor escuchan en vivo sus documentos (3 oyentes por pantalla, solo mientras está abierta). **Queda anotado**: sin conexión la ficha de revisión no muestra nada (espera al servidor); la lista de membresías no tiene oyente, así que una invitación aceptada en otro dispositivo o un rol nuevo en *otra* distribuidora no aparecen hasta recargar; un cambio de rol solo se nota en las áreas que escuchan (`/central`, `/reparto`), no en `/cuenta`
  - [x] (2026-10-12) **Auditoría de seguridad de cierre de la fase** (`security-auditor`, solo lectura): los tres hallazgos de reglas se reprodujeron con un test que fallaba (`firebase/tests/attack-review-integrity.rules.test.ts`) y se cerraron. **M1**: la dirección y la ubicación de la planta pasan a ser campos de identidad (cambiarlas devuelve la ficha a revisión, igual que nombre y teléfonos); `/central/ficha` avisa antes de guardar; términos y privacidad `0.3`. **B1**: "Correcciones enviadas" exige que el mismo lote cambie de verdad la ficha o `private/settings` (no vale mover solo `updatedAt` o el indicador), y reenviar los mismos datos de verificación no escribe nada (`NothingChangedError`). **B2**: el personal solo puede escribir `acceptingOrders` cuando cambia de valor, así que ya no puede dejar obsoleta una revisión abierta. **B3**: `grant-platform-admin.mjs --revoke` revoca además las sesiones, y la ventana que queda está medida y escrita (§9). Sin hacer, con motivo en §9: el intervalo mínimo entre ediciones. Anotados en §9: B4, B5 y el margen de la regla de la ficha frente al límite de 1 000 expresiones. Detalle y costes en §11. Mutación de reglas completa tras los cambios (238 mutantes): 201 matados, 33 equivalentes y 4 supervivientes, los cuatro anteriores a esta tanda (comprobado contra el árbol previo); uno era un hueco real de tests (`U09`: cambiar una distribuidora propia de la lista por una ajena y sana para saltarse el bloqueo de fundar otra — la regla lo impedía, ningún test lo defendía; test añadido) y tres son equivalentes y quedan anotados con su motivo (`H11`, `U11`, `D08`). Resultado: 0 supervivientes
  - [ ] **Sin cerrar, requiere decisión** (2026-10-11): (1) un riesgo de cuentas pendiente (ver §9; **debe cerrarse antes de 2.10**); (2) el tope de 3 se sigue pudiendo evadir creando cuentas nuevas: la revisión manual del RUC es el único freno; (3) el buscador devuelve "las primeras 50" por id de documento: al pasar de unas 50 distribuidoras aprobadas hace falta un índice por zona (geohash)
  - Después: `visual-designer` y `ux-reviewer` sobre las pantallas nuevas, `legal-compliance`, `rules-breaker`, `security-auditor`, `regression-guard`, `publish-guard`, subir la rama y unir a `main`
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
- [ ] 10.2b Antes de abrir al público: términos 1.0 revisados y reaceptación de todos; "Eliminar mi cuenta", cambio de correo y descarga de mis datos dentro de la app; Libro de Reclamaciones si aplica; comprobación de que cada distribuidora está autorizada para vender GLP, según indique el profesional
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
| `legal-compliance` | Registro, datos personales o de ubicación, promociones, permisos, dependencias que envían datos a terceros; al cerrar cada fase | Comprueba que la app hace lo que dicen los términos, la privacidad y las cookies; mantiene `docs/legal/`; prepara las preguntas para el abogado. No sustituye a un abogado. |
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
| Riesgo de cuentas pendiente (detalle fuera del repositorio) | **Abierto.** Debe cerrarse antes del paso 2.10; hasta entonces no se registra a ninguna persona real. |
| Una distribuidora falsa pasa la revisión, o una aprobada cambia de manos | La ficha solo se muestra tras la aprobación; cambiar nombre, teléfonos, dirección o ubicación de la planta la devuelve a revisión; suspender la oculta al instante. La revisión es manual y sobre datos declarados: no sustituye a comprobar el RUC y el registro en las fuentes oficiales. |
| App Check, si se exige, puede dejar a todos fuera al agotar la cuota gratis de reCAPTCHA | No activarlo exigido sin medir antes el consumo (ver 2.11). |
| Una ficha aprobada cambia su radio de reparto o su horario sin volver a revisión (riesgo **aceptado**, auditoría 2026-10-12) | Son ajustes rutinarios. El radio tiene tope en reglas y dominio: de 1 a 50 km (`MAX_COVERAGE_RADIUS_KM`), medido desde una planta que sí se revisa; con el máximo una distribuidora aparece como mucho a 50 km de donde fue aprobada. El horario solo cambia "atiende ahora". Nombre, teléfonos, dirección y planta sí devuelven la ficha a revisión. Si aparece abuso del radio: bajar el tope o pasarlo a campo de identidad. |
| Quitar el rol de super admin no corta lo que esa cuenta ya tenía abierto | `scripts/grant-platform-admin.mjs --revoke` borra `platformAdmins/{uid}` y revoca los tokens de la cuenta. **Medido contra el emulador el 2026-10-12** (`src/data/role-revocation.emu.test.ts`): toda petición nueva (leer, listar, decidir, abrir otro oyente) se rechaza al instante; el oyente de la ficha de revisión que ya estaba abierto **no se entera** —lo que mostraba sigue en pantalla— pero **no entrega nada más**: el primer cambio de un documento que escucha lo cierra con un rechazo. La sesión termina cuando intenta renovar su token (como mucho una hora). Falta confirmarlo contra el servicio real. Si esa hora importa: deshabilitar además la cuenta en la consola. |
| Abuso de la cuota gratis de escrituras desde una cuenta con sesión | **Pendiente** (2026-10-12). Un intervalo mínimo entre ediciones en las reglas se evaluó y se descartó: no protege la cuota y rompe flujos legítimos que escriben dos veces seguidas. La defensa es App Check (preparado, sin activar) o el Worker de la fase 7. |
| La regla de edición de la ficha pública está al borde del límite de 1 000 expresiones por evaluación | **Medido el 2026-10-12 contra el emulador**: la edición legítima más pesada (toda la ficha a la vez con 8 marcas, con vuelta a revisión) pasa, pero deja de pasar si se le añaden unas 10 comparaciones más (pasa con 8, falla con 12; antes de la auditoría pasaba con 8 y fallaba con 10: la auditoría no lo empeoró). El test `lets the owner edit the whole profile at once, eight brands included` lo vigila. El servicio real puede contar distinto que el emulador: **probarlo en el proyecto real antes del piloto**. Antes de añadir otra condición a esa regla (fase 3: catálogo, marcas): validar en `update` solo los campos que cambian, o sacar `brands` y `priceFromCents` a un documento propio. |
| El registro y el ingreso revelan qué correos tienen cuenta (auditoría 2026-10-12, B4) | Límite de Firebase Auth con correo y contraseña: "ese correo ya está en uso" al registrar. `/restablecer` ya responde igual haya o no cuenta. Para cerrarlo del todo: activar la protección contra enumeración de correos en la consola de Firebase (acción del usuario, gratis) y revisar entonces los mensajes del registro. |
| `npm audit` avisa de `@grpc/grpc-js` (auditoría 2026-10-12, B5) | Llega por `firebase` y solo se usa en Node (tests y scripts); el paquete del navegador no lo incluye, así que no es explotable en la app. **No usar `npm audit fix --force`**: cambiaría de versión mayor de `firebase`. Se actualiza con la siguiente versión de `firebase`. |

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
| 2026-10-10 | Nuevo agente `legal-compliance` y paso 2.8 | Pedido del usuario: evitar denuncias por términos, privacidad, cookies y promociones |
| 2026-10-10 | Los documentos legales siguen en 0.1 (segunda redacción): dicen lo que la app hace hoy, no lo que hará | Primera revisión de `legal-compliance`; subir el número exige un cambio coordinado de código y reglas |
| 2026-10-10 | No se registra a ninguna persona real hasta cumplir el paso 2.10 | Sin responsable identificado ni forma de eliminar una cuenta no se pueden atender los derechos que promete la política de privacidad |
| 2026-10-10 | Las pruebas con emuladores y navegador no se corren en el equipo del usuario mientras él lo esté usando; se verifican en el CI | Los emuladores de Firebase abrían ventanas que le quitaban el foco; arreglo en `scripts/emulators.mjs` pendiente de probar en Windows |
| 2026-10-10 | Las distribuidoras nuevas pasarán a requerir aprobación antes de aparecer en el buscador (paso 2.11); cambia la promesa de "alta sin intervención" de §1 | `security-auditor` y `legal-compliance`: hoy cualquiera puede suplantar a un negocio real y ocupar el buscador entero. El usuario fue avisado y no objetó; falta su confirmación sobre pedir RUC y registro |
| 2026-10-10 | Los recorridos de varios actores corren con 4 trabajadores | Con 8 la máquina se satura y aparecen tiempos de espera que no son fallos de la app |
| 2026-10-10 | `npm audit` informativo en CI | Único hallazgo: `@grpc/grpc-js` vía `firebase` (solo build de Node, no llega al navegador) |
| 2026-10-10 | Fase 2 (datos): el documento `/distributors/{d}` es **público entero** y lo privado (datos del dueño, plan) va en `/distributors/{d}/private/settings` | Las reglas no filtran campos; el buscador y `/d/{slug}` necesitan leer sin sesión |
| 2026-10-10 | Fase 2 (datos): direcciones del cliente en 10 casillas fijas (`a0`…`a9`) en vez de ids automáticos | Única forma de que las reglas impongan un tope sin servidor |
| 2026-10-10 | Fase 2 (datos): tope de 3 distribuidoras por cuenta, llevado en `users/{uid}.ownedDistributorIds` y comprobado por las reglas en el batch de alta; el perfil no se puede borrar | Evitar acaparar enlaces y ensuciar el buscador sin servidor |
| 2026-10-10 | Fase 2 (datos): `trialEndsAt` lo escribe el cliente y las reglas aceptan una ventana (más de 29 días y hasta 30 días + 1 hora desde la hora del servidor) | El cliente no puede escribir "hora del servidor + 30 días" |
| 2026-10-10 | Fase 2 (datos): un dueño ya no puede añadir miembros directamente; solo existe el alta del fundador en la transacción de creación. El personal entrará por invitación aceptada (fase 3) | Decisión del coordinador: un dueño hostil podía inscribir cuentas ajenas sin su consentimiento |
| 2026-10-10 | Fase 2 (datos): aceptación de términos con versión y fecha del servidor en `users/{uid}.terms` y en `private/settings` (`terms`, `authorityDeclaredAt`); versiones en `src/domain/legal/versions.ts`. Un perfil no existe sin aceptación: no se crea solo al entrar con Google | Requisito legal del paso 2.7 |
| 2026-10-10 | Carriles `E2E_LANE=N` para emuladores, tests y vista previa (`scripts/emulators.mjs`, `scripts/lane-ports.mjs`); el lanzador cierra sus emuladores al terminar | Trabajo en paralelo de agentes y emuladores huérfanos en Windows |
| 2026-10-10 | Fase 2 (pantallas): dependencias nuevas `motion` y `sonner`; Firebase se carga aparte del primer pintado (el JS inicial no lo incluye) | Presupuesto de 200 KB gzip; el paso 2.4b ya las preveía |
| 2026-10-10 | Fase 2 (pantallas): rutas en español (`/ingresar`, `/registro`, `/restablecer`, `/verificar-correo`, `/aceptar-terminos`, `/inicio`, `/pedidos`, `/cuenta`, `/reparto`, `/central`, `/plataforma`, `/terminos`, `/privacidad`, `/cookies`); `/app` reparte por rol. Orden de las guardas: sesión, términos, correo verificado, rol | Paso 2.4; todas las áreas con sesión exigen correo verificado |
| 2026-10-10 | Fase 2 (pantallas): los roles se muestran como "Titular", "Central" y "Reparto" | Texto sin género asumido (el plan los llama dueño, central y repartidor) |
| 2026-10-10 | Fase 2 (pantallas): la validación del color de marca (menos de 2:1) vive en `src/domain/brand/` junto a `deriveBrand`, no en `src/domain/tenancy/`; falta llamarla desde el alta de distribuidora | Es lógica de color, compartida con `BrandTheme` |
| 2026-10-10 | Fase 2 (pantallas): fichas nuevas en `src/index.css` (`--motion-*`, `--press-scale*`, `--cylinder-*`, `--top-inset`, `--bottom-nav-height`); falta reflejarlas en la skill `ui-system` | Movimiento por fichas y balón sin hex en el componente |
| 2026-10-10 | Fase 2 (pantallas): tests de pantalla sin navegador (`tests/support/render-static.tsx`: primer HTML con `react-dom/server`) y reglas de diseño como test (`src/design-rules.test.ts`) | Las pantallas se construyeron sin poder abrir un navegador; no sustituyen al E2E ni a la revisión visual |
| 2026-10-10 | Fase 2.9 (datos): la ficha pública `/distributors/{d}` deja de llevar `status`, `trialEndsAt` y `ownerUid`; pasan a `/distributors/{d}/private/control`, que leen el personal de esa distribuidora, el super admin y las reglas. La ficha lleva `acceptingOrders`, que solo se puede escribir igual a "el documento de control dice que hoy puede operar" | Revisión legal: una persona sin cuenta no debe poder averiguar el estado de pago, el fin de la prueba ni la cuenta fundadora. Sustituye la decisión "el documento es público entero" en lo que toca a esos tres campos |
| 2026-10-10 | Fase 2.9 (datos): nadie cambia `acceptingOrders` cuando vence una prueba (no hay servidor). Las reglas nunca confían en ese campo: siguen negando escrituras leyendo la fecha del documento de control. La ficha se corrige sola cuando alguien del personal abre el panel (o el super admin la toca); hasta entonces una distribuidora con la prueba vencida puede seguir en el buscador y rechazar el pedido | Es el desfase que queda sin servidor; se cierra del todo con un barrido periódico del Worker (fase 7) o del panel de plataforma (fase 9) |
| 2026-10-10 | Fase 2.9 (datos): la fecha de creación de la ficha sigue siendo pública (Firestore la entrega con cualquier documento legible), así que quien sepa que la prueba dura 30 días puede estimar cuándo terminaría; no puede saber si la distribuidora sigue en prueba, ya paga o está suspendida | Límite de la plataforma: no se puede ocultar sin servidor |
| 2026-10-10 | Fase 2.9 (datos): cada `members/{uid}` guarda `distributorName`; las reglas solo aceptan el nombre público vigente. Renombrar la distribuidora actualiza las copias en el mismo lote (hasta 100 miembros); quien quede fuera corrige la suya al abrir el panel | Pedido de pantallas: el selector no debe leer una distribuidora por cada membresía. Las invitaciones de la fase 3 deben escribir también ese campo |
| 2026-10-10 | Fase 2.9 (datos): dos consentimientos (`terms` y `privacy`) en `users/{uid}`; `acceptCurrentTerms` pasa a llamarse `acceptLegalDocuments` y registra ambos (el nombre antiguo sigue como alias) | Revisión legal |
| 2026-10-10 | Fase 2.9 (datos): cierre de sesión completo. Dos marcas en `localStorage` (`hornilla.localData`, `hornilla.pendingWipe`) y un Web Lock coordinan las pestañas; si la copia local no se puede borrar, se borra al siguiente arranque antes de abrir Firestore y, si sigue bloqueada, esa carga usa caché en memoria. `src/data/firebase.ts` usa `await` de nivel superior | Revisión legal: `cookies.md` prometía lo contrario de lo que pasaba. Borrar la base cierra Firestore en todas las pestañas, por eso hace falta coordinar |
| 2026-10-10 | `firebase-admin` entra como dependencia **de desarrollo** (no llega al navegador) | Los tests corren `delete-account.mjs` y `export-account.mjs` contra el emulador. `grant-platform-admin.mjs` sigue pudiendo copiarse a una carpeta privada |
| 2026-10-10 | `npm run lint` pasa `--disable-nested-config` a oxlint | Los árboles de trabajo de otros agentes bajo `.claude/worktrees/` traen su propia configuración y sus archivos se colaban en el lint del repo |
| 2026-10-10 | Fase 2 (pantallas): `/` deja de ser la página "en construcción" y pasa a ser el buscador, con o sin sesión; rutas nuevas `/d/:slug`, `/contacto` y `/distribuidora/nueva` | Pasos 2.2, 2.5, 2.6 y 2.9 |
| 2026-10-10 | Fase 2 (pantallas): mientras no haya mapa ni búsqueda de direcciones, la ubicación del cliente se da con el GPS del dispositivo o escribiendo las coordenadas; no se usa ningún servicio de terceros para convertir direcciones. El último punto se guarda en `localStorage` (`hornilla.lastLocation`) y se borra al cerrar sesión | Solución honesta y sin terceros hasta 4.1 y 6; un geocodificador externo habría enviado direcciones fuera y contradice `cookies.md` |
| 2026-10-10 | Fase 2 (pantallas): clase `.light` en `src/index.css` que fija el tema claro en un trozo de pantalla (igual que `.dark`); falta reflejarla en la skill `ui-system` | La vista previa del alta muestra la marca en claro y oscuro a la vez |
| 2026-10-10 | Fase 2 (pantallas): tipos mínimos de venta (`refill`, `full`) en `src/domain/catalog/sale-mode.ts` para la tarjeta de producto; el catálogo real de la fase 3 los sustituye o amplía | La tarjeta se deja preparada sin datos |
| 2026-10-10 | Cuenta de semilla nueva `fundadora@example.com` (sin membresías) y espera de 15 s en las comprobaciones de Playwright | El E2E del alta necesita una cuenta que pueda fundar sin alterar a las demás; al arrancar una corrida todos los navegadores cargan la app en frío a la vez |
| 2026-10-11 | Fase 2.11 (datos): **aprobación previa**. `private/control` lleva `listingApproved` (más `approvedAt`, `approvedBy` y `reviewNote`); `acceptingOrders` pasa a significar "puede operar y está aprobada" y solo puede escribirse con ese valor. Cambia la promesa de §1 | Suplantación y ocupación del buscador (`security-auditor`, `legal-compliance`) |
| 2026-10-11 | Fase 2.11 (datos): `/distributors/{d}` deja de ser de lectura pública sin condiciones: el público lo lee solo si `acceptingOrders == true`; su personal activo y el super admin, siempre. `/d/{slug}` de una ficha sin aprobar, suspendida o con prueba vencida responde "no encontrada" (antes mostraba la página con "no recibe pedidos"). Sustituye la decisión de 2.9 "la página sigue visible" | Las reglas no filtran campos: la única forma de no entregar teléfono ni WhatsApp es no entregar el documento. Costo: 0 lecturas extra para el público; 1 para el personal de una ficha no listada; 2 para el super admin |
| 2026-10-11 | Fase 2.11 (datos): cambiar nombre, teléfono o WhatsApp devuelve la ficha a revisión. Mecanismo: esa edición debe dejar `acceptingOrders: false` y, comprobado con `getAfter`, el control con `listingApproved: false` en el mismo lote; quien es dueño solo puede poner la aprobación en falso. Costo: 2 escrituras (más una lectura y una escritura por miembro si cambia el nombre) y 3 consultas de reglas por documento | Una ficha aprobada no puede convertirse en otro negocio de un día para otro |
| 2026-10-11 | Fase 2.11 (datos): el alta exige RUC (11 dígitos, prefijo conocido; el dígito verificador se valida en el dominio, no en reglas), razón social o nombre del titular (2 a 120) y número de ficha del Registro de Hidrocarburos (4 a 40; letras mayúsculas, números, espacio, punto, barra y guion: no se asume un formato). Viven en `private/settings`, que deja de leer un co-dueño. Se corrigen solo mientras la ficha no esté aprobada. Pendiente de confirmación del usuario | Dar a la revisión algo que comprobar; el RUC de una persona natural contiene su DNI, por eso no es público ni lo ve el resto del personal |
| 2026-10-11 | Fase 2.11 (datos): altas pendientes con una consulta `collectionGroup('private')` filtrada por `listingApproved == false`, ordenada por `createdAt` y con tope de 50, solo para el super admin; índice compuesto en `firestore.indexes.json` | No leer el control de todas las distribuidoras para encontrar las que esperan |
| 2026-10-11 | Fase 2.11 (datos): el id de una distribuidora debe tener la forma del que genera Firestore (20 letras o números), y una cuenta con una distribuidora en solo lectura no puede fundar otra (hasta 2 lecturas más en el lote del alta). **Al pasar de unas 50 distribuidoras aprobadas el buscador necesita un índice por zona (geohash)**: hoy devuelve las primeras 50 por id | Evitar ids elegidos para salir primero y la evasión de la suspensión con 30 días nuevos |
| 2026-10-11 | Fase 2.11 (datos): nada se guarda antes de verificar el correo. Las reglas lo exigen en `users/{uid}` y direcciones; el registro crea solo la cuenta de inicio de sesión (ni siquiera el nombre); el perfil y los consentimientos se crean en `/aceptar-terminos`. **Orden de las guardas: sesión, correo verificado, términos, rol** (sustituye el orden de 2.4). El nombre y el celular del registro se guardan mientras tanto en `sessionStorage` (`hornilla.pendingProfile`), solo en esa pestaña | Un perfil con términos aceptados solo debe existir para un correo que su titular demostró que es suyo |
| 2026-10-11 | Fase 2.11 (datos): `saveProfile` usa una transacción con plazo de 8 s (una lectura más por guardado) en vez de una escritura simple | Una escritura simple hecha sin conexión queda encolada y la pantalla espera sin respuesta; una transacción no se encola |
| 2026-10-11 | Fase 2.11: las compilaciones de prueba van a `dist-e2e-<carril>`; `dist/` es solo producción y `firebase deploy` la comprueba antes (`scripts/check-dist.mjs`). CSP en modo informe. CI con acciones fijadas por SHA, `firebase-tools@15.5.1` y todos los recorridos con emuladores (40 min de tope). Los tests de `tests/scripts` que no necesitan emulador corren con los unitarios | `security-auditor`: una compilación que apunta a emuladores podía desplegarse |
| 2026-10-11 | App Check: no se activa todavía; el punto de enganche queda apagado tras `VITE_APP_CHECK_SITE_KEY` | Funciona en el plan gratis, pero exigirlo sin medir el consumo puede dejar a todos fuera al agotar la cuota (ver 2.11) |
| 2026-10-11 | Fase 2.11 (pantallas): rutas nuevas `/central/ficha` (editar la ficha pública) y `/plataforma/altas/:distributorId` (revisar un alta) | Paso 2.11 |
| 2026-10-11 | Fase 2.11 (pantallas): el destino de quien se registra viaja en el estado de navegación (`destinationState`), no en la dirección ni en el almacenamiento | Las direcciones de los pasos pendientes quedan limpias y no hace falta declarar una clave nueva; se pierde si el correo se verifica en otra pestaña |
| 2026-10-11 | Fase 2.11 (pantallas): `hornilla.lastLocation` guarda 3 decimales y `savedAt`, y caduca a los 30 días también con sesión; un punto guardado con el formato anterior se descarta | `security-auditor`; decidir por sesión obligaría a cargar Firebase en el primer pintado |
| 2026-10-11 | Fase 2.11 (pantallas): el titular de la portada pasa a "Pide tu gas a quien llega a tu puerta." | "y míralo llegar" prometía un seguimiento que no existe; el sello "En construcción" va junto al titular |
| 2026-10-11 | Fase 2.11 (pantallas): "Pedir cambios" exige nota en la pantalla (el repositorio la admite vacía) | Devolver una ficha sin decir por qué deja a su titular adivinando |
| 2026-10-11 | Fase 2.11 (datos): `private/control` lleva copia del nombre y del enlace (`distributorName`, `slug`). Obligatorias en el alta; quien puede escribir el control solo puede escribirlas iguales a la ficha pública y nadie las quita; cambiar el nombre exige dejar la copia igual en el mismo lote. Opcionales solo para documentos anteriores, que las ganan en la siguiente decisión del super admin (una lectura más, solo para esos) | La lista de altas mostraba fecha e identificador. Leer la ficha de cada pendiente costaba hasta 50 lecturas más 100 de reglas por carga; así es una lectura por fila y ninguna consulta de reglas nueva (el `getAfter` de la ficha ya se hacía) |
| 2026-10-11 | Fase 2.11 (datos): listas de la plataforma por estado. La consulta `collectionGroup('private')` del super admin admite tres filtros: `listingApproved == false`, `listingApproved == true` y `status == 'suspended'`, siempre con tope de 50; páginas de 20 (la consulta pide 21 para saber si hay más), más antiguas primero; índice nuevo `status + createdAt`. **Cambia una decisión anterior**: el super admin ya puede listar controles filtrando por `status == 'suspended'` (antes rechazado por reglas). "Aprobadas" incluye las aprobadas que hoy no operan. Un filtro `listingApproved in [true, false]` también pasa: son dos de esas listas en una consulta acotada, nada que no pudiera leer ya | Sin lista no se llegaba a una distribuidora aprobada o suspendida más que por su dirección (adelanta lo mínimo de la fase 9) |
| 2026-10-11 | Fase 2.11 (datos): marca de corrección `correctedAt` en `private/control` y estado nuevo `correctionsSent`. Solo existe junto a `reviewNote`; solo la escribe quien es dueño, igual a `request.time`, y solo en un lote que también edita la ficha pública o `private/settings`; quien es dueño no puede quitarla ni tocar la nota; el super admin no puede escribirla, solo conservarla o quitarla, y debe quitarla al cambiar la nota o aprobar. Ninguna regla la lee para conceder nada. Costo: una consulta de reglas más (4 en vez de 3) cuando la corrección es de `private/settings` | El titular seguía viendo "Cambios pedidos" después de corregir. Borrar la nota habría quitado el rastro que el super admin necesita |
| 2026-10-11 | Fase 2.11 (datos): `updateDistributorProfile` lee antes el control (una lectura más por guardado de la ficha; una más de reglas si quien guarda no es quien fundó) y `updateVerificationData` pasa a transacción (una lectura más; no se encola sin conexión) | Saber si hay una nota pendiente para marcar la corrección en el mismo lote |
| 2026-10-11 | Fase 2.11 (datos): `useFoundingAvailability()` y `getFoundingAvailability(uid)` leen el control de cada distribuidora fundada (como mucho 2 lecturas: con 3 ya se sabe que llegó al tope; ninguna consulta de reglas, porque quien fundó lee su control). El hook no lee nada si la cuenta no fundó ninguna o si la única es la seleccionada. Un control que no se puede leer cuenta como bloqueo, igual que en las reglas | `founding-availability` solo conocía la distribuidora seleccionada |
| 2026-10-11 | Fase 2.11 (pantallas): `/plataforma` elige la lista con `?estado=aprobadas` o `?estado=suspendidas` (sin parámetro: en revisión) y lo conserva al abrir una ficha. `usePendingListings` se sustituye por `usePlatformDistributors(filtro)`; el aviso de "Guardamos tus datos" tras corregir pasa a ser un aviso flotante | El filtro en la dirección sobrevive a entrar y salir de una ficha en celular; el panel se vuelve a leer tras corregir y un aviso dentro de él se perdería |
| 2026-10-11 | **Regla: cada cambio de texto de un documento legal sube su versión.** Términos, privacidad y cookies pasan a la `0.2` (2026-10-11); la `0.1` deja de ser una versión aceptable en reglas y dominio (nadie real la aceptó; semilla y cuentas de prueba quedan al día). `src/domain/legal/text-editions.ts` guarda, por documento y versión, la fecha y la huella SHA-256 del `.md`; `text-editions.test.ts` falla si el texto cambia sin versión nueva, si la cabecera o el historial del `.md` no coinciden, o si las constantes no siguen a la última edición. Al cambiar un texto: versión nueva en la cabecera y en el historial del `.md`, edición nueva al final de la lista (nunca se edita una anterior), `TERMS_VERSION`/`PRIVACY_VERSION` y las listas de `firebase/firestore.rules` | Revisión legal (ALTO): la `0.1` cubría seis redacciones distintas, así que "aceptó la 0.1 el día X" no decía qué texto |
| 2026-10-11 | Fase 2.11 (datos): **historial de aceptaciones** en `users/{uid}/acceptances/{documento}-{versión}` (`document`, `version`, `acceptedAt` = hora del servidor). Solo lo crea su titular con correo verificado, en el mismo lote que la aceptación en el perfil; nadie lo edita ni lo borra desde la app; lo leen su titular y el super admin. Las reglas atan las dos mitades con `getAfter`: no se acepta en el perfil sin dejar la entrada, ni se crea una entrada sin aceptar en el perfil. Consecuencia: una versión ya aceptada no puede volver a fecharse. `acceptLegalDocuments` renueva solo el texto pendiente (antes reescribía también la fecha del otro) y pasa a transacción. Coste de aceptar: alta de cuenta 3 escrituras y 4 lecturas de reglas; renovar un texto 1 lectura + 2 escrituras y 2 lecturas de reglas; renovar los dos 1 lectura + 3 escrituras y 4 de reglas. `scripts/delete-account.mjs` borra el historial y `scripts/export-account.mjs` lo exporta. La aceptación de términos del alta de distribuidora sigue solo en `private/settings` | Revisión legal (ALTO): cada aceptación sobrescribía la anterior y no quedaba constancia de las versiones previas |
| 2026-10-11 | Fase 2.2 (pantallas): **cada paso del alta de distribuidora es una entrada del historial del navegador**. La entrada solo guarda qué corrida del asistente es y qué paso (`founding: { run, index }` en el estado de navegación); las respuestas viven en un borrador **en memoria** (`src/features/tenancy/founding-draft.ts`), por cuenta, que no se escribe en `localStorage`, `sessionStorage` ni en el historial: contiene RUC y celular, y así no hay nada que declarar en `docs/legal/cookies.md`. Atrás vuelve al paso anterior con lo escrito y Adelante avanza, pero nunca más allá del primer paso con algún problema; salir del asistente y volver por el historial conserva lo escrito. Al fundar, la central reemplaza la entrada del último paso y las entradas anteriores muestran "Tu distribuidora ya está creada." en vez de un asistente vacío. Recargar la pestaña sigue vaciando el alta (queda pendiente: exige decidir un almacenamiento y declararlo) | Recorrido por roles (ALTO): el botón Atrás del navegador, o el gesto atrás del celular, sacaba del asistente y perdía las once respuestas |
| 2026-10-11 | Fase 2.2 (pantallas): en el paso 1 del alta, "Continuar" espera la respuesta sobre el enlace (estado de carga en el botón) y un enlace ocupado no deja pasar del paso 1. Si la comprobación no se puede hacer (sin conexión) el paso sigue y decide la fundación, como antes | Recorrido por roles: un enlace ocupado se descubría al final |
| 2026-10-11 | Fase 2.7 (pantallas): el aviso de almacenamiento deja de ser una tarjeta flotante y pasa a ser **una franja en el flujo de la página**, arriba del marco de cada área (`RootLayout`), en `flame-soft`. Empuja la pantalla hacia abajo en vez de taparla; se va con "Entendido" igual que antes. `tests/e2e/flows/storage-notice.spec.ts` es el único E2E que no lo marca como leído: comprueba a 390 y 1440 que "Usar mi ubicación", "Guardar cambios" de la ficha, "Cerrar sesión" y el error de la nota de plataforma se pueden pulsar con el aviso abierto | Recorrido por roles (MEDIO): flotando tapaba controles en cuatro pantallas, y ningún test lo veía porque todos lo cerraban antes |
| 2026-10-11 | Fase 2.1 (pantallas): `requestPasswordReset` responde igual haya o no cuenta con ese correo (el "no existe" de Firebase se absorbe en `src/features/auth`); el registro rechaza una contraseña hecha solo de espacios (`isAcceptablePassword` en `src/domain/auth`); la página "no existe" ofrece "Ir a mi inicio" a quien tiene sesión; el contador de "Reenviar" de `/verificar-correo` sigue donde iba tras recargar (el estado de navegación lleva la hora del envío, `verificationSentAtMs`, en lugar de la marca `justRegistered`: mismo lugar, ningún almacenamiento nuevo) | Recorrido por roles: `/restablecer` distinguía los correos con cuenta; ocho espacios creaban una cuenta |
| 2026-10-11 | Fase 2.6 y 2.11 (pantallas): un solo analizador de coordenadas escritas (`parseCoordinate` en `src/domain/geo/coordinates.ts`): el buscador acepta la coma decimal igual que el alta ("-12,05; -77,04"). En `/plataforma`, una distribuidora abierta por su dirección que no está en la lista de la dirección lleva el panel a su propia lista (`platformListOf`), así título, entradilla y filas hablan de lo abierto; tras una decisión tomada ahí el panel no cambia de lista. El saludo de inicio no duplica el punto de un nombre que ya termina en punto | Recorrido por roles: redacción y detalles |
| 2026-10-11 | Fase 2.11 (datos): **la aprobación va atada a lo que el super admin vio**. `private/control` gana dos campos, `reviewedProfileAt` y `reviewedSettingsAt`: la marca `updatedAt` que tenían la ficha pública y `private/settings` cuando se revisaron. Las reglas solo aceptan una aprobación si las dos son iguales a las guardadas en ese momento (`get`, no `getAfter`: la propia aprobación mueve la marca de la ficha); toda escritura de la ficha o de settings ya debía dejar `updatedAt == request.time`, así que cualquier edición las invalida. Se escriben con la aprobación, se quitan con ella (volver a revisión las borra) y nadie las reescribe sin volver a firmar; opcionales solo en documentos aprobados antes de existir. `approveListing` recibe la versión vista, vuelve a leer ficha y settings dentro de la transacción y lanza `StaleReviewError` sin escribir nada. Coste: 2 lecturas más en la transacción (3 en total) y 2 consultas más de reglas al aprobar (`get` de la ficha y de settings; 7 en el lote) | Recorrido por roles (ALTO): con la ficha de revisión abierta, el titular cambiaba nombre y teléfono y "Aprobar" publicaba datos que nadie revisó |
| 2026-10-11 | Fase 2.11 (pantallas y datos): **la ficha de revisión y el panel de la central escuchan en vivo**, siempre documentos sueltos y solo con la pantalla abierta. `/plataforma/altas/{id}`: 3 oyentes (ficha, control, settings), solo datos confirmados por el servidor (nunca la copia local: sin conexión no muestra nada); 3 lecturas al abrir más hasta 4 de reglas, y una por documento que cambie. Los datos nuevos se muestran al momento, pero **verlos llegar no cuenta como haberlos revisado**: aparece "La ficha cambió mientras la revisabas. Revisa los datos nuevos antes de aprobar." y la aprobación sigue saliendo para la versión anterior (y se rechaza) hasta pulsar "Ya revisé los datos nuevos". `/central` y `/reparto` (`useLiveDistributor()` en el marco de cada área): 3 oyentes (ficha, control y el documento `members` propio); 3 lecturas al abrir más hasta 2 de reglas (una por la ficha mientras no es pública y otra por el control si la cuenta no es quien fundó), y una por documento que cambie; fuera de esas áreas `useCurrentDistributor()` sigue leyendo una sola vez y conserva lo último conocido. Una aprobación, una nota o una suspensión llegan al panel abierto sin recargar; si cambia el rol o se desactiva al miembro, se vuelven a leer las membresías (una lectura por membresía) y las guardas actúan. La lista de membresías y las listas de la plataforma siguen sin oyente | Recorrido por roles (MEDIO): el panel del titular decía "En revisión" tras la aprobación hasta recargar |
| 2026-10-11 | `/plataforma`: el paso a "su propia lista" de una distribuidora abierta por su dirección se decide una vez, al mostrarse; ni una decisión tomada ahí ni una edición del titular que llegue en vivo mueven al super admin a otra lista | Con la ficha en vivo, el cambio de estado llegaba antes de terminar la decisión y cambiaba la lista bajo quien revisa |
| 2026-10-12 | Fase 2 (pantallas y textos, ronda de `ux-reviewer`): la franja del aviso de almacenamiento mide 40 px en celular (texto corto "Guardamos solo lo necesario. Sin rastreo. Ver qué se guarda"; el texto largo queda desde `lg`) y la foto de la portada pasa de 4:3.7 a **4:3** en celular con la tarjeta "Entregar en" montada más arriba, para que "Usar mi ubicación" entre entera en la primera vista de 390×844 con la franja abierta (aserción en `storage-notice.spec.ts`). Los botones `size="sm"` conservan sus 40 px a la vista y ganan un área de toque invisible de 44 px. Alta, paso 1: el dato se llama "Número de registro de Osinergmin (Hidrocarburos)" ("Registro de Osinergmin" en la plataforma), con enlace a la consulta pública; la dirección es la misma constante que usa la plataforma (`src/lib/official-sources.ts`). Alta, paso 4: dos bloques (qué es público / "Qué pasa ahora" con las tres ideas de la revisión legal) y la planta se muestra por su dirección, sin coordenadas. "Ya está creada" nombra la distribuidora mientras la pestaña la recuerde. `/verificar-correo`, `/registro` y la confirmación de eliminar cuenta dicen qué sigue y que el mismo correo puede registrarse otra vez. Se retiran `forgetFoundingDraft` y `riseVariants`, sin uso. Recorrido del historial del alta (cambio de cuenta en la misma pestaña, salir a medias, tras fundar, recarga en el paso 3): sin datos de otra cuenta, sin paso inalcanzable y sin duplicados; quedan tres pruebas en `founding-history.spec.ts`. **Pendiente conocido**: tras fundar, una recarga borra la memoria de la pestaña y las entradas de ese registro vuelven a mostrar un paso 1 vacío en vez de "ya está creada" (misma causa que el borrador en memoria; no crea nada sin volver a llenar todo). Pendiente de pasar a la skill `ui-system` §14 la proporción 4:3 de la foto del inicio | Revisión de experiencia de uso: la franja empujaba la acción principal fuera de la primera vista, el nombre "ficha" no decía de qué documento sale el número, y el paso 4 repetía la prueba gratis en tres sitios |
| 2026-10-12 | Fase 2.11 (datos): **la dirección y la ubicación de la planta son campos de identidad** (`IDENTITY_FIELDS`: `name`, `contactPhone`, `whatsapp`, `addressLine`, `plant`). Cambiarlos en una ficha aprobada exige devolverla a revisión en el mismo lote; en una que todavía espera se guardan sin más. El radio de reparto y el horario siguen siendo ajustes sin revisión (riesgo aceptado en §9). **Cambia una decisión anterior** (2026-10-11: solo nombre, teléfono y WhatsApp). Sin lecturas de reglas nuevas | Auditoría de seguridad (MEDIO): una ficha aprobada podía escribir otro teléfono en su dirección o mover la planta a otra ciudad y aparecer en ese buscador sin que nadie lo viera |
| 2026-10-12 | Términos y privacidad pasan a la `0.3` (2026-10-12); la `0.2` deja de ser aceptable en reglas y dominio (nadie real la aceptó; semilla y cuentas de prueba quedan al día). Cookies sigue en `0.2` | Los dos textos decían qué cambios devuelven una ficha a revisión; regla "cada cambio de texto sube la versión" |
| 2026-10-12 | Fase 2.11 (datos): la marca de corrección (`correctedAt`) exige un cambio de contenido en el mismo lote: la ficha debe cambiar en algo más que `acceptingOrders` y `updatedAt`, o `private/settings` en algo más que `updatedAt`; y la distribuidora debe poder escribirse. Coste: marcar una corrección de la ficha pasa de 3 a 4 consultas de reglas (`get` de la ficha) y la de `private/settings` de 4 a 6 (`get` y `getAfter` de settings). `updateVerificationData` lee además `private/settings` (2 lecturas en vez de 1) y lanza `NothingChangedError` sin escribir si los tres datos son los guardados | Auditoría (BAJO): un lote que solo movía la fecha dejaba la ficha en "Correcciones enviadas" |
| 2026-10-12 | Fase 2.11 (datos): el personal (titular, central, repartidor) solo puede escribir `acceptingOrders` cuando el valor cambia de verdad; reescribirlo igual se rechaza. El super admin puede seguir escribiéndolo igual junto a su decisión (sus lotes lo envían siempre). Sin lecturas nuevas en lo permitido | Auditoría (BAJO): cada escritura mueve `updatedAt`, que es la versión que nombra una aprobación; cualquier repartidor podía dejar obsoleta la revisión en bucle |
| 2026-10-12 | `scripts/grant-platform-admin.mjs --revoke` revoca además los tokens de la cuenta (`revokeRefreshTokens`) y dice por pantalla qué queda abierto | Auditoría (BAJO): borrar el documento del rol no cerraba la sesión; la ventana medida está en §9 |
| 2026-10-12 | No se añade un intervalo mínimo entre ediciones de la ficha en las reglas | No protege la cuota y rompe flujos legítimos (motivos en §9) |
| 2026-10-12 | Arreglos de la segunda pasada de `role-walker` (2.11): toda confirmación de dos pasos pasa por una sola pieza (`ConfirmPanel`: se desplaza hasta quedar entera a la vista, toma el foco, sus respuestas van al borde opuesto e ignoran el puntero 600 ms); la ficha y la corrección de datos de una distribuidora en solo lectura se muestran deshabilitadas y sin guardar, también si la suspensión llega a medio editar; `/reparto` avisa de la suspensión; la lista y la ficha de `/plataforma` son una sola pantalla (se conserva lo cargado con "Cargar más" y, en celular, el desplazamiento al volver); el aviso "La ficha cambió" solo sale cuando cambian datos revisados (una suspensión de otra persona da un aviso propio y la aprobación no se rechaza por ello en pantalla); la bienvenida de la central se cierra y solo vive durante la primera revisión | USABLE con observaciones en la segunda pasada. Quedan fuera, a la espera de decidir sobre almacenamiento (`docs/legal/cookies.md`): recargar a mitad del alta y Atrás tras recargar la central recién creada |

## Ideas para después
- Fiado y deudas por cliente; préstamo de envases.
- Zonas con tarifa de reparto y horarios de atención.
- Asignación automática al más cercano y agrupamiento de pedidos por ruta.
- Pasarela de pago, facturación electrónica.
- Publicación en Play Store / App Store.
- Validación de DNI.
