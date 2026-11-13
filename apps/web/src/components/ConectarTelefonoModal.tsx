import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Spinner,
} from '@heroui/react'
import QRCode from 'react-qr-code'
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Smartphone, TriangleAlert } from 'lucide-react'
import { api } from '../lib/api'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

interface Emparejamiento {
  codigo: string
  ips: string[]
  expira_min: number
}

/**
 * Muestra el QR que el teléfono escanea para convertirse en lector remoto.
 * El QR apunta a /scanner?code=XXX usando la IP LAN de esta PC.
 */
export function ConectarTelefonoModal({ isOpen, onOpenChange }: Props) {
  const [datos, setDatos] = useState<Emparejamiento | null>(null)
  const [ip, setIp] = useState('')
  const [cargando, setCargando] = useState(false)

  const generar = useCallback(() => {
    setCargando(true)
    api
      .post<Emparejamiento>('/scanner/emparejar')
      .then((r) => {
        setDatos(r.data)
        setIp((prev) => prev || r.data.ips[r.data.ips.length - 1] || window.location.hostname)
      })
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (isOpen) generar()
  }, [isOpen, generar])

  const esHttps = window.location.protocol === 'https:'
  const url = datos
    ? `${window.location.protocol}//${ip}:${window.location.port}/scanner?code=${datos.codigo}`
    : ''

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="md">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2 font-display">
              <Smartphone className="h-5 w-5 text-primary" />
              Conectar teléfono como escáner
            </ModalHeader>
            <ModalBody className="items-center gap-4">
              {!esHttps && (
                <div className="flex items-start gap-2 rounded-large bg-warning-50 p-3">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
                  <p className="text-tiny text-warning-700">
                    Estás en HTTP: el teléfono no podrá abrir su cámara. Arranca la web con{' '}
                    <b>npm run lan</b> (HTTPS) y entra aquí por <b>https://</b> para que el QR
                    funcione completo.
                  </p>
                </div>
              )}

              {cargando || !datos ? (
                <Spinner label="Generando código…" className="py-10" />
              ) : (
                <>
                  <div className="rounded-large bg-white p-4">
                    <QRCode value={url} size={190} />
                  </div>
                  <div className="text-center">
                    <p className="text-tiny text-default-400">o entra manual y usa el código</p>
                    <p className="font-display text-2xl font-bold tracking-[0.3em]">
                      {datos.codigo}
                    </p>
                    <Chip size="sm" variant="flat" className="mt-1">
                      vence en {datos.expira_min} min · un solo uso
                    </Chip>
                  </div>

                  {datos.ips.length > 1 && (
                    <Select
                      label="IP de esta PC en tu red"
                      size="sm"
                      variant="bordered"
                      selectedKeys={ip ? [ip] : []}
                      onChange={(e) => e.target.value && setIp(e.target.value)}
                      className="max-w-[240px]"
                    >
                      {datos.ips.map((i) => (
                        <SelectItem key={i}>{i}</SelectItem>
                      ))}
                    </Select>
                  )}

                  <p className="break-all text-center text-tiny text-default-400">{url}</p>

                  <ol className="w-full list-inside list-decimal text-small text-default-600">
                    <li>El teléfono debe estar en el mismo wifi que esta PC.</li>
                    <li>Escanea este QR con la cámara nativa del teléfono.</li>
                    <li>Acepta el aviso de seguridad del navegador (certificado local).</li>
                    <li>¡Listo! Cada lectura cae directo en este carrito.</li>
                  </ol>
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                variant="flat"
                startContent={<RefreshCw className="h-4 w-4" />}
                onPress={generar}
                isLoading={cargando}
              >
                Nuevo código
              </Button>
              <Button color="primary" onPress={onClose}>
                Listo
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
