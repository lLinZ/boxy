<?php

/*
 * CORS: la web y la API se sirven desde el mismo dominio, así que el navegador no
 * necesita permiso cruzado. Solo se aceptan los orígenes de BOXY_ORIGENES (separados
 * por coma) o, si no se define, el de APP_URL; cualquier otra página no puede leer
 * las respuestas de la API. La app móvil (nativa) no usa CORS.
 */
return [

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_map(
        fn ($origen) => rtrim(trim($origen), '/'),
        explode(',', (string) env('BOXY_ORIGENES', env('APP_URL', ''))),
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // Autenticación por token en la cabecera, sin cookies cruzadas
    'supports_credentials' => false,

];
