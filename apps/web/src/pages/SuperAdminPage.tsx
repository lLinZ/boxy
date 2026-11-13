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
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
  Tooltip,
  useDisclosure,
} from '@heroui/react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Ban,
  BarChart3,
  Building2,
  CalendarPlus,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  LayoutDashboard,
  Pencil,
  Play,
  Plus,
  Tags,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { abrirArchivo, api } from '../lib/api'
import { fecha, n, usd } from '../lib/format'
import { useTheme } from '../theme/ThemeContext'
import type {
  EmpresaAdmin,
  EmpresaDetalle,
  IngresosSaaS,
  MetricasSaaS,
  PagoLicencia,
  Plan,
  SuscripcionRiesgo,
} from '../types'

const ESTADO_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  trialing: 'warning',
  activa: 'success',
  gracia: 'warning',
  suspendida: 'danger',
  vencida: 'danger',
  cancelada: 'default',
  sin_suscripcion: 'default',
}

export function SuperAdminPage() {
  const { panel } = useTheme()
  return (
    <Tabs aria-label="Panel Boxy" variant="underlined" color="primary" size="lg">
      <Tab key="resumen" title={<TabTitle icon={<LayoutDashboard className="h-4 w-4" />} label="Resumen" />}>
        <ResumenTab panel={panel} />
      </Tab>
      <Tab key="pagos" title={<TabTitle icon={<CreditCard className="h-4 w-4" />} label="Pagos" />}>
        <PagosTab panel={panel} />
      </Tab>
      <Tab key="empresas" title={<TabTitle icon={<Building2 className="h-4 w-4" />} label="Empresas" />}>
        <EmpresasTab panel={panel} />
      </Tab>
      <Tab key="riesgo" title={<TabTitle icon={<AlertTriangle className="h-4 w-4" />} label="Riesgo" />}>
        <RiesgoTab panel={panel} />
      </Tab>
      <Tab key="planes" title={<TabTitle icon={<Tags className="h-4 w-4" />} label="Planes" />}>
        <PlanesTab panel={panel} />
      </Tab>
    </Tabs>
  )
}

function TabTitle({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-2">
      {icon}
      {label}
    </span>
  )
}

