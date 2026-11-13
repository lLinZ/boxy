import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { useEffect, useState } from 'react'
import { CircleDollarSign, PlusCircle, RefreshCw } from 'lucide-react'
import { api, leerError } from '../lib/api'
import { bs } from '../lib/format'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import type { Paginated, TasaCambio, TasaVigente } from '../types'

const FUENTE_INFO: Record<string, { color: 'primary' | 'success' | 'warning' | 'secondary'; desc: string }> = {
  BCV: { color: 'primary', desc: 'Tasa oficial: los cobros en bolívares usan esta' },
  USDT: { color: 'success', desc: 'Tasa paralela / cripto (referencial)' },
}

export function TasasPage() {
  const { panel } = useTheme()
  const { puede } = useAuth()
  const [errorManual, setErrorManual] = useState('')
  const [vigentes, setVigentes] = useState<TasaVigente[]>([])
  const [historial, setHistorial] = useState<TasaCambio[]>([])
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [aviso, setAviso] = useState('')

  // Alta manual (fuente libre: el sistema es abierto a nuevas monedas/fuentes)
  const [fuente, setFuente] = useState('')
  const [tasa, setTasa] = useState('')
  const [guardando, setGuardando] = useState(false)

  function cargar() {
    setCargando(true)
    Promise.all([
      api.get<TasaVigente[]>('/tasas/vigentes'),
      api.get<Paginated<TasaCambio>>('/tasas', { params: { per_page: 20 } }),
    ])
      .then(([v, h]) => {
        setVigentes(v.data)
        setHistorial(h.data.data)
      })
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [])

  async function sincronizar() {
    setSincronizando(true)
    setAviso('')
    try {
      const r = await api.post<{ omitidas: { fuente: string; tasa: number; anterior: number }[] }>('/tasas/sincronizar')
      const omitidas = r.data.omitidas ?? []
      setAviso(omitidas.length
        ? `✓ Sincronizado, pero se ignoró ${omitidas.map((o) => `${o.fuente} ${o.tasa}`).join(', ')} por alejarse demasiado de la anterior.`
        : '✓ Tasas sincronizadas con ve.dolarapi.com')
      cargar()
    } catch (e) {
      setAviso(leerError(e, 'No se pudo sincronizar. Verifica tu conexión a internet.').mensaje)
    } finally {
      setSincronizando(false)
    }
  }

  async function agregarManual(confirmar = false) {
    if (!fuente.trim() || !(Number(tasa) > 0)) return
    setGuardando(true)
    setErrorManual('')
    try {
      await api.post('/tasas', {
        fecha: new Date().toLocaleDateString('en-CA'),
        fuente: fuente.trim().toUpperCase(),
        tasa: Number(tasa),
        confirmar,
      })
      setFuente('')
      setTasa('')
      cargar()
    } catch (e) {
      const err = leerError(e)
      // Un salto brusco contra la tasa anterior pide confirmación explícita
      if (err.status === 422 && !confirmar && /varía/.test(err.mensaje) && confirm(`${err.mensaje}\n\n¿Registrar de todas formas?`)) {
        setGuardando(false)
        return agregarManual(true)
      }
      setErrorManual(err.mensaje)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <Spinner label="Cargando tasas…" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Tasas vigentes por fuente */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {vigentes.map((t) => {
          const info = FUENTE_INFO[t.fuente] ?? { color: 'secondary' as const, desc: 'Fuente personalizada' }
          return (
            <Card key={t.fuente} className={panel}>
              <CardBody className="gap-2">
                <div className="flex items-center justify-between">
                  <Chip color={info.color} variant="flat" className="font-semibold">
                    {t.fuente}
                  </Chip>
                  <span className="text-tiny text-default-400">
                    {new Date(t.fecha + 'T12:00:00').toLocaleDateString('es-VE')}
                  </span>
                </div>
                <p className="font-display text-3xl font-bold">{bs(t.tasa)}</p>
                <p className="text-tiny text-default-500">{info.desc}</p>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Acciones */}
        <Card className={panel}>
          <CardHeader className="items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-bold">Actualizar tasas</h3>
          </CardHeader>
          <CardBody className="gap-4">
            {puede('tasas.sincronizar') && (
            <Button
              color="primary"
              size="lg"
              isLoading={sincronizando}
              startContent={!sincronizando && <RefreshCw className="h-5 w-5" />}
              onPress={sincronizar}
            >
              Sincronizar BCV y USDT desde internet
            </Button>
            )}
            {aviso && (
              <p className={`text-small ${aviso.startsWith('✓') ? 'text-success' : 'text-danger'}`}>
                {aviso}
              </p>
            )}
            <p className="text-tiny text-default-400">
              Fuente: ve.dolarapi.com (oficial → BCV, paralelo → USDT). Se sincroniza sola a las 9:00 a. m. y 1:00 p. m.
            </p>

            {!puede('tasas.editar') ? (
              <p className="text-tiny text-default-400">
                La carga manual de tasas la hace el administrador del sistema (las tasas son las mismas para todas las tiendas).
              </p>
            ) : (
            <>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                label="Fuente"
                placeholder="EUR, COP…"
                variant="bordered"
                value={fuente}
                onValueChange={setFuente}
                className="max-w-[140px]"
              />
              <Input
                label="Tasa (Bs por 1 unidad)"
                placeholder="0.00"
                type="number"
                variant="bordered"
                value={tasa}
                onValueChange={setTasa}
              />
              <Button
                color="primary"
                variant="flat"
                isLoading={guardando}
                startContent={<PlusCircle className="h-4 w-4" />}
                onPress={() => agregarManual()}
              >
                Registrar
              </Button>
            </div>
            {errorManual && <p className="text-small text-danger">{errorManual}</p>}
            </>
            )}
          </CardBody>
        </Card>

        {/* Historial */}
        <Card className={panel}>
          <CardHeader>
            <h3 className="font-display text-lg font-bold">Historial reciente</h3>
          </CardHeader>
          <CardBody>
            <Table aria-label="Historial de tasas" removeWrapper isCompact>
              <TableHeader>
                <TableColumn>FECHA</TableColumn>
                <TableColumn>FUENTE</TableColumn>
                <TableColumn className="text-right">TASA</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Sin registros.">
                {historial.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{new Date(h.fecha).toLocaleDateString('es-VE')}</TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={FUENTE_INFO[h.fuente]?.color ?? 'secondary'}>
                        {h.fuente}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{bs(h.tasa)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
