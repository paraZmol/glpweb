# Matriz de roles — qué ve y qué puede cada quien

Fuente: `docs/PLAN.md` (§3 roles, §5.4 datos, fase 2 y paso 2.11). La mantiene el agente
**role-walker**: antes de recorrer la app completa la matriz con las rutas y acciones nuevas, y
después prueba cada celda en la interfaz **y** con el intento directo contra las reglas.

Alcance de hoy: lo construido hasta la fase 2 (cuentas, distribuidoras, aprobación previa), el
catálogo (paso 3.1: datos, reglas y pantallas) y el lado de datos del personal (paso 3.2:
invitaciones, cambios de rol, ayudantes y la nota de la plataforma, con sus pantallas
`/central/personal` y `/unirme` desde el 2026-10-15). Los pedidos, la jornada y los mapas llegan en las fases 4 a 6: sus filas se
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

Repartidor y central existen por semilla y, desde el paso 3.2, por invitación aceptada (desde el
2026-10-15 con pantalla: `/central/personal` invita y `/unirme` acepta). Su recorrido se hace con las
cuentas `driverA` y `dispatcherA`; la semilla deja en A una invitación de reparto pendiente
(`SEED_INVITE_CODE`) y dos ayudantes. Una distribuidora "en revisión" se recorre con
`ownerE` y con distribuidoras fundadas por la propia prueba.

Se ingresa solo con Google (PLAN 2.1, 2026-10-12): no hay registro con correo y contraseña, ni
verificación de correo, ni restablecer contraseña. Las cuentas de semilla entran como la
identidad de Google que el emulador simula.

Orden de las guardas (PLAN 2.11): sesión → correo confirmado → términos → rol. Por eso ST va
siempre a `/aceptar-terminos` antes que a cualquier área. SV no tiene un paso que completar: en
cualquier ruta con sesión ve, sin cambiar de dirección, **el aviso** "No pudimos confirmar tu
correo con Google. Cierra sesión e inténtalo de nuevo. Si se repite, o si quieres que eliminemos
esta cuenta, escríbenos desde Contacto y reclamos.", con "Cerrar sesión" como única salida de la
sesión y el enlace a `/contacto` (en las tablas: `ve el aviso`). Ninguna cuenta con una sesión
que no sea de Google con correo verificado lee ni escribe nada propio (reglas, PLAN §11
2026-10-14).

