import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import Barcode from 'react-barcode'
import { Barcode as BarcodeIcon, Printer } from 'lucide-react'
import { usd } from '../lib/format'
import { esc, imprimirDocumento } from '../lib/ticket'
import type { Producto } from '../types'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  producto: Producto | null
}

/** Muestra la etiqueta del producto con su código de barras y permite imprimirla. */
export function BarcodeLabelModal({ isOpen, onOpenChange, producto }: Props) {
  const valor = producto?.codigo_barra?.trim() || ''

  function imprimir() {
    // El SVG lo serializa el navegador (texto ya escapado); nombre y precio se escapan aquí
    const svg = document.querySelector('#crotone-etiqueta svg')?.outerHTML ?? ''
    imprimirDocumento(
      'Etiqueta',
      'body{font-family:system-ui,sans-serif;text-align:center;margin:0;padding:16px;color:#000}' +
        '.n{font-weight:600;font-size:14px;margin-bottom:2px}.p{font-size:20px;font-weight:800;margin-top:4px}',
      `<div class="n">${esc(producto?.nombre)}</div>${svg}<div class="p">${esc(usd(producto?.precio_venta_usd ?? 0))}</div>`,
    )
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="sm">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2 font-display">
              <BarcodeIcon className="h-5 w-5 text-primary" />
              Etiqueta del producto
            </ModalHeader>
            <ModalBody className="items-center">
              {valor ? (
                <div id="crotone-etiqueta" className="rounded-large bg-white p-4 text-center text-black">
                  <p className="n">{producto?.nombre}</p>
                  <Barcode value={valor} format="CODE128" height={60} fontSize={14} margin={6} />
                  <p className="p">{usd(producto?.precio_venta_usd ?? 0)}</p>
                </div>
              ) : (
                <p className="py-6 text-center text-small text-default-500">
                  Este producto no tiene código de barras. Edítalo y asígnale uno
                  (o genera un código interno) para poder imprimir su etiqueta.
                </p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cerrar
              </Button>
              {valor && (
                <Button color="primary" startContent={<Printer className="h-4 w-4" />} onPress={imprimir}>
                  Imprimir
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
