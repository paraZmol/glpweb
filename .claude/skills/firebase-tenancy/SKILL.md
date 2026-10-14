---
name: firebase-tenancy
description: Cómo se usa Firebase en glpWEB sin servidor y gratis — estructura de datos por distribuidora en Firestore, roles por documento members, patrones de reglas de seguridad (aislamiento, transiciones, campos inmutables, solo lectura por suspensión), Realtime Database para posiciones, transacciones, ahorro de cuota Spark, emuladores y tests de reglas. Cargar ANTES de crear o cambiar colecciones, consultas, reglas de Firestore/RTDB, repositorios en src/data o el Worker.
---

# Firebase multi-distribuidora

## 1. Principio
No hay servidor: **el cliente es hostil por definición**. Cualquiera puede abrir la consola del
navegador y llamar al SDK con su sesión. Lo único que protege los datos son las reglas. Una
validación que solo está en React no existe.

## 2. Estructura
Ver `docs/PLAN.md` §5.4. Resumen: perfil global en `/users/{uid}`; todo lo de negocio en
`/distributors/{d}/…`; unicidad de enlace en `/slugs/{slug}`; super admins en
`/platformAdmins/{uid}` (solo se escribe con script local de Admin SDK, nunca desde la app).

IDs: automáticos de Firestore. Nunca usar datos personales (DNI, teléfono, correo) como ID.

## 3. Reglas — patrones obligatorios

```
function signedIn()            { return request.auth != null; }
function member(d)             { return get(/databases/$(database)/documents/distributors/$(d)/members/$(request.auth.uid)).data; }
function hasRole(d, roles)     { return signedIn() && member(d).active == true && member(d).role in roles; }
function isPlatformAdmin()     { return signedIn() && exists(/databases/$(database)/documents/platformAdmins/$(request.auth.uid)); }
function writable(d)           { return get(/databases/$(database)/documents/distributors/$(d)).data.status in ['trial','active']; }
function unchanged(fields)     { return !request.resource.data.diff(resource.data).affectedKeys().hasAny(fields); }
function onlyChanges(fields)   { return request.resource.data.diff(resource.data).affectedKeys().hasOnly(fields); }
```

- **Denegar por defecto**; abrir colección por colección, operación por operación
  (`get`, `list`, `create`, `update`, `delete` por separado).
- **Nadie se da un rol**: `members/{uid}` solo lo escribe un `owner` de esa distribuidora (o la
  aceptación de una invitación válida, que fija exactamente el rol de la invitación). El primer
  `owner` se crea en el mismo batch que la distribuidora, comprobado con `getAfter()`.
- **Updates con lista blanca**: cada transición usa `onlyChanges([...])` + condición sobre
  `resource.data.status` (estado anterior) y `request.resource.data.status` (nuevo).
- **Campos inmutables**: `distributorId`, `customerUid`, `items`, `totalCents`, `createdAt` con `unchanged`.
- **Validar tipos y rangos** en `create`: `is int`, `> 0`, tamaños de texto, `request.time` para marcas de tiempo.
- **Precios al crear pedido**: comparar cada item con `get(products/{id}).data.priceCents`
  (máximo de items acotado para no pasar el límite de 10 `get` por petición).
- **Listas**: las reglas deben poder probarse contra la consulta; toda consulta de cliente
  filtra por `customerUid == auth.uid`, toda de repartidor por `driverUid == auth.uid` o
  `status == 'pending'`.
- **Solo lectura por suspensión**: toda escritura de negocio exige `writable(d)`.
- Cada `get()`/`exists()` en reglas cuenta como lectura facturada: máximo los necesarios.

Lo que las reglas **no** pueden garantizar (unicidad compleja, agregados, enviar push, elegir al
repartidor más cercano) se anota como riesgo y va al Worker (`worker/`, verifica el ID token).

## 4. Realtime Database (solo posiciones)
- `/locations/{d}/{driverUid}`: escribe solo ese repartidor; lee el personal de `d`
  (según `/staff/{d}/{uid}`, espejo del rol que escribe el dueño junto con `members`).
- `/orderTracking/{orderId}`: escribe el repartidor asignado; lee solo `customerUid` guardado ahí.
  Se borra al entregar o cancelar.
