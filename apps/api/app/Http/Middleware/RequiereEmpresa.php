<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Las pantallas de operación (ventas, inventario, clientes…) necesitan una
 * empresa. El super-admin no pertenece a ninguna, así que se le responde 403
 * en vez de dejar que las consultas fallen con un error 500.
 */
class RequiereEmpresa
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->empresa_id, 403, 'Esta sección es de las empresas.');

        return $next($request);
    }
}
