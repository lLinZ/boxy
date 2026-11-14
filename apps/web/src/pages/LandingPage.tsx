import { Accordion, AccordionItem, Button } from '@heroui/react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
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
  Sparkles,
  Store,
  Truck,
  Wallet,
  Wifi,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { n, usd } from '../lib/format'
import { enlaceWhatsApp } from '../lib/whatsapp'
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

/* ── Contactos de ventas por WhatsApp ─────────────────────────────────── */
const MENSAJE_WA = 'Hola, quiero información sobre Boxy para mi negocio.'
const CONTACTOS = [
  { nombre: 'Jose Miguel', telefono: '04222402406' },
  { nombre: 'Aristides Sanchez', telefono: '04124818151' },
].map((c) => ({
  ...c,
  // 04222402406 → 0422 240 2406
  visible: c.telefono.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3'),
  iniciales: c.nombre
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join(''),
  enlace: enlaceWhatsApp(c.telefono, MENSAJE_WA) ?? '#contacto',
}))

const METODOS = ['Efectivo USD', 'Pago móvil', 'Zelle', 'USDT', 'Bolívares en efectivo', 'Transferencia', 'Punto de venta', 'Fiado']

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

const WRAP = 'mx-auto w-full max-w-6xl px-5 sm:px-8'

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
  // Contacto comercial: el del servidor si existe; si no, el primer contacto de la landing.
  const whatsapp = config?.ventas?.whatsapp
  const enlaceVentas = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(MENSAJE_WA)}`
    : CONTACTOS[0].enlace

  const empezar = (plan?: string) => {
    if (registroAbierto) navigate(plan ? `/registro?plan=${plan}` : '/registro')
    else window.location.href = enlaceVentas
  }
  const textoEmpezar = registroAbierto ? `Probar ${diasPrueba} días gratis` : 'Solicitar mi cuenta'

  return (
    <div className="landing min-h-screen bg-background text-foreground selection:bg-primary/25">
      {/* Navegación flotante (cápsula oscura sobre cualquier sección) */}
      <header className="fixed inset-x-0 top-3 z-40 px-3 sm:top-4">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full border border-white/10 bg-zinc-950/75 py-2 pl-4 pr-2 text-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl"
          aria-label="Principal"
        >
          <a href="#inicio" className="flex items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Boxy</span>
          </a>
          <div className="hidden items-center gap-1 text-small font-medium text-white/70 md:flex">
            {[
              ['#cobrar', 'Cobrar'],
              ['#negocio', 'Funciones'],
              ['#precios', 'Precios'],
              ['#contacto', 'Contacto'],
              ['#preguntas', 'Preguntas'],
            ].map(([href, t]) => (
              <a key={href} className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/10 hover:text-white" href={href}>
                {t}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {user ? (
              <Button color="primary" radius="full" size="sm" className="h-9 font-semibold" onPress={() => navigate('/dashboard')} endContent={<ArrowRight className="h-4 w-4" />}>
                Ir al sistema
              </Button>
            ) : (
              <>
                <Button variant="light" radius="full" size="sm" className="hidden h-9 text-white/80 data-[hover=true]:bg-white/10 sm:flex" onPress={() => navigate('/login')}>
                  Iniciar sesión
                </Button>
                <Button color="primary" radius="full" size="sm" className="h-9 font-semibold" onPress={() => empezar()}>
                  {registroAbierto ? 'Prueba gratis' : 'Contactar'}
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main id="inicio">
        {/* ── Portada oscura: oferta + la caja cobrando ─────────────────────── */}
        <section className="landing-hero relative isolate overflow-hidden bg-[#06080a] text-white">
          <div className="landing-grid pointer-events-none absolute inset-0 -z-10" aria-hidden />
          <div className="landing-glow pointer-events-none absolute -top-40 left-1/2 -z-10 h-[42rem] w-[70rem] -translate-x-1/2" aria-hidden />

          <div className={`${WRAP} grid items-center gap-14 pb-20 pt-32 lg:min-h-[100svh] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pb-16 lg:pt-28`}>
            <div className="entrada">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1.5 pr-3 text-small text-white/80 backdrop-blur">
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-tiny font-semibold text-primary">BCV</span>
                Tasa actualizada dos veces al día
              </span>
              <h1 className="mt-6 text-balance font-display text-[2.7rem] font-bold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[4.4rem]">
                Vende en bolívares y dólares{' '}
                <span className="landing-texto-acento">sin sacar la calculadora.</span>
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-white/65">
                Boxy es la caja, el inventario y el fiado de tu abasto o minimarket. Calcula IVA, IGTF y vuelto a la tasa BCV
                del día, y sigue vendiendo aunque se caiga el internet.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button
                  color="primary"
                  size="lg"
                  radius="full"
                  className="landing-boton font-semibold"
                  onPress={() => empezar()}
                  endContent={<ArrowRight className="h-4 w-4" />}
                >
                  {textoEmpezar}
                </Button>
                <Button
                  as="a"
                  href="#contacto"
                  size="lg"
                  radius="full"
                  variant="bordered"
                  className="landing-boton border-white/20 text-white data-[hover=true]:bg-white/5"
                  startContent={<MessageCircle className="h-4 w-4" />}
                >
                  Hablar con ventas
                </Button>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-small text-white/55">
                {(registroAbierto ? ['Sin tarjeta de crédito', 'Lista en minutos', 'Funciona sin internet'] : ['Funciona sin internet', 'Soporte por WhatsApp']).map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" strokeWidth={2.5} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <CajaEjemplo />
          </div>

          {/* Métodos de pago en desplazamiento continuo */}
          <div className="relative border-t border-white/10 py-5">
            <div className="landing-marquee-mask overflow-hidden">
              <div className="landing-marquee flex w-max gap-10 text-small font-medium text-white/45">
                {[...METODOS, ...METODOS].map((m, i) => (
                  <span key={i} className="flex items-center gap-10 whitespace-nowrap">
                    {m}
                    <span className="h-1 w-1 rounded-full bg-white/25" aria-hidden />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Al cobrar: bento con piezas reales de la caja ─────────────────── */}
        <section id="cobrar" className="scroll-mt-24">
          <div className={`${WRAP} py-24 lg:py-32`}>
            <Encabezado
              etiqueta="Al cobrar"
              titulo="Hecho para cobrar como se cobra aquí."
              texto="Un cliente paga con un billete de 5 dólares y el resto por pago móvil. Boxy lo resuelve en la misma pantalla, con el IGTF y el vuelto ya calculados."
            />

            <div className="mt-14 grid gap-4 md:grid-cols-6">
              <Bento className="md:col-span-4" icon={Banknote} t="Bolívares y dólares en la misma venta" d="Mezcla efectivo en USD, pago móvil y Zelle. Los Bs salen a la tasa BCV del día.">
                <div className="mt-6 space-y-2">
                  <div className="flex h-10 overflow-hidden rounded-xl text-tiny font-semibold">
                    <span className="flex w-[52%] items-center justify-center bg-primary text-primary-foreground">USD {usd(PAGO_USD)}</span>
                    <span className="flex w-[48%] items-center justify-center bg-default-200 text-default-700">{fmtBs(restoBs)}</span>
                  </div>
                  <div className="flex justify-between text-tiny text-default-500">
                    <span>Efectivo en divisas</span>
                    <span>Pago móvil · BCV {TASA_EJEMPLO.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </Bento>
              <Bento className="md:col-span-2" icon={Percent} t="IVA e IGTF sin errores" d="16 %, 8 % o exento según el producto. IGTF solo sobre las divisas.">
                <div className="mt-6 flex flex-wrap gap-2">
                  {['IVA 16 %', 'IVA 8 %', 'Exento', 'IGTF 3 %'].map((t, i) => (
                    <span key={t} className={`rounded-full px-3 py-1 text-tiny font-semibold ${i === 3 ? 'bg-primary/15 text-primary-700 dark:text-primary' : 'bg-default-100 text-default-600'}`}>
                      {t}
                    </span>
                  ))}
                </div>
              </Bento>
              <Bento className="md:col-span-3" icon={Calculator} t="Vuelto donde lo quieras dar" d="Boxy calcula el vuelto en bolívares, en dólares o por pago móvil.">
                <div className="mt-6 grid grid-cols-3 gap-2 text-center text-tiny font-semibold">
                  {['Bs', 'USD', 'Pago móvil'].map((t, i) => (
                    <span key={t} className={`rounded-xl border py-2.5 ${i === 0 ? 'border-primary bg-primary/10 text-primary-700 dark:text-primary' : 'border-default-200 text-default-500'}`}>
                      {t}
                    </span>
                  ))}
                </div>
              </Bento>
              <Bento className="md:col-span-3" icon={HandCoins} t="Fiado con límite" d="Cada cliente tiene su cuenta y su tope de crédito, y los abonos quedan anotados.">
                <div className="mt-6">
                  <div className="flex justify-between text-tiny">
                    <span className="font-semibold">María G.</span>
                    <span className="tabular-nums text-default-500">$32,40 de $50,00</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-default-100">
                    <div className="h-full w-[65%] rounded-full bg-gradient-to-r from-primary-400 to-primary-600" />
                  </div>
                </div>
              </Bento>
            </div>
          </div>
        </section>

        {/* ── Detrás del mostrador: banda oscura ────────────────────────────── */}
        <section id="negocio" className="scroll-mt-24 bg-[#06080a] text-white">
          <div className={`${WRAP} py-24 lg:py-32`}>
            <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
              <Encabezado oscuro etiqueta="Funciones" titulo="Y todo lo que pasa detrás del mostrador." />
              <OfflineAviso />
            </div>
            <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {EL_NEGOCIO.map((f) => (
                <div key={f.t} className="group bg-[#0b0e11] p-7 transition-colors duration-300 hover:bg-[#10151a]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-primary transition-transform duration-300 group-hover:-translate-y-0.5">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">{f.t}</h3>
                  <p className="mt-1.5 text-white/55">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Precios ───────────────────────────────────────────────────────── */}
        <section id="precios" className="scroll-mt-24">
          <div className={`${WRAP} py-24 lg:py-32`}>
            <Encabezado
              centrado
              etiqueta="Precios"
              titulo="Un precio fijo al mes, en dólares."
              texto={`${registroAbierto ? `Los primeros ${diasPrueba} días son gratis en cualquier plan. ` : ''}Pagas por pago móvil, transferencia, USDT o Zelle, y cambias de plan cuando crezcas.`}
            />

            <div className="mt-14 grid items-stretch gap-5 md:grid-cols-3">
              {planes.length === 0 &&
                [0, 1, 2].map((i) => <div key={i} className="h-[26rem] animate-pulse rounded-3xl bg-default-100" aria-hidden />)}
              {planes.map((p, i) => {
                const destacado = planes.length >= 3 ? i === 1 : false
                return (
                  <article
                    key={p.id}
                    className={`relative flex flex-col rounded-3xl p-7 transition-transform duration-300 hover:-translate-y-0.5 ${
                      destacado
                        ? 'bg-[#06080a] text-white shadow-[0_30px_60px_-25px_hsl(var(--heroui-primary)/0.55)] ring-1 ring-primary/60'
                        : 'border border-default-200 bg-content1'
                    }`}
                  >
                    {destacado && (
                      <span className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-tiny font-semibold text-primary-foreground">
                        <Sparkles className="h-3 w-3" /> El más elegido
                      </span>
                    )}
                    <h3 className="font-display text-xl font-bold">{p.nombre}</h3>
                    {p.descripcion && <p className={`mt-1 text-small ${destacado ? 'text-white/55' : 'text-default-500'}`}>{p.descripcion}</p>}
                    <p className="mt-6 flex items-baseline gap-1">
                      <span className="font-display text-5xl font-bold tabular-nums tracking-tight">{usd(p.precio_mensual_usd)}</span>
                      <span className={destacado ? 'text-white/55' : 'text-default-500'}>/mes</span>
                    </p>
                    <ul className={`mt-6 flex flex-1 flex-col gap-2.5 border-t pt-6 text-small ${destacado ? 'border-white/10' : 'border-default-200'}`}>
                      <Li oscuro={destacado}>{p.max_sucursales === 0 ? 'Sucursales ilimitadas' : p.max_sucursales === 1 ? '1 sucursal' : `${p.max_sucursales} sucursales`}</Li>
                      <Li oscuro={destacado}>{p.max_usuarios === 0 ? 'Usuarios ilimitados' : `Hasta ${p.max_usuarios} usuarios`}</Li>
                      <Li oscuro={destacado}>{p.max_productos === 0 ? 'Productos ilimitados' : `Hasta ${n(p.max_productos).toLocaleString('es-VE')} productos`}</Li>
                      <Li oscuro={destacado}>Caja, inventario, clientes y fiado</Li>
                      {p.features?.escaner_remoto && <Li oscuro={destacado}>Escáner con el teléfono</Li>}
                      {p.features?.monitor && <Li oscuro={destacado}>Monitor de ventas en vivo</Li>}
                      {p.features?.analisis && <Li oscuro={destacado}>Análisis de rentabilidad</Li>}
                    </ul>
                    <Button
                      color="primary"
                      radius="full"
                      variant={destacado ? 'solid' : 'bordered'}
                      className="landing-boton mt-8 font-semibold"
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

        {/* ── Contacto por WhatsApp ─────────────────────────────────────────── */}
        <section id="contacto" className="scroll-mt-24 border-y border-default-200/70 bg-content2/50">
          <div className={`${WRAP} grid gap-12 py-24 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:py-32`}>
            <div>
              <Encabezado
                etiqueta="Contacto"
                titulo="Habla con una persona, no con un formulario."
                texto="Escríbenos por WhatsApp: te mostramos Boxy funcionando, te ayudamos a cargar tus productos y resolvemos tus dudas sobre los planes."
              />
              <p className="mt-6 flex items-center gap-2 text-small text-default-500">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25D366] opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#25D366]" />
                </span>
                Respondemos directamente desde nuestros teléfonos.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {CONTACTOS.map((c) => (
                <a
                  key={c.telefono}
                  href={c.enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Escribir a ${c.nombre} por WhatsApp al ${c.visible}`}
                  className="group relative flex flex-col overflow-hidden rounded-3xl border border-default-200 bg-content1 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#25D366]/50 hover:shadow-[0_24px_50px_-24px_rgba(37,211,102,0.45)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                >
                  <span className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#25D366]/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100 sm:opacity-0" aria-hidden />
                  <div className="flex items-center justify-between">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-950 font-display text-lg font-bold text-white">
                      {c.iniciales}
                    </span>
                    <ArrowUpRight className="h-5 w-5 text-default-400 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                  <p className="mt-6 font-display text-xl font-semibold tracking-tight">{c.nombre}</p>
                  <p className="mt-1 font-medium tabular-nums text-default-500">{c.visible}</p>
                  <span className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-small font-semibold text-[#062a14] transition-transform duration-200 group-hover:scale-[1.02] group-active:scale-[0.98]">
                    <IconoWhatsApp className="h-4 w-4" />
                    Escribir por WhatsApp
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── Preguntas ─────────────────────────────────────────────────────── */}
        <section id="preguntas" className="scroll-mt-24">
          <div className={`${WRAP} grid gap-10 py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-32`}>
            <div>
              <Encabezado etiqueta="Preguntas" titulo="Preguntas frecuentes" />
              <p className="mt-4 text-default-600">
                ¿Otra duda?{' '}
                <a className="font-semibold text-primary-700 underline-offset-4 hover:underline dark:text-primary" href="#contacto">
                  Escríbenos por WhatsApp
                </a>
                .
              </p>
            </div>
            <Accordion variant="splitted" selectionMode="multiple" itemClasses={{ base: 'rounded-2xl', title: 'font-semibold', content: 'pb-5 text-default-600' }}>
              {PREGUNTAS.map((p) => (
                <AccordionItem key={p.q} aria-label={p.q} title={p.q} className="shadow-none ring-1 ring-default-200">
                  {p.a}
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ── Cierre ────────────────────────────────────────────────────────── */}
        <section className="pb-20">
          <div className={WRAP}>
            <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#06080a] px-8 py-16 text-white sm:px-14 sm:py-20">
              <div className="landing-grid pointer-events-none absolute inset-0 -z-10 opacity-60" aria-hidden />
              <div className="landing-glow pointer-events-none absolute -bottom-56 left-1/2 -z-10 h-[30rem] w-[50rem] -translate-x-1/2" aria-hidden />
              <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
                <div>
                  <h2 className="text-balance font-display text-3xl font-bold leading-tight tracking-[-0.025em] sm:text-5xl">Abre tu caja en Boxy hoy.</h2>
                  <p className="mt-4 max-w-lg text-white/60">Carga tus productos, invita a tus cajeros y empieza a vender el mismo día.</p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  <Button size="lg" radius="full" color="primary" className="landing-boton shrink-0 font-semibold" onPress={() => empezar()} endContent={<ArrowRight className="h-4 w-4" />}>
                    {textoEmpezar}
                  </Button>
                  <Button
                    as="a"
                    href={enlaceVentas}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="lg"
                    radius="full"
                    variant="bordered"
                    className="landing-boton shrink-0 border-white/20 text-white data-[hover=true]:bg-white/5"
                    startContent={<IconoWhatsApp className="h-4 w-4" />}
                  >
                    WhatsApp
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-default-200/70">
        <div className={`${WRAP} grid gap-10 py-12 sm:grid-cols-[1.4fr_1fr_1fr]`}>
          <div>
            <a href="#inicio" className="inline-flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Store className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </span>
              <span className="font-display text-lg font-bold tracking-tight">Boxy</span>
            </a>
            <p className="mt-4 max-w-xs text-small text-default-500">Punto de venta, inventario, caja y fiado para abastos y minimarkets de Venezuela.</p>
          </div>
          <div>
            <p className="text-small font-semibold">Producto</p>
            <ul className="mt-4 space-y-2.5 text-small text-default-500">
              <li><a className="hover:text-foreground" href="#cobrar">Cobrar</a></li>
              <li><a className="hover:text-foreground" href="#negocio">Funciones</a></li>
              <li><a className="hover:text-foreground" href="#precios">Precios</a></li>
              <li><a className="hover:text-foreground" href="#preguntas">Preguntas</a></li>
            </ul>
          </div>
          <div>
            <p className="text-small font-semibold">WhatsApp</p>
            <ul className="mt-4 space-y-2.5 text-small text-default-500">
              {CONTACTOS.map((c) => (
                <li key={c.telefono}>
                  <a className="hover:text-foreground" href={c.enlace} target="_blank" rel="noopener noreferrer">
                    {c.nombre} · <span className="tabular-nums">{c.visible}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className={`${WRAP} flex flex-col gap-2 border-t border-default-200/70 py-6 text-tiny text-default-400 sm:flex-row sm:justify-between`}>
          <p>© {new Date().getFullYear()} Boxy · Punto de venta e inventario para Venezuela</p>
          <p>Los comprobantes de Boxy son documentos no fiscales.</p>
        </div>
      </footer>
    </div>
  )
}

/** Encabezado de sección: etiqueta pequeña + título + texto opcional. */
function Encabezado({ etiqueta, titulo, texto, oscuro = false, centrado = false }: { etiqueta: string; titulo: string; texto?: string; oscuro?: boolean; centrado?: boolean }) {
  return (
    <div className={centrado ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className={`text-small font-semibold uppercase tracking-[0.14em] ${oscuro ? 'text-primary' : 'text-primary-700 dark:text-primary'}`}>{etiqueta}</p>
      <h2 className="mt-3 text-balance font-display text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl">{titulo}</h2>
      {texto && <p className={`mt-5 text-pretty text-lg ${oscuro ? 'text-white/60' : 'text-default-600'}`}>{texto}</p>}
    </div>
  )
}

function Bento({ icon: Icon, t, d, className = '', children }: { icon: typeof Banknote; t: string; d: string; className?: string; children?: ReactNode }) {
  return (
    <div className={`group flex flex-col justify-between rounded-3xl border border-default-200 bg-content1 p-7 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-28px_rgba(15,23,42,0.35)] ${className}`}>
      <div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary-700 dark:text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{t}</h3>
        <p className="mt-1.5 max-w-prose text-default-600">{d}</p>
      </div>
      {children}
    </div>
  )
}

/** La caja de Boxy cobrando una venta mixta (HTML real, no una captura). */
function CajaEjemplo() {
  return (
    <figure className="entrada entrada-tarde relative mx-auto w-full max-w-[34rem]" aria-label="Ejemplo de una venta en la caja de Boxy">
      <div className="absolute -inset-px rounded-[1.6rem] bg-gradient-to-b from-white/25 via-white/5 to-transparent" aria-hidden />
      <div className="relative overflow-hidden rounded-3xl bg-white text-zinc-900 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.8)]">
        {/* Barra de la ventana */}
        <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          </span>
          <span className="flex-1 truncate rounded-md bg-white px-3 py-1 text-center text-tiny text-zinc-400 ring-1 ring-zinc-200">boxy · Caja 1</span>
        </div>
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2 text-small font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            Turno abierto
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-tiny font-semibold tabular-nums text-emerald-700">
            BCV {TASA_EJEMPLO.toFixed(2).replace('.', ',')}
          </span>
        </div>

        <ul className="divide-y divide-zinc-100 px-5">
          {LINEAS.map((l) => (
            <li key={l.nombre} className="flex items-center justify-between gap-3 py-2.5 text-small">
              <span className="min-w-0">
                <span className="tabular-nums text-zinc-400">{l.cant} ×</span> <span className="font-medium">{l.nombre}</span>
                <span className="ml-2 text-tiny text-zinc-400">{l.iva === 0 ? 'Exento' : `IVA ${l.iva * 100} %`}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">{usd(l.cant * l.precio)}</span>
            </li>
          ))}
        </ul>

        <dl className="space-y-1.5 border-t border-zinc-200 bg-zinc-50 px-5 py-4 text-small tabular-nums">
          <Fila t="Base imponible" v={usd(base)} />
          <Fila t="IVA 16 %" v={usd(iva16)} />
          <Fila t="IVA 8 %" v={usd(iva8)} />
          <div className="flex items-baseline justify-between pt-2">
            <dt className="font-display text-base font-bold">Total</dt>
            <dd className="text-right">
              <span className="font-display text-2xl font-bold">{usd(total)}</span>
              <span className="ml-2 text-zinc-400">{fmtBs(total * TASA_EJEMPLO)}</span>
            </dd>
          </div>
        </dl>

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

      {/* Avisos flotantes (solo en pantallas anchas) */}
      <div className="landing-flota absolute -left-14 -top-7 hidden items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/90 px-4 py-3 text-white shadow-2xl backdrop-blur xl:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
          <CloudOff className="h-4 w-4" />
        </span>
        <span className="text-small leading-tight">
          <span className="block font-semibold">Sin internet</span>
          <span className="text-white/55">3 ventas en cola</span>
        </span>
      </div>
      <div className="landing-flota landing-flota-tarde absolute -bottom-8 -right-10 hidden items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/90 px-4 py-3 text-white shadow-2xl backdrop-blur xl:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Wifi className="h-4 w-4" />
        </span>
        <span className="text-small leading-tight">
          <span className="block font-semibold">Conexión de vuelta</span>
          <span className="text-white/55">Ventas enviadas</span>
        </span>
      </div>
    </figure>
  )
}

function Fila({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex justify-between text-zinc-500">
      <dt>{t}</dt>
      <dd>{v}</dd>
    </div>
  )
}

function Pago({ icono, t, v, tenue = false }: { icono: ReactNode; t: string; v: string; tenue?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${tenue ? 'text-zinc-400' : 'bg-zinc-100 font-medium'}`}>
      <span className="flex items-center gap-2">
        <span className="text-zinc-400">{icono}</span>
        {t}
      </span>
      <span>{v}</span>
    </div>
  )
}

/** Cola de ventas sin conexión: lo que el cajero ve cuando se cae el internet. */
function OfflineAviso() {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
        <CloudOff className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold">Se fue el internet. La caja sigue abierta.</p>
        <p className="mt-1 text-small text-white/55">Las ventas se guardan en el equipo y se envían solas al volver la conexión. Nadie se queda sin cobrar.</p>
      </div>
    </div>
  )
}

function Li({ children, oscuro = false }: { children: ReactNode; oscuro?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
      <span className={oscuro ? 'text-white/75' : 'text-default-700'}>{children}</span>
    </li>
  )
}

/** Logo de WhatsApp (glifo oficial simplificado, en el color del texto). */
function IconoWhatsApp({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.22 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z" />
    </svg>
  )
}
