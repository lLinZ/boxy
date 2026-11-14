// ¿Hay conexión real con el servidor?
//
// navigator.onLine solo dice si hay red local: con el Wi-Fi conectado pero sin
// internet (el caso típico cuando se cae el proveedor) sigue en true. Por eso se
// confirma con una petición corta a /api/config, que el service worker NO guarda
// en caché (vite.config.ts), cada 15 s y cada vez que el navegador avisa un cambio.
import { useEffect, useState } from 'react'

let enLinea = navigator.onLine
const oyentes = new Set<(v: boolean) => void>()

function fijar(v: boolean) {
  if (v === enLinea) return
  enLinea = v
  oyentes.forEach((fn) => fn(v))
  // El resto de la app (cola de ventas) escucha el evento estándar.
  if (v) window.dispatchEvent(new Event('boxy:en-linea'))
}

export async function comprobarConexion(): Promise<boolean> {
  if (!navigator.onLine) {
    fijar(false)
    return false
  }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const r = await fetch('/api/config', { cache: 'no-store', signal: ctrl.signal, headers: { Accept: 'application/json' } })
    clearTimeout(t)
    fijar(r.ok || r.status < 500)
  } catch {
    fijar(false)
  }
  return enLinea
}

let iniciado = false
function iniciar() {
  if (iniciado) return
  iniciado = true
  window.addEventListener('online', () => void comprobarConexion())
  window.addEventListener('offline', () => fijar(false))
  setInterval(() => void comprobarConexion(), 15000)
  void comprobarConexion()
}

export const hayConexion = () => enLinea

/** Hook: true si el servidor responde. */
export function useConexion(): boolean {
  const [v, setV] = useState(enLinea)
  useEffect(() => {
    iniciar()
    oyentes.add(setV)
    return () => {
      oyentes.delete(setV)
    }
  }, [])
  return v
}
