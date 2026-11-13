import { Button, Card, CardBody, CardHeader, Input } from '@heroui/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, Store } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { inicioPara } from '../lib/permisos'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  // Solo en desarrollo se precargan las credenciales de la demo
  const [email, setEmail] = useState(import.meta.env.DEV ? 'aristides@boxy.com' : '')
  const [password, setPassword] = useState(import.meta.env.DEV ? 'password' : '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const u = await login(email, password)
      navigate(inicioPara(u))
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      setError(status === 429
        ? 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.'
        : 'Credenciales inválidas. Verifica tu correo y contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Fondo decorativo para el efecto glass */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <Card className="w-full max-w-md border border-default-200/50 bg-content1/60 p-2 backdrop-blur-2xl backdrop-saturate-150">
        <CardHeader className="flex flex-col items-center gap-2 pt-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Store className="h-7 w-7" strokeWidth={2.25} />
          </div>
          <h1 className="font-display text-3xl font-bold text-primary">Boxy</h1>
          <p className="text-small text-default-500">Punto de venta, inventario y clientes para tu negocio</p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Correo"
              type="email"
              value={email}
              onValueChange={setEmail}
              isRequired
              variant="bordered"
              startContent={<Mail className="h-4 w-4 text-default-400" />}
            />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onValueChange={setPassword}
              isRequired
              variant="bordered"
              startContent={<Lock className="h-4 w-4 text-default-400" />}
            />
            {error && <p className="text-small text-danger">{error}</p>}
            <Button type="submit" color="primary" size="lg" isLoading={loading} fullWidth>
              Ingresar
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
