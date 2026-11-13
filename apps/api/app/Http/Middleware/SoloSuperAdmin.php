<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Solo el dueño del SaaS (rol super_admin) puede entrar al panel de administración.
class SoloSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->esSuperAdmin(), 403, 'Solo super administradores.');

        return $next($request);
    }
}
