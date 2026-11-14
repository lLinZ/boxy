// Tickets para impresora térmica (58 u 80 mm). Se imprimen desde el navegador
// en un iframe oculto: la impresora térmica instalada en Windows funciona como
// cualquier otra (elegirla como predeterminada y papel "Roll paper 80 x 297").
// Para abrir la gaveta de dinero se activa en el controlador de la impresora
// ("Abrir cajón al imprimir"). Todos los tickets son documentos NO fiscales.
import { bs, n, usd } from './format'
import type { AjustesEmpresa, CuentaCliente, Devolucion, Empresa, MovimientoCuenta, ResumenCaja, Venta } from '../types'

interface Negocio {
  empresa: Empresa
  ajustes: Pick<AjustesEmpresa, 'ticket_ancho' | 'ticket_pie' | 'ticket_mostrar_logo'>
  sucursal?: string | null
}

const METODOS: Record<string, string> = {
  efectivo_bs: 'Efectivo Bs', efectivo_usd: 'Efectivo USD', pago_movil: 'Pago móvil', transferencia: 'Transferencia',
  tarjeta: 'Tarjeta', zelle: 'Zelle', usdt: 'USDT', credito: 'Fiado', puntos: 'Puntos', otro: 'Otro', cuenta_cliente: 'A cuenta del cliente',
  devolucion: 'Devolución',
}
export const nombreMetodo = (m: string | null | undefined) => (m ? (METODOS[m] ?? m.replace(/_/g, ' ')) : '—')

/** Escapa texto para meterlo en HTML armado a mano (todo dato del servidor o del usuario pasa por aquí). */
export const esc = (t: unknown) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
// Nombre del método ya escapado, para las plantillas de los tickets
const metodo = (m: string | null | undefined) => esc(nombreMetodo(m))
const cant = (c: string | number) => n(c).toLocaleString('es-VE', { maximumFractionDigits: 3 })
const fechaHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '—'

const fila = (izq: string, der: string, clase = '') => `<div class="f ${clase}"><span>${izq}</span><span>${der}</span></div>`
const linea = '<div class="sep"></div>'

function encabezado(neg: Negocio, titulo: string): string {
  const e = neg.empresa
  return `
    ${neg.ajustes.ticket_mostrar_logo && e.logo_path ? `<img class="logo" src="${esc(e.logo_path)}" alt="">` : ''}
    <div class="c b g">${esc(e.nombre)}</div>
    ${e.razon_social && e.razon_social !== e.nombre ? `<div class="c">${esc(e.razon_social)}</div>` : ''}
    <div class="c">RIF ${esc(e.tipo_rif ?? 'J')}-${esc(e.rif)}</div>
    ${e.direccion_fiscal ? `<div class="c p">${esc(e.direccion_fiscal)}</div>` : ''}
    ${e.telefono ? `<div class="c p">Tel. ${esc(e.telefono)}</div>` : ''}
    ${neg.sucursal ? `<div class="c p">${esc(neg.sucursal)}</div>` : ''}
    ${linea}
    <div class="c b">${esc(titulo)}</div>
    <div class="c b">*** DOCUMENTO NO FISCAL ***</div>
    ${linea}`
}

function pie(neg: Negocio, conMensaje = true): string {
  return `${linea}
    ${conMensaje && neg.ajustes.ticket_pie ? `<div class="c">${esc(neg.ajustes.ticket_pie)}</div>` : ''}
    <div class="c p">No válido como factura fiscal</div>
    <div class="c p">Boxy</div>`
}

