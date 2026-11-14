import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { api, mensajeError } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { usd } from '../lib/format'
import type { FilaImport, ImportResult, TipoIva } from '../types'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Se llama tras importar con éxito, para recargar el inventario. */
  onImported: () => void
}

// Reconoce el encabezado de una columna aunque no use el nombre exacto de la
// plantilla ("Precio $", "Existencia", "Código de barras", "Descripción"…).
// El orden importa: "precio de costo" es costo y "código de barras" no es el SKU.
const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9$]+/g, ' ')
    .trim()

function campoDeEncabezado(encabezado: string): keyof FilaImport | null {
  const h = normalizar(encabezado)
  if (!h) return null
  const tiene = (...p: string[]) => p.some((x) => h.includes(x))
  if (tiene('barra', 'ean', 'upc')) return 'codigo_barra'
  if (tiene('minim', 'reorden')) return 'stock_minimo'
  if (tiene('costo', 'compra')) return 'precio_costo_usd'
  // Un precio en bolívares no se importa: en Boxy el precio es en dólares y el Bs se calcula.
  if (tiene('precio', 'pvp', 'venta', 'usd', 'dolar', '$') && !/\b(bs|ves|bolivar)/.test(h)) return 'precio_venta_usd'
  if (tiene('iva', 'impuesto', 'alicuota')) return 'tipo_iva'
  if (tiene('stock', 'existencia', 'cantidad', 'inventario', 'disponible') || h === 'cant') return 'stock_inicial'
  if (tiene('categ', 'departamento', 'rubro', 'familia', 'linea', 'grupo')) return 'categoria'
  if (tiene('unidad', 'medida') || h === 'um') return 'unidad'
  if (tiene('sku', 'codigo', 'referencia') || ['cod', 'ref', 'item', 'id'].includes(h)) return 'sku'
  if (tiene('nombre', 'producto', 'descripcion', 'articulo', 'detalle')) return 'nombre'
  return null
}

