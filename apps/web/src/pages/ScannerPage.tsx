import { Button, Chip, Input, Spinner } from '@heroui/react'
import { Html5Qrcode } from 'html5-qrcode'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, ScanBarcode, Smartphone, WifiOff } from 'lucide-react'
import axios from 'axios'
import { useSearchParams } from 'react-router-dom'

const READER_ID = 'scanner-movil'

type Estado = 'canjeando' | 'conectado' | 'error'

interface Lectura {
  codigo: string
  hora: string
  ok: boolean
}

/**
 * Página que abre el TELÉFONO tras escanear el QR de emparejamiento de la caja.
 * Canjea el código por un token propio, enciende la cámara y envía cada
 * lectura a la cola del backend; la PC las consume y agrega al carrito.
 */
export function ScannerPage() {
  const [params] = useSearchParams()
  const [estado, setEstado] = useState<Estado>('canjeando')
  const [mensaje, setMensaje] = useState('')
  const [usuario, setUsuario] = useState('')
  const [lecturas, setLecturas] = useState<Lectura[]>([])
  const [camaraError, setCamaraError] = useState('')
  const [codigoManual, setCodigoManual] = useState('')

  // Cliente axios propio: el token del escáner vive solo en esta página
  // (sessionStorage), sin tocar la sesión normal de la web.
  const tokenRef = useRef<string | null>(sessionStorage.getItem('crotone_scanner_token'))
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const cooldownRef = useRef<{ codigo: string; hasta: number }>({ codigo: '', hasta: 0 })
  // El código es de un solo uso: evita el doble canje de StrictMode (efecto x2 en dev)
  const canjeRef = useRef(false)

  const enviar = useCallback(async (codigo: string) => {
    const limpio = codigo.trim()
    if (!limpio || !tokenRef.current) return

    const ahora = Date.now()
    const cd = cooldownRef.current
    if (limpio === cd.codigo && ahora < cd.hasta) return
    cooldownRef.current = { codigo: limpio, hasta: ahora + 2500 }

    let ok = true
    try {
      await axios.post(
        '/api/scanner/scan',
        { codigo: limpio },
        { headers: { Authorization: `Bearer ${tokenRef.current}`, Accept: 'application/json' } },
      )
      navigator.vibrate?.(80)
    } catch {
      ok = false
    }
    setLecturas((prev) => [
      { codigo: limpio, hora: new Date().toLocaleTimeString('es-VE'), ok },
      ...prev.slice(0, 9),
    ])
  }, [])

  // 1) Canjear el código del QR por un token propio
  useEffect(() => {
    const code = params.get('code')

    if (tokenRef.current) {
      setEstado('conectado')
      return
    }
    if (!code) {
      setEstado('error')
      setMensaje('Falta el código. Escanea el QR que muestra la caja.')
      return
    }
    if (canjeRef.current) return
    canjeRef.current = true

    axios
      .post('/api/scanner/canjear', { codigo: code }, { headers: { Accept: 'application/json' } })
      .then((r) => {
        tokenRef.current = r.data.token
        sessionStorage.setItem('crotone_scanner_token', r.data.token)
        setUsuario(r.data.usuario)
        setEstado('conectado')
      })
      .catch(() => {
        // Si otro intento ya guardó token, no pisamos el estado conectado
        if (tokenRef.current) return
        setEstado('error')
        setMensaje('Código inválido o vencido. Genera uno nuevo en la caja (botón teléfono).')
      })
  }, [params])

  // 2) Encender la cámara cuando ya estamos conectados
  useEffect(() => {
    if (estado !== 'conectado') return

    let cancelado = false
    const timer = setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(READER_ID)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (texto) => enviar(texto),
          () => {},
        )
        if (cancelado) {
          await scanner.stop()
          scanner.clear()
        }
      } catch {
        setCamaraError(
          'No se pudo abrir la cámara. Si abriste con http://, usa la dirección https:// del QR ' +
            'y acepta el aviso de seguridad. También puedes escribir códigos a mano abajo.',
        )
      }
    }, 200)

    return () => {
      cancelado = true
      clearTimeout(timer)
      const s = scannerRef.current
      scannerRef.current = null
      if (s) s.stop().then(() => s.clear()).catch(() => {})
    }
  }, [estado, enviar])

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-background p-4">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Smartphone className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold leading-none">Escáner Boxy</h1>
          <p className="text-tiny text-default-500">El carrito se llena en la caja</p>
        </div>
        <div className="ml-auto">
          {estado === 'conectado' && (
            <Chip color="success" variant="dot">
              Conectado{usuario ? ` · ${usuario}` : ''}
            </Chip>
          )}
          {estado === 'error' && (
            <Chip color="danger" variant="dot">
              Sin conexión
            </Chip>
          )}
        </div>
      </div>

      {estado === 'canjeando' && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Spinner size="lg" />
          <p className="text-small text-default-500">Conectando con la caja…</p>
        </div>
      )}

      {estado === 'error' && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <WifiOff className="h-12 w-12 text-default-300" />
          <p className="text-small text-default-500">{mensaje}</p>
        </div>
      )}

      {estado === 'conectado' && (
        <>
          {/* Cámara */}
          {camaraError ? (
            <div className="rounded-large bg-warning-50 p-4">
              <p className="text-small text-warning-700">{camaraError}</p>
            </div>
          ) : (
            <div id={READER_ID} className="overflow-hidden rounded-large bg-black" />
          )}

          {/* Entrada manual de respaldo */}
          <div className="flex gap-2">
            <Input
              placeholder="O escribe el código a mano…"
              variant="bordered"
              value={codigoManual}
              onValueChange={setCodigoManual}
              startContent={<ScanBarcode className="h-4 w-4 text-default-400" />}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && codigoManual.trim()) {
                  enviar(codigoManual)
                  setCodigoManual('')
                }
              }}
            />
            <Button
              color="primary"
              isDisabled={!codigoManual.trim()}
              onPress={() => {
                enviar(codigoManual)
                setCodigoManual('')
              }}
            >
              Enviar
            </Button>
          </div>

          {/* Últimas lecturas */}
          {lecturas.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-tiny font-semibold uppercase text-default-400">Últimas lecturas</p>
              {lecturas.map((l, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-large bg-default-50 px-3 py-2"
                >
                  <CheckCircle2
                    className={`h-4 w-4 ${l.ok ? 'text-success' : 'text-danger'}`}
                  />
                  <span className="font-mono text-small">{l.codigo}</span>
                  <span className="ml-auto text-tiny text-default-400">{l.hora}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
