import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { Html5Qrcode } from 'html5-qrcode'
import { useEffect, useRef, useState } from 'react'
import { Camera, ScanBarcode } from 'lucide-react'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Se llama con el código leído (con un pequeño cooldown anti-duplicados). */
  onScan: (codigo: string) => void
}

const READER_ID = 'crotone-scanner'

export function ScannerModal({ isOpen, onOpenChange, onScan }: Props) {
  const [error, setError] = useState('')
  const [ultimo, setUltimo] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const cooldownRef = useRef<{ codigo: string; hasta: number }>({ codigo: '', hasta: 0 })

  useEffect(() => {
    if (!isOpen) return

    let cancelado = false
    setError('')
    setUltimo('')

    // Espera a que el div del lector exista en el DOM del modal.
    const timer = setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(READER_ID)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 160 } },
          (texto) => {
            // Cooldown: ignora el mismo código por 2,5 s para no duplicar.
            const ahora = Date.now()
            const cd = cooldownRef.current
            if (texto === cd.codigo && ahora < cd.hasta) return
            cooldownRef.current = { codigo: texto, hasta: ahora + 2500 }
            setUltimo(texto)
            onScan(texto)
          },
          () => {
            /* frames sin código: silencio */
          },
        )
        if (cancelado) {
          await scanner.stop()
          scanner.clear()
        }
      } catch {
        setError(
          'No se pudo acceder a la cámara. Revisa los permisos del navegador, ' +
            'o usa una pistola lectora / escribe el código en el buscador.',
        )
      }
    }, 150)

    return () => {
      cancelado = true
      clearTimeout(timer)
      const s = scannerRef.current
      scannerRef.current = null
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {})
      }
    }
  }, [isOpen, onScan])

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2 font-display">
              <ScanBarcode className="h-5 w-5 text-primary" />
              Escanear código de barras / QR
            </ModalHeader>
            <ModalBody>
              {error ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Camera className="h-10 w-10 text-default-300" />
                  <p className="text-small text-default-500">{error}</p>
                </div>
              ) : (
                <>
                  <div id={READER_ID} className="overflow-hidden rounded-large" />
                  <p className="text-center text-tiny text-default-400">
                    Apunta la cámara al código del producto. Se agrega solo al detectarlo.
                  </p>
                  {ultimo && (
                    <p className="text-center text-small font-semibold text-success">
                      Último leído: {ultimo}
                    </p>
                  )}
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose} fullWidth>
                Cerrar
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
