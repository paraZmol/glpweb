# Portada de Hornilla: estructura y textos

Fecha: 2026-10-16 · Autor: marketing-advisor · Estado: propuesta, la decide el usuario.

## Qué se revisó
- Portada actual (`/`, captura de 390 px): héroe "Pide tu gas a quien llega a tu puerta",
  ubicación, "Distribuidoras cerca de ti", "Así va a funcionar" (3 pasos, *En construcción*),
  "¿Tienes una distribuidora de gas?" y pie.
- `docs/PLAN.md` §1 (visión) y §7 (fases: pedidos fase 4, cobro fase 5, mapa en vivo fase 6,
  instalable y avisos fase 7).
- `docs/legal/terminos.md` §1 (Hornilla no vende gas, no fija precios ni reparte) y §10 (30 días
  de prueba sin tarjeta; precio del plan se informa antes de contratar).
- `docs/marketing/oferta-y-promociones.md` (vocabulario *recarga* / *balón completo*).
- **No comprobado en esta tarea**: no se hizo investigación nueva de cómo se presentan otras
  plataformas o distribuidoras en provincias. Lo que se dice del público (prisa, desconfianza,
  WhatsApp como canal) es supuesto razonable, no dato.

## Recomendación en una frase
Una portada corta para quien compra gas, con un bloque breve "Qué es Hornilla" y un bloque para
distribuidoras que lleva a una página propia `/para-distribuidoras`; "quiénes somos" no merece
página aparte todavía.

Por qué: quien se quedó sin gas no lee "quiénes somos"; quiere ver quién llega y a cuánto. El
dueño de distribuidora sí necesita leer más (qué gana, cuánto cuesta, qué le piden), y mezclarlo
todo en `/` alarga la página para el público que más entra.

## Estructura de `/` (orden en celular)

Marcas: **[HOY]** funciona ya · **[PRONTO]** lleva la etiqueta "Pronto" y no se presenta como
disponible.

### 1. Héroe [HOY]
- Titular: **Pide tu gas a quien llega a tu puerta.**
- Bajada: **Hornilla reúne a las distribuidoras de gas de tu zona. Mira quién reparte hasta tu
  casa, compara sus precios y llámales o escríbeles.**
- Botón principal: **Usar mi ubicación** · secundario: **Escribir las coordenadas**
- Nota bajo los botones (se mantiene): *Tu ubicación se usa solo para ver qué distribuidoras
  llegan hasta ti. Queda en este dispositivo, no en tu cuenta.*

### 2. Distribuidoras cerca de ti [HOY]
Igual que hoy. Estado vacío sin ubicación: **Dinos dónde estás y vemos quién llega.**
Si no hay ninguna en la zona: **Todavía no hay distribuidoras en Hornilla que lleguen a este
punto. Si conoces una, cuéntale de Hornilla.**

### 3. Qué es Hornilla (sustituye a un "quiénes somos") [HOY]
- Título: **Qué es Hornilla**
- Texto: **Hornilla es una vitrina donde las distribuidoras de gas de tu zona muestran sus
  marcas, precios, horario y hasta dónde reparten. Tú eliges a quién comprarle. El gas, el precio
  y la entrega son de cada distribuidora: Hornilla no vende gas ni lo reparte.**
- Tres puntos cortos (icono + texto):
  - **Precios a la vista** — Cada distribuidora publica el precio final de su balón.
  - **Tú eliges** — La marca y la distribuidora que prefieras, sin intermediarios en el pago.
  - **Sin rastreo** — No usamos publicidad ni analítica que te siga.

### 4. Así va a funcionar [PRONTO]
Etiqueta **Pronto** visible. Texto: **Hoy ya puedes ver qué distribuidoras llegan a tu puerta y
llamarlas o escribirles. Pedir desde Hornilla es lo que sigue.**
Pasos (sin cambios de fondo):
1. **Elegirás tu distribuidora y tu marca** — Con el precio del balón a la vista, antes de pedir.
2. **Confirmarás dónde lo dejan** — Marcarás tu puerta en el mapa y agregarás una referencia.
3. **Verás venir el reparto** — Y pagarás al recibir, directo a la distribuidora.

No poner fechas: el plan no las fija.

### 5. Recarga o balón completo [HOY, breve]
- Título: **¿Recarga o balón completo?**
- **Recarga**: *Entregas tu balón vacío y pagas solo el gas.*
- **Balón completo**: *Gas más el envase. Para quien no tiene un balón vacío para cambiar.*
Ayuda a no pagar envase sin querer; coherente con `oferta-y-promociones.md`.

### 6. Seguridad [HOY]
- Título: **Tu seguridad primero**
- Texto: **Compra a distribuidoras formales. Al recibir, revisa que el balón tenga su precinto y
  no huela a gas. Nunca trasvases gas entre balones.**
(Revisar con legal-compliance si se cita norma; no prometer que Hornilla certifica balones.)

### 7. Bloque para distribuidoras [HOY]
- Título: **¿Tienes una distribuidora de gas?**
- Texto: **Muestra tus marcas, precios y zona de reparto a la gente de tu zona. Registra tu
  distribuidora en minutos; aparece en el buscador cuando revisamos sus datos. Los primeros 30
  días son de prueba, gratis y sin tarjeta.**
- Botón: **Conoce cómo funciona** → `/para-distribuidoras` · enlace secundario: **Registrar mi
  distribuidora**

### 8. Preguntas frecuentes [HOY]
Acordeón, 6 preguntas (abajo).

