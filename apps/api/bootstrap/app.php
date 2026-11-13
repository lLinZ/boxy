<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'licencia' => \App\Http\Middleware\VerificarLicencia::class,
            'superadmin' => \App\Http\Middleware\SoloSuperAdmin::class,
            'permiso' => \App\Http\Middleware\RequierePermiso::class,
            'activo' => \App\Http\Middleware\UsuarioActivo::class,
            'empresa' => \App\Http\Middleware\RequiereEmpresa::class,
            // Habilidades de tokens Sanctum (el token del teléfono-escáner solo puede escanear)
            'abilities' => \Laravel\Sanctum\Http\Middleware\CheckAbilities::class,
            'ability' => \Laravel\Sanctum\Http\Middleware\CheckForAnyAbility::class,
        ]);

        // Límite general de peticiones por usuario/IP (ver AppServiceProvider).
        $middleware->throttleApi('api');
        $middleware->api(append: [\App\Http\Middleware\CabecerasSeguridad::class]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
