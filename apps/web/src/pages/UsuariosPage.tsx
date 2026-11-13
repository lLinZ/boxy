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
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  useDisclosure,
} from '@heroui/react'
import { useEffect, useState } from 'react'
import { Lock, Mail, Pencil, ShieldCheck, UserPlus } from 'lucide-react'
import { api, mensajeError } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import type { Sucursal, User } from '../types'

const ROLES = [
  { key: 'admin', label: 'Administrador', desc: 'Todo: usuarios, empresa, precios, reportes y caja.' },
  { key: 'gerente', label: 'Gerente', desc: 'Caja, precios, compras, reportes; autoriza anulaciones y descuentos.' },
  { key: 'cajero', label: 'Cajero', desc: 'Vende, abre y cierra su caja, registra clientes y abonos. Sin costos ni reportes.' },
  { key: 'inventario', label: 'Inventario', desc: 'Productos, compras y movimientos de stock. No vende.' },
]

const ROL_COLOR: Record<string, 'primary' | 'secondary' | 'success' | 'warning'> = {
  admin: 'primary',
  gerente: 'secondary',
  cajero: 'success',
  inventario: 'warning',
}

interface Form {
  id: number | null
  name: string
  email: string
  password: string
  rol: string
  sucursal_id: string
  pin: string
  activo: boolean
  tiene_pin: boolean
}

const formVacio: Form = { id: null, name: '', email: '', password: '', rol: 'cajero', sucursal_id: '', pin: '', activo: true, tiene_pin: false }

