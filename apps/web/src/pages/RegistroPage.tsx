import { Button, Card, CardBody, CardHeader, Input } from '@heroui/react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Mail, Store, User as UserIcon } from 'lucide-react'

import { api, mensajeError } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import type { User } from '../types'
import { BoxyLogo } from '../components/BoxyLogo'

export function RegistroPage() {
  const { aplicarSesion } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const planCodigo = params.get('plan') ?? undefined

  const [empresa, setEmpresa] = useState('')
  const [rif, setRif] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<{ token: string; user: User }>('/registro', {
        empresa_nombre: empresa,
        rif: rif || null,
        admin_nombre: nombre,
        email,
        password,
        plan_codigo: planCodigo,
      })
      aplicarSesion(res.data.token, res.data.user)
      navigate('/dashboard')
    } catch (err) {
      // Muestra el motivo real (correo repetido, demasiados intentos, sin conexión…).
      setError(mensajeError(err, 'No se pudo crear la cuenta.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <Card className="w-full max-w-lg border border-default-200/50 bg-content1/60 p-2 backdrop-blur-2xl backdrop-saturate-150">
        <CardHeader className="flex flex-col items-center gap-2 pt-6">
          <BoxyLogo className="h-16 w-16" />
          <h1 className="font-display text-2xl font-bold text-primary">Crea tu cuenta en Boxy</h1>
          <p className="text-small text-default-500">
            14 días gratis{planCodigo ? ` · plan ${planCodigo}` : ''}. Sin tarjeta.
          </p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Nombre de tu negocio"
              variant="bordered"
              value={empresa}
              onValueChange={setEmpresa}
              startContent={<Store className="h-4 w-4 text-default-400" />}
              isRequired
            />
            <Input label="RIF (opcional)" variant="bordered" value={rif} onValueChange={setRif} />
            <Input
              label="Tu nombre"
              variant="bordered"
              value={nombre}
              onValueChange={setNombre}
              startContent={<UserIcon className="h-4 w-4 text-default-400" />}
              isRequired
            />
            <Input
              label="Correo"
              type="email"
              variant="bordered"
              value={email}
              onValueChange={setEmail}
              startContent={<Mail className="h-4 w-4 text-default-400" />}
              isRequired
            />
            <Input
              label="Contraseña"
              type="password"
              variant="bordered"
              value={password}
              onValueChange={setPassword}
              startContent={<Lock className="h-4 w-4 text-default-400" />}
              description="Mínimo 8 caracteres, con letras y números."
              isRequired
            />
            {error && <p className="text-small text-danger">{error}</p>}
            <Button type="submit" color="primary" size="lg" isLoading={loading} fullWidth>
              Empezar gratis
            </Button>
            <p className="text-center text-small text-default-500">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="font-semibold text-primary">
                Inicia sesión
              </Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
