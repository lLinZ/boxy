// Cálculo de la venta en el navegador: copia EXACTA de
// apps/api/app/Services/CalculadoraVenta.php (el servidor manda y recalcula).
// Ambas se prueban con apps/api/tests/fixtures/calculo_casos.json:
//   node scripts/probar-calculo.mjs
// Si cambias una, cambia la otra.
//
// Solo usa sintaxis de TypeScript que Node puede quitar sin compilar (sin enums).

export const ALICUOTA_IGTF = 3
export const ALICUOTAS: Record<string, number> = { general: 16, reducido: 8, exento: 0 }
/** Métodos en USD que no son divisas entregadas: no generan IGTF ni vuelto. */
export const METODOS_SIN_IGTF = ['credito', 'puntos']
export const TOLERANCIA = 0.01

export interface LineaCalculo {
  producto_id?: number | null
  categoria_id?: number | null
  descripcion: string
  cantidad: number
  precio_unitario_usd: number
  tipo_iva: string
  descuento_usd?: number
}

export interface PromocionCalculo {
  id?: number
  nombre?: string
  tipo: string
  producto_id?: number | null
  categoria_id?: number | null
  valor: number
  lleva?: number | null
  paga?: number | null
  cantidad_minima?: number
}

export interface PagoCalculo {
  metodo: string
  moneda: string
  monto: number
}

export interface LineaResultado extends LineaCalculo {
  alicuota_iva: number
  bruto_usd: number
  promocion_usd: number
  promocion_id: number | null
  descuento_manual_usd: number
  descuento_total_usd: number
  base_usd: number
  iva_usd: number
  total_usd: number
}

export interface PagoResultado extends PagoCalculo {
  monto_usd: number
  aplica_igtf: boolean
  aplicado_usd: number
  igtf_usd: number
}

export interface ResultadoVenta {
  lineas: LineaResultado[]
  subtotal_usd: number
  descuento_usd: number
  promocion_usd: number
  base_imponible_usd: number
  iva_usd: number
  total_sin_igtf_usd: number
  pagos: PagoResultado[]
  igtf_usd: number
  total_usd: number
  total_bs: number
  pagado_usd: number
  vuelto_usd: number
  /** Parte de la cuenta (antes de IGTF) que falta cubrir. En Bs = × tasa; en divisas = × 1,03. */
  faltante_usd: number
  cubierto: boolean
}

/**
 * Redondeo a 2 decimales igual al round() de PHP: mitad lejos de cero y con
 * "pre-redondeo" a 15 cifras (así 4,47 × 36,5 = 163,155 da 163,16 y no 163,15).
 */
export function r(valor: number, decimales = 2): number {
  if (!Number.isFinite(valor)) return 0
  const signo = valor < 0 ? -1 : 1
  const limpio = Number(Math.abs(valor).toPrecision(15))
  return signo * Number(Math.round(Number(limpio + 'e' + decimales)) + 'e-' + decimales)
}