- Validar en reglas: lat/lng numéricos en rango, `ts <= now`, sin campos extra.
- `onDisconnect()` marca al repartidor como desconectado.
- Conectar RTDB (`goOnline`) solo con mapa abierto o jornada activa; `goOffline` al salir
  (límite gratis: 100 conexiones simultáneas).

## 5. Transacciones
- Más de un documento → `runTransaction` o `writeBatch`. Orden fijo de lectura:
  distribuidora → jornada → stock → pedido.
- Aceptar pedido: leer pedido (debe seguir `pending`) y jornada dentro de la transacción.
- Las transacciones no funcionan sin conexión: esas acciones se bloquean con aviso, no se encolan.

## 6. Cuota gratis (Spark): 50 000 lecturas, 20 000 escrituras por día
- Toda consulta con `where` + `limit`. Paneles: solo pedidos `ALIVE` y los de hoy.
- Listeners (`onSnapshot`) solo en lo que cambia en vivo; lo demás `getDocs` con caché.
- Persistencia local de Firestore activada (menos lecturas al reabrir).
- Sin contadores que escriban en cada evento; los indicadores del día se calculan de la lista ya cargada.
- Historial paginado. Nunca descargar todo para filtrar en el cliente.

## 7. Código
- Solo `src/data/` importa `firebase/*`. Un repositorio por agregado (`ordersRepo`, `shiftsRepo`…)
  con funciones tipadas; convertidores (`withConverter`) que validan y dan valores por defecto.
- Rutas de colecciones en un solo archivo (`src/data/paths.ts`).
- En desarrollo y tests, conectar a emuladores (`connectFirestoreEmulator`, etc.) por variable de entorno.

## 8. Tests de reglas (obligatorios)
`firebase/tests/*.rules.test.ts` con `@firebase/rules-unit-testing` contra el emulador.
Por cada colección: quién puede y **quién no** (anónimo, cliente, repartidor de otra
distribuidora, dueño de otra distribuidora, distribuidora suspendida). Por cada transición del
skill `glp-domain`: la válida pasa, las inválidas fallan. Un cambio de reglas sin test no se acepta.

## 9. Desplegar
`firebase deploy --only firestore:rules,database,hosting` es una acción hacia afuera: confirmar
con el usuario. Nunca desplegar reglas con tests en rojo. Índices en `firestore.indexes.json`.

## 10. Decisiones posteriores (al día: 2026-10-12, ingreso solo con Google incluido)
Cuando esta sección y los §2–§3 chocan, manda esta. La fuente exacta es la cabecera de
`firebase/firestore.rules` (modelo de datos campo por campo) y `docs/PLAN.md` §11.

### 10.1 Tres documentos por distribuidora
- **`/distributors/{d}` — ficha pública mínima.** Solo lo que el cliente necesita, más
  `acceptingOrders`. Sin estado de pago, fin de prueba ni cuenta fundadora.
- **`/distributors/{d}/private/control` — dónde está con la plataforma.** `ownerUid`, `status`,
  `trialEndsAt`, la aprobación (`listingApproved`, `approvedAt`, `approvedBy`), la nota de
  revisión (`reviewNote`), la marca de corrección (`correctedAt`) y copia del nombre y del enlace
  (`distributorName`, `slug`). Lo lee su personal activo y el super admin. **Es el documento que
  leen las reglas**: `writable(d)` y `foundedNow(d)` leen el control, no la ficha (el §3 muestra
  la forma antigua).
- **`/distributors/{d}/private/settings` — datos de quien fundó y de verificación** (RUC, razón
  social, registro de hidrocarburos). Solo quien fundó y el super admin: ni un co-dueño.

### 10.2 Aprobación previa (PLAN 2.11)
- Una distribuidora **nace sin listar**: `listingApproved: false` y `acceptingOrders: false`.
- **Solo el super admin aprueba**, y la aprobación va firmada: `approvedAt == request.time` y
  `approvedBy == request.auth.uid`. Quien es dueño solo puede poner `listingApproved` en `false`.
- **`acceptingOrders` es derivado**: solo puede escribirse igual a "puede operar **y** está
  aprobada" (`isOpenData(control)`), comprobado con `getAfter` en los dos sentidos: quien cambia
  el control debe dejar la ficha de acuerdo en el mismo lote. Nunca se usa para autorizar una
  escritura; puede quedar desfasado cuando vence una prueba y lo corrige quien abre el panel.
  **El personal solo puede escribirlo cuando cambia de valor** (`flipsTheFlag`): reescribirlo
  igual movería `updatedAt`, la versión que nombra una aprobación, y cualquier repartidor podría
  dejar obsoleta una revisión abierta. El super admin sí puede, junto a su decisión.
