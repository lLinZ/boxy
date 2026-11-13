import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  CheckboxGroup,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  useDisclosure,
} from '@heroui/react'
import { useCallback, useEffect, useState } from 'react'
import { Pencil, Percent, Plus, Search, Trash2 } from 'lucide-react'
import { api, mensajeError } from '../lib/api'
import { n, usd } from '../lib/format'
import { useTheme } from '../theme/ThemeContext'
import type { Categoria, Paginated, Producto, Promocion } from '../types'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function describir(p: Promocion): string {
  const sobre = p.producto?.nombre ?? (p.categoria ? `categoría ${p.categoria.nombre}` : 'toda la tienda')
  if (p.tipo === 'porcentaje') return `${n(p.valor)} % en ${sobre}${n(p.cantidad_minima) > 1 ? ` (desde ${n(p.cantidad_minima)})` : ''}`
  if (p.tipo === 'nxm') return `Lleva ${p.lleva} paga ${p.paga}: ${sobre}`
  return `${usd(p.valor)} c/u desde ${n(p.cantidad_minima)}: ${sobre}`
}

/** Promociones automáticas: el POS las aplica solo y el servidor las recalcula. */
export function PromocionesPage() {
  const { panel } = useTheme()
  const [promos, setPromos] = useState<Promocion[]>([])
  const [editando, setEditando] = useState<Partial<Promocion> | null>(null)
  const modal = useDisclosure()

  const cargar = useCallback(() => {
    api.get<Promocion[]>('/promociones').then((r) => setPromos(r.data))
  }, [])
  useEffect(cargar, [cargar])

  async function eliminar(p: Promocion) {
    if (!confirm(`¿Eliminar la promoción "${p.nombre}"?`)) return
    await api.delete(`/promociones/${p.id}`)
    cargar()
  }

  const hoy = new Date().toISOString().slice(0, 10)
  const vigente = (p: Promocion) => p.activo && (!p.desde || p.desde <= hoy) && (!p.hasta || p.hasta >= hoy)

  return (
    <Card className={panel}>
      <CardHeader className="flex-wrap justify-between gap-2">
        <div className="flex items-center gap-2">
          <Percent className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">Promociones</h2>
        </div>
        <Button color="primary" startContent={<Plus className="h-4 w-4" />} onPress={() => { setEditando({ tipo: 'porcentaje', activo: true, cantidad_minima: '1' }); modal.onOpen() }}>
          Nueva promoción
        </Button>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <Table aria-label="Promociones" removeWrapper className="min-w-[620px]">
          <TableHeader>
            <TableColumn>PROMOCIÓN</TableColumn>
            <TableColumn>REGLA</TableColumn>
            <TableColumn>VIGENCIA</TableColumn>
            <TableColumn>ESTADO</TableColumn>
            <TableColumn className="text-right"> </TableColumn>
          </TableHeader>
          <TableBody emptyContent="Sin promociones. Crea un 2x1, un descuento por categoría o un precio al mayor.">
            {promos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nombre}</TableCell>
                <TableCell>{describir(p)}</TableCell>
                <TableCell className="text-small">
                  {p.desde || p.hasta ? `${p.desde ?? '…'} → ${p.hasta ?? '…'}` : 'siempre'}
                  {p.dias_semana?.length ? <span className="text-default-400"> · {p.dias_semana.map((d) => DIAS[d]).join(', ')}</span> : null}
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={vigente(p) ? 'success' : 'default'}>{vigente(p) ? 'vigente' : p.activo ? 'fuera de fecha' : 'pausada'}</Chip>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button isIconOnly size="sm" variant="flat" aria-label="Editar" onPress={() => { setEditando(p); modal.onOpen() }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Eliminar" onPress={() => eliminar(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
      <PromocionModal isOpen={modal.isOpen} onOpenChange={modal.onOpenChange} inicial={editando} onGuardada={cargar} />
    </Card>
  )
}

function PromocionModal({ isOpen, onOpenChange, inicial, onGuardada }: { isOpen: boolean; onOpenChange: (o: boolean) => void; inicial: Partial<Promocion> | null; onGuardada: () => void }) {
  const [f, setF] = useState<Partial<Promocion>>({})
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [buscar, setBuscar] = useState('')
  const [productos, setProductos] = useState<Producto[]>([])
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setF(inicial ?? {})
    setBuscar(inicial?.producto?.nombre ?? '')
    setError('')
    api.get<Categoria[]>('/categorias').then((r) => setCategorias(r.data))
  }, [isOpen, inicial])

  useEffect(() => {
    if (buscar.trim().length < 2 || buscar === f.producto?.nombre) {
      setProductos([])
      return
    }
    const t = setTimeout(() => api.get<Paginated<Producto>>('/productos', { params: { buscar, per_page: 6 } }).then((r) => setProductos(r.data.data)), 250)
    return () => clearTimeout(t)
  }, [buscar, f.producto?.nombre])

  const necesitaProducto = f.tipo === 'nxm' || f.tipo === 'precio_cantidad'

  async function guardar(onClose: () => void) {
    setGuardando(true)
    setError('')
    try {
      const datos = {
        nombre: f.nombre,
        tipo: f.tipo,
        producto_id: f.producto_id ?? null,
        categoria_id: necesitaProducto ? null : f.categoria_id ?? null,
        valor: f.tipo === 'nxm' ? 0 : n(f.valor ?? 0),
        lleva: f.tipo === 'nxm' ? Number(f.lleva) : null,
        paga: f.tipo === 'nxm' ? Number(f.paga) : null,
        cantidad_minima: n(f.cantidad_minima ?? 1) || 1,
        desde: f.desde || null,
        hasta: f.hasta || null,
        dias_semana: f.dias_semana?.length ? f.dias_semana : null,
        activo: f.activo ?? true,
      }
      if (f.id) await api.put(`/promociones/${f.id}`, datos)
      else await api.post('/promociones', datos)
      onGuardada()
      onClose()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg" scrollBehavior="inside" placement="center">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="font-display">{f.id ? 'Editar promoción' : 'Nueva promoción'}</ModalHeader>
            <ModalBody className="gap-3">
              <Input label="Nombre" variant="bordered" placeholder="Ej. 3x2 en galletas" value={f.nombre ?? ''} onValueChange={(v) => setF((x) => ({ ...x, nombre: v }))} />
              <Select label="Tipo" variant="bordered" selectedKeys={[f.tipo ?? 'porcentaje']} onChange={(e) => e.target.value && setF((x) => ({ ...x, tipo: e.target.value as Promocion['tipo'] }))}>
                <SelectItem key="porcentaje">Descuento en %</SelectItem>
                <SelectItem key="nxm">Lleva N, paga M (2x1, 3x2…)</SelectItem>
                <SelectItem key="precio_cantidad">Precio especial por cantidad (al mayor)</SelectItem>
              </Select>

              <div className="relative">
                <Input
                  label={necesitaProducto ? 'Producto' : 'Producto (opcional)'}
                  variant="bordered"
                  value={buscar}
                  onValueChange={(v) => { setBuscar(v); if (!v) setF((x) => ({ ...x, producto_id: null, producto: null })) }}
                  startContent={<Search className="h-4 w-4 text-default-400" />}
                  isClearable
                  onClear={() => { setBuscar(''); setF((x) => ({ ...x, producto_id: null, producto: null })) }}
                />
                {productos.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-large border border-default-200 bg-content1 p-1 shadow-lg">
                    {productos.map((p) => (
                      <button key={p.id} className="flex w-full justify-between rounded-medium px-3 py-2 text-left text-small hover:bg-default-100" onClick={() => { setF((x) => ({ ...x, producto_id: p.id, producto: { id: p.id, nombre: p.nombre } })); setBuscar(p.nombre); setProductos([]) }}>
                        <span>{p.nombre}</span>
                        <span className="text-default-500">{usd(p.precio_venta_usd)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!necesitaProducto && !f.producto_id && (
                <Select label="…o una categoría (vacío = toda la tienda)" variant="bordered" selectedKeys={f.categoria_id ? [String(f.categoria_id)] : []} onChange={(e) => setF((x) => ({ ...x, categoria_id: e.target.value ? Number(e.target.value) : null }))}>
                  {categorias.map((c) => <SelectItem key={String(c.id)}>{c.nombre}</SelectItem>)}
                </Select>
              )}

              {f.tipo === 'nxm' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Lleva" type="number" min="2" variant="bordered" value={String(f.lleva ?? '')} onValueChange={(v) => setF((x) => ({ ...x, lleva: Number(v) }))} />
                  <Input label="Paga" type="number" min="0" variant="bordered" value={String(f.paga ?? '')} onValueChange={(v) => setF((x) => ({ ...x, paga: Number(v) }))} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={f.tipo === 'porcentaje' ? 'Descuento (%)' : 'Precio especial (USD c/u)'}
                    inputMode="decimal"
                    variant="bordered"
                    value={String(f.valor ?? '')}
                    onValueChange={(v) => setF((x) => ({ ...x, valor: v }))}
                  />
                  <Input label="Desde cuántas unidades" inputMode="decimal" variant="bordered" value={String(f.cantidad_minima ?? '1')} onValueChange={(v) => setF((x) => ({ ...x, cantidad_minima: v }))} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input label="Desde" type="date" variant="bordered" value={f.desde ?? ''} onValueChange={(v) => setF((x) => ({ ...x, desde: v }))} />
                <Input label="Hasta" type="date" variant="bordered" value={f.hasta ?? ''} onValueChange={(v) => setF((x) => ({ ...x, hasta: v }))} />
              </div>
              <CheckboxGroup label="Solo estos días (vacío = todos)" orientation="horizontal" value={(f.dias_semana ?? []).map(String)} onValueChange={(v) => setF((x) => ({ ...x, dias_semana: v.map(Number) }))}>
                {DIAS.map((d, i) => <Checkbox key={d} value={String(i)}>{d}</Checkbox>)}
              </CheckboxGroup>
              <Switch isSelected={f.activo ?? true} onValueChange={(v) => setF((x) => ({ ...x, activo: v }))}>Activa</Switch>
              {error && <p className="text-small text-danger">{error}</p>}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>Cancelar</Button>
              <Button color="primary" isLoading={guardando} isDisabled={!f.nombre || (necesitaProducto && !f.producto_id)} onPress={() => guardar(onClose)}>Guardar</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