export function UsuariosPage() {
  const { user: yo } = useAuth()
  const { panel } = useTheme()
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Form>(formVacio)
  const { isOpen, onOpen, onOpenChange } = useDisclosure()

  function cargar() {
    setCargando(true)
    Promise.all([api.get<User[]>('/usuarios'), api.get<Sucursal[]>('/sucursales')])
      .then(([u, s]) => {
        setUsuarios(u.data)
        setSucursales(s.data)
      })
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [])

  function abrirNuevo() {
    setForm({ ...formVacio, sucursal_id: String(sucursales[0]?.id ?? '') })
    setError('')
    onOpen()
  }

  function abrirEditar(u: User) {
    setForm({
      id: u.id,
      name: u.name,
      email: u.email,
      password: '',
      rol: u.rol,
      sucursal_id: String(u.sucursal_id ?? ''),
      pin: '',
      activo: Boolean(u.activo),
      tiene_pin: !!u.tiene_pin,
    })
    setError('')
    onOpen()
  }

  async function guardar(onClose: () => void) {
    setGuardando(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        email: form.email,
        rol: form.rol,
        sucursal_id: Number(form.sucursal_id),
        ...(form.password ? { password: form.password } : {}),
        ...(form.pin ? { pin: form.pin } : {}),
        ...(form.id ? { activo: form.activo } : {}),
      }
      if (form.id) {
        await api.put(`/usuarios/${form.id}`, payload)
      } else {
        await api.post('/usuarios', { ...payload, password: form.password })
      }
      cargar()
      onClose()
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar.'))
    } finally {
      setGuardando(false)
    }
  }

  async function desactivar(u: User) {
    if (!confirm(`¿Desactivar a ${u.name}? Sus sesiones se cerrarán.`)) return
    await api.delete(`/usuarios/${u.id}`)
    cargar()
  }

  return (
    <Card className={panel}>
      <CardHeader className="justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Usuarios del sistema</h2>
          <Chip size="sm" variant="flat">{usuarios.length}</Chip>
        </div>
        <Button color="primary" onPress={abrirNuevo} startContent={<UserPlus className="h-4 w-4" />}>
          Nuevo usuario
        </Button>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        {cargando ? (
          <div className="flex justify-center py-10">
            <Spinner label="Cargando usuarios…" />
          </div>
        ) : (
          <Table aria-label="Usuarios" removeWrapper className="min-w-[620px]">
            <TableHeader>
              <TableColumn>USUARIO</TableColumn>
              <TableColumn>ROL</TableColumn>
              <TableColumn>SUCURSAL</TableColumn>
              <TableColumn>ESTADO</TableColumn>
              <TableColumn className="text-right">ACCIONES</TableColumn>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name.charAt(0)} size="sm" color={ROL_COLOR[u.rol] ?? 'default'} />
                      <div>
                        <p className="font-medium">
                          {u.name} {u.id === yo?.id && <span className="text-tiny text-default-400">(tú)</span>}
                        </p>
                        <p className="text-tiny text-default-400">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Chip size="sm" variant="flat" color={ROL_COLOR[u.rol] ?? 'default'}>
                        {ROLES.find((r) => r.key === u.rol)?.label ?? u.rol}
                      </Chip>
                      {u.tiene_pin && <Chip size="sm" variant="flat">PIN</Chip>}
                    </div>
                  </TableCell>
                  <TableCell>{u.sucursal?.nombre ?? '—'}</TableCell>
                  <TableCell>
                    <Chip size="sm" variant="dot" color={u.activo ? 'success' : 'danger'}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button isIconOnly size="sm" variant="flat" aria-label="Editar" onPress={() => abrirEditar(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {u.id !== yo?.id && Boolean(u.activo) && (
                        <Button size="sm" variant="flat" color="danger" onPress={() => desactivar(u)}>
                          Desactivar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardBody>

      {/* Modal crear/editar — inputs `bordered` para buen contraste en modo oscuro */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="md">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="font-display">
                {form.id ? 'Editar usuario' : 'Nuevo usuario'}
              </ModalHeader>
              <ModalBody className="gap-4">
                <Input
                  label="Nombre"
                  variant="bordered"
                  value={form.name}
                  onValueChange={(v) => setForm((f) => ({ ...f, name: v }))}
                  isRequired
                />
                <Input
                  label="Correo"
                  type="email"
                  variant="bordered"
                  value={form.email}
                  onValueChange={(v) => setForm((f) => ({ ...f, email: v }))}
                  startContent={<Mail className="h-4 w-4 text-default-400" />}
                  isRequired
                />
                <Input
                  label={form.id ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                  type="password"
                  variant="bordered"
                  value={form.password}
                  onValueChange={(v) => setForm((f) => ({ ...f, password: v }))}
                  startContent={<Lock className="h-4 w-4 text-default-400" />}
                  isRequired={!form.id}
                  description="Mínimo 8 caracteres, con letras y números. El usuario la cambia en su primer ingreso."
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Rol"
                    variant="bordered"
                    selectedKeys={[form.rol]}
                    onChange={(e) => e.target.value && setForm((f) => ({ ...f, rol: e.target.value }))}
                  >
                    {ROLES.map((r) => (
                      <SelectItem key={r.key} description={r.desc}>{r.label}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    label="Sucursal"
                    variant="bordered"
                    selectedKeys={form.sucursal_id ? [form.sucursal_id] : []}
                    onChange={(e) => e.target.value && setForm((f) => ({ ...f, sucursal_id: e.target.value }))}
                  >
                    {sucursales.map((s) => (
                      <SelectItem key={String(s.id)}>{s.nombre}</SelectItem>
                    ))}
                  </Select>
                </div>
                {(form.rol === 'admin' || form.rol === 'gerente') && (
                  <Input
                    label={form.tiene_pin ? 'Nuevo PIN de supervisor (opcional)' : 'PIN de supervisor (4 a 6 dígitos)'}
                    type="password"
                    inputMode="numeric"
                    variant="bordered"
                    value={form.pin}
                    onValueChange={(v) => setForm((f) => ({ ...f, pin: v.replace(/\D/g, '').slice(0, 6) }))}
                    description="Con su correo y este PIN autoriza en caja anulaciones, devoluciones y descuentos."
                  />
                )}
                {form.id && form.id !== yo?.id && (
                  <Switch isSelected={form.activo} onValueChange={(v) => setForm((f) => ({ ...f, activo: v }))}>
                    Activo
                  </Switch>
                )}
                {error && <p className="text-small text-danger">{error}</p>}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="primary" isLoading={guardando} onPress={() => guardar(onClose)}>
                  {form.id ? 'Guardar cambios' : 'Crear usuario'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Card>
  )
}
