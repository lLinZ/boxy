<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

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
            'plan' => \App\Http\Middleware\RequiereFuncionPlan::class,
            // Habilidades de tokens Sanctum (el token del teléfono-escáner solo puede escanear)
            'abilities' => \Laravel\Sanctum\Http\Middleware\CheckAbilities::class,
            'ability' => \Laravel\Sanctum\Http\Middleware\CheckForAnyAbility::class,
        ]);

        // Límite general de peticiones por usuario/IP (ver AppServiceProvider).
        $middleware->throttleApi('api');
        $middleware->api(append: [\App\Http\Middleware\CabecerasSeguridad::class]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Los errores genéricos del framework vienen en inglés ("Unauthenticated.",
        // "Too Many Attempts.", "Server Error"...). Aquí se traducen a mensajes claros
        // para el usuario. Los mensajes propios (abort(403, '...'), ReglaNegocioException)
        // no se tocan porque no coinciden con ninguno de estos.
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            if (! $response instanceof JsonResponse) {
                return $response;
            }
            $data = $response->getData(true);
            $mensaje = is_array($data) ? ($data['message'] ?? null) : null;
            if (! is_string($mensaje)) {
                return $response;
            }

            $status = $response->getStatusCode();
            $traducciones = [
                'Unauthenticated.' => 'Tu sesión venció o no has iniciado sesión. Vuelve a entrar.',
                'This action is unauthorized.' => 'No tienes permiso para esta acción.',
                'Too Many Attempts.' => 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.',
                'CSRF token mismatch.' => 'La sesión expiró. Recarga la página.',
                'Server Error' => 'Ocurrió un error en el servidor. Intenta de nuevo; si sigue pasando, avisa a soporte.',
                'Not Found' => 'No se encontró lo que buscas.',
                'Forbidden' => 'No tienes permiso para esta acción.',
                'Unauthorized' => 'Tu sesión venció o no has iniciado sesión. Vuelve a entrar.',
                'Service Unavailable' => 'El sistema está en mantenimiento. Intenta en unos minutos.',
                'Method Not Allowed' => 'Operación no permitida.',
                'Payload Too Large' => 'El archivo es demasiado pesado.',
                'Content Too Large' => 'El archivo es demasiado pesado.',
                'Page Expired' => 'La sesión expiró. Recarga la página.',
                'Invalid ability provided.' => 'Este acceso no tiene permiso para esa operación.',
            ];

            $nuevo = $traducciones[$mensaje] ?? match (true) {
                str_starts_with($mensaje, 'No query results for model') => 'El registro que buscas no existe o fue eliminado.',
                (bool) preg_match('/^The route .* could not be found\.$/', $mensaje) => 'No se encontró lo que buscas.',
                (bool) preg_match('/^The .* method is not supported/', $mensaje) => 'Operación no permitida.',
                $mensaje === '' && $status >= 500 => $traducciones['Server Error'],
                $mensaje === '' && $status === 404 => $traducciones['Not Found'],
                $mensaje === '' && $status === 403 => $traducciones['Forbidden'],
                default => null,
            };

            if ($nuevo === null) {
                return $response;
            }
            $data['message'] = $nuevo;

            return $response->setData($data);
        });
    })->create();
