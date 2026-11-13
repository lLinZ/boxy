import {
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
  Textarea,
  useDisclosure,
} from '@heroui/react'
import { useCallback, useEffect, useState } from 'react'
import { Ban, Check, Eye, PackagePlus, Pencil, Plus, Search, Trash2, Truck } from 'lucide-react'
import { api, mensajeError } from '../lib/api'
import { bs, n, usd } from '../lib/format'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import { TIPOS_DOC } from './ClientesPage'
import type { Compra, Paginated, Producto, Proveedor, TasaCambio } from '../types'

export function ComprasPage() {
  const { panel } = useTheme()
  const [compras, setCompras] = useState<Compra[] | null>(null)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [porPagar, setPorPagar] = useState(false)
  const [detalle, setDetalle] = useState<Compra | null>(null)
  const [proveedorForm, setProveedorForm] = useState<Partial<Proveedor> | null>(null)
  const nueva = useDisclosure()
  const detalleModal = useDisclosure()
  const provModal = useDisclosure()

  const cargar = useCallback(() => {
    api.get<Paginated<Compra>>('/compras', { params: { per_page: 50, por_pagar: porPagar || undefined } }).then((r) => setCompras(r.data.data))
    api.get<Proveedor[]>('/proveedores').then((r) => setProveedores(r.data))
  }, [porPagar])

  useEffect(cargar, [cargar])

  async function verCompra(id: number) {
    const r = await api.get<Compra>(`/compras/${id}`)
    setDetalle(r.data)
    detalleModal.onOpen()
  }

  async function accion(ruta: string, confirmar?: string) {
    if (confirmar && !confirm(confirmar)) return
    try {
      const r = await api.post<Compra>(ruta)
      setDetalle((d) => (d ? { ...d, ...r.data } : d))
      cargar()
    } catch (e) {
      alert(mensajeError(e))
    }
  }

  return (
    <>
      <Tabs aria-label="Compras" variant="underlined" color="primary">
        <Tab key="compras" title="Compras">
          <Card className={panel}>
            <CardHeader className="flex-wrap justify-between gap-2">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl font-bold">Compras a proveedores</h2>
              </div>
              <div className="flex items-center gap-3">
                <Switch size="sm" isSelected={porPagar} onValueChange={setPorPagar}>Solo por pagar</Switch>
                <Button color="primary" startContent={<PackagePlus className="h-4 w-4" />} onPress={nueva.onOpen}>
                  Registrar compra
                </Button>
              </div>
            </CardHeader>
            <CardBody className="overflow-x-auto">
              {!compras ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : (
                <Table aria-label="Compras" removeWrapper className="min-w-[680px]">
                  <TableHeader>
                    <TableColumn>N°</TableColumn>
                    <TableColumn>FECHA</TableColumn>
                    <TableColumn>PROVEEDOR</TableColumn>
                    <TableColumn>TOTAL</TableColumn>
                    <TableColumn>PAGO</TableColumn>
                    <TableColumn className="text-right"> </TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="Aún no hay compras. Regístralas para llevar el costo real de cada producto.">
                    {compras.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <p className="font-medium">{c.numero}</p>
                          <p className="text-tiny text-default-400">{c.documento_proveedor ? `Fact. ${c.documento_proveedor}` : ''} · {c.items_count} artículos</p>
                        </TableCell>
                        <TableCell>{new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-VE')}</TableCell>
                        <TableCell>{c.proveedor?.nombre ?? '—'}</TableCell>
                        <TableCell className="font-semibold">{usd(c.total_usd)}</TableCell>
                        <TableCell>
                          {c.estado === 'anulada' ? (
                            <Chip size="sm" color="danger" variant="flat">anulada</Chip>
                          ) : c.pagada ? (
                            <Chip size="sm" color="success" variant="flat">pagada</Chip>
                          ) : (
                            <Chip size="sm" color="warning" variant="flat">por pagar{c.vence_el ? ` · ${new Date(c.vence_el + 'T12:00:00').toLocaleDateString('es-VE')}` : ''}</Chip>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button isIconOnly size="sm" variant="flat" aria-label="Ver compra" onPress={() => verCompra(c.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </Tab>

        <Tab key="proveedores" title="Proveedores">
          <Card className={panel}>
            <CardHeader className="flex-wrap justify-between gap-2">
              <h2 className="font-display text-xl font-bold">Proveedores</h2>
              <Button color="primary" startContent={<Plus className="h-4 w-4" />} onPress={() => { setProveedorForm({ tipo_documento: 'J', activo: true }); provModal.onOpen() }}>
                Nuevo proveedor
              </Button>
            </CardHeader>
            <CardBody className="overflow-x-auto">
              <Table aria-label="Proveedores" removeWrapper className="min-w-[600px]">
                <TableHeader>
                  <TableColumn>PROVEEDOR</TableColumn>
                  <TableColumn>RIF</TableColumn>
                  <TableColumn>CONTACTO</TableColumn>
                  <TableColumn>COMPRADO</TableColumn>
                  <TableColumn className="text-right"> </TableColumn>
                </TableHeader>
                <TableBody emptyContent="Sin proveedores.">
                  {proveedores.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.nombre} {!p.activo && <Chip size="sm" variant="flat">inactivo</Chip>}
                      </TableCell>
                      <TableCell>{p.documento ? `${p.tipo_documento}-${p.documento}` : '—'}</TableCell>
                      <TableCell>{[p.contacto, p.telefono].filter(Boolean).join(' · ') || '—'}</TableCell>
                      <TableCell>{usd(p.total_comprado_usd ?? 0)} <span className="text-tiny text-default-400">({p.compras_count} compras)</span></TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button isIconOnly size="sm" variant="flat" aria-label="Editar" onPress={() => { setProveedorForm(p); provModal.onOpen() }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </Tab>
      </Tabs>

      <NuevaCompraModal isOpen={nueva.isOpen} onOpenChange={nueva.onOpenChange} proveedores={proveedores.filter((p) => p.activo)} onGuardada={cargar} />

      <Modal isOpen={detalleModal.isOpen} onOpenChange={detalleModal.onOpenChange} size="3xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => detalle && (
            <>
              <ModalHeader className="flex flex-wrap items-center gap-2 font-display">
                Compra {detalle.numero}
                <Chip size="sm" variant="flat" color={detalle.estado === 'anulada' ? 'danger' : 'success'}>{detalle.estado}</Chip>
              </ModalHeader>
              <ModalBody className="gap-3 text-small">
                <p className="text-default-600">
                  {detalle.proveedor?.nombre ?? 'Sin proveedor'} · {new Date(detalle.fecha + 'T12:00:00').toLocaleDateString('es-VE')}
                  {detalle.documento_proveedor && ` · Factura ${detalle.documento_proveedor}`} · {detalle.condicion}
                  {detalle.moneda === 'VES' && ` · tasa ${n(detalle.tasa).toLocaleString('es-VE')}`}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <thead>
                      <tr className="text-left text-tiny uppercase text-default-400">
                        <th className="py-1">Producto</th>
                        <th className="py-1 text-right">Cant.</th>
                        <th className="py-1 text-right">Costo</th>
                        <th className="py-1 text-right">Costo promedio</th>
                        <th className="py-1">Lote / vence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.items?.map((i) => (
                        <tr key={i.id} className="border-t border-default-100">
                          <td className="py-1.5">{i.producto?.nombre}</td>
                          <td className="py-1.5 text-right">{n(i.cantidad).toLocaleString('es-VE')}</td>
                          <td className="py-1.5 text-right">{usd(i.costo_unitario_usd)}</td>
                          <td className="py-1.5 text-right">{usd(i.costo_anterior_usd)} → <b>{usd(i.costo_promedio_usd)}</b></td>
                          <td className="py-1.5">{[i.lote, i.vence_el && new Date(i.vence_el + 'T12:00:00').toLocaleDateString('es-VE')].filter(Boolean).join(' · ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-right">Subtotal {usd(detalle.subtotal_usd)} · IVA {usd(detalle.iva_usd)} · <b>Total {usd(detalle.total_usd)}</b></p>
                {detalle.observacion && <p className="text-default-500">{detalle.observacion}</p>}
              </ModalBody>
              <ModalFooter className="flex-wrap">
                {detalle.estado === 'registrada' && !detalle.pagada && (
                  <Button size="sm" variant="flat" color="success" startContent={<Check className="h-4 w-4" />} onPress={() => accion(`/compras/${detalle.id}/pagada`)}>
                    Marcar pagada
                  </Button>
                )}
                {detalle.estado === 'registrada' && (
                  <Button size="sm" variant="flat" color="danger" startContent={<Ban className="h-4 w-4" />} onPress={() => accion(`/compras/${detalle.id}/anular`, '¿Anular la compra? Se saca del stock lo que entró.')}>
                    Anular
                  </Button>
                )}
                <Button size="sm" color="primary" onPress={onClose}>Cerrar</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <ProveedorModal isOpen={provModal.isOpen} onOpenChange={provModal.onOpenChange} inicial={proveedorForm} onGuardado={cargar} />
    </>
  )
}

interface ItemForm {
  producto: Producto
  cantidad: string
  costo: string
  iva_pct: string
  lote: string
  vence_el: string
  precio_venta: string
}

function NuevaCompraModal({ isOpen, onOpenChange, proveedores, onGuardada }: { isOpen: boolean; onOpenChange: (o: boolean) => void; proveedores: Proveedor[]; onGuardada: () => void }) {
  const { puede } = useAuth()
  const [proveedorId, setProveedorId] = useState('')
  const [documento, setDocumento] = useState('')
  const [fechaCompra, setFechaCompra] = useState(new Date().toISOString().slice(0, 10))
  const [moneda, setMoneda] = useState<'USD' | 'VES'>('USD')
  const [tasa, setTasa] = useState('')
  const [condicion, setCondicion] = useState<'contado' | 'credito'>('contado')
  const [vence, setVence] = useState('')
  const [observacion, setObservacion] = useState('')
  const [items, setItems] = useState<ItemForm[]>([])
  const [buscar, setBuscar] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (isOpen) api.get<TasaCambio>('/tasas/vigente').then((r) => setTasa(String(n(r.data.tasa)))).catch(() => {})
  }, [isOpen])

  useEffect(() => {
    if (buscar.trim().length < 2) {
      setResultados([])
      return
    }
    const t = setTimeout(() => {
      api.get<Paginated<Producto>>('/productos', { params: { buscar, per_page: 8 } }).then((r) => setResultados(r.data.data))
    }, 250)
    return () => clearTimeout(t)
  }, [buscar])

  function agregar(p: Producto) {
    if (!items.some((i) => i.producto.id === p.id)) {
      setItems((prev) => [...prev, { producto: p, cantidad: '', costo: '', iva_pct: p.tipo_iva === 'general' ? '16' : p.tipo_iva === 'reducido' ? '8' : '0', lote: '', vence_el: '', precio_venta: '' }])
    }
    setBuscar('')
    setResultados([])
  }

  const cambiar = (idx: number, campo: keyof ItemForm, valor: string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)))

  const tasaNum = n(tasa)
  const aUsd = (v: number) => (moneda === 'USD' ? v : tasaNum > 0 ? v / tasaNum : 0)
  const subtotal = items.reduce((a, i) => a + n(i.cantidad) * aUsd(n(i.costo.replace(',', '.'))), 0)
  const iva = items.reduce((a, i) => a + n(i.cantidad) * aUsd(n(i.costo.replace(',', '.'))) * n(i.iva_pct) / 100, 0)

  async function guardar(onClose: () => void) {
    setGuardando(true)
    setError('')
    try {
      await api.post('/compras', {
        proveedor_id: proveedorId ? Number(proveedorId) : null,
        documento_proveedor: documento || null,
        fecha: fechaCompra,
        moneda,
        tasa: moneda === 'VES' ? tasaNum : undefined,
        condicion,
        vence_el: condicion === 'credito' && vence ? vence : null,
        observacion: observacion || null,
        items: items.map((i) => ({
          producto_id: i.producto.id,
          cantidad: n(i.cantidad),
          costo_unitario: n(i.costo.replace(',', '.')),
          iva_pct: Number(i.iva_pct),
          lote: i.lote || null,
          vence_el: i.vence_el || null,
          precio_venta_usd: i.precio_venta ? n(i.precio_venta.replace(',', '.')) : null,
        })),
      })
      setItems([])
      setDocumento('')
      setObservacion('')
      onGuardada()
      onClose()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  const valido = items.length > 0 && items.every((i) => n(i.cantidad) > 0 && i.costo !== '') && (moneda === 'USD' || tasaNum > 0)

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="font-display">Registrar compra</ModalHeader>
            <ModalBody className="gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Select label="Proveedor" variant="bordered" selectedKeys={proveedorId ? [proveedorId] : []} onChange={(e) => setProveedorId(e.target.value)}>
                  {proveedores.map((p) => <SelectItem key={String(p.id)}>{p.nombre}</SelectItem>)}
                </Select>
                <Input label="N° factura del proveedor" variant="bordered" value={documento} onValueChange={setDocumento} />
                <Input label="Fecha" type="date" variant="bordered" value={fechaCompra} onValueChange={setFechaCompra} />
                <div className="flex gap-2">
                  <Select label="Moneda" variant="bordered" selectedKeys={[moneda]} onChange={(e) => e.target.value && setMoneda(e.target.value as 'USD' | 'VES')}>
                    <SelectItem key="USD">USD</SelectItem>
                    <SelectItem key="VES">Bs</SelectItem>
                  </Select>
                  {moneda === 'VES' && <Input label="Tasa" variant="bordered" inputMode="decimal" value={tasa} onValueChange={setTasa} />}
                </div>
                <Select label="Condición" variant="bordered" selectedKeys={[condicion]} onChange={(e) => e.target.value && setCondicion(e.target.value as 'contado' | 'credito')}>
                  <SelectItem key="contado">De contado</SelectItem>
                  <SelectItem key="credito">A crédito (por pagar)</SelectItem>
                </Select>
                {condicion === 'credito' && <Input label="Vence el" type="date" variant="bordered" value={vence} onValueChange={setVence} />}
              </div>

              <div className="relative">
                <Input placeholder="Agregar producto: nombre, SKU o código…" variant="bordered" value={buscar} onValueChange={setBuscar} startContent={<Search className="h-4 w-4 text-default-400" />} />
                {resultados.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-large border border-default-200 bg-content1 p-1 shadow-lg">
                    {resultados.map((p) => (
                      <button key={p.id} className="flex w-full justify-between rounded-medium px-3 py-2 text-left text-small hover:bg-default-100" onClick={() => agregar(p)}>
                        <span>{p.nombre} <span className="text-default-400">· {p.sku}</span></span>
                        <span className="text-default-500">costo {usd(p.precio_costo_usd ?? 0)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-small">
                  <thead>
                    <tr className="text-left text-tiny uppercase text-default-400">
                      <th className="py-1">Producto</th>
                      <th className="w-24 py-1">Cantidad</th>
                      <th className="w-28 py-1">Costo unit. ({moneda === 'USD' ? '$' : 'Bs'})</th>
                      <th className="w-20 py-1">IVA</th>
                      <th className="w-28 py-1">Lote</th>
                      <th className="w-36 py-1">Vence</th>
                      {puede('precios.gestionar') && <th className="w-32 py-1">Nuevo precio $</th>}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr><td colSpan={8} className="py-4 text-center text-default-400">Busca y agrega los productos de la factura.</td></tr>
                    )}
                    {items.map((it, idx) => {
                      const costoUsd = aUsd(n(it.costo.replace(',', '.')))
                      const precio = n(it.producto.precio_venta_usd)
                      const margen = precio > 0 && costoUsd > 0 ? ((precio - costoUsd) / precio) * 100 : null
                      return (
                        <tr key={it.producto.id} className="border-t border-default-100 align-top">
                          <td className="py-1.5 pr-2">
                            <p className="font-medium">{it.producto.nombre}</p>
                            <p className="text-tiny text-default-400">
                              venta {usd(precio)}{margen != null && <span className={margen < 10 ? 'text-danger' : ''}> · margen {margen.toFixed(0)} %</span>}
                            </p>
                          </td>
                          <td className="py-1.5 pr-2"><Input size="sm" variant="bordered" inputMode="decimal" value={it.cantidad} onValueChange={(v) => cambiar(idx, 'cantidad', v)} /></td>
                          <td className="py-1.5 pr-2"><Input size="sm" variant="bordered" inputMode="decimal" value={it.costo} onValueChange={(v) => cambiar(idx, 'costo', v)} /></td>
                          <td className="py-1.5 pr-2">
                            <Select size="sm" aria-label="IVA" variant="bordered" selectedKeys={[it.iva_pct]} onChange={(e) => e.target.value && cambiar(idx, 'iva_pct', e.target.value)}>
                              <SelectItem key="0">0 %</SelectItem>
                              <SelectItem key="8">8 %</SelectItem>
                              <SelectItem key="16">16 %</SelectItem>
                            </Select>
                          </td>
                          <td className="py-1.5 pr-2"><Input size="sm" variant="bordered" value={it.lote} onValueChange={(v) => cambiar(idx, 'lote', v)} /></td>
                          <td className="py-1.5 pr-2"><Input size="sm" type="date" variant="bordered" value={it.vence_el} onValueChange={(v) => cambiar(idx, 'vence_el', v)} /></td>
                          {puede('precios.gestionar') && (
                            <td className="py-1.5 pr-2"><Input size="sm" variant="bordered" inputMode="decimal" placeholder={precio.toFixed(2)} value={it.precio_venta} onValueChange={(v) => cambiar(idx, 'precio_venta', v)} /></td>
                          )}
                          <td className="py-1.5">
                            <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Quitar" onPress={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <Textarea label="Observación" variant="bordered" minRows={1} value={observacion} onValueChange={setObservacion} />
              <div className="text-right text-small">
                Subtotal {usd(subtotal)} · IVA {usd(iva)} · <b className="text-large">Total {usd(subtotal + iva)}</b>
                {moneda === 'VES' && tasaNum > 0 && <span className="text-default-400"> ({bs((subtotal + iva) * tasaNum)})</span>}
              </div>
              <p className="text-tiny text-default-400">
                Al registrar, el stock sube y el costo de cada producto pasa a ser el promedio ponderado entre lo que había y lo que entra.
              </p>
              {error && <p className="text-small text-danger">{error}</p>}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>Cancelar</Button>
              <Button color="primary" isLoading={guardando} isDisabled={!valido} onPress={() => guardar(onClose)}>Registrar compra</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

function ProveedorModal({ isOpen, onOpenChange, inicial, onGuardado }: { isOpen: boolean; onOpenChange: (o: boolean) => void; inicial: Partial<Proveedor> | null; onGuardado: () => void }) {
  const [f, setF] = useState<Partial<Proveedor>>({})
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setF(inicial ?? { tipo_documento: 'J', activo: true })
      setError('')
    }
  }, [isOpen, inicial])

  const campo = (k: keyof Proveedor) => ({ value: String(f[k] ?? ''), onValueChange: (v: string) => setF((x) => ({ ...x, [k]: v })) })

  async function guardar(onClose: () => void) {
    setGuardando(true)
    setError('')
    try {
      const datos = { ...f, activo: f.activo ?? true }
      if (f.id) await api.put(`/proveedores/${f.id}`, datos)
      else await api.post('/proveedores', datos)
      onGuardado()
      onClose()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg" placement="center">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="font-display">{f.id ? 'Editar proveedor' : 'Nuevo proveedor'}</ModalHeader>
            <ModalBody className="gap-3">
              <Input label="Nombre o razón social" variant="bordered" isRequired {...campo('nombre')} />
              <div className="grid grid-cols-[110px_1fr] gap-3">
                <Select label="Tipo" variant="bordered" selectedKeys={[f.tipo_documento ?? 'J']} onChange={(e) => e.target.value && setF((x) => ({ ...x, tipo_documento: e.target.value }))}>
                  {TIPOS_DOC.map((t) => <SelectItem key={t.key}>{t.key}</SelectItem>)}
                </Select>
                <Input label="RIF / documento" variant="bordered" {...campo('documento')} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Persona de contacto" variant="bordered" {...campo('contacto')} />
                <Input label="Teléfono" variant="bordered" {...campo('telefono')} />
              </div>
              <Input label="Correo" type="email" variant="bordered" {...campo('email')} />
              <Input label="Dirección" variant="bordered" {...campo('direccion')} />
              <Textarea label="Notas" variant="bordered" minRows={2} {...campo('notas')} />
              <Switch isSelected={f.activo ?? true} onValueChange={(v) => setF((x) => ({ ...x, activo: v }))}>Activo</Switch>
              {error && <p className="text-small text-danger">{error}</p>}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>Cancelar</Button>
              <Button color="primary" isLoading={guardando} isDisabled={!f.nombre} onPress={() => guardar(onClose)}>Guardar</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