- **Lectura pública de la ficha**: `allow get` solo si `acceptingOrders == true` (o el documento
  no existe). Sin aprobar, suspendida o con la prueba vencida solo la leen su personal activo y
  el super admin; `/d/{slug}` responde "no encontrada". Las reglas no filtran campos: la única
  forma de no entregar teléfono ni WhatsApp es no entregar el documento. `allow list` exige
  `where('acceptingOrders', '==', true)` y `limit <= 50`.
- **Cambiar nombre, teléfono, WhatsApp, dirección o ubicación de la planta devuelve la ficha a
  revisión** (`IDENTITY_FIELDS` en `src/domain/tenancy/listing.ts`, misma lista en
  `changesIdentity()`): esa edición debe dejar `acceptingOrders: false` y, con `getAfter`, el
  control con `listingApproved: false`. Si cambia el nombre, además `control.distributorName`
  igual al nombre nuevo. El radio de reparto (tope 50 km) y el horario no: son ajustes
  rutinarios (riesgo aceptado, PLAN §9).
- **Nota y corrección.** El super admin devuelve una ficha con `reviewNote`. Cuando quien es
  dueño corrige (ficha pública o `private/settings`), el mismo lote marca
  `correctedAt == request.time`. **La marca exige un cambio de contenido en ese lote**
  (`corrects()`: compara `getAfter` con `get`): la ficha en algo más que `acceptingOrders` y
  `updatedAt`, o settings en algo más que `updatedAt`; mover solo la fecha no corrige nada.
  Coste: 4 consultas de reglas si la corrección está en la ficha, 6 si está en settings. La
  marca solo existe junto a una nota, quien es dueño no puede
  quitarla ni tocar la nota, el super admin no puede escribirla y debe quitarla al cambiar la
  nota o aprobar. **No concede nada**: ninguna regla la lee. Estados para las pantallas
  (`listingStateOf`): `inReview`, `changesRequested`, `correctionsSent`, `listed`,
  `notOperating`.
- **Copias en el control** (`distributorName`, `slug`): obligatorias en el alta, solo se
  escriben iguales a la ficha pública, nadie las quita; opcionales al leer documentos
  anteriores. Mismo patrón que `members.distributorName`: una copia solo se acepta si es verdad
  comprobada con `getAfter`.
- **Listas del super admin**: consulta `collectionGroup('private')` con tope de 50 y uno de tres
  filtros (`listingApproved == false`, `listingApproved == true`, `status == 'suspended'`). Los
  documentos `settings` no tienen esos campos, así que nunca salen. Paginadas de 20.
- **Fundar otra**: tope de 3 por cuenta (`users.ownedDistributorIds`) y ninguna de las que ya
  fundó en solo lectura (hasta 2 `get` más en el lote del alta). El id debe tener la forma del que
  genera Firestore (20 letras o números).

### 10.3 Ingreso solo con Google y orden de las guardas
**El ingreso es solo con Google** (PLAN §11, 2026-10-12): no hay registro ni ingreso con correo
y contraseña, ni verificación de correo, ni restablecimiento. La cuenta se crea en el primer
ingreso; el perfil, al aceptar los términos. `src/data/auth-repo.ts` no crea cuentas ni envía
correos.

- **Guardas**: **sesión → correo confirmado → términos → rol** (`src/domain/auth/access.ts`).
  Google entrega el correo confirmado, así que una sesión sin él no debería existir: no es un
  paso que completar, `decideAccess` responde `unconfirmedEmail` y la pantalla solo ofrece
  cerrar sesión.
