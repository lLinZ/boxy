# Boxy

Punto de venta con **inventario, caja y clientes** para abastos y minimarkets de Venezuela.
Multi-empresa y multi-sucursal; funciona como **SaaS** (licencia mensual) o **dedicado**
(una sola tienda). Los comprobantes son **documentos no fiscales**; la factura fiscal la
emite una impresora fiscal homologada (opcional, ver `docs/IMPRESORA-FISCAL.md`).

## Estructura (monorepo)

```
boxy/
├── apps/
│   ├── api/    → Laravel 12 + MySQL (API REST, Sanctum)
│   └── web/    → React 19 + Vite + HeroUI (landing, POS, inventario, panel)
├── docs/       → DESPLIEGUE.md, IMPRESORA-FISCAL.md
└── scripts/
```

## Lo que maneja

- **Multi-tasa** BCV (oficial) + USDT; montos canónicos en USD, cobro en Bs a tasa BCV.
- **IVA** 16 % / 8 % / exento e **IGTF** 3 % solo sobre lo que pagan las divisas.
- **Caja por turnos** con arqueo, anulaciones y devoluciones con PIN de supervisor.
- **Kardex** en cada movimiento, compras con costo promedio, fiado y puntos.

## Puesta en marcha (desarrollo)

```bash
cd apps/api
composer install && cp .env.example .env && php artisan key:generate
php artisan migrate:fresh --seed   # esquema + cuenta de prueba "Boxy Demo Market"
php artisan serve                  # http://127.0.0.1:8000

cd apps/web
npm install
npm run dev                        # http://localhost:5173 (proxy /api → :8000)
```

## Cuenta de prueba

`CuentaPruebaSeeder` crea la empresa **Boxy Demo Market** con catálogo, clientes, plan
Franquicia activo y un admin. El correo sale de `BOXY_DEMO_EMAIL` y la clave de
`BOXY_DEMO_PASSWORD` en `apps/api/.env` (si falta, se genera y se muestra una vez).
**Nunca pongas esa clave en el código.** En un servidor:

```bash
php artisan db:seed --class=CuentaPruebaSeeder
```

Despliegue en producción y venta de licencias: `docs/DESPLIEGUE.md`.
