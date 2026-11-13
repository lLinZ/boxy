<?php

use Illuminate\Support\Facades\Schedule;

// Para que corran estas tareas, el servidor debe ejecutar cada minuto:
//   php artisan schedule:run
// (en Windows: tarea programada; ver docs/DESPLIEGUE.md y scripts/instalar-tareas.ps1)

// Tasa del día: sincroniza automáticamente a las 9:00 a.m. y 1:00 p.m. (hora Venezuela)
Schedule::command('tasas:sincronizar')
    ->dailyAt('09:00')
    ->timezone('America/Caracas')
    ->withoutOverlapping()
    ->onSuccess(fn () => logger()->info('Tasas sincronizadas (9am)'))
    ->onFailure(fn () => logger()->warning('Falló sincronización de tasas (9am)'));

Schedule::command('tasas:sincronizar')
    ->dailyAt('13:00')
    ->timezone('America/Caracas')
    ->withoutOverlapping()
    ->onSuccess(fn () => logger()->info('Tasas sincronizadas (1pm)'))
    ->onFailure(fn () => logger()->warning('Falló sincronización de tasas (1pm)'));

// Respaldo diario de la base de datos (y limpieza de los viejos)
Schedule::command('boxy:respaldar')
    ->dailyAt('23:30')
    ->timezone('America/Caracas')
    ->withoutOverlapping()
    ->onFailure(fn () => logger()->error('Falló el respaldo automático'));

// Borra tokens de sesión vencidos
Schedule::command('sanctum:prune-expired --hours=24')->daily();
