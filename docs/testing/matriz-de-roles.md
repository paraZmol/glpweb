# Matriz de roles — qué ve y qué puede cada quien

Fuente: `docs/PLAN.md` (§3 roles, §5.4 datos, fase 2 y paso 2.11). La mantiene el agente
**role-walker**: antes de recorrer la app completa la matriz con las rutas y acciones nuevas, y
después prueba cada celda en la interfaz **y** con el intento directo contra las reglas.

Alcance de hoy: lo construido hasta la fase 2 (cuentas, distribuidoras, aprobación previa). Los
pedidos, el catálogo, el personal, la jornada y los mapas llegan en las fases 3 a 6: sus filas se
agregan con cada paso.

## Cómo leerla

Cada celda dice una de estas cosas:

- `ve` — abre la pantalla y ve su contenido.
- `puede` — la acción termina bien.
- `no ve` — la pantalla existe para otros, pero a este rol le responde como si no existiera
  ("no encontrada") o no le ofrece el elemento.
- `→ ruta` — lo redirige a esa ruta (con aviso si se indica).
- `rechaza` — la acción se intenta y las reglas de seguridad la niegan.
- `—` — no aplica (el rol no puede llegar a ese punto).

Columnas:

| Sigla | Rol | Cuenta de semilla (`tests/seed/data.ts`) |
|---|---|---|
| VI | Visitante, sin sesión | — |
| SV | Sesión sin correo confirmado. **No debería existir**: se ingresa solo con Google, que siempre entrega el correo confirmado. La columna prueba que, si existiera, no obtiene nada | `unverified` |
| ST | Cuenta que ingresó y no aceptó los términos vigentes (así queda toda cuenta tras su primer ingreso) | `noProfile` |
| CL | Cliente (perfil, sin membresía) | `customer` |
| RE | Repartidor de A | `driverA` |
| CE | Central de A | `dispatcherA` |
| DU | Dueño (titular) de A, activa y aprobada | `ownerA` |
| DO | Dueño de **otra** distribuidora (B), frente a lo de A | `ownerB` |
| DS | Dueño de una suspendida (C) o con la prueba vencida (D) | `ownerC`, `ownerD` |
| SA | Super admin de la plataforma | `admin` |

Repartidor y central solo existen por semilla: las invitaciones de personal llegan en la fase 3
(paso 3.2). Hasta entonces no hay forma de crear esos roles desde la interfaz, y su recorrido se
hace con las cuentas `driverA` y `dispatcherA`. Una distribuidora "en revisión" se recorre con
`ownerE` y con distribuidoras fundadas por la propia prueba.

Se ingresa solo con Google (PLAN 2.1, 2026-10-12): no hay registro con correo y contraseña, ni
verificación de correo, ni restablecer contraseña. Las cuentas de semilla entran como la
identidad de Google que el emulador simula.

Orden de las guardas (PLAN 2.11): sesión → correo confirmado → términos → rol. Por eso ST va
siempre a `/aceptar-terminos` antes que a cualquier área. SV no tiene un paso que completar: en
cualquier ruta con sesión ve, sin cambiar de dirección, **el aviso** "No pudimos confirmar tu
correo con Google. Cierra sesión e inténtalo de nuevo.", con "Cerrar sesión" como única salida
(en las tablas: `ve el aviso`).

## 1. Rutas

`→ ingresar` significa `/ingresar?desde=<ruta>` con "Ingresa para continuar". `→ su área` es
`/inicio` (CL), `/reparto` (RE), `/central` (CE, DU, DO, DS) o `/plataforma` (SA), con el aviso
"Esa sección no está disponible para tu cuenta".

