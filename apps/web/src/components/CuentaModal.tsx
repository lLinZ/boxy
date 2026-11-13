import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Tab, Tabs } from '@heroui/react'
import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { api, mensajeError } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

interface Props {
  isOpen: boolean
  onOpenChange: (abierto: boolean) => void
  /** Cambio de clave obligatorio (primer ingreso): no se puede cerrar sin cambiarla. */
  obligatorio?: boolean
}

/** Mi cuenta: cambiar la clave y el PIN de supervisor. */
export function CuentaModal({ isOpen, onOpenChange, obligatorio = false }: Props) {
  const { user, refrescar, puede } = useAuth()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [pin, setPin] = useState('')
  const [claveParaPin, setClaveParaPin] = useState('')
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)

  const puedeAutorizar = puede('ventas.anular', 'ventas.descuento', 'fiado.exceder_limite')

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
      if (obligatorio) onOpenChange(false)
    } catch (e) {
      setMensaje({ ok: false, texto: mensajeError(e) })
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarPin(quitar = false) {
    setGuardando(true)
    setMensaje(null)
    try {
      await api.post('/cuenta/pin', { clave: claveParaPin, pin: quitar ? null : pin })
      setPin('')
      setClaveParaPin('')
      await refrescar()
      setMensaje({ ok: true, texto: quitar ? 'PIN eliminado.' : 'PIN guardado.' })
    } catch (e) {
      setMensaje({ ok: false, texto: mensajeError(e) })
    } finally {
      setGuardando(false)
    }
  }

  const formClave = (
    <div className="flex flex-col gap-3">
      {obligatorio && (
        <p className="rounded-medium bg-warning-50 p-3 text-small text-warning-700">
          Por seguridad, cambia la clave temporal antes de continuar.
        </p>
      )}
      <Input label="Clave actual" type="password" variant="bordered" value={actual} onValueChange={setActual} />
      <Input
        label="Clave nueva"
        type="password"
        variant="bordered"
        value={nueva}
        onValueChange={setNueva}
        description="Mínimo 8 caracteres, con letras y números."
      />
      <Input label="Repite la clave nueva" type="password" variant="bordered" value={repetir} onValueChange={setRepetir} />
      <Button color="primary" isLoading={guardando} isDisabled={!actual || nueva.length < 8 || nueva !== repetir} onPress={cambiarClave}>
        Cambiar clave
      </Button>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={!obligatorio}
      hideCloseButton={obligatorio}
      isKeyboardDismissDisabled={obligatorio}
      size="md"
      placement="center"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 font-display">
          <KeyRound className="h-5 w-5 text-primary" /> {obligatorio ? 'Cambia tu clave' : 'Mi cuenta'}
        </ModalHeader>
        <ModalBody>
          {obligatorio || !puedeAutorizar ? (
            formClave
          ) : (
            <Tabs aria-label="Opciones de cuenta" fullWidth>
              <Tab key="clave" title="Clave">
                {formClave}
              </Tab>
              <Tab key="pin" title="PIN de supervisor">
                <div className="flex flex-col gap-3">
                  <p className="text-small text-default-500">
                    Con tu correo y este PIN autorizas en caja anulaciones, devoluciones, descuentos y fiado por
                    encima del límite. {user?.tiene_pin ? 'Ya tienes un PIN configurado.' : 'Aún no tienes PIN.'}
                  </p>
                  <Input
                    label="PIN nuevo (4 a 6 dígitos)"
                    type="password"
                    inputMode="numeric"
                    variant="bordered"
                    value={pin}
                    onValueChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
                  />
                  <Input label="Tu clave (para confirmar)" type="password" variant="bordered" value={claveParaPin} onValueChange={setClaveParaPin} />
                  <div className="flex gap-2">
                    <Button color="primary" className="flex-1" isLoading={guardando} isDisabled={pin.length < 4 || !claveParaPin} onPress={() => cambiarPin()}>
                      Guardar PIN
                    </Button>
                    {user?.tiene_pin && (
                      <Button variant="flat" color="danger" isDisabled={!claveParaPin} onPress={() => cambiarPin(true)}>
                        Quitar
                      </Button>
                    )}
                  </div>
                </div>
              </Tab>
            </Tabs>
          )}
          {mensaje && <p className={`text-small ${mensaje.ok ? 'text-success' : 'text-danger'}`}>{mensaje.texto}</p>}
        </ModalBody>
        <ModalFooter>
          {!obligatorio && (
            <Button variant="light" onPress={() => onOpenChange(false)}>
              Cerrar
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
