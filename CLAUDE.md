# Boxy — Guía para Claude

**Boxy** es un punto de venta con inventario, caja y CRM para negocios en Venezuela
(abastos, minimarkets), multi-empresa / multi-sucursal. Funciona en dos modos:
**SaaS** (empresas con licencia mensual) o **dedicado** (una sola tienda dueña del
sistema). **"Crotone"** es la empresa demo (un minimarket); ya NO es el nombre del producto.

> El repo, la BD y claves internas (`crotone_token`, etc.) conservan el nombre
> "crotone" — solo la **marca visible** es Boxy. No renombrar lo interno.

> Idioma: el código se comenta en **español**. Responde al usuario en español.

> **Documentos NO fiscales.** Los comprobantes, tickets y PDF de Boxy se rotulan
> "documento no fiscal". No prometer "facturación fiscal" en textos ni pantallas.
> La factura fiscal la emite una impresora fiscal homologada (ampliación opcional,
> ver `docs/IMPRESORA-FISCAL.md`).

## Stack (decidido — no re-preguntar)

| Capa | Tecnología |
|------|-----------|
| API | **Laravel 12** + MySQL, Sanctum (tokens con vencimiento y habilidades) |
| Web | React 19 + Vite + TypeScript + **HeroUI** + Tailwind 3, PWA |
| Mobile | React Native (pendiente, aún no iniciado) |

## Estructura (monorepo)

```
crotone/
├── apps/
│   ├── api/   → Laravel (Controllers/Api, Services, Support/Permisos, tests/)
│   └── web/   → React (src/pages, src/components, src/lib)
├── docs/      → DESPLIEGUE.md, IMPRESORA-FISCAL.md
├── scripts/   → instalar-tareas.ps1 (schedule:run en Windows), puente-fiscal.ps1
└── .claude/   → launch.json (preview: web, web-5174, api)
```

API — piezas clave:
- `app/Support/Permisos.php` → **mapa único rol → permisos**. Las rutas lo exigen con
  `permiso:...`; `/me` devuelve `permisos` y la web arma el menú con eso.
- `app/Services/CalculadoraVenta.php` → cálculo puro (promos, descuento con tope, IVA,
  IGTF solo sobre lo que las divisas cancelan, vuelto). **Copia exacta** en
  `apps/web/src/lib/calculo.ts`; ambas se prueban con `tests/fixtures/calculo_casos.json`.
- `FacturacionService` (venta: precio/IVA del catálogo, pagos que cubren, turno, fiado,
  puntos, idempotencia por `uuid`), `CajaService` (turnos y arqueo), `DevolucionService`
  (anular / devolver), `AutorizacionService` (PIN de supervisor con límite de intentos),
  `CuentaClienteService` (fiado), `FidelizacionService` (puntos), `CompraService` (costo
  promedio), `StockService` (único punto que mueve stock + kardex), `RespaldoService`,
  `FiscalService` (comandos TFHKA), `PromocionService`.
- Errores de negocio: `App\Exceptions\ReglaNegocioException` → 422 (o el código indicado)
  con `message` y datos extra (`requiere_supervisor`, `requiere_turno`, `faltante_usd`).
- `config/boxy.php` → modo, registro público, verificación SSL de tasas, sesión, respaldos.

Web — piezas clave: `lib/calculo.ts`, `lib/permisos.ts`, `lib/ticket.ts` (tickets 58/80 mm,
cierre Z, abono, devolución), `lib/offline.ts` (catálogo en IndexedDB + cola de ventas),
`lib/whatsapp.ts` (enlaces wa.me), `components/SupervisorModal.tsx` (`useSupervisor()`),
`components/CuentaModal.tsx` (clave y PIN; cambio obligatorio en el primer ingreso).
Páginas nuevas: CajaPage, ClienteFichaPage, ComprasPage, PromocionesPage, EmpresaPage, RespaldosPage.

## Cómo levantar

**Requisitos:** XAMPP (PHP 8.2+, MySQL), Node 20+. Base `crotone` (demo) y `crotone_test` (pruebas).

