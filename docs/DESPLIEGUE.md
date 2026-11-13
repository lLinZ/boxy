# Instalar Boxy en la tienda (o en un servidor)

Guía para dejar Boxy funcionando **en producción**, con claves propias,
respaldos automáticos y sin datos de prueba.

## 1. Elegir el modo

En `apps/api/.env`:

| Modo | Para qué | Licencias | Registro público | Tasa manual |
|---|---|---|---|---|
| `BOXY_MODO=dedicado` | Una sola tienda, dueña del sistema (venta con cesión) | No | No | La carga el admin de la tienda |
| `BOXY_MODO=saas` | Varias empresas pagando licencia mensual | Sí | Opcional (`BOXY_REGISTRO_PUBLICO`) | Solo el super-admin |

## 2. Requisitos

- PHP 8.2 o superior con `pdo_mysql`, `mbstring`, `openssl`, `zip`, `gd` (para fotos).
- MySQL 8 o MariaDB 10.4+.
- Node 20+ (solo para compilar la web; no hace falta en la PC de la caja).
- En Windows sirve XAMPP; en un servidor Linux, Nginx o Apache con PHP-FPM.

## 3. Base de datos con usuario propio (nunca `root`)

```sql
CREATE DATABASE boxy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'boxy'@'localhost' IDENTIFIED BY 'una-clave-larga-y-unica';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES, LOCK TABLES
  ON boxy.* TO 'boxy'@'localhost';
FLUSH PRIVILEGES;
```

En XAMPP, ponle además clave al usuario `root` de MySQL (desde phpMyAdmin → Cuentas de usuario).

## 4. API

```bash
cd apps/api
composer install --no-dev --optimize-autoloader
cp .env.production.example .env        # y completar: APP_URL, DB_*, BOXY_*
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force            # crea los planes y el super-admin (clave al azar, se muestra una vez)
php artisan boxy:instalar              # crea la tienda y su admin (clave temporal, se cambia al entrar)
php artisan storage:link
php artisan config:cache && php artisan route:cache
```

`db:seed` en producción **no** crea usuarios de prueba: la demo (`DemoSeeder`, clave
`password`) se niega a correr con `APP_ENV=production`.

## 5. Web

```bash
cd apps/web
npm ci
npm run build            # genera apps/web/dist
```

