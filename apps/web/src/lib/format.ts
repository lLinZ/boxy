// Helpers de formato monetario (Venezuela: USD y Bs).

export const n = (v: string | number): number => Number(v) || 0

export const usd = (v: string | number): string =>
  '$' + n(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const bs = (v: string | number): string =>
  'Bs ' + n(v).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fecha = (iso: string): string =>
  new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })

export const ivaLabel: Record<string, string> = {
  general: 'IVA 16%',
  reducido: 'IVA 8%',
  exento: 'Exento',
}