export function ticketVenta(venta: Venta, neg: Negocio): string {
  const tasa = n(venta.tasa)
  const items = (venta.items ?? [])
    .map((i) => {
      const desc = n(i.descuento_usd ?? 0)
      return `<div class="it">${esc(i.descripcion)}</div>
        ${fila(`&nbsp;${cant(i.cantidad)} x ${usd(i.precio_unitario_usd)}${i.tipo_iva === 'exento' ? ' (E)' : i.tipo_iva === 'reducido' ? ' (R)' : ''}`, usd(n(i.total_usd)))}
        ${desc > 0 ? fila('&nbsp;&nbsp;Descuento', `-${usd(desc)}`, 'p') : ''}`
    })
    .join('')
  const pagos = (venta.pagos ?? [])
    .map((p) => fila(metodo(p.metodo), p.moneda === 'USD' ? usd(p.monto) : bs(p.monto)))
    .join('')
  const vuelto = n(venta.vuelto_usd ?? 0) > 0
    ? fila(`Vuelto (${metodo(venta.vuelto_metodo)})`, venta.vuelto_moneda === 'USD' ? usd(venta.vuelto_monto ?? 0) : bs(venta.vuelto_monto ?? 0), 'b')
    : ''

  return `${encabezado(neg, 'COMPROBANTE DE VENTA')}
    ${fila('N°', esc(venta.numero_factura))}
    ${fila('Fecha', fechaHora(venta.fecha))}
    ${venta.user ? fila('Cajero', esc(venta.user.name)) : ''}
    ${venta.cliente ? fila('Cliente', esc(venta.cliente.nombre)) + fila('C.I./RIF', `${esc(venta.cliente.tipo_documento)}-${esc(venta.cliente.documento)}`) : ''}
    ${venta.numero_fiscal ? fila('Factura fiscal', esc(venta.numero_fiscal)) : ''}
    ${venta.pendiente ? '<div class="c b">PENDIENTE DE SINCRONIZAR</div>' : ''}
    ${linea}
    ${items}
    ${linea}
    ${fila('Subtotal', usd(venta.subtotal_usd))}
    ${n(venta.descuento_usd) > 0 ? fila('Descuentos', `-${usd(venta.descuento_usd)}`) : ''}
    ${fila('IVA', usd(venta.iva_usd))}
    ${n(venta.igtf_usd) > 0 ? fila('IGTF 3%', usd(venta.igtf_usd)) : ''}
    ${fila('TOTAL USD', usd(venta.total_usd), 'b g')}
    ${fila('TOTAL Bs', bs(venta.total_bs), 'b')}
    <div class="c p">Tasa BCV ${tasa.toLocaleString('es-VE', { maximumFractionDigits: 4 })}</div>
    ${linea}
    ${pagos}
    ${vuelto}
    ${n(venta.puntos_ganados ?? 0) > 0 ? `${linea}<div class="c">Puntos ganados: ${venta.puntos_ganados}</div>` : ''}
    ${venta.estado === 'anulada' ? `${linea}<div class="c b g">*** ANULADA ***</div>` : ''}
    ${pie(neg)}`
}

