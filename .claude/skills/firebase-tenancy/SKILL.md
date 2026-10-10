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

## 10. Decisiones posteriores (2026-10-10)
- **Ficha pública mínima.** `/distributors/{d}` es público y lleva solo lo que el cliente necesita
  más `acceptingOrders`. El estado (`status`), el fin de la prueba (`trialEndsAt`) y la cuenta
  fundadora (`ownerUid`) viven en `/distributors/{d}/private/control`, que solo leen el personal
  activo y el super admin. `writable(d)` y `foundedNow(d)` leen **el control**, no la ficha (el §3
  de arriba muestra la forma antigua). `acceptingOrders` nunca se usa para autorizar: es solo para
  el buscador y puede quedar desfasado cuando vence una prueba.
- **Miembros solo por invitación.** Un dueño no puede crear miembros directamente; el fundador
  entra en el lote de alta y los demás por invitación aceptada (fase 3). Cada miembro lleva
  `distributorName`, fijado por reglas igual al nombre de la distribuidora.
- **Consentimientos.** `users/{uid}` guarda `terms` y `privacy` (`{ version, acceptedAt }`), con
  versión permitida y `acceptedAt == request.time`; no se pueden borrar.
- **Datos locales.** Cerrar sesión borra la caché de Firestore y las claves `hornilla.*` salvo
  `storageNoticeSeen` (`src/data/local-wipe.ts`, `src/features/account/end-session.ts`).
- **Emuladores.** Solo a través de `scripts/emulators.mjs` (carril con `E2E_LANE=N`); nunca
  `firebase emulators:*` ni `java` directos: abren ventanas en el equipo del usuario.
