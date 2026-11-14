import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, leerError, tokenStore } from '../lib/api'
import { limpiarDatosLocales } from '../lib/offline'
import { puede as puedeFn, type Permiso } from '../lib/permisos'
import type { AjustesEmpresa, EmpresaInfo, FuncionPlan, User } from '../types'

const USUARIO_KEY = 'boxy_usuario'
const EMPRESA_KEY = 'boxy_empresa'

interface AuthContextValue {
  user: User | null
  loading: boolean
  /** Datos y preferencias de la empresa (ticket, IGTF, vuelto, balanza…). */
  empresa: EmpresaInfo | null
  ajustes: AjustesEmpresa | null
  login: (email: string, password: string) => Promise<User>
  /** Inicia sesión con un token+usuario ya obtenidos (ej. tras registro). */
  aplicarSesion: (token: string, user: User) => void
  logout: () => Promise<void>
  /** Vuelve a leer el usuario y la empresa (tras cambiar clave, PIN o ajustes). */
  refrescar: () => Promise<void>
  puede: (...permisos: Permiso[]) => boolean
  /** ¿El plan contratado incluye esta función? (sin datos del plan: sí) */
  tieneFuncion: (funcion: FuncionPlan) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const leerCache = <T,>(clave: string): T | null => {
  try {
    const v = localStorage.getItem(clave)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const guardarUsuario = useCallback((u: User | null) => {
    setUser(u)
    if (u) localStorage.setItem(USUARIO_KEY, JSON.stringify(u))
    else localStorage.removeItem(USUARIO_KEY)
  }, [])

  const cargarEmpresa = useCallback(async (u: User | null) => {
    if (!u?.empresa_id) {
      setEmpresa(null)
      return
    }
    try {
      const r = await api.get<EmpresaInfo>('/empresa')
      setEmpresa(r.data)
      localStorage.setItem(EMPRESA_KEY, JSON.stringify(r.data))
    } catch {
      setEmpresa(leerCache<EmpresaInfo>(EMPRESA_KEY)) // sin conexión: la última conocida
    }
  }, [])

  // Al cargar, si hay token, recupera el usuario. Sin conexión usa el guardado.
  useEffect(() => {
    const token = tokenStore.get()
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get<User>('/me')
      .then(async (res) => {
        guardarUsuario(res.data)
        await cargarEmpresa(res.data)
      })
      .catch(async (e) => {
        if (leerError(e).sinConexion) {
          const cache = leerCache<User>(USUARIO_KEY)
          setUser(cache)
          setEmpresa(leerCache<EmpresaInfo>(EMPRESA_KEY))
        } else {
          tokenStore.clear()
          guardarUsuario(null)
        }
      })
      .finally(() => setLoading(false))
  }, [guardarUsuario, cargarEmpresa])

  async function login(email: string, password: string): Promise<User> {
    const res = await api.post<{ token: string; user: User }>('/login', {
      email,
      password,
      device_name: 'web',
    })
    // Datos guardados de otra sesión (catálogo, respuestas de la API) no se mezclan con esta.
    await limpiarDatosLocales()
    tokenStore.set(res.data.token)
    guardarUsuario(res.data.user)
    await cargarEmpresa(res.data.user)
    return res.data.user
  }

  function aplicarSesion(token: string, nuevoUser: User) {
    void limpiarDatosLocales()
    tokenStore.set(token)
    guardarUsuario(nuevoUser)
    void cargarEmpresa(nuevoUser)
  }

  async function logout() {
    // Sin conexión el servidor no se entera, pero la sesión se cierra igual en el equipo
    // (el token vence solo). Así "Cerrar sesión" nunca se queda colgado.
    await api.post('/logout').catch(() => {})
    tokenStore.clear()
    guardarUsuario(null)
    setEmpresa(null)
    localStorage.removeItem(EMPRESA_KEY)
    await limpiarDatosLocales()
  }

  const refrescar = useCallback(async () => {
    const r = await api.get<User>('/me')
    guardarUsuario(r.data)
    await cargarEmpresa(r.data)
  }, [guardarUsuario, cargarEmpresa])

  const puede = useCallback((...permisos: Permiso[]) => puedeFn(user, ...permisos), [user])
  const tieneFuncion = useCallback((f: FuncionPlan) => empresa?.plan?.funciones?.[f] ?? true, [empresa])

  return (
    <AuthContext.Provider
      value={{ user, loading, empresa, ajustes: empresa?.ajustes ?? null, login, aplicarSesion, logout, refrescar, puede, tieneFuncion }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
