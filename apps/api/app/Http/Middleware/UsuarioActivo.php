<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Un usuario desactivado pierde el acceso en su siguiente petición, aunque
 * todavía tenga un token vigente en el navegador.
 */
class UsuarioActivo
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->activo) {
            $user->tokens()->delete();
            abort(401, 'Usuario desactivado.');
        }

        return $next($request);
    }
}