Servir `apps/web/dist` como sitio estático y enviar `/api` a Laravel (`apps/api/public`).
Ejemplo con Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name boxy.venz.cloud;
    # certificados (Let's Encrypt u otro)
    ssl_certificate     /etc/letsencrypt/live/boxy.venz.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/boxy.venz.cloud/privkey.pem;

    root /var/www/boxy/apps/web/dist;
    index index.html;

    # Cabeceras de seguridad para la web
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-src 'self' blob:; worker-src 'self' blob:" always;

    location / { try_files $uri /index.html; }

    location /api {
        root /var/www/boxy/apps/api/public;
        try_files $uri /index.php?$query_string;
    }
    location /storage { root /var/www/boxy/apps/api/public; }
    location ~ ^/index\.php$ {
        root /var/www/boxy/apps/api/public;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    }
}
```

La API agrega por su cuenta sus cabeceras (`nosniff`, `DENY`, CSP que no deja ejecutar nada).

**Instalación en la misma PC de la tienda (LAN):** se puede usar XAMPP/Apache con un
`VirtualHost` equivalente. Para que los teléfonos usen la cámara como escáner hace falta
HTTPS (certificado de la red local o `npm run lan` en desarrollo).

## 6. Tareas programadas (tasas, respaldos, limpieza)

Laravel necesita correr `php artisan schedule:run` **cada minuto**. Eso dispara:

| Hora (Caracas) | Tarea |
|---|---|
| 9:00 a. m. y 1:00 p. m. | Sincroniza las tasas BCV y USDT |
| 11:30 p. m. | Respaldo de la base (`boxy:respaldar`) y borrado de los viejos |
| Diario | Borra sesiones vencidas |

- **Linux:** `* * * * * cd /var/www/boxy/apps/api && php artisan schedule:run >> /dev/null 2>&1`
- **Windows:** ejecutar como administrador `scripts\instalar-tareas.ps1` (registra la tarea
  "Boxy-Programador" que corre cada minuto). Requiere que MySQL esté encendido.

## 7. Respaldos

- Se guardan en `apps/api/storage/app/private/respaldos` (30 días por defecto).
- `BOXY_RESPALDOS_COPIAR_A` copia cada respaldo a otra carpeta: un disco externo o una
  carpeta sincronizada con Google Drive / OneDrive. **Recomendado**: si se daña la PC, el
  respaldo sobrevive.
- Manual: `php artisan boxy:respaldar` · Restaurar: `php artisan boxy:restaurar`
  (hace un respaldo previo antes de reemplazar los datos).
- Desde la web: menú **Respaldos** (super-admin; en modo dedicado, el admin).

## 8. Lista de control antes de entregar

- [ ] `APP_ENV=production` y `APP_DEBUG=false`
- [ ] Usuario de base de datos propio, con clave
- [ ] HTTPS activo
- [ ] `php artisan db:seed` **sin** la demo (verificar que no existen `gerente@boxy.com` ni
      `caja@boxy.com`, que usan la clave `password`)
- [ ] Tarea programada corriendo (ver `storage/logs` a las 9:00 a. m.)
- [ ] `BOXY_RESPALDOS_COPIAR_A` apuntando fuera del disco de la PC
- [ ] Datos de la empresa, logo y ancho del ticket en **Mi empresa**
- [ ] Cada usuario con su clave; gerentes con PIN de supervisor
- [ ] Ticket de prueba impreso en la térmica
- [ ] `php artisan test` en verde (usa la base `boxy_test`)
- [ ] Revisar de vez en cuando `apps/api/storage/logs/seguridad-*.log`: ingresos fallidos,
      PIN de supervisor rechazados, cambios de rol, tasas cargadas a mano y respaldos
      descargados (se guarda 180 días; `LOG_SEGURIDAD_DIAS` lo cambia)

## 9. Documentos no fiscales

Los comprobantes, tickets y PDF de Boxy dicen "documento no fiscal". Si la tienda debe
emitir factura fiscal (comercio al detal), necesita una impresora fiscal homologada;
ver `docs/IMPRESORA-FISCAL.md`.

## 10. Vender suscripciones (modo SaaS)

Para cobrar licencias mensuales a varias tiendas en un mismo servidor:

- [ ] `.env`: `BOXY_MODO=saas`. `BOXY_REGISTRO_PUBLICO=true` si la landing deja crear
      cuentas con prueba gratis; `false` si las cuentas las creas tú desde **Panel Boxy**.
- [ ] Datos reales de cobro: `BOXY_COBRO_PAGO_MOVIL`, `BOXY_COBRO_TRANSFERENCIA`,
      `BOXY_COBRO_USDT`, `BOXY_COBRO_BINANCE`, `BOXY_COBRO_ZELLE` (texto libre; los vacíos no
      se muestran). El cliente los ve en **Mi licencia**.
- [ ] Contacto comercial: `BOXY_VENTAS_WHATSAPP` (solo dígitos, ej. `584140000000`) y/o
      `BOXY_VENTAS_EMAIL`. Activa "Hablar con ventas" en la landing.
- [ ] Precios y límites de los planes en **Panel Boxy → Planes** (Básico, Minimarket, Franquicia).
- [ ] `php artisan config:cache` después de cambiar el `.env`.
- [ ] Cuenta para enseñar el sistema: `BOXY_DEMO_EMAIL` y `BOXY_DEMO_PASSWORD` en el `.env` y
      `php artisan db:seed --class=CuentaPruebaSeeder` (empresa "Boxy Demo Market", plan
      Franquicia activo por un año).

Flujo de una venta: el cliente se registra (14 días gratis) o lo creas en **Panel Boxy →
Empresas**; paga por uno de los medios y lo reporta en **Mi licencia**; tú lo confirmas en
**Panel Boxy → Pagos** y la licencia se extiende. Si no paga, pasa a gracia y luego se
suspende (la API responde 402 y la tienda no puede vender hasta pagar).
