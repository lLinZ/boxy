import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { useCallback, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

export interface Autorizacion {
  email: string
  pin: string
}

/**
 * Pide la autorización de un supervisor (correo + PIN) cuando el cajero
 * intenta algo que su rol no permite (descuento, anulación, devolución, fiar
 * de más). Uso:
 *   const supervisor = useSupervisor()
 *   const aut = await supervisor.pedir('Anular la venta 00000123')
 *   ...
 *   {supervisor.modal}
 */
export function useSupervisor() {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const resolver = useRef<((a: Autorizacion | null) => void) | null>(null)

  const pedir = useCallback((texto: string, errorPrevio = ''): Promise<Autorizacion | null> => {
    setMotivo(texto)
    setError(errorPrevio)
    setPin('')
    setAbierto(true)
    return new Promise((ok) => {
      resolver.current = ok
    })
  }, [])

  const cerrar = (valor: Autorizacion | null) => {
    setAbierto(false)
    resolver.current?.(valor)
    resolver.current = null
  }

  const modal = (
    <Modal isOpen={abierto} onOpenChange={(o) => !o && cerrar(null)} size="sm" placement="center">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 font-display">
          <ShieldCheck className="h-5 w-5 text-warning" /> Autorización de supervisor
        </ModalHeader>
        <ModalBody className="gap-3">
          <p className="text-small text-default-600">{motivo}</p>
          <Input
            label="Correo del supervisor"
            type="email"
            variant="bordered"
            value={email}
            onValueChange={setEmail}
            autoComplete="off"
          />
          <Input
            label="PIN"
            type="password"
            inputMode="numeric"
            variant="bordered"
            value={pin}
            onValueChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && email && pin.length >= 4 && cerrar({ email, pin })}
            autoFocus
          />
          {error && <p className="text-small text-danger">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={() => cerrar(null)}>
            Cancelar
          </Button>
          <Button color="warning" isDisabled={!email || pin.length < 4} onPress={() => cerrar({ email, pin })}>
            Autorizar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )

  return { pedir, modal }
}
