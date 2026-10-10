# Cookies y almacenamiento en tu dispositivo

> **BORRADOR v0.1 (2026-10-10) — pendiente de revisión por un profesional antes del lanzamiento.**

Hornilla guarda en tu navegador solo lo necesario para funcionar. **No usa cookies de publicidad
ni de seguimiento, ni herramientas de analítica de terceros.**

## Qué se guarda

| Qué | Para qué | Cuánto dura |
|---|---|---|
| Sesión iniciada | No pedirte la contraseña cada vez | Hasta que cierres sesión |
| Copia local de tus datos recientes (tu perfil, tus direcciones y las distribuidoras que consultaste) | Abrir rápido, funcionar con mala señal y gastar menos datos | Hasta que cierres sesión: al cerrarla se borra de este dispositivo. Si el navegador no deja borrarla en ese momento, se borra la próxima vez que abras Hornilla, antes de usarla |
| Distribuidora elegida, junto con el identificador interno de tu cuenta (solo si trabajas en una distribuidora) | Abrir tu panel en la última distribuidora que elegiste | Hasta que elijas otra o cierres sesión |
| Marca interna de la sesión en este dispositivo (un código al azar, que no te identifica) | Saber qué copia local hay que borrar al cerrar sesión y terminar de borrarla si quedó pendiente | Hasta que se borra la copia local |
| Marca de que ya viste el aviso de almacenamiento | No mostrártelo cada vez | Hasta que borres los datos del sitio. Cerrar sesión no la borra |

El modo claro u oscuro no se guarda: la aplicación sigue el ajuste de tu dispositivo.

Técnicamente se usan el almacenamiento local y la base de datos interna del navegador. Hornilla no
crea cookies propias. Si eliges "Continuar con Google", se abre una ventana de Google, que usa sus
propias cookies para reconocer tu cuenta de Google según su política; Hornilla no las lee.

## Lo que se añadirá más adelante
Todavía no existen. Esta página se actualizará antes de activarlos:
- Archivos de la aplicación, para instalarla y abrirla sin conexión; durarán hasta la siguiente
  actualización.
- Identificador para avisos, para enviarte el estado de tu pedido si lo permites; durará hasta
  que desactives los avisos o cierres sesión.

## Qué puedes hacer
- Cerrar sesión borra de este dispositivo la sesión iniciada, la copia local de tus datos y la
  distribuidora elegida, también en las otras pestañas de Hornilla que tengas abiertas. Solo
  queda la marca de que ya viste el aviso de almacenamiento.
- Si hiciste cambios sin conexión que todavía no se enviaron, al cerrar sesión la aplicación te
  avisa antes: si cierras igual, esos cambios se pierden.
- Si tu sesión termina sin que tú la cierres (por ejemplo, porque la cuenta se deshabilita o se
  elimina), la copia local se borra cuando la aplicación lo detecta: al abrirla o, con la
  aplicación abierta, como mucho alrededor de una hora después. Si no vuelves a abrir Hornilla en
  ese dispositivo, la copia se queda ahí hasta que borres los datos del sitio.
- Puedes borrar los datos del sitio desde los ajustes de tu navegador; tendrás que volver a ingresar.
- En un dispositivo compartido o prestado, cierra sesión al terminar. El borrado usa el mecanismo
  normal del navegador y no sobrescribe el disco: si quieres más seguridad, borra además los
  datos del sitio.
- Los permisos de ubicación y de avisos se conceden y se retiran desde tu navegador o celular.
  Hornilla todavía no los pide.

## Aviso en la aplicación
Como solo se usa almacenamiento necesario, Hornilla muestra un aviso informativo la primera vez,
con enlace a esta página, y no un panel de consentimiento. **Si en el futuro se añade analítica o
publicidad, antes se pedirá tu consentimiento expreso** y esta página se actualizará.

## Historial de cambios
- 0.1, tercera redacción (2026-10-10): cerrar sesión ahora borra la copia local y la
  distribuidora elegida, en todas las pestañas; se explica qué pasa con los cambios sin enviar y
  cuando la sesión termina sin que la cierres; se añade la marca interna de la sesión.
- 0.1, segunda redacción (2026-10-10): primera revisión de cumplimiento. La tabla dice lo que la
  aplicación guarda hoy; se corrige que cerrar sesión no borra la copia local ni la distribuidora
  elegida; se aclara que el modo claro u oscuro no se guarda y que los archivos sin conexión y el
  identificador para avisos todavía no existen; se menciona la ventana de Google.
- 0.1 (2026-10-10): primer borrador.
