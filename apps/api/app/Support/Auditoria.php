<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * Bitácora de seguridad: deja constancia de quién hizo qué en las acciones
 * sensibles (canal "seguridad", storage/logs/seguridad-AAAA-MM-DD.log).
 *
 * Nunca se registran claves, PIN ni tokens: solo el evento, el usuario, la
 * empresa, la IP y los datos que se pasen (ids, correos, roles).
 */
class Auditoria
{
    public static function registrar(string $evento, array $datos = []): void
    {
        $request = request();
        $user = $request?->user();

        Log::channel('seguridad')->info($evento, [
            'usuario_id' => $user?->id,
            'empresa_id' => $user?->empresa_id,
            'ip' => $request?->ip(),
            ...$datos,
        ]);
    }
}