```bash
# 1. MySQL: arrancar desde panel XAMPP
# 2. API
cd apps/api
php artisan migrate:fresh --seed   # esquema + demo (DemoSeeder; en producción usa ProduccionSeeder)
php artisan serve                  # http://127.0.0.1:8000
# 3. Web
cd apps/web
npm run dev                        # http://localhost:5173
```

Vite proxea `/api` → `127.0.0.1:8000` (sin CORS). Preview con tooling: servers `api` y
`web` (o `web-5174` si el 5173 está ocupado). Instalación real: `docs/DESPLIEGUE.md`.

**Usuarios demo** (clave `password`, solo desarrollo): `admin@crotone.com` (admin, PIN 1234) ·
`gerente@crotone.com` (gerente, PIN 4321) · `caja@crotone.com` (cajera) · `super@crotone.com` (super-admin).

## Comandos

| Acción | Comando (dir) |
|--------|---------------|
| Dev web | `npm run dev` (apps/web) |
| Build web | `npm run build` (apps/web) — `tsc -b` + vite build |
| Lint web | `npm run lint` (apps/web) — la regla `set-state-in-effect` ya fallaba en el código viejo |
| Cálculo web = servidor | `npm run test:calculo` (apps/web) |
| Tests API | `php artisan test` (apps/api) — MySQL `crotone_test` |
| Instalar tienda | `php artisan boxy:instalar` (apps/api) |
| Respaldo / restaurar | `php artisan boxy:respaldar` · `php artisan boxy:restaurar` |

Antes de dar por cerrado un cambio: `npm run build` y `php artisan test`. Si tocas el
cálculo de la venta, cambia **PHP y TS** y corre `npm run test:calculo`.

## Reglas de negocio (Venezuela) — no romper

- **Multi-tasa**: BCV (oficial) + USDT (paralela) + fuentes libres. Los cobros en Bs usan
  **BCV**; las demás son referenciales. Tasas **globales**: carga manual solo super-admin
  (en modo dedicado, también el admin), nunca 0, saltos >50 % piden confirmación.
  Sync `tasas:sincronizar` 9am y 1pm (`routes/console.php`), con verificación TLS.
- **Precio e IVA salen del catálogo** (el navegador no los decide). Ítems libres: solo admin/gerente.
- **IVA** 16 % / 8 % / exento. **IGTF 3 %** solo si la empresa es agente (`cobra_igtf`) y solo
  sobre lo que los pagos en divisas cancelan; el exceso es **vuelto** (Bs, USD o pago móvil).
- **Pagos deben cubrir el total.** Fiado (`credito`) y puntos no dan vuelto ni IGTF.
- **Caja por turnos** (`exigir_turno`): no se vende sin caja abierta; cierre con arqueo a ciegas.
- **Anular** solo con su turno abierto; si no, **devolución**. Descuentos, anulaciones,
  devoluciones y fiado sobre el límite: permiso o **PIN de supervisor**.
- **Correlativo** de comprobante por sucursal (no es número de control fiscal). **Kardex** en todo movimiento.

## Seguridad (auditoría sept. 2026, resuelta)

Tokens con vencimiento (`BOXY_SESION_MINUTOS`); usuario desactivado → 401 al instante;
token del teléfono-escáner con habilidad `scanner` y del puente fiscal con `fiscal`
(no sirven para más); throttle en login/registro/canje/PIN (PIN: 5 cada 10 min y 15 por
día por cajero, el acierto no reinicia el del día); CORS solo `APP_URL` o `BOXY_ORIGENES`
(`config/cors.php`); comprobantes de licencia
en disco privado (sin SVG); `per_page` ≤ 100; cabeceras de seguridad; claves mín. 8
con letras y números y cambio obligatorio si las puso otro; `.env.production.example`.

- **Bitácora de seguridad** (`App\Support\Auditoria::registrar`, canal `seguridad` →
  `storage/logs/seguridad-*.log`, 180 días): login, PIN de supervisor, cambios de usuarios
  y roles, clave/PIN propios, tasa manual, respaldos, clave del puente, emparejar escáner.
  Toda acción sensible nueva se registra ahí. **Nunca** claves, PIN ni tokens en el log.
  En las pruebas el canal va a `null` (`tests/TestCase.php`).