export function ticketCierre(r: ResumenCaja, neg: Negocio): string {
  const metodos = r.metodos
    .map((m) => `<div class="it">${metodo(m.metodo)}</div>
      ${m.cobros ? fila('&nbsp;Cobros', mon(m.moneda, m.cobros)) : ''}
      ${m.abonos ? fila('&nbsp;Abonos', mon(m.moneda, m.abonos)) : ''}
      ${m.vuelto ? fila('&nbsp;Vuelto', `-${mon(m.moneda, m.vuelto)}`) : ''}
      ${m.devoluciones ? fila('&nbsp;Devoluciones', `-${mon(m.moneda, m.devoluciones)}`) : ''}
      ${fila('&nbsp;Neto', mon(m.moneda, m.neto), 'b')}`)
    .join('')
  const ef = r.efectivo
  return `${encabezado(neg, r.turno.estado === 'cerrado' ? 'CIERRE DE CAJA' : 'CORTE PARCIAL (X)')}
    ${fila('Turno', `#${r.turno.id}`)}
    ${fila('Cajero', esc(r.turno.cajero))}
    ${fila('Apertura', fechaHora(r.turno.abierto_el))}
    ${r.turno.cerrado_el ? fila('Cierre', fechaHora(r.turno.cerrado_el)) : fila('Impreso', fechaHora(new Date().toISOString()))}
    ${linea}
    ${fila('Ventas', String(r.ventas.cantidad))}
    ${fila('Total vendido', usd(r.ventas.total_usd), 'b')}
    ${fila('IVA', usd(r.ventas.iva_usd))}
    ${fila('IGTF', usd(r.ventas.igtf_usd))}
    ${fila('Descuentos', usd(r.ventas.descuento_usd))}
    ${fila('Anuladas', `${r.anuladas.cantidad} (${usd(r.anuladas.total_usd)})`)}
    ${fila('Devoluciones', `${r.devoluciones.cantidad} (${usd(r.devoluciones.total_usd)})`)}
    ${fila('Fiado otorgado', usd(r.fiado_otorgado_usd))}
    ${fila('Abonos cobrados', usd(r.abonos.total_usd))}
    ${linea}
    ${metodos}
    ${ef ? `${linea}
      ${fila('Fondo Bs', bs(r.turno.fondo_bs))}
      ${fila('Fondo USD', usd(r.turno.fondo_usd))}
      ${fila('Efectivo esperado Bs', bs(ef.esperado_bs), 'b')}
      ${fila('Efectivo esperado USD', usd(ef.esperado_usd), 'b')}
      ${ef.contado_bs != null ? fila('Contado Bs', bs(ef.contado_bs)) + fila('Contado USD', usd(ef.contado_usd ?? 0)) : ''}
      ${ef.diferencia_bs != null ? fila('Diferencia Bs', bs(ef.diferencia_bs), 'b') + fila('Diferencia USD', usd(ef.diferencia_usd ?? 0), 'b') : ''}` : ''}
    ${linea}
    <div class="p">Firma cajero: ____________________</div>
    <div class="p">Firma supervisor: ________________</div>
    ${pie(neg, false)}`
}

export function ticketAbono(mov: MovimientoCuenta, cuenta: Pick<CuentaCliente, 'cliente'>, neg: Negocio): string {
  return `${encabezado(neg, 'RECIBO DE ABONO')}
    ${fila('Fecha', fechaHora(mov.created_at))}
    ${fila('Cliente', esc(cuenta.cliente.nombre))}
    ${fila('C.I./RIF', `${esc(cuenta.cliente.tipo_documento)}-${esc(cuenta.cliente.documento)}`)}
    ${linea}
    ${fila('Forma de pago', metodo(mov.metodo))}
    ${fila('Recibido', mov.moneda === 'USD' ? usd(mov.monto) : bs(mov.monto), 'b')}
    ${n(mov.igtf_usd) > 0 ? fila('IGTF 3% incluido', usd(mov.igtf_usd)) : ''}
    ${fila('Abonado a la deuda', usd(Math.abs(n(mov.monto_usd))))}
    ${fila('Saldo pendiente', usd(mov.saldo_usd), 'b g')}
    ${mov.referencia ? fila('Referencia', esc(mov.referencia)) : ''}
    ${pie(neg)}`
}

export function ticketDevolucion(dev: Devolucion, venta: Venta, neg: Negocio): string {
  const items = (dev.items ?? [])
    .map((i) => fila(`${cant(i.cantidad)} x ${esc(i.descripcion)}${i.reintegra_stock ? '' : ' (dañado)'}`, usd(i.total_usd)))
    .join('')
  return `${encabezado(neg, 'NOTA DE DEVOLUCIÓN')}
    ${fila('N°', esc(dev.numero))}
    ${fila('Fecha', fechaHora(dev.created_at))}
    ${fila('Comprobante', esc(venta.numero_factura))}
    ${venta.cliente ? fila('Cliente', esc(venta.cliente.nombre)) : ''}
    ${fila('Motivo', esc(dev.motivo))}
    ${linea}
    ${items}
    ${linea}
    ${fila('Total devuelto', usd(dev.total_usd), 'b g')}
    ${fila(`Reintegro (${metodo(dev.reintegro_metodo)})`, dev.reintegro_moneda === 'USD' ? usd(dev.reintegro_monto) : bs(dev.reintegro_monto), 'b')}
    ${linea}
    <div class="p">Firma cliente: ___________________</div>
    ${pie(neg)}`
}

const mon = (moneda: string, v: number) => (moneda === 'USD' ? usd(v) : bs(v))

/** Imprime el HTML de un ticket en un iframe oculto con el ancho del papel. */
export function imprimirTicket(cuerpo: string, anchoMm = 80): void {
  const ancho = anchoMm === 58 ? 58 : 80
  imprimirDocumento(
    'Ticket',
    `@page { size: ${ancho}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 2mm 3mm; width: ${ancho}mm; font: ${ancho === 58 ? 10 : 11.5}px/1.3 'Consolas','Courier New',monospace; color: #000; }
    .c { text-align: center; } .b { font-weight: 700; } .g { font-size: 1.2em; } .p { font-size: .9em; }
    .f { display: flex; justify-content: space-between; gap: 6px; } .f span:last-child { white-space: nowrap; text-align: right; }
    .it { margin-top: 2px; } .sep { border-top: 1px dashed #000; margin: 4px 0; }
    .logo { display: block; max-width: 60%; max-height: 22mm; margin: 0 auto 2mm; }`,
    cuerpo,
  )
}

/**
 * Imprime un documento en un iframe oculto del mismo origen. El cuerpo debe venir
 * ya escapado (ver `esc`): el iframe comparte la sesión de la página. Sin ventanas
 * emergentes ni scripts en línea, así funciona con la CSP de producción.
 */
export function imprimirDocumento(titulo: string, estilos: string, cuerpo: string): void {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument!
  doc.open()
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${estilos}</style></head><body>${cuerpo}</body></html>`)
  doc.close()

  const imprimir = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => iframe.remove(), 1500)
  }
  // Espera a que cargue el logo (si hay) antes de imprimir
  const imagenes = Array.from(doc.images)
  if (imagenes.length === 0) setTimeout(imprimir, 50)
  else Promise.all(imagenes.map((i) => (i.complete ? null : new Promise((ok) => { i.onload = i.onerror = ok })))).then(imprimir)
}
