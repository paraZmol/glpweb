---
name: testing-strategy
description: Estrategia de pruebas de glpWEB — qué se prueba en cada nivel (dominio, reglas de seguridad, componentes, flujos de navegador con varios actores, condiciones de calle, rendimiento y accesibilidad), dónde va cada test, cómo se nombran, datos de semilla, carriles para correr en paralelo, qué hacer con tests inestables, presupuestos de rendimiento y la puerta antes de unir a main. Cargar ANTES de escribir, cambiar o revisar cualquier test, y al cerrar un paso o una fase.
---

# Estrategia de pruebas

Objetivo: que un fallo aparezca en la rama, no en la calle con un repartidor a medio pedido.
Aquí no hay servidor que proteja de un error: las reglas y el dominio **son** la protección, así
que se prueban como lo más importante del proyecto.

## 1. Niveles — qué va dónde

| Nivel | Qué prueba | Herramienta | Dónde | Quién |
|---|---|---|---|---|
| 1. Dominio | Estados, dinero, stock, ETA, validaciones. Puro, sin red. | Vitest | junto al archivo: `*.test.ts` | quien construye + `qa-tester` |
| 2. Reglas | Quién puede y quién no; transiciones; aislamiento A/B. | `@firebase/rules-unit-testing` + emulador | `firebase/tests/*.rules.test.ts` | `backend-builder` + `rules-breaker` |
| 3. Repositorios | Transacciones y consultas reales contra el emulador (carreras, límites). | Vitest + emulador | `src/data/*.emu.test.ts` | `backend-builder` |
| 4. Componentes | Estados (cargando/vacío/error), accesibilidad, interacción. Solo los que tienen lógica. | Vitest + Testing Library | junto al componente | `frontend-builder` |
| 5. Flujos | Recorridos completos por rol, varios actores a la vez, celular y escritorio. | Playwright + emuladores | `tests/e2e/*.spec.ts` | `qa-tester`, `flow-tester` |
| 6. Calle | Sin conexión, señal lenta, GPS denegado/impreciso, segundo plano, instalación PWA. | Playwright (red y permisos simulados) | `tests/e2e/field/*.spec.ts` | `field-tester` |
| 7. Calidad medible | Peso del paquete, Lighthouse, accesibilidad automática (axe), movimiento reducido. | Lighthouse, `@axe-core/playwright` | `tests/e2e/quality/*.spec.ts` | `perf-a11y-auditor` |

Regla de reparto: lo que se puede probar abajo **no** se prueba arriba. Un cálculo va al nivel 1,
no a un E2E. Los E2E son pocos, valiosos y de recorrido completo.

## 2. Cobertura obligatoria
- Cada función de `src/domain/`: camino feliz + cada rama de rechazo + bordes
  (0, negativo, máximo, vacío, tildes/ñ/emoji, montos grandes).
- Cada colección: test de "otra distribuidora no puede" y "distribuidora suspendida no escribe".
- Cada transición de `glp-domain`: la válida pasa y **todas** las inválidas fallan (tabla generada, no a mano).
- Cada invariante de `glp-domain` §6: un test con ese número en el nombre.
- Cada criterio de aceptación del plan: al menos un test que lo demuestra, citando el paso
  (`// PLAN 4.5`).
- Cada bug corregido: primero el test que lo reproduce, luego el arreglo. El test se queda.

## 3. Flujos de varios actores (lo propio de esta app)
Un pedido lo tocan tres personas a la vez. Estos recorridos existen siempre y corren en cada rama:
1. Cliente pide → aparece al repartidor → acepta → cliente ve "en camino" → llega → cobra → cliente califica.
2. Central registra pedido telefónico → asigna → repartidor entrega → central lo ve cerrado.
3. Dos repartidores aceptan el mismo pedido al mismo tiempo → uno gana, el otro ve aviso claro.
4. Jornada completa: declarar → aprobar → vender → cuadre → liquidar → stock cuadra.
5. Dueño de A no ve nada de B en ninguna pantalla ni por URL directa.
Cada actor es un `browser.newContext()` propio; las esperas son sobre lo que se **ve**
(`expect(...).toBeVisible()`), nunca `waitForTimeout`.

## 4. Datos y entorno
- Solo emuladores (`demo-glpweb`). Nunca el proyecto real.
- Semilla única y determinista en `tests/seed/` (dos distribuidoras A y B, un usuario por rol en
  cada una, catálogo, una jornada aprobada). Cuentas y datos **inventados**: el repo es público.
- Cada test deja el mundo como lo encontró o usa ids propios; ningún test depende del orden.
- Hora fija inyectada en dominio; en navegador `page.clock` cuando el tiempo importa.
- Ubicación: `context.setGeolocation` + permiso; rutas y teselas externas interceptadas
  (`page.route`) con respuestas grabadas: los tests no dependen de internet ni de OSM/OSRM.
- **Carriles**: agentes en paralelo usan `E2E_LANE=N` (puerto y carpeta de salida propios) y un
  `projectId` de emulador propio (`demo-glpweb-N`) para no pisarse los datos.

## 5. Nombres y forma
- Nombre = comportamiento en una frase: `rejects delivery without payment`.
- Arrange / Act / Assert visibles; un comportamiento por test.
- Selectores por rol y nombre accesible (`getByRole('button', { name: 'Ya llegué' })`), nunca por clase CSS.
- Sin lógica en los tests (ni `if`, ni bucles que oculten casos): tablas con `it.each`.

## 6. Tests inestables
Un test que falla a veces es un bug (de la app o del test), no ruido.
- Prohibido: reintentos para taparlo, `waitForTimeout`, `.skip` sin fecha y motivo.
- Se reproduce en bucle (`--repeat-each=20`), se arregla la causa (casi siempre una espera sobre
  tiempo en vez de sobre estado, o datos compartidos).
- Si no se puede arreglar hoy: `test.fixme` con comentario, fecha y entrada en el plan.

## 7. Presupuestos (fallan el CI si se superan)
- JavaScript inicial ≤ 200 KB gzip; el mapa y cada área de rol se cargan diferidos.
- Lighthouse móvil en la página pública: rendimiento ≥ 85, accesibilidad ≥ 95, PWA instalable.
- axe: cero violaciones `serious` o `critical` en cada pantalla.
- Sin errores en consola en ningún E2E.
- Sin desplazamiento lateral a 360 px.

## 8. Qué corre cuándo
| Momento | Qué corre |
|---|---|
| Mientras se construye | el test del archivo tocado (`vitest <ruta>`, `playwright test <spec>`) |
| Antes de cada commit | `npm run check` |
| En cada push (CI) | `check` + todos los E2E, móvil y escritorio |
| Antes de unir a `main` | lo anterior en verde + `regression-guard` |
| Al cerrar una fase | todo + `field-tester` + `perf-a11y-auditor` + `security-auditor` + lista de prueba manual |

## 9. Lo que solo se puede probar a mano
GPS real en movimiento, pantalla al sol, push en iPhone instalado, batería. Cada fase que lo
toque entrega una **lista corta de prueba en celular real** para el usuario (pasos numerados y qué
debe ver). No se declara terminada sin ese resultado anotado en el plan.

## 10. Lista antes de dar un test por bueno
1. ¿Falla si rompo a propósito lo que prueba? (compruébalo una vez)
2. ¿Está en el nivel más bajo posible?
3. ¿Incluye al que **no** debe poder?
4. ¿Espera sobre estado visible, no sobre tiempo?
5. ¿Corre solo, en cualquier orden y sin internet?
6. ¿El nombre dice qué se rompió cuando falle?
