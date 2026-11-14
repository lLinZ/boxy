import '@fontsource-variable/archivo/wdth.css'
import './landing.css'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CloudOff,
  Drill,
  Footprints,
  Pill,
  Plus,
  ShieldCheck,
  Smartphone,
  SprayCan,
  Store,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { n } from '../lib/format'
import { enlaceWhatsApp } from '../lib/whatsapp'
import type { ContactoVentas, Plan } from '../types'

interface ConfigPublica {
  modo: string
  registro_publico: boolean
  ventas?: ContactoVentas
}

/* ── Datos de ejemplo (sintéticos; la tasa es ilustrativa) ──────────────── */
const TASA = 36.5
const r2 = (v: number) => Math.round(v * 100) / 100
const fmtBs = (v: number) => `Bs ${v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsd = (v: number) => `$${v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface Producto {
  rubro: string
  nombre: string
  precio: number
  stock: number
  minimo: number
  icono: LucideIcon
  tono: string
}
const PRODUCTOS: Producto[] = [
  { rubro: 'Ferretería', nombre: 'Taladro percutor 650 W', precio: 48, stock: 6, minimo: 2, icono: Drill, tono: '#f59e0b' },
  { rubro: 'Ropa y calzado', nombre: 'Zapatos deportivos T-40', precio: 32, stock: 14, minimo: 4, icono: Footprints, tono: '#38bdf8' },
  { rubro: 'Electrónica', nombre: 'Cargador USB-C 20 W', precio: 9.5, stock: 2, minimo: 5, icono: Smartphone, tono: '#a3a3a3' },
  { rubro: 'Farmacia', nombre: 'Acetaminofén 500 mg × 10', precio: 1.8, stock: 48, minimo: 12, icono: Pill, tono: '#f472b6' },
  { rubro: 'Abasto', nombre: 'Harina de maíz 1 kg', precio: 1.1, stock: 120, minimo: 40, icono: Wheat, tono: '#eab308' },
  { rubro: 'Cosméticos', nombre: 'Protector solar FPS 50', precio: 12.9, stock: 9, minimo: 3, icono: SprayCan, tono: '#2dd4bf' },
]

// Venta de ejemplo en una ferretería: IVA 16 %, IGTF 3 % solo sobre lo pagado en divisas.
const LINEAS = [
  { nombre: 'Taladro percutor 650 W', precio: 48 },
  { nombre: 'Juego de brocas × 5', precio: 6.5 },
  { nombre: 'Pintura blanca 1 galón', precio: 18 },
]
const PAGO_USD = 50
const BASE = r2(LINEAS.reduce((s, l) => s + l.precio, 0))
const IVA = r2(BASE * 0.16)
const TOTAL = r2(BASE + IVA)
const IGTF = r2(PAGO_USD * 0.03)
const RESTO_BS = r2((TOTAL + IGTF - PAGO_USD) * TASA)

const RUBROS = ['Abastos', 'Ferreterías', 'Ropa y calzado', 'Celulares', 'Farmacias', 'Cosméticos', 'Repuestos', 'Librerías', 'Minimarkets', 'Bodegones']

/* ── Contactos de ventas por WhatsApp ─────────────────────────────────── */
const MENSAJE_WA = 'Hola, quiero información sobre Boxy para mi negocio.'
const CONTACTOS = [
  { nombre: 'Jose Miguel', telefono: '04222402406' },
  { nombre: 'Aristides Sanchez', telefono: '04124818151' },
].map((c) => ({
  ...c,
  visible: c.telefono.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3'),
  enlace: enlaceWhatsApp(c.telefono, MENSAJE_WA) ?? '#contacto',
}))

const PREGUNTAS = [
  { q: '¿Sirve para mi tipo de negocio?', a: 'Si vendes productos con precio y existencia, sí: abastos, ferreterías, tiendas de ropa y calzado, de celulares, farmacias, perfumerías, repuestos y más. Cada producto lleva su código, su IVA y su stock por sucursal.' },
  { q: '¿Boxy emite factura fiscal?', a: 'No. Los tickets y comprobantes de Boxy son documentos no fiscales. Si tu negocio necesita factura fiscal, Boxy se conecta a una impresora fiscal homologada como ampliación opcional.' },
  { q: '¿Qué pasa si se va el internet?', a: 'Sigues vendiendo. Las ventas se guardan en el equipo y se envían solas cuando vuelve la conexión.' },
  { q: '¿De dónde sale la tasa del dólar?', a: 'Boxy actualiza la tasa BCV dos veces al día. También muestra la tasa USDT como referencia, pero los cobros en bolívares se hacen siempre a tasa BCV.' },
  { q: '¿Necesito comprar equipos?', a: 'No. Funciona en el navegador de la computadora, tablet o teléfono que ya tienes, y se instala como app. Sirve cualquier impresora térmica de 58 u 80 mm, y el teléfono puede ser tu escáner de códigos.' },
  { q: '¿Cómo pago la mensualidad?', a: 'Por pago móvil, transferencia, USDT o Zelle. Reportas el pago desde el sistema y tu licencia se extiende al confirmarlo.' },
]

const WA_PATH =
  'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.22 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z'

export function LandingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [planes, setPlanes] = useState<Plan[]>([])
  const [config, setConfig] = useState<ConfigPublica | null>(null)
  const [navSolida, setNavSolida] = useState(false)
  const heroRef = useRef<HTMLElement>(null)

  useEffect(() => {
    api.get<Plan[]>('/planes').then((r) => setPlanes(r.data)).catch(() => {})
    api.get<ConfigPublica>('/config').then((r) => setConfig(r.data)).catch(() => {})
  }, [])

  // La barra se vuelve sólida al salir de la portada.
  useEffect(() => {
    const alScroll = () => setNavSolida(window.scrollY > 40)
    alScroll()
    window.addEventListener('scroll', alScroll, { passive: true })
    return () => window.removeEventListener('scroll', alScroll)
  }, [])

  // Paralaje leve con el puntero: las letras, la gaveta y las etiquetas se mueven distinto.
  useEffect(() => {
    const el = heroRef.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const mover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3))
        el.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3))
      })
    }
    el.addEventListener('pointermove', mover)
    return () => {
      el.removeEventListener('pointermove', mover)
      cancelAnimationFrame(frame)
    }
  }, [])

  const diasPrueba = planes[0]?.dias_trial ?? 14
  const registroAbierto = config?.registro_publico ?? true
  const whatsapp = config?.ventas?.whatsapp
  const enlaceVentas = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(MENSAJE_WA)}` : CONTACTOS[0].enlace

  const empezar = (plan?: string) => {
    if (registroAbierto) navigate(plan ? `/registro?plan=${plan}` : '/registro')
    else window.location.href = enlaceVentas
  }
  const textoEmpezar = registroAbierto ? `Probar ${diasPrueba} días gratis` : 'Solicitar mi cuenta'

  return (
    <div className="lp min-h-screen">
      {/* ── Navegación ─────────────────────────────────────────────────── */}
      <header className="lp-nav" data-solida={navSolida}>
        <nav className="lp-wrap flex h-16 items-center justify-between gap-4" aria-label="Principal">
          <a href="#inicio" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--lp-verde)] text-[#0c1a08]">
              <Store className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="lp-display text-xl">Boxy</span>
          </a>
          <div className="hidden items-center gap-7 text-[0.92rem] font-medium lg:flex">
            <a className="lp-enlace" href="#cobrar">Cobrar</a>
            <a className="lp-enlace" href="#rubros">Rubros</a>
            <a className="lp-enlace" href="#dinero">Dinero</a>
            <a className="lp-enlace" href="#precios">Precios</a>
            <a className="lp-enlace" href="#contacto">Contacto</a>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <button type="button" className="lp-btn lp-btn-verde !min-h-11 !px-4 text-sm" onClick={() => navigate('/dashboard')}>
                Ir al sistema <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button type="button" className="lp-btn !hidden !min-h-11 !px-4 text-sm text-[var(--lp-claro-2)] hover:text-[var(--lp-claro)] sm:!inline-flex" onClick={() => navigate('/login')}>
                  Iniciar sesión
                </button>
                <button type="button" className="lp-btn lp-btn-verde !min-h-11 !px-4 text-sm" onClick={() => empezar()}>
                  {registroAbierto ? 'Prueba gratis' : 'Contactar'}
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main id="inicio">
        {/* ── Portada: la gaveta abierta ───────────────────────────────── */}
        <section ref={heroRef} className="lp-hero" aria-labelledby="titulo-portada">
          <div className="lp-letras" aria-hidden>
            <span className="lp-letra lp-letra-usd">$</span>
            <span className="lp-letra lp-letra-bs">Bs</span>
          </div>

          <div className="lp-wrap lp-hero-grid">
            <div>
              <h1 id="titulo-portada" className="lp-display lp-h1 lp-entra">
                Cobra en $ y Bs. <span className="lp-marca">Cuadra la caja.</span>
              </h1>
              <p className="lp-entra lp-entra-2 mt-6 max-w-[34rem] text-pretty text-lg leading-relaxed text-[var(--lp-claro-2)] sm:text-xl">
                Punto de venta, inventario y control de caja para tu abasto, ferretería, tienda de ropa, de celulares o
                farmacia. IVA, IGTF y vuelto a la tasa BCV del día, aunque se caiga el internet.
              </p>
              <div className="lp-entra lp-entra-3 mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" className="lp-btn lp-btn-verde" onClick={() => empezar()}>
                  {textoEmpezar} <ArrowRight className="h-4 w-4" />
                </button>
                <a className="lp-btn lp-btn-linea text-[var(--lp-claro)]" href="#contacto">
                  <IconoWhatsApp className="h-4 w-4" /> Hablar con ventas
                </a>
              </div>
              <ul className="lp-entra lp-entra-3 mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--lp-claro-2)]">
                {['Tasa BCV dos veces al día', registroAbierto ? 'Sin tarjeta de crédito' : 'Soporte por WhatsApp', 'Funciona sin internet'].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-[var(--lp-verde)]" strokeWidth={2.75} /> {t}
                  </li>
                ))}
              </ul>
            </div>

            <EscenaGaveta />
          </div>
        </section>

        {/* ── Cinta de rubros ───────────────────────────────────────────── */}
        <div className="lp-cinta" aria-label="Rubros que usan Boxy">
          <div className="lp-cinta-pista">
            {[0, 1].map((copia) => (
              <div key={copia} className="flex" aria-hidden={copia === 1}>
                {RUBROS.map((r, i) => (
                  <span key={r} className="lp-cinta-item">
                    {r}
                    <span className="opacity-40">{i % 2 ? 'Bs' : '$'}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Cobrar ────────────────────────────────────────────────────── */}
        <section id="cobrar" className="scroll-mt-16 py-24 lg:py-32">
          <div className="lp-wrap grid gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
            <div>
              <h2 className="lp-h2">Un cliente, dos monedas, una sola pantalla.</h2>
              <p className="mt-6 max-w-xl text-pretty text-lg text-[var(--lp-tinta-2)]">
                El cliente paga $50 en efectivo y el resto por pago móvil. Boxy saca el IGTF solo sobre los dólares,
                convierte el resto a la tasa BCV y te dice el vuelto.
              </p>
              <dl className="mt-10 divide-y divide-[rgba(18,21,19,0.12)] border-y border-[rgba(18,21,19,0.12)]">
                <FilaCobro cifra={`${fmtUsd(PAGO_USD)} + ${fmtBs(RESTO_BS)}`} t="Bolívares y dólares en la misma venta" d="Efectivo, pago móvil, Zelle, USDT, punto de venta o fiado." />
                <FilaCobro cifra={`IGTF ${fmtUsd(IGTF)}`} t="IVA e IGTF sin errores" d="IVA de 16 %, 8 % o exento según el producto. IGTF solo sobre lo que pagan las divisas." />
                <FilaCobro cifra="Vuelto Bs 0,00" t="Vuelto donde lo quieras dar" d="En bolívares, en dólares o por pago móvil." />
              </dl>
            </div>
            <Ticket />
          </div>
        </section>

        {/* ── Rubros e inventario ───────────────────────────────────────── */}
        <section id="rubros" className="scroll-mt-16 bg-[var(--lp-papel-2)] py-24 lg:py-32">
          <div className="lp-wrap">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
              <h2 className="lp-h2">Sirve para lo que vendas.</h2>
              <p className="max-w-xl text-pretty text-lg text-[var(--lp-tinta-2)] lg:justify-self-end">
                Si tiene código, precio y existencia, Boxy lo controla: stock por sucursal, kardex de cada movimiento y
                alertas cuando algo se acaba o se vence.
              </p>
            </div>
            <ul className="lp-estante mt-14">
              {PRODUCTOS.map((p, i) => (
                <TarjetaProducto key={p.nombre} p={p} semilla={i} />
              ))}
            </ul>
            <ul className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-[0.98rem] font-medium">
              {['Carga de productos por Excel', 'El teléfono como escáner', 'Etiquetas con código de barras', 'Compras con costo promedio', 'Varias sucursales'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-[var(--lp-verde-tinta)]" strokeWidth={2.75} /> {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Dinero ────────────────────────────────────────────────────── */}
        <section id="dinero" className="lp-dinero scroll-mt-16 py-24 lg:py-32">
          <div className="lp-wrap">
            <h2 className="lp-h2 max-w-4xl">Sabes cuánto entró, cuánto te deben y cuánto ganas.</h2>
            <div className="mt-14 overflow-hidden pb-2">
              <p className="lp-cifra num" aria-label="Ejemplo: ventas del día 1.284,50 dólares">
                $1.284,50
              </p>
              <p className="mt-4 text-sm text-[var(--lp-claro-2)]">Ventas del día en una tienda de ejemplo, en vivo desde la caja.</p>
            </div>
            <div className="lp-fila-dinero mt-12">
              <ColDinero t="Cierre de caja sin sorpresas" d="Turnos por cajero, cierre con arqueo a ciegas y reporte Z al final del día." />
              <ColDinero t="Lo que te deben, anotado" d="Fiado con límite por cliente, abonos registrados y recordatorio de saldo por WhatsApp." />
              <ColDinero t="Ganancia real por producto" d="Margen con el costo promedio de tus compras y los productos que más rotan." />
            </div>
            <div className="mt-14 grid gap-4 sm:grid-cols-2">
              <Aviso icono={<CloudOff className="h-5 w-5" />} t="Se fue el internet. La caja sigue abierta." d="Las ventas se guardan en el equipo y se envían solas al volver la conexión." />
              <Aviso icono={<ShieldCheck className="h-5 w-5" />} t="Cada quien con su permiso." d="Cajero, gerente y administrador; anulaciones y descuentos con PIN de supervisor." />
            </div>
          </div>
        </section>

        {/* ── Precios ───────────────────────────────────────────────────── */}
        <section id="precios" className="scroll-mt-16 py-24 lg:py-32">
          <div className="lp-wrap">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
              <h2 className="lp-h2">Un precio fijo al mes, en dólares.</h2>
              <p className="max-w-xl text-pretty text-lg text-[var(--lp-tinta-2)] lg:justify-self-end">
                {registroAbierto ? `Los primeros ${diasPrueba} días son gratis en cualquier plan. ` : ''}Pagas por pago móvil,
                transferencia, USDT o Zelle, y cambias de plan cuando crezcas.
              </p>
            </div>
            <div className="mt-14 grid items-stretch gap-5 md:grid-cols-3">
              {planes.length === 0 && [0, 1, 2].map((i) => <div key={i} className="h-[27rem] animate-pulse rounded-2xl bg-[var(--lp-papel-2)]" aria-hidden />)}
              {planes.map((p, i) => {
                const destacado = planes.length >= 3 && i === 1
                return (
                  <article
                    key={p.id}
                    className={`flex flex-col rounded-2xl p-7 transition-transform duration-300 hover:-translate-y-1 ${
                      destacado ? 'bg-[var(--lp-grafito)] text-[var(--lp-claro)] shadow-[0_30px_50px_-28px_rgba(18,21,19,0.8)]' : 'bg-white shadow-[0_14px_30px_-24px_rgba(18,21,19,0.5)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="lp-display text-2xl">{p.nombre}</h3>
                      {destacado && <span className="rounded-full bg-[var(--lp-verde)] px-3 py-1 text-xs font-bold text-[#0c1a08]">El más elegido</span>}
                    </div>
                    {p.descripcion && <p className={`mt-1 text-sm ${destacado ? 'text-[var(--lp-claro-2)]' : 'text-[var(--lp-tinta-2)]'}`}>{p.descripcion}</p>}
                    <p className="mt-7 flex items-baseline gap-1">
                      <span className="lp-display num text-6xl">{fmtUsd(n(p.precio_mensual_usd))}</span>
                      <span className={destacado ? 'text-[var(--lp-claro-2)]' : 'text-[var(--lp-tinta-2)]'}>/mes</span>
                    </p>
                    <ul className={`mt-7 flex flex-1 flex-col gap-2.5 border-t pt-6 text-[0.95rem] ${destacado ? 'border-white/10' : 'border-[rgba(18,21,19,0.1)]'}`}>
                      <Li oscuro={destacado}>{p.max_sucursales === 0 ? 'Sucursales ilimitadas' : p.max_sucursales === 1 ? '1 sucursal' : `${p.max_sucursales} sucursales`}</Li>
                      <Li oscuro={destacado}>{p.max_usuarios === 0 ? 'Usuarios ilimitados' : `Hasta ${p.max_usuarios} usuarios`}</Li>
                      <Li oscuro={destacado}>{p.max_productos === 0 ? 'Productos ilimitados' : `Hasta ${n(p.max_productos).toLocaleString('es-VE')} productos`}</Li>
                      <Li oscuro={destacado}>Caja, inventario, clientes y fiado</Li>
                      {p.features?.escaner_remoto && <Li oscuro={destacado}>Escáner con el teléfono</Li>}
                      {p.features?.monitor && <Li oscuro={destacado}>Monitor de ventas en vivo</Li>}
                      {p.features?.analisis && <Li oscuro={destacado}>Análisis de rentabilidad</Li>}
                    </ul>
                    <button
                      type="button"
                      className={`lp-btn mt-8 w-full ${destacado ? 'lp-btn-verde' : 'lp-btn-tinta'}`}
                      onClick={() => empezar(p.codigo)}
                    >
                      {registroAbierto ? `Empezar con ${p.nombre}` : `Quiero el plan ${p.nombre}`}
                    </button>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Contacto ──────────────────────────────────────────────────── */}
        <section id="contacto" className="scroll-mt-16 bg-[var(--lp-papel-2)] py-24 lg:py-32">
          <div className="lp-wrap grid gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
            <div>
              <h2 className="lp-h2">Escríbenos. Te responde una persona.</h2>
              <p className="mt-6 max-w-lg text-pretty text-lg text-[var(--lp-tinta-2)]">
                Por WhatsApp te mostramos Boxy funcionando con productos de tu rubro, te ayudamos a cargar tu inventario y
                resolvemos tus dudas sobre los planes.
              </p>
            </div>
            <div className="lp-contacto">
              {CONTACTOS.map((c) => (
                <a
                  key={c.telefono}
                  href={c.enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-tarjeta-wa group"
                  aria-label={`Escribir a ${c.nombre} por WhatsApp al ${c.visible}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-semibold">{c.nombre}</p>
                    <ArrowUpRight className="h-5 w-5 text-[var(--lp-tinta-2)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                  <p className="lp-tel num">{c.visible}</p>
                  <span className="lp-btn lp-btn-wa w-full">
                    <IconoWhatsApp className="h-5 w-5" /> Escribir por WhatsApp
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── Preguntas ─────────────────────────────────────────────────── */}
        <section id="preguntas" className="scroll-mt-16 py-24 lg:py-32">
          <div className="lp-wrap grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <h2 className="lp-h2">Preguntas frecuentes</h2>
              <p className="mt-5 text-[var(--lp-tinta-2)]">
                ¿Otra duda?{' '}
                <a className="font-semibold text-[var(--lp-verde-tinta)] underline decoration-2 underline-offset-4" href="#contacto">
                  Escríbenos por WhatsApp
                </a>
                .
              </p>
            </div>
            <div className="border-t border-[rgba(18,21,19,0.12)]">
              {PREGUNTAS.map((p) => (
                <details key={p.q} className="lp-pregunta">
                  <summary>
                    {p.q}
                    <Plus className="h-5 w-5" />
                  </summary>
                  <p className="max-w-prose pb-6 text-[var(--lp-tinta-2)]">{p.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Cierre ────────────────────────────────────────────────────── */}
        <section className="lp-hero !min-h-0" aria-labelledby="titulo-cierre">
          <div className="lp-letras" aria-hidden>
            <span className="lp-letra lp-letra-bs !-bottom-[30%]">Bs</span>
          </div>
          <div className="lp-wrap flex flex-col items-start gap-10 py-24 lg:flex-row lg:items-end lg:justify-between lg:py-32">
            <h2 id="titulo-cierre" className="lp-display max-w-3xl text-[clamp(2.6rem,1.4rem+4.6vw,5.4rem)]">
              Abre tu caja en Boxy <span className="text-[var(--lp-verde)]">hoy.</span>
            </h2>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <button type="button" className="lp-btn lp-btn-verde" onClick={() => empezar()}>
                {textoEmpezar} <ArrowRight className="h-4 w-4" />
              </button>
              <a className="lp-btn lp-btn-linea text-[var(--lp-claro)]" href={enlaceVentas} target="_blank" rel="noopener noreferrer">
                <IconoWhatsApp className="h-4 w-4" /> WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[var(--lp-grafito)] text-[var(--lp-claro-2)]">
        <div className="lp-wrap grid gap-10 border-t border-white/10 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="lp-display text-2xl text-[var(--lp-claro)]">Boxy</p>
            <p className="mt-3 max-w-xs text-sm">Punto de venta, inventario y control de caja para cualquier negocio en Venezuela.</p>
          </div>
          <ul className="space-y-1 text-sm">
            {[
              ['#cobrar', 'Cobrar'],
              ['#rubros', 'Rubros'],
              ['#dinero', 'Dinero'],
              ['#precios', 'Precios'],
              ['#preguntas', 'Preguntas'],
            ].map(([h, t]) => (
              <li key={h}>
                <a className="inline-flex min-h-9 items-center hover:text-[var(--lp-claro)]" href={h}>
                  {t}
                </a>
              </li>
            ))}
          </ul>
          <ul className="space-y-1 text-sm">
            {CONTACTOS.map((c) => (
              <li key={c.telefono}>
                <a className="inline-flex min-h-9 items-center gap-2 hover:text-[var(--lp-claro)]" href={c.enlace} target="_blank" rel="noopener noreferrer">
                  <IconoWhatsApp className="h-4 w-4" /> {c.nombre} · <span className="num">{c.visible}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="lp-wrap flex flex-col gap-2 border-t border-white/10 py-6 text-xs sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Boxy. Los precios, montos y la tasa de esta página son ejemplos.</p>
          <p>Los comprobantes de Boxy son documentos no fiscales.</p>
        </div>
      </footer>
    </div>
  )
}

/* ══ Escena de la portada ═══════════════════════════════════════════════ */

// Posición de cada etiqueta alrededor de la gaveta (en % de la escena).
const POS_TAGS: { top: string; left?: string; right?: string; r: number; d: number; t: number; p: number; movil: boolean }[] = [
  { top: '-2%', left: '0%', r: -6, d: 1.0, t: 4.2, p: 14, movil: true },
  { top: '-6%', right: '0%', r: 5, d: 1.15, t: 3.6, p: -10, movil: true },
  { top: '36%', right: '-3%', r: -4, d: 1.3, t: 4.6, p: 18, movil: false },
  { top: '58%', left: '-4%', r: 4, d: 1.45, t: 3.9, p: -16, movil: false },
  { top: '86%', left: '24%', r: -3, d: 1.6, t: 4.4, p: 12, movil: true },
  { top: '78%', right: '-2%', r: 6, d: 1.75, t: 3.7, p: -14, movil: false },
]

function EscenaGaveta() {
  return (
    <div className="lp-escena" role="img" aria-label="Gaveta de caja abierta con billetes en dólares y bolívares, monedas y etiquetas de productos de distintas tiendas">
      <div className="lp-gaveta-vista">
        <div className="lp-gaveta">
          <div className="lp-bandeja">
            <div className="lp-bandeja-piso">
              <Celda><Fajo moneda="usd" valor="100" /></Celda>
              <Celda><Fajo moneda="usd" valor="20" /></Celda>
              <Celda><Fajo moneda="usd" valor="5" /></Celda>
              <Celda><Fajo moneda="bs" valor="500" /></Celda>
              <Celda><Fajo moneda="bs" valor="100" /></Celda>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="lp-celda lp-celda-monedas">
                  <span className={`lp-moneda ${i % 2 ? 'lp-moneda-plata' : ''}`} style={{ transform: 'translate(-18%, -8%)' }} />
                  <span className={`lp-moneda ${i % 2 ? '' : 'lp-moneda-plata'}`} style={{ transform: 'translate(22%, 14%)' }}>
                    {i < 2 ? '1' : i < 4 ? 'Bs' : '50'}
                  </span>
                </div>
              ))}
            </div>
            <div className="lp-frente">
              <span className="lp-frente-tirador" />
            </div>
          </div>
        </div>
      </div>

      <div className="lp-flotantes">
        {PRODUCTOS.map((p, i) => {
          const pos = POS_TAGS[i]
          return (
            <div
              key={p.nombre}
              className={`lp-tag-pos ${pos.movil ? '' : 'hidden sm:block'}`}
              style={{ top: pos.top, left: pos.left, right: pos.right, '--r': `${pos.r}deg`, '--d': `${pos.d}s` } as CSSProperties}
            >
              <div className="lp-tag-mueve" style={{ '--p': `${pos.p}px` } as CSSProperties}>
                <div className="lp-tag" style={{ '--t': `${pos.t}s`, '--fd': `${-i * 0.7}s` } as CSSProperties}>
                  <Hablador p={p} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Celda({ children }: { children: ReactNode }) {
  return <div className="lp-celda">{children}</div>
}

function Fajo({ moneda, valor }: { moneda: 'usd' | 'bs'; valor: string }) {
  return (
    <div className="lp-fajo">
      {[2, 1, 0].map((k) => (
        <Billete key={k} moneda={moneda} valor={valor} style={{ transform: `translate(${k * 3}%, ${-k * 2.2}%) rotate(${k ? (k % 2 ? -2 : 1.5) : 0}deg)` }} />
      ))}
    </div>
  )
}

/* Guilloché: rosetas y ondas calculadas (geometría, no ilustración). */
function roseta(cx: number, cy: number, R: number, A: number, k: number, fase: number) {
  const pts: string[] = []
  for (let i = 0; i <= 360; i++) {
    const t = (i / 360) * Math.PI * 2
    const r = R + A * Math.sin(k * t + fase)
    pts.push(`${(cx + r * Math.cos(t)).toFixed(2)},${(cy + r * Math.sin(t)).toFixed(2)}`)
  }
  return pts.join(' ')
}
function onda(x0: number, x1: number, y: number, A: number, periodo: number, fase: number) {
  const pts: string[] = []
  for (let x = x0; x <= x1; x += 1.5) pts.push(`${x.toFixed(1)},${(y + A * Math.sin((x / periodo) * Math.PI * 2 + fase)).toFixed(2)}`)
  return pts.join(' ')
}
const ROSETAS = [0, 1, 2, 3, 4, 5].map((j) => roseta(60, 125, 22 + j * 3.2, 3 + (j % 3), 12 + j * 2, j * 0.6))
const ONDAS = [0, 1, 2, 3, 4, 5, 6, 7].map((j) => onda(10, 110, 30 + j * 3, 2.2, 22, j * 0.8))
const ONDAS_B = [0, 1, 2, 3, 4, 5, 6, 7].map((j) => onda(10, 110, 196 + j * 3, 2.2, 22, -j * 0.8))

function Billete({ moneda, valor, style }: { moneda: 'usd' | 'bs'; valor: string; style?: CSSProperties }) {
  const fondo = moneda === 'usd' ? 'var(--lp-usd)' : 'var(--lp-bs)'
  const tinta = moneda === 'usd' ? 'var(--lp-usd-tinta)' : 'var(--lp-bs-tinta)'
  const simbolo = moneda === 'usd' ? '$' : 'Bs'
  return (
    <svg viewBox="0 0 120 250" preserveAspectRatio="none" style={style} aria-hidden>
      <rect width="120" height="250" rx="5" fill={fondo} />
      <rect x="5" y="5" width="110" height="240" rx="3" fill="none" stroke={tinta} strokeOpacity="0.55" strokeWidth="1.2" />
      <rect x="8.5" y="8.5" width="103" height="233" rx="2" fill="none" stroke={tinta} strokeOpacity="0.3" strokeWidth="0.5" strokeDasharray="1 1.4" />
      <g fill="none" stroke={tinta} strokeWidth="0.45" strokeOpacity="0.45">
        {ONDAS.map((d, i) => <polyline key={`a${i}`} points={d} />)}
        {ONDAS_B.map((d, i) => <polyline key={`b${i}`} points={d} />)}
      </g>
      <g fill="none" stroke={tinta} strokeWidth="0.5" strokeOpacity="0.6">
        {ROSETAS.map((d, i) => <polygon key={i} points={d} />)}
      </g>
      <circle cx="60" cy="125" r="17" fill={fondo} stroke={tinta} strokeOpacity="0.7" strokeWidth="0.8" />
      <text x="60" y="125" textAnchor="middle" dominantBaseline="central" fill={tinta} fontFamily="Archivo Variable, sans-serif" fontWeight="900" fontSize={moneda === 'usd' ? 20 : 15} style={{ fontStretch: '125%' }}>
        {simbolo}
      </text>
      <text x="16" y="24" fill={tinta} fontFamily="Archivo Variable, sans-serif" fontWeight="900" fontSize="21" style={{ fontStretch: '125%' }}>
        {valor}
      </text>
      <text x="104" y="238" textAnchor="end" fill={tinta} fontFamily="Archivo Variable, sans-serif" fontWeight="900" fontSize="21" style={{ fontStretch: '125%' }}>
        {valor}
      </text>
      <text x="108" y="125" textAnchor="middle" fill={tinta} fillOpacity="0.7" fontFamily="ui-monospace, monospace" fontSize="6" transform="rotate(90 108 125)" letterSpacing="1">
        BX {moneda === 'usd' ? '0482' : '1907'} {valor.padStart(4, '0')}
      </text>
    </svg>
  )
}

function Hablador({ p }: { p: Producto }) {
  const Icono = p.icono
  return (
    <span className="lp-hablador">
      <span className="lp-hablador-rubro">
        <Icono className="h-3.5 w-3.5" style={{ color: p.tono }} strokeWidth={2.5} /> {p.rubro}
      </span>
      <span className="mt-1 block text-[0.88rem] font-semibold leading-snug">{p.nombre}</span>
      <span className="mt-2 flex items-end justify-between gap-4">
        <span className="lp-hablador-precio num">{fmtUsd(p.precio)}</span>
        <span className="num text-xs font-medium text-[var(--lp-tinta-2)]">{fmtBs(p.precio * TASA)}</span>
      </span>
    </span>
  )
}

/* ══ Piezas de las secciones ════════════════════════════════════════════ */

function FilaCobro({ cifra, t, d }: { cifra: string; t: string; d: string }) {
  return (
    <div className="grid gap-1.5 py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-6">
      <dt className="text-lg font-semibold">{t}</dt>
      <dd className="lp-display num text-xl text-[var(--lp-verde-tinta)] sm:row-span-2 sm:text-right">{cifra}</dd>
      <dd className="text-[var(--lp-tinta-2)]">{d}</dd>
    </div>
  )
}

/** Ticket térmico de la venta de ejemplo; se "imprime" una vez al entrar en vista. */
function Ticket() {
  const ref = useRef<HTMLDivElement>(null)
  const [visto, setVisto] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) {
      setVisto(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisto(true)
          io.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const fila = (a: string, b: string, fuerte = false) => (
    <div className={`flex justify-between gap-4 ${fuerte ? 'text-base font-bold' : ''}`}>
      <span>{a}</span>
      <span className="num">{b}</span>
    </div>
  )
  return (
    <div ref={ref} className="mx-auto w-full max-w-[24rem] -rotate-1">
      <div className="lp-ticket" data-visto={visto} aria-label="Ticket de ejemplo de una venta en una ferretería">
        <p className="text-center font-bold">FERRETERÍA EL TORNILLO</p>
        <p className="text-center text-xs">Documento no fiscal · Ejemplo</p>
        <p className="text-center text-xs">Tasa BCV de ejemplo {TASA.toFixed(2).replace('.', ',')}</p>
        <hr />
        {LINEAS.map((l) => fila(`1 × ${l.nombre}`, fmtUsd(l.precio)))}
        <hr />
        {fila('Base imponible', fmtUsd(BASE))}
        {fila('IVA 16 %', fmtUsd(IVA))}
        {fila('TOTAL', fmtUsd(TOTAL), true)}
        {fila('', fmtBs(TOTAL * TASA))}
        <hr />
        {fila('Efectivo USD', fmtUsd(PAGO_USD))}
        {fila('IGTF 3 % sobre divisas', fmtUsd(IGTF))}
        {fila('Pago móvil', fmtBs(RESTO_BS))}
        {fila('Vuelto', 'Bs 0,00', true)}
        <hr />
        <p className="text-center font-bold">¡Gracias por su compra!</p>
      </div>
    </div>
  )
}

function TarjetaProducto({ p, semilla }: { p: Producto; semilla: number }) {
  const Icono = p.icono
  const bajo = p.stock <= p.minimo
  // Código de barras decorativo, determinista por producto.
  const barras = Array.from({ length: 34 }, (_, i) => ((i * 7 + semilla * 13) % 5) + 1)
  return (
    <li className="lp-producto">
      <div className="flex items-start justify-between gap-3">
        <span className="lp-producto-icono" style={{ background: `${p.tono}22`, color: p.tono }}>
          <Icono className="h-6 w-6" strokeWidth={2} />
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${bajo ? 'bg-[#fde3d3] text-[#8a3b0c]' : 'bg-[#e3f5dc] text-[var(--lp-verde-tinta)]'}`}
        >
          {bajo ? `Quedan ${p.stock} · bajo mínimo` : `${p.stock} en existencia`}
        </span>
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.06em] text-[var(--lp-tinta-2)]">{p.rubro}</p>
      <p className="mt-1 text-lg font-semibold leading-snug">{p.nombre}</p>
      <div className="mt-auto flex items-end justify-between gap-4 pt-6">
        <div>
          <p className="lp-display num text-3xl">{fmtUsd(p.precio)}</p>
          <p className="num mt-1 text-sm text-[var(--lp-tinta-2)]">{fmtBs(p.precio * TASA)}</p>
        </div>
        <div className="lp-codigo" aria-hidden>
          {barras.map((w, i) => (
            <span key={i} style={{ width: `${w > 3 ? 2 : 1}px`, opacity: w === 5 ? 0 : 1 }} />
          ))}
        </div>
      </div>
    </li>
  )
}

function ColDinero({ t, d }: { t: string; d: string }) {
  return (
    <div>
      <h3 className="lp-display text-2xl" style={{ fontStretch: '112%' }}>
        {t}
      </h3>
      <p className="mt-3 max-w-sm text-[var(--lp-claro-2)]">{d}</p>
    </div>
  )
}

function Aviso({ icono, t, d }: { icono: ReactNode; t: string; d: string }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl bg-[var(--lp-grafito-2)] p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--lp-grafito-3)] text-[var(--lp-verde)]">{icono}</span>
      <div>
        <p className="font-semibold">{t}</p>
        <p className="mt-1 text-sm text-[var(--lp-claro-2)]">{d}</p>
      </div>
    </div>
  )
}

function Li({ children, oscuro = false }: { children: ReactNode; oscuro?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${oscuro ? 'text-[var(--lp-verde)]' : 'text-[var(--lp-verde-tinta)]'}`} strokeWidth={2.75} />
      <span>{children}</span>
    </li>
  )
}

function IconoWhatsApp({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d={WA_PATH} />
    </svg>
  )
}