export function calcular(
  lineas: LineaCalculo[],
  promociones: PromocionCalculo[],
  pagos: PagoCalculo[],
  tasa: number,
  cobraIgtf: boolean,
): ResultadoVenta {
  // 1) Líneas
  const resLineas = lineas.map((l) => calcularLinea(l, promociones))
  let subtotal = 0
  let descuentos = 0
  let promos = 0
  let base = 0
  let iva = 0
  for (const l of resLineas) {
    subtotal += l.bruto_usd
    descuentos += l.descuento_total_usd
    promos += l.promocion_usd
    base += l.base_usd
    iva += l.iva_usd
  }
  const totalSinIgtf = r(base + iva)

  // 2) Pagos: primero los que no pagan IGTF; las divisas cubren el resto
  let sinIgtf = 0
  const resPagos: PagoResultado[] = pagos.map((p) => {
    const moneda = p.moneda || 'VES'
    const monto = Number(p.monto) || 0
    const montoUsd = moneda === 'USD' ? r(monto) : tasa > 0 ? r(monto / tasa) : 0
    const aplicaIgtf = cobraIgtf && moneda === 'USD' && !METODOS_SIN_IGTF.includes(p.metodo)
    if (!aplicaIgtf) sinIgtf += montoUsd
    return { ...p, moneda, monto_usd: montoUsd, aplica_igtf: aplicaIgtf, aplicado_usd: 0, igtf_usd: 0 }
  })

  let restante = Math.max(0, r(totalSinIgtf - sinIgtf))
  let igtf = 0
  const factor = 1 + ALICUOTA_IGTF / 100

  for (const p of resPagos) {
    if (!p.aplica_igtf) continue
    const aplicado = r(Math.min(p.monto_usd / factor, restante))
    const igtfPago = r((aplicado * ALICUOTA_IGTF) / 100)
    p.aplicado_usd = aplicado
    p.igtf_usd = igtfPago
    restante = r(restante - aplicado)
    igtf += igtfPago
  }

  let porCubrir = totalSinIgtf
  for (const p of resPagos) {
    if (p.aplica_igtf) continue
    const aplicado = r(Math.min(p.monto_usd, Math.max(0, porCubrir)))
    p.aplicado_usd = aplicado
    porCubrir = r(porCubrir - aplicado)
  }

  igtf = r(igtf)
  const total = r(totalSinIgtf + igtf)
  const pagado = r(resPagos.reduce((a, p) => a + p.monto_usd, 0))
  const diferencia = r(pagado - total)

  return {
    lineas: resLineas,
    subtotal_usd: r(subtotal),
    descuento_usd: r(descuentos),
    promocion_usd: r(promos),
    base_imponible_usd: r(base),
    iva_usd: r(iva),
    total_sin_igtf_usd: totalSinIgtf,
    pagos: resPagos,
    igtf_usd: igtf,
    total_usd: total,
    total_bs: r(total * tasa),
    pagado_usd: pagado,
    vuelto_usd: diferencia > TOLERANCIA ? diferencia : 0,
    faltante_usd: restante > TOLERANCIA ? restante : 0,
    cubierto: restante <= TOLERANCIA,
  }
}

export function calcularLinea(linea: LineaCalculo, promociones: PromocionCalculo[]): LineaResultado {
  const cantidad = Number(linea.cantidad)
  const precio = Number(linea.precio_unitario_usd)
  const tipoIva = linea.tipo_iva || 'general'
  const alicuota = ALICUOTAS[tipoIva] ?? 16

  const bruto = r(cantidad * precio)
  const [promo, promoId] = mejorPromocion(linea, promociones, bruto)

  let manual = r(Math.max(0, Number(linea.descuento_usd ?? 0)))
  manual = Math.min(manual, r(bruto - promo))

  const descuento = r(promo + manual)
  const base = r(bruto - descuento)
  const iva = r((base * alicuota) / 100)

  return {
    ...linea,
    tipo_iva: tipoIva,
    alicuota_iva: alicuota,
    bruto_usd: bruto,
    promocion_usd: promo,
    promocion_id: promoId,
    descuento_manual_usd: manual,
    descuento_total_usd: descuento,
    base_usd: base,
    iva_usd: iva,
    total_usd: r(base + iva),
  }
}

/** La promoción que más descuenta a la línea (no se acumulan). */
export function mejorPromocion(
  linea: LineaCalculo,
  promociones: PromocionCalculo[],
  bruto: number,
): [number, number | null] {
  if (!linea.producto_id) return [0, null]

  const cantidad = Number(linea.cantidad)
  const precio = Number(linea.precio_unitario_usd)
  let mejor = 0
  let mejorId: number | null = null

  for (const p of promociones) {
    if (p.producto_id && Number(p.producto_id) !== Number(linea.producto_id)) continue
    if (!p.producto_id && p.categoria_id && Number(p.categoria_id) !== Number(linea.categoria_id ?? 0)) continue
    if (cantidad + 1e-9 < Number(p.cantidad_minima ?? 1)) continue

    const valor = Number(p.valor ?? 0)
    let descuento = 0
    if (p.tipo === 'porcentaje') descuento = (bruto * Math.min(Math.max(valor, 0), 100)) / 100
    else if (p.tipo === 'nxm') descuento = descuentoNxM(cantidad, precio, Number(p.lleva ?? 0), Number(p.paga ?? 0))
    else if (p.tipo === 'precio_cantidad') descuento = precio > valor && valor >= 0 ? cantidad * (precio - valor) : 0
    descuento = Math.min(r(descuento), bruto)

    if (descuento > mejor) {
      mejor = descuento
      mejorId = p.id != null ? Number(p.id) : null
    }
  }
  return [mejor, mejorId]
}

function descuentoNxM(cantidad: number, precio: number, lleva: number, paga: number): number {
  if (lleva <= 0 || paga < 0 || paga >= lleva) return 0
  const grupos = Math.floor(cantidad / lleva + 1e-9)
  return grupos * (lleva - paga) * precio
}
