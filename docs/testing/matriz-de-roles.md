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
| SV | Cuenta con el correo sin verificar | `unverified` |
| ST | Cuenta verificada que no aceptó los términos vigentes | `noProfile` |
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

Orden de las guardas (PLAN 2.11): sesión → correo verificado → términos → rol. Por eso SV va
siempre a `/verificar-correo` y ST a `/aceptar-terminos` antes que a cualquier área.

## 1. Rutas

`→ ingresar` significa `/ingresar?desde=<ruta>` con "Ingresa para continuar". `→ su área` es
`/inicio` (CL), `/reparto` (RE), `/central` (CE, DU, DO, DS) o `/plataforma` (SA), con el aviso
"Esa sección no está disponible para tu cuenta".

| Ruta | VI | SV | ST | CL | RE | CE | DU | DO | DS | SA |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` portada y buscador | ve | ve | ve | ve | ve | ve | ve | ve | ve | ve |
| `/terminos`, `/privacidad`, `/cookies`, `/contacto` | ve | ve | ve | ve | ve | ve | ve | ve | ve | ve |
| `/restablecer` | ve | ve | ve | ve | ve | ve | ve | ve | ve | ve |
| `/ingresar`, `/registro` | ve | → `/verificar-correo` | → `/aceptar-terminos` | → su área | → su área | → su área | → su área | → su área | → su área | → su área |
| `/d/{slug}` de una aprobada y activa (A, B) | ve | ve | ve | ve | ve | ve | ve | ve | ve | ve |
| `/d/{slug}` sin aprobar (E) | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve | ve (vista previa) |
| `/d/{slug}` suspendida (C) o vencida (D) | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve | ve la suya (vista previa), no ve la otra | ve (vista previa) |
| `/d/{slug}` propia sin aprobar (titular de E) | — | — | — | — | — | — | ve (vista previa "solo tu personal") | — | — | — |
| `/d/{slug}` que no existe | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve | no ve |
| `/app` | → ingresar | → `/verificar-correo` | → `/aceptar-terminos` | → `/inicio` | → `/reparto` | → `/central` | → `/central` | → `/central` | → `/central` | → `/plataforma` |
| `/verificar-correo` | → ingresar | ve | → `/aceptar-terminos` | → su área | → su área | → su área | → su área | → su área | → su área | → su área |
| `/aceptar-terminos` | → ingresar | → `/verificar-correo` | ve | → su área | → su área | → su área | → su área | → su área | → su área | → su área |
| `/inicio`, `/pedidos`, `/cuenta` | → ingresar | → `/verificar-correo` | → `/aceptar-terminos` | ve | ve | ve | ve | ve | ve | ve |
| `/distribuidora/nueva` | → ingresar | → `/verificar-correo` | → `/aceptar-terminos` | ve | ve | ve | ve (hasta 3) | ve (hasta 3) | ve el aviso "por ahora no puedes registrar otra" | ve |
| `/reparto` | → ingresar | → `/verificar-correo` | → `/aceptar-terminos` | → su área | ve | → su área | → su área | → su área | → su área | → su área |
| `/central` | → ingresar | → `/verificar-correo` | → `/aceptar-terminos` | → su área | → su área | ve (la de A) | ve (la de A) | ve (la de B, nada de A) | ve, con aviso de solo lectura | → su área |
| `/central/ficha` | → ingresar | → `/verificar-correo` | → `/aceptar-terminos` | → su área | → su área | ve "la edita quien es titular" | ve | ve (la de B) | ve, solo lectura | → su área |
| `/plataforma` y sus tres listas (`?estado=`) | → ingresar | → `/verificar-correo` | → `/aceptar-terminos` | → su área | → su área | → su área | → su área | → su área | → su área | ve |
| `/plataforma/altas/{id}` | → ingresar | → `/verificar-correo` | → `/aceptar-terminos` | → su área | → su área | → su área | → su área | → su área | → su área | ve (y "no existe" si el id no existe) |
| Cualquier otra ruta | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" | ve "no existe" |

## 2. Acciones en pantalla

| Acción | VI | SV | ST | CL | RE | CE | DU | DO | DS | SA |
|---|---|---|---|---|---|---|---|---|---|---|
| Buscar distribuidoras por ubicación o coordenadas | puede | puede | puede | puede | puede | puede | puede | puede | puede | puede |
| Ver en el buscador solo aprobadas y activas | ve | ve | ve | ve | ve | ve | ve | ve | ve | ve |
| Llamar o escribir por WhatsApp a una distribuidora | puede | puede | puede | puede | puede | puede | puede | puede | puede | puede |
| Crear cuenta | puede | — | — | — | — | — | — | — | — | — |
| Ingresar con correo | puede | — | — | — | — | — | — | — | — | — |
| Pedir enlace para restablecer la contraseña | puede | puede | puede | puede | puede | puede | puede | puede | puede | puede |
| Reenviar verificación / "Ya lo verifiqué" | — | puede | — | — | — | — | — | — | — | — |
| Eliminar la cuenta antes de aceptar ("No quiero continuar", "No acepto") | — | puede | puede (sin perfil) · → `/contacto` (con perfil) | — | — | — | — | — | — | — |
| Aceptar términos y privacidad (crea el perfil) | — | — | puede | — | — | — | — | — | — | — |
| Editar nombre y celular en `/cuenta` | — | — | — | puede | puede | puede | puede | puede | puede | puede |
| Cambiar el correo en `/cuenta` | — | — | — | no ve | no ve | no ve | no ve | no ve | no ve | no ve |
| Cerrar sesión (borra lo guardado en el dispositivo) | — | puede | puede | puede | puede | puede | puede | puede | puede | puede |
| Registrar una distribuidora (4 pasos) | — | — | — | puede | puede | puede | puede (tope 3) | puede (tope 3) | no ve (bloqueado) | puede |
| Ver el estado de la ficha y la nota de la plataforma en `/central` | — | — | — | — | — | ve | ve | ve lo suyo | ve | — |
| Copiar el enlace público | — | — | — | — | — | puede | puede | puede lo suyo | no ve | — |
| Editar la ficha pública (`/central/ficha`) | — | — | — | — | — | no ve | puede | puede la suya; rechaza la de A | rechaza (solo lectura) | — |
| Cambiar nombre, teléfono o WhatsApp de una aprobada | — | — | — | — | — | no ve | puede, y vuelve a revisión | — | rechaza | — |
| Corregir RUC, razón social o registro tras una nota | — | — | — | — | — | no ve | puede (quien fundó) | — | rechaza | — |
| Abrir las listas y la ficha de revisión | — | — | — | no ve | no ve | no ve | no ve | no ve | no ve | puede |
| Aprobar · Pedir cambios (nota) · Suspender · Reactivar | — | — | — | no ve | no ve | no ve | no ve | no ve | no ve | puede |
| Abrir Reparto / Central / Plataforma desde `/cuenta` | — | — | — | no ve | ve Reparto | ve Central | ve Central | ve Central | ve Central | ve Plataforma |
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
| Leer `platformAdmins` | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede el suyo |
| Listar `slugs` · consultas de grupo (`members`, `private`) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Escribir la ficha de A sin pasar por la app | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza (forma inválida) | rechaza | rechaza | rechaza |
| Poner `acceptingOrders` o `listingApproved` a mano | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza (solo con la decisión completa) |
| Cambiar el estado (`status`) de una distribuidora a mano | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza (solo con la decisión completa) |
| Darse un rol en `members` · cambiar el rol de otro · borrar un miembro | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Darse super admin (`platformAdmins/{yo}`) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Crear o editar el perfil propio a mano, sin los consentimientos | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Apropiarse de un enlace (`slugs/{slug}`) · borrar una ficha | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Realtime Database: leer o escribir cualquier ruta | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |

## 4. Celdas sin probar

Se anotan aquí con el motivo; una celda no recorrida no se da por buena.

- **Ingresar y registrarse con Google**: el emulador abre una ventana propia y el recorrido no
  puede abrir ventanas. Queda para la prueba manual de la fase.
- **Seguir el enlace del correo** (verificación y nueva contraseña): la página del enlace es del
  servicio de ingreso, no de la app; se prueba que el correo sale y el regreso a la app.
- **Tope de 3 distribuidoras por cuenta** y **paginación de las listas de la plataforma** (más de
  20): los cubren `founding-limit.spec.ts` y los tests de repositorio; el recorrido no los repite.
- **Cuenta con varias distribuidoras** (selector): no hay cuenta de semilla con dos membresías.
- **Repartidor y central de una distribuidora suspendida o en revisión**: la semilla solo tiene
  titular en C, D y E.
- **Sin conexión** y **app instalada**: son del agente `field-tester`.

## 5. Historial

| Fecha | Qué cubrió la pasada | Rama |
|---|---|---|
| 2026-10-11 | Primera pasada: todo lo construido en las fases 0 a 2 (incluido 2.11) | `fase-2/cuentas-y-distribuidoras` |
