import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './auth/AuthContext'
import { api } from './lib/api'
import { inicioPara, type Permiso } from './lib/permisos'
import { LandingPage } from './pages/LandingPage'
import { RegistroPage } from './pages/RegistroPage'
import { LoginPage } from './pages/LoginPage'
import { PosPage } from './pages/PosPage'
import { InventarioPage } from './pages/InventarioPage'
import { VentasPage } from './pages/VentasPage'
import { DashboardPage } from './pages/DashboardPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { ClientesPage } from './pages/ClientesPage'
import { ClienteFichaPage } from './pages/ClienteFichaPage'
import { AnalisisPage } from './pages/AnalisisPage'
import { TasasPage } from './pages/TasasPage'
import { ScannerPage } from './pages/ScannerPage'
import { MonitorPage } from './pages/MonitorPage'
import { BillingPage } from './pages/BillingPage'
import { SuperAdminPage } from './pages/SuperAdminPage'
import { CajaPage } from './pages/CajaPage'
import { ComprasPage } from './pages/ComprasPage'
import { PromocionesPage } from './pages/PromocionesPage'
import { EmpresaPage } from './pages/EmpresaPage'
import { RespaldosPage } from './pages/RespaldosPage'

/** Muestra la página solo si el usuario tiene alguno de los permisos (el servidor igual los exige). */
function Con({ permisos, children }: { permisos: Permiso[]; children: ReactNode }) {
  const { user, puede } = useAuth()
  if (!user) return null
  return puede(...permisos) ? <>{children}</> : <Navigate to={inicioPara(user)} replace />
}

/** En una instalación dedicada (una sola tienda) la portada es el login. */
function Portada() {
  const [modo, setModo] = useState<string | null>(null)
  useEffect(() => {
    api.get<{ modo: string }>('/config').then((r) => setModo(r.data.modo)).catch(() => setModo('saas'))
  }, [])
  if (modo === null) return null
  return modo === 'dedicado' ? <Navigate to="/login" replace /> : <LandingPage />
}

function Inicio() {
  const { user } = useAuth()
  return user ? <Navigate to={inicioPara(user)} replace /> : null
}

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/" element={<Portada />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/login" element={<LoginPage />} />
      {/* Página del teléfono: se autentica sola con el código del QR */}
      <Route path="/scanner" element={<ScannerPage />} />

      {/* App autenticada */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/dashboard" element={<Con permisos={['reportes.ver']}><DashboardPage /></Con>} />
                <Route path="/monitor" element={<Con permisos={['reportes.ver']}><MonitorPage /></Con>} />
                <Route path="/pos" element={<Con permisos={['ventas.crear']}><PosPage /></Con>} />
                <Route path="/caja" element={<Con permisos={['caja.operar']}><CajaPage /></Con>} />
                <Route path="/inventario" element={<InventarioPage />} />
                <Route path="/clientes" element={<Con permisos={['clientes.gestionar']}><ClientesPage /></Con>} />
                <Route path="/clientes/:id" element={<Con permisos={['clientes.gestionar']}><ClienteFichaPage /></Con>} />
                <Route path="/ventas" element={<Con permisos={['ventas.crear', 'ventas.ver_todas']}><VentasPage /></Con>} />
                <Route path="/compras" element={<Con permisos={['compras.gestionar']}><ComprasPage /></Con>} />
                <Route path="/promociones" element={<Con permisos={['promociones.gestionar']}><PromocionesPage /></Con>} />
                <Route path="/analisis" element={<Con permisos={['reportes.ver']}><AnalisisPage /></Con>} />
                <Route path="/tasas" element={<TasasPage />} />
                <Route path="/usuarios" element={<Con permisos={['usuarios.gestionar']}><UsuariosPage /></Con>} />
                <Route path="/empresa" element={<Con permisos={['empresa.configurar']}><EmpresaPage /></Con>} />
                <Route path="/respaldos" element={<Con permisos={['respaldos.gestionar']}><RespaldosPage /></Con>} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/admin" element={<SuperAdminPage />} />
                <Route path="*" element={<Inicio />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