- **Reglas** (PLAN §11, 2026-10-14): **toda lectura y escritura de datos propios exige una
  sesión de Google con correo verificado**. `signedInWithGoogle()` — sesión, correo verificado
  **y** `request.auth.token.firebase.sign_in_provider == 'google.com'` — va dentro de `isSelf()`,
  `hasRole()` (y con ello `isStaff()`) e `isPlatformAdmin()`, y abre las reglas que no pasan por
  ellas: crear enlace, distribuidora, control y ajustes privados; leer el control y los ajustes
  por `ownerUid`; editar los ajustes; actualizar un miembro; "mis membresías". `emailVerified()`
  ya no existe. Solo quedan sin sesión las lecturas públicas (ficha con `acceptingOrders`,
  enlace, búsqueda). Ninguna lectura de reglas nueva. **Toda colección nueva** se abre con
  `isSelf()`, `hasRole()`/`isStaff()` o `isPlatformAdmin()`; si una regla necesita otra forma,
  empieza por `signedInWithGoogle()`. Tests: `firebase/tests/google-session-only.rules.test.ts`
  (cada caso con Google pasa y con contraseña, anónima, token propio o sin correo verificado,
  sobre la misma cuenta, falla): una colección nueva añade ahí sus casos.
- **Tests de reglas**: `verified(env, uid)` de `firebase/tests/helpers.ts` ya es una sesión de
  Google; `unverified` también (solo cambia el correo); `verifiedThrough(env, uid, proveedor)`
  es la sesión hostil con otro proveedor y `signedInAnonymously(env, uid)` la anónima.
  `authenticatedContext(uid)` a secas lleva `sign_in_provider: 'custom'`: no lee ni escribe
  nada propio.
- **Tests de repositorio y de navegador**: abren sesión como una identidad de Google que el
  emulador de Auth simula (`src/data/emulated-google.ts`, que se niega a funcionar fuera del
  emulador). Repositorio: `signInAs`/`signInAsNewcomer` de `tests/support/emulated-session.ts`.
  Navegador: `signInAs`/`signInHere` de `tests/e2e/support/sign-in.ts`, a través de
  `window.hornillaE2eSignIn`, que solo existe en una compilación con `VITE_E2E_SIGN_IN=true`
  (la pone `playwright.config.ts`); `scripts/check-dist.mjs` falla si aparece en `dist/`. La
  semilla y `createTestAccount` crean las cuentas ya enlazadas a su identidad de Google
  (`googleIdOf(correo)`), sin contraseña, para conservar el uid.
- **Nadie contacta con Google antes de pulsar el botón** (PLAN §11, 2026-10-14). `auth` se
  crea con `initializeAuth` y la persistencia de siempre, **sin** `popupRedirectResolver`: con él
  el SDK prepara la ventana de Google al abrir la app en celulares y Safari. El resolutor se pasa
  solo a `signInWithPopup`, `signInWithRedirect` y `getRedirectResult` (este último no carga
  nada si la pestaña no tiene una redirección pendiente). Nunca `getAuth()`. E2E:
  `tests/e2e/no-google-before-sign-in.spec.ts`.
- **La foto de Google** se quita del perfil de la cuenta tras cada ingreso pidiendo al servicio
  que borre el atributo (`deleteAttribute: ['PHOTO_URL']`); `updateProfile({ photoURL: null })`
  no la borra.

### 10.4 Otras
- **Miembros solo por invitación.** Un dueño no puede crear miembros directamente; el fundador
  entra en el lote de alta y los demás por invitación aceptada (fase 3). Cada miembro lleva
  `distributorName`, fijado por reglas igual al nombre de la distribuidora.
- **Consentimientos.** `users/{uid}` guarda `terms` y `privacy` (`{ version, acceptedAt }`), con
  versión permitida y `acceptedAt == request.time`; no se pueden borrar.
- **Historial de aceptaciones.** Cada versión aceptada deja una línea en
  `users/{uid}/acceptances/{texto}-{versión}` (`document`, `version`, `acceptedAt`). El id es
  **determinista** (`terms-0.2`), no automático: así las reglas la encuentran sin consulta y una
  versión no puede aceptarse (fecharse) dos veces, porque la segunda sería un `update` y nadie
  puede. Las dos mitades se atan con `getAfter` en el mismo lote: el perfil solo acepta un texto
  si queda su línea sellada con `request.time` (`logsAcceptance`), y la línea solo se crea si el
  perfil lleva esa aceptación sellada ahora (`profileAccepts`). Solo la crea su titular con correo
  verificado; sin `update` ni `delete` desde la app; la leen su titular y el super admin
  (`list` con tope de 50). Coste: 1 `getAfter` por texto aceptado en el perfil y 1 por línea
  creada. Excepción deliberada a "nunca datos como id" del §2: el id no lleva nada personal.
