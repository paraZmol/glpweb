# Cookies y almacenamiento en tu dispositivo

> **BORRADOR v0.1 (2026-10-10) — pendiente de revisión por un profesional antes del lanzamiento.**

Hornilla guarda en tu navegador solo lo necesario para funcionar. **No usa cookies de publicidad
ni de seguimiento, ni herramientas de analítica de terceros.**

## Qué se guarda

| Qué | Para qué | Cuánto dura |
|---|---|---|
| Sesión iniciada | No pedirte la contraseña cada vez | Hasta que cierres sesión |
| Copia local de tus datos recientes (tu perfil, las distribuidoras que consultaste y, cuando existan, tus direcciones) | Abrir rápido, funcionar con mala señal y gastar menos datos | Hasta que cierres sesión: al cerrarla se borra de este dispositivo. Si el navegador no deja borrarla en ese momento, se borra la próxima vez que abras Hornilla, antes de usarla. Si usas Hornilla sin cuenta, la copia solo contiene fichas públicas de distribuidoras y dura hasta que borres los datos del sitio |
| Último punto desde el que buscaste distribuidoras: sus coordenadas, redondeadas a tres decimales (unos cien metros), la fecha y la hora en que se guardó y si las dio tu dispositivo o las escribiste. Se guarda aunque no tengas cuenta | Mostrarte otra vez quién llega hasta ahí sin volver a preguntártelo | Hasta que toques "Olvidar esta ubicación", busques desde otro punto (que lo reemplaza) o cierres sesión. Con cuenta o sin ella, caduca a los 30 días de haberse guardado: volver a ver la lista no renueva ese plazo. Pasado el plazo se borra la siguiente vez que abres el buscador de Hornilla; si no vuelves a abrirlo, queda sin usar hasta que borres los datos del sitio |
| Nombre y celular que escribiste al crear tu cuenta, junto con el identificador interno de esa cuenta. Se guardan solo en la pestaña en la que te registraste | No pedírtelos otra vez cuando, ya verificado tu correo, aceptas los términos: hasta entonces Hornilla no los guarda en tu cuenta | Hasta que aceptas los términos, eliminas la cuenta sin aceptarlos, cierras sesión o cierras esa pestaña. Otras pestañas no los ven, salvo una que dupliques a partir de ella |
| Distribuidora elegida, junto con el identificador interno de tu cuenta (solo si trabajas en una distribuidora) | Abrir tu panel en la última distribuidora que elegiste | Hasta que elijas otra o cierres sesión |
| Marca interna de la sesión en este dispositivo (un código al azar, que no te identifica) | Saber qué copia local hay que borrar al cerrar sesión y terminar de borrarla si quedó pendiente | Hasta que se borra la copia local |
| Marca de que ya viste el aviso de almacenamiento | No mostrártelo cada vez | Hasta que borres los datos del sitio. Cerrar sesión no la borra |

El modo claro u oscuro no se guarda: la aplicación sigue el ajuste de tu dispositivo.

El último punto de búsqueda se queda en tu dispositivo: no se guarda en tu cuenta ni se envía a
Hornilla. La lista de distribuidoras se descarga igual para todos y es tu navegador el que calcula
cuáles llegan hasta ese punto.

Técnicamente se usan el almacenamiento local, el almacenamiento de sesión de la pestaña (solo para
el nombre y el celular del registro) y la base de datos interna del navegador. Hornilla no crea
cookies propias. El servicio de Google que aloja las cuentas y los datos (Firebase) guarda en
esas mismas áreas sus propios registros técnicos, por ejemplo para coordinar varias pestañas
abiertas o para terminar el ingreso con Google cuando el navegador no deja abrir una ventana;
Hornilla no los usa para publicidad ni para seguirte. Si eliges "Continuar con Google", se abre una
ventana de Google, que usa sus propias cookies para reconocer tu cuenta de Google según su política;
Hornilla no las lee.

## Lo que se añadirá más adelante
Todavía no existen. Esta página se actualizará antes de activarlos:
- Archivos de la aplicación, para instalarla y abrirla sin conexión; durarán hasta la siguiente
  actualización.
- Identificador para avisos, para enviarte el estado de tu pedido si lo permites; durará hasta
  que desactives los avisos o cierres sesión.

