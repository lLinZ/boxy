import axios from 'axios'

const TOKEN_KEY = 'crotone_token'

export const api = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json' },
})

// Adjunta el token en cada petición.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Si el token expira, limpia y manda a login. Si la licencia venció (402),
// lleva al usuario a la pantalla de "Mi licencia" para que pueda pagar.
// Sin conexión (sin respuesta) no se toca la sesión: el POS sigue trabajando.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status
    const path = window.location.pathname
    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      if (!path.startsWith('/login')) window.location.href = '/login'
    } else if (status === 402 && path !== '/billing') {
      window.location.href = '/billing'
    }
    return Promise.reject(error)
  },
)

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

/** Datos extra que manda el servidor en los errores de reglas de negocio. */
export interface ErrorApi {
  status: number | null
  mensaje: string
  datos: Record<string, unknown>
  sinConexion: boolean
}

/** Convierte cualquier error de axios en un mensaje legible (y los datos extra). */
export function leerError(e: unknown, porDefecto = 'No se pudo completar la operación.'): ErrorApi {
  if (axios.isAxiosError(e)) {
    // Sin respuesta, o el servidor web no alcanza a la API (502/503/504): se trata como sin conexión
    if (!e.response || [502, 503, 504].includes(e.response.status)) {
      return { status: e.response?.status ?? null, mensaje: 'Sin conexión con el servidor.', datos: {}, sinConexion: true }
    }
    const data = (e.response.data ?? {}) as Record<string, unknown>
    const errores = data.errors as Record<string, string[]> | undefined
    const mensaje = errores
      ? Object.values(errores).flat().join(' ')
      : typeof data.message === 'string' && data.message
        ? data.message
        : porDefecto
    return { status: e.response.status, mensaje, datos: data, sinConexion: false }
  }
  return { status: null, mensaje: porDefecto, datos: {}, sinConexion: false }
}

export function mensajeError(e: unknown, porDefecto?: string): string {
  return leerError(e, porDefecto).mensaje
}

/** Descarga un archivo de un endpoint autenticado y lo abre en otra pestaña. */
export async function abrirArchivo(ruta: string): Promise<void> {
  const res = await api.get(ruta, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

/** PDF del comprobante (documento no fiscal). */
export function abrirFacturaPdf(ventaId: number): Promise<void> {
  return abrirArchivo(`/ventas/${ventaId}/pdf`)
}

/** Descarga un archivo autenticado con su nombre (respaldos, etc.). */
export async function descargarArchivo(ruta: string, nombre: string): Promise<void> {
  const res = await api.get(ruta, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
