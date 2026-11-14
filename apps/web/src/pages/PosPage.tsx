import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectItem,
  Spinner,
  Tooltip,
  useDisclosure,
} from '@heroui/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Flame,
  IdCard,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Printer,
  ScanBarcode,
  Search,
  Smartphone,
  Tag,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { abrirFacturaPdf, api, leerError } from '../lib/api'
import { bs, ivaLabel, n, usd } from '../lib/format'
import { calcular, r, type LineaCalculo } from '../lib/calculo'
import { actualizarCatalogo, buscarLocal, catalogoLocal, encolarVenta, nuevoUuid, porCodigoLocal } from '../lib/offline'
import { imprimirTicket, nombreMetodo, ticketVenta } from '../lib/ticket'
import { abrirWhatsApp, textoComprobante } from '../lib/whatsapp'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import { ScannerModal } from '../components/ScannerModal'
import { ClienteModal } from '../components/ClienteModal'
import { ConectarTelefonoModal } from '../components/ConectarTelefonoModal'
import { Calculadora } from '../components/Calculadora'
import { useSupervisor, type Autorizacion } from '../components/SupervisorModal'
import type {
  Cliente,
  Inventario,
  LineaCarrito,
  LineaPago,
  MetodoPago,
  Moneda,
  Paginated,
  Producto,
  Promocion,
  TasaVigente,
  TipoIva,
  TurnoCaja,
  Venta,
} from '../types'

const METODOS: { key: MetodoPago; label: string; moneda: Moneda }[] = [
  { key: 'efectivo_bs', label: 'Efectivo Bs', moneda: 'VES' },
  { key: 'pago_movil', label: 'Pago Móvil', moneda: 'VES' },
  { key: 'transferencia', label: 'Transferencia', moneda: 'VES' },
  { key: 'tarjeta', label: 'Tarjeta', moneda: 'VES' },
  { key: 'efectivo_usd', label: 'Efectivo USD', moneda: 'USD' },
  { key: 'zelle', label: 'Zelle (USD)', moneda: 'USD' },
  { key: 'credito', label: 'Fiado (a cuenta)', moneda: 'USD' },
  { key: 'puntos', label: 'Puntos', moneda: 'USD' },
]

/** Monto en divisas que cubre `falta` más su IGTF (igual al cálculo del servidor). */
const conIgtf = (falta: number) => r(falta + r((falta * 3) / 100))

const VUELTOS = [
  { key: 'efectivo_bs', label: 'Efectivo Bs' },
  { key: 'efectivo_usd', label: 'Efectivo USD' },
  { key: 'pago_movil', label: 'Pago móvil' },
]

