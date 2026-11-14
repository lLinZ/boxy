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
  Select,
  SelectItem,
  Spinner,
  useDisclosure,
} from '@heroui/react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Cake, HandCoins, MessageCircle, Phone, Printer, Star } from 'lucide-react'
import { api, mensajeError } from '../lib/api'
import { bs, fecha, n, usd } from '../lib/format'
import { imprimirTicket, nombreMetodo, ticketAbono } from '../lib/ticket'
import { abrirWhatsApp, textoEstadoCuenta } from '../lib/whatsapp'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import type { CuentaCliente, FichaCliente, MovimientoCuenta, TasaCambio } from '../types'

const METODOS_ABONO = [
  { key: 'efectivo_bs', label: 'Efectivo Bs', moneda: 'VES' },
  { key: 'pago_movil', label: 'Pago móvil', moneda: 'VES' },
  { key: 'transferencia', label: 'Transferencia', moneda: 'VES' },
  { key: 'tarjeta', label: 'Tarjeta', moneda: 'VES' },
  { key: 'efectivo_usd', label: 'Efectivo USD', moneda: 'USD' },
  { key: 'zelle', label: 'Zelle', moneda: 'USD' },
  { key: 'usdt', label: 'USDT', moneda: 'USD' },
]

/** Ficha del cliente: historial de compras, favoritos, estado de cuenta (fiado) y WhatsApp. */
export function ClienteFichaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { panel } = useTheme()
  const { puede, empresa, ajustes } = useAuth()
  const [ficha, setFicha] = useState<FichaCliente | null>(null)
  const [cuenta, setCuenta] = useState<CuentaCliente | null>(null)
  const [tasa, setTasa] = useState(0)
  const [error, setError] = useState('')
  const abono = useDisclosure()

  const cargar = useCallback(() => {
    api.get<FichaCliente>(`/clientes/${id}`).then((r) => setFicha(r.data)).catch((e) => setError(mensajeError(e, 'Cliente no encontrado.')))
    api.get<CuentaCliente>(`/clientes/${id}/cuenta`).then((r) => setCuenta(r.data)).catch(() => {})
  }, [id])

  useEffect(() => {
    cargar()
    api.get<TasaCambio>('/tasas/vigente').then((r) => setTasa(n(r.data.tasa))).catch(() => {})
  }, [cargar])

  if (error) return <p className="py-10 text-center text-danger">{error}</p>
  if (!ficha) return <div className="flex justify-center py-20"><Spinner label="Cargando ficha…" /></div>

  const c = ficha.cliente
  const e = ficha.estadisticas
  const saldo = n(c.saldo_usd ?? 0)
  const negocio = empresa ? { empresa: empresa.empresa, ajustes: empresa.ajustes } : null
  const nombreNegocio = empresa?.empresa.nombre ?? 'la tienda'
  const maxMes = Math.max(1, ...ficha.por_mes.map((m) => n(m.total_usd)))
  const cumple = c.fecha_nacimiento ? new Date(c.fecha_nacimiento + 'T12:00:00') : null

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Button variant="light" className="w-fit" startContent={<ArrowLeft className="h-4 w-4" />} onPress={() => navigate('/clientes')}>
        Clientes
      </Button>

      {/* Encabezado */}
      <Card className={panel}>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={c.nombre.charAt(0)} className="h-14 w-14 text-large" color="primary" />
            <div>
              <h2 className="font-display text-2xl font-bold">{c.nombre}</h2>
              <p className="text-small text-default-500">
                {c.tipo_documento}-{c.documento}
                {c.telefono && <span className="ml-2 inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{c.telefono}</span>}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {cumple && (
                  <Chip size="sm" variant="flat" startContent={<Cake className="h-3.5 w-3.5" />}>
                    {cumple.toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })}
                  </Chip>
                )}
                {ajustes?.puntos_activo && <Chip size="sm" variant="flat" color="secondary" startContent={<Star className="h-3.5 w-3.5" />}>{c.puntos ?? 0} puntos</Chip>}
                {c.credito_habilitado && <Chip size="sm" variant="flat" color="primary">Fiado hasta {usd(c.limite_credito_usd ?? 0)}</Chip>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {c.telefono && (
              <Button color="success" variant="flat" startContent={<MessageCircle className="h-4 w-4" />} onPress={() => abrirWhatsApp(c.telefono, textoEstadoCuenta(c, nombreNegocio, tasa), ajustes?.whatsapp_codigo_pais)}>
                {saldo > 0 ? 'Recordar deuda' : 'WhatsApp'}
              </Button>
            )}
            {saldo > 0 && puede('fiado.abonar') && (
              <Button color="primary" startContent={<HandCoins className="h-4 w-4" />} onPress={abono.onOpen}>
                Registrar abono
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {c.notas && (
        <Card className={panel}>
          <CardBody className="text-small"><b>Notas:</b> {c.notas}</CardBody>
        </Card>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Compras" valor={String(e.compras)} sub={e.primera_compra ? `desde ${new Date(e.primera_compra).toLocaleDateString('es-VE')}` : '—'} panel={panel} />
        <Kpi titulo="Total comprado" valor={usd(e.total_usd)} sub={`ticket prom. ${usd(e.ticket_promedio_usd)}`} panel={panel} />
        <Kpi titulo="Última compra" valor={e.dias_sin_comprar == null ? '—' : e.dias_sin_comprar === 0 ? 'hoy' : `hace ${e.dias_sin_comprar} d`} sub={e.frecuencia_dias ? `compra cada ${e.frecuencia_dias} días` : ''} panel={panel} />
        <Kpi titulo="Debe" valor={usd(saldo)} sub={saldo > 0 && tasa ? bs(saldo * tasa) : cuenta?.antiguedad_dias != null ? `hace ${cuenta.antiguedad_dias} días` : ''} panel={panel} alerta={saldo > 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Favoritos */}
        <Card className={panel}>
          <CardHeader><h3 className="font-display text-lg font-bold">Lo que más compra</h3></CardHeader>
          <CardBody className="gap-2">
            {ficha.favoritos.length === 0 && <p className="text-small text-default-400">Aún sin compras.</p>}
            {ficha.favoritos.map((f) => (
              <div key={f.producto} className="flex justify-between gap-2 text-small">
                <span className="truncate">{f.producto}</span>
                <span className="shrink-0 text-default-500">{f.veces} veces · {usd(f.total_usd)}</span>
              </div>
            ))}
            {ficha.por_mes.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-tiny uppercase text-default-400">Últimos meses</p>
                <div className="flex h-24 items-end gap-2">
                  {ficha.por_mes.map((m) => (
                    <div key={m.mes} className="flex flex-1 flex-col items-center gap-1">
                      <div className="w-full rounded-t-medium bg-primary/70" style={{ height: `${Math.max(4, (n(m.total_usd) / maxMes) * 80)}px` }} title={usd(m.total_usd)} />
                      <span className="text-tiny text-default-400">{m.mes.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Últimas compras */}
        <Card className={panel}>
          <CardHeader><h3 className="font-display text-lg font-bold">Últimas compras</h3></CardHeader>
          <CardBody className="gap-1">
            {ficha.ultimas_compras.length === 0 && <p className="text-small text-default-400">Aún sin compras.</p>}
            {ficha.ultimas_compras.map((v) => (
              <div key={v.id} className="flex justify-between gap-2 border-b border-default-100 py-1 text-small last:border-0">
                <span>{v.numero_factura} · {fecha(v.fecha)}</span>
                <span className="font-medium">{usd(v.total_usd)}{n(v.devuelto_usd) > 0 && <span className="text-warning"> (−{usd(v.devuelto_usd)})</span>}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Estado de cuenta */}
      {cuenta && (cuenta.movimientos.data.length > 0 || c.credito_habilitado) && (
        <Card className={panel}>
          <CardHeader className="flex-wrap justify-between gap-2">
            <h3 className="font-display text-lg font-bold">Estado de cuenta (fiado)</h3>
            <Chip color={saldo > 0 ? 'warning' : 'success'} variant="flat">Saldo {usd(saldo)}</Chip>
          </CardHeader>
          <CardBody className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-small">
              <thead>
                <tr className="text-left text-tiny uppercase text-default-400">
                  <th className="py-1">Fecha</th>
                  <th className="py-1">Movimiento</th>
                  <th className="py-1 text-right">Cargo</th>
                  <th className="py-1 text-right">Abono</th>
                  <th className="py-1 text-right">Saldo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cuenta.movimientos.data.length === 0 && (
                  <tr><td colSpan={6} className="py-3 text-center text-default-400">Sin movimientos.</td></tr>
                )}
                {cuenta.movimientos.data.map((m) => {
                  const monto = n(m.monto_usd)
                  return (
                    <tr key={m.id} className="border-t border-default-100">
                      <td className="py-1.5">{fecha(m.created_at)}</td>
                      <td className="py-1.5">
                        {m.tipo === 'cargo' ? `Compra ${m.venta?.numero_factura ?? ''}` : m.tipo === 'abono' ? `Abono · ${nombreMetodo(m.metodo)}` : m.nota ?? m.tipo}
                        {m.user && <span className="text-tiny text-default-400"> · {m.user.name}</span>}
                      </td>
                      <td className="py-1.5 text-right">{monto > 0 ? usd(monto) : ''}</td>
                      <td className="py-1.5 text-right text-success">{monto < 0 ? usd(-monto) : ''}</td>
                      <td className="py-1.5 text-right font-semibold">{usd(m.saldo_usd)}</td>
                      <td className="py-1.5 text-right">
                        {m.tipo === 'abono' && negocio && (
                          <Button isIconOnly size="sm" variant="light" aria-label="Imprimir recibo" onPress={() => imprimirTicket(ticketAbono(m, cuenta, negocio), negocio.ajustes.ticket_ancho)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {cuenta && (
        <AbonoModal
          isOpen={abono.isOpen}
          onOpenChange={abono.onOpenChange}
          clienteId={c.id}
          saldo={saldo}
          tasa={tasa}
          cobraIgtf={ajustes?.cobra_igtf ?? true}
          onListo={(mov) => {
            cargar()
            if (negocio) imprimirTicket(ticketAbono(mov, cuenta, negocio), negocio.ajustes.ticket_ancho)
          }}
        />
      )}
    </div>
  )
}

function Kpi({ titulo, valor, sub, panel, alerta = false }: { titulo: string; valor: string; sub?: string; panel: string; alerta?: boolean }) {
  return (
    <Card className={panel}>
      <CardBody className="gap-0.5">
        <p className="text-tiny uppercase text-default-400">{titulo}</p>
        <p className={`font-display text-xl font-bold ${alerta ? 'text-warning' : ''}`}>{valor}</p>
        {sub && <p className="text-tiny text-default-500">{sub}</p>}
      </CardBody>
    </Card>
  )
}

function AbonoModal({
  isOpen,
  onOpenChange,
  clienteId,
  saldo,
  tasa,
  cobraIgtf,
  onListo,
}: {
  isOpen: boolean
  onOpenChange: (o: boolean) => void
  clienteId: number
  saldo: number
  tasa: number
  cobraIgtf: boolean
  onListo: (m: MovimientoCuenta) => void
}) {
  const [metodo, setMetodo] = useState('efectivo_bs')
  const [monto, setMonto] = useState('')
  const [referencia, setReferencia] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const moneda = METODOS_ABONO.find((m) => m.key === metodo)?.moneda ?? 'VES'
  const montoNum = n(monto.replace(',', '.'))
  const enUsd = moneda === 'USD' ? montoNum : tasa ? montoNum / tasa : 0

  async function guardar(onClose: () => void) {
    setGuardando(true)
    setError('')
    try {
      const r = await api.post<{ movimiento: MovimientoCuenta }>(`/clientes/${clienteId}/abonos`, { metodo, monto: montoNum, referencia: referencia || null })
      onListo(r.data.movimiento)
      setMonto('')
      setReferencia('')
      onClose()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="sm" placement="center">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="font-display">Registrar abono</ModalHeader>
            <ModalBody className="gap-3">
              <p className="text-small text-default-500">Debe {usd(saldo)}{tasa ? ` (${bs(saldo * tasa)})` : ''}.</p>
              <Select label="Forma de pago" variant="bordered" selectedKeys={[metodo]} onChange={(e) => e.target.value && setMetodo(e.target.value)}>
                {METODOS_ABONO.map((m) => <SelectItem key={m.key}>{m.label}</SelectItem>)}
              </Select>
              <Input
                label={`Monto que abona (${moneda === 'USD' ? 'USD' : 'Bs'})`}
                inputMode="decimal"
                variant="bordered"
                value={monto}
                onValueChange={setMonto}
                description={montoNum > 0 ? `Equivale a ${usd(enUsd)} de la deuda${moneda === 'USD' && cobraIgtf ? ` · cobrar además IGTF ${usd(enUsd * 0.03)}` : ''}` : undefined}
                endContent={
                  <Button size="sm" variant="light" onPress={() => setMonto((moneda === 'USD' ? saldo : Math.ceil(saldo * tasa * 100) / 100).toFixed(2))}>
                    Todo
                  </Button>
                }
              />
              {metodo !== 'efectivo_bs' && metodo !== 'efectivo_usd' && (
                <Input label="Referencia" variant="bordered" value={referencia} onValueChange={setReferencia} />
              )}
              {error && <p className="text-small text-danger">{error}</p>}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>Cancelar</Button>
              <Button color="primary" isLoading={guardando} isDisabled={montoNum <= 0} onPress={() => guardar(onClose)}>
                Abonar e imprimir recibo
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