### 9. Pie [HOY]
Frase: *Hornilla conecta a quien necesita gas con la distribuidora de su barrio. Hornilla no vende
ni reparte gas.* + Términos, Privacidad, Cookies, Contacto y reclamos, Libro de Reclamaciones,
**Para distribuidoras**.

En escritorio (1440 px): héroe y buscador en dos columnas; "Qué es Hornilla" en tres columnas;
el resto igual.

## Preguntas frecuentes (portada)

1. **¿Hornilla vende gas?**
   No. Hornilla muestra a las distribuidoras de tu zona. El gas, el precio, la entrega y la
   boleta son de la distribuidora que elijas.
2. **¿Quién pone los precios?**
   Cada distribuidora. El precio que ves es el que ella publicó; si tiene una promoción, verás su
   vigencia y condiciones.
3. **¿Puedo pedir desde Hornilla?**
   Pronto. Hoy puedes ver quién llega a tu puerta y llamar o escribir por WhatsApp a la
   distribuidora.
4. **¿Qué diferencia hay entre recarga y balón completo?**
   En la recarga entregas tu balón vacío y pagas solo el gas. El balón completo incluye el envase,
   para quien no tiene uno para cambiar.
5. **¿Para qué piden mi ubicación?**
   Solo para saber qué distribuidoras reparten hasta tu punto. Se queda en tu dispositivo; no la
   guardamos en tu cuenta.
6. **Tuve un problema con un pedido, ¿a quién reclamo?**
   Primero a la distribuidora, que es quien te vendió. Si el problema es con Hornilla, escríbenos
   desde "Contacto y reclamos" o usa nuestro Libro de Reclamaciones.
7. *(opcional)* **Tengo una distribuidora, ¿cuánto cuesta?**
   Los primeros 30 días son gratis y sin tarjeta. Antes de que termine la prueba te informamos el
   precio del plan; si no lo contratas, no se te cobra nada.

## Página `/para-distribuidoras`

1. **Héroe** — **Que la gente de tu zona te encuentre.** / *Publica tus marcas, precios y zona de
   reparto en Hornilla. Te llaman o te escriben directo a ti.* · Botón **Registrar mi
   distribuidora** · nota *30 días de prueba, gratis y sin tarjeta.*
2. **Lo que ya puedes hacer [HOY]** — Página propia con tu color y tu enlace · catálogo con
   recarga y balón completo · promociones con vigencia y límite · tu personal y tus vehículos ·
   stock de planta.
3. **Lo que viene [PRONTO]** — Pedidos por la web y por teléfono en un solo lugar · jornada y
   cuadre de caja del repartidor · mapa con tus repartidores en vivo · avisos en el celular.
   Etiqueta **Pronto** en cada uno; sin fechas.
4. **Cómo empiezas** — 1. Te registras con tus datos y los de tu negocio. 2. Revisamos tu ficha.
   3. Apareces en el buscador.
5. **Lo que te pedimos** — RUC, razón social y registro de Osinergmin (no se muestran al
   público). Qué sí es público: nombre, teléfono, WhatsApp, dirección, zona, horario, precios.
6. **Precio** — *30 días gratis y sin tarjeta. El precio del plan se informa antes de contratarlo;
   sin plan no se cobra nada.* (Sin cifras en el repo hasta que el usuario las decida.)
7. **Preguntas del dueño** — *¿Me quitan comisión por balón?* (respuesta según lo que decida el
   usuario; hoy no hay cobro por pedido) · *¿Necesito saber de computadoras?* *Si usas WhatsApp,
   puedes usar Hornilla.* · *¿Qué pasa si no pago al terminar la prueba?* *Tu panel queda en
   solo lectura y dejas de aparecer; no se te cobra nada.* · *¿Mis precios los pongo yo?* *Sí,
   siempre.*
8. Botón final **Registrar mi distribuidora**.

## Qué NO decir (riesgos)
- Nada que haga ver a Hornilla como vendedor: evitar "nuestro gas", "te llevamos tu balón",
  "nuestros repartidores", "el precio de Hornilla", "garantizamos la entrega".
- No "el más barato", "los mejores precios" ni comparativas: los precios son de cada distribuidora
  y cambian.
- No presentar como disponible pedir, seguir el pedido, mapa en vivo, pago en la app ni avisos
  (fases 4 a 7): siempre con **Pronto**.
- No "distribuidoras verificadas/certificadas": la revisión de Hornilla no certifica seguridad ni
  formalidad. Decir "aparece cuando revisamos sus datos".
- No tiempos de entrega ("en 30 minutos"), no "24 horas".
- No cifras de distribuidoras, clientes o pedidos que no existan; no testimonios.
- No precios del plan de Hornilla ni nombres de empresas o marcas reales en el repo.
- Nada que reste importancia a la seguridad (trasvase, balones dañados, instalaciones caseras).
- Para el dueño: no prometer "más ventas" como resultado seguro; usar "que te encuentren".
Lo que roce normas de publicidad o protección al consumidor debe pasar por legal-compliance y,
de ser necesario, un abogado.

## Descartado
- **Página "Quiénes somos" aparte**: sin equipo ni historia que contar públicamente aún; el
  bloque "Qué es Hornilla" cubre la duda real (¿quién me vende?).
- **Todo en una página larga**: alarga el camino del comprador con texto que no le sirve.

## Decisiones del usuario
1. Opción de estructura (A, B o C en el reporte).
2. Si se muestra la pregunta 7 (precio para distribuidoras) en la portada pública.
3. Respuesta a "¿me cobran comisión por balón?" (la decide con business-strategist).
4. Si se incluye la sección "Seguridad" en la portada o solo en preguntas.
