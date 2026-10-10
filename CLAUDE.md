# glpWEB — nombre comercial: Hornilla

Plataforma única donde la gente pide gas a la distribuidora y marca que prefiera, y SaaS para
esas distribuidoras (GLP) en Perú. En la interfaz el producto se llama **Hornilla**; `glpWEB` es
solo el nombre interno (carpeta, repo, proyecto Firebase).
Pedidos por web/app y por teléfono, jornada y cuadre de caja del repartidor, stock de planta y
mapa en tiempo real. Una sola app web adaptativa e instalable (PWA). Roles: super admin, dueño,
central, repartidor, cliente.

## Fuente de verdad
- El plan vive en [docs/PLAN.md](docs/PLAN.md). Al terminar un paso, marcarlo `[x]` con fecha.
  **Si una decisión cambia, se cambia primero el plan** (§11 "Registro de cambios") y después el
  código. Nada se construye si no está en el plan.
- Conocimiento del negocio heredado (solo lectura, no copiar código Flutter):
  `../GLP-DEV/.agents/memory/` (SCHEMA, CASOS_DE_USO, DECISIONS, ALGORITMO) y
  `../GLP-DEV/docs/design/`. Nunca abrir ni citar `../GLP-DEV/CREDENCIALES.txt`.
- Forma de trabajar heredada de `../peluWeb` (agentes, skills, proceso de diseño).

## Stack fijo (aprobado 2026-10-10; no re-litigar sin pasar por el plan)
- **React 19 + TypeScript + Vite** (SPA) · **Tailwind 4 + shadcn/ui + Motion** · lucide.
- **PWA** con `vite-plugin-pwa`. Capacitor solo en la fase 11.
- **Firebase plan gratis (Spark)**: Auth (correo + Google), Firestore, Realtime Database (solo
  posiciones en vivo), Hosting, FCM. **Prohibido** depender de Cloud Functions, Storage, SMS o
  cualquier cosa que pida plan de pago o tarjeta.
- **Mapas**: detrás de `MapProvider`; primera opción MapLibre GL + OpenFreeMap, respaldo Leaflet +
  OpenStreetMap (se decide en el paso 6.0), rutas OSRM. Nunca Google Maps SDK.