Una sola puerta (PLAN §11, 2026-10-14): el encabezado público ofrece "Ingresar" (y nada en
`/ingresar` ni en `/registro`), y esas dos pantallas no se enlazan entre sí.

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
| `/reparto/catalogo` (3.1) | → ingresar | ve el aviso | → `/aceptar-terminos` | → su área | ve el catálogo de A en solo lectura (también lo retirado), sin un solo botón | → su área | → su área | → su área | → su área | → su área |
| `/central` | → ingresar | ve el aviso | → `/aceptar-terminos` | → su área | → su área | ve (la de A) | ve (la de A) | ve (la de B, nada de A) | ve, con aviso de solo lectura | → su área |
| `/central/ficha` | → ingresar | ve el aviso | → `/aceptar-terminos` | → su área | → su área | ve "la edita quien es titular" | ve | ve (la de B) | ve como solo lectura: campos deshabilitados, sin "Guardar cambios", con el aviso | → su área |
| `/central/catalogo` (3.1) | → ingresar | ve el aviso | → `/aceptar-terminos` | → su área | → su área | ve el de A con "Añadir producto", editar, subir y bajar, quitar y poner a la venta, igual que el titular (PLAN §11, 2026-10-15) | ve el de A con "Añadir producto", editar, subir y bajar, quitar y poner a la venta | ve el de B, nada de A | ve el suyo en solo lectura bajo el aviso, sin botones (vacío: "Todavía no hay productos.") | → su área |
| `/central/personal` (3.2) | → ingresar | ve el aviso | → `/aceptar-terminos` | → su área | → su área | → `/central` con el aviso "Esa sección no está disponible" (sin "Personal" en la navegación) | ve el personal de A, las invitaciones que esperan y los ayudantes, con "Invitar a alguien" | ve el de B, nada de A | ve el suyo en solo lectura bajo el aviso: sin invitar, cambiar ni añadir; solo "Anular" | → su área |
| `/unirme#d=…&c=…` (3.2) | → `/ingresar?desde=%2Funirme` con el fragmento y "Ingresa con tu cuenta de Google para ver tu invitación." | ve el aviso | → `/aceptar-terminos`, y al aceptar vuelve a `/unirme` con el fragmento | ve la invitación ("Gas Demo Norte te invita como repartidor.", "Te invita A. Dueña", en el color de la distribuidora; una invitación anterior al 2026-10-15 sin esas dos cosas) y "Unirme" | de A: "Ya formas parte de Gas Demo Norte." con "Ir a mi panel"; de otra: ve y puede unirse | igual que RE | igual que RE | ve y puede unirse a A | ve; al unirse a C o D lo rechaza con el mensaje de la distribuidora que no puede sumar personal | ve y puede unirse |
| `/unirme` sin fragmento o con un código de otra forma | — | ve el aviso | → `/aceptar-terminos` | ve "Este enlace de invitación no está completo." | igual | igual | igual | igual | igual | igual |
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
| Cerrar la ventana de Google sin elegir cuenta | ve "Se canceló el ingreso." en 1–2 s y el botón vuelve a poder pulsarse; el mensaje se borra al intentarlo otra vez | — | — | — | — | — | — | — | — | — |
| Eliminar la cuenta antes de aceptar ("No quiero continuar: eliminar mi cuenta") | — | no ve (solo puede cerrar sesión) | puede (sin perfil; puede volver a entrar con la misma cuenta de Google) · → `/contacto` (con perfil: "No acepto: pedir que eliminen mi cuenta") | — | — | — | — | — | — | — |
| Pulsar dos veces "Continuar con Google" | abre una sola ventana | — | — | — | — | — | — | — | — | — |
| Confirmar el nombre que entrega Google, añadir el celular y aceptar términos y privacidad (crea el perfil) | — | — | puede (conserva el destino `desde`, también tras recargar `/aceptar-terminos`) | — | — | — | — | — | — | — |
| Aceptar en una pestaña con otra pestaña abierta en `/aceptar-terminos` | — | — | la otra pestaña sale de `/aceptar-terminos` hacia su destino (al momento en el mismo navegador; desde otro dispositivo, al volver a la pestaña) | — | — | — | — | — | — | — |
| Cambiar de cuenta en la misma pestaña (cerrar sesión e ingresar con otra) | — | — | no ve nada de la anterior | igual | igual | igual | igual | igual | igual | igual |
| Editar nombre y celular en `/cuenta` | — | — | — | puede | puede | puede | puede | puede | puede | puede |
| Cambiar el correo en `/cuenta` | — | — | — | no ve | no ve | no ve | no ve | no ve | no ve | no ve |
| Cerrar sesión (borra lo guardado en el dispositivo) | — | puede | puede | puede | puede | puede | puede | puede | puede | puede |
| Registrar una distribuidora (4 pasos; Atrás y Adelante del navegador recorren los pasos; salir con "Salir" y volver conserva lo escrito; otra cuenta en la misma pestaña no ve nada de la anterior) | — | — | — | puede | puede | puede | puede (tope 3) | puede (tope 3) | no ve (bloqueado) | puede |
| Ver el estado de la ficha y la nota de la plataforma en `/central` (en vivo: cambia sin recargar) | — | — | — | — | — | ve | ve | ve lo suyo | ve | — |
| Copiar el enlace público | — | — | — | — | — | puede | puede | puede lo suyo | no ve | — |
| Editar la ficha pública (`/central/ficha`) | — | — | — | — | — | no ve | puede | puede la suya; rechaza la de A | rechaza (solo lectura) | — |
| Catálogo (3.1, pantalla): añadir un producto, editar sus precios, subir y bajar, quitar o volver a poner a la venta en `/central/catalogo` | — | — | — | — | no ve | puede (desde 2026-10-15) | puede | puede en la suya | no ve (solo lectura) | — |
| Catálogo: guardar un balón completo que no cuesta más que la recarga | — | — | — | — | — | — | ve el error en el campo, no se guarda | ve el error en el campo | — | — |
| Catálogo: con 30 productos (también retirados) | — | — | — | — | — | — | ve el tope en lugar de "Añadir producto" | igual | — | — |
| Ver en `/d/{slug}` de A sus productos a la venta, en su orden, con "Recarga S/ X" y, si lo vende, "Balón completo S/ Y" (sin botón de pedir) | ve | ve | ve | ve | ve | ve | ve | ve | ve | ve |
| Ver en el buscador el "Recarga 5 kg desde S/ 38.00" de cada distribuidora (la recarga a la venta más barata con su peso, desde el 2026-10-15; sin productos, sin precio) y "recarga 5 kg desde" bajo la portada de `/d/{slug}` | ve | ve | ve | ve | ve | ve | ve | ve | ve | ve |
| Ver en `/d/{slug}` de A el enlace "Libro de Reclamaciones" con su dominio a la vista ("· example.com"; otra pestaña; solo si la distribuidora lo dio; B no lo tiene; 2026-10-16) | ve | ve | ve | ve | ve | ve | ve | ve | ve | ve |
| "Carga tu catálogo" en `/central`: enlace al catálogo, hecha con un producto a la venta | — | — | — | — | — | no ve | ve | ve la suya | ve "Ver catálogo" | — |
| Cambiar nombre, teléfono, WhatsApp, dirección o ubicación de la planta de una aprobada | — | — | — | — | — | no ve | puede, con pregunta antes de guardar; vuelve a revisión y deja de verse en el buscador y en `/d/{slug}` | — | rechaza | — |
| Cambiar radio, horario o color de una aprobada | — | — | — | — | — | no ve | puede, sin volver a revisión | — | rechaza | — |
| Poner, cambiar o quitar el enlace del Libro de Reclamaciones virtual en `/central/ficha` (solo `https://`; 2026-10-15) | — | — | — | — | — | no ve | puede, sin volver a revisión; un enlace que no empieza con https:// ve el error en el campo | puede en la suya | rechaza | — |
| Enviar la corrección sin cambiar nada ("Corregir mis datos") | — | — | — | — | — | no ve | ve "No cambiaste nada todavía"; nada se marca | — | rechaza | — |
| Elegir otra de sus distribuidoras en el selector (cabecera) | — | — | — | — | — | — | puede; con la ficha a medio editar descarta lo escrito y no guarda nada en la otra | — | — | — |
| Registrar una cuarta distribuidora | — | — | — | — | — | — | ve "Ya registraste 3 distribuidoras" en `/cuenta` y en `/distribuidora/nueva` | — | — | — |
| Personal (3.2): invitar central o reparto en `/central/personal` (correo opcional, recomendado) y ver el enlace listo; "Compartir por WhatsApp" (el menú de compartir del equipo si lo tiene; si no, `wa.me/?text=`; 2026-10-16) y "Copiar enlace" | — | — | — | — | — | no ve | puede | puede en la suya | no ve (solo lectura) | — |
| Personal: invitar a un titular (con su correo de Google) | — | — | — | — | — | no ve | puede solo quien fundó (un co-titular no ve "Titular" entre los roles) | igual en la suya | no ve | — |
| Personal: anular una invitación que espera (pregunta antes) | — | — | — | — | — | no ve | puede | puede en la suya | puede | — |
| Personal: cambiar el rol de otro, desactivarlo o reactivarlo (pregunta antes de desactivar y reactivar) | — | — | — | — | — | no ve | puede con central y reparto; con otro titular solo quien fundó; nunca consigo ni con quien fundó (sin botones en esas filas) | igual en la suya | no ve | — |
| Personal: ayudantes — añadir, renombrar, activar y desactivar (tope 30) | — | — | — | — | — | no ve | puede | puede en la suya | no ve | — |
| Unirse con un enlace vigente en `/unirme` | — | — | puede tras aceptar los términos | puede: entra al área de su rol con esa distribuidora elegida | puede en otra distribuidora | igual | igual | puede | rechaza en C o D (aviso en la tarjeta) | puede |
| Abrir un enlace vencido, usado, anulado, atado a otro correo o que no existe (2026-10-16: atado a otro correo y que no existe dicen lo mismo, "Esta invitación es para otra cuenta o no existe.", con su correo y "Cerrar sesión"; tras leerlo, `/unirme` quita el fragmento de la barra de direcciones) | — | — | — | ve "Esta invitación venció." / "ya se usó." / "fue anulada." / "es para otra cuenta o no existe." (con su correo y "Cerrar sesión") | igual | igual | igual | igual | igual | igual |
| Perder el acceso con el panel abierto porque su titular lo desactivó | — | — | — | — | → `/inicio` al momento, con el aviso "Ya no tienes acceso a {distribuidora}: te desactivaron en su personal…" | igual | — | — | — | — |
| Ver al momento un cambio del catálogo hecho en otra pantalla (otra pestaña, la central, el titular) | — | — | — | — | ve al volver a la pantalla, sin recargar | ve al volver a la pantalla, sin recargar | ve al volver a la pantalla, sin recargar | — | — | — |
| Reordenar el catálogo con la pantalla atrasada (otra persona lo reordenó un momento antes) | — | — | — | — | — | conserva lo que hizo la otra persona: el paso se da sobre el orden guardado y ve "El catálogo cambió en otra pantalla… Revisa el orden." | igual | — | — | — |
| Ver en `/central/personal`, sin recargar, a quien acaba de unirse y que su invitación ya no espera | — | — | — | — | — | — | ve al volver a la pantalla (por ejemplo, tras compartir el enlace por WhatsApp) | igual | — | — |
| Anular desde una pantalla atrasada una invitación que ya se usó | — | — | — | — | — | — | ve "Esa invitación ya se usó: desactiva a la persona si ya no debe entrar." y la invitación sale de la lista | igual | — | — |
| "Cerrar sesión" desde "Esta invitación es para otra cuenta de Google." | — | — | — | vuelve a `/ingresar?desde=%2Funirme#…` con el enlace, para entrar con la cuenta correcta | igual | igual | igual | igual | igual | igual |
| Ver "Cambios pedidos" en `/central` cuando hay nota | — | — | — | — | — | ve el estado y "La nota de Hornilla con el detalle la ve quien registró la distribuidora…" | quien fundó ve la nota; un co-titular, el mismo aviso que la central | — | — | — |
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
| Darse un rol en `members` (crear el propio sin invitación, o cambiar el propio) · borrar un miembro | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Darse super admin (`platformAdmins/{yo}`) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Crear o editar el perfil propio a mano, sin los consentimientos | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Guardar cualquier dato propio (perfil, aceptación, dirección, distribuidora) sin correo confirmado | — | rechaza | — | — | — | — | — | — | — | — |
| Crear el perfil o aceptar una versión con una sesión que no entró con Google (otro proveedor, aunque tenga el correo verificado) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Apropiarse de un enlace (`slugs/{slug}`) · borrar una ficha | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Catálogo (3.1): leer los productos **a la venta** de A (consulta con `where('active', '==', true)` y tope de 30) | puede | puede | puede | puede | puede | puede | puede | puede | puede | puede |
| Catálogo: leer los productos a la venta de una sin aprobar, suspendida o vencida | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede solo los suyos | rechaza |
| Catálogo: leer el catálogo entero de A (también lo retirado) o un producto retirado | rechaza | rechaza | rechaza | rechaza | puede | puede | puede | rechaza | rechaza | rechaza |
| Catálogo: cualquier consulta sin `limit` o con más de 30 | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Catálogo: añadir un producto, cambiar un precio, quitar o volver a poner a la venta, reordenar | rechaza | rechaza | rechaza | rechaza | rechaza | puede (PLAN §11, 2026-10-15) | puede | rechaza | rechaza (solo lectura) | rechaza |
| Catálogo: producto fuera de las 30 casillas, precio no entero, de 0, negativo o de más de S/ 999, balón completo igual o más barato que la recarga, otra moneda, campos de más; cambiar el peso o la moneda | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Catálogo: borrar un producto | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Personal (3.2): crear una invitación de central o reparto en A (por enlace, o atada a un correo) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede | rechaza | rechaza (solo lectura) | rechaza |
| Personal: crear una invitación de **titular** (siempre atada a un correo de Google) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede solo quien fundó; un co-titular no | rechaza | rechaza | rechaza |
| Personal: leer una invitación **con su código** (`get`) sin correo (con correo, 2026-10-16: solo la cuenta de ese correo y los titulares de su distribuidora; un código que no existe se rechaza igual) | rechaza | rechaza | rechaza | puede | puede | puede | puede | puede | puede | puede |
| Personal: listar las invitaciones de A · buscarlas en todas las distribuidoras | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede listar las suyas (tope 50); buscar en todas, no | rechaza | rechaza | rechaza |
| Personal: usar una invitación vigente (crea su `members` con el rol de la invitación y la marca usada, en un lote) | rechaza | rechaza | rechaza (sin perfil) | puede | rechaza (ya es miembro) | rechaza (ya es miembro) | rechaza (ya es miembro) | puede | puede si la distribuidora de la invitación puede escribirse | puede |
| Personal: usar una invitación vencida (7 días), usada, anulada, de otra distribuidora, atada a otro correo, en una distribuidora en solo lectura, o cuya autoría ya no es titular activo (desactivado, sin el rol, cuenta eliminada; la de titular, si no la creó quien fundó; 2026-10-16) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Personal: anular una invitación pendiente | rechaza | rechaza | rechaza | rechaza (aunque tenga el enlace) | rechaza | rechaza | puede (también en solo lectura) | rechaza | puede las suyas | rechaza |
| Personal: cambiar el rol de central o reparto, desactivarlo o reactivarlo (desactivar o quitar el rol a un co-titular, solo quien fundó, anula en el mismo lote sus invitaciones que esperan; 2026-10-16) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede | rechaza | rechaza (solo lectura) | rechaza |
| Personal: hacer titular a alguien, o cambiar o desactivar a un co-titular | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede solo quien fundó | rechaza | rechaza | rechaza |
| Personal: cambiar o desactivar a quien fundó · cambiarse o desactivarse a sí mismo | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Ayudantes (3.2): leer y listar los de A (tope 30) | rechaza | rechaza | rechaza | rechaza | puede | puede | puede | rechaza | rechaza | rechaza |
| Ayudantes: añadir (casillas `h00`…`h29`), renombrar, desactivar | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede | rechaza | rechaza (solo lectura) | rechaza |
| Promociones (3.5): leer las **publicadas** de A (consulta con `where('active', '==', true)` y tope de 20) | puede | puede | puede | puede | puede | puede | puede | puede | puede | puede |
| Promociones: leer las de una sin aprobar, suspendida o vencida | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede solo las suyas | rechaza |
| Promociones: leer todas las casillas de A (también sin publicar, terminadas o apagadas) | rechaza | rechaza | rechaza | rechaza | puede | puede | puede | rechaza | rechaza | rechaza |
| Promociones: crear (casillas `o00`…`o19`), renombrar, alargar, publicar una guardada, apagar | rechaza | rechaza | rechaza | rechaza | rechaza | puede (decisión del usuario, 2026-10-16) | puede | rechaza | rechaza (solo lectura) | rechaza |
| Promociones: acortar el cierre, cambiar precio, productos, tipo, topes o inicio de una guardada; volver a encender una apagada; más de 30 días; empezar en el pasado; porcentaje de más de 30; "hasta agotar stock" en las condiciones; borrar | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Catálogo (3.5): subir un precio de lista o dejar de vender el balón completo de un producto con promoción vigente o programada (`promotedUntil`) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza (bajarlo, puede) | rechaza (bajarlo, puede) | rechaza | rechaza | rechaza |
| Ayudantes: borrar | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Vehículos (3.3): leer y listar los de A (tope 30) | rechaza | rechaza | rechaza | rechaza | puede | puede | puede | rechaza | puede los suyos | rechaza |
| Vehículos: añadir (casillas `v00`…`v29`), cambiar tipo, nombre, placa o capacidad, sacar de uso (PLAN §11, 2026-10-16) | rechaza | rechaza | rechaza | rechaza | rechaza | puede | puede | rechaza | rechaza (solo lectura) | rechaza |
| Vehículos: placa en minúsculas o con espacios, capacidad 0, no entera o de más de 999, campos de más; cambiar la fecha de alta; borrar | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Stock de planta (3.4): leer el stock y su bitácora de movimientos de A (topes 30 y 50) | rechaza | rechaza | rechaza | rechaza | rechaza (PLAN §11, 2026-10-16) | puede | puede | rechaza | puede el suyo | rechaza |
| Stock de planta: ajustar (stock y su movimiento en el mismo lote, con motivo, autor y diferencia exacta) | rechaza | rechaza | rechaza | rechaza | rechaza | puede | puede | rechaza | rechaza (solo lectura) | rechaza |
| Stock de planta: cambiar el stock sin movimiento, movimiento sin cambio, diferencia que no cuadra, dejarlo bajo cero, reusar un movimiento viejo, "otro" sin nota, firmar con otro autor o nombre; editar o borrar un movimiento o un stock | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza |
| Nota de la plataforma (3.2): leer su texto (`private/review`) | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede solo quien fundó (un co-titular no) | rechaza | puede solo la suya, quien fundó | puede |
| Nota de la plataforma: saber que hay una (marca `reviewNoteAt` en `private/control`) | rechaza | rechaza | rechaza | rechaza | puede | puede | puede | rechaza | puede la suya | puede |
| Nota de la plataforma: escribir o borrar su texto | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | rechaza | puede, junto a su marca |
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
- **Una sesión que no es de Google, en la pantalla**: una persona no tiene forma de abrirla desde
  la app (solo existe "Continuar con Google"). Se probó solo el intento directo contra las reglas
  (§3, todo rechazado salvo la ficha pública de una aprobada); qué muestra la pantalla con esa
  sesión no se recorrió.
