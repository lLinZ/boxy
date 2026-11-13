// Envío por WhatsApp con enlaces wa.me: abre WhatsApp (web o app) con el
// mensaje escrito; la persona solo pulsa "Enviar". No usa la API de pago de Meta.
import { bs, n, usd } from './format'
import type { Cliente, Venta } from '../types'

/** Normaliza un teléfono venezolano: 0414-123.45.67 → 584141234567. */
export function normalizarTelefono(telefono: string | null | undefined, codigoPais = '58'): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '')
  if (digitos.length < 7) return null
  if (digitos.startsWith(codigoPais) && digitos.length > 10) return digitos
  return codigoPais + digitos.replace(/^0+/, '')
}

export function enlaceWhatsApp(telefono: string | null | undefined, texto: string, codigoPais = '58'): string | null {
  const numero = normalizarTelefono(telefono, codigoPais)
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null
}

export function abrirWhatsApp(telefono: string | null | undefined, texto: string, codigoPais = '58'): boolean {
  const url = enlaceWhatsApp(telefono, texto, codigoPais)
  if (!url) return false
  window.open(url, '_blank', 'noopener')
  return true
}

/** Resumen de una compra para mandarlo al cliente. */
export function textoComprobante(venta: Venta, negocio: string): string {
  const lineas = (venta.items ?? []).map(
    (i) => `• ${fmtCantidad(i.cantidad)} × ${i.descripcion} — ${usd(i.total_usd)}`,
  )
  return [
    `*${negocio}*`,
    `Comprobante N° ${venta.numero_factura} (no fiscal)`,
    new Date(venta.fecha).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
    '',
    ...lineas,
    '',
    `*Total: ${usd(venta.total_usd)}* (${bs(venta.total_bs)})`,
    n(venta.puntos_ganados ?? 0) > 0 ? `Ganaste ${venta.puntos_ganados} puntos 🎉` : '',
    '¡Gracias por tu compra!',
  ]
    .filter((l, i, arr) => l !== '' || arr[i - 1] !== '')
    .join('\n')
}

/** Recordatorio de deuda (fiado) con el saldo actual. */
export function textoEstadoCuenta(cliente: Cliente, negocio: string, tasa?: number): string {
  const saldo = n(cliente.saldo_usd ?? 0)
  return [
    `Hola ${cliente.nombre.split(' ')[0]}, te escribimos de *${negocio}*.`,
    saldo > 0
      ? `Tu saldo pendiente es de *${usd(saldo)}*${tasa ? ` (${bs(saldo * tasa)} a tasa BCV de hoy)` : ''}.`
      : 'Tu cuenta está al día. ¡Gracias!',
    saldo > 0 ? 'Puedes abonar en la tienda o por pago móvil. ¡Gracias!' : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function fmtCantidad(c: string | number): string {
  return n(c).toLocaleString('es-VE', { maximumFractionDigits: 3 })
}
