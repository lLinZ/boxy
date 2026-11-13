import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
  Select,
  SelectItem,
  Spinner,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
  Tooltip,
  useDisclosure,
} from '@heroui/react'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownUp,
  BadgePercent,
  Barcode,
  Boxes,
  FileSpreadsheet,
  Flame,
  History,
  Package,
  PackagePlus,
  Pencil,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { api, mensajeError } from '../lib/api'
import { ivaLabel, n, usd } from '../lib/format'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import { PreciosMasivosModal } from '../components/PreciosMasivosModal'
import { VencimientosPanel } from '../components/VencimientosPanel'
import { ImportarProductosModal } from '../components/ImportarProductosModal'
import { ProductoFormModal } from '../components/ProductoFormModal'
import { BarcodeLabelModal } from '../components/BarcodeLabelModal'
import type { Inventario, Movimiento, Paginated, Producto } from '../types'

type TipoMov = 'entrada' | 'salida' | 'merma' | 'ajuste'

const MOV_LABEL: Record<string, { label: string; color: 'success' | 'danger' | 'warning' | 'primary' | 'default' }> = {
  entrada: { label: 'Entrada', color: 'success' },
  salida: { label: 'Salida', color: 'danger' },
  merma: { label: 'Merma', color: 'danger' },
  ajuste: { label: 'Ajuste', color: 'warning' },
  venta: { label: 'Venta', color: 'primary' },
  compra: { label: 'Compra', color: 'success' },
  anulacion: { label: 'Anulación', color: 'default' },
  devolucion: { label: 'Devolución', color: 'default' },
}

