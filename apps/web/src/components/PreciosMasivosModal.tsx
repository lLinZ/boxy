import { Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from '@heroui/react'
import { useEffect, useState } from 'react'
import { api, mensajeError } from '../lib/api'
import { usd } from '../lib/format'
import type { CambioPrecio, Categoria } from '../types'

interface Props {
  isOpen: boolean
  onOpenChange: (o: boolean) => void
  onAplicado: () => void
}

/**
 * Cambio masivo de precios: sube/baja un %, fija un margen sobre el costo o
 * suma un monto fijo, para todo el catálogo o una categoría. Siempre muestra la
 * vista previa antes de aplicar y deja historial de cada cambio.
 */
export function PreciosMasivosModal({ isOpen, onOpenChange, onAplicado }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [alcance, setAlcance] = useState<'todos' | 'categoria'>('todos')
  const [categoriaId, setCategoriaId] = useState('')
  const [operacion, setOperacion] = useState<'porcentaje' | 'margen' | 'fijo'>('porcentaje')
  const [valor, setValor] = useState('')
  const [redondeo, setRedondeo] = useState('0.05')
  const [cambios, setCambios] = useState<CambioPrecio[] | null>(null)
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    if (isOpen) {
      api.get<Categoria[]>('/categorias').then((r) => setCategorias(r.data))
      setCambios(null)
      setError('')
    }
  }, [isOpen])

  const cuerpo = (aplicar: boolean) => ({
    alcance,
    categoria_id: alcance === 'categoria' ? Number(categoriaId) : undefined,
    operacion,
    valor: Number(valor.replace(',', '.')),
    redondeo,
    aplicar,
  })

  async function previsualizar() {
    setTrabajando(true)
    setError('')
    try {
      const r = await api.post<{ cambios: CambioPrecio[] }>('/productos/precios-masivos', cuerpo(false))
      setCambios(r.data.cambios)
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setTrabajando(false)
    }
  }

  async function aplicar(onClose: () => void) {
    setTrabajando(true)
    try {
      await api.post('/productos/precios-masivos', cuerpo(true))
      onAplicado()
      onClose()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setTrabajando(false)
    }
  }

  const bajoCosto = cambios?.filter((c) => c.bajo_costo).length ?? 0

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="font-display">Cambio masivo de precios</ModalHeader>
            <ModalBody className="gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Select label="A qué productos" variant="bordered" selectedKeys={[alcance]} onChange={(e) => { if (e.target.value) setAlcance(e.target.value as 'todos' | 'categoria'); setCambios(null) }}>
                  <SelectItem key="todos">Todo el catálogo</SelectItem>
                  <SelectItem key="categoria">Una categoría</SelectItem>
                </Select>
                {alcance === 'categoria' && (
                  <Select label="Categoría" variant="bordered" selectedKeys={categoriaId ? [categoriaId] : []} onChange={(e) => { setCategoriaId(e.target.value); setCambios(null) }}>
                    {categorias.map((c) => <SelectItem key={String(c.id)}>{c.nombre}</SelectItem>)}
                  </Select>
                )}
                <Select label="Operación" variant="bordered" selectedKeys={[operacion]} onChange={(e) => { if (e.target.value) setOperacion(e.target.value as typeof operacion); setCambios(null) }}>
                  <SelectItem key="porcentaje">Subir o bajar un %</SelectItem>
                  <SelectItem key="margen">Fijar margen sobre el costo</SelectItem>
                  <SelectItem key="fijo">Sumar o restar USD</SelectItem>
                </Select>
                <Input
                  label={operacion === 'porcentaje' ? '% (negativo baja)' : operacion === 'margen' ? 'Margen deseado %' : 'USD (negativo resta)'}
                  variant="bordered"
                  inputMode="decimal"
                  value={valor}
                  onValueChange={(v) => { setValor(v); setCambios(null) }}
                />
                <Select label="Redondear hacia arriba a" variant="bordered" selectedKeys={[redondeo]} onChange={(e) => { if (e.target.value) setRedondeo(e.target.value); setCambios(null) }}>
                  <SelectItem key="0">Sin redondeo</SelectItem>
                  <SelectItem key="0.05">$0,05</SelectItem>
                  <SelectItem key="0.1">$0,10</SelectItem>
                  <SelectItem key="0.5">$0,50</SelectItem>
                  <SelectItem key="1">$1</SelectItem>
                </Select>
              </div>

              {cambios && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Chip variant="flat" color="primary">{cambios.length} productos cambian</Chip>
                    {bajoCosto > 0 && <Chip variant="flat" color="danger">{bajoCosto} quedarían por debajo del costo</Chip>}
                  </div>
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full min-w-[520px] text-small">
                      <thead className="sticky top-0 bg-content1">
                        <tr className="text-left text-tiny uppercase text-default-400">
                          <th className="py-1">Producto</th>
                          <th className="py-1 text-right">Costo</th>
                          <th className="py-1 text-right">Actual</th>
                          <th className="py-1 text-right">Nuevo</th>
                          <th className="py-1 text-right">Margen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cambios.map((c) => (
                          <tr key={c.id} className={`border-t border-default-100 ${c.bajo_costo ? 'text-danger' : ''}`}>
                            <td className="py-1">{c.nombre}</td>
                            <td className="py-1 text-right">{usd(c.costo_usd)}</td>
                            <td className="py-1 text-right">{usd(c.precio_actual_usd)}</td>
                            <td className="py-1 text-right font-semibold">{usd(c.precio_nuevo_usd)}</td>
                            <td className="py-1 text-right">{c.margen_nuevo_pct} %</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {error && <p className="text-small text-danger">{error}</p>}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>Cancelar</Button>
              <Button variant="flat" isLoading={trabajando && !cambios} isDisabled={!valor || (alcance === 'categoria' && !categoriaId)} onPress={previsualizar}>
                Ver cambios
              </Button>
              <Button color="primary" isLoading={trabajando && !!cambios} isDisabled={!cambios || cambios.length === 0} onPress={() => aplicar(onClose)}>
                Aplicar {cambios ? `(${cambios.length})` : ''}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