- **Aprobación atada a lo visto.** Una aprobación no dice solo quién y cuándo, también **de
  qué**: `private/control` guarda `reviewedProfileAt` y `reviewedSettingsAt`, la marca
  `updatedAt` que tenían la ficha pública y `private/settings` cuando el super admin las miró, y
  `approvalIsSigned()` exige que sean iguales a las guardadas (`approvesWhatWasReviewed`, con
  `get` y no `getAfter`: la propia aprobación mueve la marca de la ficha). Funciona porque
  **toda** escritura de esos dos documentos debe dejar `updatedAt == request.time`: no hay forma
  de editar sin cambiar de versión. Se quitan al volver a revisión, no se reescriben sin volver a
  firmar y son opcionales solo en documentos aprobados antes. En el cliente la versión viaja
  como texto opaco (`ReviewVersion`, segundos.nanosegundos: un `Date` pierde los microsegundos),
  `approveListing` la compara dentro de la transacción y lanza `StaleReviewError`. Coste: +2
  lecturas en la transacción y +2 `get` de reglas al aprobar. Patrón general: **cuando alguien
  decide sobre datos de otro, la decisión nombra la versión que vio y la regla la compara**.
- **Oyentes.** Solo sobre documentos sueltos y solo con la pantalla abierta
  (`watchDocuments` en `src/data/live.ts`, `useLiveResource`): la ficha de revisión (ficha,
  control, settings; solo datos del servidor) y las áreas de central y repartidor
  (`useLiveDistributor()`: ficha, control y el `members` propio). Nunca una colección ni una
  consulta. Se descartan las instantáneas con escrituras locales sin confirmar (sus
  `serverTimestamp` son estimaciones). Las reglas de un oyente no se vuelven a evaluar cuando
  cambia un documento que leen con `get` (el rol): por eso se escucha también el `members`
  propio. Mostrar un dato en vivo **no** es haberlo revisado: la pantalla separa "lo que se
  muestra" de "lo que se vio" (`useReviewAttention`).
- **Perder un rol con un oyente abierto** (medido contra el emulador el 2026-10-12,
  `src/data/role-revocation.emu.test.ts`; falta confirmarlo en el servicio real). Al borrar
  `platformAdmins/{uid}`: toda petición nueva se rechaza al instante (leer, listar, escribir,
  abrir otro oyente). El oyente que ya estaba abierto **no recibe ningún aviso** —lo último que
  entregó sigue en pantalla— pero **no entrega nada más**: las reglas se vuelven a evaluar con
  el primer cambio de un documento escuchado, y ese cambio lo cierra con `permission-denied` en
  lugar de llegar. Dos trampas al probarlo: un `getDoc` o un segundo oyente sobre un documento
  que ya tiene un oyente abierto se responden desde ese oyente, sin pasar por las reglas.
  `grant-platform-admin.mjs --revoke` revoca además los tokens: la sesión cae al renovar el
  suyo (como mucho una hora).
- **Límite de 1 000 expresiones por evaluación.** La regla `update` de `/distributors/{d}`
  está cerca del borde. Medido el 2026-10-14 contra el emulador con la edición legítima más
  pesada (toda la ficha con 8 marcas y vuelta a revisión, test `lets the owner edit the whole
  profile at once, eight brands included`), añadiendo al principio de la regla N copias de
  `&& request.time == request.time`: antes del cambio pasaba con 6 y fallaba con 7; la sesión de
  Google en `hasRole()` costó una; leer el miembro una sola vez (`holdsRole`) y un solo patrón
  de espacios en `isText()` la dejaron en **pasa con 13, falla con 14**. Una escritura que se
  pasa del límite se rechaza aunque fuera legítima. Antes de añadirle condiciones: validar solo
  lo que cambia o partir el documento (PLAN §9).
- **Datos locales.** Cerrar sesión borra la caché de Firestore y las claves `hornilla.*` salvo
  `storageNoticeSeen` (`src/data/local-wipe.ts`, `src/features/account/end-session.ts`).
- **Emuladores.** Solo a través de `scripts/emulators.mjs` (carril con `E2E_LANE=N`); nunca
  `firebase emulators:*` ni `java` directos: abren ventanas en el equipo del usuario.
- **Mutación de reglas.** `scripts/mutate-rules.mjs` rompe una condición cada vez y exige que un
  test lo note. Al reescribir una regla, su entrada en la lista deja de aplicar: se actualiza en
  el mismo cambio y se añaden las condiciones nuevas (`MUTANTS=ID,… npm run test:mutation`).
