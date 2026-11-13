<?php

namespace App\Services;

use App\Exceptions\ReglaNegocioException;
use App\Models\User;
use App\Support\Auditoria;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Autorización de supervisor en caja: si el cajero no tiene el permiso
 * (anular, devolver, descontar, fiar por encima del límite), un supervisor
 * de la misma empresa escribe su correo y su PIN en la pantalla del POS.
 */
class AutorizacionService
{
    /**
     * @param  array|null  $autorizacion  ['email' => ..., 'pin' => ...]
     * @return User|null El supervisor que autorizó, o null si el propio usuario tiene el permiso.
     *
     * @throws ReglaNegocioException
     */
    public function exigir(User $actor, string $permiso, ?array $autorizacion, string $accion): ?User
    {
        if ($actor->puede($permiso)) {
            return null;
        }

        if (empty($autorizacion['email']) || empty($autorizacion['pin'])) {
            throw new ReglaNegocioException(
                "Para {$accion} se necesita la autorización de un supervisor.",
                403,
                ['requiere_supervisor' => true, 'permiso' => $permiso],
            );
        }

        // Frena la prueba de PINs a ciegas (4 dígitos = 10 000 combinaciones):
        // unos pocos cada 10 min y, además, un tope por día.
        $clave = 'pin-supervisor:'.$actor->id;
        $claveDia = 'pin-supervisor-dia:'.$actor->id;
        if (RateLimiter::tooManyAttempts($claveDia, (int) config('boxy.pin_intentos_dia', 15))) {
            $horas = (int) ceil(RateLimiter::availableIn($claveDia) / 3600);
            Auditoria::registrar('pin.bloqueado_dia', ['permiso' => $permiso, 'supervisor' => $autorizacion['email']]);
            throw new ReglaNegocioException(
                "Demasiados PIN equivocados hoy en este usuario. Se desbloquea en {$horas} h (o que un supervisor use su propia sesión).",
                429,
            );
        }
        if (RateLimiter::tooManyAttempts($clave, (int) config('boxy.pin_intentos', 5))) {
            $minutos = (int) ceil(RateLimiter::availableIn($clave) / 60);
            Auditoria::registrar('pin.bloqueado', ['permiso' => $permiso, 'supervisor' => $autorizacion['email']]);
            throw new ReglaNegocioException("Demasiados intentos de PIN. Espera {$minutos} min.", 429);
        }

        $supervisor = User::where('email', $autorizacion['email'])
            ->where('empresa_id', $actor->empresa_id)
            ->where('activo', true)
            ->first();

        $valido = $supervisor
            && $supervisor->pin_supervisor
            && Hash::check((string) $autorizacion['pin'], $supervisor->pin_supervisor)
            && $supervisor->puede($permiso);

        if (! $valido) {
            RateLimiter::hit($clave, 600);
            RateLimiter::hit($claveDia, 86400);
            Auditoria::registrar('pin.rechazado', ['permiso' => $permiso, 'supervisor' => $autorizacion['email']]);
            throw new ReglaNegocioException(
                'Autorización rechazada: correo o PIN incorrectos, o el usuario no puede autorizar esto.',
                403,
                ['requiere_supervisor' => true, 'permiso' => $permiso],
            );
        }

        // Un PIN correcto perdona la espera de 10 min, pero no el tope del día: si no,
        // pedir una autorización legítima de vez en cuando reiniciaría la cuenta.
        RateLimiter::clear($clave);
        Auditoria::registrar('pin.autorizado', ['permiso' => $permiso, 'supervisor_id' => $supervisor->id]);

        return $supervisor;
    }
}
