import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthContext'

export type Mode = 'light' | 'dark'
export type Accent = 'verde' | 'cian' | 'azul' | 'violeta' | 'rosa' | 'rojo' | 'naranja' | 'lima'

// Acentos personalizados (los colores de kobra). El color es solo para el swatch.
export const ACCENTS: { key: Accent; label: string; color: string }[] = [
  { key: 'verde', label: 'Verde', color: '#72DB5A' },
  { key: 'cian', label: 'Cian', color: '#00D7FF' },
  { key: 'azul', label: 'Azul', color: '#5DBFFF' },
  { key: 'violeta', label: 'Violeta', color: '#A8ABFF' },
  { key: 'rosa', label: 'Rosa', color: '#FF81B9' },
  { key: 'rojo', label: 'Rojo', color: '#FF8289' },
  { key: 'naranja', label: 'Naranja', color: '#FF9A00' },
  { key: 'lima', label: 'Lima', color: '#DCBE00' },
]

const ACENTO_DEFECTO: Accent = 'verde'
const ACCENT_KEYS = ACCENTS.map((a) => a.key)

interface ThemeCtx {
  mode: Mode
  accent: Accent
  glass: boolean
  /** Clases para paneles/Cards cuando el efecto glass está activo. */
  panel: string
  setMode: (m: Mode) => void
  toggleMode: () => void
  setAccent: (a: Accent) => void
  toggleGlass: () => void
}

const Ctx = createContext<ThemeCtx | undefined>(undefined)

const storageKey = (userId?: number) => `crotone_theme_${userId ?? 'guest'}`

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>('light')
  const [accent, setAccent] = useState<Accent>(ACENTO_DEFECTO)
  const [glass, setGlass] = useState(true)

  // Carga la preferencia guardada del usuario (o del invitado).
  useEffect(() => {
    const raw = localStorage.getItem(storageKey(user?.id))
    if (raw) {
      try {
        const p = JSON.parse(raw)
        if (p.mode) setMode(p.mode)
        // Si la preferencia trae un acento viejo (paleta anterior), usa el por defecto.
        setAccent(ACCENT_KEYS.includes(p.accent) ? p.accent : ACENTO_DEFECTO)
        if (typeof p.glass === 'boolean') setGlass(p.glass)
        return
      } catch {
        /* ignora json corrupto */
      }
    }
    // Sin preferencia previa: respeta el modo del sistema operativo.
    setMode(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  }, [user?.id])

  // Aplica la clase de tema y persiste.
  // La clase va en <body>, no en <html>: HeroUI emite el tema claro base en `:root`,
  // que competiría con `.verde-light` (misma especificidad) y ganaría por orden de CSS.
  // En <body> las variables CSS del acento heredan y sobrescriben a las de `:root`.
  // Los portales (modales/popovers) cuelgan de <body>, así que también quedan temados.
  useEffect(() => {
    const themeClass = `${accent}-${mode}`
    document.body.className = themeClass
    document.documentElement.style.colorScheme = mode
    localStorage.setItem(storageKey(user?.id), JSON.stringify({ mode, accent, glass }))
  }, [mode, accent, glass, user?.id])

  const value = useMemo<ThemeCtx>(
    () => ({
      mode,
      accent,
      glass,
      panel: glass
        ? 'bg-content1/60 backdrop-blur-2xl backdrop-saturate-150 border border-default-200/50'
        : '',
      setMode,
      toggleMode: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
      setAccent,
      toggleGlass: () => setGlass((g) => !g),
    }),
    [mode, accent, glass],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return c
}
