import { Avatar, Card, CardBody, Chip, Divider, Switch } from '@heroui/react'
import { Building2, Check, KeyRound, MapPin, Moon, Palette, ShieldCheck, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { FormClave, FormPin } from '../components/CuentaModal'
import { ACCENTS, useTheme, type Mode } from '../theme/ThemeContext'
import { ROL_LABEL } from '../lib/permisos'


const iniciales = (nombre?: string) =>
  (nombre ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

/** Mi perfil: datos de la cuenta, apariencia personal y seguridad. */
export function PerfilPage() {
  const { user, puede } = useAuth()
  const { panel } = useTheme()
  const puedeAutorizar = puede('ventas.anular', 'ventas.descuento', 'fiado.exceder_limite')

  if (!user) return null

  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      {/* Identidad */}
      <aside className="lg:sticky lg:top-0 lg:self-start">
        <Card className={panel} shadow="sm">
          <CardBody className="items-center gap-4 p-6 text-center">
            <Avatar
              name={iniciales(user.name)}
              getInitials={(n) => n}
              color="primary"
              className="h-20 w-20 font-display text-2xl font-bold"
            />
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold tracking-tight">{user.name}</h2>
              <p className="mt-0.5 truncate text-small text-default-500">{user.email}</p>
            </div>
            <Chip color="primary" variant="flat" size="sm" startContent={<ShieldCheck className="ml-1 h-3.5 w-3.5" />}>
              {ROL_LABEL[user.rol] ?? user.rol}
            </Chip>
            <Divider />
            <dl className="flex w-full flex-col gap-3 text-left text-small">
              {user.empresa && <Dato icono={<Building2 className="h-4 w-4" />} titulo="Empresa" valor={user.empresa.nombre} />}
              {user.sucursal && <Dato icono={<MapPin className="h-4 w-4" />} titulo="Sucursal" valor={user.sucursal.nombre} />}
            </dl>
          </CardBody>
        </Card>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <Seccion
          icono={<Palette className="h-5 w-5" />}
          titulo="Apariencia"
          descripcion="Solo cambia cómo ves Boxy en tu cuenta; no afecta a los demás usuarios."
        >
          <Apariencia />
        </Seccion>

        <Seccion
          icono={<KeyRound className="h-5 w-5" />}
          titulo="Clave de acceso"
          descripcion="Al cambiarla se cierran tus sesiones en otros equipos."
        >
          <div className="max-w-md">
            <FormClave />
          </div>
        </Seccion>

        {puedeAutorizar && (
          <Seccion
            icono={<ShieldCheck className="h-5 w-5" />}
            titulo="PIN de supervisor"
            descripcion="Con tu correo y este PIN autorizas en caja anulaciones, devoluciones, descuentos y fiado por encima del límite."
            extra={
              <Chip size="sm" variant="flat" color={user.tiene_pin ? 'success' : 'default'}>
                {user.tiene_pin ? 'Configurado' : 'Sin PIN'}
              </Chip>
            }
          >
            <div className="max-w-md">
              <FormPin />
            </div>
          </Seccion>
        )}
      </div>
    </div>
  )
}

function Dato({ icono, titulo, valor }: { icono: ReactNode; titulo: string; valor: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-default-400">{icono}</span>
      <div className="min-w-0">
        <dt className="text-tiny text-default-500">{titulo}</dt>
        <dd className="truncate font-medium">{valor}</dd>
      </div>
    </div>
  )
}

function Seccion({
  icono,
  titulo,
  descripcion,
  extra,
  children,
}: {
  icono: ReactNode
  titulo: string
  descripcion: string
  extra?: ReactNode
  children: ReactNode
}) {
  const { panel } = useTheme()
  return (
    <Card className={panel} shadow="sm">
      <CardBody className="gap-5 p-6">
        <header className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-primary/10 text-primary">{icono}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-bold tracking-tight">{titulo}</h3>
              {extra}
            </div>
            <p className="mt-0.5 max-w-prose text-small text-default-500">{descripcion}</p>
          </div>
        </header>
        {children}
      </CardBody>
    </Card>
  )
}

const MODOS: { key: Mode; label: string; icono: typeof Sun }[] = [
  { key: 'light', label: 'Claro', icono: Sun },
  { key: 'dark', label: 'Oscuro', icono: Moon },
]

function Apariencia() {
  const { mode, setMode, accent, setAccent, glass, toggleGlass } = useTheme()

  return (
    <div className="flex flex-col gap-6">
      {/* Modo */}
      <fieldset>
        <legend className="mb-2 text-small font-semibold">Modo</legend>
        <div className="grid max-w-sm grid-cols-2 gap-2" role="radiogroup">
          {MODOS.map((m) => {
            const activo = mode === m.key
            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setMode(m.key)}
                className={`flex items-center justify-center gap-2 rounded-medium border px-3 py-2.5 text-small font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  activo
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-default-200 text-default-600 hover:bg-default-100'
                }`}
              >
                <m.icono className="h-4 w-4" />
                {m.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Color de acento */}
      <fieldset>
        <legend className="mb-2 text-small font-semibold">Color de acento</legend>
        <div className="flex flex-wrap gap-3" role="radiogroup">
          {ACCENTS.map((a) => {
            const activo = accent === a.key
            return (
              <button
                key={a.key}
                type="button"
                role="radio"
                aria-checked={activo}
                aria-label={a.label}
                title={a.label}
                onClick={() => setAccent(a.key)}
                className={`group flex flex-col items-center gap-1.5 rounded-medium p-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${
                    activo ? 'ring-2 ring-foreground ring-offset-2 ring-offset-content1' : ''
                  }`}
                  style={{ backgroundColor: a.color }}
                >
                  {activo && <Check className="h-4 w-4 text-black/70" strokeWidth={3} />}
                </span>
                <span className={`text-tiny ${activo ? 'font-semibold text-foreground' : 'text-default-500'}`}>{a.label}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Efecto vidrio */}
      <div className="flex items-center justify-between gap-4 rounded-medium border border-default-200 px-4 py-3">
        <div>
          <p className="text-small font-semibold">Efecto vidrio</p>
          <p className="text-tiny text-default-500">Paneles translúcidos con fondo de color. Apágalo en equipos lentos.</p>
        </div>
        <Switch isSelected={glass} onValueChange={toggleGlass} aria-label="Efecto vidrio" />
      </div>
    </div>
  )
}