- **Servidor mínimo**: Cloudflare Worker gratis en `worker/` (desde la fase 7).
- **Pruebas**: Vitest, Firebase Emulator + `@firebase/rules-unit-testing`, Playwright.
- Proyecto Firebase real: `glpweb-app` (https://glpweb-app.web.app). Emuladores: `demo-glpweb`.
- Comandos: `npm run dev` · `npm run emulators` · `npm run check` · `npm run e2e`.

## Entorno local (Windows)
- Shell principal PowerShell. Node 24, npm 11, Firebase CLI 15 (sesión iniciada con la cuenta
  del usuario), Flutter no se usa aquí.
- Desarrollo y tests siempre contra **emuladores**; nunca escribir datos de prueba en el
  proyecto Firebase real.
- Desplegar reglas o hosting al proyecto real es una acción hacia afuera: confirmar antes.
- **Carriles** (`E2E_LANE=N`, de 0 a 9; 0 por defecto): cada carril tiene sus propios puertos de
  emuladores y de vista previa, así dos agentes corren `npm run check`, `npm run emulators` o
  `npm run e2e` a la vez sin pisarse. Los emuladores se lanzan siempre con
  `scripts/emulators.mjs` (lo hacen los scripts de npm): se niega a arrancar si el carril está
  ocupado y al terminar cierra los emuladores de su carril, también si algo falla. Cada emulador
  sube 10 por carril; la vista previa sube 1 (fuente: `scripts/lane-ports.mjs`).

  | Carril | Auth | Firestore | Firestore WS | Database | Hosting | UI | Hub | Logging | Vista previa |
  |---|---|---|---|---|---|---|---|---|---|
  | 0 | 9099 | 8080 | 9150 | 9000 | 5000 | 4000 | 4400 | 4500 | 4173 |
  | 1 | 9109 | 8090 | 9160 | 9010 | 5010 | 4010 | 4410 | 4510 | 4174 |
  | 3 | 9129 | 8110 | 9180 | 9030 | 5030 | 4030 | 4430 | 4530 | 4176 |
  | N | 9099+10N | 8080+10N | 9150+10N | 9000+10N | 5000+10N | 4000+10N | 4400+10N | 4500+10N | 4173+N |

## Reglas de arquitectura
1. **Aislamiento entre distribuidoras**: todo dato de negocio vive bajo `/distributors/{d}/…`.
   El rol se lee de `members/{uid}` en las reglas. Cada colección tiene un test que demuestra
   que la distribuidora A no lee ni escribe lo de B.
2. **Las reglas de seguridad son el backend**: ocultar un botón no es seguridad. Transiciones
   de estado, precios congelados, quién aprueba qué y solo-lectura por suspensión se hacen
   cumplir en `firebase/*.rules` y tienen test. Cargar skill `firebase-tenancy` antes de tocar
   datos o reglas.
3. **Dominio en un solo lugar**: estados, transiciones, dinero y stock viven en `src/domain/`
   (puro, sin Firebase ni React). La lista de estados del pedido no se repite en ningún otro
   archivo. Cargar skill `glp-domain` antes de tocar pedidos, jornada, cobro o stock.
4. **Solo `src/data/` importa `firebase/*`.** Las pantallas usan repositorios y hooks.
5. **Dinero**: enteros en céntimos, moneda por distribuidora (`PEN`). Nunca `float`.
6. **Escrituras a más de un documento**: siempre transacción o batch.
7. **Cuota gratis**: toda consulta lleva límite y filtro (por día, por estado). Nunca escuchar
   una colección entera. Las posiciones van a RTDB, no a Firestore. Conectar RTDB solo con un
   mapa abierto o una jornada activa.
8. **Nada atado a una empresa**: coordenadas, teléfonos, marcas, pesos, límites y colores son
   datos de la distribuidora.
9. **Sin secretos en git**: `.env*`, cuentas de servicio y claves fuera del repo. La config web
   de Firebase es pública por diseño; la seguridad está en las reglas.
10. Campos nuevos en documentos existentes: siempre opcionales o con valor por defecto al leer.

## Ramas y vuelta atrás
- `main` es siempre lo estable y lo publicado. **Nunca se trabaja directo en `main`.**
- Cada paso del plan va en su rama: `fase-N/descripcion-corta` (ej. `fase-2/alta-distribuidora`).
  Commits pequeños y frecuentes; se sube la rama para que el CI la pruebe.
- Se une a `main` con `git merge --no-ff` solo con CI en verde y los agentes de calidad pasados.
  La rama se conserva en GitHub hasta cerrar la fase.
- Al cerrar cada fase: etiqueta `vN.M-faseN` en `main`. Es el punto de retorno ante una emergencia
  (`git switch --detach <etiqueta>` para mirar; para volver de verdad, `git revert` del merge —
  nunca `reset --hard` ni `push --force` sobre `main`).
- Solo se despliega a Hosting desde `main`. Para mostrar una rama sin tocar producción: canal de
  vista previa (`firebase hosting:channel:deploy <nombre>`).
- El repo es **público**: antes de cada commit, comprobar que no entra nada personal ni secreto
  (correos, teléfonos, nombres de empresas reales, claves, datos de clientes).

## Convenciones
- Código, nombres de colecciones y comentarios en **inglés**; textos de interfaz en **español
  neutro** (sin asumir género). Precio `S/ 38.00`, hora `3:30 p. m.`.
- Cargar skill `clean-code` antes de crear archivos o refactorizar.
- Pantallas: cargar `ui-system`; en públicas y de alta, además `design-craft`.
- Ubicación, mapas, push o PWA: cargar `tracking-pwa`.
- Diseñar y probar siempre a 390 px y 1440 px, claro y oscuro.

## Calidad — antes de dar un paso por terminado
- `npm run check` en verde (formato, lint, tipos, unit y reglas) y E2E del flujo tocado.
- Lanzar **qa-tester**. Si tocó reglas, pedidos, jornada o stock → **rules-breaker**. Si tocó
  auth, roles, invitaciones, dinero o datos por distribuidora → **security-auditor**. Si tocó
  una pantalla → **visual-designer** y después **ux-reviewer**.
- La dirección visual la fija **design-director** (el usuario elige) y la construye
  **frontend-builder**. Fotos solo de `docs/design/images/` con licencia en `CREDITS.md`
  (las consigue **image-scout**); nunca URLs externas de imágenes en la app.
- **Pruebas**: cargar `testing-strategy` antes de escribir o revisar tests. Si tocó pedidos o
  jornada → **flow-tester** (varios actores a la vez). Si tocó ubicación, mapas, PWA, caché o
  pantallas del repartidor → **field-tester** (sin conexión, GPS, red lenta). Pantalla importante,
  dependencia o animación nueva → **perf-a11y-auditor**.
- **Movimiento**: cargar `motion-system` antes de añadir cargas, transiciones o animaciones.
  Ninguna pantalla en blanco al cargar; duraciones y curvas solo por fichas.
- **Oferta y textos de venta**: antes de diseñar productos, precios, promociones o textos que el
  cliente lee para comprar → **marketing-advisor** (deja su recomendación en `docs/marketing/`).
- **Legal**: si tocó registro, datos personales o de ubicación, promociones o precios visibles,
  permisos, o una dependencia que envíe datos a terceros → **legal-compliance**. Prohibido añadir
  analítica, publicidad o cualquier rastreo sin pasar antes por el plan: `docs/legal/cookies.md`
  promete que no los hay. Los documentos de `docs/legal/` se actualizan en el mismo cambio.
- **Antes de unir a `main`**: **regression-guard** debe dar APTO.
- **Antes de cada `git push` y de cada despliegue**: **publish-guard** debe dar PUBLICABLE. Es
  exclusivo para que no se divulgue nada en el repo público. Además corre solo
  `scripts/check-public.mjs` en cada commit (gancho en `.githooks/`) y en el CI; nunca saltarlo
  con `--no-verify`.
- Al cerrar cada fase: todos los agentes, y corregir CRÍTICO/ALTO antes de seguir.
- Agentes en paralelo que usen emuladores o Playwright: cada uno con su propio juego de puertos
  (`E2E_LANE=N`), nunca el del coordinador.
