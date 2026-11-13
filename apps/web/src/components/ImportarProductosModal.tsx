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
import { api } from '../lib/api'
import { usd } from '../lib/format'
import type { FilaImport, ImportResult, TipoIva } from '../types'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Se llama tras importar con éxito, para recargar el inventario. */
  onImported: () => void
}

// Mapeo flexible de encabezados del Excel → campo interno.
const HEADER_MAP: Record<string, keyof FilaImport> = {
  sku: 'sku',
  codigo: 'sku',
  nombre: 'nombre',
  producto: 'nombre',
  descripcion: 'nombre',
  precio: 'precio_venta_usd',
  precio_venta: 'precio_venta_usd',
  precio_venta_usd: 'precio_venta_usd',
  pvp: 'precio_venta_usd',
  costo: 'precio_costo_usd',
  precio_costo: 'precio_costo_usd',
  precio_costo_usd: 'precio_costo_usd',
  iva: 'tipo_iva',
  tipo_iva: 'tipo_iva',
  categoria: 'categoria',
  codigo_barra: 'codigo_barra',
  codigo_de_barras: 'codigo_barra',
  barra: 'codigo_barra',
  ean: 'codigo_barra',
  unidad: 'unidad',
  stock: 'stock_inicial',
  stock_inicial: 'stock_inicial',
  existencia: 'stock_inicial',
  stock_minimo: 'stock_minimo',
  minimo: 'stock_minimo',
}

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s.-]+/g, '_')

function parseTipoIva(v: unknown): TipoIva | undefined {
  const s = String(v ?? '').toLowerCase()
  if (!s) return undefined
  if (s.includes('exent') || s === '0') return 'exento'
  if (s.includes('reduc') || s === '8') return 'reducido'
  return 'general'
}

export function ImportarProductosModal({ isOpen, onOpenChange, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
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

    const data = await file.arrayBuffer()
    const wb = XLSX.read(data)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const crudo = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

    const parsed: FilaImport[] = []
    const errs: string[] = []

    crudo.forEach((row, i) => {
      const fila: Partial<FilaImport> = {}
      for (const [k, v] of Object.entries(row)) {
        const campo = HEADER_MAP[normalizar(k)]
        if (!campo || v === '') continue
        if (campo === 'tipo_iva') fila.tipo_iva = parseTipoIva(v)
        else if (
          campo === 'precio_venta_usd' ||
          campo === 'precio_costo_usd' ||
          campo === 'stock_inicial' ||
          campo === 'stock_minimo'
        ) {
          const num = Number(String(v).replace(',', '.'))
          if (!Number.isNaN(num)) fila[campo] = num
        } else fila[campo] = String(v).trim()
      }

      if (!fila.sku || !fila.nombre || fila.precio_venta_usd === undefined) {
        errs.push(`Fila ${i + 2}: faltan sku, nombre o precio_venta_usd — se omite.`)
        return
      }
      parsed.push(fila as FilaImport)
    })

    setFilas(parsed)
    setErrores(errs)
  }

  async function importar() {
    setImportando(true)
    try {
      const res = await api.post<ImportResult>('/productos/importar', { productos: filas })
      setResultado(res.data)
      if (res.data.creados + res.data.actualizados > 0) onImported()
    } catch {
      setErrores((e) => [...e, 'Error del servidor al importar.'])
    } finally {
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
                Columnas: <b>sku, nombre, precio_venta_usd</b> (obligatorias) · categoria,
                precio_costo_usd, tipo_iva (general/reducido/exento), codigo_barra, unidad,
                stock_inicial, stock_minimo. Si el SKU ya existe, el producto se actualiza.
              </p>

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
                        <TableCell className="font-mono text-tiny">{f.sku}</TableCell>
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
