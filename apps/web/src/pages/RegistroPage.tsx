import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'

import { api, mensajeError } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import type { Plan, User } from '../types'
import { AuthMarco, BotonEnviar, Campo, CampoClave, ErrorForm } from '../components/AuthMarco'
import { useConfigPublica } from '../lib/configPublica'

/** Mismas reglas que el servidor: mínimo 8, con letras y números. */
const REGLAS_CLAVE = [
  { texto: '8 caracteres', ok: (c: string) => c.length >= 8 },
  { texto: 'letras', ok: (c: string) => /\p{L}/u.test(c) },
  { texto: 'números', ok: (c: string) => /\d/.test(c) },
]

const fmtUsd = (v: number) =>
  `$${v.toLocaleString('es-VE', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

export function RegistroPage() {
  const { aplicarSesion } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const planCodigo = params.get('plan') ?? undefined
  const config = useConfigPublica()

  const [planes, setPlanes] = useState<Plan[]>([])
  const [empresa, setEmpresa] = useState('')
  const [rif, setRif] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get<Plan[]>('/planes').then((r) => setPlanes(r.data)).catch(() => {})
  }, [])

  const plan = planes.find((p) => p.codigo === planCodigo)
  const diasPrueba = plan?.dias_trial ?? planes[0]?.dias_trial ?? 14
  const registroCerrado = config ? config.modo === 'dedicado' || !config.registro_publico : false
  const claveValida = REGLAS_CLAVE.every((r) => r.ok(password))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!claveValida) {
      setError('La contraseña necesita al menos 8 caracteres, con letras y números.')
      return
    }
    setLoading(true)
    try {
      const res = await api.post<{ token: string; user: User }>('/registro', {
        empresa_nombre: empresa.trim(),
        rif: rif.trim() || null,
        admin_nombre: nombre.trim(),
        email: email.trim(),
        password,
        plan_codigo: planCodigo,
      })
      aplicarSesion(res.data.token, res.data.user)
      navigate('/dashboard')
    } catch (err) {
      // Muestra el motivo real (correo repetido, demasiados intentos, sin conexión…).
      setError(mensajeError(err, 'No se pudo crear la cuenta. Inténtalo de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthMarco
      titular={<>Tu negocio, <em>cuadrado</em> desde el primer día.</>}
      verdades={[
        `${diasPrueba} días gratis. No pedimos tarjeta.`,
        'Sube tus productos desde el Excel que ya tienes.',
        'Funciona en la computadora, tablet o teléfono del mostrador.',
      ]}
    >
      {registroCerrado ? (
        <>
          <h1>El registro está cerrado</h1>
          <p className="au-sub">
            Para abrir una cuenta en Boxy escríbenos y te la preparamos.
          </p>
          <a href="/#contacto" className="lp-btn lp-btn-verde au-enviar mt-7">
            Hablar con ventas
          </a>
          <p className="au-pie">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="au-enlace">
              Inicia sesión
            </Link>
          </p>
        </>
      ) : (
        <>
          <h1>Crea tu cuenta</h1>
          <p className="au-sub">
            {diasPrueba} días gratis, sin tarjeta. Al terminar entras directo a tu caja.
          </p>

          {plan && (
            <div className="au-plan">
              <span>
                Plan <strong>{plan.nombre}</strong>
              </span>
              <span className="num text-[var(--lp-tinta-2)]">
                {fmtUsd(Number(plan.precio_mensual_usd))}/mes al terminar la prueba
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="au-campos mt-7">
            <fieldset className="au-grupo">
              <legend>Tu negocio</legend>
              <Campo
                id="reg-empresa"
                label="Nombre del negocio"
                autoComplete="organization"
                required
                maxLength={255}
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
              />
              <Campo
                id="reg-rif"
                label="RIF"
                opcional
                placeholder="J-12345678-9"
                autoCapitalize="characters"
                maxLength={20}
                value={rif}
                onChange={(e) => setRif(e.target.value)}
                ayuda="Puedes agregarlo después en los datos de la empresa."
              />
            </fieldset>

            <fieldset className="au-grupo">
              <legend>Tu acceso</legend>
              <Campo
                id="reg-nombre"
                label="Tu nombre"
                autoComplete="name"
                required
                maxLength={255}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              <Campo
                id="reg-correo"
                label="Correo"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <CampoClave
                id="reg-clave"
                label="Contraseña"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                ayuda={
                  <span className="au-reglas">
                    <span className="sr-only">La contraseña debe tener:</span>
                    {REGLAS_CLAVE.map((r) => {
                      const ok = r.ok(password)
                      return (
                        <span key={r.texto} className="au-regla" data-ok={ok}>
                          <span className="au-regla-punto" aria-hidden>
                            {ok && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
                          </span>
                          {r.texto}
                          <span className="sr-only">{ok ? ' (cumplido)' : ' (falta)'}</span>
                        </span>
                      )
                    })}
                  </span>
                }
              />
            </fieldset>

            {error && <ErrorForm>{error}</ErrorForm>}
            <BotonEnviar cargando={loading}>{loading ? 'Creando tu cuenta…' : 'Crear cuenta y empezar'}</BotonEnviar>
          </form>

          <p className="au-pie">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="au-enlace">
              Inicia sesión
            </Link>
          </p>
        </>
      )}
    </AuthMarco>
  )
}
