import { useEffect, useState } from 'react'
import { api } from './api'

export interface ConfigPublica {
  modo: string
  registro_publico: boolean
}

/** Lee /config (público). Mientras carga devuelve null. */
export function useConfigPublica() {
  const [config, setConfig] = useState<ConfigPublica | null>(null)
  useEffect(() => {
    api.get<ConfigPublica>('/config').then((r) => setConfig(r.data)).catch(() => {})
  }, [])
  return config
}