/* ─────────────── Resumen ─────────────── */
function ResumenTab({ panel }: { panel: string }) {
  const [m, setM] = useState<MetricasSaaS | null>(null)
  const [ing, setIng] = useState<IngresosSaaS | null>(null)

  useEffect(() => {
    api.get<MetricasSaaS>('/admin/metricas').then((r) => setM(r.data)).catch(() => {})
    api.get<IngresosSaaS>('/admin/ingresos').then((r) => setIng(r.data)).catch(() => {})
  }, [])

  if (!m) return <Cargando label="Cargando resumen…" />
  const maxSerie = Math.max(...(ing?.serie.map((s) => s.total_usd) ?? [0]), 1)

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat panel={panel} tone="bg-primary/15 text-primary" icon={<Building2 className="h-5 w-5" />} label="Empresas" value={String(m.empresas)} />
        <Stat panel={panel} tone="bg-success/15 text-success" icon={<TrendingUp className="h-5 w-5" />} label="MRR" value={usd(m.mrr_usd)} detail={`ARR ${usd(m.arr_usd)}`} />
        <Stat panel={panel} tone="bg-secondary/15 text-secondary" icon={<BarChart3 className="h-5 w-5" />} label="ARPU" value={usd(m.arpu_usd)} />
        <Stat panel={panel} tone="bg-success/15 text-success" icon={<CircleDollarSign className="h-5 w-5" />} label="Ingreso del mes" value={usd(m.ingresos_mes_usd)} />
        <Stat panel={panel} tone="bg-warning/15 text-warning" icon={<Clock className="h-5 w-5" />} label="En prueba" value={String(m.trial)} />
        <Stat panel={panel} tone="bg-success/15 text-success" icon={<CheckCircle2 className="h-5 w-5" />} label="Activas" value={String(m.activas)} />
        <Stat panel={panel} tone="bg-danger/15 text-danger" icon={<Ban className="h-5 w-5" />} label="Suspendidas" value={String(m.suspendidas)} />
        <Stat panel={panel} tone="bg-warning/15 text-warning" icon={<CreditCard className="h-5 w-5" />} label="Pagos por revisar" value={String(m.pagos_pendientes)} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className={`xl:col-span-2 ${panel}`}>
          <CardHeader className="items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-bold">Ingresos confirmados (6 meses)</h3>
            {ing && <Chip size="sm" variant="flat" color="success" className="ml-auto">{usd(ing.total_confirmado_usd)} histórico</Chip>}
          </CardHeader>
          <CardBody>
            {!ing ? (
              <Spinner size="sm" />
            ) : (
              <div className="flex h-48 items-end gap-3 px-2">
                {ing.serie.map((s) => (
                  <Tooltip key={s.ym} content={`${s.mes}: ${usd(s.total_usd)}`} placement="top">
                    <div className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <div className="w-full rounded-t-large bg-gradient-to-t from-primary to-primary/60" style={{ height: `${Math.max((s.total_usd / maxSerie) * 100, 2)}%` }} />
                      <span className="text-tiny text-default-500">{s.mes}</span>
                    </div>
                  </Tooltip>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className={panel}>
          <CardHeader className="items-center gap-2">
            <Tags className="h-5 w-5 text-secondary" />
            <h3 className="font-display text-lg font-bold">Por plan</h3>
          </CardHeader>
          <CardBody className="gap-2">
            {ing?.por_plan.map((p) => (
              <div key={p.plan} className="flex items-center justify-between">
                <span className="text-small font-medium">{p.plan}</span>
                <span className="text-tiny text-default-400">{p.empresas} empresas</span>
                <span className="font-semibold">{usd(p.mrr_usd)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

/* ─────────────── Pagos ─────────────── */
function PagosTab({ panel }: { panel: string }) {
  const [estado, setEstado] = useState('reportado')
  const [pagos, setPagos] = useState<PagoLicencia[]>([])
  const [cargando, setCargando] = useState(true)
  const [accion, setAccion] = useState<number | null>(null)

  function cargar() {
    setCargando(true)
    const params = estado === 'todos' ? {} : { estado }
    api.get<PagoLicencia[]>('/admin/pagos', { params }).then((r) => setPagos(r.data)).finally(() => setCargando(false))
  }
  useEffect(cargar, [estado])

  async function confirmar(id: number) {
    setAccion(id)
    try { await api.post(`/admin/pagos/${id}/confirmar`); cargar() } finally { setAccion(null) }
  }
  async function rechazar(id: number) {
    const motivo = window.prompt('Motivo del rechazo (opcional):') ?? ''
    setAccion(id)
    try { await api.post(`/admin/pagos/${id}/rechazar`, { motivo }); cargar() } finally { setAccion(null) }
  }

  return (
    <Card className={`mt-2 ${panel}`}>
      <CardHeader className="flex-wrap items-center gap-3">
        <CreditCard className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-bold">Pagos de licencia</h3>
        <div className="ml-auto flex gap-1 rounded-full bg-default-100 p-1">
          {['reportado', 'confirmado', 'rechazado', 'todos'].map((e) => (
            <button
              key={e}
              onClick={() => setEstado(e)}
              className={`rounded-full px-3 py-1 text-tiny font-semibold capitalize transition-colors ${estado === e ? 'bg-primary text-primary-foreground' : 'text-default-500 hover:text-foreground'}`}
            >
              {e}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardBody>
        {cargando ? (
          <Spinner />
        ) : pagos.length === 0 ? (
          <p className="py-6 text-center text-small text-default-400">Sin pagos en «{estado}».</p>
        ) : (
          <Table aria-label="Pagos" removeWrapper>
            <TableHeader>
              <TableColumn>EMPRESA</TableColumn>
              <TableColumn>MONTO</TableColumn>
              <TableColumn>MÉTODO</TableColumn>
              <TableColumn>REFERENCIA</TableColumn>
              <TableColumn>FECHA</TableColumn>
              <TableColumn className="text-right">ACCIÓN</TableColumn>
            </TableHeader>
            <TableBody>
              {pagos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.empresa?.nombre}</p>
                    <p className="text-tiny text-default-400">{p.plan?.nombre ?? '—'} · {p.meses} mes(es)</p>
                  </TableCell>
                  <TableCell className="font-semibold">{usd(p.monto_usd)}</TableCell>
                  <TableCell className="capitalize">{p.metodo.replace('_', ' ')}</TableCell>
                  <TableCell className="text-tiny text-default-400">
                    {p.referencia ?? '—'}
                    {p.tiene_comprobante && (
                      <button className="ml-2 text-primary hover:underline" onClick={() => abrirArchivo(`/admin/pagos/${p.id}/comprobante`)}>
                        ver comprobante
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-tiny">{fecha(p.created_at)}</TableCell>
                  <TableCell>
                    {p.estado === 'reportado' ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" color="success" variant="flat" isLoading={accion === p.id} startContent={<CheckCircle2 className="h-4 w-4" />} onPress={() => confirmar(p.id)}>Confirmar</Button>
                        <Button size="sm" color="danger" variant="light" startContent={<XCircle className="h-4 w-4" />} onPress={() => rechazar(p.id)}>Rechazar</Button>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <Chip size="sm" variant="flat" color={p.estado === 'confirmado' ? 'success' : 'danger'}>{p.estado}</Chip>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardBody>
    </Card>
  )
}

/* ─────────────── Empresas ─────────────── */
function EmpresasTab({ panel }: { panel: string }) {
  const [empresas, setEmpresas] = useState<EmpresaAdmin[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const crear = useDisclosure()

  function cargar() {
    setCargando(true)
    api.get<EmpresaAdmin[]>('/admin/empresas').then((r) => setEmpresas(r.data)).finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const filtradas = empresas.filter((e) => e.nombre.toLowerCase().includes(filtro.toLowerCase()) || e.rif.toLowerCase().includes(filtro.toLowerCase()))

  return (
    <Card className={`mt-2 ${panel}`}>
      <CardHeader className="flex-col items-stretch gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-bold">Empresas</h3>
            <Chip size="sm" variant="flat">{empresas.length}</Chip>
          </div>
          <Button color="primary" startContent={<Plus className="h-4 w-4" />} onPress={crear.onOpen}>Crear empresa</Button>
        </div>
        <Input placeholder="Buscar por nombre o RIF…" value={filtro} onValueChange={setFiltro} variant="bordered" isClearable />
      </CardHeader>
      <CardBody>
        {cargando ? (
          <Spinner />
        ) : (
          <Table aria-label="Empresas" removeWrapper>
            <TableHeader>
              <TableColumn>EMPRESA</TableColumn>
              <TableColumn>PLAN</TableColumn>
              <TableColumn>ESTADO</TableColumn>
              <TableColumn>VENCE</TableColumn>
              <TableColumn className="text-right">ACCIÓN</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Sin empresas.">
              {filtradas.map((e) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => setDetalleId(e.id)}>
                  <TableCell>
                    <p className="font-medium">{e.nombre}</p>
                    <p className="text-tiny text-default-400">{e.rif} · {e.sucursales} suc · {e.usuarios} usr</p>
                  </TableCell>
                  <TableCell>{e.plan ?? '—'}</TableCell>
                  <TableCell><Chip size="sm" variant="flat" color={ESTADO_COLOR[e.estado] ?? 'default'}>{e.estado}</Chip></TableCell>
                  <TableCell className="text-small">{e.vence_el ? `${fecha(e.vence_el)} (${e.dias_restantes}d)` : '—'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button size="sm" variant="flat" onPress={() => setDetalleId(e.id)}>Ver detalle</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardBody>

      <EmpresaDetalleModal id={detalleId} onClose={() => setDetalleId(null)} onChanged={cargar} />
      <CrearEmpresaModal isOpen={crear.isOpen} onOpenChange={crear.onOpenChange} onCreated={cargar} />
    </Card>
  )
}

/* ─────────────── Riesgo ─────────────── */
function RiesgoTab({ panel }: { panel: string }) {
  const [subs, setSubs] = useState<SuscripcionRiesgo[]>([])
  const [cargando, setCargando] = useState(true)
  const [detalleId, setDetalleId] = useState<number | null>(null)

  function cargar() {
    setCargando(true)
    api.get<SuscripcionRiesgo[]>('/admin/riesgo').then((r) => setSubs(r.data)).finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  return (
    <Card className={`mt-2 ${panel}`}>
      <CardHeader className="items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-warning" />
        <h3 className="font-display text-lg font-bold">Licencias en riesgo (próximos 7 días)</h3>
        <Chip size="sm" variant="flat" color="warning" className="ml-auto">{subs.length}</Chip>
      </CardHeader>
      <CardBody className="gap-2">
        {cargando ? (
          <Spinner />
        ) : subs.length === 0 ? (
          <p className="py-6 text-center text-small text-default-400">Ninguna licencia en riesgo. 🎉</p>
        ) : (
          subs.map((s) => (
            <button
              key={s.empresa_id}
              onClick={() => setDetalleId(s.empresa_id)}
              className="flex items-center gap-3 rounded-large bg-default-50 px-3 py-2 text-left transition-colors hover:bg-default-100"
            >
              <AlertTriangle className={`h-4 w-4 ${s.dias_restantes <= 2 ? 'text-danger' : 'text-warning'}`} />
              <span className="flex-1 text-small font-medium">{s.empresa}</span>
              <Chip size="sm" variant="flat" color={ESTADO_COLOR[s.estado] ?? 'default'}>{s.estado}</Chip>
              <span className={`text-small font-semibold ${s.dias_restantes <= 2 ? 'text-danger' : 'text-warning'}`}>
                {s.dias_restantes}d
              </span>
            </button>
          ))
        )}
      </CardBody>
      <EmpresaDetalleModal id={detalleId} onClose={() => setDetalleId(null)} onChanged={cargar} />
    </Card>
  )
}

/* ─────────────── Planes ─────────────── */
function PlanesTab({ panel }: { panel: string }) {
  const [planes, setPlanes] = useState<Plan[]>([])
  const [cargando, setCargando] = useState(true)
  const [editar, setEditar] = useState<Plan | null>(null)
  const modal = useDisclosure()

  function cargar() {
    setCargando(true)
    api.get<Plan[]>('/admin/planes').then((r) => setPlanes(r.data)).finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  function abrir(p: Plan | null) {
    setEditar(p)
    modal.onOpen()
  }

  const lim = (v: number) => (v === 0 ? '∞' : String(v))

  return (
    <Card className={`mt-2 ${panel}`}>
      <CardHeader className="items-center gap-2">
        <Tags className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-bold">Planes</h3>
        <Button className="ml-auto" color="primary" startContent={<Plus className="h-4 w-4" />} onPress={() => abrir(null)}>Crear plan</Button>
      </CardHeader>
      <CardBody>
        {cargando ? (
          <Spinner />
        ) : (
          <Table aria-label="Planes" removeWrapper>
            <TableHeader>
              <TableColumn>PLAN</TableColumn>
              <TableColumn>PRECIO/MES</TableColumn>
              <TableColumn>LÍMITES (suc/usr/prod)</TableColumn>
              <TableColumn>EMPRESAS</TableColumn>
              <TableColumn>MRR</TableColumn>
              <TableColumn className="text-right">ACCIÓN</TableColumn>
            </TableHeader>
            <TableBody>
              {planes.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{p.nombre}</p>
                      {!p.activo && <Chip size="sm" variant="flat" color="danger">inactivo</Chip>}
                      {!p.visible && <Chip size="sm" variant="flat">oculto</Chip>}
                    </div>
                    <p className="text-tiny text-default-400">{p.codigo}</p>
                  </TableCell>
                  <TableCell className="font-semibold">{usd(p.precio_mensual_usd)}</TableCell>
                  <TableCell className="text-small">{lim(p.max_sucursales)} / {lim(p.max_usuarios)} / {lim(p.max_productos)}</TableCell>
                  <TableCell>{p.empresas ?? 0} <span className="text-tiny text-default-400">({p.en_trial ?? 0} trial)</span></TableCell>
                  <TableCell className="font-semibold text-success">{usd(p.mrr_plan ?? 0)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button isIconOnly size="sm" variant="flat" aria-label="Editar" onPress={() => abrir(p)}><Pencil className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardBody>
      <PlanModal isOpen={modal.isOpen} onOpenChange={modal.onOpenChange} plan={editar} onSaved={cargar} />
    </Card>
  )
}

/* ─────────────── Modal: detalle de empresa ─────────────── */
function EmpresaDetalleModal({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<EmpresaDetalle | null>(null)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [accion, setAccion] = useState(false)

  useEffect(() => {
    if (id == null) { setD(null); return }
    setD(null)
    api.get<EmpresaDetalle>(`/admin/empresas/${id}`).then((r) => setD(r.data)).catch(() => {})
    api.get<Plan[]>('/admin/planes').then((r) => setPlanes(r.data)).catch(() => {})
  }, [id])

  async function hacer(fn: () => Promise<unknown>) {
    setAccion(true)
    try { await fn(); if (id != null) { const r = await api.get<EmpresaDetalle>(`/admin/empresas/${id}`); setD(r.data) } onChanged() } finally { setAccion(false) }
  }
  const extender = () => {
    const meses = Number(window.prompt('¿Cuántos meses extender?', '1'))
    if (meses > 0) hacer(() => api.post(`/admin/empresas/${id}/extender`, { meses }))
  }
  const cambiarPlan = (planId: string) => hacer(() => api.post(`/admin/empresas/${id}/plan`, { plan_id: Number(planId) }))
  const suspender = () => { const motivo = window.prompt('Motivo de suspensión:') ?? ''; hacer(() => api.post(`/admin/empresas/${id}/suspender`, { motivo })) }
  const activar = () => hacer(() => api.post(`/admin/empresas/${id}/activar`))

  const sus = d?.suscripcion
  return (
    <Modal isOpen={id != null} onOpenChange={(o) => !o && onClose()} size="2xl" scrollBehavior="inside">
      <ModalContent>
        {(cerrar) => (
          <>
            <ModalHeader className="font-display">{d?.empresa.nombre ?? 'Empresa'}</ModalHeader>
            <ModalBody className="gap-4">
              {!d ? (
                <Spinner label="Cargando…" />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-small text-default-500">
                    <span>{d.empresa.rif}</span>
                    {d.empresa.email && <span>· {d.empresa.email}</span>}
                    {d.empresa.telefono && <span>· {d.empresa.telefono}</span>}
                  </div>

                  {/* Licencia */}
                  <Card className="bg-default-50 shadow-none">
                    <CardBody className="gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Licencia</span>
                        <Chip size="sm" variant="flat" color={ESTADO_COLOR[sus?.estado ?? 'sin_suscripcion'] ?? 'default'}>{sus?.estado ?? 'sin'}</Chip>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-small">
                        <span>Plan: <b>{sus?.plan?.nombre ?? '—'}</b></span>
                        <span>Días restantes: <b>{d.dias_restantes}</b></span>
                        <span>Vence: <b>{sus?.vence_el ? fecha(sus.vence_el) : '—'}</b></span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <Button size="sm" color="primary" variant="flat" isLoading={accion} startContent={<CalendarPlus className="h-4 w-4" />} onPress={extender}>Extender vigencia</Button>
                        <Select
                          size="sm" label="Cambiar plan" variant="bordered" className="max-w-[180px]"
                          selectedKeys={sus?.plan_id ? [String(sus.plan_id)] : []}
                          onChange={(e) => e.target.value && cambiarPlan(e.target.value)}
                        >
                          {planes.map((p) => <SelectItem key={String(p.id)}>{p.nombre}</SelectItem>)}
                        </Select>
                        {sus?.estado === 'suspendida' ? (
                          <Button size="sm" color="success" variant="flat" startContent={<Play className="h-4 w-4" />} onPress={activar}>Reactivar</Button>
                        ) : (
                          <Button size="sm" color="danger" variant="flat" startContent={<Ban className="h-4 w-4" />} onPress={suspender}>Suspender</Button>
                        )}
                      </div>
                    </CardBody>
                  </Card>

                  {/* Uso */}
                  <div className="grid grid-cols-3 gap-3">
                    <MiniUso label="Ventas" value={d.uso.ventas} />
                    <MiniUso label="Productos" value={d.uso.productos} />
                    <MiniUso label="Clientes" value={d.uso.clientes} />
                  </div>

                  {/* Usuarios y sucursales */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-tiny font-semibold uppercase text-default-400">Usuarios ({d.usuarios.length})</p>
                      <div className="flex flex-col gap-1">
                        {d.usuarios.map((u) => (
                          <div key={u.id} className="flex items-center gap-2 text-small">
                            <Avatar name={u.name.charAt(0)} size="sm" className="h-6 w-6 text-tiny" />
                            <span className="flex-1 truncate">{u.name}</span>
                            <Chip size="sm" variant="flat">{u.rol}</Chip>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-tiny font-semibold uppercase text-default-400">Sucursales ({d.sucursales.length})</p>
                      <div className="flex flex-col gap-1 text-small">
                        {d.sucursales.map((s) => <span key={s.id}>{s.nombre} <span className="text-default-400">({s.codigo})</span></span>)}
                      </div>
                    </div>
                  </div>

                  {/* Pagos */}
                  <div>
                    <p className="mb-1 text-tiny font-semibold uppercase text-default-400">Historial de pagos</p>
                    {d.pagos.length === 0 ? (
                      <p className="text-small text-default-400">Sin pagos.</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {d.pagos.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 text-tiny">
                            <Chip size="sm" variant="flat" color={p.estado === 'confirmado' ? 'success' : p.estado === 'rechazado' ? 'danger' : 'warning'}>{p.estado}</Chip>
                            <span>{usd(p.monto_usd)} · {p.meses}m · {p.metodo}</span>
                            <span className="ml-auto text-default-400">{fecha(p.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={cerrar}>Cerrar</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

function MiniUso({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-large bg-default-50 px-3 py-2 text-center">
      <p className="font-display text-xl font-bold">{value}</p>
      <p className="text-tiny text-default-500">{label}</p>
    </div>
  )
}

/* ─────────────── Modal: crear empresa ─────────────── */
function CrearEmpresaModal({ isOpen, onOpenChange, onCreated }: { isOpen: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [planes, setPlanes] = useState<Plan[]>([])
  const [f, setF] = useState({ empresa_nombre: '', rif: '', admin_nombre: '', email: '', password: '', plan_id: '', estado: 'trialing' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) api.get<Plan[]>('/admin/planes').then((r) => { setPlanes(r.data); setF((x) => ({ ...x, plan_id: String(r.data[0]?.id ?? '') })) }).catch(() => {})
  }, [isOpen])

  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }))

  async function guardar(cerrar: () => void) {
    setGuardando(true); setError('')
    try {
      await api.post('/admin/empresas', { ...f, plan_id: Number(f.plan_id) })
      onCreated(); cerrar()
      setF({ empresa_nombre: '', rif: '', admin_nombre: '', email: '', password: '', plan_id: '', estado: 'trialing' })
    } catch {
      setError('No se pudo crear (¿correo ya usado?).')
    } finally { setGuardando(false) }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
      <ModalContent>
        {(cerrar) => (
          <>
            <ModalHeader className="font-display">Crear empresa</ModalHeader>
            <ModalBody className="gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nombre de la empresa" variant="bordered" value={f.empresa_nombre} onValueChange={(v) => set('empresa_nombre', v)} isRequired />
                <Input label="RIF" variant="bordered" value={f.rif} onValueChange={(v) => set('rif', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nombre del admin" variant="bordered" value={f.admin_nombre} onValueChange={(v) => set('admin_nombre', v)} isRequired />
                <Input label="Correo" type="email" variant="bordered" value={f.email} onValueChange={(v) => set('email', v)} isRequired />
              </div>
              <Input label="Contraseña" type="password" variant="bordered" value={f.password} onValueChange={(v) => set('password', v)} isRequired />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Plan" variant="bordered" selectedKeys={f.plan_id ? [f.plan_id] : []} onChange={(e) => set('plan_id', e.target.value)}>
                  {planes.map((p) => <SelectItem key={String(p.id)}>{p.nombre}</SelectItem>)}
                </Select>
                <Select label="Estado inicial" variant="bordered" selectedKeys={[f.estado]} onChange={(e) => e.target.value && set('estado', e.target.value)}>
                  <SelectItem key="trialing">Prueba (trial)</SelectItem>
                  <SelectItem key="activa">Activa (pagada)</SelectItem>
                </Select>
              </div>
              {error && <p className="text-small text-danger">{error}</p>}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={cerrar}>Cancelar</Button>
              <Button color="primary" isLoading={guardando} onPress={() => guardar(cerrar)}>Crear</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

/* ─────────────── Modal: crear/editar plan ─────────────── */
function PlanModal({ isOpen, onOpenChange, plan, onSaved }: { isOpen: boolean; onOpenChange: (o: boolean) => void; plan: Plan | null; onSaved: () => void }) {
  const vacio = { codigo: '', nombre: '', descripcion: '', precio_mensual_usd: '', max_sucursales: '1', max_usuarios: '3', max_productos: '0', dias_trial: '14', dias_gracia: '5', orden: '0', visible: true, activo: true }
  const [f, setF] = useState(vacio)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    if (plan) setF({ codigo: plan.codigo, nombre: plan.nombre, descripcion: plan.descripcion ?? '', precio_mensual_usd: String(plan.precio_mensual_usd), max_sucursales: String(plan.max_sucursales), max_usuarios: String(plan.max_usuarios), max_productos: String(plan.max_productos), dias_trial: String(plan.dias_trial), dias_gracia: String(plan.dias_gracia ?? 5), orden: String(plan.orden), visible: plan.visible ?? true, activo: plan.activo ?? true })
    else setF(vacio)
  }, [isOpen, plan])

  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }))

  async function guardar(cerrar: () => void) {
    setGuardando(true); setError('')
    const payload = { ...f, precio_mensual_usd: n(f.precio_mensual_usd), max_sucursales: Number(f.max_sucursales), max_usuarios: Number(f.max_usuarios), max_productos: Number(f.max_productos), dias_trial: Number(f.dias_trial), dias_gracia: Number(f.dias_gracia), orden: Number(f.orden) }
    try {
      if (plan) await api.put(`/admin/planes/${plan.id}`, payload)
      else await api.post('/admin/planes', payload)
      onSaved(); cerrar()
    } catch {
      setError('No se pudo guardar (¿código repetido?).')
    } finally { setGuardando(false) }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg" scrollBehavior="inside">
      <ModalContent>
        {(cerrar) => (
          <>
            <ModalHeader className="font-display">{plan ? 'Editar plan' : 'Crear plan'}</ModalHeader>
            <ModalBody className="gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Código" variant="bordered" value={f.codigo} onValueChange={(v) => set('codigo', v)} isRequired />
                <Input label="Nombre" variant="bordered" value={f.nombre} onValueChange={(v) => set('nombre', v)} isRequired />
              </div>
              <Input label="Descripción" variant="bordered" value={f.descripcion} onValueChange={(v) => set('descripcion', v)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Precio mensual (USD)" type="number" variant="bordered" value={f.precio_mensual_usd} onValueChange={(v) => set('precio_mensual_usd', v)} startContent={<span className="text-tiny text-default-400">$</span>} isRequired />
                <Input label="Orden" type="number" variant="bordered" value={f.orden} onValueChange={(v) => set('orden', v)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Máx sucursales" type="number" variant="bordered" value={f.max_sucursales} onValueChange={(v) => set('max_sucursales', v)} description="0 = ∞" />
                <Input label="Máx usuarios" type="number" variant="bordered" value={f.max_usuarios} onValueChange={(v) => set('max_usuarios', v)} description="0 = ∞" />
                <Input label="Máx productos" type="number" variant="bordered" value={f.max_productos} onValueChange={(v) => set('max_productos', v)} description="0 = ∞" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Días de prueba" type="number" variant="bordered" value={f.dias_trial} onValueChange={(v) => set('dias_trial', v)} />
                <Input label="Días de gracia" type="number" variant="bordered" value={f.dias_gracia} onValueChange={(v) => set('dias_gracia', v)} />
              </div>
              <div className="flex gap-6">
                <Switch isSelected={f.visible} onValueChange={(v) => set('visible', v)}><span className="text-small">Visible en pricing</span></Switch>
                <Switch isSelected={f.activo} onValueChange={(v) => set('activo', v)}><span className="text-small">Activo</span></Switch>
              </div>
              {error && <p className="text-small text-danger">{error}</p>}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={cerrar}>Cancelar</Button>
              <Button color="primary" isLoading={guardando} onPress={() => guardar(cerrar)}>{plan ? 'Guardar' : 'Crear'}</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

/* ─────────────── helpers ─────────────── */
function Cargando({ label }: { label: string }) {
  return <div className="flex justify-center py-20"><Spinner label={label} /></div>
}

function Stat({ panel, tone, icon, label, value, detail }: { panel: string; tone: string; icon: ReactNode; label: string; value: string; detail?: string }) {
  return (
    <Card className={panel}>
      <CardBody className="flex-row items-center gap-3 py-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-bold leading-none">{value}</p>
          <p className="text-tiny text-default-500">{label}{detail ? ` · ${detail}` : ''}</p>
        </div>
      </CardBody>
    </Card>
  )
}
