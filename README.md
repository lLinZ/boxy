# Crotone

Sistema de **inventario y facturación** para minimarket (Venezuela / SENIAT), pensado
para escalar a **franquicias** (multi-empresa / multi-sucursal).

## Estructura (monorepo)

```
crotone/
├── apps/
│   ├── api/    → Backend Laravel 11 + MySQL (API REST, Sanctum, motor de facturación)
│   ├── web/    → Frontend React + Vite + HeroUI (POS de caja, inventario, ventas)
│   └── mobile/ → App React Native (pendiente)
```

## Características fiscales (Venezuela)

- **Doble moneda** USD/Bs con tasa **BCV** (montos canónicos en USD).
- **IVA** por producto: general 16 %, reducido 8 %, exento 0 %.
- **IGTF** 3 % automático sobre pagos en divisas (USD / Zelle).
- **Correlativos** (número de factura + número de control) por sucursal.
- **Kardex** de inventario auditable por cada movimiento.

## Requisitos

- PHP 8.2+ y Composer (incluidos en XAMPP)
- MySQL / MariaDB (XAMPP)
- Node.js 18+ y npm

## Puesta en marcha

### 1. Base de datos
Inicia MySQL desde el panel de XAMPP (o `C:\xampp\mysql\bin\mysqld.exe`).
La base se llama `crotone` (ya creada).

### 2. Backend (API)
```bash
cd apps/api
php artisan migrate:fresh --seed   # esquema + datos demo
php artisan serve                  # http://127.0.0.1:8000
```

### 3. Frontend (Web)
```bash
cd apps/web
npm install
npm run dev                        # http://localhost:5173
```
La web usa un proxy de Vite hacia la API (`/api` → `127.0.0.1:8000`), sin problemas de CORS.

## Acceso de prueba

| Campo | Valor |
|-------|-------|
| Correo | `admin@crotone.com` |
| Clave  | `password` |

## API (resumen)

`POST /api/login` · `GET /api/me` · `POST /api/logout`
`GET/POST/PUT/DELETE /api/productos` · `/api/categorias` · `/api/clientes`
`GET /api/inventario` · `POST /api/inventario/movimiento` · `GET /api/inventario/kardex/{producto}`
`GET /api/tasas/vigente` · `POST /api/tasas`
`GET /api/ventas` · `GET /api/ventas/{id}` · `POST /api/ventas` (motor de facturación)
