---
name: design-craft
description: Oficio visual de glpWEB — cómo se hace una pantalla atrayente y adaptativa para quien pide gas, para el repartidor en la calle y para la central; profundidad, fotografía, tipografía, color de marca por distribuidora, mapa como protagonista, movimiento, patrones de conversión y lo que está prohibido. Cargar junto con `ui-system` antes de diseñar, maquetar o construir cualquier pantalla pública, de alta o de seguimiento, y al revisar capturas.
---

# Oficio visual

`ui-system` dice **qué** tokens, fuentes y componentes hay. Esta skill dice **cómo** usarlos.
En pantallas públicas manda esta; en paneles internos manda `ui-system`.

## 1. Para quién y qué debe sentir en 2 segundos

| Pantalla | Persona | Debe sentir |
|---|---|---|
| Portada / alta de distribuidora | Dueño de distribuidora, desconfiado de la tecnología | "Esto es serio, es para mi negocio y lo armo hoy." |
| Página pública de la distribuidora | Vecino sin gas, con la olla a medias | "Aquí pido ya y sé cuánto cuesta." |
| Seguimiento | Cliente esperando | "Ya viene, lo estoy viendo." |
| App del repartidor | En moto, al sol, con guantes, una mano | "Un botón grande, sé qué sigue." |
| Central / monitor | Operador con el teléfono al oído | "Veo todo de un vistazo, registro en segundos." |

## 2. Prohibido
- Aspecto plano de panel de administración genérico en pantallas públicas.
- La "paleta del chat de Claude" (hueso + terracota + serif suave, sin fotos).
- Colores escritos a mano fuera de los tokens.
- Fotos deformadas, texto sobre foto sin velo, fotos "encontradas en Google".
- Mezclar familias de iconos; tres botones primarios en una pantalla.
- Formularios con desplegables donde caben tarjetas, chips o pasos (+/−).
- Verde-fuego-llama cliché como única idea de marca: el gas también es hogar, comida, rapidez.

## 3. Principios
1. **La foto o el mapa manda.** Pantallas públicas: fotografía real con proporción fija
   (16:9, 4:5, 1:1), `object-cover`, velo en degradado. Seguimiento y monitor: el mapa ocupa la
   pantalla y la información flota encima en superficies elevadas.
2. **Profundidad, no ruido.** Tres planos: fondo, superficie, elevado. Sombras suaves de dos
   capas, bordes translúcidos.
3. **El color de marca es de la distribuidora.** `--primary` por distribuidora con tonos
   derivados; probar siempre con uno oscuro (`#1F2937`), uno vivo (`#E11D48`) y uno claro (`#F59E0B`).
   Los colores de **estado** (libre, con pedido, en pausa, sin señal, error) son del sistema y no cambian con la marca.
4. **Tipografía con carácter.** Una display + una sans legible; números tabulares en precios,
   tiempos y cantidades.
5. **Una acción por pantalla, al alcance del pulgar.** Botón fijo abajo ≥ 48 px
   (repartidor: ≥ 64 px, alto contraste, legible a pleno sol).
6. **Adaptativo, no encogido.** Celular: una columna, barra inferior, hojas desde abajo.
   Escritorio: lateral, dos o tres paneles, mapa + lista a la vez. No es la versión móvil estirada.
7. **Movimiento con sentido.** 150–250 ms, entradas escalonadas, el marcador se desliza; todo
   respeta `prefers-reduced-motion`.
8. **Español peruano neutro.** "Balón de gas", "S/ 38.00", "Ya llegué". Sin jerga técnica ni género asumido.

## 4. Patrones de conversión
- **Portada para dueños**: titular con la promesa → "así se ve tu página" (captura real) →
  3 pasos → mapa en vivo como prueba → precio → un solo CTA.
- **Página de la distribuidora**: portada con foto y marca → productos como tarjetas con precio
  y `+/−` → barra fija "Pedir · S/ total" → horario, cobertura, WhatsApp.
- **Pedido**: máximo 3 pasos (qué, dónde, confirmar). Dirección con pin, no con formulario largo.
- **Seguimiento**: estado en una frase grande + tiempo estimado + mapa; llamar / WhatsApp a un toque.

## 5. Proceso
Dirección antes que píxeles: `image-scout` trae fotos → `design-director` maqueta 2–3
direcciones con fotos reales y capturas a 390 y 1440 px → el usuario elige → pasa a spec
(`ui-system`) → `frontend-builder` construye → `visual-designer` compara capturas con la maqueta.
Nunca dos direcciones en una pantalla.

## 6. Imágenes
- Solo de `docs/design/images/` con ficha en `CREDITS.md` (autor, fuente, licencia, fecha).
- Licencias válidas: Pexels, Unsplash, Pixabay, CC0, CC BY. Uso comercial y modificación permitidos.
- JPEG/WebP ≤ 1600 px y ≤ 400 KB; retratos también en cuadrado.
- Logos de demostración: monogramas generados sobre el color de marca; nunca logos reales
  (ni de marcas de gas).
- En la app, las fotos se sirven desde el propio proyecto; nunca URLs externas.

## 7. Lista antes de aceptar una pantalla
1. ¿Se entiende qué hacer en 2 segundos, a 390 px?
2. ¿Hay una sola acción principal y está al alcance del pulgar?
3. ¿En 1440 px aprovecha el espacio o es el móvil estirado?
4. ¿Funciona con un color de marca oscuro, uno vivo y uno claro, en claro y oscuro?
5. ¿Fotos reales, sin deformar, con velo si llevan texto?
6. ¿Estados cargando / vacío / error / sin conexión diseñados?
7. ¿Alguien diría "parece el chat de Claude" o "parece un panel de admin"? Si sí, no está.
