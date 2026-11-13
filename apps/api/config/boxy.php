<?php

/*
|--------------------------------------------------------------------------
| Configuración propia de Boxy
|--------------------------------------------------------------------------
| modo:
|   - saas      → varias empresas, licencias mensuales, registro público opcional.
|   - dedicado  → instalación de una sola tienda (el cliente es dueño del sistema):
|                 sin licencias, sin registro público y el admin puede cargar la tasa.
*/

$modo = env('BOXY_MODO', 'saas');

return [

    'modo' => $modo,

    // Registro self-service de empresas (POST /api/registro). En "dedicado" no existe.
    'registro_publico' => (bool) env('BOXY_REGISTRO_PUBLICO', $modo === 'saas'),

    'tasas' => [
        // Verificar el certificado HTTPS de la API de tasas. Solo se desactiva en
        // desarrollo si el bundle de certificados de PHP está viejo (cURL error 60).
        'verificar_ssl' => (bool) env('TASAS_VERIFICAR_SSL', true),
        // Ruta opcional a un bundle de certificados (cacert.pem) propio.
        'ca_bundle' => env('TASAS_CA_BUNDLE'),
        // Variación máxima aceptada contra la tasa anterior (0.5 = 50 %). Una
        // variación mayor se rechaza (sincronización) o pide confirmación (manual).
        'variacion_maxima' => (float) env('TASAS_VARIACION_MAXIMA', 0.5),
    ],

    // Duración de la sesión web (minutos). 960 = 16 h, una jornada larga de abasto.
    'sesion_minutos' => (int) env('BOXY_SESION_MINUTOS', 960),

    // Intentos de PIN de supervisor antes de bloquear por unos minutos.
    'pin_intentos' => (int) env('BOXY_PIN_INTENTOS', 5),
    // Tope de PIN fallidos por cajero en 24 h: sin él, 5 cada 10 min dejan probar
    // ~720 PIN al día y uno de 4 dígitos cae en una semana; con 15 tardaría más de un año.
    'pin_intentos_dia' => (int) env('BOXY_PIN_INTENTOS_DIA', 15),

    'respaldos' => [
        // Carpeta donde se guardan los respaldos (relativa a storage/app/private).
        'carpeta' => 'respaldos',
        // Días que se conservan los respaldos automáticos.
        'conservar_dias' => (int) env('BOXY_RESPALDOS_DIAS', 30),
        // Carpeta extra donde copiar cada respaldo (ej. una carpeta de Google Drive o un USB).
        'copiar_a' => env('BOXY_RESPALDOS_COPIAR_A'),
        // Ruta de mysqldump; si no se encuentra se usa el volcado en PHP.
        'mysqldump' => env('BOXY_MYSQLDUMP'),
    ],
];
