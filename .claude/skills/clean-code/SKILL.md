---
name: clean-code
description: Orden y limpieza del código de glpWEB — dónde va cada archivo (dominio, datos, features, páginas, reglas), cómo se nombran las cosas, tamaños máximos, qué capa hace qué y la lista de revisión antes de dar algo por terminado. Cargar SIEMPRE antes de crear archivos nuevos, refactorizar o revisar código.
---

# Orden y limpieza

Regla cero: **consistencia antes que preferencia**. Antes de crear un archivo, mira uno hermano
y cópialo. Si esta skill y el código chocan, se actualiza la skill; nunca se introduce una
segunda manera de hacer lo mismo.

## 1. Dónde va cada cosa

| Qué | Dónde | Notas |
|---|---|---|
| Tipos y lógica pura del negocio | `src/domain/{orders,shifts,stock,money,geo}/` | Sin React, sin Firebase, sin hora interna. Con test unitario. |
| Acceso a Firebase | `src/data/` | Único lugar que importa `firebase/*`. Un repositorio por agregado. Rutas en `paths.ts`. |
| Casos de uso + hooks | `src/features/{dominio}/` | Une dominio y datos: `useActiveOrder`, `acceptOrder()`. |
| Pantallas | `src/pages/{public,customer,driver,office,platform}/` | Una carpeta por área de rol. Finas: componen. |
| Componentes | `src/components/{dominio}/`, `src/components/ui/` | `ui/` es shadcn: no se edita a mano. |
| Utilidades transversales | `src/lib/` | Mapas (`MapProvider`), formato, pwa, permisos. |
| Reglas e índices | `firebase/` | Con sus tests en `firebase/tests/`. |
| Servidor mínimo | `worker/` | Paquete aparte. |
| E2E | `tests/e2e/` | Playwright. |

Flujo obligatorio: `Página → hook/caso de uso (features) → dominio (decide) → repositorio (data)`.
Una página nunca llama a Firestore; el dominio nunca sabe que existe Firestore.

## 2. Tamaños máximos
Componente React 150 líneas · función 30 · archivo de dominio 200 · 4 parámetros (más → objeto)
· 2 niveles de anidación. Si no cabe, se parte.

## 3. Nombres
- Código en inglés; textos de interfaz en español neutro.
- Archivos `kebab-case`; componentes `PascalCase`; hooks `use-*.ts`.
- Booleanos `is*/has*/can*`. Dinero con sufijo `Cents` (entero). Fechas con sufijo `At` (UTC).
  Distancias `Km`/`Meters`, duraciones `Minutes`/`Seconds` en el nombre.
- Estados y roles: uniones de literales definidas una vez en `domain/`; nunca cadenas sueltas.

## 4. Estilo que el linter no ve
- Sin números mágicos: constantes con nombre (o configuración de la distribuidora).
- Retornos tempranos; sin código comentado ni `console.log`.
- Comentarios solo para el porqué.
- TypeScript estricto, sin `any`; lo que viene de Firestore se valida en el convertidor.
- Errores de dominio con nombre (`OrderAlreadyTakenError`) traducidos a mensaje en la pantalla.
- Todo estado remoto tiene cargando / vacío / error.
- Sin dependencias nuevas sin anotarlo en el plan.

## 5. Tests
- Dominio → unitarios (Vitest), Arrange/Act/Assert, un comportamiento por test.
- Reglas → `firebase/tests` contra emulador (ver `firebase-tenancy` §8).
- Flujos → Playwright en móvil 390×844 y escritorio 1440×900.

## 6. Herramientas
`npm run check` = formato + lint + `tsc` + unitarios + reglas. `/simplify` y `/code-review`
sobre lo cambiado.

## 7. Lista antes de terminar
1. ¿Copié la forma de un archivo hermano?
2. ¿Alguna página o componente importa `firebase/*`? (no debe)
3. ¿Alguna regla de negocio quedó solo en la pantalla? (debe estar en dominio **y** en reglas)
4. ¿Estados, roles o rutas escritos a mano?
5. ¿Dinero en céntimos enteros de punta a punta?
6. ¿Consulta sin `limit` o listener sobre colección entera?
7. ¿Componentes ≤ 150 líneas, con cargando/vacío/error?
8. ¿`npm run check` en verde y `/simplify` pasado?
