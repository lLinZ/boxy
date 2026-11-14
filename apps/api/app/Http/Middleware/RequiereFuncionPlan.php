<?php

namespace App\Http\Middleware;

use App\Support\LimitesPlan;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Exige que el plan de la empresa incluya una función (ej. "plan:monitor").
 * Responde 403 con un mensaje que invita a mejorar el plan.
 */
class RequiereFuncionPlan
{
    public function handle(Request $request, Closure $next, string $funcion): Response
    {
        if ($empresaId = $request->user()?->empresa_id) {
            LimitesPlan::exigirFuncion($empresaId, $funcion);
        }

        return $next($request);
    }
}
