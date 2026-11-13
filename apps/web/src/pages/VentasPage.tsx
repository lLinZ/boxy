import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Pagination,
  Select,
  SelectItem,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  useDisclosure,
} from '@heroui/react'
import { useCallback, useEffect, useState } from 'react'
import { Ban, CloudOff, Eye, FileText, MessageCircle, Printer, RotateCcw, Search, Trash2, Undo2 } from 'lucide-react'
import { abrirFacturaPdf, api, leerError } from '../lib/api'
import { bs, fecha, n, usd } from '../lib/format'
import { alCambiarCola, descartarPendiente, sincronizarCola, type VentaPendiente } from '../lib/offline'
import { imprimirTicket, nombreMetodo, ticketDevolucion, ticketVenta } from '../lib/ticket'
import { abrirWhatsApp, textoComprobante } from '../lib/whatsapp'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import { useSupervisor, type Autorizacion } from '../components/SupervisorModal'
import type { Devolucion, Paginated, Venta } from '../types'

export function VentasPage() {
  const { panel } = useTheme()
  const { empresa, ajustes } = useAuth()
  const [pagina, setPagina] = useState<Paginated<Venta> | null>(null)
  const [page, setPage] = useState(1)
  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [cola, setCola] = useState<VentaPendiente[]>([])
  const [detalle, setDetalle] = useState<Venta | null>(null)
  const detalleModal = useDisclosure()
  const negocio = empresa ? { empresa: empresa.empresa, ajustes: empresa.ajustes } : null

  const cargar = useCallback(() => {
    api
      .get<Paginated<Venta>>('/ventas', { params: { page, per_page: 25, buscar: buscar || undefined, estado: estado || undefined, desde: desde || undefined, hasta: hasta || undefined } })
      .then((r) => setPagina(r.data))
      .catch(() => setPagina((p) => p ?? { data: [], current_page: 1, last_page: 1, total: 0 }))
  }, [page, buscar, estado, desde, hasta])

  useEffect(() => {
    const t = setTimeout(cargar, 250)
    return () => clearTimeout(t)
  }, [cargar])

  useEffect(() => alCambiarCola(setCola), [])

  async function abrirDetalle(id: number) {
    const r = await api.get<Venta>(`/ventas/${id}`)
    setDetalle(r.data)
    detalleModal.onOpen()
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {cola.length > 0 && (
        <Card className={`border border-warning-200 ${panel}`}>
          <CardHeader className="flex-wrap justify-between gap-2">
            <div className="flex items-center gap-2">
              <CloudOff className="h-5 w-5 text-warning" />
              <h2 className="font-display text-lg font-bold">Ventas hechas sin conexión</h2>
            </div>
            <Button size="sm" variant="flat" startContent={<RotateCcw className="h-4 w-4" />} onPress={() => sincronizarCola().then(cargar)}>
              Reintentar envío
            </Button>
          </CardHeader>
          <CardBody className="gap-2">
            {cola.map((v) => (
              <div key={v.uuid} className="flex flex-wrap items-center justify-between gap-2 rounded-large bg-default-50 p-2 text-small">
                <span>{fecha(v.creada_el)} · {usd(v.total_usd)}</span>
                {v.error ? (
                  <span className="flex items-center gap-2 text-danger">
                    Rechazada: {v.error}
                    <Button size="sm" variant="light" color="danger" startContent={<Trash2 className="h-4 w-4" />} onPress={() => { if (confirm('¿Descartar esta venta pendiente? No se registrará.')) descartarPendiente(v.uuid) }}>
                      Descartar
                    </Button>
                  </span>
                ) : (
                  <Chip size="sm" color="warning" variant="flat">Por enviar</Chip>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card className={panel}>
        <CardHeader className="flex-col items-stretch gap-3">
          <h2 className="font-display text-xl font-bold">Ventas</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input placeholder="N° de comprobante, cliente o cédula…" variant="bordered" value={buscar} onValueChange={(v) => { setBuscar(v); setPage(1) }} startContent={<Search className="h-4 w-4 text-default-400" />} isClearable onClear={() => setBuscar('')} />
            <Select aria-label="Estado" placeholder="Todos los estados" variant="bordered" selectedKeys={estado ? [estado] : []} onChange={(e) => { setEstado(e.target.value); setPage(1) }}>
              <SelectItem key="emitida">Emitidas</SelectItem>
              <SelectItem key="anulada">Anuladas</SelectItem>
            </Select>
            <Input type="date" label="Desde" variant="bordered" size="sm" value={desde} onValueChange={(v) => { setDesde(v); setPage(1) }} />
            <Input type="date" label="Hasta" variant="bordered" size="sm" value={hasta} onValueChange={(v) => { setHasta(v); setPage(1) }} />
          </div>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          {!pagina ? (
            <div className="flex justify-center py-10"><Spinner label="Cargando ventas…" /></div>
          ) : (
            <>
              <Table aria-label="Ventas" removeWrapper className="min-w-[680px]">
                <TableHeader>
                  <TableColumn>COMPROBANTE</TableColumn>
                  <TableColumn>FECHA</TableColumn>
                  <TableColumn>CLIENTE</TableColumn>
                  <TableColumn>TOTAL</TableColumn>
                  <TableColumn>ESTADO</TableColumn>
                  <TableColumn className="text-right"> </TableColumn>
                </TableHeader>
                <TableBody emptyContent="No hay ventas con esos filtros.">
                  {pagina.data.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <p className="font-medium">{v.numero_factura}</p>
                        <p className="text-tiny text-default-400">{v.user?.name}{v.origen === 'offline' ? ' · sin conexión' : ''}</p>
                      </TableCell>
                      <TableCell>{fecha(v.fecha)}</TableCell>
                      <TableCell>{v.cliente?.nombre ?? 'Consumidor Final'}</TableCell>
                      <TableCell>
                        <p className="font-semibold">{usd(v.total_usd)}</p>
                        <p className="text-tiny text-default-400">{bs(v.total_bs)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Chip size="sm" variant="flat" color={v.estado === 'emitida' ? 'success' : 'danger'}>{v.estado}</Chip>
                          {n(v.devuelto_usd ?? 0) > 0 && <Chip size="sm" variant="flat" color="warning">devol. {usd(v.devuelto_usd!)}</Chip>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button size="sm" variant="flat" color="primary" startContent={<Eye className="h-3.5 w-3.5" />} onPress={() => abrirDetalle(v.id)}>
                            Ver
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pagina.last_page > 1 && (
                <div className="flex justify-center pt-3">
                  <Pagination total={pagina.last_page} page={page} onChange={setPage} />
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {detalle && (
        <DetalleVenta
          venta={detalle}
          isOpen={detalleModal.isOpen}
          onOpenChange={detalleModal.onOpenChange}
          negocio={negocio}
          anchoTicket={ajustes?.ticket_ancho ?? 80}
          codigoPais={ajustes?.whatsapp_codigo_pais}
          onCambio={(v) => { setDetalle(v); cargar() }}
        />
      )}
    </div>
  )
}

function DetalleVenta({
  venta,
  isOpen,
  onOpenChange,
  negocio,
  anchoTicket,
  codigoPais,
  onCambio,
}: {
  venta: Venta
  isOpen: boolean
  onOpenChange: (o: boolean) => void
  negocio: Parameters<typeof ticketVenta>[1] | null
  anchoTicket: number
  codigoPais?: string
  onCambio: (v: Venta) => void
}) {
  const supervisor = useSupervisor()
  const [modo, setModo] = useState<'ver' | 'anular' | 'devolver'>('ver')
  const [motivo, setMotivo] = useState('')
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [danado, setDanado] = useState<Record<number, boolean>>({})
  const [reintegro, setReintegro] = useState('efectivo_bs')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    setModo('ver')
    setMotivo('')
    setCantidades({})
    setDanado({})
    setError('')
  }, [venta.id])

  const devueltoPorItem = (itemId: number) =>
    (venta.devoluciones ?? []).flatMap((d) => d.items ?? []).filter((i) => i.venta_item_id === itemId).reduce((a, i) => a + n(i.cantidad), 0)

  async function ejecutar(aut?: Autorizacion, intento = 0): Promise<void> {
    setTrabajando(true)
    setError('')
    try {
      if (modo === 'anular') {
        await api.post(`/ventas/${venta.id}/anular`, { motivo, autorizacion: aut })
      } else {
        const items = Object.entries(cantidades)
          .filter(([, c]) => n(c) > 0)
          .map(([id, c]) => ({ venta_item_id: Number(id), cantidad: n(c), reintegra_stock: !danado[Number(id)] }))
        const r = await api.post<Devolucion>(`/ventas/${venta.id}/devoluciones`, { motivo, metodo: reintegro, items, autorizacion: aut })
        if (negocio) imprimirTicket(ticketDevolucion(r.data, venta, negocio), anchoTicket)
      }
      const actualizada = await api.get<Venta>(`/ventas/${venta.id}`)
      onCambio(actualizada.data)
      setModo('ver')
    } catch (e) {
      const err = leerError(e)
      if (err.status === 403 && err.datos.requiere_supervisor) {
        const nueva = await supervisor.pedir(err.mensaje, intento > 0 ? 'Correo o PIN incorrectos.' : '')
        if (nueva) {
          setTrabajando(false)
          return ejecutar(nueva, intento + 1)
        }
      } else setError(err.mensaje)
    } finally {
      setTrabajando(false)
    }
  }

  const hayDevolucion = Object.values(cantidades).some((c) => n(c) > 0)

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-wrap items-center gap-2 font-display">
              Comprobante {venta.numero_factura}
              <Chip size="sm" variant="flat" color={venta.estado === 'emitida' ? 'success' : 'danger'}>{venta.estado}</Chip>
              {venta.numero_fiscal && <Chip size="sm" variant="flat">Factura fiscal {venta.numero_fiscal}</Chip>}
            </ModalHeader>
            <ModalBody className="gap-3 text-small">
              <div className="grid grid-cols-2 gap-2 text-default-600">
                <span>Fecha: {fecha(venta.fecha)}</span>
                <span>Cajero: {venta.user?.name ?? '—'}</span>
                <span>Cliente: {venta.cliente?.nombre ?? 'Consumidor Final'}</span>
                <span>Tasa BCV: {n(venta.tasa).toLocaleString('es-VE')}</span>
              </div>
              {venta.estado === 'anulada' && (
                <p className="rounded-medium bg-danger-50 p-2 text-danger">Anulada {venta.anulada_el ? fecha(venta.anulada_el) : ''}: {venta.motivo_anulacion}</p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="text-left text-tiny uppercase text-default-400">
                      <th className="py-1">Artículo</th>
                      <th className="py-1 text-right">Cant.</th>
                      <th className="py-1 text-right">Total</th>
                      {modo === 'devolver' && <th className="py-1 text-right">Devolver</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(venta.items ?? []).map((i) => {
                      const disponible = n(i.cantidad) - devueltoPorItem(i.id)
                      return (
                        <tr key={i.id} className="border-t border-default-100">
                          <td className="py-1.5">
                            {i.descripcion}
                            {n(i.descuento_usd ?? 0) > 0 && <span className="text-tiny text-warning"> (−{usd(i.descuento_usd!)})</span>}
                          </td>
                          <td className="py-1.5 text-right">{n(i.cantidad).toLocaleString('es-VE', { maximumFractionDigits: 3 })}</td>
                          <td className="py-1.5 text-right">{usd(i.total_usd)}</td>
                          {modo === 'devolver' && (
                            <td className="py-1.5">
                              {disponible > 0 ? (
                                <div className="flex items-center justify-end gap-2">
                                  <Input size="sm" type="number" min="0" max={String(disponible)} step="any" variant="bordered" className="w-20" aria-label="Cantidad a devolver" value={cantidades[i.id] ?? ''} onValueChange={(v) => setCantidades((c) => ({ ...c, [i.id]: v }))} />
                                  <Checkbox size="sm" isSelected={!!danado[i.id]} onValueChange={(v) => setDanado((d) => ({ ...d, [i.id]: v }))}>dañado</Checkbox>
                                </div>
                              ) : (
                                <span className="block text-right text-tiny text-default-400">devuelto</span>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-1 rounded-large bg-default-50 p-2">
                <Fila t="Subtotal" v={usd(venta.subtotal_usd)} />
                {n(venta.descuento_usd) > 0 && <Fila t="Descuentos" v={`−${usd(venta.descuento_usd)}`} />}
                <Fila t="IVA" v={usd(venta.iva_usd)} />
                {n(venta.igtf_usd) > 0 && <Fila t="IGTF" v={usd(venta.igtf_usd)} />}
                <Fila t="Total" v={`${usd(venta.total_usd)} · ${bs(venta.total_bs)}`} b />
                {(venta.pagos ?? []).map((p) => (
                  <Fila key={p.id} t={nombreMetodo(p.metodo)} v={p.moneda === 'USD' ? usd(p.monto) : bs(p.monto)} />
                ))}
                {n(venta.vuelto_usd ?? 0) > 0 && (
                  <Fila t={`Vuelto (${nombreMetodo(venta.vuelto_metodo)})`} v={venta.vuelto_moneda === 'USD' ? usd(venta.vuelto_monto ?? 0) : bs(venta.vuelto_monto ?? 0)} />
                )}
              </div>

              {(venta.devoluciones ?? []).length > 0 && (
                <div>
                  <p className="mb-1 font-semibold">Devoluciones</p>
                  {venta.devoluciones!.map((d) => (
                    <p key={d.id} className="text-default-600">
                      {d.numero} · {fecha(d.created_at)} · {usd(d.total_usd)} ({nombreMetodo(d.reintegro_metodo)}) · {d.motivo}
                    </p>
                  ))}
                </div>
              )}

              {modo !== 'ver' && (
                <div className="flex flex-col gap-2 rounded-large border border-warning-200 p-3">
                  <p className="font-semibold">{modo === 'anular' ? 'Anular la venta completa' : 'Registrar devolución'}</p>
                  {modo === 'anular' && (
                    <p className="text-tiny text-default-500">Solo mientras la caja de esa venta siga abierta. Devuelve el stock y revierte fiado y puntos.</p>
                  )}
                  <Input label="Motivo" variant="bordered" size="sm" value={motivo} onValueChange={setMotivo} />
                  {modo === 'devolver' && (
                    <Select label="Cómo se devuelve el dinero" size="sm" variant="bordered" selectedKeys={[reintegro]} onChange={(e) => e.target.value && setReintegro(e.target.value)}>
                      <SelectItem key="efectivo_bs">Efectivo Bs</SelectItem>
                      <SelectItem key="efectivo_usd">Efectivo USD</SelectItem>
                      <SelectItem key="pago_movil">Pago móvil</SelectItem>
                      {venta.cliente ? <SelectItem key="cuenta_cliente">A la cuenta del cliente</SelectItem> : null}
                    </Select>
                  )}
                  {error && <p className="text-danger">{error}</p>}
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex-wrap">
              {modo === 'ver' ? (
                <>
                  {negocio && (
                    <Button size="sm" variant="flat" startContent={<Printer className="h-4 w-4" />} onPress={() => imprimirTicket(ticketVenta(venta, negocio), anchoTicket)}>
                      Ticket
                    </Button>
                  )}
                  <Button size="sm" variant="flat" startContent={<FileText className="h-4 w-4" />} onPress={() => abrirFacturaPdf(venta.id)}>PDF</Button>
                  {venta.cliente?.telefono && (
                    <Button size="sm" variant="flat" color="success" startContent={<MessageCircle className="h-4 w-4" />} onPress={() => abrirWhatsApp(venta.cliente!.telefono, textoComprobante(venta, negocio?.empresa.nombre ?? 'Boxy'), codigoPais)}>
                      WhatsApp
                    </Button>
                  )}
                  {venta.estado === 'emitida' && (
                    <>
                      <Button size="sm" variant="flat" color="warning" startContent={<Undo2 className="h-4 w-4" />} onPress={() => setModo('devolver')}>Devolución</Button>
                      {n(venta.devuelto_usd ?? 0) === 0 && (
                        <Button size="sm" variant="flat" color="danger" startContent={<Ban className="h-4 w-4" />} onPress={() => setModo('anular')}>Anular</Button>
                      )}
                    </>
                  )}
                  <Button size="sm" color="primary" onPress={onClose}>Cerrar</Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="light" onPress={() => setModo('ver')}>Volver</Button>
                  <Button size="sm" color={modo === 'anular' ? 'danger' : 'warning'} isLoading={trabajando} isDisabled={motivo.trim().length < 3 || (modo === 'devolver' && !hayDevolucion)} onPress={() => ejecutar()}>
                    {modo === 'anular' ? 'Anular venta' : 'Registrar devolución'}
                  </Button>
                </>
              )}
            </ModalFooter>
            {supervisor.modal}
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

function Fila({ t, v, b = false }: { t: string; v: string; b?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${b ? 'font-semibold' : ''}`}>
      <span className="text-default-500">{t}</span>
      <span>{v}</span>
    </div>
  )
}
