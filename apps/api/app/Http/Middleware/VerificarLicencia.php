<?php

namespace App\Http\Middleware;

use App\Models\Suscripcion;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Bloquea el acceso a las funciones del sistema si la empresa no tiene una
 * licencia activa (trial/activa/gracia). Responde 402 para que el frontend
 * redirija a la pantalla de facturación. El super-admin no está sujeto a esto,
 * y en una instalación dedicada (una sola tienda, dueña del sistema) no hay licencias.
 */
class VerificarLicencia
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (config('boxy.modo') === 'dedicado' || ($user && $user->esSuperAdmin())) {
            return $next($request);
        }

        $suscripcion = $user
            ? Suscripcion::where('empresa_id', $user->empresa_id)->first()
            : null;

        if ($suscripcion && $suscripcion->puedeOperar()) {
            return $next($request);
        }

        return response()->json([
            'message' => 'La licencia de tu empresa está inactiva o vencida. Renuévala para seguir usando Boxy.',
            'licencia' => [
                'estado' => $suscripcion?->estado ?? 'sin_suscripcion',
                'dias_restantes' => $suscripcion?->diasRestantes() ?? 0,
            ],
        ], 402);
    }
}
