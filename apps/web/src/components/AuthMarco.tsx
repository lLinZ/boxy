import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Eye, EyeOff } from 'lucide-react'
import '@fontsource-variable/archivo/wdth.css'
import '../pages/landing.css'
import '../pages/auth.css'
import { BoxyLogo } from './BoxyLogo'

/**
 * Marco de las pantallas de acceso (login y registro), con el mismo mundo de la
 * landing: el panel grafito es la gaveta y el formulario es el papel que sale de ella.
 */
export function AuthMarco({
  titular,
  verdades,
  volverAlInicio = true,
  children,
}: {
  /** Frase grande del panel grafito. */
  titular: ReactNode
  /** Tres cosas que Boxy ya hace (nada inventado). */
  verdades: string[]
  volverAlInicio?: boolean
  children: ReactNode
}) {
  return (
    <div className="lp au">
      <aside className="au-gaveta" aria-label="Boxy">
        <div aria-hidden className="au-letras">
          <span className="au-letra au-letra-usd">$</span>
          <span className="au-letra au-letra-bs">Bs</span>
        </div>

        <div className="au-gaveta-top">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Boxy, ir al inicio">
            <BoxyLogo className="h-10 w-10" />
            <span className="lp-display text-xl">Boxy</span>
          </Link>
          {volverAlInicio && (
            <Link to="/" className="au-volver">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Inicio
            </Link>
          )}
        </div>

        <p className="au-titular">{titular}</p>

        <ul className="au-verdades">
          {verdades.map((v) => (
            <li key={v}>
              <span className="au-check" aria-hidden><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
              {v}
            </li>
          ))}
        </ul>
      </aside>

      <main className="au-papel">
        <div className="au-form">{children}</div>
      </main>
    </div>
  )
}

/** Campo de texto con etiqueta arriba, ayuda y error accesibles. */
export function Campo({
  id,
  label,
  opcional,
  ayuda,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; opcional?: boolean; ayuda?: ReactNode }) {
  return (
    <div className="au-campo">
      <label htmlFor={id}>
        {label} {opcional && <span className="au-opcional">(opcional)</span>}
      </label>
      <input id={id} className="au-input" aria-describedby={ayuda ? `${id}-ayuda` : undefined} {...props} />
      {ayuda && <div id={`${id}-ayuda`} className="au-ayuda">{ayuda}</div>}
    </div>
  )
}

/** Campo de contraseña con botón para mostrarla. */
export function CampoClave({
  id,
  label,
  ayuda,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; ayuda?: ReactNode }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="au-campo">
      <label htmlFor={id}>{label}</label>
      <div className="au-clave">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="au-input"
          aria-describedby={ayuda ? `${id}-ayuda` : undefined}
          {...props}
        />
        <button
          type="button"
          className="au-ojo"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {ayuda && <div id={`${id}-ayuda`} className="au-ayuda">{ayuda}</div>}
    </div>
  )
}

/** Mensaje de error del formulario. */
export function ErrorForm({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="au-error">
      {children}
    </p>
  )
}

/** Botón principal con estado de carga. */
export function BotonEnviar({ cargando, children }: { cargando: boolean; children: ReactNode }) {
  return (
    <button type="submit" className="lp-btn lp-btn-verde au-enviar" disabled={cargando} aria-busy={cargando}>
      {cargando && <span className="au-girando" aria-hidden />}
      {children}
    </button>
  )
}