/** Número de una celda: acepta "1,10", "1.234,56", "$ 12.90", "1,234.56". */
function leerNumero(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  let t = String(v ?? '').replace(/[^\d.,-]/g, '')
  if (!t) return undefined
  const coma = t.lastIndexOf(','), punto = t.lastIndexOf('.')
  if (coma > -1 && punto > -1) {
    // El separador que va de último es el decimal; el otro es de miles.
    t = coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  } else if (coma > -1) {
    t = t.replace(',', '.')
  }
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

/** Tamaño de cada envío al servidor (el servidor acepta hasta 500 filas por petición). */
const LOTE = 500

function parseTipoIva(v: unknown): TipoIva | undefined {
  const s = String(v ?? '').toLowerCase()
  if (!s) return undefined
  if (s.includes('exent') || s === '0') return 'exento'
  if (s.includes('reduc') || s === '8') return 'reducido'
  return 'general'
}

export function ImportarProductosModal({ isOpen, onOpenChange, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const limite = useAuth().empresa?.plan?.limites.productos
  const [archivo, setArchivo] = useState('')
  const [filas, setFilas] = useState<FilaImport[]>([])
  const [errores, setErrores] = useState<string[]>([])
  const [resultado, setResultado] = useState<ImportResult | null>(null)
  const [importando, setImportando] = useState(false)

  function reset() {
    setArchivo('')
    setFilas([])
    setErrores([])
    setResultado(null)
  }

  /** Plantilla descargable con las columnas esperadas y una fila de ejemplo. */
  function descargarPlantilla() {
    const ws = XLSX.utils.json_to_sheet([
      {
        sku: 'BEBIDAS-10',
        nombre: 'Malta 1.5L',
        categoria: 'Bebidas',
        precio_venta_usd: 1.5,
        precio_costo_usd: 0.95,
        tipo_iva: 'general',
        codigo_barra: '7591234567890',
        unidad: 'UND',
        stock_inicial: 50,
        stock_minimo: 10,
      },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Productos')
    XLSX.writeFile(wb, 'plantilla_productos_boxy.xlsx')
  }

  async function leerArchivo(file: File) {
    setResultado(null)
    setErrores([])
    setArchivo(file.name)

    let tabla: unknown[][]
    try {
      const wb = XLSX.read(await file.arrayBuffer())
      tabla = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', blankrows: false })
    } catch {
      setFilas([])
      setErrores(['No se pudo leer el archivo. Guárdalo como Excel (.xlsx) o CSV y vuelve a intentar.'])
      return
    }

    // El encabezado puede no estar en la primera fila (títulos, logo, fecha…):
    // se toma la primera fila, de las 15 primeras, que tenga nombre y precio.
    let filaEncabezado = -1
    let columnas: (keyof FilaImport | null)[] = []
    for (let i = 0; i < Math.min(15, tabla.length); i++) {
      const cols = tabla[i].map((c) => campoDeEncabezado(String(c ?? '')))
      if (cols.includes('nombre') && cols.includes('precio_venta_usd')) {
        filaEncabezado = i
        // Si dos columnas caen en el mismo campo, vale la primera.
        columnas = cols.map((c, j) => (c && cols.indexOf(c) === j ? c : null))
        break
      }
    }
    if (filaEncabezado < 0) {
      setFilas([])
      setErrores([
        'No encontré las columnas de nombre y precio. Tu hoja necesita al menos una columna con el nombre del producto (ej. "Producto" o "Descripción") y otra con el precio en dólares (ej. "Precio" o "Precio $").',
      ])
      return
    }

    const parsed: FilaImport[] = []
    const errs: string[] = []
    for (let i = filaEncabezado + 1; i < tabla.length; i++) {
      const fila: Partial<FilaImport> = {}
      tabla[i].forEach((v, j) => {
        const campo = columnas[j]
        if (!campo || v === '' || v == null) return
        if (campo === 'tipo_iva') fila.tipo_iva = parseTipoIva(v)
        else if (campo === 'precio_venta_usd' || campo === 'precio_costo_usd' || campo === 'stock_inicial' || campo === 'stock_minimo') {
          const num = leerNumero(v)
          if (num !== undefined) fila[campo] = Math.max(0, num)
        } else fila[campo] = String(v).trim()
      })
      if (!fila.nombre && fila.precio_venta_usd === undefined) continue // fila vacía o de totales
      if (!fila.nombre || fila.precio_venta_usd === undefined) {
        errs.push(`Fila ${i + 1}: le falta ${!fila.nombre ? 'el nombre' : 'el precio'}; se omite.`)
        continue
      }
      parsed.push(fila as FilaImport)
    }

    setFilas(parsed)
    setErrores(errs)
  }

  async function importar() {
    setImportando(true)
    const total: ImportResult = { creados: 0, actualizados: 0, errores: [] }
    try {
      for (let desde = 0; desde < filas.length; desde += LOTE) {
        const res = await api.post<ImportResult>('/productos/importar', { productos: filas.slice(desde, desde + LOTE) })
        total.creados += res.data.creados
        total.actualizados += res.data.actualizados
        total.errores.push(...res.data.errores.map((e) => ({ ...e, fila: e.fila + desde })))
      }
    } catch (e) {
      setErrores((x) => [...x, mensajeError(e, 'No se pudo completar la importación.')])
    } finally {
      setResultado(total.creados + total.actualizados + total.errores.length > 0 ? total : null)
      if (total.creados + total.actualizados > 0) onImported()
      setImportando(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
      size="3xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2 font-display">
              <FileSpreadsheet className="h-5 w-5 text-success" />
              Importar productos desde Excel
            </ModalHeader>
            <ModalBody className="gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) leerArchivo(f)
                    e.target.value = ''
                  }}
                />
                <Button
                  color="primary"
                  startContent={<Upload className="h-4 w-4" />}
                  onPress={() => fileRef.current?.click()}
                >
                  Elegir archivo
                </Button>
                <Button
                  variant="flat"
                  startContent={<Download className="h-4 w-4" />}
                  onPress={descargarPlantilla}
                >
                  Descargar plantilla
                </Button>
                {archivo && <Chip variant="flat">{archivo}</Chip>}
              </div>

              <p className="text-tiny text-default-400">
                Sube tu Excel o CSV tal como lo tienes. Solo hacen falta una columna con el <b>nombre</b> del producto y otra
                con el <b>precio en dólares</b>. Boxy también reconoce costo, existencia, mínimo, categoría, IVA, código de
                barras y unidad. Si un producto ya existe (mismo código, código de barras o nombre), se actualiza.
              </p>
              {limite?.maximo != null && (
                <p className="text-tiny text-default-500">
                  Tu plan permite {limite.maximo} productos activos; tienes {limite.uso}. Puedes agregar{' '}
                  {Math.max(0, limite.maximo - limite.uso)} más.
                </p>
              )}

              {errores.length > 0 && (
                <div className="rounded-large bg-warning-50 p-3">
                  {errores.map((e, i) => (
                    <p key={i} className="text-tiny text-warning-700">
                      {e}
                    </p>
                  ))}
                </div>
              )}

              {filas.length > 0 && !resultado && (
                <Table aria-label="Preview" removeWrapper isCompact>
                  <TableHeader>
                    <TableColumn>SKU</TableColumn>
                    <TableColumn>NOMBRE</TableColumn>
                    <TableColumn>CATEGORÍA</TableColumn>
                    <TableColumn>PRECIO</TableColumn>
                    <TableColumn>COSTO</TableColumn>
                    <TableColumn>IVA</TableColumn>
                    <TableColumn>STOCK</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {filas.slice(0, 50).map((f, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-tiny">{f.sku ?? f.codigo_barra ?? 'automático'}</TableCell>
                        <TableCell>{f.nombre}</TableCell>
                        <TableCell>{f.categoria ?? '—'}</TableCell>
                        <TableCell>{usd(f.precio_venta_usd)}</TableCell>
                        <TableCell>{f.precio_costo_usd != null ? usd(f.precio_costo_usd) : '—'}</TableCell>
                        <TableCell>{f.tipo_iva ?? 'general'}</TableCell>
                        <TableCell>{f.stock_inicial ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {filas.length > 50 && !resultado && (
                <p className="text-tiny text-default-400">… y {filas.length - 50} filas más.</p>
              )}

              {resultado && (
                <div className="flex flex-col gap-2 rounded-large bg-success-50 p-4">
                  <p className="font-semibold text-success-700">
                    ✓ Importación lista: {resultado.creados} creados, {resultado.actualizados} actualizados.
                  </p>
                  {resultado.errores.map((e) => (
                    <p key={e.fila} className="text-tiny text-danger">
                      Fila {e.fila}: {e.error}
                    </p>
                  ))}
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                {resultado ? 'Cerrar' : 'Cancelar'}
              </Button>
              {!resultado && (
                <Button
                  color="primary"
                  isDisabled={filas.length === 0}
                  isLoading={importando}
                  onPress={importar}
                >
                  Importar {filas.length > 0 && `${filas.length} productos`}
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