## Qué puedes hacer
- Tocar "Cambiar" y luego "Olvidar esta ubicación" en el buscador borra el último punto de
  búsqueda, tengas o no cuenta.
- Cerrar sesión borra de este dispositivo la sesión iniciada, la copia local de tus datos, la
  distribuidora elegida, el último punto de búsqueda y el nombre y el celular del registro que
  estuvieran pendientes, también en las otras pestañas de Hornilla que tengas abiertas. Solo queda
  la marca de que ya viste el aviso de almacenamiento. Si el navegador se cierra justo en ese
  momento, lo que falte se borra la próxima vez que abras Hornilla en ese dispositivo.
- Si hiciste cambios sin conexión que todavía no se enviaron, al cerrar sesión la aplicación te
  avisa antes: si cierras igual, esos cambios se pierden.
- Si tu sesión termina sin que tú la cierres (por ejemplo, porque la cuenta se deshabilita o se
  elimina), la copia local y el último punto de búsqueda se borran cuando la aplicación lo
  detecta: al abrirla o, con la aplicación abierta, como mucho alrededor de una hora después. Si no vuelves a abrir Hornilla en
  ese dispositivo, la copia se queda ahí hasta que borres los datos del sitio.
- Puedes borrar los datos del sitio desde los ajustes de tu navegador; tendrás que volver a ingresar.
- En un dispositivo compartido o prestado, cierra sesión al terminar. El borrado usa el mecanismo
  normal del navegador y no sobrescribe el disco: si quieres más seguridad, borra además los
  datos del sitio.
- El permiso de ubicación solo se pide cuando tocas "Usar mi ubicación" (en el buscador o al
  registrar una distribuidora), después de leer para qué se usa. Puedes negarlo y escribir el
  punto a mano: la aplicación funciona igual. Se concede y se retira desde tu navegador o celular.
- El permiso de avisos todavía no se pide.

## Aviso en la aplicación
Como solo se usa almacenamiento necesario, Hornilla muestra un aviso informativo la primera vez,
con enlace a esta página, y no un panel de consentimiento. **Si en el futuro se añade analítica o
publicidad, antes se pedirá tu consentimiento expreso** y esta página se actualizará.

## Historial de cambios
- 0.1, séptima redacción (2026-10-11): tercera revisión de cumplimiento. Se precisa que el
  último punto de búsqueda caduca a los 30 días de haberse guardado (no de la última vez que se
  usó), que se borra al abrir el buscador pasado ese plazo y que guarda fecha y hora; que una
  pestaña duplicada hereda el nombre y el celular pendientes del registro.
- 0.1, sexta redacción (2026-10-11): el último punto de búsqueda se guarda redondeado a unos
  cien metros, con su fecha, y se descarta solo a los 30 días; el destino al que ibas antes de
  registrarte viaja en el historial de la pestaña, no en el almacenamiento.
- 0.1, quinta redacción (2026-10-11): se añade el nombre y el celular del registro, que quedan en
  la pestaña hasta que se verifica el correo y se aceptan los términos; cerrar sesión los borra;
  si el navegador se cierra al cerrar sesión, el borrado termina al abrir Hornilla de nuevo.
- 0.1, cuarta redacción (2026-10-10): segunda revisión de cumplimiento. Se añade el último punto
  de búsqueda, que se guarda también sin cuenta y se borra con "Olvidar esta ubicación" y al cerrar
  sesión; se explica que no sale del dispositivo; el permiso de ubicación ya se pide, tras tocar
  un botón; se aclara qué copia local queda cuando se usa Hornilla sin cuenta y que el servicio de
  Google guarda sus propios registros técnicos.
- 0.1, tercera redacción (2026-10-10): cerrar sesión ahora borra la copia local y la
  distribuidora elegida, en todas las pestañas; se explica qué pasa con los cambios sin enviar y
  cuando la sesión termina sin que la cierres; se añade la marca interna de la sesión.
- 0.1, segunda redacción (2026-10-10): primera revisión de cumplimiento. La tabla dice lo que la
  aplicación guarda hoy; se corrige que cerrar sesión no borra la copia local ni la distribuidora
  elegida; se aclara que el modo claro u oscuro no se guarda y que los archivos sin conexión y el
  identificador para avisos todavía no existen; se menciona la ventana de Google.
- 0.1 (2026-10-10): primer borrador.
