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
  useDisclosure,
} from '@heroui/react'
import { useEffect, useState } from 'react'
import { BadgeCheck, CreditCard, Clock, Receipt } from 'lucide-react'
import { api } from '../lib/api'
import { fecha, n, usd } from '../lib/format'
import { useTheme } from '../theme/ThemeContext'
import type { PagoLicencia, Plan, SuscripcionInfo } from '../types'

const ESTADO_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  trialing: 'warning',
  activa: 'success',
  gracia: 'warning',
  suspendida: 'danger',
  vencida: 'danger',
  cancelada: 'danger',
}
const ESTADO_LABEL: Record<string, string> = {
  trialing: 'Prueba gratis',
  activa: 'Activa',
  gracia: 'En gracia',
  suspendida: 'Suspendida',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
}
const COBRO_LABEL: Record<string, string> = {
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia',
  usdt: 'USDT',
  binance: 'Binance Pay',
  zelle: 'Zelle',
}
const METODOS = [
  { key: 'pago_movil', label: 'Pago Móvil' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'usdt', label: 'USDT' },
  { key: 'zelle', label: 'Zelle' },
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'otro', label: 'Otro' },
]

export function BillingPage() {
  const { panel } = useTheme()
  const [info, setInfo] = useState<SuscripcionInfo | null>(null)
  const [pagos, setPagos] = useState<PagoLicencia[]>([])
  const [planes, setPlanes] = useState<Plan[]>([])
  const [cargando, setCargando] = useState(true)
  const modal = useDisclosure()

  // Formulario de reporte de pago
  const [planId, setPlanId] = useState('')
  const [metodo, setMetodo] = useState('pago_movil')
  const [moneda, setMoneda] = useState('USD')
  const [monto, setMonto] = useState('')
  const [montoUsd, setMontoUsd] = useState('')
  const [meses, setMeses] = useState('1')
  const [referencia, setReferencia] = useState('')
  const [comprobante, setComprobante] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  function cargar() {
    setCargando(true)
    Promise.all([
      api.get<SuscripcionInfo>('/suscripcion'),
      api.get<PagoLicencia[]>('/suscripcion/pagos'),
      api.get<Plan[]>('/planes'),
    ])
      .then(([s, p, pl]) => {
        setInfo(s.data)
        setPagos(p.data)
        setPlanes(pl.data)
        setPlanId(String(s.data.suscripcion.plan?.id ?? pl.data[0]?.id ?? ''))
      })
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [])

  async function reportar(onClose: () => void) {
    setEnviando(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('plan_id', planId)
      fd.append('metodo', metodo)
      fd.append('moneda', moneda)
      fd.append('monto', monto)
      fd.append('monto_usd', moneda === 'USD' ? monto : montoUsd)
      fd.append('meses', meses)
      if (referencia) fd.append('referencia', referencia)
      if (comprobante) fd.append('comprobante', comprobante)
      await api.post('/suscripcion/pago', fd)
      cargar()
      onClose()
    } catch {
      setError('No se pudo reportar el pago. Revisa los datos.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <Spinner label="Cargando tu licencia…" />
      </div>
    )
  }

  const estado = info?.estado ?? 'sin_suscripcion'
  const mediosCobro = Object.entries(info?.cobro ?? {}).filter(([, v]) => !!v) as [string, string][]
  const plan = info?.suscripcion.plan

  return (
    <div className="flex flex-col gap-6">
      {/* Estado de la licencia */}
      <Card className={panel}>
        <CardBody className="gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <BadgeCheck className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-bold">Plan {plan?.nombre ?? '—'}</h2>
              <Chip size="sm" variant="flat" color={ESTADO_COLOR[estado] ?? 'default'}>
                {ESTADO_LABEL[estado] ?? estado}
              </Chip>
            </div>
            <p className="flex items-center gap-1 text-small text-default-500">
              <Clock className="h-4 w-4" />
              {info?.puede_operar
                ? `${info?.dias_restantes} día(s) restantes`
                : 'Licencia inactiva — reporta un pago para reactivar'}
              {info?.fecha_limite ? ` · hasta ${fecha(info.fecha_limite)}` : ''}
            </p>
          </div>
          <Button color="primary" startContent={<CreditCard className="h-4 w-4" />} onPress={modal.onOpen}>
            Reportar pago
          </Button>
        </CardBody>
      </Card>

      {/* Instrucciones de pago (vienen de la configuración del servidor) */}
      <Card className={panel}>
        <CardHeader>
          <h3 className="font-display text-lg font-bold">¿Cómo pagar?</h3>
        </CardHeader>
        <CardBody className="gap-3 text-small text-default-600">
          {mediosCobro.length > 0 ? (
            <>
              <p>Paga la mensualidad por cualquiera de estos medios y luego repórtala aquí. Al confirmarla, tu licencia se extiende.</p>
              <dl className="grid gap-2 sm:grid-cols-2">
                {mediosCobro.map(([clave, valor]) => (
                  <div key={clave} className="rounded-medium bg-default-100 px-3 py-2">
                    <dt className="text-tiny font-semibold uppercase tracking-wide text-default-500">{COBRO_LABEL[clave] ?? clave}</dt>
                    <dd className="mt-0.5 select-all break-words font-medium text-foreground">{valor}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p>Escríbenos para recibir los datos de pago de tu plan.</p>
          )}
          {(info?.ventas?.whatsapp || info?.ventas?.email) && (
            <p className="text-default-500">
              ¿Dudas con tu pago?{' '}
              {info.ventas.whatsapp && (
                <a className="font-semibold text-primary underline-offset-4 hover:underline" href={`https://wa.me/${info.ventas.whatsapp}`} target="_blank" rel="noopener noreferrer">
                  Escríbenos por WhatsApp
                </a>
              )}
              {info.ventas.whatsapp && info.ventas.email && ' o a '}
              {info.ventas.email && (
                <a className="font-semibold text-primary underline-offset-4 hover:underline" href={`mailto:${info.ventas.email}`}>
                  {info.ventas.email}
                </a>
              )}
              .
            </p>
          )}
        </CardBody>
      </Card>

      {/* Historial */}
      <Card className={panel}>
        <CardHeader className="items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-bold">Historial de pagos</h3>
        </CardHeader>
        <CardBody className="gap-2">
          {pagos.length === 0 ? (
            <p className="text-small text-default-400">Aún no has reportado pagos.</p>
          ) : (
            pagos.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-large bg-default-50 px-3 py-2">
                <span className="text-small font-semibold">{usd(p.monto_usd)}</span>
                <span className="text-tiny text-default-400">
                  {p.metodo} · {p.meses} mes(es) · {fecha(p.created_at)}
                </span>
                <Chip
                  size="sm"
                  variant="flat"
                  className="ml-auto"
                  color={p.estado === 'confirmado' ? 'success' : p.estado === 'rechazado' ? 'danger' : 'warning'}
                >
                  {p.estado}
                </Chip>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/* Modal reportar pago */}
      <Modal isOpen={modal.isOpen} onOpenChange={modal.onOpenChange} size="lg">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="font-display">Reportar un pago</ModalHeader>
              <ModalBody className="gap-3">
                <Select
                  label="Plan"
                  variant="bordered"
                  selectedKeys={planId ? [planId] : []}
                  onChange={(e) => e.target.value && setPlanId(e.target.value)}
                >
                  {planes.map((p) => (
                    <SelectItem key={String(p.id)}>{`${p.nombre} — ${usd(p.precio_mensual_usd)}/mes`}</SelectItem>
                  ))}
                </Select>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Método"
                    variant="bordered"
                    selectedKeys={[metodo]}
                    onChange={(e) => e.target.value && setMetodo(e.target.value)}
                  >
                    {METODOS.map((m) => (
                      <SelectItem key={m.key}>{m.label}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    label="Moneda"
                    variant="bordered"
                    selectedKeys={[moneda]}
                    onChange={(e) => e.target.value && setMoneda(e.target.value)}
                  >
                    <SelectItem key="USD">USD</SelectItem>
                    <SelectItem key="VES">Bs (VES)</SelectItem>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={`Monto (${moneda})`}
                    type="number"
                    variant="bordered"
                    value={monto}
                    onValueChange={setMonto}
                    isRequired
                  />
                  {moneda === 'VES' && (
                    <Input
                      label="Equivalente en USD"
                      type="number"
                      variant="bordered"
                      value={montoUsd}
                      onValueChange={setMontoUsd}
                      isRequired
                    />
                  )}
                  <Input
                    label="Meses"
                    type="number"
                    variant="bordered"
                    value={meses}
                    onValueChange={setMeses}
                  />
                </div>
                <Input
                  label="Referencia / nº de operación"
                  variant="bordered"
                  value={referencia}
                  onValueChange={setReferencia}
                />
                <div>
                  <label className="text-small text-default-500">Comprobante (opcional)</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="mt-1 block w-full text-small"
                    onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
                  />
                </div>
                {error && <p className="text-small text-danger">{error}</p>}
                <p className="text-tiny text-default-400">
                  Total a pagar: {planes.find((p) => String(p.id) === planId)
                    ? usd(n(planes.find((p) => String(p.id) === planId)!.precio_mensual_usd) * n(meses))
                    : '—'}
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="primary" isLoading={enviando} onPress={() => reportar(onClose)}>
                  Enviar reporte
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
