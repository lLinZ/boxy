import { Accordion, AccordionItem, Button, Chip } from '@heroui/react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Banknote,
  Boxes,
  Calculator,
  Check,
  CloudOff,
  HandCoins,
  LineChart,
  MessageCircle,
  Percent,
  ScanBarcode,
  ShieldCheck,
  Store,
  Truck,
  Wallet,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { n, usd } from '../lib/format'
import type { ContactoVentas, Plan } from '../types'

interface ConfigPublica {
  modo: string
  registro_publico: boolean
  ventas?: ContactoVentas
}

/* ── Venta de ejemplo para la caja de la portada ──────────────────────────
   Montos canónicos en USD; IVA por línea; IGTF 3 % solo sobre lo que pagan
   las divisas; el resto en Bs a la tasa BCV. Es ilustrativa (tasa de ejemplo). */
const TASA_EJEMPLO = 36.5
const LINEAS = [
  { nombre: 'Harina de maíz 1 kg', cant: 2, precio: 1.1, iva: 0.08 },
  { nombre: 'Arroz 1 kg', cant: 1, precio: 1.3, iva: 0.08 },
  { nombre: 'Coca-Cola 2 L', cant: 1, precio: 1.8, iva: 0.16 },
  { nombre: 'Queso blanco 0,5 kg', cant: 1, precio: 3.4, iva: 0 },
]
const PAGO_USD = 5
const r2 = (v: number) => Math.round(v * 100) / 100
const base = r2(LINEAS.reduce((s, l) => s + l.cant * l.precio, 0))
const iva16 = r2(LINEAS.filter((l) => l.iva === 0.16).reduce((s, l) => s + l.cant * l.precio * 0.16, 0))
const iva8 = r2(LINEAS.filter((l) => l.iva === 0.08).reduce((s, l) => s + l.cant * l.precio * 0.08, 0))
const total = r2(base + iva16 + iva8)
const igtf = r2(PAGO_USD * 0.03)
const restoBs = r2((total + igtf - PAGO_USD) * TASA_EJEMPLO)
const fmtBs = (v: number) => `Bs ${v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const AL_COBRAR = [
  { icon: Banknote, t: 'Bolívares y dólares en la misma venta', d: 'Mezcla efectivo en USD, pago móvil y Zelle. Los Bs salen a la tasa BCV del día.' },
  { icon: Percent, t: 'IVA e IGTF sin errores', d: 'IVA de 16 %, 8 % o exento según el producto. El IGTF se cobra solo sobre lo que pagan las divisas.' },
  { icon: Calculator, t: 'Vuelto donde lo quieras dar', d: 'Boxy calcula el vuelto en bolívares, en dólares o por pago móvil.' },
  { icon: HandCoins, t: 'Fiado con límite', d: 'Cada cliente tiene su cuenta y su tope de crédito, y los abonos quedan anotados.' },
]

const EL_NEGOCIO = [
  { icon: Wallet, t: 'Caja por turnos', d: 'Apertura, cierre con arqueo a ciegas y reporte Z de cada cajero.' },
  { icon: Boxes, t: 'Inventario con kardex', d: 'Stock por sucursal, alertas de mínimo y de vencimiento, carga por Excel.' },
  { icon: ScanBarcode, t: 'El teléfono como escáner', d: 'Escanea un QR en la caja y el celular lee códigos de barra.' },
  { icon: Truck, t: 'Compras a proveedores', d: 'Registra compras y Boxy actualiza el stock y el costo promedio.' },
  { icon: LineChart, t: 'Ganancia real por producto', d: 'Margen, productos que más rotan y ventas del día en vivo.' },
  { icon: ShieldCheck, t: 'Cada quien con su permiso', d: 'Roles de cajero, gerente y administrador; anulaciones con PIN de supervisor.' },
]

const PREGUNTAS = [
  {
    q: '¿Boxy emite factura fiscal?',
    a: 'No. Los tickets y comprobantes de Boxy son documentos no fiscales. Si tu negocio necesita factura fiscal, Boxy se conecta a una impresora fiscal homologada como ampliación opcional.',
  },
  {
    q: '¿Qué pasa si se va el internet?',
    a: 'Sigues vendiendo. Las ventas se guardan en el equipo y se envían solas cuando vuelve la conexión.',
  },
  {
    q: '¿De dónde sale la tasa del dólar?',
    a: 'Boxy actualiza la tasa BCV dos veces al día. También muestra la tasa USDT como referencia, pero los cobros en bolívares se hacen siempre a tasa BCV.',
  },
  {
    q: '¿Cómo pago la mensualidad?',
    a: 'Por pago móvil, transferencia, USDT o Zelle. Reportas el pago desde el sistema y tu licencia se extiende al confirmarlo.',
  },
  {
    q: '¿Necesito comprar equipos?',
    a: 'No. Funciona en el navegador de la computadora, tablet o teléfono que ya tienes, y se puede instalar como app. Sirve cualquier impresora térmica de 58 u 80 mm.',
  },
]

export function LandingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [planes, setPlanes] = useState<Plan[]>([])
  const [config, setConfig] = useState<ConfigPublica | null>(null)

  useEffect(() => {
    api.get<Plan[]>('/planes').then((r) => setPlanes(r.data)).catch(() => {})
    api.get<ConfigPublica>('/config').then((r) => setConfig(r.data)).catch(() => {})
  }, [])

  const diasPrueba = planes[0]?.dias_trial ?? 14
  const registroAbierto = config?.registro_publico ?? true
  const whatsapp = config?.ventas?.whatsapp
  const enlaceVentas = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent('Hola, quiero información sobre Boxy para mi negocio.')}`
    : config?.ventas?.email
      ? `mailto:${config.ventas.email}`
      : null

  const empezar = (plan?: string) => {
    if (registroAbierto) navigate(plan ? `/registro?plan=${plan}` : '/registro')
    else if (enlaceVentas) window.location.href = enlaceVentas
    else navigate('/login')
  }
  const textoEmpezar = registroAbierto ? `Probar ${diasPrueba} días gratis` : 'Solicitar mi cuenta'

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/25">
      {/* Navegación */}
      <header className="sticky top-0 z-30 border-b border-default-200/70 bg-background/85 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8" aria-label="Principal">
          <a href="#inicio" className="flex items-center gap-2.5 rounded-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Store className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="font-display text-xl font-bold tracking-tight">Boxy</span>
          </a>
          <div className="hidden items-center gap-7 text-small font-medium text-default-600 md:flex">
            <a className="transition-colors hover:text-foreground" href="#cobrar">Cobrar</a>
            <a className="transition-colors hover:text-foreground" href="#negocio">Funciones</a>
            <a className="transition-colors hover:text-foreground" href="#precios">Precios</a>
            <a className="transition-colors hover:text-foreground" href="#preguntas">Preguntas</a>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Button color="primary" onPress={() => navigate('/dashboard')} endContent={<ArrowRight className="h-4 w-4" />}>
                Ir al sistema
              </Button>
            ) : (
              <>
                <Button variant="light" className="hidden sm:flex" onPress={() => navigate('/login')}>
                  Iniciar sesión
                </Button>
                <Button color="primary" className="font-semibold" onPress={() => empezar()}>
                  {registroAbierto ? 'Prueba gratis' : 'Contactar'}
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main id="inicio">
        {/* Portada: la oferta a la izquierda, la caja funcionando a la derecha */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:py-16">
          <div className="entrada">
            <h1 className="text-balance font-display text-[2.6rem] font-bold leading-[1.04] tracking-[-0.03em] sm:text-6xl">
              Vende en bolívares y dólares sin sacar la calculadora.
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-default-600">
              Boxy es la caja, el inventario y el fiado de tu abasto o minimarket. Calcula IVA, IGTF y vuelto a la
              tasa BCV del día, y sigue vendiendo aunque se caiga el internet.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button color="primary" size="lg" className="font-semibold" onPress={() => empezar()} endContent={<ArrowRight className="h-4 w-4" />}>
                {textoEmpezar}
              </Button>
              {enlaceVentas ? (
                <Button as="a" href={enlaceVentas} target="_blank" rel="noopener noreferrer" size="lg" variant="bordered" startContent={<MessageCircle className="h-4 w-4" />}>
                  Hablar con ventas
                </Button>
              ) : (
                <Button size="lg" variant="bordered" onPress={() => navigate('/login')}>
                  Ya tengo cuenta
                </Button>
              )}
            </div>
            {registroAbierto && (
              <p className="mt-4 text-small text-default-500">Sin tarjeta de crédito. Tu tienda queda lista en minutos.</p>
            )}
          </div>

          <CajaEjemplo />
        </section>

        {/* Al cobrar */}
        <section id="cobrar" className="scroll-mt-20 border-t border-default-200/70 bg-content2/40">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:py-28">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2 className="text-balance font-display text-4xl font-bold leading-tight tracking-[-0.02em] sm:text-5xl">
                Hecho para cobrar como se cobra aquí.
              </h2>
              <p className="mt-5 max-w-md text-pretty text-lg text-default-600">
                Un cliente paga con un billete de 5 dólares y el resto por pago móvil. Boxy lo resuelve en la misma
                pantalla, con el IGTF y el vuelto ya calculados.
              </p>
            </div>
            <ul className="divide-y divide-default-200/80">
              {AL_COBRAR.map((f) => (
                <li key={f.t} className="flex gap-5 py-7 first:pt-0 last:pb-0">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold tracking-tight">{f.t}</h3>
                    <p className="mt-1.5 max-w-prose text-default-600">{f.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* El resto del negocio */}
        <section id="negocio" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
              <h2 className="text-balance font-display text-4xl font-bold leading-tight tracking-[-0.02em] sm:text-5xl">
                Y todo lo que pasa detrás del mostrador.
              </h2>
              <OfflineAviso />
            </div>
            <div className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {EL_NEGOCIO.map((f) => (
                <div key={f.t} className="border-t border-default-200 pt-6">
                  <f.icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{f.t}</h3>
                  <p className="mt-1.5 text-default-600">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Precios */}
        <section id="precios" className="scroll-mt-20 border-t border-default-200/70 bg-content2/40">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="max-w-2xl">
              <h2 className="text-balance font-display text-4xl font-bold leading-tight tracking-[-0.02em] sm:text-5xl">
                Un precio fijo al mes, en dólares.
              </h2>
              <p className="mt-4 text-lg text-default-600">
                {registroAbierto ? `Los primeros ${diasPrueba} días son gratis en cualquier plan. ` : ''}
                Pagas por pago móvil, transferencia, USDT o Zelle, y cambias de plan cuando crezcas.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {planes.length === 0 &&
                [0, 1, 2].map((i) => <div key={i} className="h-[26rem] animate-pulse rounded-2xl bg-default-100" aria-hidden />)}
              {planes.map((p, i) => {
                const destacado = planes.length >= 3 ? i === 1 : false
                return (
                  <article
                    key={p.id}
                    className={`flex flex-col rounded-2xl border p-7 transition-transform duration-200 hover:-translate-y-0.5 ${
                      destacado
                        ? 'border-primary bg-content1 shadow-[0_12px_32px_-12px_hsl(var(--heroui-primary)/0.45)]'
                        : 'border-default-200 bg-content1'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-xl font-bold">{p.nombre}</h3>
                      {destacado && (
                        <Chip color="primary" size="sm" variant="flat">
                          El más elegido
                        </Chip>
                      )}
                    </div>
                    {p.descripcion && <p className="mt-1 text-small text-default-500">{p.descripcion}</p>}
                    <p className="mt-6 flex items-baseline gap-1">
                      <span className="font-display text-5xl font-bold tabular-nums tracking-tight">{usd(p.precio_mensual_usd)}</span>
                      <span className="text-default-500">/mes</span>
                    </p>
                    <ul className="mt-6 flex flex-col gap-2.5 text-small">
                      <Li>{p.max_sucursales === 0 ? 'Sucursales ilimitadas' : p.max_sucursales === 1 ? '1 sucursal' : `${p.max_sucursales} sucursales`}</Li>
                      <Li>{p.max_usuarios === 0 ? 'Usuarios ilimitados' : `Hasta ${p.max_usuarios} usuarios`}</Li>
                      <Li>{p.max_productos === 0 ? 'Productos ilimitados' : `Hasta ${n(p.max_productos).toLocaleString('es-VE')} productos`}</Li>
                      <Li>Caja, inventario, clientes y fiado</Li>
                      {p.features?.escaner_remoto && <Li>Escáner con el teléfono</Li>}
                      {p.features?.monitor && <Li>Monitor de ventas en vivo</Li>}
                      {p.features?.analisis && <Li>Análisis de rentabilidad</Li>}
                    </ul>
                    <Button
                      color="primary"
                      variant={destacado ? 'solid' : 'bordered'}
                      className="mt-8 font-semibold"
                      onPress={() => empezar(p.codigo)}
                    >
                      {registroAbierto ? `Empezar con ${p.nombre}` : `Quiero el plan ${p.nombre}`}
                    </Button>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* Preguntas */}
        <section id="preguntas" className="scroll-mt-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-28">
            <div>
              <h2 className="text-balance font-display text-4xl font-bold leading-tight tracking-[-0.02em]">Preguntas frecuentes</h2>
              {enlaceVentas && (
                <p className="mt-4 text-default-600">
                  ¿Otra duda?{' '}
                  <a className="font-semibold text-primary underline-offset-4 hover:underline" href={enlaceVentas} target="_blank" rel="noopener noreferrer">
                    Escríbenos
                  </a>
                  .
                </p>
              )}
            </div>
            <Accordion variant="splitted" selectionMode="multiple" itemClasses={{ title: 'font-semibold', content: 'pb-5 text-default-600' }}>
              {PREGUNTAS.map((p) => (
                <AccordionItem key={p.q} aria-label={p.q} title={p.q} className="shadow-none ring-1 ring-default-200">
                  {p.a}
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Cierre */}
        <section className="px-5 pb-20 sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 rounded-3xl bg-foreground px-8 py-14 text-background sm:px-12 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-balance font-display text-3xl font-bold leading-tight tracking-[-0.02em] sm:text-4xl">
                Abre tu caja en Boxy hoy.
              </h2>
              <p className="mt-3 max-w-lg opacity-75">Carga tus productos, invita a tus cajeros y empieza a vender. Puedes empezar a vender el mismo día.</p>
            </div>
            <Button size="lg" color="primary" className="shrink-0 font-semibold" onPress={() => empezar()} endContent={<ArrowRight className="h-4 w-4" />}>
              {textoEmpezar}
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-default-200/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-small text-default-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            <span className="font-display font-bold text-foreground">Boxy</span> · Punto de venta e inventario para Venezuela · {new Date().getFullYear()}
          </p>
          <p>Los comprobantes de Boxy son documentos no fiscales.</p>
        </div>
      </footer>
    </div>
  )
}

/** La caja de Boxy cobrando una venta mixta (HTML real, no una captura). */
function CajaEjemplo() {
  return (
    <figure className="entrada entrada-tarde relative" aria-label="Ejemplo de una venta en la caja de Boxy">
      <div className="overflow-hidden rounded-2xl border border-default-200 bg-content1 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.35)]">
        {/* Barra de la ventana */}
        <div className="flex items-center justify-between border-b border-default-200 px-5 py-3">
          <div className="flex items-center gap-2 text-small font-semibold">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
            Caja 1 · Turno abierto
          </div>
          <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-tiny font-semibold tabular-nums text-success-700 dark:text-success">
            BCV {TASA_EJEMPLO.toFixed(2).replace('.', ',')}
          </span>
        </div>

        {/* Líneas */}
        <ul className="divide-y divide-default-100 px-5">
          {LINEAS.map((l) => (
            <li key={l.nombre} className="flex items-center justify-between gap-3 py-2.5 text-small">
              <span className="min-w-0">
                <span className="tabular-nums text-default-500">{l.cant} ×</span> <span className="font-medium">{l.nombre}</span>
                <span className="ml-2 text-tiny text-default-400">{l.iva === 0 ? 'Exento' : `IVA ${l.iva * 100} %`}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">{usd(l.cant * l.precio)}</span>
            </li>
          ))}
        </ul>

        {/* Totales */}
        <dl className="space-y-1.5 border-t border-default-200 bg-content2/50 px-5 py-4 text-small tabular-nums">
          <Fila t="Base imponible" v={usd(base)} />
          <Fila t="IVA 16 %" v={usd(iva16)} />
          <Fila t="IVA 8 %" v={usd(iva8)} />
          <div className="flex items-baseline justify-between pt-2">
            <dt className="font-display text-base font-bold">Total</dt>
            <dd className="text-right">
              <span className="font-display text-2xl font-bold">{usd(total)}</span>
              <span className="ml-2 text-default-500">{fmtBs(total * TASA_EJEMPLO)}</span>
            </dd>
          </div>
        </dl>

        {/* Pagos */}
        <div className="space-y-2 px-5 py-4 text-small tabular-nums">
          <Pago icono={<Banknote className="h-4 w-4" />} t="Efectivo USD" v={usd(PAGO_USD)} />
          <Pago icono={<Percent className="h-4 w-4" />} t="IGTF 3 % sobre las divisas" v={usd(igtf)} tenue />
          <Pago icono={<Wallet className="h-4 w-4" />} t="Pago móvil" v={fmtBs(restoBs)} />
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground">
            <Check className="h-4 w-4" strokeWidth={3} /> Cobrado · vuelto Bs 0,00
          </div>
        </div>
      </div>
    </figure>
  )
}

function Fila({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex justify-between text-default-600">
      <dt>{t}</dt>
      <dd>{v}</dd>
    </div>
  )
}

function Pago({ icono, t, v, tenue = false }: { icono: ReactNode; t: string; v: string; tenue?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${tenue ? 'text-default-500' : 'bg-default-100 font-medium'}`}>
      <span className="flex items-center gap-2">
        <span className="text-default-500">{icono}</span>
        {t}
      </span>
      <span>{v}</span>
    </div>
  )
}

/** Cola de ventas sin conexión: lo que el cajero ve cuando se cae el internet. */
function OfflineAviso() {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-default-200 bg-content1 p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning-600">
        <CloudOff className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold">Se fue el internet. La caja sigue abierta.</p>
        <p className="mt-1 text-small text-default-600">
          Las ventas se guardan en el equipo y se envían solas al volver la conexión. Nadie se queda sin cobrar.
        </p>
      </div>
    </div>
  )
}

function Li({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
      <span className="text-default-700">{children}</span>
    </li>
  )
}
