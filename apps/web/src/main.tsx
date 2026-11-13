import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HeroUIProvider } from '@heroui/react'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/space-grotesk/index.css'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import { ThemeProvider } from './theme/ThemeContext.tsx'

// En desarrollo, elimina cualquier service worker viejo (de una build PWA previa)
// y su caché, para no quedar nunca con un bundle desactualizado pegado.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()))
  if ('caches' in window) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HeroUIProvider>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <div className="font-sans text-foreground bg-background min-h-screen">
              <App />
            </div>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </HeroUIProvider>
  </StrictMode>,
)
