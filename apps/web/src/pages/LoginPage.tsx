import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { inicioPara } from '../lib/permisos'
import { AuthMarco, BotonEnviar, Campo, CampoClave, ErrorForm } from '../components/AuthMarco'
import { useConfigPublica } from '../lib/configPublica'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const config = useConfigPublica()
  // Solo en desarrollo se precargan las credenciales de la demo
  const [email, setEmail] = useState(import.meta.env.DEV ? 'aristides@boxy.com' : '')
  const [password, setPassword] = useState(import.meta.env.DEV ? 'password' : '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const dedicado = config?.modo === 'dedicado'
  const registroAbierto = !dedicado && (config?.registro_publico ?? true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const u = await login(email.trim(), password)
      navigate(inicioPara(u))
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      setError(
        status === 429
          ? 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.'
          : status === undefined
            ? 'No hay conexión con Boxy. Revisa tu internet e inténtalo de nuevo.'
            : 'El correo o la contraseña no coinciden. Revísalos e inténtalo de nuevo.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthMarco
      volverAlInicio={!dedicado}
      titular={<>Abre la caja y <em>cobra</em>.</>}
      verdades={[
        'Bolívares y dólares en la misma venta, con la tasa BCV del día.',
        'IGTF solo sobre lo que pagan las divisas, y el vuelto en Bs, USD o pago móvil.',
        'Si se cae el internet, sigues vendiendo.',
      ]}
    >
      <h1>Inicia sesión</h1>
      <p className="au-sub">Entra con el correo y la contraseña de tu usuario.</p>

      <form onSubmit={handleSubmit} className="au-campos mt-7">
        <Campo
          id="login-correo"
          label="Correo"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
        />
        <CampoClave
          id="login-clave"
          label="Contraseña"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error ? true : undefined}
        />
        {error && <ErrorForm>{error}</ErrorForm>}
        <BotonEnviar cargando={loading}>{loading ? 'Entrando…' : 'Entrar'}</BotonEnviar>
      </form>

      <p className="au-nota">
        ¿Olvidaste tu contraseña? Pídele una nueva a quien administra tu negocio
        {dedicado ? '.' : <>; si eres tú, <a href="/#contacto" className="au-enlace">escríbenos</a>.</>}
      </p>

      {registroAbierto && (
        <p className="au-pie">
          ¿Todavía no usas Boxy?{' '}
          <Link to="/registro" className="au-enlace">
            Prueba gratis
          </Link>
        </p>
      )}
    </AuthMarco>
  )
}
