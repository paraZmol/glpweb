---
name: tracking-pwa
description: Ubicación en tiempo real, mapas, PWA y avisos en glpWEB — captura de GPS del repartidor en el navegador, Wake Lock, frecuencia y filtrado, publicación en Realtime Database, estado "sin señal", mapas con Leaflet/OpenStreetMap y rutas OSRM detrás de MapProvider, tiempo estimado, instalación en Android/iOS/escritorio, comportamiento sin conexión y push con FCM. Cargar ANTES de tocar geolocalización, mapas, service worker, manifest, notificaciones o enlaces a WhatsApp/Maps.
---

# Tiempo real, mapas y PWA

## 1. Lo que el navegador puede y no puede
- `watchPosition` solo funciona con la app **visible**. Pantalla apagada o app en segundo plano
  = se detiene (Android e iOS). No hay truco fiable; no prometerlo.
- Por eso: **Wake Lock** (`navigator.wakeLock.request('screen')`) mientras hay jornada activa,
  re-pedido en `visibilitychange`. Aviso claro al repartidor: "Mantén la app abierta durante el reparto".
- Geolocalización exige HTTPS y permiso. Pedir el permiso con una pantalla previa que explique
  para qué; manejar denegado / GPS apagado / precisión mala con mensajes concretos.
- La solución de segundo plano es Capacitor (fase 11). El código de ubicación va detrás de una
  interfaz `LocationSource` para cambiar la implementación sin tocar pantallas.

## 2. Captura y publicación
- `enableHighAccuracy: true`, `maximumAge: 0`.
- Publicar cuando: pasaron ≥ 5 s **y** se movió ≥ 10 m (con pedido activo); ≥ 30 s libre.
  Descartar lecturas con `accuracy > 50 m`.
- Solo se publica con jornada `approved`. En pausa o sin jornada: nada.
- Destino: RTDB `/locations/{d}/{uid}` = `{ lat, lng, heading, speed, accuracy, ts, state }`
  y, con pedido activo, `/orderTracking/{orderId}`. Nunca a Firestore (cuota).
- `onDisconnect().update({ online: false })`.
- No se guarda historial de recorrido en el MVP (privacidad y cuota).

## 3. Mostrar
- Posición con `ts` de más de 60 s → "sin señal desde hace X min", marcador atenuado. Nunca
  mostrar una posición vieja como actual.
- Mover el marcador interpolando entre lecturas (animación ≤ 1 s), respetando `prefers-reduced-motion`.
- Cliente: su repartidor, su dirección, la ruta y el tiempo estimado. Siempre ofrecer **vista
  simple** (línea de tiempo sin mapa) para ahorrar datos.
- Central: todos los repartidores; color por estado (libre / con pedido / en pausa / sin señal),
  icono por vehículo, planta y pedidos pendientes. Lista lateral en escritorio, hoja inferior en celular.
- Suscribirse a RTDB al montar el mapa y cortar al desmontar (`goOffline` si no queda nadie).

## 4. Mapas
- Interfaz `MapProvider` (teselas, ruta, búsqueda de dirección, geocodificación inversa).
  Implementación inicial: Leaflet + teselas OSM, OSRM público, Nominatim/Photon.
- Respetar las políticas de uso: atribución visible de OpenStreetMap, caché de rutas en memoria,
  búsqueda con espera (debounce ≥ 600 ms) y máximo 1 petición por segundo, sin precarga masiva.
- Si la ruta falla: línea recta + distancia Haversine. El mapa nunca bloquea el pedido.
- Tiempo estimado: duración de OSRM si existe; si no, distancia / 20 km/h + 5 min.
- Elegir dirección: pin fijo al centro y se mueve el mapa; botón "Mi ubicación"; texto de
  referencia obligatorio (en Perú las direcciones no bastan).
- Enlaces externos armados con coordenadas, nunca con texto del usuario sin codificar:
  `https://www.google.com/maps/dir/?api=1&destination=lat,lng`, `https://wa.me/51…?text=…`.
- Cargar Leaflet de forma diferida (solo en pantallas con mapa).

## 5. PWA
- `vite-plugin-pwa` con `registerType: 'prompt'`: avisar "Hay una versión nueva" y actualizar al
  aceptar (nunca recargar sola en medio de un reparto).
- Manifest: nombre, iconos 192/512 + maskable, `display: standalone`, `theme_color`, accesos directos.
- Caché: app shell y fuentes precargadas; teselas del mapa con caché acotada; **nunca** cachear
  respuestas de Firebase en el service worker (ya lo hace el SDK).
- Instalación: botón propio con `beforeinstallprompt` en Android/escritorio; en iPhone, guía
  "Compartir → Añadir a pantalla de inicio".
- Sin conexión: banner visible; lecturas desde la caché de Firestore; acciones que necesitan
  transacción (aceptar, entregar, aprobar) se deshabilitan con explicación.

## 6. Push (fase 7)
- FCM web. Token por dispositivo en `/users/{uid}/devices/{id}`; borrar al cerrar sesión.
- En iPhone solo funciona con la PWA instalada (iOS 16.4+). Pedir permiso tras una acción del
  usuario, nunca al cargar.
- Envía el Worker de Cloudflare (verifica ID token y que el emisor tiene derecho sobre ese
  pedido). La clave de la cuenta de servicio vive como secreto del Worker, nunca en el repo.
- En primer plano: sonido + vibración + aviso dentro de la app (el push no se muestra solo).
- Respaldo siempre disponible: enlace a WhatsApp de la distribuidora.

## 7. Comprobación
- Probar con ubicación simulada en Playwright (`context.setGeolocation`, permiso concedido) y con
  permiso denegado.
- Probar el corte de señal (emulador detenido / `offline`) y el estado "sin señal".
- Lighthouse: PWA instalable y rendimiento móvil aceptable.