export function InventarioPage() {
  const { panel } = useTheme()
  const { puede } = useAuth()
  const gestiona = puede('productos.gestionar')
  const mueve = puede('inventario.movimientos')
  const veCostos = gestiona || puede('reportes.ver')
  const veKardex = mueve || veCostos
  const preciosModal = useDisclosure()
  const [lote, setLote] = useState('')
  const [venceEl, setVenceEl] = useState('')
  const [errorMov, setErrorMov] = useState('')
  const [items, setItems] = useState<Inventario[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [soloBajo, setSoloBajo] = useState(false)

  // Modal de movimiento
  const movModal = useDisclosure()
  const [seleccion, setSeleccion] = useState<Inventario | null>(null)
  const [tipo, setTipo] = useState<TipoMov>('entrada')
  const [cantidad, setCantidad] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Modal de kardex
  const kardexModal = useDisclosure()
  const [kardex, setKardex] = useState<Movimiento[]>([])
  const [kardexCargando, setKardexCargando] = useState(false)

  // Modal de importación
  const importModal = useDisclosure()

  // Modal de alta/edición de producto
  const formModal = useDisclosure()
  const [editando, setEditando] = useState<Inventario | null>(null)

  // Modal de etiqueta / código de barras
  const labelModal = useDisclosure()
  const [prodEtiqueta, setProdEtiqueta] = useState<Producto | null>(null)

  function abrirNuevo() {
    setEditando(null)
    formModal.onOpen()
  }

  function abrirEditar(inv: Inventario) {
    setEditando(inv)
    formModal.onOpen()
  }

  function abrirEtiqueta(p: Producto | undefined) {
    if (!p) return
    setProdEtiqueta(p)
    labelModal.onOpen()
  }

  function cargar() {
    setCargando(true)
    api
      .get<Inventario[]>('/inventario')
      .then((r) => setItems(r.data))
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [])

  const filtrados = useMemo(() => {
    const q = filtro.toLowerCase()
    return items.filter((i) => {
      const p = i.producto
      const coincide =
        !q ||
        (p?.nombre ?? '').toLowerCase().includes(q) ||
        (p?.sku ?? '').toLowerCase().includes(q)
      const bajo = n(i.cantidad) <= n(i.stock_minimo)
      return coincide && (!soloBajo || bajo)
    })
  }, [items, filtro, soloBajo])

  const stats = useMemo(() => {
    let costo = 0
    let venta = 0
    let bajo = 0
    for (const i of items) {
      costo += n(i.cantidad) * n(i.producto?.precio_costo_usd ?? 0)
      venta += n(i.cantidad) * n(i.producto?.precio_venta_usd ?? 0)
      if (n(i.cantidad) <= n(i.stock_minimo)) bajo++
    }
    return { costo, venta, bajo, ganancia: venta - costo }
  }, [items])

  // Máximo de unidades vendidas (30d) → referencia para el indicador "hot" 🔥
  const maxVendidos = useMemo(
    () => Math.max(0, ...items.map((i) => i.vendidos_30d ?? 0)),
    [items],
  )

  function abrirMovimiento(inv: Inventario) {
    setSeleccion(inv)
    setTipo('entrada')
    setCantidad('')
    setLote('')
    setVenceEl('')
    setErrorMov('')
    movModal.onOpen()
  }

  function abrirKardex(inv: Inventario) {
    setSeleccion(inv)
    setKardex([])
    setKardexCargando(true)
    kardexModal.onOpen()
    api
      .get<Paginated<Movimiento>>(`/inventario/kardex/${inv.producto_id}`)
      .then((r) => setKardex(r.data.data))
      .finally(() => setKardexCargando(false))
  }

  async function guardar(onClose: () => void) {
    if (!seleccion || !cantidad) return
    setGuardando(true)
    try {
      await api.post('/inventario/movimiento', {
        producto_id: seleccion.producto_id,
        tipo,
        cantidad: Number(cantidad),
        lote: tipo === 'entrada' && lote ? lote : undefined,
        vence_el: tipo === 'entrada' && venceEl ? venceEl : undefined,
      })
      cargar()
      onClose()
    } catch (e) {
      setErrorMov(mensajeError(e, 'No se pudo registrar el movimiento.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Métricas del inventario */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MiniStat panel={panel} icon={<Package className="h-5 w-5" />} tone="bg-primary/15 text-primary" label="Productos" value={String(items.length)} />
        <MiniStat panel={panel} icon={<Wallet className="h-5 w-5" />} tone="bg-secondary/15 text-secondary" label="Valor a costo" value={veCostos ? usd(stats.costo) : '—'} />
        <MiniStat panel={panel} icon={<TrendingUp className="h-5 w-5" />} tone="bg-success/15 text-success" label="Valor a venta" value={usd(stats.venta)} />
        <MiniStat panel={panel} icon={<Boxes className="h-5 w-5" />} tone={stats.bajo > 0 ? 'bg-danger/15 text-danger' : 'bg-default/30 text-default-600'} label="Bajo stock" value={String(stats.bajo)} />
      </div>

      <Tabs aria-label="Inventario" variant="underlined" color="primary">
      <Tab key="existencias" title="Existencias">
      <Card className={panel}>
        <CardHeader className="flex-col items-stretch gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">Inventario</h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Switch size="sm" isSelected={soloBajo} onValueChange={setSoloBajo}>
                <span className="text-small">Solo bajo stock</span>
              </Switch>
              {puede('precios.gestionar') && (
                <Button variant="flat" startContent={<BadgePercent className="h-4 w-4" />} onPress={preciosModal.onOpen}>
                  Cambiar precios
                </Button>
              )}
              {gestiona && (
                <>
                  <Button variant="flat" startContent={<FileSpreadsheet className="h-4 w-4" />} onPress={importModal.onOpen}>
                    Importar Excel
                  </Button>
                  <Button color="primary" startContent={<PackagePlus className="h-4 w-4" />} onPress={abrirNuevo}>
                    Nuevo producto
                  </Button>
                </>
              )}
            </div>
          </div>
          <Input
            placeholder="Filtrar por nombre o SKU…"
            value={filtro}
            onValueChange={setFiltro}
            variant="bordered"
            isClearable
            startContent={<Search className="h-4 w-4 text-default-400" />}
          />
        </CardHeader>
        <CardBody className="overflow-x-auto">
          {cargando ? (
            <div className="flex justify-center py-10">
              <Spinner label="Cargando inventario…" />
            </div>
          ) : (
            <Table aria-label="Inventario" removeWrapper className="min-w-[860px]">
              <TableHeader>
                <TableColumn>PRODUCTO</TableColumn>
                <TableColumn>CATEGORÍA</TableColumn>
                <TableColumn>COSTO</TableColumn>
                <TableColumn>PRECIO</TableColumn>
                <TableColumn>MARGEN</TableColumn>
                <TableColumn className="min-w-[140px]">STOCK</TableColumn>
                <TableColumn className="text-right">ACCIONES</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Sin productos. Importa tu catálogo con el botón Excel.">
                {filtrados.map((inv) => {
                  const p = inv.producto
                  const stock = n(inv.cantidad)
                  const minimo = n(inv.stock_minimo)
                  const bajo = stock <= minimo
                  const costo = n(p?.precio_costo_usd ?? 0)
                  const venta = n(p?.precio_venta_usd ?? 0)
                  const margen = venta > 0 ? ((venta - costo) / venta) * 100 : 0
                  // Barra: % respecto a 3× el mínimo (referencia visual de "saludable")
                  const ref = Math.max(minimo * 3, 1)
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            radius="lg"
                            src={p?.imagen_path ?? undefined}
                            fallback={<Package className="h-4 w-4 text-default-400" />}
                            className="bg-default-100"
                            size="sm"
                          />
                          <div>
                            <p className="flex items-center gap-1.5 font-medium leading-tight">
                              {p?.nombre}
                              {(() => {
                                const vend = n(inv.vendidos_30d ?? 0)
                                if (vend <= 0 || vend < maxVendidos * 0.5) return null
                                const top = vend >= maxVendidos * 0.8
                                return (
                                  <Tooltip content={`${vend.toLocaleString('es-VE')} vendidos en 30 días`}>
                                    <span className="inline-flex items-center">
                                      <Flame
                                        className={`h-4 w-4 ${top ? 'animate-pulse text-orange-500' : 'text-orange-400'}`}
                                        fill="currentColor"
                                      />
                                    </span>
                                  </Tooltip>
                                )
                              })()}
                            </p>
                            <p className="text-tiny text-default-400">
                              {p?.sku} · {ivaLabel[p?.tipo_iva ?? 'general']}
                            </p>
                            {p?.codigo_barra ? (
                              <button
                                onClick={() => abrirEtiqueta(p)}
                                className="mt-0.5 flex items-center gap-1 font-mono text-tiny text-primary hover:underline"
                              >
                                <Barcode className="h-3 w-3" />
                                {p.codigo_barra}
                              </button>
                            ) : (
                              <span className="mt-0.5 flex items-center gap-1 text-tiny text-default-300">
                                <Barcode className="h-3 w-3" />
                                sin código
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {p?.categoria ? (
                          <Chip size="sm" variant="flat" color="secondary">
                            {p.categoria.nombre}
                          </Chip>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-default-500">{veCostos ? usd(costo) : '—'}</TableCell>
                      <TableCell className="font-semibold">{usd(venta)}</TableCell>
                      <TableCell>
                        {veCostos ? (
                          <Chip
                            size="sm"
                            variant="flat"
                            color={margen >= 30 ? 'success' : margen >= 15 ? 'warning' : 'danger'}
                          >
                            {margen.toFixed(0)}%
                          </Chip>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-tiny">
                            <span className={bajo ? 'font-semibold text-danger' : 'text-default-600'}>
                              {stock.toLocaleString('es-VE')} {p?.unidad}
                            </span>
                            <span className="text-default-400">mín {minimo.toLocaleString('es-VE')}</span>
                          </div>
                          <Progress
                            size="sm"
                            aria-label="Nivel de stock"
                            value={Math.min((stock / ref) * 100, 100)}
                            color={bajo ? 'danger' : stock <= minimo * 2 ? 'warning' : 'success'}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {gestiona && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            aria-label="Editar producto"
                            onPress={() => abrirEditar(inv)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          )}
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            aria-label="Etiqueta / código de barras"
                            onPress={() => abrirEtiqueta(p)}
                          >
                            <Barcode className="h-4 w-4" />
                          </Button>
                          {veKardex && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            aria-label="Kardex"
                            onPress={() => abrirKardex(inv)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          )}
                          {mueve && (
                          <Button
                            size="sm"
                            variant="flat"
                            color="primary"
                            startContent={<ArrowDownUp className="h-3.5 w-3.5" />}
                            onPress={() => abrirMovimiento(inv)}
                          >
                            Movimiento
                          </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
      </Tab>
      {veKardex && (
        <Tab key="vencimientos" title="Vencimientos">
          <VencimientosPanel panel={panel} />
        </Tab>
      )}
      </Tabs>

      {/* Modal movimiento */}
      <Modal isOpen={movModal.isOpen} onOpenChange={movModal.onOpenChange} size="sm">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="font-display">{seleccion?.producto?.nombre}</ModalHeader>
              <ModalBody className="gap-3">
                {/* `bordered`: la variante flat se camufla con el fondo del modal en oscuro */}
                <Select
                  label="Tipo de movimiento"
                  variant="bordered"
                  selectedKeys={[tipo]}
                  onChange={(e) => setTipo(e.target.value as TipoMov)}
                >
                  <SelectItem key="entrada">Entrada (reposición)</SelectItem>
                  <SelectItem key="salida">Salida (consumo interno, traslado)</SelectItem>
                  <SelectItem key="merma">Merma (vencido, dañado, robo)</SelectItem>
                  <SelectItem key="ajuste">Ajuste (fijar stock exacto tras contar)</SelectItem>
                </Select>
                <Input
                  label="Cantidad"
                  type="number"
                  variant="bordered"
                  value={cantidad}
                  onValueChange={setCantidad}
                />
                {tipo === 'entrada' && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Lote (opcional)" variant="bordered" size="sm" value={lote} onValueChange={setLote} />
                    <Input label="Vence (opcional)" type="date" variant="bordered" size="sm" value={venceEl} onValueChange={setVenceEl} />
                  </div>
                )}
                {tipo === 'entrada' && (
                  <p className="text-tiny text-default-400">Las compras a proveedores se registran en Compras (actualizan el costo promedio).</p>
                )}
                {errorMov && <p className="text-small text-danger">{errorMov}</p>}
                <p className="text-tiny text-default-400">
                  Stock actual: {n(seleccion?.cantidad ?? 0).toLocaleString('es-VE')}
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="primary" isLoading={guardando} onPress={() => guardar(onClose)}>
                  Guardar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Modal kardex */}
      <Modal isOpen={kardexModal.isOpen} onOpenChange={kardexModal.onOpenChange} size="lg" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-2 font-display">
                <History className="h-5 w-5 text-primary" />
                Kardex · {seleccion?.producto?.nombre}
              </ModalHeader>
              <ModalBody>
                {kardexCargando ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : kardex.length === 0 ? (
                  <p className="py-6 text-center text-small text-default-400">Sin movimientos registrados.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {kardex.map((m) => {
                      const conf = MOV_LABEL[m.tipo] ?? MOV_LABEL.ajuste
                      const delta = n(m.cantidad)
                      return (
                        <div key={m.id} className="flex items-center gap-3 rounded-large bg-default-50 px-3 py-2">
                          <Chip size="sm" variant="flat" color={conf.color}>
                            {conf.label}
                          </Chip>
                          <span className={`font-display font-bold ${delta >= 0 ? 'text-success' : 'text-danger'}`}>
                            {delta >= 0 ? '+' : ''}
                            {delta.toLocaleString('es-VE')}
                          </span>
                          <span className="text-tiny text-default-400">
                            {n(m.cantidad_anterior).toLocaleString('es-VE')} → {n(m.cantidad_nueva).toLocaleString('es-VE')}
                          </span>
                          <span className="ml-auto text-tiny text-default-400">
                            {new Date(m.created_at).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose} fullWidth>
                  Cerrar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Modal importación Excel */}
      <ImportarProductosModal
        isOpen={importModal.isOpen}
        onOpenChange={importModal.onOpenChange}
        onImported={cargar}
      />

      {/* Modal alta / edición de producto */}
      <ProductoFormModal
        isOpen={formModal.isOpen}
        onOpenChange={formModal.onOpenChange}
        inv={editando}
        onSaved={cargar}
      />

      <PreciosMasivosModal isOpen={preciosModal.isOpen} onOpenChange={preciosModal.onOpenChange} onAplicado={cargar} />

      {/* Modal etiqueta / código de barras */}
      <BarcodeLabelModal
        isOpen={labelModal.isOpen}
        onOpenChange={labelModal.onOpenChange}
        producto={prodEtiqueta}
      />
    </div>
  )
}

function MiniStat({
  panel,
  icon,
  tone,
  label,
  value,
}: {
  panel: string
  icon: React.ReactNode
  tone: string
  label: string
  value: string
}) {
  return (
    <Card className={panel}>
      <CardBody className="flex-row items-center gap-3 py-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold leading-tight">{value}</p>
          <p className="text-tiny text-default-500">{label}</p>
        </div>
      </CardBody>
    </Card>
  )
}
