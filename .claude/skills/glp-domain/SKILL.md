---
name: glp-domain
description: Reglas del negocio de distribución de gas (GLP) de glpWEB — estados del pedido y sus transiciones, aceptación y asignación, jornada del repartidor, aprobación de salida, cobro (efectivo/Yape/Plin), cuadre y liquidación, stock de planta llenos/vacíos, precios congelados y los invariantes con test obligatorio. Cargar ANTES de tocar pedidos, jornada, cobro, stock, catálogo o sus reglas de seguridad.
---

# Dominio GLP

Origen: análisis hecho para una distribuidora real en `../GLP-DEV/.agents/memory/`
(CASOS_DE_USO, SCHEMA, DECISIONS). Aquí está generalizado para cualquier distribuidora.

## Regla de oro
Toda la lógica vive en `src/domain/` como funciones puras: sin Firebase, sin React, sin `Date.now()`
interno (la hora entra por parámetro). Las reglas de seguridad repiten las mismas condiciones y
los tests comprueban que coinciden. **La lista de estados existe en un solo archivo**
(`src/domain/orders/status.ts`); nadie escribe `'assigned'` a mano.

## 1. Pedido

Estados (`OrderStatus`): `pending → assigned → onTheWay → arrived → delivered`, y `cancelled`.

| Transición | Quién | Condiciones |
|---|---|---|
| (crear) → `pending` | cliente, central | items válidos, precios = catálogo actual, dentro de cobertura, distribuidora escribible |
| `pending → assigned` | repartidor (acepta) o central (asigna) | repartidor con jornada `approved`, sin pedido activo, stock suficiente para **todo** el pedido |
| `assigned → onTheWay` | ese repartidor | — |
| `onTheWay → arrived` | ese repartidor | — |
| `arrived → delivered` | ese repartidor | `payment.method` obligatorio; `payment.amountCents == totalCents` |
| `assigned → pending` | central (quita la asignación) | motivo obligatorio |
| `pending → cancelled` | cliente (el suyo), central | motivo obligatorio para la central |
| `assigned|onTheWay|arrived → cancelled` | solo central/dueño | motivo obligatorio |

Conjuntos derivados (definidos una vez): `WITH_DRIVER = [assigned, onTheWay, arrived]`,
`ALIVE = [pending, ...WITH_DRIVER]`. Un repartidor "libre" es el que no tiene pedido en
`WITH_DRIVER` (olvidar `arrived` causó doble asignación en GLP-DEV).

Reglas:
- Cada transición es una **transacción condicionada al estado anterior** y escribe la marca de
  tiempo (`assignedAt`, `onTheWayAt`, `arrivedAt`, `deliveredAt`) y una entrada en `history`.
- **Precios congelados**: `items[].unitPriceCents` y `totalCents` se fijan al crear y no cambian
  jamás. "Pedir lo mismo" copia los items con el precio de hoy.
- Un pedido nunca se parte entre dos repartidores.
- Límite de balones por pedido de cliente: `distributor.maxCylindersPerOrder` (por defecto 3).
  La central puede superarlo en pedidos telefónicos (camión).
- Un cliente tiene como máximo un pedido `ALIVE` por distribuidora.
- Origen: `app` o `phone`. El telefónico puede no tener cuenta de cliente (nombre + teléfono).
- Calificación 1–5: solo el cliente, solo en `delivered`, una sola vez.
- Tiempo prometido: distancia planta→dirección a 20 km/h + 5 min de despacho (mínimo 0,5 km);
  se guarda en `promisedMinutes` para medir puntualidad.

## 2. Jornada del repartidor (control anti-robo)

Estados (`ShiftStatus`): `requested → approved ⇄ paused → closed`, o `requested → rejected`.

- El repartidor **declara** carga por producto, vehículo, kilometraje de salida y (camión) ayudante.
- El dueño cuenta físicamente y **aprueba** (puede ajustar cantidades). `declared` y `approved`
  se guardan por separado; lo declarado nunca se sobrescribe. Rechazar exige motivo.
- Aprobar descuenta `plantStock.full` **en la misma transacción** y valida capacidad del vehículo.
- Sin jornada `approved` el repartidor no ve ni acepta pedidos.
- El repartidor **no puede** aprobar ni cerrar su propia jornada (regla de seguridad + test).
- Pausa: no recibe pedidos nuevos; termina primero el que lleva.
- Stock del repartidor = `approved` − items de sus pedidos `delivered` en esa jornada (se calcula, no se guarda aparte).
- Un ayudante no puede estar en dos jornadas el mismo día. Una jornada abierta por repartidor.

## 3. Cobro
- En persona: `cash`, `yape`, `plin`. Solo se registra; no hay pasarela ni estado "pago fallido".
- Efectivo: se guarda `paidWithCents` y `changeCents`. Yape/Plin: se muestra el número de la
  distribuidora; lo confirma el repartidor mirando la pantalla del cliente.
