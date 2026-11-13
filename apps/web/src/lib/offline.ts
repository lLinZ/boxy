// Modo sin conexión del POS.
//
// - Guarda en el navegador (IndexedDB) el catálogo con stock, las tasas y las
//   promociones, para poder buscar y cobrar aunque se caiga internet.
// - Las ventas que no llegan al servidor quedan en una cola con un uuid y se
//   reenvían solas al volver la conexión. El servidor usa el uuid para no
//   registrar dos veces la misma venta.
// - Límites: sin conexión no se puede fiar ni canjear puntos (el saldo vive en
//   el servidor), ni anular, ni cerrar caja. El stock local es aproximado.
import { api, leerError } from './api'
import type { AjustesEmpresa, Paginated, Producto, Promocion, TasaVigente } from '../types'

const DB = 'boxy-offline'
const STORE = 'kv'

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => ok(req.result)
    req.onerror = () => mal(req.error)
  })
}

async function leer<T>(clave: string): Promise<T | undefined> {
  const db = await abrir()
  return new Promise((ok, mal) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(clave)
    req.onsuccess = () => ok(req.result as T | undefined)
    req.onerror = () => mal(req.error)
  })
}

async function escribir(clave: string, valor: unknown): Promise<void> {
  const db = await abrir()
  return new Promise((ok, mal) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(valor, clave)
    tx.oncomplete = () => ok()
    tx.onerror = () => mal(tx.error)
  })
}

// ───────── Catálogo ─────────

export interface Catalogo {
  productos: Producto[]
  tasas: TasaVigente[]
  promociones: Promocion[]
  guardado_el: string
}

let catalogoMemoria: Catalogo | null = null

/** Descarga el catálogo completo (con el stock de la sucursal) y lo guarda. */
export async function actualizarCatalogo(): Promise<Catalogo> {
  const productos: Producto[] = []
  for (let pagina = 1; pagina <= 100; pagina++) {
    const r = await api.get<Paginated<Producto>>('/productos', { params: { per_page: 100, page: pagina } })
    productos.push(...r.data.data)
    if (r.data.current_page >= r.data.last_page) break
  }
  const [tasas, promociones] = await Promise.all([
    api.get<TasaVigente[]>('/tasas/vigentes').then((r) => r.data),
    api.get<Promocion[]>('/promociones/vigentes').then((r) => r.data).catch(() => []),
  ])
  const catalogo = { productos, tasas, promociones, guardado_el: new Date().toISOString() }
  catalogoMemoria = catalogo
  await escribir('catalogo', catalogo)
  return catalogo
}

