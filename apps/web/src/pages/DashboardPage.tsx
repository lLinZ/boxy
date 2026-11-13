import { Card, CardBody, CardHeader, Chip, Spinner, Tooltip } from '@heroui/react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  DollarSign,
  Receipt,
  TrendingUp,
} from 'lucide-react'
import { api } from '../lib/api'
import { bs, n, usd } from '../lib/format'
import { useTheme } from '../theme/ThemeContext'
import type { DashboardData } from '../types'

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export function DashboardPage() {
  const { panel } = useTheme()
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    api.get<DashboardData>('/dashboard').then((r) => setData(r.data)).catch(() => {})
  }, [])

  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner label="Cargando panel…" />
      </div>
    )
  }

  const maxSemana = Math.max(...data.semana.map((s) => s.total_usd), 1)
  const totalSemana = data.semana.reduce((acc, s) => acc + s.total_usd, 0)

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Tarjetas de métricas */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          panel={panel}
          icon={<Receipt className="h-5 w-5" />}
          label="Ventas de hoy"
          value={String(data.hoy.cantidad)}
          detail={(data.hoy.devoluciones_usd ?? 0) > 0
            ? `${usd(data.hoy.total_usd)} · neto ${usd(data.hoy.neto_usd ?? data.hoy.total_usd)}`
            : usd(data.hoy.total_usd)}
          color="primary"
        />
        <StatCard
          panel={panel}
          icon={<TrendingUp className="h-5 w-5" />}
          label="Semana (7 días)"
          value={usd(totalSemana)}
          detail={`${data.semana.reduce((a, s) => a + s.cantidad, 0)} ventas`}
          color="success"
        />
        <StatCard
          panel={panel}
          icon={<Boxes className="h-5 w-5" />}
          label="Valor inventario"
          value={usd(data.valor_inventario_usd)}
          detail={`${data.total_productos} productos${(data.por_cobrar_usd ?? 0) > 0 ? ` · fiado ${usd(data.por_cobrar_usd!)}` : ''}`}
          color="secondary"
        />
        <StatCard
          panel={panel}
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Bajo stock"
          value={String(data.bajo_stock_count)}
          detail={data.bajo_stock_count > 0 ? 'requieren reposición' : 'todo en orden'}
          color={data.bajo_stock_count > 0 ? 'danger' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Gráfico de ventas de la semana */}
        <Card className={`xl:col-span-2 ${panel}`}>
          <CardHeader className="items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-bold">Ventas últimos 7 días</h3>
            <Chip size="sm" variant="flat" color="success" className="ml-auto">
              {usd(totalSemana)}
            </Chip>
          </CardHeader>
          <CardBody>
            <div className="flex h-56 items-end gap-3 px-2">
              {data.semana.map((s) => {
                const fecha = new Date(s.fecha + 'T12:00:00')
                const pct = Math.max((s.total_usd / maxSemana) * 100, 2)
                return (
                  <Tooltip
                    key={s.fecha}
                    content={`${usd(s.total_usd)} · ${s.cantidad} ventas`}
                    placement="top"
                  >
                    <div className="group flex h-full flex-1 cursor-default flex-col items-center justify-end gap-2">
                      <span className="text-tiny font-semibold text-default-600 opacity-0 transition-opacity group-hover:opacity-100">
                        {usd(s.total_usd)}
                      </span>
                      <div
                        className="w-full rounded-t-large bg-gradient-to-t from-primary to-primary/60 transition-all group-hover:from-primary group-hover:to-primary"
                        style={{ height: `${pct}%` }}
                      />
                      <span className="text-tiny font-medium text-default-500">
                        {DIAS[fecha.getDay()]} {fecha.getDate()}
                      </span>
                    </div>
                  </Tooltip>
                )
              })}
            </div>
          </CardBody>
        </Card>

        {/* Columna derecha: top productos + bajo stock */}
        <div className="flex flex-col gap-6">
          <Card className={panel}>
            <CardHeader className="items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              <h3 className="font-display text-lg font-bold">Top productos (30 días)</h3>
            </CardHeader>
            <CardBody className="gap-3">
              {data.top_productos.length === 0 && (
                <p className="text-small text-default-400">Aún no hay ventas.</p>
              )}
              {data.top_productos.map((t, i) => (
                <div key={t.descripcion} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 font-display text-tiny font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-small font-medium leading-tight">{t.descripcion}</p>
                    <p className="text-tiny text-default-400">{n(t.total_cantidad)} und</p>
                  </div>
                  <span className="text-small font-semibold">{usd(t.total_usd)}</span>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card className={panel}>
            <CardHeader className="items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <h3 className="font-display text-lg font-bold">Bajo stock</h3>
            </CardHeader>
            <CardBody className="gap-2">
              {data.bajo_stock.length === 0 && (
                <p className="text-small text-default-400">Sin alertas. Todo en orden ✨</p>
              )}
              {data.bajo_stock.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between">
                  <p className="text-small font-medium">{inv.producto?.nombre}</p>
                  <Chip size="sm" color="danger" variant="flat">
                    {n(inv.cantidad)} / mín {n(inv.stock_minimo)}
                  </Chip>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Tasa + equivalente del día */}
      {data.tasa && (
        <Card className={panel}>
          <CardBody className="flex-row items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-small font-semibold">Tasa BCV del día</p>
              <p className="text-tiny text-default-500">
                {new Date(data.tasa.fecha).toLocaleDateString('es-VE')}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-xl font-bold">{bs(data.tasa.tasa)}</p>
              <p className="text-tiny text-default-500">por 1 USD</p>
            </div>
            <div className="ml-3 border-l border-default-200 pl-3 text-right sm:ml-6 sm:pl-6">
              <p className="font-display text-xl font-bold text-success">{bs(data.hoy.total_bs)}</p>
              <p className="text-tiny text-default-500">vendido hoy</p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  panel,
  icon,
  label,
  value,
  detail,
  color,
}: {
  panel: string
  icon: ReactNode
  label: string
  value: string
  detail: string
  color: 'primary' | 'success' | 'secondary' | 'danger' | 'default'
}) {
  const tones: Record<string, string> = {
    primary: 'bg-primary/15 text-primary',
    success: 'bg-success/15 text-success',
    secondary: 'bg-secondary/15 text-secondary',
    danger: 'bg-danger/15 text-danger',
    default: 'bg-default/30 text-default-600',
  }
  return (
    <Card className={panel}>
      <CardBody className="gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[color]}`}>
            {icon}
          </div>
          <p className="text-small font-medium text-default-500">{label}</p>
        </div>
        <p className="font-display text-3xl font-bold leading-none">{value}</p>
        <p className="text-tiny text-default-400">{detail}</p>
      </CardBody>
    </Card>
  )
}

