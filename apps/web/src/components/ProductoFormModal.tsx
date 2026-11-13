import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Switch,
  useDisclosure,
} from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import { Barcode, Camera, ImagePlus, Package, Sparkles } from 'lucide-react'
import { api, mensajeError } from '../lib/api'
import { n, usd } from '../lib/format'
import { ScannerModal } from './ScannerModal'
import type { Categoria, Inventario, TipoIva } from '../types'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Si viene, es edición; el inventario trae el producto + stock actual. */
  inv: Inventario | null
  onSaved: () => void
}

interface Form {
  nombre: string
  sku: string
  codigo_barra: string
  categoria: string
  tipo_iva: TipoIva
  unidad: string
  precio_costo_usd: string
  precio_venta_usd: string
  controla_stock: boolean
  pesable: boolean
  codigo_balanza: string
  stock_inicial: string
  stock_minimo: string
}

const vacio: Form = {
  nombre: '',
  sku: '',
  codigo_barra: '',
  categoria: '',
  tipo_iva: 'general',
  unidad: 'UND',
  precio_costo_usd: '',
  precio_venta_usd: '',
  controla_stock: true,
  pesable: false,
  codigo_balanza: '',
  stock_inicial: '',
  stock_minimo: '',
}

export function ProductoFormModal({ isOpen, onOpenChange, inv, onSaved }: Props) {
  const esEdicion = !!inv
  const [form, setForm] = useState<Form>(vacio)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const scanner = useDisclosure()

  // Foto del producto
  const fileRef = useRef<HTMLInputElement>(null)
  const [imagenFile, setImagenFile] = useState<File | null>(null)
  const [imagenPreview, setImagenPreview] = useState<string>('')

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setImagenFile(null)
    api.get<Categoria[]>('/categorias').then((r) => setCategorias(r.data)).catch(() => {})

    if (inv?.producto) {
      const p = inv.producto
      setImagenPreview(p.imagen_path ?? '')
      setForm({
        nombre: p.nombre,
        sku: p.sku,
        codigo_barra: p.codigo_barra ?? '',
        categoria: p.categoria?.nombre ?? '',
        tipo_iva: p.tipo_iva,
        unidad: p.unidad ?? 'UND',
        precio_costo_usd: String(p.precio_costo_usd ?? ''),
        precio_venta_usd: String(p.precio_venta_usd ?? ''),
        controla_stock: p.controla_stock,
        pesable: !!p.pesable,
        codigo_balanza: p.codigo_balanza ?? '',
        stock_inicial: String(n(inv.cantidad)),
        stock_minimo: String(n(inv.stock_minimo)),
      })
    } else {
      setImagenPreview('')
      setForm(vacio)
    }
  }, [isOpen, inv])

  function elegirImagen(file: File) {
    setImagenFile(file)
    setImagenPreview(URL.createObjectURL(file))
  }

  const costo = n(form.precio_costo_usd)
  const venta = n(form.precio_venta_usd)
  const margen = venta > 0 ? ((venta - costo) / venta) * 100 : 0
  const ganancia = venta - costo

  /** Resuelve la categoría escrita: usa la existente o crea una nueva. */
  async function resolverCategoriaId(): Promise<number | null> {
    const nombre = form.categoria.trim()
    if (!nombre) return null
    const existente = categorias.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase())
    if (existente) return existente.id
    const res = await api.post<Categoria>('/categorias', { nombre })
    return res.data.id
  }

  /** Genera un código interno a partir del SKU (para productos sin código de fábrica). */
  function generarCodigoInterno() {
    const base = (form.sku || form.nombre).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
    set('codigo_barra', base ? `INT-${base}` : `INT-${Date.now().toString().slice(-8)}`)
  }

  async function guardar(onClose: () => void) {
    if (!form.nombre.trim() || !form.sku.trim() || !form.precio_venta_usd) {
      setError('Nombre, SKU y precio de venta son obligatorios.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const categoria_id = await resolverCategoriaId()
      const payload = {
        nombre: form.nombre.trim(),
        sku: form.sku.trim(),
        codigo_barra: form.codigo_barra.trim() || null,
        categoria_id,
        tipo_iva: form.tipo_iva,
        unidad: form.unidad.trim() || 'UND',
        precio_costo_usd: costo,
        precio_venta_usd: venta,
        controla_stock: form.controla_stock,
        pesable: form.pesable,
        codigo_balanza: form.pesable && form.codigo_balanza.trim() ? form.codigo_balanza.trim() : null,
      }

      const producto = esEdicion
        ? (await api.put(`/productos/${inv!.producto!.id}`, payload)).data
        : (await api.post('/productos', payload)).data

      // Foto: se sube tras crear/editar (el endpoint necesita el id del producto)
      if (imagenFile) {
        const fd = new FormData()
        fd.append('imagen', imagenFile)
        await api.post(`/productos/${producto.id}/imagen`, fd)
      }

      // Stock: en alta fija cantidad inicial; en ambos casos puede fijar el mínimo.
      if (form.controla_stock) {
        const stockInicial = n(form.stock_inicial)
        const stockMinimo = n(form.stock_minimo)
        const stockActual = esEdicion ? n(inv!.cantidad) : 0
        const cambioStock = !esEdicion && stockInicial > 0
        const cambioMinimo = stockMinimo !== n(inv?.stock_minimo ?? 0)

        if (cambioStock || cambioMinimo) {
          await api.post('/inventario/movimiento', {
            producto_id: producto.id,
            tipo: 'ajuste',
            cantidad: cambioStock ? stockInicial : stockActual,
            stock_minimo: stockMinimo,
            observacion: esEdicion ? 'Edición de producto' : 'Alta de producto',
          })
        }
      }

      onSaved()
      onClose()
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar el producto.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="font-display">
              {esEdicion ? 'Editar producto' : 'Nuevo producto'}
            </ModalHeader>
            <ModalBody className="gap-4">
              {/* Foto del producto */}
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-large border border-default-200 bg-default-100">
                  {imagenPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imagenPreview} alt="producto" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-7 w-7 text-default-300" />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) elegirImagen(f)
                      e.target.value = ''
                    }}
                  />
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<ImagePlus className="h-4 w-4" />}
                    onPress={() => fileRef.current?.click()}
                  >
                    {imagenPreview ? 'Cambiar foto' : 'Subir / tomar foto'}
                  </Button>
                  <span className="text-tiny text-default-400">JPG/PNG/WEBP, máx 4 MB.</span>
                </div>
              </div>

              <Input
                label="Nombre del producto"
                variant="bordered"
                value={form.nombre}
                onValueChange={(v) => set('nombre', v)}
                isRequired
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="SKU (código interno)"
                  variant="bordered"
                  value={form.sku}
                  onValueChange={(v) => set('sku', v)}
                  isRequired
                />
                <Input
                  label="Unidad"
                  variant="bordered"
                  value={form.unidad}
                  onValueChange={(v) => set('unidad', v)}
                  placeholder="UND, KG, LT…"
                />
              </div>

              {/* Código de barras: escribir, escanear con cámara o generar interno */}
              <div className="flex items-end gap-2">
                <Input
                  label="Código de barras"
                  variant="bordered"
                  value={form.codigo_barra}
                  onValueChange={(v) => set('codigo_barra', v)}
                  startContent={<Barcode className="h-4 w-4 text-default-400" />}
                  description="Escanéalo, escríbelo o genera uno interno para productos sin código."
                />
                <Button isIconOnly variant="flat" size="lg" aria-label="Escanear código" onPress={scanner.onOpen}>
                  <Camera className="h-5 w-5" />
                </Button>
                <Button variant="flat" size="lg" startContent={<Sparkles className="h-4 w-4" />} onPress={generarCodigoInterno}>
                  Interno
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Autocomplete
                  label="Categoría"
                  variant="bordered"
                  allowsCustomValue
                  inputValue={form.categoria}
                  onInputChange={(v) => set('categoria', v)}
                  description="Elige una o escribe para crear."
                >
                  {categorias.map((c) => (
                    <AutocompleteItem key={String(c.id)}>{c.nombre}</AutocompleteItem>
                  ))}
                </Autocomplete>
                <Select
                  label="IVA"
                  variant="bordered"
                  selectedKeys={[form.tipo_iva]}
                  onChange={(e) => e.target.value && set('tipo_iva', e.target.value as TipoIva)}
                >
                  <SelectItem key="general">General 16%</SelectItem>
                  <SelectItem key="reducido">Reducido 8%</SelectItem>
                  <SelectItem key="exento">Exento 0%</SelectItem>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Precio costo (USD)"
                  type="number"
                  variant="bordered"
                  value={form.precio_costo_usd}
                  onValueChange={(v) => set('precio_costo_usd', v)}
                  startContent={<span className="text-tiny text-default-400">$</span>}
                />
                <Input
                  label="Precio venta (USD)"
                  type="number"
                  variant="bordered"
                  value={form.precio_venta_usd}
                  onValueChange={(v) => set('precio_venta_usd', v)}
                  startContent={<span className="text-tiny text-default-400">$</span>}
                  isRequired
                />
              </div>

              {/* Margen en vivo */}
              {venta > 0 && (
                <div className="flex items-center gap-3 rounded-large bg-default-50 px-3 py-2">
                  <Chip
                    variant="flat"
                    color={margen >= 30 ? 'success' : margen >= 15 ? 'warning' : 'danger'}
                  >
                    Margen {margen.toFixed(1)}%
                  </Chip>
                  <span className="text-small text-default-500">
                    Ganancia por {form.unidad}: <b>{usd(ganancia)}</b>
                  </span>
                </div>
              )}

              <Divider />

              <Switch isSelected={form.controla_stock} onValueChange={(v) => set('controla_stock', v)}>
                <span className="text-small">Controla inventario (stock)</span>
              </Switch>

              <div className="flex flex-wrap items-center gap-3">
                <Switch
                  isSelected={form.pesable}
                  onValueChange={(v) => setForm((f) => ({ ...f, pesable: v, unidad: v && f.unidad === 'UND' ? 'KG' : f.unidad }))}
                >
                  <span className="text-small">Se vende por peso (charcutería, verduras…)</span>
                </Switch>
                {form.pesable && (
                  <Input
                    size="sm"
                    className="max-w-[200px]"
                    label="PLU de la balanza"
                    variant="bordered"
                    inputMode="numeric"
                    value={form.codigo_balanza}
                    onValueChange={(v) => set('codigo_balanza', v.replace(/\D/g, '').slice(0, 6))}
                    description="El código del producto en la balanza etiquetadora."
                  />
                )}
              </div>

              {form.controla_stock && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={esEdicion ? 'Stock actual' : 'Stock inicial'}
                    type="number"
                    variant="bordered"
                    value={form.stock_inicial}
                    onValueChange={(v) => set('stock_inicial', v)}
                    isReadOnly={esEdicion}
                    description={esEdicion ? 'Usa "Movimiento" para cambiarlo' : undefined}
                  />
                  <Input
                    label="Stock mínimo (alerta)"
                    type="number"
                    variant="bordered"
                    value={form.stock_minimo}
                    onValueChange={(v) => set('stock_minimo', v)}
                  />
                </div>
              )}

              {error && <p className="text-small text-danger">{error}</p>}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancelar
              </Button>
              <Button color="primary" isLoading={guardando} onPress={() => guardar(onClose)}>
                {esEdicion ? 'Guardar cambios' : 'Crear producto'}
              </Button>
            </ModalFooter>

            {/* Escanear para llenar el código */}
            <ScannerModal
              isOpen={scanner.isOpen}
              onOpenChange={scanner.onOpenChange}
              onScan={(codigo) => {
                set('codigo_barra', codigo)
                scanner.onClose()
              }}
            />
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
