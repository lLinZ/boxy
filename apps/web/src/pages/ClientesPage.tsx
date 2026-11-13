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
  Textarea,
  useDisclosure,
} from '@heroui/react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Contact, HandCoins, MessageCircle, Pencil, Phone, Search, UserPlus } from 'lucide-react'
import { api, mensajeError } from '../lib/api'
import { fecha, n, usd } from '../lib/format'
import { abrirWhatsApp, textoEstadoCuenta } from '../lib/whatsapp'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import type { Cliente, Paginated, PorCobrar } from '../types'

export const TIPOS_DOC = [
  { key: 'V', label: 'V — Venezolano' },
  { key: 'E', label: 'E — Extranjero' },
  { key: 'J', label: 'J — Jurídico (RIF)' },
  { key: 'G', label: 'G — Gubernamental' },
  { key: 'P', label: 'P — Pasaporte' },
]

interface Form {
  id: number | null
  tipo_documento: string
  documento: string
  nombre: string
  telefono: string
  email: string
  direccion: string
  fecha_nacimiento: string
  notas: string
  credito_habilitado: boolean
  limite_credito_usd: string
}

const formVacio: Form = {
  id: null,
  tipo_documento: 'V',
  documento: '',
  nombre: '',
  telefono: '',
  email: '',
  direccion: '',
  fecha_nacimiento: '',
  notas: '',
  credito_habilitado: false,
  limite_credito_usd: '',
}

