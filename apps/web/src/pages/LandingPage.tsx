import '@fontsource-variable/archivo/wdth.css'
import './landing.css'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Barcode,
  Building2,
  Check,
  CloudUpload,
  Drill,
  FileSpreadsheet,
  Footprints,
  HandCoins,
  History,
  LineChart,
  Pill,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  SprayCan,
  Truck,
  Wallet,
  Wheat,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../lib/api'
import { BoxyLogo } from '../components/BoxyLogo'
import { BotonInstalar } from '../components/BotonInstalar'
import { useAuth } from '../auth/AuthContext'
import { n } from '../lib/format'
import { enlaceWhatsApp } from '../lib/whatsapp'
import type { ContactoVentas, Plan } from '../types'
// Billetes reales: dólares (dominio público) y bolívares (CC0), de Wikimedia Commons.
import usd100 from '../assets/billetes/usd100.webp'
import usd20 from '../assets/billetes/usd20.webp'
import usd5 from '../assets/billetes/usd5.webp'
import bs100 from '../assets/billetes/bs100.webp'
import bs50 from '../assets/billetes/bs50.webp'
// Capturas reales de Boxy con los datos de la tienda de demostración.
import imgPos from '../assets/sistema/pos.webp'
import imgInventario from '../assets/sistema/inventario.webp'
import imgTasas from '../assets/sistema/tasas.webp'

interface ConfigPublica {
  modo: string
  registro_publico: boolean
  ventas?: ContactoVentas
  /** Medios configurados para pagar la licencia (pago_movil, transferencia, usdt, binance, zelle). */
  medios_cobro?: string[]
}

const NOMBRE_MEDIO: Record<string, string> = {
  pago_movil: 'pago móvil',
  transferencia: 'transferencia',
  usdt: 'USDT',
  binance: 'Binance Pay',
  zelle: 'Zelle',
}

