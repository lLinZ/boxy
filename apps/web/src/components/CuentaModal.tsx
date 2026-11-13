import { Button, Input, Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'
import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { api, mensajeError } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

type Mensaje = { ok: boolean; texto: string } | null

function Aviso({ mensaje }: { mensaje: Mensaje }) {
  if (!mensaje) return null
  return (
    <p role="status" className={`text-small ${mensaje.ok ? 'text-success-600' : 'text-danger'}`}>
      {mensaje.texto}
    </p>
  )
}

/** Cambio de clave propia. Lo usan la página de perfil y el modal obligatorio. */
export function FormClave({ alGuardar }: { alGuardar?: () => void }) {
  const { refrescar } = useAuth()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [mensaje, setMensaje] = useState<Mensaje>(null)
  const [guardando, setGuardando] = useState(false)

  const noCoinciden = repetir.length > 0 && nueva !== repetir

  async function cambiarClave() {
    setGuardando(true)
    setMensaje(null)
    try {
      await api.post('/cuenta/clave', { actual, nueva, nueva_confirmation: repetir })
      setActual('')
      setNueva('')
      setRepetir('')
      await refrescar()
      setMensaje({ ok: true, texto: 'Clave actualizada. Se cerraron tus otras sesiones.' })
      alGuardar?.()
    } catch (e) {
      setMensaje({ ok: false, texto: mensajeError(e) })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        cambiarClave()
      }}
    >
      <Input label="Clave actual" type="password" autoComplete="current-password" variant="bordered" value={actual} onValueChange={setActual} />
      <Input
        label="Clave nueva"
        type="password"
        autoComplete="new-password"
        variant="bordered"
        value={nueva}
        onValueChange={setNueva}
        description="Mínimo 8 caracteres, con letras y números."
      />
      <Input
        label="Repite la clave nueva"
        type="password"
        autoComplete="new-password"
        variant="bordered"
        value={repetir}
        onValueChange={setRepetir}
        isInvalid={noCoinciden}
        errorMessage={noCoinciden ? 'Las claves no coinciden.' : undefined}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" color="primary" isLoading={guardando} isDisabled={!actual || nueva.length < 8 || nueva !== repetir}>
          Cambiar clave
        </Button>
        <Aviso mensaje={mensaje} />
      </div>
    </form>
  )
}

/** PIN de supervisor: con él se autorizan en caja anulaciones, descuentos y fiado. */
export function FormPin() {
  const { user, refrescar } = useAuth()
  const [pin, setPin] = useState('')
  const [clave, setClave] = useState('')
  const [mensaje, setMensaje] = useState<Mensaje>(null)
  const [guardando, setGuardando] = useState(false)

  async function cambiarPin(quitar = false) {
    setGuardando(true)
    setMensaje(null)
    try {
      await api.post('/cuenta/pin', { clave, pin: quitar ? null : pin })
      setPin('')
      setClave('')
      await refrescar()
      setMensaje({ ok: true, texto: quitar ? 'PIN eliminado.' : 'PIN guardado.' })
    } catch (e) {
      setMensaje({ ok: false, texto: mensajeError(e) })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        cambiarPin()
      }}
    >
      <Input
        label="PIN nuevo (4 a 6 dígitos)"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        variant="bordered"
        value={pin}
        onValueChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
      />
      <Input label="Tu clave, para confirmar" type="password" autoComplete="current-password" variant="bordered" value={clave} onValueChange={setClave} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" color="primary" isLoading={guardando} isDisabled={pin.length < 4 || !clave}>
          {user?.tiene_pin ? 'Cambiar PIN' : 'Guardar PIN'}
        </Button>
        {user?.tiene_pin && (
          <Button variant="flat" color="danger" isDisabled={!clave || guardando} onPress={() => cambiarPin(true)}>
            Quitar PIN
          </Button>
        )}
        <Aviso mensaje={mensaje} />
      </div>
    </form>
  )
}

/**
 * Primer ingreso con clave temporal: no se puede cerrar sin cambiarla.
 * (La gestión normal de la cuenta vive en la página Mi perfil.)
 */
export function CuentaModal({ isOpen }: { isOpen: boolean }) {
  return (
    <Modal isOpen={isOpen} isDismissable={false} hideCloseButton isKeyboardDismissDisabled size="md" placement="center">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 font-display">
          <KeyRound className="h-5 w-5 text-primary" /> Cambia tu clave
        </ModalHeader>
        <ModalBody className="pb-6">
          <p className="rounded-medium bg-warning-50 p-3 text-small text-warning-700">
            Por seguridad, cambia la clave temporal antes de continuar.
          </p>
          <FormClave />
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