export async function catalogoLocal(): Promise<Catalogo | null> {
  catalogoMemoria ??= (await leer<Catalogo>('catalogo')) ?? null
  return catalogoMemoria
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export async function buscarLocal(texto: string, limite = 12): Promise<Producto[]> {
  const cat = await catalogoLocal()
  if (!cat) return []
  const q = normalizar(texto.trim())
  return cat.productos
    .filter((p) => normalizar(p.nombre).includes(q) || normalizar(p.sku).includes(q) || p.codigo_barra === texto.trim())
    .slice(0, limite)
}

/** Busca por código de barras en el catálogo local (incluye etiquetas de balanza). */
export async function porCodigoLocal(codigo: string, ajustes?: AjustesEmpresa | null): Promise<Producto | null> {
  const cat = await catalogoLocal()
  if (!cat) return null
  const exacto = cat.productos.find((p) => p.codigo_barra === codigo)
  if (exacto) return exacto

  const etiqueta = ajustes ? leerEtiquetaBalanza(codigo, ajustes) : null
  if (!etiqueta) return null
  const p = cat.productos.find((x) => x.codigo_balanza === etiqueta.plu)
  if (!p) return null
  const precio = Number(p.precio_venta_usd)
  const cantidad = etiqueta.tipo === 'peso' ? etiqueta.valor / 1000 : precio > 0 ? etiqueta.valor / 100 / precio : 0
  return { ...p, cantidad_balanza: Math.round(cantidad * 1000) / 1000 }
}

/** Misma lógica que ProductoController::leerEtiquetaBalanza (servidor). */
export function leerEtiquetaBalanza(codigo: string, a: AjustesEmpresa): { plu: string; valor: number; tipo: string } | null {
  if (!a.balanza_activa || !/^\d{13}$/.test(codigo)) return null
  const prefijos = String(a.balanza_prefijos).split(',').map((x) => x.trim())
  if (!prefijos.includes(codigo.slice(0, 2))) return null
  let suma = 0
  for (let i = 0; i < 12; i++) suma += Number(codigo[i]) * (i % 2 === 0 ? 1 : 3)
  if ((10 - (suma % 10)) % 10 !== Number(codigo[12])) return null
  const digitos = Math.max(4, Math.min(6, Number(a.balanza_digitos_plu)))
  const plu = codigo.slice(2, 2 + digitos).replace(/^0+/, '') || '0'
  const valor = Number(codigo.slice(2 + digitos, 12))
  return { plu, valor, tipo: a.balanza_tipo }
}

// ───────── Cola de ventas ─────────

export interface VentaPendiente {
  uuid: string
  creada_el: string
  payload: Record<string, unknown>
  total_usd: number
  /** Si el servidor la rechazó por una regla (no por falta de red), queda para revisión. */
  error?: string
}

type Oyente = (pendientes: VentaPendiente[]) => void
const oyentes = new Set<Oyente>()

export function alCambiarCola(fn: Oyente): () => void {
  oyentes.add(fn)
  pendientes().then(fn)
  return () => oyentes.delete(fn)
}

export async function pendientes(): Promise<VentaPendiente[]> {
  return (await leer<VentaPendiente[]>('cola_ventas')) ?? []
}

async function guardarCola(cola: VentaPendiente[]) {
  await escribir('cola_ventas', cola)
  oyentes.forEach((fn) => fn(cola))
}

export async function encolarVenta(v: VentaPendiente): Promise<void> {
  const cola = await pendientes()
  if (!cola.some((x) => x.uuid === v.uuid)) cola.push(v)
  await guardarCola(cola)
}

export async function descartarPendiente(uuid: string): Promise<void> {
  await guardarCola((await pendientes()).filter((v) => v.uuid !== uuid))
}

let sincronizando = false

/** Envía la cola. Se detiene al primer error de red; los rechazos quedan marcados. */
export async function sincronizarCola(): Promise<{ enviadas: number; rechazadas: number }> {
  if (sincronizando || !navigator.onLine) return { enviadas: 0, rechazadas: 0 }
  sincronizando = true
  let enviadas = 0
  let rechazadas = 0
  try {
    const cola = await pendientes()
    for (const v of cola) {
      if (v.error) continue
      try {
        await api.post('/ventas', { ...v.payload, uuid: v.uuid, origen: 'offline' })
        await guardarCola((await pendientes()).filter((x) => x.uuid !== v.uuid))
        enviadas++
      } catch (e) {
        const err = leerError(e)
        if (err.sinConexion || (err.status ?? 0) >= 500) break
        const actual = await pendientes()
        await guardarCola(actual.map((x) => (x.uuid === v.uuid ? { ...x, error: err.mensaje } : x)))
        rechazadas++
      }
    }
  } finally {
    sincronizando = false
  }
  return { enviadas, rechazadas }
}

/** Reintenta la cola al volver la conexión y cada minuto. */
export function iniciarSincronizacion(): () => void {
  const intentar = () => void sincronizarCola()
  window.addEventListener('online', intentar)
  const timer = setInterval(intentar, 60000)
  intentar()
  return () => {
    window.removeEventListener('online', intentar)
    clearInterval(timer)
  }
}

export function nuevoUuid(): string {
  return crypto.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
}
