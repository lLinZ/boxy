import { Button, Card, CardBody, CardHeader, Chip, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react'
import { useCallback, useEffect, useState } from 'react'
import { DatabaseBackup, Download, Plus } from 'lucide-react'
import { api, descargarArchivo, mensajeError } from '../lib/api'
import { fecha } from '../lib/format'
import { useTheme } from '../theme/ThemeContext'

interface Respaldo {
  archivo: string
  bytes: number
  fecha: string
}

/** Respaldos de la base de datos: lista, crear ahora y descargar. */
export function RespaldosPage() {
  const { panel } = useTheme()
  const [datos, setDatos] = useState<{ respaldos: Respaldo[]; conservar_dias: number; copia_extra: boolean } | null>(null)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    api.get('/respaldos').then((r) => setDatos(r.data)).catch((e) => setError(mensajeError(e)))
  }, [])
  useEffect(cargar, [cargar])

  async function crear() {
    setCreando(true)
    setError('')
    try {
      await api.post('/respaldos')
      cargar()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCreando(false)
    }
  }

  const tamano = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`)

  return (
    <Card className={panel}>
      <CardHeader className="flex-wrap justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <DatabaseBackup className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Respaldos</h2>
          </div>
          {datos && (
            <p className="text-small text-default-500">
              Automático todas las noches (11:30 p. m.). Se guardan {datos.conservar_dias} días.
              {datos.copia_extra ? ' Cada respaldo se copia también a la carpeta extra configurada.' : ' Configura BOXY_RESPALDOS_COPIAR_A para guardar una copia fuera de este equipo.'}
            </p>
          )}
        </div>
        <Button color="primary" isLoading={creando} startContent={<Plus className="h-4 w-4" />} onPress={crear}>
          Respaldar ahora
        </Button>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        {error && <p className="mb-2 text-small text-danger">{error}</p>}
        <Table aria-label="Respaldos" removeWrapper className="min-w-[480px]">
          <TableHeader>
            <TableColumn>ARCHIVO</TableColumn>
            <TableColumn>FECHA</TableColumn>
            <TableColumn>TAMAÑO</TableColumn>
            <TableColumn className="text-right"> </TableColumn>
          </TableHeader>
          <TableBody emptyContent="Aún no hay respaldos.">
            {(datos?.respaldos ?? []).map((r, i) => (
              <TableRow key={r.archivo}>
                <TableCell>
                  {r.archivo} {i === 0 && <Chip size="sm" variant="flat" color="success">último</Chip>}
                </TableCell>
                <TableCell>{fecha(r.fecha)}</TableCell>
                <TableCell>{tamano(r.bytes)}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button size="sm" variant="flat" startContent={<Download className="h-4 w-4" />} onPress={() => descargarArchivo(`/respaldos/${r.archivo}`, r.archivo)}>
                      Descargar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-3 text-tiny text-default-400">
          Para restaurar un respaldo (reemplaza todos los datos): <code>php artisan boxy:restaurar</code> en el servidor.
        </p>
      </CardBody>
    </Card>
  )
}
