import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Progress,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { useEffect, useMemo, useState } from 'react'
import { BadgeDollarSign, LineChart, Percent, Search, Trophy } from 'lucide-react'
import { api } from '../lib/api'
import { n, usd } from '../lib/format'
import { useTheme } from '../theme/ThemeContext'
import type { MetricaProducto } from '../types'

export function AnalisisPage() {
  const { panel } = useTheme()
  const [metricas, setMetricas] = useState<MetricaProducto[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    api
      .get<MetricaProducto[]>('/productos/metricas')
      .then((r) => setMetricas(r.data))
      .finally(() => setCargando(false))
  }, [])

  const filtradas = useMemo(() => {
    const q = filtro.toLowerCase()
    return metricas.filter(
      (m) => !q || m.nombre.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q),
    )
  }, [metricas, filtro])

  const resumen = useMemo(() => {
    let ingresos = 0
    let ganancia = 0
    for (const m of metricas) {
      ingresos += n(m.ingresos_30d_usd)
      ganancia += n(m.ganancia_30d_usd)
    }
    const margenPromedio =
      metricas.length > 0 ? metricas.reduce((a, m) => a + n(m.margen_pct), 0) / metricas.length : 0
    const top = metricas[0] ?? null
    return { ingresos, ganancia, margenPromedio, top }
  }, [metricas])

  const maxIngresos = Math.max(...metricas.map((m) => n(m.ingresos_30d_usd)), 1)

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <Spinner label="Calculando métricas…" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Resumen panel={panel} icon={<BadgeDollarSign className="h-5 w-5" />} tone="bg-success/15 text-success" label="Ingresos 30 días" value={usd(resumen.ingresos)} />
        <Resumen panel={panel} icon={<LineChart className="h-5 w-5" />} tone="bg-primary/15 text-primary" label="Ganancia 30 días" value={usd(resumen.ganancia)} />
        <Resumen panel={panel} icon={<Percent className="h-5 w-5" />} tone="bg-secondary/15 text-secondary" label="Margen promedio" value={`${resumen.margenPromedio.toFixed(1)}%`} />
        <Resumen panel={panel} icon={<Trophy className="h-5 w-5" />} tone="bg-warning/15 text-warning" label="Producto estrella" value={resumen.top?.nombre ?? '—'} small />
      </div>

      <Card className={panel}>
        <CardHeader className="flex-col items-stretch gap-3">
          <h2 className="font-display text-xl font-bold">Rentabilidad por producto (últimos 30 días)</h2>
          <Input
            placeholder="Filtrar por nombre o SKU…"
            value={filtro}
            onValueChange={setFiltro}
            variant="bordered"
            isClearable
            startContent={<Search className="h-4 w-4 text-default-400" />}
          />
        </CardHeader>
        <CardBody>
          <Table aria-label="Métricas" removeWrapper>
            <TableHeader>
              <TableColumn>PRODUCTO</TableColumn>
              <TableColumn>COSTO</TableColumn>
              <TableColumn>PRECIO</TableColumn>
              <TableColumn>MARGEN</TableColumn>
              <TableColumn>GANANCIA UND</TableColumn>
              <TableColumn>VENDIDOS</TableColumn>
              <TableColumn className="min-w-[160px]">INGRESOS</TableColumn>
              <TableColumn>GANANCIA 30D</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Sin datos aún. Emite ventas para ver métricas.">
              {filtradas.map((m) => {
                const margen = n(m.margen_pct)
                const ingresos = n(m.ingresos_30d_usd)
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="font-medium leading-tight">{m.nombre}</p>
                      <p className="text-tiny text-default-400">
                        {m.sku}
                        {m.categoria ? ` · ${m.categoria}` : ''}
                      </p>
                    </TableCell>
                    <TableCell className="text-default-500">{usd(m.precio_costo_usd)}</TableCell>
                    <TableCell className="font-semibold">{usd(m.precio_venta_usd)}</TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        variant="flat"
                        color={margen >= 30 ? 'success' : margen >= 15 ? 'warning' : 'danger'}
                      >
                        {margen.toFixed(1)}%
                      </Chip>
                    </TableCell>
                    <TableCell>{usd(m.ganancia_usd)}</TableCell>
                    <TableCell>
                      <span className="font-semibold">{n(m.vendidos_30d).toLocaleString('es-VE')}</span>{' '}
                      <span className="text-tiny text-default-400">und</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-small font-semibold">{usd(ingresos)}</span>
                        <Progress
                          size="sm"
                          aria-label="Peso en ingresos"
                          value={(ingresos / maxIngresos) * 100}
                          color="primary"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-display font-bold text-success">
                      {usd(m.ganancia_30d_usd)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  )
}

function Resumen({
  panel,
  icon,
  tone,
  label,
  value,
  small,
}: {
  panel: string
  icon: React.ReactNode
  tone: string
  label: string
  value: string
  small?: boolean
}) {
  return (
    <Card className={panel}>
      <CardBody className="flex-row items-center gap-3 py-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
        <div className="min-w-0">
          <p className={`truncate font-display font-bold leading-tight ${small ? 'text-sm' : 'text-lg'}`}>
            {value}
          </p>
          <p className="text-tiny text-default-500">{label}</p>
        </div>
      </CardBody>
    </Card>
  )
}
