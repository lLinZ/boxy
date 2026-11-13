import {
  Avatar,
  Button,
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
} from '@heroui/react'
import { useEffect, useState } from 'react'
import { IdCard, Search, UserPlus } from 'lucide-react'
import { api } from '../lib/api'
import type { Cliente, Paginated } from '../types'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (cliente: Cliente) => void
}

const TIPOS = ['V', 'E', 'J', 'G', 'P']

/**
 * Selector de cliente del POS: busca por cédula/nombre y, si no existe,
 * lo registra al vuelo con los datos mínimos (como en un supermercado).
 */
export function ClienteModal({ isOpen, onOpenChange, onSelect }: Props) {
  const [buscar, setBuscar] = useState('')
  const [resultados, setResultados] = useState<Cliente[]>([])
  const [cargando, setCargando] = useState(false)
  const [modoNuevo, setModoNuevo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Formulario de alta rápida
  const [tipoDoc, setTipoDoc] = useState('V')
  const [documento, setDocumento] = useState('')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setBuscar('')
      setResultados([])
      setModoNuevo(false)
      setError('')
      return
    }
  }, [isOpen])

  useEffect(() => {
    if (buscar.trim().length < 2) {
      setResultados([])
      return
    }
    setCargando(true)
    const t = setTimeout(() => {
      api
        .get<Paginated<Cliente>>('/clientes', { params: { buscar, per_page: 8 } })
        .then((r) => setResultados(r.data.data))
        .finally(() => setCargando(false))
    }, 250)
    return () => clearTimeout(t)
  }, [buscar])

  function prepararNuevo() {
    // Si lo buscado parece una cédula, la precargamos
    const limpio = buscar.trim()
    setDocumento(/^\d+$/.test(limpio) ? limpio : '')
    setNombre(/^\d+$/.test(limpio) ? '' : limpio)
    setTelefono('')
    setTipoDoc('V')
    setError('')
    setModoNuevo(true)
  }

  async function crear(onClose: () => void) {
    if (!documento.trim() || !nombre.trim()) {
      setError('Documento y nombre son obligatorios.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const res = await api.post<Cliente>('/clientes', {
        tipo_documento: tipoDoc,
        documento: documento.trim(),
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
      })
      onSelect(res.data)
      onClose()
    } catch {
      setError('No se pudo crear (¿documento ya registrado?). Búscalo arriba.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="md">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2 font-display">
              <IdCard className="h-5 w-5 text-primary" />
              Cliente de la venta
            </ModalHeader>
            <ModalBody className="gap-3">
              <Input
                autoFocus
                placeholder="Buscar por cédula, RIF o nombre…"
                variant="bordered"
                value={buscar}
                onValueChange={setBuscar}
                startContent={<Search className="h-4 w-4 text-default-400" />}
              />

              {cargando && <Spinner size="sm" />}

              {!modoNuevo && resultados.length > 0 && (
                <div className="flex flex-col gap-1">
                  {resultados.map((c) => (
                    <button
                      key={c.id}
                      className="flex items-center gap-3 rounded-large p-2 text-left transition-colors hover:bg-default-100"
                      onClick={() => {
                        onSelect(c)
                        onClose()
                      }}
                    >
                      <Avatar name={c.nombre.charAt(0)} size="sm" />
                      <div className="flex-1">
                        <p className="text-small font-medium">{c.nombre}</p>
                        <p className="text-tiny text-default-400">
                          {c.tipo_documento}-{c.documento}
                        </p>
                      </div>
                      <Chip size="sm" variant="flat" color="primary">
                        Elegir
                      </Chip>
                    </button>
                  ))}
                </div>
              )}

              {!modoNuevo && buscar.trim().length >= 2 && !cargando && resultados.length === 0 && (
                <p className="text-center text-small text-default-400">Sin resultados.</p>
              )}

              {!modoNuevo ? (
                <Button
                  variant="flat"
                  color="primary"
                  startContent={<UserPlus className="h-4 w-4" />}
                  onPress={prepararNuevo}
                >
                  Registrar cliente nuevo
                </Button>
              ) : (
                <div className="flex flex-col gap-3 rounded-large border border-default-200 p-3">
                  <p className="text-small font-semibold">Nuevo cliente</p>
                  <div className="grid grid-cols-[90px_1fr] gap-2">
                    <Select
                      aria-label="Tipo de documento"
                      variant="bordered"
                      selectedKeys={[tipoDoc]}
                      onChange={(e) => e.target.value && setTipoDoc(e.target.value)}
                    >
                      {TIPOS.map((t) => (
                        <SelectItem key={t}>{t}</SelectItem>
                      ))}
                    </Select>
                    <Input
                      placeholder="Cédula / RIF"
                      variant="bordered"
                      value={documento}
                      onValueChange={setDocumento}
                    />
                  </div>
                  <Input
                    placeholder="Nombre completo"
                    variant="bordered"
                    value={nombre}
                    onValueChange={setNombre}
                  />
                  <Input
                    placeholder="Teléfono (opcional)"
                    variant="bordered"
                    value={telefono}
                    onValueChange={setTelefono}
                  />
                  {error && <p className="text-tiny text-danger">{error}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" variant="light" onPress={() => setModoNuevo(false)}>
                      Volver
                    </Button>
                    <Button
                      size="sm"
                      color="primary"
                      className="flex-1"
                      isLoading={guardando}
                      onPress={() => crear(onClose)}
                    >
                      Crear y asignar
                    </Button>
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter />
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