- Sin cobro no hay `delivered`.

## 4. Cuadre y liquidación
- Cuadre (repartidor): salió con / vendió / le queda, totales por método, kilometraje de llegada.
  Solo entrega el **efectivo**; Yape/Plin ya está en la cuenta de la empresa.
- Liquidación (dueño): llenos devueltos por producto, vacíos recuperados, efectivo recibido.
  `expectedCashCents` = suma de pedidos cobrados en efectivo. Diferencia → `mismatchCents` con
  **nota obligatoria**; nunca se ajusta en silencio.
- Al liquidar, en una transacción: devueltos → `plantStock.full`, vacíos → `plantStock.empty`,
  jornada → `closed`. No se puede liquidar con un pedido en `WITH_DRIVER`.

## 5. Catálogo y stock
- Producto: marca (texto libre de la distribuidora), `weightKg`, `priceCents`, `active`.
  Tope de cordura al editar precio (S/ 999) contra errores de dedo.
- Stock de planta por producto: `full`, `empty`. Todo ajuste manual lleva motivo y autor.
- Cambiar la capacidad de un vehículo no reescribe cargas ya aprobadas.

## 5b. Formas de venta y promociones

**Formas de venta** (`SaleKind`), por línea de pedido:
- `refill` — recarga: el cliente entrega un balón vacío por cada unidad y paga solo el gas.
- `full` — balón completo: gas más envase; no se espera vacío a cambio.

Cada producto tiene `refillPriceCents` (obligatorio) y `fullPriceCents` (opcional: si falta, esa
distribuidora no vende envases de ese producto). Consecuencias:
- Vacíos esperados de un pedido = unidades `refill`. En el cuadre y la liquidación,
  `vaciosEsperados` de la jornada = suma de unidades `refill` entregadas; la diferencia con los
  vacíos recuperados se anota, no se ajusta en silencio.
- Una unidad `full` saca un lleno del stock sin devolver vacío: el parque de envases baja.
- La pantalla nunca deja ambiguo cuál se está comprando; el repartidor ve cuántos vacíos recoger.

**Promociones** (`/distributors/{d}/promotions/{id}`), creadas solo por el dueño:
- Campos: `title`, `type`, `productIds` (o todos), `saleKinds`, `startsAt`, `endsAt`, `active`,
  `maxUnitsPerOrder`, `conditions` (texto visible) y los parámetros del tipo.
- Tipos iniciales (los afina `marketing-advisor`):
  `fixedPrice` (precio especial; "balón completo al precio de la recarga" es este tipo sobre `full`),
  `percentOff`, `buyXPayY` ("lleva 2 paga 1").
- Vigente = `active` y `startsAt <= ahora < endsAt` y distribuidora escribible.
- **Una promoción por línea, sin acumular.** Si varias aplican, gana la de menor precio final para
  el cliente; el desempate es determinista (por id).
- El cálculo vive en `src/domain/pricing/` (`priceOrder(items, products, promotions, now)`), puro.
  Redondeo siempre a favor del cliente y a céntimos enteros; nunca precio negativo ni cero salvo
  las unidades gratis de `buyXPayY`.
- Cada línea del pedido congela `listPriceCents`, `unitPriceCents`, `discountCents` y `promotionId`.
  Las reglas de seguridad recalculan con `get()` del producto y de la promoción y rechazan si no
  coincide o si la promoción no está vigente en `request.time`.
- Editar o apagar una promoción no cambia pedidos ya creados.
- Honestidad: el "antes" que se muestra es el precio de lista vigente del producto, nunca uno inventado.
- La caja, las ventas y el efecto de las promociones en los ingresos los ve **solo el dueño**.

## 6. Invariantes con test obligatorio
1. Dos repartidores aceptando el mismo pedido a la vez → exactamente uno gana.
2. Ninguna transición fuera de la tabla pasa las reglas (probar cada par origen→destino).
3. `delivered` sin cobro es imposible.
4. `totalCents` y precios de items no cambian después de crear.
5. Un repartidor no aprueba ni cierra su jornada, ni cambia `approved`.
6. Tras aprobar + liquidar, `plantStock.full` inicial = final + vendidos (conservación).
7. Repartidor con pedido en `arrived` no figura como libre.
8. Cliente no cancela después de `pending`.
9. Calificación una sola vez y solo en `delivered`.
10. Distribuidora suspendida: ninguna escritura de negocio pasa.
11. Una promoción inactiva, vencida o de otra distribuidora no se aplica ni pasa las reglas.
12. Nunca dos promociones en la misma línea; el total es exactamente el que da `priceOrder`.
13. Una línea `full` no suma vacíos esperados; una `refill` suma uno por unidad.
14. Un rol distinto de dueño no lee caja, liquidaciones ni totales de venta.
