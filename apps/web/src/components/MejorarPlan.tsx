import { Button, Card, CardBody } from '@heroui/react'
import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { FuncionPlan } from '../types'

const TEXTO: Record<FuncionPlan, { titulo: string; detalle: string }> = {
  monitor: {
    titulo: 'Monitor de ventas en vivo',
    detalle: 'Ve las ventas del día mientras ocurren, por método de pago y por cajero, con recomendaciones de qué reponer.',
  },
  analisis: {
    titulo: 'Análisis de rentabilidad',
    detalle: 'El margen real de cada producto y cuáles te dejan más ganancia en los últimos 30 días.',
  },
  escaner_remoto: {
    titulo: 'Escáner con el teléfono',
    detalle: 'Usa la cámara de tu celular como lector de códigos de barra para la caja.',
  },
}

/** Pantalla que explica que la función es de un plan superior y lleva a "Mi licencia". */
export function MejorarPlan({ funcion }: { funcion: FuncionPlan }) {
  const navigate = useNavigate()
  const { empresa, puede } = useAuth()
  const t = TEXTO[funcion]
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <Card className="w-full border border-default-200/60" shadow="sm">
        <CardBody className="items-center gap-3 p-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Lock className="h-7 w-7" />
          </span>
          <h2 className="font-display text-2xl font-bold">{t.titulo}</h2>
          <p className="text-default-500">{t.detalle}</p>
          <p className="text-small text-default-500">
            Tu plan {empresa?.plan?.plan ? <strong>{empresa.plan.plan}</strong> : 'actual'} no lo incluye. Está en los planes
            Minimarket y Franquicia.
          </p>
          {puede('licencia.gestionar') ? (
            <Button color="primary" className="mt-2" onPress={() => navigate('/billing')}>
              Ver planes y mejorar
            </Button>
          ) : (
            <p className="text-small text-default-400">Pídele al dueño de la tienda que mejore el plan.</p>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

/** Muestra la página solo si el plan incluye la función; si no, la invitación a mejorar. */
export function ConFuncion({ funcion, children }: { funcion: FuncionPlan; children: ReactNode }) {
  const { tieneFuncion } = useAuth()
  return tieneFuncion(funcion) ? <>{children}</> : <MejorarPlan funcion={funcion} />
}