/** "pago móvil, transferencia o Zelle" con los medios que de verdad están configurados. */
function listaMedios(medios: string[] | undefined): string {
  const nombres = (medios ?? []).map((m) => NOMBRE_MEDIO[m]).filter(Boolean)
  if (nombres.length === 0) return 'pago móvil'
  return nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} o ${nombres[nombres.length - 1]}`
}

/* ── Datos de ejemplo. La tasa es la BCV registrada en Boxy el 13/11/2026. ── */
const TASA = 911.62
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

const RUBROS = ['Abastos', 'Ferreterías', 'Ropa y calzado', 'Celulares', 'Farmacias', 'Cosméticos', 'Repuestos', 'Librerías', 'Minimarkets', 'Bodegones']

const DEL_EXCEL: { icono: LucideIcon; t: string; d: string }[] = [
  { icono: FileSpreadsheet, t: 'Sube tu Excel tal como está', d: 'Tus productos, precios y existencias entran a Boxy en un solo paso.' },
  { icono: Smartphone, t: 'Tu teléfono es el escáner', d: 'Escaneas un QR en la caja y el celular lee los códigos de barra.' },
  { icono: Barcode, t: 'Etiquetas con código de barras', d: 'Imprime las etiquetas de tus productos desde el inventario.' },
  { icono: Truck, t: 'Compras que actualizan tu costo', d: 'Registras lo que le compras al proveedor y Boxy suma el stock y ajusta el costo.' },
  { icono: History, t: 'Historial de cada movimiento', d: 'Sabes cuándo entró, salió o se ajustó cada producto, y quién lo hizo.' },
  { icono: Building2, t: 'Varias sucursales', d: 'El inventario de cada tienda por separado y todo visible en un solo lugar.' },
]

const EL_DINERO: { icono: LucideIcon; t: string; d: string }[] = [
  { icono: Wallet, t: 'Cierre de caja sin sorpresas', d: 'Cada cajero abre y cierra su turno. Al final del día cuadras con el reporte de caja.' },
  { icono: HandCoins, t: 'Lo que te deben, anotado', d: 'Fiado con límite por cliente, abonos registrados y recordatorio de saldo por WhatsApp.' },
  { icono: LineChart, t: 'Cuánto ganas de verdad', d: 'El margen de cada producto con lo que te costó, y cuáles se venden más.' },
  { icono: ShieldCheck, t: 'Cada quien con su permiso', d: 'Cajero, gerente y dueño. Anular o dar descuento pide la clave del encargado.' },
]

/* ── Contactos de ventas por WhatsApp ─────────────────────────────────── */
const MENSAJE_WA = 'Hola, quiero información sobre Boxy para mi negocio.'
const CONTACTOS = [
  { nombre: 'Jose Linares', telefono: '04222402406' },
  { nombre: 'Aristides Sanchez', telefono: '04124818151' },
].map((c) => ({
  ...c,
  visible: c.telefono.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3'),
  iniciales: c.nombre
    .split(' ')
    .map((p) => p[0])
    .join(''),
  enlace: enlaceWhatsApp(c.telefono, MENSAJE_WA) ?? '#contacto',
}))

const PREGUNTAS = [
  { q: '¿Sirve para mi tipo de negocio?', a: 'Si vendes productos con precio y existencia, sí: abastos, ferreterías, tiendas de ropa y calzado, de celulares, farmacias, perfumerías, repuestos y más.' },
  { q: 'Tengo todo en Excel, ¿lo pierdo?', a: 'No. Subes tu archivo de Excel y tus productos, precios y existencias pasan a Boxy. Si necesitas ayuda, te acompañamos por WhatsApp.' },
  { q: '¿Boxy emite factura fiscal?', a: 'No. Los tickets y comprobantes de Boxy son documentos no fiscales. Si tu negocio necesita factura fiscal, Boxy se conecta a una impresora fiscal homologada como ampliación opcional.' },
  { q: '¿Qué pasa si se va el internet?', a: 'Sigues vendiendo. Las ventas se guardan en el equipo y se envían solas cuando vuelve la conexión. También puedes consultar tu inventario, clientes y ventas con los últimos datos que se cargaron.' },
  { q: '¿Necesito comprar equipos?', a: 'No. Funciona en el navegador de la computadora, tablet o teléfono que ya tienes, y se instala como app desde el botón "Instalar app". Sirve cualquier impresora térmica de 58 u 80 mm.' },
  { q: '¿Cómo pago la mensualidad?', a: 'Por MEDIOS. Reportas el pago desde el sistema y tu licencia se extiende al confirmarlo.' },
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
        <nav className="lp-wrap flex h-16 items-center justify-between gap-3" aria-label="Principal">
          <a href="#inicio" className="flex items-center gap-2.5">
            <BoxyLogo className="lp-logo h-9 w-9 sm:h-10 sm:w-10" />
            <span className="lp-display text-xl">Boxy</span>
          </a>
          <div className="hidden items-center gap-7 text-[0.92rem] font-medium lg:flex">
            <a className="lp-enlace" href="#sistema">El sistema</a>
            <a className="lp-enlace" href="#excel">Inventario</a>
            <a className="lp-enlace" href="#sin-internet">Sin internet</a>
            <a className="lp-enlace" href="#precios">Precios</a>
            <a className="lp-enlace" href="#contacto">Asesoría</a>
          </div>
          <div className="flex items-center gap-2">
            <BotonInstalar className="hidden sm:flex" />
            {user ? (
              <button type="button" className="lp-btn lp-btn-verde !min-h-11 !px-4 text-sm" onClick={() => navigate('/dashboard')}>
                Ir al sistema <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                {/* En el teléfono va como píldora con borde para que se vea junto a "Prueba gratis" */}
                <button type="button" className="lp-btn lp-btn-ingresar !min-h-11 text-sm" onClick={() => navigate('/login')}>
                  <span className="sm:hidden">Entrar</span>
                  <span className="hidden sm:inline">Iniciar sesión</span>
                </button>
                <button type="button" className="lp-btn lp-btn-verde !min-h-11 !px-3.5 text-sm sm:!px-4" onClick={() => empezar()}>
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
                Cobra en divisas y bolívares <span className="lp-marca">sin enredos al cuadrar.</span>
              </h1>
              <p className="lp-entra lp-entra-2 mt-6 max-w-[34rem] text-pretty text-lg leading-relaxed text-[var(--lp-claro-2)] sm:text-xl">
                Todo en una sola plataforma: punto de venta, inventario y control de impuestos (IVA, IGTF, BCV). Se instala
                como app y sigue vendiendo aunque se caiga el internet.
              </p>
              <div className="lp-entra lp-entra-3 mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" className="lp-btn lp-btn-verde" onClick={() => empezar()}>
                  {textoEmpezar} <ArrowRight className="h-4 w-4" />
                </button>
                <a className="lp-btn lp-btn-linea text-[var(--lp-claro)]" href="#contacto">
                  <IconoWhatsApp className="h-4 w-4" /> Pedir asesoría
                </a>
              </div>
              <ul className="lp-entra lp-entra-3 mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--lp-claro-2)]">
                {['Tasa BCV automática', registroAbierto ? 'Sin tarjeta de crédito' : 'Asesoría por WhatsApp', 'Funciona sin internet'].map((t) => (
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

        {/* ── El sistema: la caja real ──────────────────────────────────── */}
        <section id="sistema" className="scroll-mt-16 py-24 lg:py-32">
          <div className="lp-wrap">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
              <h2 className="lp-h2">Tocas el producto. Boxy hace las cuentas.</h2>
              <p className="max-w-xl text-pretty text-lg text-[var(--lp-tinta-2)] lg:justify-self-end">
                Esta es la caja de Boxy. Buscas o escaneas, y el total sale en dólares y en bolívares con el IVA ya sumado.
                Cobras con el método que traiga tu cliente.
              </p>
            </div>
            <Pantalla
              src={imgPos}
              alt="Caja de Boxy con una venta de harina, Coca-Cola, café y arroz, y el total en dólares y en bolívares a tasa BCV"
              className="mt-14"
            />
            <ol className="lp-pasos mt-10">
              {[
                ['Busca o escanea', 'Por nombre, por código o con el lector.'],
                ['Ve el total en $ y Bs', 'A la tasa BCV del día, con el IVA incluido.'],
                ['Cobra como quieras', 'Efectivo, pago móvil, Zelle, USDT o fiado.'],
              ].map(([t, d], i) => (
                <li key={t}>
                  <span className="lp-paso-num">{i + 1}</span>
                  <p className="mt-4 text-lg font-semibold">{t}</p>
                  <p className="mt-1 text-[var(--lp-tinta-2)]">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Del Excel a Boxy ──────────────────────────────────────────── */}
        <section id="excel" className="scroll-mt-16 bg-[var(--lp-papel-2)] py-24 lg:py-32">
          <div className="lp-wrap">
            <h2 className="lp-h2 max-w-4xl">¿Todavía llevas tu negocio en Excel?</h2>
            <p className="mt-6 max-w-2xl text-pretty text-lg text-[var(--lp-tinta-2)]">
              Fórmulas que se rompen, la tasa escrita a mano, el stock que nunca cuadra. Sube ese mismo archivo y en
              minutos tienes tu inventario ordenado.
            </p>

            <div className="lp-excel mt-14">
              <HojaExcel />
              <div className="lp-excel-flecha" aria-hidden>
                <ArrowRight className="h-7 w-7" />
              </div>
              <Pantalla src={imgInventario} alt="Inventario de Boxy con productos, costo, precio, margen y existencias" />
            </div>

            <ul className="lp-ventajas mt-16">
              {DEL_EXCEL.map((v) => (
                <Ventaja key={v.t} {...v} />
              ))}
            </ul>
          </div>
        </section>

        {/* ── Rubros ────────────────────────────────────────────────────── */}
        <section id="rubros" className="scroll-mt-16 py-24 lg:py-32">
          <div className="lp-wrap">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
              <h2 className="lp-h2">Sirve para lo que vendas.</h2>
              <p className="max-w-xl text-pretty text-lg text-[var(--lp-tinta-2)] lg:justify-self-end">
                Cada producto con su precio en dólares, su equivalente en bolívares y su existencia. Boxy te avisa cuando
                algo se está acabando.
              </p>
            </div>
            <ul className="lp-estante mt-14">
              {PRODUCTOS.map((p, i) => (
                <TarjetaProducto key={p.nombre} p={p} semilla={i} />
              ))}
            </ul>
          </div>
        </section>

        {/* ── Sin internet ──────────────────────────────────────────────── */}
        <section id="sin-internet" className="lp-oscura scroll-mt-16 py-24 lg:py-32">
          <div className="lp-wrap grid items-center gap-16 lg:grid-cols-2">
            <div className="lp-offline" aria-hidden>
              <span className="lp-offline-onda lp-offline-onda-1" />
              <span className="lp-offline-onda lp-offline-onda-2" />
              <span className="lp-offline-icono">
                <WifiOff strokeWidth={1.75} />
              </span>
              <span className="lp-offline-cola lp-offline-cola-1">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" /> 3 ventas guardadas en el equipo
              </span>
              <span className="lp-offline-cola lp-offline-cola-2">
                <CloudUpload className="h-4 w-4 shrink-0 text-[var(--lp-verde)]" /> Enviadas al volver la conexión
              </span>
            </div>
            <div>
              <h2 className="lp-h2">¿Se fue el internet? Tú sigues vendiendo.</h2>
              <p className="mt-6 max-w-xl text-pretty text-lg text-[var(--lp-claro-2)]">
                Boxy guarda cada venta en tu equipo mientras no hay conexión. Cuando el internet vuelve, las envía solas.
                Nadie se queda sin cobrar y no tienes que anotar nada en un papel.
              </p>
              <ol className="mt-10 space-y-5">
                {[
                  ['Se cae la conexión', 'La caja sigue abierta y cobrando con normalidad.'],
                  ['Las ventas quedan guardadas', 'En la computadora, tablet o teléfono donde vendes.'],
                  ['Vuelve el internet', 'Todo se sincroniza solo, sin repetir nada.'],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="lp-paso-num lp-paso-num-oscuro">{i + 1}</span>
                    <div>
                      <p className="text-lg font-semibold">{t}</p>
                      <p className="mt-0.5 text-[var(--lp-claro-2)]">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ── Tasas automáticas ─────────────────────────────────────────── */}
        <section id="tasas" className="scroll-mt-16 py-24 lg:py-32">
          <div className="lp-wrap grid items-center gap-14 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div>
              <span className="lp-tasa-chip">
                <RefreshCw className="h-4 w-4" /> 9:00 a. m. · 1:00 p. m.
              </span>
              <h2 className="lp-h2 mt-6">La tasa del dólar se actualiza sola.</h2>
              <p className="mt-6 max-w-xl text-pretty text-lg text-[var(--lp-tinta-2)]">
                Boxy trae la tasa oficial del BCV dos veces al día. Tus precios están en dólares y el monto en bolívares se
                calcula solo. Se acabó cambiar la tasa a mano en cada celda.
              </p>
              <ul className="mt-8 space-y-3 text-[1.02rem]">
                {['Cobros en bolívares siempre a tasa BCV', 'Tasa USDT como referencia', 'La misma tasa en todas tus cajas y sucursales'].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--lp-verde-tinta)]" strokeWidth={2.75} /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <Pantalla src={imgTasas} alt="Pantalla de tasas de Boxy con BCV Bs 911,62, USDT Bs 1.065,16 y el botón de sincronizar" />
          </div>
        </section>

        {/* ── Dinero ────────────────────────────────────────────────────── */}
        <section id="dinero" className="scroll-mt-16 bg-[var(--lp-papel-2)] py-24 lg:py-32">
          <div className="lp-wrap">
            <h2 className="lp-h2 max-w-4xl">Sabes cuánto entró, cuánto te deben y cuánto ganas.</h2>
            <ul className="lp-ventajas lp-ventajas-4 mt-14">
              {EL_DINERO.map((v) => (
                <Ventaja key={v.t} {...v} />
              ))}
            </ul>
          </div>
        </section>

        {/* ── Precios ───────────────────────────────────────────────────── */}
        <section id="precios" className="scroll-mt-16 py-24 lg:py-32">
          <div className="lp-wrap">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
              <h2 className="lp-h2">Un precio fijo al mes, en dólares.</h2>
              <p className="max-w-xl text-pretty text-lg text-[var(--lp-tinta-2)] lg:justify-self-end">
                {registroAbierto ? `Los primeros ${diasPrueba} días son gratis en cualquier plan. ` : ''}Pagas por{' '}
                {listaMedios(config?.medios_cobro)}, y cambias de plan cuando crezcas.
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
                    <button type="button" className={`lp-btn mt-8 w-full ${destacado ? 'lp-btn-verde' : 'lp-btn-tinta'}`} onClick={() => empezar(p.codigo)}>
                      {registroAbierto ? `Empezar con ${p.nombre}` : `Quiero el plan ${p.nombre}`}
                    </button>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Asesoría por WhatsApp ─────────────────────────────────────── */}
        <section id="contacto" className="lp-asesoria scroll-mt-16 py-24 lg:py-32">
          <div className="lp-wrap grid gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
            <div>
              <h2 className="lp-h2">¿No sabes por dónde empezar?</h2>
              <ul className="lp-dudas mt-8">
                {['¿Necesitas ayuda directa?', '¿Quieres una asesoría?', '¿Pasar tu Excel a Boxy?', '¿Quieres saber más?'].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="mt-8 max-w-xl text-pretty text-lg text-[#14361a]">
                Escríbenos por WhatsApp. Te atiende una persona: te mostramos Boxy con productos de tu negocio, te
                ayudamos a cargar tu inventario y te decimos qué plan te conviene.
              </p>
            </div>
            <div className="grid gap-4">
              {CONTACTOS.map((c) => (
                <a
                  key={c.telefono}
                  href={c.enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-asesor group"
                  aria-label={`Escribir a ${c.nombre} por WhatsApp al ${c.visible}`}
                >
                  <span className="lp-asesor-iniciales">{c.iniciales}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold">{c.nombre}</span>
                    <span className="lp-tel num mt-1 block">{c.visible}</span>
                  </span>
                  <span className="lp-asesor-wa">
                    <IconoWhatsApp className="h-6 w-6" />
                    <span className="hidden sm:inline">Escribir</span>
                    <ArrowUpRight className="hidden h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:block" />
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
                  <p className="max-w-prose pb-6 text-[var(--lp-tinta-2)]">{p.a.replace('MEDIOS', listaMedios(config?.medios_cobro))}</p>
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
            <h2 id="titulo-cierre" className="lp-display max-w-3xl text-[clamp(2.4rem,1.3rem+4.2vw,5rem)]">
              Deja el Excel. Abre tu caja en Boxy <span className="text-[var(--lp-verde)]">hoy.</span>
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
            <p className="flex items-center gap-2.5">
              <BoxyLogo className="h-10 w-10" />
              <span className="lp-display text-2xl text-[var(--lp-claro)]">Boxy</span>
            </p>
            <p className="mt-3 max-w-xs text-sm">Punto de venta, inventario y control de caja para cualquier negocio en Venezuela.</p>
          </div>
          <ul className="space-y-1 text-sm">
            {[
              ['#sistema', 'El sistema'],
              ['#excel', 'Inventario'],
              ['#sin-internet', 'Sin internet'],
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
          <p>
            © {new Date().getFullYear()} Boxy. Precios de ejemplo a tasa BCV de Bs 911,62. Billetes: Wikimedia Commons (dominio
            público y CC0).
          </p>
          <p>Los comprobantes de Boxy son documentos no fiscales.</p>
        </div>
      </footer>
    </div>
  )
}

/* ══ Escena de la portada ═══════════════════════════════════════════════ */

const POS_TAGS: { top: string; left?: string; right?: string; r: number; d: number; t: number; p: number; movil: boolean }[] = [
  { top: '-2%', left: '0%', r: -6, d: 1.0, t: 4.2, p: 14, movil: true },
  { top: '-6%', right: '0%', r: 5, d: 1.15, t: 3.6, p: -10, movil: true },
  { top: '40%', right: '-9%', r: -4, d: 1.3, t: 4.6, p: 18, movil: false },
  { top: '62%', left: '-8%', r: 4, d: 1.45, t: 3.9, p: -16, movil: false },
  { top: '86%', left: '24%', r: -3, d: 1.6, t: 4.4, p: 12, movil: true },
  { top: '78%', right: '-2%', r: 6, d: 1.75, t: 3.7, p: -14, movil: false },
]

const CELDAS_BILLETES: { src: string; horizontal: boolean }[] = [
  { src: usd100, horizontal: true },
  { src: usd20, horizontal: true },
  { src: usd5, horizontal: true },
  { src: bs100, horizontal: false },
  { src: bs50, horizontal: false },
]

function EscenaGaveta() {
  return (
    <div className="lp-escena" role="img" aria-label="Gaveta de caja abierta con billetes de dólares y bolívares, monedas y etiquetas de productos de distintas tiendas">
      <div className="lp-gaveta-vista">
        <div className="lp-gaveta">
          <div className="lp-bandeja">
            <div className="lp-bandeja-piso">
              {CELDAS_BILLETES.map((c) => (
                <div key={c.src} className="lp-celda">
                  <div className="lp-fajo">
                    {[2, 1, 0].map((k) => (
                      // La capa mide lo mismo que la celda: el desplazamiento del fajo es relativo a la celda.
                      <span
                        key={k}
                        className="lp-capa"
                        style={{ '--dx': `${k * 4}%`, '--dy': `${-k * 2.5}%`, '--rot': `${k ? (k % 2 ? -2.5 : 1.5) : 0}deg` } as CSSProperties}
                      >
                        <img src={c.src} alt="" decoding="async" className={c.horizontal ? 'lp-billete-h' : 'lp-billete-v'} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="lp-celda lp-celda-monedas">
                  <span className={`lp-moneda ${i % 2 ? 'lp-moneda-plata' : ''}`} style={{ transform: 'translate(-18%, -8%)' }} />
                  <span className={`lp-moneda ${i % 2 ? '' : 'lp-moneda-plata'}`} style={{ transform: 'translate(22%, 14%)' }} />
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

/** Captura real del sistema dentro de un marco de navegador. */
function Pantalla({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <figure className={`lp-pantalla ${className}`}>
      <div className="lp-pantalla-barra" aria-hidden>
        <span />
        <span />
        <span />
        <span className="lp-pantalla-url">boxy.venz.cloud</span>
      </div>
      <img src={src} alt={alt} loading="lazy" decoding="async" className="block w-full" />
    </figure>
  )
}

/** Una hoja de cálculo típica de un negocio llevado en Excel. */
function HojaExcel() {
  const filas: [string, string, string, string, boolean?][] = [
    ['Harina PAN', '1,1', '=B2*TASA', '120'],
    ['Taladro 650W', '48', '#¡REF!', '?', true],
    ['Zapatos T40', '32', '=B4*36,5', '14'],
    ['Cargador USBC', '9,5', '8.660,39', '-3', true],
    ['Acetaminofen', '1,8', '=B6*TASA', '48'],
  ]
  return (
    <figure className="lp-hoja" aria-label="Ejemplo de una hoja de Excel desordenada, con fórmulas rotas y la tasa escrita a mano">
      <div className="lp-hoja-barra">
        <FileSpreadsheet className="h-4 w-4" /> inventario_FINAL_v3 (2).xlsx
      </div>
      <div className="lp-hoja-formula">
        <span className="font-semibold">fx</span> =B3*TASA_DEL_LUNES
      </div>
      <table>
        <thead>
          <tr>
            <th />
            <th>A</th>
            <th>B</th>
            <th>C</th>
            <th>D</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>1</th>
            <td className="font-semibold">Producto</td>
            <td className="font-semibold">$</td>
            <td className="font-semibold">Bs</td>
            <td className="font-semibold">Stock</td>
          </tr>
          {filas.map(([a, b, c, d, mal], i) => (
            <tr key={a}>
              <th>{i + 2}</th>
              <td>{a}</td>
              <td>{b}</td>
              <td className={mal ? 'lp-hoja-error' : ''}>{c}</td>
              <td className={d.startsWith('-') || d === '?' ? 'lp-hoja-error' : ''}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

function Ventaja({ icono: Icono, t, d }: { icono: LucideIcon; t: string; d: string }) {
  return (
    <li className="lp-ventaja">
      <span className="lp-ventaja-icono">
        <Icono className="h-6 w-6" strokeWidth={2} />
      </span>
      <div>
        <p className="text-lg font-semibold leading-snug">{t}</p>
        <p className="mt-1.5 text-[var(--lp-tinta-2)]">{d}</p>
      </div>
    </li>
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
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${bajo ? 'bg-[#fde3d3] text-[#8a3b0c]' : 'bg-[#e3f5dc] text-[var(--lp-verde-tinta)]'}`}>
          {bajo ? `Quedan ${p.stock} · reponer` : `${p.stock} en existencia`}
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