export function PosPage() {
  const { panel } = useTheme()
  const { user, empresa, ajustes } = useAuth()
  const [tasas, setTasas] = useState<TasaVigente[]>([])
  const [promos, setPromos] = useState<Promocion[]>([])
  const [fuente, setFuente] = useState('BCV') // tasa usada para mostrar el equivalente en Bs
  const [turno, setTurno] = useState<TurnoCaja | null | undefined>(undefined) // undefined = cargando
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [buscar, setBuscar] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [destacados, setDestacados] = useState<Inventario[]>([])
  const [cargando, setCargando] = useState(false)
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])
  const [pagos, setPagos] = useState<LineaPago[]>([])
  const [vueltoMetodo, setVueltoMetodo] = useState<string>('')
  const [emitiendo, setEmitiendo] = useState(false)
  const [error, setError] = useState('')
  const [ventaEmitida, setVentaEmitida] = useState<Venta | null>(null)
  const [avisoScan, setAvisoScan] = useState('')
  const uuidRef = useRef<string>(nuevoUuid())
  // Sin respuesta del servidor: se vende con la copia local y las ventas quedan en cola
  const [sinServidor, setSinServidor] = useState(false)
  const exito = useDisclosure()
  const scanner = useDisclosure()
  const clienteModal = useDisclosure()
  const telefonoModal = useDisclosure()
  const supervisor = useSupervisor()

  const cobraIgtf = ajustes?.cobra_igtf ?? true
  const exigeTurno = ajustes?.exigir_turno ?? true
  const negocio = empresa ? { empresa: empresa.empresa, ajustes: empresa.ajustes, sucursal: user?.sucursal?.nombre } : null

  const cargarTurno = useCallback(() => {
    api
      .get<{ turno: TurnoCaja | null }>('/caja/actual')
      .then((r) => {
        setTurno(r.data.turno)
        setSinServidor(false)
      })
      .catch((e) => {
        setTurno(null)
        setSinServidor(leerError(e).sinConexion) // sin conexión: se deja vender (la venta queda en cola)
      })
  }, [])

  useEffect(() => {
    cargarTurno()
    api.get<TasaVigente[]>('/tasas/vigentes').then((r) => setTasas(r.data)).catch(async () => {
      const cat = await catalogoLocal()
      if (cat) setTasas(cat.tasas)
    })
    api.get<Promocion[]>('/promociones/vigentes').then((r) => setPromos(r.data)).catch(async () => {
      const cat = await catalogoLocal()
      if (cat) setPromos(cat.promociones)
    })
    // Acceso rápido: los más vendidos (30d) para tocar sin buscar
    api
      .get<Inventario[]>('/inventario')
      .then((r) => {
        const orden = [...r.data].filter((i) => i.producto?.activo !== false)
          .sort((a, b) => (b.vendidos_30d ?? 0) - (a.vendidos_30d ?? 0))
        setDestacados(orden.slice(0, 12))
      })
      .catch(() => {})
    // Copia del catálogo para vender sin conexión (en segundo plano)
    actualizarCatalogo().catch(() => {})
  }, [cargarTurno])

  const tasaBcv = n(tasas.find((t) => t.fuente === 'BCV')?.tasa ?? 0)
  const tasaActual = tasas.find((t) => t.fuente === fuente) ?? tasas[0] ?? null
  const tasaMostrar = n(tasaActual?.tasa ?? 0)
  const maxVendidos = Math.max(0, ...destacados.map((d) => d.vendidos_30d ?? 0))

  // Búsqueda con debounce (sin conexión busca en la copia local)
  useEffect(() => {
    if (buscar.trim().length < 2) {
      setResultados([])
      return
    }
    setCargando(true)
    const t = setTimeout(() => {
      api
        .get<Paginated<Producto>>('/productos', { params: { buscar, per_page: 12 } })
        .then((r) => setResultados(r.data.data))
        .catch(async () => setResultados(await buscarLocal(buscar)))
        .finally(() => setCargando(false))
    }, 300)
    return () => clearTimeout(t)
  }, [buscar])

  const agregar = useCallback((p: Producto, cantidad?: number) => {
    const suma = cantidad ?? p.cantidad_balanza ?? 1
    setCarrito((prev) => {
      const existe = prev.find((l) => l.producto.id === p.id)
      if (existe) {
        return prev.map((l) => (l.producto.id === p.id ? { ...l, cantidad: r(l.cantidad + suma, 3) } : l))
      }
      return [...prev, { producto: p, cantidad: suma }]
    })
  }, [])

  /** Busca por código de barras y agrega al carrito (pistola, cámara, teléfono o balanza). */
  const agregarPorCodigo = useCallback(
    async (codigo: string) => {
      const limpio = codigo.trim()
      if (!limpio) return
      let producto: Producto | null = null
      try {
        producto = (await api.get<Producto>(`/productos/codigo-barra/${encodeURIComponent(limpio)}`)).data
      } catch (e) {
        if (leerError(e).sinConexion) producto = await porCodigoLocal(limpio, ajustes)
      }
      if (producto) {
        agregar(producto)
        setAvisoScan(`✓ ${producto.nombre}${producto.cantidad_balanza ? ` · ${producto.cantidad_balanza} kg` : ''}`)
      } else {
        setAvisoScan(`Código ${limpio} no encontrado`)
      }
      setTimeout(() => setAvisoScan(''), 3000)
    },
    [agregar, ajustes],
  )

  // Escáner remoto (teléfono): sondea la cola cada 1,5 s mientras el POS esté abierto.
  useEffect(() => {
    let activo = true

    function beep() {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = 880
        gain.gain.value = 0.08
        osc.connect(gain).connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.12)
        osc.onended = () => ctx.close()
      } catch {
        /* sin audio disponible */
      }
    }

    const timer = setInterval(async () => {
      if (!navigator.onLine) return
      try {
        const res = await api.get<{ codigo: string }[]>('/scanner/cola')
        if (!activo || res.data.length === 0) return
        beep()
        for (const e of res.data) {
          await agregarPorCodigo(e.codigo)
        }
      } catch {
        /* la cola es tolerante a fallos: reintenta en el próximo tick */
      }
    }, 1500)

    return () => {
      activo = false
      clearInterval(timer)
    }
  }, [agregarPorCodigo])

  // Pistola lectora USB: teclea muy rápido y termina con Enter. Capturamos esa
  // ráfaga cuando el foco NO está en un input (si está en el buscador, lo maneja él).
  const wedgeRef = useRef<{ buffer: string; ultimo: number }>({ buffer: '', ultimo: 0 })
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      const w = wedgeRef.current
      const ahora = Date.now()
      if (ahora - w.ultimo > 80) w.buffer = '' // pausa larga = tipeo humano, reinicia
      w.ultimo = ahora

      if (e.key === 'Enter') {
        if (w.buffer.length >= 6) {
          agregarPorCodigo(w.buffer)
          e.preventDefault()
        }
        w.buffer = ''
      } else if (e.key.length === 1) {
        w.buffer += e.key
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [agregarPorCodigo])

  // Nunca borra la línea: si la cantidad no es válida (vacía, 0, "0.") se ignora.
  // Para sacar un producto del carrito está el botón de papelera (quitarLinea).
  function cambiarCantidad(id: number, cantidad: number) {
    if (!(cantidad > 0)) return
    setCarrito((prev) => prev.map((l) => (l.producto.id === id ? { ...l, cantidad: r(cantidad, 3) } : l)))
  }

  function quitarLinea(id: number) {
    setCarrito((prev) => prev.filter((l) => l.producto.id !== id))
  }

  function fijarDescuento(id: number, descuento: number) {
    setCarrito((prev) => prev.map((l) => (l.producto.id === id ? { ...l, descuento_usd: Math.max(0, r(descuento)) } : l)))
  }

  // Totales en vivo: el mismo cálculo que hace el servidor
  const lineas: LineaCalculo[] = useMemo(
    () =>
      carrito.map((l) => ({
        producto_id: l.producto.id,
        categoria_id: l.producto.categoria_id,
        descripcion: l.producto.nombre,
        cantidad: l.cantidad,
        precio_unitario_usd: n(l.producto.precio_venta_usd),
        tipo_iva: l.producto.tipo_iva,
        descuento_usd: l.descuento_usd ?? 0,
      })),
    [carrito],
  )
  const calculo = useMemo(
    () =>
      calcular(
        lineas,
        promos.map((p) => ({ ...p, valor: n(p.valor), cantidad_minima: n(p.cantidad_minima) })),
        pagos.map((p) => ({ metodo: p.metodo, moneda: p.moneda, monto: n(p.monto) })),
        tasaBcv,
        cobraIgtf,
      ),
    [lineas, promos, pagos, tasaBcv, cobraIgtf],
  )

  const metodosDisponibles = METODOS.filter((m) => {
    if (m.key === 'credito') return !!cliente?.credito_habilitado
    if (m.key === 'puntos') return !!ajustes?.puntos_activo && !!cliente && n(cliente.puntos ?? 0) >= n(ajustes.puntos_minimo_canje)
    return true
  })

  function agregarPago(metodo: MetodoPago) {
    const def = METODOS.find((m) => m.key === metodo)!
    setPagos((prev) => [...prev, { metodo, moneda: def.moneda, monto: montoParaCompletar(metodo, def.moneda, prev) }])
  }

  /** Lo que falta, expresado en la moneda del método (con IGTF si son divisas). */
  function montoParaCompletar(metodo: MetodoPago, moneda: Moneda, lista: LineaPago[]): string {
    const sin = calcular(lineas, promos.map((p) => ({ ...p, valor: n(p.valor), cantidad_minima: n(p.cantidad_minima) })),
      lista.map((p) => ({ metodo: p.metodo, moneda: p.moneda, monto: n(p.monto) })), tasaBcv, cobraIgtf)
    const falta = sin.faltante_usd
    if (falta <= 0) return ''
    let monto: number
    if (moneda === 'VES') monto = Math.ceil(falta * tasaBcv * 100) / 100
    else if (metodo === 'credito' || metodo === 'puntos' || !cobraIgtf) monto = falta
    else monto = conIgtf(falta) // lo que falta + su IGTF, exacto al céntimo
    if (metodo === 'puntos' && ajustes) monto = Math.min(monto, r(n(cliente?.puntos ?? 0) * n(ajustes.puntos_valor_usd)))
    return monto > 0 ? monto.toFixed(2) : ''
  }

  function completarPago(idx: number) {
    setPagos((prev) => {
      const otros = prev.filter((_, i) => i !== idx)
      const p = prev[idx]
      const monto = montoParaCompletar(p.metodo, p.moneda, otros)
      return prev.map((x, i) => (i === idx ? { ...x, monto } : x))
    })
  }

  // Acepta solo dígitos y un separador decimal (admite coma o punto al pegar).
  function cambiarMonto(idx: number, valor: string) {
    let limpio = valor.replace(',', '.').replace(/[^\d.]/g, '')
    const partes = limpio.split('.')
    if (partes.length > 2) limpio = partes[0] + '.' + partes.slice(1).join('')
    setPagos((prev) => prev.map((p, i) => (i === idx ? { ...p, monto: limpio } : p)))
  }

  function quitarPago(idx: number) {
    setPagos((prev) => prev.filter((_, i) => i !== idx))
  }

  function limpiarVenta() {
    setCarrito([])
    setPagos([])
    setCliente(null)
    setBuscar('')
    setResultados([])
    setVueltoMetodo('')
    setError('')
    uuidRef.current = nuevoUuid()
  }

  const vueltoElegido = vueltoMetodo || (ajustes?.vuelto_moneda === 'USD' ? 'efectivo_usd' : 'efectivo_bs')
  const vueltoEnUsd = vueltoElegido === 'efectivo_usd'

  async function cobrar(autorizacion?: Autorizacion, intento = 0) {
    setEmitiendo(true)
    setError('')
    const pagosValidos = pagos.filter((p) => n(p.monto) > 0)
    const payload = {
      uuid: uuidRef.current,
      cliente_id: cliente?.id ?? null,
      items: carrito.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad, descuento_usd: l.descuento_usd || undefined })),
      pagos: pagosValidos.map((p) => ({ metodo: p.metodo, moneda: p.moneda, monto: n(p.monto) })),
      vuelto_metodo: calculo.vuelto_usd > 0 ? vueltoElegido : undefined,
      total_esperado_usd: calculo.total_usd,
      autorizacion,
    }
    try {
      const res = await api.post<Venta>('/ventas', payload)
      terminar({ ...res.data, user: { id: user!.id, name: user!.name } })
    } catch (e) {
      const err = leerError(e, 'No se pudo registrar la venta.')
      if (err.sinConexion) {
        if (pagosValidos.some((p) => p.metodo === 'credito' || p.metodo === 'puntos')) {
          setError('Sin conexión no se puede fiar ni canjear puntos: cobra con otro método.')
        } else {
          await guardarSinConexion(payload)
        }
      } else if (err.status === 403 && err.datos.requiere_supervisor) {
        const aut = await supervisor.pedir(err.mensaje, intento > 0 ? 'Correo o PIN incorrectos.' : '')
        if (aut) {
          setEmitiendo(false)
          return cobrar(aut, intento + 1)
        }
      } else {
        if (err.datos.requiere_turno) cargarTurno()
        setError(err.mensaje)
      }
    } finally {
      setEmitiendo(false)
    }
  }

  /** Venta sin conexión: queda en la cola y se envía sola al volver la red. */
  async function guardarSinConexion(payload: Record<string, unknown> & { uuid: string }) {
    await encolarVenta({ uuid: payload.uuid, creada_el: new Date().toISOString(), payload, total_usd: calculo.total_usd })
    const local: Venta = {
      id: 0,
      numero_factura: `PEND-${payload.uuid.slice(0, 6).toUpperCase()}`,
      numero_control: '',
      fecha: new Date().toISOString(),
      tasa: String(tasaBcv),
      subtotal_usd: String(calculo.subtotal_usd),
      descuento_usd: String(calculo.descuento_usd),
      base_imponible_usd: String(calculo.base_imponible_usd),
      iva_usd: String(calculo.iva_usd),
      igtf_usd: String(calculo.igtf_usd),
      total_usd: String(calculo.total_usd),
      total_bs: String(calculo.total_bs),
      vuelto_usd: String(calculo.vuelto_usd),
      vuelto_metodo: calculo.vuelto_usd > 0 ? vueltoElegido : null,
      vuelto_moneda: vueltoEnUsd ? 'USD' : 'VES',
      vuelto_monto: String(vueltoEnUsd ? calculo.vuelto_usd : r(calculo.vuelto_usd * tasaBcv)),
      estado: 'emitida',
      pendiente: true,
      cliente,
      user: user ? { id: user.id, name: user.name } : null,
      items: calculo.lineas.map((l, i) => ({
        id: i, descripcion: l.descripcion, cantidad: String(l.cantidad), precio_unitario_usd: String(l.precio_unitario_usd),
        tipo_iva: l.tipo_iva as TipoIva,
        alicuota_iva: String(l.alicuota_iva), descuento_usd: String(l.descuento_total_usd), iva_usd: String(l.iva_usd), total_usd: String(l.total_usd),
      })),
      pagos: calculo.pagos.map((p, i) => ({
        id: i, metodo: p.metodo as MetodoPago, moneda: p.moneda as Moneda, monto: String(p.monto), monto_usd: String(p.monto_usd), igtf_usd: String(p.igtf_usd),
      })),
    }
    terminar(local)
  }

  function terminar(venta: Venta) {
    setVentaEmitida(venta)
    limpiarVenta()
    exito.onOpen()
    if (ajustes?.impresion_automatica && negocio) imprimirTicket(ticketVenta(venta, negocio), ajustes.ticket_ancho)
    // El stock de los destacados cambió; se refresca el catálogo local
    if (navigator.onLine) actualizarCatalogo().catch(() => {})
  }

  async function abrirCaja(fondoBs: number, fondoUsd: number) {
    try {
      const r = await api.post<TurnoCaja>('/caja/abrir', { fondo_bs: fondoBs, fondo_usd: fondoUsd })
      setTurno(r.data)
    } catch (e) {
      setError(leerError(e).mensaje)
      cargarTurno()
    }
  }

  const puedeCobrar = carrito.length > 0 && calculo.cubierto && pagos.some((p) => n(p.monto) > 0) && !emitiendo
  const sinTurno = exigeTurno && turno === null && !sinServidor

  if (turno === undefined) {
    return (
      <div className="flex justify-center py-20">
        <Spinner label="Cargando caja…" />
      </div>
    )
  }

  if (sinTurno) {
    return <AbrirCaja panel={panel} onAbrir={abrirCaja} error={error} />
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 xl:grid-cols-2">
      {/* Columna izquierda: búsqueda + acceso rápido. En el teléfono las columnas se
          deshacen (contents) y el orden queda: buscar, venta, más vendidos, calculadora. */}
      <div className="contents xl:flex xl:flex-col xl:gap-6">
        <Card className={`order-1 h-fit ${panel}`}>
          <CardHeader className="flex-col items-stretch gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold">Productos</h2>
              {avisoScan && (
                <Chip size="sm" variant="flat" color={avisoScan.startsWith('✓') ? 'success' : 'warning'}>
                  {avisoScan}
                </Chip>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nombre, SKU o código de barras…"
                value={buscar}
                onValueChange={setBuscar}
                variant="bordered"
                isClearable
                onClear={() => setBuscar('')}
                startContent={<Search className="h-4 w-4 text-default-400" />}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  // Enter con 1 resultado → lo agrega; si parece código de barras, lo busca directo.
                  if (resultados.length === 1) {
                    agregar(resultados[0])
                    setBuscar('')
                  } else if (/^\d{6,}$/.test(buscar.trim())) {
                    agregarPorCodigo(buscar)
                    setBuscar('')
                  }
                }}
              />
              <Button isIconOnly color="primary" variant="flat" size="lg" className="h-auto min-h-0" aria-label="Escanear con cámara" onPress={scanner.onOpen}>
                <ScanBarcode className="h-5 w-5" />
              </Button>
              <Button isIconOnly color="secondary" variant="flat" size="lg" className="h-auto min-h-0" aria-label="Conectar teléfono como escáner" onPress={telefonoModal.onOpen}>
                <Smartphone className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardBody className="gap-2">
            {cargando && <Spinner size="sm" />}
            {!cargando && resultados.length === 0 && buscar.length >= 2 && (
              <p className="text-small text-default-500">Sin resultados.</p>
            )}
            {!cargando && buscar.length < 2 && (
              <p className="text-small text-default-500">Escribe al menos 2 caracteres, o pasa el código por el lector.</p>
            )}
            <div className="flex flex-col gap-1.5">
              {resultados.map((p) => {
                const stock = n(p.inventarios?.[0]?.cantidad ?? 0)
                const sinStock = p.controla_stock && stock <= 0
                return (
                  <button
                    key={p.id}
                    onClick={() => agregar(p)}
                    className="group flex items-center gap-3 rounded-large border border-default-200 p-2.5 text-left transition-all hover:border-primary hover:bg-default-100"
                  >
                    <Avatar radius="lg" src={p.imagen_path ?? undefined} fallback={<Package className="h-5 w-5 text-default-400" />} className="shrink-0 bg-default-100" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-small font-semibold leading-tight">{p.nombre}</p>
                      <p className="truncate text-tiny text-default-400">
                        {p.sku}
                        {p.categoria ? ` · ${p.categoria.nombre}` : ''} · {ivaLabel[p.tipo_iva]}
                        {p.pesable ? ' · por peso' : ''}
                      </p>
                      <Chip size="sm" variant="flat" color={sinStock ? 'danger' : stock <= 5 ? 'warning' : 'success'} className="mt-1 h-5">
                        {sinStock ? 'Sin stock' : `${stock.toLocaleString('es-VE')} ${p.unidad}`}
                      </Chip>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg font-bold text-primary">{usd(p.precio_venta_usd)}</p>
                      {tasaMostrar > 0 && <p className="text-tiny text-default-400">{bs(n(p.precio_venta_usd) * tasaMostrar)}</p>}
                    </div>
                    <Plus className="hidden h-5 w-5 shrink-0 text-default-300 transition-colors group-hover:text-primary sm:block" />
                  </button>
                )
              })}
            </div>
          </CardBody>
        </Card>

        {/* Acceso rápido: más vendidos para tocar y agregar (🔥 los hot) */}
        <Card className={`order-3 ${panel}`}>
          <CardHeader className="items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <h2 className="font-display text-lg font-bold">Más vendidos</h2>
          </CardHeader>
          <CardBody>
            {destacados.length === 0 ? (
              <p className="py-4 text-center text-small text-default-400">Sin productos para mostrar.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {destacados.map((inv) => {
                  const p = inv.producto
                  if (!p) return null
                  const vend = n(inv.vendidos_30d ?? 0)
                  const hot = vend > 0 && vend >= maxVendidos * 0.5
                  const top = vend >= maxVendidos * 0.8
                  const promo = promos.some((x) => x.producto_id === p.id || (!x.producto_id && x.categoria_id === p.categoria_id))
                  return (
                    <button
                      key={inv.id}
                      onClick={() => agregar(p)}
                      className="relative flex flex-col items-center gap-1 rounded-large border border-default-200 p-2 text-center transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-default-100"
                    >
                      {hot && <Flame className={`absolute right-1.5 top-1.5 h-4 w-4 ${top ? 'animate-pulse text-orange-500' : 'text-orange-400'}`} fill="currentColor" />}
                      {promo && <Tag className="absolute left-1.5 top-1.5 h-4 w-4 text-success" />}
                      <Avatar radius="lg" size="md" src={p.imagen_path ?? undefined} fallback={<Package className="h-5 w-5 text-default-400" />} className="bg-default-100" />
                      <span className="line-clamp-2 text-tiny font-medium leading-tight">{p.nombre}</span>
                      <span className="text-tiny font-bold text-primary">{usd(p.precio_venta_usd)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Columna derecha: venta + calculadora */}
      <div className="contents xl:flex xl:flex-col xl:gap-6">
        <Card className={`order-2 h-fit ${panel}`}>
          <CardHeader className="flex-wrap justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold">Venta actual</h2>
              {turno && <p className="text-tiny text-default-400">Caja abierta · turno #{turno.id}</p>}
              {sinServidor && (
                <p className="text-tiny font-semibold text-warning">
                  Sin conexión: se vende con la copia local; las ventas se envían solas al volver la red.
                </p>
              )}
            </div>
            {/* Selector de tasa para el equivalente en Bs (los montos oficiales siempre usan BCV) */}
            {tasas.length > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-default-100 p-1">
                {tasas.map((t) => (
                  <Tooltip key={t.fuente} content={`1 USD = ${bs(t.tasa)}`} placement="bottom">
                    <button
                      onClick={() => setFuente(t.fuente)}
                      className={`rounded-full px-3 py-1 text-tiny font-semibold transition-colors ${
                        fuente === t.fuente ? 'bg-primary text-primary-foreground' : 'text-default-500 hover:text-foreground'
                      }`}
                    >
                      {t.fuente} {n(t.tasa).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
                    </button>
                  </Tooltip>
                ))}
              </div>
            )}
          </CardHeader>
          <CardBody className="gap-3">
            {/* Cliente de la venta (como en el supermercado: cédula primero) */}
            <div className="flex items-center justify-between gap-2 rounded-large bg-default-50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <IdCard className="h-4 w-4 shrink-0 text-default-400" />
                {cliente ? (
                  <div className="min-w-0">
                    <p className="truncate text-small font-semibold leading-tight">{cliente.nombre}</p>
                    <p className="truncate text-tiny text-default-400">
                      {cliente.tipo_documento}-{cliente.documento}
                      {cliente.credito_habilitado && ` · debe ${usd(cliente.saldo_usd ?? 0)} de ${usd(cliente.limite_credito_usd ?? 0)}`}
                      {ajustes?.puntos_activo && ` · ${cliente.puntos ?? 0} pts`}
                    </p>
                  </div>
                ) : (
                  <span className="text-small text-default-500">Consumidor Final</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {cliente && (
                  <Button isIconOnly size="sm" variant="light" aria-label="Quitar cliente" onPress={() => { setCliente(null); setPagos((p) => p.filter((x) => x.metodo !== 'credito' && x.metodo !== 'puntos')) }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="flat" color="primary" onPress={clienteModal.onOpen}>
                  {cliente ? 'Cambiar' : 'Asignar cliente'}
                </Button>
              </div>
            </div>

            {carrito.length === 0 && <p className="py-8 text-center text-default-400">Agrega productos para empezar.</p>}

            {calculo.lineas.map((l, i) => {
              const item = carrito[i]
              const p = item.producto
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small font-medium">{p.nombre}</p>
                    <p className="text-tiny text-default-400">
                      {usd(p.precio_venta_usd)}{p.pesable ? '/kg' : ''} · {ivaLabel[p.tipo_iva]}
                      {l.promocion_usd > 0 && <span className="text-success"> · promo −{usd(l.promocion_usd)}</span>}
                      {l.descuento_manual_usd > 0 && <span className="text-warning"> · desc. −{usd(l.descuento_manual_usd)}</span>}
                    </p>
                  </div>
                  {p.pesable ? (
                    <CantidadKg valor={item.cantidad} onCambiar={(c) => cambiarCantidad(p.id, c)} />
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button isIconOnly size="sm" variant="flat" aria-label="Restar" isDisabled={item.cantidad <= 1} onPress={() => cambiarCantidad(p.id, item.cantidad - 1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center text-small font-semibold">{item.cantidad}</span>
                      <Button isIconOnly size="sm" variant="flat" aria-label="Sumar" onPress={() => cambiarCantidad(p.id, item.cantidad + 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <DescuentoLinea bruto={l.bruto_usd} valor={item.descuento_usd ?? 0} onCambiar={(d) => fijarDescuento(p.id, d)} />
                  <span className="w-16 text-right text-small font-semibold">{usd(l.total_usd)}</span>
                  <Button isIconOnly size="sm" variant="light" color="danger" aria-label={`Quitar ${p.nombre}`} onPress={() => quitarLinea(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}

            <Divider />

            {/* Totales */}
            <div className="flex flex-col gap-1 text-small">
              <Row label="Subtotal" value={usd(calculo.subtotal_usd)} />
              {calculo.descuento_usd > 0 && <Row label="Descuentos y promociones" value={`−${usd(calculo.descuento_usd)}`} />}
              <Row label="IVA" value={usd(calculo.iva_usd)} />
              {calculo.igtf_usd > 0 && <Row label="IGTF (3 %)" value={usd(calculo.igtf_usd)} />}
              <Divider className="my-1" />
              <div className="flex items-center justify-between font-display font-bold">
                <span className="text-large">TOTAL</span>
                <span className="flex items-center gap-1">
                  <BtnCopiar texto={calculo.total_usd.toFixed(2)} />
                  <span className="text-2xl text-primary">{usd(calculo.total_usd)}</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-default-500">
                <span>En bolívares (BCV)</span>
                <span className="flex items-center gap-1">
                  <BtnCopiar texto={calculo.total_bs.toFixed(2)} />
                  {bs(calculo.total_bs)}
                </span>
              </div>
              {fuente !== 'BCV' && tasaMostrar > 0 && (
                <p className="text-right text-tiny text-warning">
                  Referencial {fuente}: {bs(calculo.total_usd * tasaMostrar)}. Los cobros en Bs se calculan a tasa BCV.
                </p>
              )}
            </div>

            <Divider />

            {/* Pagos */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-small font-medium">Pagos</span>
                <Select
                  aria-label="Agregar método de pago"
                  placeholder="+ Método de pago"
                  className="max-w-[190px]"
                  size="sm"
                  selectedKeys={[]}
                  onChange={(e) => e.target.value && agregarPago(e.target.value as MetodoPago)}
                >
                  {metodosDisponibles.map((m) => (
                    <SelectItem key={m.key}>{m.label}</SelectItem>
                  ))}
                </Select>
              </div>

              {pagos.map((p, idx) => {
                const def = METODOS.find((m) => m.key === p.metodo)!
                const res = calculo.pagos[idx]
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <Chip size="sm" variant="flat" color={p.metodo === 'credito' ? 'secondary' : p.moneda === 'USD' ? 'warning' : 'default'} className="shrink-0">
                      {def.label}
                    </Chip>
                    <Input
                      size="sm"
                      type="text"
                      inputMode="decimal"
                      variant="bordered"
                      placeholder="0,00"
                      value={p.monto}
                      onValueChange={(v) => cambiarMonto(idx, v)}
                      startContent={<span className="text-tiny text-default-400">{p.moneda === 'USD' ? '$' : 'Bs'}</span>}
                      endContent={res?.igtf_usd > 0 ? <span className="whitespace-nowrap text-tiny text-default-400">IGTF {usd(res.igtf_usd)}</span> : null}
                      className="flex-1"
                    />
                    <Tooltip content="Completar con lo que falta">
                      <Button isIconOnly size="sm" variant="flat" aria-label="Completar" onPress={() => completarPago(idx)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Quitar pago" onPress={() => quitarPago(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}

              {pagos.length > 0 && (
                <div className="rounded-large bg-default-50 p-2 text-small">
                  <div className="flex justify-between text-default-500">
                    <span>Pagado</span>
                    <span>{usd(calculo.pagado_usd)}</span>
                  </div>
                  {!calculo.cubierto ? (
                    <div className="flex flex-wrap justify-between gap-1 font-semibold text-danger">
                      <span>Falta</span>
                      <span>
                        {bs(calculo.faltante_usd * tasaBcv)} o {usd(cobraIgtf ? conIgtf(calculo.faltante_usd) : calculo.faltante_usd)} en divisas
                      </span>
                    </div>
                  ) : calculo.vuelto_usd > 0 ? (
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-success">
                        Vuelto: {vueltoEnUsd ? usd(calculo.vuelto_usd) : bs(calculo.vuelto_usd * tasaBcv)}
                      </span>
                      <Select
                        aria-label="Cómo se entrega el vuelto"
                        size="sm"
                        className="max-w-[160px]"
                        selectedKeys={[vueltoElegido]}
                        onChange={(e) => e.target.value && setVueltoMetodo(e.target.value)}
                      >
                        {VUELTOS.map((v) => (
                          <SelectItem key={v.key}>{v.label}</SelectItem>
                        ))}
                      </Select>
                    </div>
                  ) : (
                    <p className="font-semibold text-success">Cubierto ✓</p>
                  )}
                </div>
              )}
            </div>

            {error && <p className="rounded-medium bg-danger-50 p-2 text-small text-danger">{error}</p>}

            <Button color="primary" size="lg" isLoading={emitiendo} isDisabled={!puedeCobrar} onPress={() => cobrar()} fullWidth>
              Cobrar {carrito.length > 0 && `· ${usd(calculo.total_usd)}`}
            </Button>
            <p className="text-center text-tiny text-default-400">Se emite un comprobante no fiscal.</p>
          </CardBody>
        </Card>

        {/* Minicalculadora con equivalente en Bs */}
        <div className="order-4">
          <Calculadora tasa={tasaMostrar} panel={panel} />
        </div>
      </div>

      {/* Escáner con cámara */}
      <ScannerModal isOpen={scanner.isOpen} onOpenChange={scanner.onOpenChange} onScan={agregarPorCodigo} />

      {/* Selector / registro de cliente */}
      <ClienteModal isOpen={clienteModal.isOpen} onOpenChange={clienteModal.onOpenChange} onSelect={setCliente} />

      {/* Emparejar teléfono como escáner remoto */}
      <ConectarTelefonoModal isOpen={telefonoModal.isOpen} onOpenChange={telefonoModal.onOpenChange} />

      {supervisor.modal}

      {/* Venta registrada */}
      <Modal isOpen={exito.isOpen} onOpenChange={exito.onOpenChange} size="sm" placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                {ventaEmitida?.pendiente ? 'Venta guardada sin conexión' : 'Venta registrada'}
              </ModalHeader>
              <ModalBody>
                {ventaEmitida && (
                  <div className="flex flex-col gap-1 text-small">
                    {ventaEmitida.pendiente && (
                      <p className="mb-2 rounded-medium bg-warning-50 p-2 text-tiny text-warning-700">
                        Se enviará sola cuando vuelva la conexión.
                      </p>
                    )}
                    <Row label="Comprobante N°" value={ventaEmitida.numero_factura} />
                    <Row label="Total USD" value={usd(ventaEmitida.total_usd)} />
                    <Row label="Total Bs" value={bs(ventaEmitida.total_bs)} />
                    {n(ventaEmitida.vuelto_usd ?? 0) > 0 && (
                      <div className="mt-2 rounded-large bg-success-50 p-3 text-center">
                        <p className="text-tiny text-success-700">Vuelto ({nombreMetodo(ventaEmitida.vuelto_metodo)})</p>
                        <p className="font-display text-2xl font-bold text-success-700">
                          {ventaEmitida.vuelto_moneda === 'USD' ? usd(ventaEmitida.vuelto_monto ?? 0) : bs(ventaEmitida.vuelto_monto ?? 0)}
                        </p>
                      </div>
                    )}
                    {n(ventaEmitida.puntos_ganados ?? 0) > 0 && <Row label="Puntos ganados" value={String(ventaEmitida.puntos_ganados)} />}
                  </div>
                )}
              </ModalBody>
              <ModalFooter className="flex-wrap">
                {negocio && (
                  <Button variant="flat" startContent={<Printer className="h-4 w-4" />} onPress={() => ventaEmitida && imprimirTicket(ticketVenta(ventaEmitida, negocio), ajustes?.ticket_ancho)}>
                    Ticket
                  </Button>
                )}
                {ventaEmitida && !ventaEmitida.pendiente && (
                  <Button variant="flat" startContent={<FileText className="h-4 w-4" />} onPress={() => abrirFacturaPdf(ventaEmitida.id)}>
                    PDF
                  </Button>
                )}
                {ventaEmitida?.cliente?.telefono && (
                  <Button
                    variant="flat"
                    color="success"
                    startContent={<MessageCircle className="h-4 w-4" />}
                    onPress={() => abrirWhatsApp(ventaEmitida.cliente!.telefono, textoComprobante(ventaEmitida, empresa?.empresa.nombre ?? 'Boxy'), ajustes?.whatsapp_codigo_pais)}
                  >
                    WhatsApp
                  </Button>
                )}
                <Button color="primary" onPress={onClose} fullWidth>
                  Nueva venta
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

/** Pantalla para abrir la caja (turno) con el fondo inicial. */
function AbrirCaja({ panel, onAbrir, error }: { panel: string; onAbrir: (bs: number, usd: number) => Promise<void>; error: string }) {
  const [fondoBs, setFondoBs] = useState('')
  const [fondoUsd, setFondoUsd] = useState('')
  const [abriendo, setAbriendo] = useState(false)
  return (
    <div className="mx-auto max-w-md pt-6 sm:pt-12">
      <Card className={panel}>
        <CardHeader className="flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Abrir caja</h2>
          </div>
          <p className="text-small text-default-500">
            Cuenta el sencillo con el que empiezas. Al cerrar el turno, Boxy te dirá cuánto efectivo debe haber.
          </p>
        </CardHeader>
        <CardBody className="gap-3">
          <Input label="Fondo en bolívares" inputMode="decimal" variant="bordered" value={fondoBs} onValueChange={setFondoBs} startContent={<span className="text-tiny text-default-400">Bs</span>} />
          <Input label="Fondo en dólares" inputMode="decimal" variant="bordered" value={fondoUsd} onValueChange={setFondoUsd} startContent={<span className="text-tiny text-default-400">$</span>} />
          {error && <p className="text-small text-danger">{error}</p>}
          <Button
            color="primary"
            size="lg"
            isLoading={abriendo}
            onPress={async () => {
              setAbriendo(true)
              await onAbrir(n(fondoBs.replace(',', '.')), n(fondoUsd.replace(',', '.')))
              setAbriendo(false)
            }}
          >
            Abrir caja y empezar a vender
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}

/** Descuento manual de una línea (en USD o %). Si el cajero no tiene permiso, el servidor pedirá PIN. */
function DescuentoLinea({ bruto, valor, onCambiar }: { bruto: number; valor: number; onCambiar: (usd: number) => void }) {
  const [texto, setTexto] = useState('')
  const [enPct, setEnPct] = useState(false)
  const aplicar = () => {
    const v = n(texto.replace(',', '.'))
    onCambiar(enPct ? r((bruto * v) / 100) : v)
  }
  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <Button isIconOnly size="sm" variant={valor > 0 ? 'flat' : 'light'} color={valor > 0 ? 'warning' : 'default'} aria-label="Descuento">
          <Tag className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-3">
        <div className="flex w-full flex-col gap-2">
          <p className="text-small font-semibold">Descuento de la línea</p>
          <div className="flex gap-1">
            <Button size="sm" variant={enPct ? 'light' : 'flat'} onPress={() => setEnPct(false)}>$</Button>
            <Button size="sm" variant={enPct ? 'flat' : 'light'} onPress={() => setEnPct(true)}>%</Button>
            <Input size="sm" variant="bordered" inputMode="decimal" value={texto} onValueChange={setTexto} onKeyDown={(e) => e.key === 'Enter' && aplicar()} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" color="warning" className="flex-1" onPress={aplicar}>Aplicar</Button>
            {valor > 0 && <Button size="sm" variant="light" onPress={() => { onCambiar(0); setTexto('') }}>Quitar</Button>}
          </div>
          <p className="text-tiny text-default-400">Sin permiso de descuento, se pedirá el PIN de un supervisor al cobrar.</p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-default-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

/** Botón para copiar un monto al portapapeles (muestra ✓ por un instante). */
function BtnCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <Tooltip content={copiado ? '¡Copiado!' : 'Copiar monto'} placement="left">
      <button
        type="button"
        aria-label="Copiar monto"
        className="rounded-medium p-1 text-default-400 transition-colors hover:bg-default-100 hover:text-default-600"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texto)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 1200)
          } catch {
            /* sin permiso de portapapeles */
          }
        }}
      >
        {copiado ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </button>
    </Tooltip>
  )
}

/**
 * Campo de kilos para productos pesables. Guarda el texto que escribe el cajero
 * (puede quedar vacío o en "0." mientras escribe) y solo avisa cantidades > 0.
 * Acepta coma o punto decimal. Al salir del campo, si quedó inválido, vuelve al valor anterior.
 */
function CantidadKg({ valor, onCambiar }: { valor: number; onCambiar: (cantidad: number) => void }) {
  const [texto, setTexto] = useState(String(valor))
  const [editando, setEditando] = useState(false)
  const aNumero = (t: string) => Number(t.replace(',', '.'))

  return (
    <Input
      size="sm"
      type="text"
      inputMode="decimal"
      variant="bordered"
      aria-label="Kilos"
      className="w-24"
      endContent={<span className="text-tiny text-default-400">kg</span>}
      value={editando ? texto : String(valor)}
      onFocus={(e) => {
        setTexto(String(valor))
        setEditando(true)
        ;(e.target as HTMLInputElement).select()
      }}
      onBlur={() => setEditando(false)}
      onValueChange={(v) => {
        if (!/^\d*[.,]?\d{0,3}$/.test(v)) return
        setTexto(v)
        const c = aNumero(v)
        if (c > 0) onCambiar(c)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}