- **Repartidor y central de B** (`driverB`, `dispatcherB`): el recorrido de 2026-10-14 entró con
  los de A; los de B se cubren por el aislamiento de §3.

- **Catálogo y personal en pantalla (3.1, 3.2)**: recorridos por role-walker el 2026-10-15
  (§5). Quedan sin recorrer: `dispatcherB` y `driverB` en sus pantallas (cubiertos por el
  aislamiento de §3); un **co-titular desactivado o bajado a central con el panel abierto** (se
  probó solo con reparto y central); **"Compartir por WhatsApp"** abierto de verdad (se comprobó
  el enlace `wa.me/?text=` y el mensaje, no la app de WhatsApp); el **portapapeles de un celular
  real** ("Copiar enlace" se probó en el navegador de escritorio); una **distribuidora vencida
  (D) con una invitación creada antes de vencer** (se probó con B suspendida en vivo: la tarjeta
  se ve y "Unirme" responde "la distribuidora no puede sumar personal ahora").

## 4b. Celdas que hoy no cumplen lo que dice la matriz

Cada una tiene su test con `test.fail` en `tests/e2e/flows/role-walker.spec.ts`. Del alta de
distribuidora quedan dos, las dos a la espera de una decisión sobre almacenamiento
(guardar el borrador o la marca de "alta terminada" fuera de la memoria pasa por
`docs/legal/cookies.md`):

