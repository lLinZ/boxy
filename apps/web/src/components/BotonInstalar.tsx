import { useEffect, useState } from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from '@heroui/react'
import { Download, Share, SquarePlus } from 'lucide-react'
import { alCambiarInstalacion, esAppInstalada, esIOS, instalar, puedeInstalarDirecto } from '../lib/instalar'

/**
 * Botón "Instalar app": en Chrome/Edge/Android abre el diálogo del navegador; en
 * iPhone/iPad explica cómo agregarla al inicio. No aparece si ya está instalada.
 */
export function BotonInstalar({ className = '', compacto = false }: { className?: string; compacto?: boolean }) {
  const [, refrescar] = useState(0)
  const ayuda = useDisclosure()

  useEffect(() => alCambiarInstalacion(() => refrescar((n) => n + 1)), [])

  if (esAppInstalada()) return null
  const directo = puedeInstalarDirecto()
  const ios = esIOS()
  if (!directo && !ios) return null

  return (
    <>
      <Button
        size="sm"
        variant="flat"
        color="primary"
        className={className}
        startContent={<Download className="h-4 w-4" />}
        isIconOnly={compacto}
        aria-label="Instalar Boxy como app"
        onPress={() => (directo ? void instalar() : ayuda.onOpen())}
      >
        {compacto ? null : 'Instalar app'}
      </Button>
      <Modal isOpen={ayuda.isOpen} onOpenChange={ayuda.onOpenChange} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Instalar Boxy en tu iPhone o iPad</ModalHeader>
              <ModalBody className="gap-3 text-small">
                <p className="flex items-center gap-2">
                  1. Toca <Share className="h-4 w-4" /> <b>Compartir</b> en la barra de Safari.
                </p>
                <p className="flex items-center gap-2">
                  2. Elige <SquarePlus className="h-4 w-4" /> <b>Agregar a inicio</b>.
                </p>
                <p>3. Abre Boxy desde el ícono: se abre a pantalla completa y sigue funcionando sin internet.</p>
              </ModalBody>
              <ModalFooter>
                <Button color="primary" onPress={onClose}>
                  Entendido
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}