export function ClientesPage() {
  const { panel } = useTheme()
  const { puede, empresa, ajustes } = useAuth()
  const navigate = useNavigate()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [porCobrar, setPorCobrar] = useState<PorCobrar | null>(null)
  const [buscar, setBuscar] = useState('')
  const [soloDeuda, setSoloDeuda] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Form>(formVacio)
  const { isOpen, onOpen, onOpenChange } = useDisclosure()
  const veCobranza = puede('fiado.configurar', 'reportes.ver')

  const recargar = useCallback(() => {
    return api
      .get<Paginated<Cliente>>('/clientes', { params: { buscar, per_page: 50, con_deuda: soloDeuda || undefined, orden: soloDeuda ? 'deuda' : undefined } })
      .then((r) => setClientes(r.data.data))
      .finally(() => setCargando(false))
  }, [buscar, soloDeuda])

  useEffect(() => {
    setCargando(true)
    const t = setTimeout(recargar, 250)
    return () => clearTimeout(t)
  }, [recargar])

  useEffect(() => {
    if (veCobranza) api.get<PorCobrar>('/clientes/por-cobrar').then((r) => setPorCobrar(r.data)).catch(() => {})
  }, [veCobranza])

  function abrirNuevo() {
    setForm({ ...formVacio, limite_credito_usd: String(ajustes?.fiado_limite_defecto_usd ?? '') })
    setError('')
    onOpen()
  }

  function abrirEditar(c: Cliente) {
    setForm({
      id: c.id,
      tipo_documento: c.tipo_documento,
      documento: c.documento,
      nombre: c.nombre,
      telefono: c.telefono ?? '',
      email: c.email ?? '',
      direccion: c.direccion ?? '',
      fecha_nacimiento: c.fecha_nacimiento ?? '',
      notas: c.notas ?? '',
      credito_habilitado: !!c.credito_habilitado,
      limite_credito_usd: c.limite_credito_usd ?? '',
    })
    setError('')
    onOpen()
  }

  async function guardar(onClose: () => void) {
    setGuardando(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        tipo_documento: form.tipo_documento,
        documento: form.documento,
        nombre: form.nombre,
        telefono: form.telefono || null,
        email: form.email || null,
        direccion: form.direccion || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        notas: form.notas || null,
      }
      if (puede('fiado.configurar')) {
        payload.credito_habilitado = form.credito_habilitado
        payload.limite_credito_usd = n(form.limite_credito_usd)
      }
      if (form.id) await api.put(`/clientes/${form.id}`, payload)
      else await api.post('/clientes', payload)
      await recargar()
      onClose()
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar.'))
    } finally {
      setGuardando(false)
    }
  }

  const listado = (
    <Card className={panel}>
      <CardHeader className="flex-col items-stretch gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Contact className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Clientes</h2>
            <Chip size="sm" variant="flat">{clientes.length}</Chip>
          </div>
          <Button color="primary" startContent={<UserPlus className="h-4 w-4" />} onPress={abrirNuevo}>
            Nuevo cliente
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="min-w-[220px] flex-1"
            placeholder="Buscar por nombre, cédula/RIF o teléfono…"
            value={buscar}
            onValueChange={setBuscar}
            variant="bordered"
            isClearable
            startContent={<Search className="h-4 w-4 text-default-400" />}
          />
          <Switch size="sm" isSelected={soloDeuda} onValueChange={setSoloDeuda}>Solo con deuda</Switch>
        </div>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        {cargando ? (
          <div className="flex justify-center py-10">
            <Spinner label="Cargando clientes…" />
          </div>
        ) : (
          <Table aria-label="Clientes" removeWrapper className="min-w-[640px]" selectionMode="none" onRowAction={(k) => navigate(`/clientes/${k}`)}>
            <TableHeader>
              <TableColumn>CLIENTE</TableColumn>
              <TableColumn>DOCUMENTO</TableColumn>
              <TableColumn>TELÉFONO</TableColumn>
              <TableColumn>FIADO</TableColumn>
              <TableColumn className="text-right">ACCIONES</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Sin clientes. Crea el primero o regístralos desde el POS.">
              {clientes.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={c.nombre.charAt(0)} size="sm" />
                      <div>
                        <p className="font-medium">{c.nombre}</p>
                        {ajustes?.puntos_activo && <p className="text-tiny text-default-400">{c.puntos ?? 0} puntos</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color="primary">{c.tipo_documento}-{c.documento}</Chip>
                  </TableCell>
                  <TableCell>
                    {c.telefono ? (
                      <span className="flex items-center gap-1 text-small"><Phone className="h-3.5 w-3.5 text-default-400" /> {c.telefono}</span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {c.credito_habilitado ? (
                      <Chip size="sm" variant="flat" color={n(c.saldo_usd ?? 0) > 0 ? 'warning' : 'success'}>
                        {n(c.saldo_usd ?? 0) > 0 ? `debe ${usd(c.saldo_usd!)}` : 'al día'}
                      </Chip>
                    ) : n(c.saldo_usd ?? 0) !== 0 ? (
                      <Chip size="sm" variant="flat" color="warning">{usd(c.saldo_usd!)}</Chip>
                    ) : (
                      <span className="text-tiny text-default-400">no</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button isIconOnly size="sm" variant="flat" aria-label="Editar" onPress={() => abrirEditar(c)}>
                        <Pencil className="h-4 w-4" />
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
  )

  return (
    <>
      {veCobranza ? (
        <Tabs aria-label="Clientes" variant="underlined" color="primary">
          <Tab key="clientes" title="Clientes">{listado}</Tab>
          <Tab
            key="cobrar"
            title={<span className="flex items-center gap-1"><HandCoins className="h-4 w-4" /> Por cobrar {porCobrar ? `(${usd(porCobrar.total_usd)})` : ''}</span>}
          >
            <Card className={panel}>
              <CardHeader className="flex-col items-start gap-1">
                <h2 className="font-display text-xl font-bold">Cuentas por cobrar (fiado)</h2>
                <p className="text-small text-default-500">Total pendiente: <b>{usd(porCobrar?.total_usd ?? 0)}</b></p>
              </CardHeader>
              <CardBody className="overflow-x-auto">
                <Table aria-label="Por cobrar" removeWrapper className="min-w-[600px]" onRowAction={(k) => navigate(`/clientes/${k}`)}>
                  <TableHeader>
                    <TableColumn>CLIENTE</TableColumn>
                    <TableColumn>DEBE</TableColumn>
                    <TableColumn>LÍMITE</TableColumn>
                    <TableColumn>ÚLTIMO ABONO</TableColumn>
                    <TableColumn className="text-right">RECORDAR</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="Nadie debe nada. 🎉">
                    {(porCobrar?.clientes ?? []).map((c) => (
                      <TableRow key={c.id} className="cursor-pointer">
                        <TableCell>{c.nombre}</TableCell>
                        <TableCell className="font-semibold text-warning">{usd(c.saldo_usd ?? 0)}</TableCell>
                        <TableCell>{usd(c.limite_credito_usd ?? 0)}</TableCell>
                        <TableCell>{c.ultimo_abono ? fecha(c.ultimo_abono) : 'nunca'}</TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="flat"
                              color="success"
                              isDisabled={!c.telefono}
                              startContent={<MessageCircle className="h-4 w-4" />}
                              onPress={() => abrirWhatsApp(c.telefono, textoEstadoCuenta(c, empresa?.empresa.nombre ?? 'la tienda'), ajustes?.whatsapp_codigo_pais)}
                            >
                              WhatsApp
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
      ) : (
        listado
      )}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg" scrollBehavior="inside" placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="font-display">{form.id ? 'Editar cliente' : 'Nuevo cliente'}</ModalHeader>
              <ModalBody className="gap-4">
                <div className="grid grid-cols-[110px_1fr] gap-3">
                  <Select label="Tipo" variant="bordered" selectedKeys={[form.tipo_documento]} onChange={(e) => e.target.value && setForm((f) => ({ ...f, tipo_documento: e.target.value }))}>
                    {TIPOS_DOC.map((t) => (
                      <SelectItem key={t.key}>{t.key}</SelectItem>
                    ))}
                  </Select>
                  <Input label="Cédula / RIF" variant="bordered" value={form.documento} onValueChange={(v) => setForm((f) => ({ ...f, documento: v }))} isRequired />
                </div>
                <Input label="Nombre o razón social" variant="bordered" value={form.nombre} onValueChange={(v) => setForm((f) => ({ ...f, nombre: v }))} isRequired />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Teléfono (WhatsApp)" variant="bordered" value={form.telefono} onValueChange={(v) => setForm((f) => ({ ...f, telefono: v }))} placeholder="0414-1234567" />
                  <Input label="Correo" type="email" variant="bordered" value={form.email} onValueChange={(v) => setForm((f) => ({ ...f, email: v }))} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Dirección" variant="bordered" value={form.direccion} onValueChange={(v) => setForm((f) => ({ ...f, direccion: v }))} />
                  <Input label="Cumpleaños" type="date" variant="bordered" value={form.fecha_nacimiento} onValueChange={(v) => setForm((f) => ({ ...f, fecha_nacimiento: v }))} />
                </div>
                <Textarea label="Notas" variant="bordered" minRows={2} value={form.notas} onValueChange={(v) => setForm((f) => ({ ...f, notas: v }))} placeholder="Preferencias, horarios, a quién se le fía…" />
                {puede('fiado.configurar') && (
                  <div className="flex flex-wrap items-center gap-3 rounded-large bg-default-50 p-3">
                    <Switch isSelected={form.credito_habilitado} onValueChange={(v) => setForm((f) => ({ ...f, credito_habilitado: v }))}>
                      Puede comprar fiado
                    </Switch>
                    {form.credito_habilitado && (
                      <Input
                        className="max-w-[180px]"
                        size="sm"
                        label="Límite (USD)"
                        variant="bordered"
                        inputMode="decimal"
                        value={form.limite_credito_usd}
                        onValueChange={(v) => setForm((f) => ({ ...f, limite_credito_usd: v }))}
                      />
                    )}
                  </div>
                )}
                {error && <p className="text-small text-danger">{error}</p>}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancelar</Button>
                <Button color="primary" isLoading={guardando} onPress={() => guardar(onClose)}>
                  {form.id ? 'Guardar' : 'Crear cliente'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}