- **HTML armado a mano** (tickets, etiquetas): todo dato pasa por `esc()` de `lib/ticket.ts`
  y se imprime con `imprimirDocumento` (iframe oculto, sin `window.open` ni scripts en línea).

## Convenciones de UI (HeroUI)

- **Gotcha del tema plano:** si la UI HeroUI sale sin estilos, revisar el `content`
  de `tailwind.config.js` — debe cubrir la ruta anidada de `@heroui/theme` e incluir
  `.mjs` (ahí viven las clases del tema). Ya está configurado; no quitarlo.
- El tema se aplica con una clase en `<body>` (no en `<html>`): así los portales
  (modales/popovers) heredan el tema. Ver `theme/ThemeContext.tsx`.
- En **modo oscuro**, preferir `variant="bordered"` en `Input`/`Select` dentro de modales.
- **Teléfono:** el menú lateral es un Drawer bajo `lg`; tablas dentro de `overflow-x-auto`
  con `min-w-[…]`; en el POS las columnas usan `contents` + `order-*` para reordenarse.

## API REST (resumen)

Auth/cuenta: `POST /login` · `GET /me` · `POST /logout` · `POST /cuenta/clave` · `POST /cuenta/pin` · `GET /config` (público)
Ventas: `GET/POST /ventas` · `GET /ventas/{id}` · `/pdf` · `POST /ventas/{id}/anular` · `POST /ventas/{id}/devoluciones`
Caja: `GET /caja/actual` · `POST /caja/abrir` · `GET /caja/turnos` · `GET /caja/turnos/{id}` · `POST /caja/turnos/{id}/cerrar`
Clientes: CRUD `/clientes` · `GET /clientes/{id}` (ficha) · `/cuenta` · `/puntos` · `POST /clientes/{id}/abonos` · `GET /clientes/por-cobrar`
Catálogo: `/productos` · `/categorias` · `GET /productos/codigo-barra/{c}` (incluye etiquetas de balanza) ·
`POST /productos/importar` · `POST /productos/precios-masivos` · `GET /productos/{id}/precios` · `GET /productos/metricas`
Inventario: `GET /inventario` · `POST /inventario/movimiento` · `GET /inventario/kardex/{p}` · `GET /inventario/vencimientos`
Compras: `/proveedores` · `GET/POST /compras` · `POST /compras/{id}/{anular,pagada}`
Promociones: CRUD `/promociones` · `GET /promociones/vigentes`
Empresa: `GET/PUT /empresa` · `POST /empresa/logo` · `PUT /sucursales/{id}` · fiscal: `POST /fiscal/clave` · `GET /fiscal/estado`
Puente fiscal (token `fiscal`): `GET /fiscal/puente/pendientes` · `POST /fiscal/puente/ventas/{id}/resultado`
Tasas: `GET /tasas/vigente|vigentes` · `GET /tasas` · `POST /tasas` · `POST /tasas/sincronizar`
Reportes: `GET /dashboard` · `GET /monitor` · `GET /monitor/recomendaciones`
Respaldos: `GET/POST /respaldos` · `GET /respaldos/{archivo}`
Escáner: `POST /scanner/emparejar` · `POST /scanner/canjear` (público) · `POST /scanner/scan` (token `scanner`) · `GET /scanner/cola`

## SaaS (licencias mensuales)

- `planes`, `suscripciones` (1 por empresa: trialing→activa→gracia→suspendida/vencida),
  `pagos_licencia` (reportados por el cliente, confirmados por super-admin).
- Middleware `licencia` → **402** si la empresa no puede operar (en modo dedicado no aplica).
- Rol `super_admin` (`empresa_id` NULL) → `/api/admin/*`, tasas y respaldos; las pantallas
  de empresa le responden 403 (middleware `empresa`).

## Escáner remoto (teléfono → PC)

La página `/scanner` (pública) es la del teléfono: canjea el código del QR del POS por un
token que **solo puede escanear** (12 h). La cámara del teléfono necesita HTTPS: en
desarrollo `npm run lan` (certificado autofirmado) y abrir el POS en `https://localhost:5173`.
