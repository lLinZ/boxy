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
import { useNavigate } from 'react-router-dom'
import { Eye, Lock, Printer, ShoppingCart, Wallet } from 'lucide-react'
import { api, mensajeError } from '../lib/api'
import { bs, fecha, n, usd } from '../lib/format'
import { imprimirTicket, nombreMetodo, ticketCierre } from '../lib/ticket'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import type { Paginated, ResumenCaja, TurnoCaja } from '../types'

/**
 * Turnos de caja. El cajero ve su turno abierto (corte X) y lo cierra
 * contando el efectivo sin ver lo esperado; al cerrar, Boxy muestra la
 * diferencia y el reporte de cierre (Z) para imprimir. El supervisor ve todo.
 */
export function CajaPage() {
  const { panel } = useTheme()
  const { puede, empresa } = useAuth()
  const navigate = useNavigate()
  const [actual, setActual] = useState<{ turno: TurnoCaja | null; resumen: ResumenCaja | null } | null>(null)
  const [turnos, setTurnos] = useState<TurnoCaja[]>([])
  const [detalle, setDetalle] = useState<{ turno: TurnoCaja; resumen: ResumenCaja } | null>(null)
  // El turno que se está cerrando se guarda aparte: al recargar, "actual" queda sin turno
  const [turnoCierre, setTurnoCierre] = useState<TurnoCaja | null>(null)
  const detalleModal = useDisclosure()
  const cierreModal = useDisclosure()
  const supervisa = puede('caja.supervisar')
  const negocio = empresa ? { empresa: empresa.empresa, ajustes: empresa.ajustes } : null

  const cargar = useCallback(() => {
    api.get('/caja/actual').then((r) => setActual(r.data)).catch(() => setActual({ turno: null, resumen: null }))
    api.get<Paginated<TurnoCaja>>('/caja/turnos', { params: { per_page: 30 } }).then((r) => setTurnos(r.data.data)).catch(() => {})
  }, [])

  useEffect(cargar, [cargar])

  async function verTurno(t: TurnoCaja) {
    const r = await api.get<{ turno: TurnoCaja; resumen: ResumenCaja }>(`/caja/turnos/${t.id}`)
    setDetalle(r.data)
    detalleModal.onOpen()
  }

  const imprimir = (resumen: ResumenCaja) => negocio && imprimirTicket(ticketCierre(resumen, negocio), negocio.ajustes.ticket_ancho)

  if (!actual) {
    return (
      <div className="flex justify-center py-20">
        <Spinner label="Cargando caja…" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Turno actual */}
      <Card className={panel}>
        <CardHeader className="flex-wrap justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Mi caja</h2>
            {actual.turno ? <Chip color="success" variant="flat" size="sm">Abierta</Chip> : <Chip variant="flat" size="sm">Cerrada</Chip>}
          </div>
          {actual.turno && actual.resumen && (
            <div className="flex flex-wrap gap-2">
              <Button variant="flat" startContent={<Printer className="h-4 w-4" />} onPress={() => imprimir(actual.resumen!)}>
                Corte X
              </Button>
              <Button color="danger" startContent={<Lock className="h-4 w-4" />} onPress={() => { setTurnoCierre(actual.turno); cierreModal.onOpen() }}>
                Cerrar caja
              </Button>
            </div>
          )}
        </CardHeader>
        <CardBody>
          {!actual.turno || !actual.resumen ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-default-500">No tienes una caja abierta.</p>
              <Button color="primary" startContent={<ShoppingCart className="h-4 w-4" />} onPress={() => navigate('/pos')}>
                Ir al POS para abrirla
              </Button>
            </div>
          ) : (
            <ResumenVista resumen={actual.resumen} />
          )}
        </CardBody>
      </Card>

      {/* Historial */}
      <Card className={panel}>
        <CardHeader>
          <h2 className="font-display text-lg font-bold">{supervisa ? 'Turnos de la tienda' : 'Mis turnos'}</h2>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <Table aria-label="Turnos" removeWrapper className="min-w-[640px]">
            <TableHeader>
              <TableColumn>TURNO</TableColumn>
              <TableColumn>CAJERO</TableColumn>
              <TableColumn>APERTURA</TableColumn>
              <TableColumn>CIERRE</TableColumn>
              <TableColumn>DIFERENCIA</TableColumn>
              <TableColumn className="text-right"> </TableColumn>
            </TableHeader>
            <TableBody emptyContent="Aún no hay turnos.">
              {turnos.map((t) => {
                const difBs = n(t.diferencia_bs ?? 0)
                const difUsd = n(t.diferencia_usd ?? 0)
                const cuadra = Math.abs(difBs) < 1 && Math.abs(difUsd) < 0.01
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      #{t.id} <Chip size="sm" variant="flat" color={t.estado === 'abierto' ? 'success' : 'default'}>{t.estado}</Chip>
                    </TableCell>
                    <TableCell>{t.user?.name}</TableCell>
                    <TableCell>{fecha(t.abierto_el)}</TableCell>
                    <TableCell>{t.cerrado_el ? fecha(t.cerrado_el) : '—'}</TableCell>
                    <TableCell>
                      {t.estado === 'cerrado' ? (
                        <Chip size="sm" variant="flat" color={cuadra ? 'success' : 'danger'}>
                          {cuadra ? 'Cuadra' : `${bs(difBs)} · ${usd(difUsd)}`}
                        </Chip>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button isIconOnly size="sm" variant="flat" aria-label="Ver turno" onPress={() => verTurno(t)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {turnoCierre && (
        <CerrarCajaModal
          key={turnoCierre.id}
          turno={turnoCierre}
          isOpen={cierreModal.isOpen}
          onOpenChange={cierreModal.onOpenChange}
          onCerrada={(resumen) => {
            cargar()
            imprimir(resumen)
          }}
        />
      )}

      <Modal isOpen={detalleModal.isOpen} onOpenChange={detalleModal.onOpenChange} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="font-display">Turno #{detalle?.turno.id} · {detalle?.turno.user?.name}</ModalHeader>
              <ModalBody>{detalle && <ResumenVista resumen={detalle.resumen} />}</ModalBody>
              <ModalFooter>
                {detalle && (
                  <Button variant="flat" startContent={<Printer className="h-4 w-4" />} onPress={() => imprimir(detalle.resumen)}>
                    Imprimir
                  </Button>
                )}
                <Button color="primary" onPress={onClose}>Cerrar</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

function ResumenVista({ resumen }: { resumen: ResumenCaja }) {
  const ef = resumen.efectivo
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato titulo="Ventas" valor={String(resumen.ventas.cantidad)} sub={`prom. ${usd(resumen.ventas.ticket_promedio_usd)}`} />
        <Dato titulo="Vendido" valor={usd(resumen.ventas.total_usd)} sub={bs(resumen.ventas.total_bs)} />
        <Dato titulo="Anuladas / devol." valor={`${resumen.anuladas.cantidad} / ${resumen.devoluciones.cantidad}`} sub={usd(resumen.anuladas.total_usd + resumen.devoluciones.total_usd)} />
        <Dato titulo="Fiado / abonos" valor={usd(resumen.fiado_otorgado_usd)} sub={`abonos ${usd(resumen.abonos.total_usd)}`} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-small">
          <thead>
            <tr className="text-left text-tiny uppercase text-default-400">
              <th className="py-1">Método</th>
              <th className="py-1 text-right">Cobros</th>
              <th className="py-1 text-right">Abonos</th>
              <th className="py-1 text-right">Vuelto</th>
              <th className="py-1 text-right">Devol.</th>
              <th className="py-1 text-right">Neto</th>
            </tr>
          </thead>
          <tbody>
            {resumen.metodos.length === 0 && (
              <tr><td colSpan={6} className="py-3 text-center text-default-400">Sin movimientos todavía.</td></tr>
            )}
            {resumen.metodos.map((m) => {
              const f = (v: number) => (v ? (m.moneda === 'USD' ? usd(v) : bs(v)) : '—')
              return (
                <tr key={`${m.metodo}-${m.moneda}`} className="border-t border-default-100">
                  <td className="py-1.5">{nombreMetodo(m.metodo)}</td>
                  <td className="py-1.5 text-right">{f(m.cobros)}</td>
                  <td className="py-1.5 text-right">{f(m.abonos)}</td>
                  <td className="py-1.5 text-right">{m.vuelto ? `−${f(m.vuelto)}` : '—'}</td>
                  <td className="py-1.5 text-right">{m.devoluciones ? `−${f(m.devoluciones)}` : '—'}</td>
                  <td className="py-1.5 text-right font-semibold">{f(m.neto)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {ef ? (
        <div className="grid grid-cols-1 gap-3 rounded-large bg-default-50 p-3 text-small sm:grid-cols-2">
          <div>
            <p className="text-tiny uppercase text-default-400">Efectivo en bolívares</p>
            <p>Fondo {bs(resumen.turno.fondo_bs)} · esperado <b>{bs(ef.esperado_bs)}</b></p>
            {ef.contado_bs != null && (
              <p>Contado {bs(ef.contado_bs)} · <Diferencia valor={ef.diferencia_bs ?? 0} formato={bs} /></p>
            )}
          </div>
          <div>
            <p className="text-tiny uppercase text-default-400">Efectivo en dólares</p>
            <p>Fondo {usd(resumen.turno.fondo_usd)} · esperado <b>{usd(ef.esperado_usd)}</b></p>
            {ef.contado_usd != null && (
              <p>Contado {usd(ef.contado_usd)} · <Diferencia valor={ef.diferencia_usd ?? 0} formato={usd} /></p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-tiny text-default-400">El efectivo esperado se muestra al cerrar la caja (arqueo a ciegas).</p>
      )}
    </div>
  )
}

function Diferencia({ valor, formato }: { valor: number; formato: (v: number) => string }) {
  if (Math.abs(valor) < 0.01) return <span className="font-semibold text-success">cuadra</span>
  return <span className="font-semibold text-danger">{valor > 0 ? 'sobra' : 'falta'} {formato(Math.abs(valor))}</span>
}

function Dato({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-large bg-default-50 p-3">
      <p className="text-tiny uppercase text-default-400">{titulo}</p>
      <p className="font-display text-lg font-bold">{valor}</p>
      {sub && <p className="text-tiny text-default-500">{sub}</p>}
    </div>
  )
}

function CerrarCajaModal({
  turno,
  isOpen,
  onOpenChange,
  onCerrada,
}: {
  turno: TurnoCaja
  isOpen: boolean
  onOpenChange: (o: boolean) => void
  onCerrada: (r: ResumenCaja) => void
}) {
  const [contadoBs, setContadoBs] = useState('')
  const [contadoUsd, setContadoUsd] = useState('')
  const [observacion, setObservacion] = useState('')
  const [resultado, setResultado] = useState<ResumenCaja | null>(null)
  const [error, setError] = useState('')
  const [cerrando, setCerrando] = useState(false)

  async function cerrar() {
    setCerrando(true)
    setError('')
    try {
      const r = await api.post<{ resumen: ResumenCaja }>(`/caja/turnos/${turno.id}/cerrar`, {
        contado_bs: n(contadoBs.replace(',', '.')),
        contado_usd: n(contadoUsd.replace(',', '.')),
        observacion: observacion || null,
      })
      setResultado(r.data.resumen)
      onCerrada(r.data.resumen)
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCerrando(false)
    }
  }

  const ef = resultado?.efectivo
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="md" placement="center">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="font-display">{resultado ? 'Caja cerrada' : 'Cerrar caja'}</ModalHeader>
            <ModalBody className="gap-3">
              {!resultado ? (
                <>
                  <p className="text-small text-default-500">
                    Cuenta el efectivo que hay en la gaveta (incluido el fondo) y escríbelo. Boxy te dirá si cuadra.
                  </p>
                  <Input label="Efectivo en bolívares" inputMode="decimal" variant="bordered" value={contadoBs} onValueChange={setContadoBs} startContent={<span className="text-tiny text-default-400">Bs</span>} />
                  <Input label="Efectivo en dólares" inputMode="decimal" variant="bordered" value={contadoUsd} onValueChange={setContadoUsd} startContent={<span className="text-tiny text-default-400">$</span>} />
                  <Input label="Observación (opcional)" variant="bordered" value={observacion} onValueChange={setObservacion} />
                  {error && <p className="text-small text-danger">{error}</p>}
                </>
              ) : (
                ef && (
                  <div className="flex flex-col gap-2 text-small">
                    <p>Bolívares: esperado {bs(ef.esperado_bs)}, contado {bs(ef.contado_bs ?? 0)} → <Diferencia valor={ef.diferencia_bs ?? 0} formato={bs} /></p>
                    <p>Dólares: esperado {usd(ef.esperado_usd)}, contado {usd(ef.contado_usd ?? 0)} → <Diferencia valor={ef.diferencia_usd ?? 0} formato={usd} /></p>
                    <p className="text-tiny text-default-400">Se envió a imprimir el reporte de cierre.</p>
                  </div>
                )
              )}
            </ModalBody>
            <ModalFooter>
              {!resultado ? (
                <>
                  <Button variant="light" onPress={onClose}>Cancelar</Button>
                  <Button color="danger" isLoading={cerrando} isDisabled={contadoBs === '' && contadoUsd === ''} onPress={cerrar}>
                    Cerrar caja
                  </Button>
                </>
              ) : (
                <Button color="primary" onPress={onClose}>Listo</Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
