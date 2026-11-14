// Instalar Boxy como app (PWA).
//
// Chrome/Edge/Android disparan "beforeinstallprompt" una sola vez y temprano: se
// captura al arrancar (main.tsx llama a escucharInstalacion) y se guarda para que
// el botón "Instalar app" lo use cuando la persona quiera. En iPhone/iPad (Safari)
// no existe ese evento: se instala desde Compartir → "Agregar a inicio".

interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let diferido: EventoInstalar | null = null
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((fn) => fn())

export function escucharInstalacion(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // sin el aviso automático: lo pide el botón
    diferido = e as EventoInstalar
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    diferido = null
    avisar()
  })
}

export function alCambiarInstalacion(fn: () => void): () => void {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

/** ¿Ya se está usando como app instalada? */
export function esAppInstalada(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export function esIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export const puedeInstalarDirecto = () => diferido !== null

/** Abre el diálogo del navegador. Devuelve true si la persona aceptó. */
export async function instalar(): Promise<boolean> {
  if (!diferido) return false
  const e = diferido
  diferido = null
  await e.prompt()
  const { outcome } = await e.userChoice
  avisar()
  return outcome === 'accepted'
}