| Ruta | VI | SV | ST | CL | RE | CE | DU | DO | DS | SA |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` portada y buscador | ve | ve | ve | ve | ve | ve | ve | ve | ve | ve |
| `/terminos`, `/privacidad`, `/cookies`, `/contacto` | ve | ve | ve | ve | ve | ve | ve | ve | ve | ve |
| `/restablecer`, `/verificar-correo` (retiradas el 2026-10-12) | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" |
| `/ingresar`, `/registro` (la misma pantalla con otro título: solo "Continuar con Google") | ve | → `/app`, donde ve el aviso | → `/aceptar-terminos` | → su área | → su área | → su área | → su área | → su área | → su área | → su área |
| `/d/{slug}` de una aprobada y activa (A, B) | ve | ve | ve | ve | ve | ve | ve | ve | ve | ve |
| `/d/{slug}` sin aprobar (E) | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve | ve (vista previa) |
| `/d/{slug}` suspendida (C) o vencida (D) | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve | ve la suya (vista previa), no ve la otra | ve (vista previa) |
| `/d/{slug}` propia sin aprobar (titular de E) | — | — | — | — | — | — | ve (vista previa "solo tu personal") | — | — | — |
| `/d/{slug}` que no existe | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve |
| `/app` | → ingresar | ve el aviso | → `/aceptar-terminos` | → `/inicio` | → `/reparto` | → `/central` | → `/central` | → `/central` | → `/central` | → `/plataforma` |
| `/aceptar-terminos` | → ingresar | ve el aviso | ve | → su área | → su área | → su área | → su área | → su área | → su área | → su área |
| `/inicio`, `/pedidos`, `/cuenta` | → ingresar | ve el aviso | → `/aceptar-terminos` | ve | ve | ve | ve | ve | ve | ve |
| `/distribuidora/nueva` | → ingresar | ve el aviso | → `/aceptar-terminos` | ve | ve | ve | ve (hasta 3) | ve (hasta 3) | ve el aviso "por ahora no puedes registrar otra" | ve |
| `/reparto` | → ingresar | ve el aviso | → `/aceptar-terminos` | → su área | ve | → su área | → su área | → su área | → su área | → su área |
| `/central` | → ingresar | ve el aviso | → `/aceptar-terminos` | → su área | → su área | ve (la de A) | ve (la de A) | ve (la de B, nada de A) | ve, con aviso de solo lectura | → su área |
| `/central/ficha` | → ingresar | ve el aviso | → `/aceptar-terminos` | → su área | → su área | ve "la edita quien es titular" | ve | ve (la de B) | ve como solo lectura: campos deshabilitados, sin "Guardar cambios", con el aviso | → su área |
| `/plataforma` y sus tres listas (`?estado=`) | → ingresar | ve el aviso | → `/aceptar-terminos` | → su área | → su área | → su área | → su área | → su área | → su área | ve |
| `/plataforma/altas/{id}` | → ingresar | ve el aviso | → `/aceptar-terminos` | → su área | → su área | → su área | → su área | → su área | → su área | ve, bajo la lista a la que pertenece (y "no existe" si el id no existe) |
| Cualquier otra ruta | ve "no existe" con "Ingresar" | ve "no existe" con "Ir a mi inicio" | igual | igual | igual | igual | igual | igual | igual | igual |

## 2. Acciones en pantalla

| Acción | VI | SV | ST | CL | RE | CE | DU | DO | DS | SA |
|---|---|---|---|---|---|---|---|---|---|---|
| Buscar distribuidoras por ubicación o coordenadas | puede | puede | puede | puede | puede | puede | puede | puede | puede | puede |
| Ver en el buscador solo aprobadas y activas | ve | ve | ve | ve | ve | ve | ve | ve | ve | ve |
| Llamar o escribir por WhatsApp a una distribuidora | puede | puede | puede | puede | puede | puede | puede | puede | puede | puede |
| Ingresar con "Continuar con Google" (la primera vez crea la cuenta; conserva el destino `desde`) | puede | — | — | — | — | — | — | — | — | — |
| Ingresar o registrarse con correo y contraseña · restablecer la contraseña · verificar el correo | no ve (no existe) | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve |
| Cerrar la ventana de Google sin elegir cuenta | ve "Se canceló el ingreso." y sigue en la pantalla | — | — | — | — | — | — | — | — | — |
| Eliminar la cuenta antes de aceptar ("No quiero continuar: eliminar mi cuenta") | — | no ve (solo puede cerrar sesión) | puede (sin perfil; puede volver a entrar con la misma cuenta de Google) · → `/contacto` (con perfil: "No acepto: pedir que eliminen mi cuenta") | — | — | — | — | — | — | — |
| Confirmar el nombre que entrega Google, añadir el celular y aceptar términos y privacidad (crea el perfil) | — | — | puede | — | — | — | — | — | — | — |
| Editar nombre y celular en `/cuenta` | — | — | — | puede | puede | puede | puede | puede | puede | puede |
| Cambiar el correo en `/cuenta` | — | — | — | no ve | no ve | no ve | no ve | no ve | no ve | no ve |
| Cerrar sesión (borra lo guardado en el dispositivo) | — | puede | puede | puede | puede | puede | puede | puede | puede | puede |
| Registrar una distribuidora (4 pasos; Atrás y Adelante del navegador recorren los pasos; salir con "Salir" y volver conserva lo escrito; otra cuenta en la misma pestaña no ve nada de la anterior) | — | — | — | puede | puede | puede | puede (tope 3) | puede (tope 3) | no ve (bloqueado) | puede |
| Ver el estado de la ficha y la nota de la plataforma en `/central` (en vivo: cambia sin recargar) | — | — | — | — | — | ve | ve | ve lo suyo | ve | — |
| Copiar el enlace público | — | — | — | — | — | puede | puede | puede lo suyo | no ve | — |
| Editar la ficha pública (`/central/ficha`) | — | — | — | — | — | no ve | puede | puede la suya; rechaza la de A | rechaza (solo lectura) | — |
| Cambiar nombre, teléfono, WhatsApp, dirección o ubicación de la planta de una aprobada | — | — | — | — | — | no ve | puede, con pregunta antes de guardar; vuelve a revisión y deja de verse en el buscador y en `/d/{slug}` | — | rechaza | — |
| Cambiar radio, horario o color de una aprobada | — | — | — | — | — | no ve | puede, sin volver a revisión | — | rechaza | — |
| Enviar la corrección sin cambiar nada ("Corregir mis datos") | — | — | — | — | — | no ve | ve "No cambiaste nada todavía"; nada se marca | — | rechaza | — |
| Elegir otra de sus distribuidoras en el selector (cabecera) | — | — | — | — | — | — | puede; con la ficha a medio editar descarta lo escrito y no guarda nada en la otra | — | — | — |
| Registrar una cuarta distribuidora | — | — | — | — | — | — | ve "Ya registraste 3 distribuidoras" en `/cuenta` y en `/distribuidora/nueva` | — | — | — |
| Ver que la distribuidora quedó suspendida, con el panel abierto | — | — | — | — | ve, sin recargar (aviso: no depende de quien reparte, que avise a su titular) | ve, sin recargar | ve, sin recargar | — | — | — |
| Perder el rol con el panel abierto (cambia de rol, se desactiva o baja de titular) | — | — | — | — | → su área nueva, con aviso | → su área nueva, con aviso | la ficha pasa a "la edita quien es titular" | — | — | — |
| Corregir RUC, razón social o registro tras una nota | — | — | — | — | — | no ve | puede (quien fundó) | — | rechaza | — |
| Abrir las listas y la ficha de revisión | — | — | — | no ve | no ve | no ve | no ve | no ve | no ve | puede |
| Aprobar · Pedir cambios (nota) · Suspender · Reactivar | — | — | — | no ve | no ve | no ve | no ve | no ve | no ve | puede |
| Aprobar una ficha que su titular editó con la revisión abierta | — | — | — | — | — | — | — | — | — | rechaza, con aviso; puede tras "Ya revisé los datos nuevos" (y vuelve a rechazar si llega otra edición después) |
| Decidir a la vez que otro super admin (dos sesiones en la misma ficha) | — | — | — | — | — | — | — | — | — | puede; la otra pantalla se actualiza sola |
| Cargar más de 20 en cada lista ("Cargar más") | — | — | — | — | — | — | — | — | — | puede, sin repetidos; la lista vuelve a 20 al abrir una ficha |
| Abrir Reparto / Central / Plataforma desde `/cuenta` | — | — | — | no ve | ve Reparto | ve Central | ve Central | ve Central | ve Central | ve Plataforma |
| Leer el aviso de almacenamiento de la primera visita (franja arriba; no tapa ningún control) | ve | ve | ve | ve | ve | ve | ve | ve | ve | ve |
| Cambiar de tema claro/oscuro | sigue al dispositivo | igual | igual | igual | igual | igual | igual | igual | igual | igual |

## 3. Intento directo contra las reglas (cliente modificado)

Lo que cada rol consigue llamando a la base con su propia sesión, sin pasar por la pantalla.

| Intento | VI | SV | ST | CL | RE | CE | DU | DO | DS | SA |
|---|---|---|---|---|---|---|---|---|---|---|
| Leer la ficha de una aprobada y activa | puede | puede | puede | puede | puede | puede | puede | puede | puede | puede |
| Leer la ficha de una sin aprobar, suspendida o vencida | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede solo la suya | puede |
| Listar todas las distribuidoras sin filtro | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Leer `private/control` de A | rechaza | rechaza | rechaza | rechaza | puede | puede | puede | rechaza | rechaza | puede |
| Leer `private/settings` de A (RUC, titular) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede (quien fundó) | rechaza | rechaza | puede |
| Listar los miembros de A | rechaza | rechaza | rechaza | rechaza | rechaza | puede | puede | rechaza | rechaza | rechaza |
| Leer el perfil de otra persona · listar `users` | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Leer el historial de aceptaciones de otra persona (`users/{uid}/acceptances`) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | **puede** (celda nueva: falta decidir si es lo querido) |
| Leer `platformAdmins` | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede el suyo |
| Listar `slugs` · consultas de grupo (`members`, `private`) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Escribir la ficha de A sin pasar por la app | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza (forma inválida) | rechaza | rechaza | rechaza |
| Poner `acceptingOrders` o `listingApproved` a mano | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza (solo con la decisión completa) |
| Aprobar sin decir qué versión se revisó, o para una versión que ya no es la guardada | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Editar la ficha o `private/settings` sin mover su `updatedAt` | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Cambiar la dirección o la planta de una aprobada sin devolverla a revisión | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Marcar "correcciones enviadas" sin corregir nada (lote que solo mueve `updatedAt` o el indicador) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Reescribir `acceptingOrders` con el valor que ya tiene (mueve la versión que nombra una aprobación) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede, junto a su decisión |
| Cambiar el estado (`status`) de una distribuidora a mano | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza (solo con la decisión completa) |
| Darse un rol en `members` · cambiar el rol de otro · borrar un miembro | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Darse super admin (`platformAdmins/{yo}`) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Crear o editar el perfil propio a mano, sin los consentimientos | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Guardar cualquier dato propio (perfil, aceptación, dirección, distribuidora) sin correo confirmado | — | rechaza | — | — | — | — | — | — | — | — |
| Crear el perfil o aceptar una versión con una sesión que no entró con Google (otro proveedor, aunque tenga el correo verificado) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Apropiarse de un enlace (`slugs/{slug}`) · borrar una ficha | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Realtime Database: leer o escribir cualquier ruta | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |

## 4. Celdas sin probar

Se anotan aquí con el motivo; una celda no recorrida no se da por buena.

- **La ventana real de Google y el ingreso por redirección**: el recorrido automático pulsa
  "Continuar con Google" y completa la ventana, pero la ventana es la del emulador
  (`tests/e2e/google-sign-in.spec.ts`). La de Google, y el respaldo por redirección en los
  celulares donde la ventana no abre, quedan para la prueba manual de la fase contra el
  servicio real.
- **Repartidor y central de una distribuidora en revisión o con la prueba vencida**: la semilla
  solo tiene titular en D y E. De una suspendida sí se recorrieron (personal escrito por la
  prueba, igual que lo escribe la semilla).
- **Cambio de rol hecho desde una pantalla**: no existe hasta la fase 3. La reacción de
  `/central` y `/reparto` se recorrió cambiando el documento de membresía por fuera.
- **Aviso "La ficha cambió" en la ficha de revisión a 390 px con el teclado abierto** y **gesto
  "atrás" de un celular real**: el recorrido usa el historial del navegador, que es lo que el
  gesto dispara; el gesto mismo es del agente `field-tester`.
- **Sin conexión** y **app instalada**: son del agente `field-tester`.
- **Recargar la pestaña a mitad del alta de distribuidora**: sigue vaciando lo escrito (el
  borrador vive solo en memoria); su test queda con `test.fail` en `role-walker.spec.ts`.

## 4b. Celdas que hoy no cumplen lo que dice la matriz

Cada una tiene su test con `test.fail` en `tests/e2e/flows/role-walker.spec.ts`. Quedan dos, las
dos del alta de distribuidora y las dos a la espera de una decisión sobre almacenamiento
(guardar el borrador o la marca de "alta terminada" fuera de la memoria pasa por
`docs/legal/cookies.md`):

- **Recargar a mitad del alta** vacía lo escrito (el borrador vive solo en memoria).
- **Recargar la central recién creada y pulsar Atrás** muestra el paso 1 del alta vacío.

Arregladas el 2026-10-12 (sus tests quedaron como tests normales): la ficha de una suspendida o
vencida ya es de solo lectura, también si la suspensión llega con la ficha a medio editar;
`/reparto` avisa de la suspensión en vivo y al recargar; la pregunta "¿Guardar y volver a
revisión?" queda entera a la vista; ninguna confirmación (aprobar, pedir cambios, suspender,
reactivar, volver a revisión, eliminar la cuenta) se responde con un doble clic; el doble clic en
"Continuar" deja una sola entrada del historial.

## 5. Historial

| Fecha | Qué cubrió la pasada | Rama |
|---|---|---|
| 2026-10-11 | Primera pasada: todo lo construido en las fases 0 a 2 (incluido 2.11) | `fase-2/cuentas-y-distribuidoras` |
| 2026-10-11 | Arreglos de la primera pasada (no es una pasada nueva): historial del alta, aviso de almacenamiento, `/restablecer`, página "no existe", contraseña en blanco, título de las listas de plataforma, coordenadas con coma. Quedan con `test.fail`: recargar a mitad del alta, aprobar datos que la plataforma no vio, panel del titular que no se entera de la decisión | `fase-2/cuentas-y-distribuidoras` |
| 2026-10-12 | Segunda pasada, sobre lo que se quiere unir a `main`: confirmados los 7 arreglos de la primera; alta con Atrás y Adelante en combinación, ficha de revisión en vivo (ediciones seguidas, dos super admins), panel en vivo (suspensión con la ficha a medio editar, cambio de rol), cambio de dirección de una aprobada, corrección sin cambios, franja del aviso en cada área en claro y oscuro, tope de 3 desde la pantalla, selector con tres distribuidoras, listas de más de 20, intento directo de la sección 3 con la sesión de cada rol. Fallos nuevos: 4 medios y 2 bajos (§4b) | `fase-2/cuentas-y-distribuidoras` |
| 2026-10-12 | Arreglos de la segunda pasada (no es una pasada nueva): confirmaciones que no se responden con doble clic, pregunta de vuelta a revisión a la vista, ficha de solo lectura (también en vivo), aviso de suspensión en `/reparto`, una sola entrada del historial por paso del alta, avisos de plataforma (cambio de estado frente a cambio de datos, título en celular), bienvenida de la central que se cierra, listas de plataforma que conservan lo cargado. Quedan con `test.fail` las dos de §4b | `fase-2/cuentas-y-distribuidoras` |
| 2026-10-12 | No es una pasada: la matriz se pone al día con el ingreso solo con Google (PLAN 2.1). Salen `/restablecer` y `/verificar-correo`; `/registro` es la misma pantalla que `/ingresar`; la columna SV cambia de sentido (una sesión que no debería existir y que no obtiene nada); filas nuevas de reglas para el proveedor de ingreso. **Falta la pasada de `role-walker` sobre estas celdas** | `fase-2/pendientes-del-cierre` |
