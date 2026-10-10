---
name: ui-system
description: Sistema de diseño de glpWEB — tokens claro/oscuro, color de marca por distribuidora, colores de estado, fuentes, escala tipográfica, radios, sombras, fotos, movimiento, componentes y patrones de pantalla para celular y escritorio. Cargar antes de crear o modificar cualquier pantalla, componente o estilo.
---

# Sistema de diseño

> **Pendiente de dirección visual (fase 1 del plan).** Esta skill la reescribe
> `design-director` cuando el usuario elija una dirección. Hasta entonces vale solo lo de abajo,
> que no depende de la dirección. No inventar paleta ni fuentes mientras tanto.

## 1. Contrato fijo (no cambia con la dirección)
- Componentes: shadcn/ui (estilo `base-nova`, sobre Base UI) con Tailwind 4 (CSS-first, sin `tailwind.config`). Añadir con `npx shadcn@latest add <componente>`; ver skill `shadcn`. `components/ui/*`
  no se edita a mano.
- Iconos: `lucide-react`, una sola familia, trazo 1.75.
- Movimiento: `motion/react` con `useReducedMotion()`.
- Colores solo por token (`bg-background`, `text-foreground`, `bg-primary`…); ningún hex en componentes.
- Claro y oscuro por variables en `:root` y `.dark`.
- Color de marca por distribuidora: componente `BrandTheme` fija `--primary` y derivados,
  garantizando contraste ≥ 4.5:1 del texto sobre primario.
- Colores de estado, del sistema (no dependen de la marca): `--state-free`, `--state-busy`,
  `--state-paused`, `--state-offline`, `--state-danger`. Siempre acompañados de icono o texto,
  nunca solo color.

## 2. Tres ambientes sobre una base
| Ambiente | Carácter | Particularidades |
|---|---|---|
| Cliente / público | Amable, luminoso, con fotos | Ver `design-craft`. |
| Repartidor | Alto contraste, uso con una mano y al sol | Texto +2 px, objetivos ≥ 56 px, botón crítico ≥ 64 px. |
| Central / dueño / plataforma | Sobrio, denso, mapa protagonista | Tablas y listas compactas; atajos. |

## 3. Adaptativo
- Puntos de corte: `<640` celular · `640–1023` tablet · `≥1024` escritorio.
- Celular: una columna, barra inferior (máx. 5), hojas desde abajo en vez de diálogos.
- Escritorio: barra lateral, contenido en 2–3 paneles, diálogos centrados.
- Objetivos táctiles ≥ 44 px. Probar a 360, 390, 768, 1440.

## 4. Formato
`S/ 38.00` · `3:30 p. m.` · `12 min` · `1,2 km` · números tabulares.

## 5. Por definir por design-director
Paleta y tokens (claro/oscuro) · fuentes y su carga · escala tipográfica · radios · sombras ·
tratamiento de fotos · curvas y duraciones · estilo del mapa y marcadores · patrones por pantalla.
