<?php

namespace App\Http\Middleware;

use App\Support\Permisos;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Exige que el usuario tenga al menos uno de los permisos indicados.
 * Uso en rutas: ->middleware('permiso:productos.gestionar') o 'permiso:a,b' (cualquiera).
 */
class RequierePermiso
{
    public function handle(Request $request, Closure $next, string ...$permisos): Response
    {
        foreach ($permisos as $permiso) {
            if (Permisos::puede($request->user(), $permiso)) {
                return $next($request);
            }
        }

        abort(403, 'No tienes permiso para esta acción.');
    }
}
