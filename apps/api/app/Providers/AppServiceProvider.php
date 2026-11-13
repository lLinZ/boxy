<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Límite general: el POS sondea la cola del escáner cada 1,5 s y el monitor
        // refresca solo, así que el margen es amplio; frena abusos y scripts.
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(300)
            ->by($request->user()?->id ?: $request->ip()));

        // Login: 5 intentos por minuto por correo+IP y 20 por IP.
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by(strtolower((string) $request->input('email')).'|'.$request->ip()),
            Limit::perMinute(20)->by($request->ip()),
        ]);

        // Registro de empresas: pocos por hora e IP.
        RateLimiter::for('registro', fn (Request $request) => Limit::perHour(5)->by($request->ip()));

        // Canje del código del escáner (6 caracteres): evita probarlos por fuerza bruta.
        RateLimiter::for('scanner-canje', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));

        // Contraseñas: mínimo 8 caracteres con letras y números.
        Password::defaults(fn () => Password::min(8)->letters()->numbers());
    }
}