- **Recargar a mitad del alta** vacía lo escrito (el borrador vive solo en memoria).
- **Recargar la central recién creada y pulsar Atrás** muestra el paso 1 del alta vacío.

Arregladas el 2026-10-15 (sus tests quedaron como tests normales), las nueve de la cuarta
pasada (catálogo y personal): el catálogo (`/central/catalogo`, `/reparto/catalogo`) y
`/central/personal` se releen al volver a la pantalla (no en vivo, PLAN §11); subir o bajar un
producto da el paso sobre el orden guardado y avisa si la pantalla estaba atrasada; quien es
desactivado lee que perdió el acceso a esa distribuidora; el título de un producto ya no se corta
a 1440 px; el formulario de producto es un paso del historial (Atrás lo cierra); el foco vuelve
al botón de venta de su fila; el error del nombre de un ayudante queda bajo su campo; "Cerrar
sesión" desde una invitación para otra cuenta vuelve a ella pasando por `/ingresar`. Además, las
invitaciones vencidas se pliegan en "Vencidas (N)" y, a 390 px, cada invitación muestra
"Compartir por WhatsApp" en una línea y "Copiar enlace" con "Anular" debajo.

Arregladas el 2026-10-14 (sus tests quedaron como tests normales), las cinco de la tercera
pasada: cerrar la ventana de Google se responde en 1–2 s con "Se canceló el ingreso." y el
botón libre; el mensaje se borra al volver a pulsar y el doble clic no selecciona el texto de
debajo; con dos pestañas en `/aceptar-terminos`, la otra sale cuando una acepta; un nombre largo
sin espacios se parte en el saludo de `/inicio` (en la lateral y en `/cuenta` ya se recortaba);
la pantalla de correo sin confirmar tiene su título como encabezado principal.

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
| 2026-10-14 | Tercera pasada, sobre el ingreso solo con Google: primera entrada con el botón y la ventana del emulador (cuenta nueva, cancelar, doble clic, Atrás, Adelante y recarga en `/aceptar-terminos`, eliminar y volver a entrar, cerrar sesión ahí); destino `desde` conservado con y sin términos, y valores raros ignorados; `/restablecer` y `/verificar-correo` con y sin sesión; todos los enlaces y textos de portada, entrada, pie, no existe, contacto, documentos legales y `/cuenta`; recorrido completo de CL, RE, CE, DU, DO, DS (C y D), SA, ST y SV con recarga y Atrás; cierre de sesión con dos pestañas y cambio de cuenta en la misma; intento directo con sesiones de otro proveedor y anónimas sobre cuentas con perfil y membresía, y con una sesión de Google sin perfil. Sin CRÍTICO ni ALTO; 1 medio y 4 bajos (§4b) | `fase-2/pendientes-del-cierre` |
| 2026-10-14 | Arreglos de la tercera pasada (no es una pasada nueva): los cinco de §4b. Además, el nombre de Google llega a términos sin espacios sobrantes y la banda "¿Tienes una distribuidora?" de la portada lleva a una visita a `/registro?desde=/distribuidora/nueva` (PLAN §11). Quedan con `test.fail` las dos del alta de §4b | `fase-2/pendientes-del-cierre` |
| 2026-10-15 | No es una pasada: filas de §3 para el personal, los ayudantes y la nota de la plataforma (paso 3.2, solo lado de datos). La fila "darse un rol" deja de incluir "cambiar el rol de otro", que ahora puede el titular con sus límites | `fase-3/catalogo` |
| 2026-10-15 | No es una pasada: filas de `/central/personal` y `/unirme` en §1 y §2 (pantallas del paso 3.2). **Falta la pasada de `role-walker`** | `fase-3/catalogo` |
| 2026-10-15 | No es una pasada: la central cambia el catálogo y los precios igual que el titular (decisión del usuario, PLAN §11); filas de `/central/catalogo` en §1, §2 y §3. **Falta la pasada de `role-walker`** | `fase-3/catalogo` |
| 2026-10-15 | Cuarta pasada, sobre el catálogo (3.1) y el personal, las invitaciones y los ayudantes (3.2), a 390 y 1440 px en claro y oscuro: precios raros, balón completo igual o más barato, marcas largas, invisibles o con emojis, "Otro peso", doble clic, reordenar con teclado, quitar y poner a la venta, `/d/{slug}` y el buscador; dos personas editando el mismo producto; Atrás y recarga con el formulario abierto; suspensión en vivo con el formulario abierto; invitar sin y con correo, unirse sin sesión pasando por ingreso y términos, enlace usado, anulado, vencido, cortado, editado, de otra distribuidora o de otra cuenta, cambio de cuenta en la misma pestaña, repartidora en dos distribuidoras; cambio de rol, desactivar y reactivar con el panel abierto; co-titular y nota de la plataforma; ayudantes hasta el tope; ruta e intento directo con el SDK de cada rol contra productos, invitaciones, miembros, ayudantes y la nota (todo lo prohibido, rechazado). Filas nuevas en §2. Sin CRÍTICO ni ALTO; 4 medios y 5 bajos (§4b) | `fase-3/catalogo` |
| 2026-10-15 | Arreglos de la cuarta pasada (no es una pasada nueva): las nueve de §4b, más las invitaciones vencidas plegadas y los botones de cada invitación a 390 px. Quedan con `test.fail` las dos del alta de §4b | `fase-3/catalogo` |
| 2026-10-16 | No es una pasada: filas de §3 para vehículos (3.3) y stock de planta (3.4), solo lado de datos. Titular y central escriben los dos (decisión del usuario); el reparto lee los vehículos y no ve el stock. **Falta la pasada de `role-walker`** cuando haya pantallas | `fase-3/vehiculos-stock` |
