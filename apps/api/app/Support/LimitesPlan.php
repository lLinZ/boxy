<?php

namespace App\Support;

use App\Exceptions\ReglaNegocioException;
use App\Models\Producto;
use App\Models\Sucursal;
use App\Models\Suscripcion;
use App\Models\User;

/**
 * Límites y funciones del plan contratado (solo en modo SaaS).
 *
 * La suscripción guarda una copia de los límites del plan al contratarlo
 * (max_*, features): así un cambio de precios no altera a quien ya pagó.
 * Un límite en 0 (o vacío) significa "sin límite". En modo dedicado no hay planes.
 */
class LimitesPlan
{
    /** Funciones que dependen del plan y el texto que se muestra si faltan. */
    public const FUNCIONES = [
        'monitor' => 'el monitor de ventas en vivo',
        'analisis' => 'el análisis de rentabilidad',
        'escaner_remoto' => 'el escáner con el teléfono',
    ];

    public static function aplica(): bool
    {
        return config('boxy.modo') === 'saas';
    }

    public static function suscripcion(int $empresaId): ?Suscripcion
    {
        return Suscripcion::where('empresa_id', $empresaId)->first();
    }

    /** ¿El plan de la empresa incluye esta función? Sin suscripción (o dedicado) se permite. */
    public static function tieneFuncion(int $empresaId, string $funcion): bool
    {
        if (! self::aplica()) {
            return true;
        }
        $features = self::suscripcion($empresaId)?->features;

        // Una suscripción sin lista de funciones (planes viejos o a la medida) las tiene todas.
        return ! is_array($features) || ! array_key_exists($funcion, $features) || (bool) $features[$funcion];
    }

    /** Máximo del recurso (productos|usuarios|sucursales); null = sin límite. */
    public static function maximo(int $empresaId, string $recurso): ?int
    {
        if (! self::aplica()) {
            return null;
        }
        $max = (int) (self::suscripcion($empresaId)?->{'max_'.$recurso} ?? 0);

        return $max > 0 ? $max : null;
    }

    /** Uso actual: solo cuenta lo activo (lo desactivado no ocupa cupo). */
    public static function uso(int $empresaId, string $recurso): int
    {
        return match ($recurso) {
            'productos' => Producto::where('empresa_id', $empresaId)->where('activo', true)->count(),
            'usuarios' => User::where('empresa_id', $empresaId)->where('activo', true)->count(),
            'sucursales' => Sucursal::where('empresa_id', $empresaId)->where('activo', true)->count(),
        };
    }

    /** Cuántos más se pueden agregar; null = sin límite. */
    public static function disponibles(int $empresaId, string $recurso): ?int
    {
        $max = self::maximo($empresaId, $recurso);

        return $max === null ? null : max(0, $max - self::uso($empresaId, $recurso));
    }

    /** Lanza un error claro si agregar $cantidad supera el plan. */
    public static function exigirCupo(int $empresaId, string $recurso, int $cantidad = 1): void
    {
        $disponibles = self::disponibles($empresaId, $recurso);
        if ($disponibles !== null && $cantidad > $disponibles) {
            $max = self::maximo($empresaId, $recurso);
            $nombre = ['productos' => 'productos activos', 'usuarios' => 'usuarios activos', 'sucursales' => 'sucursales'][$recurso];
            throw new ReglaNegocioException(
                "Tu plan permite hasta {$max} {$nombre}. Mejora tu plan en \"Mi licencia\" para agregar más.",
                422,
                ['limite_plan' => $recurso, 'maximo' => $max],
            );
        }
    }

    public static function exigirFuncion(int $empresaId, string $funcion): void
    {
        if (! self::tieneFuncion($empresaId, $funcion)) {
            $texto = self::FUNCIONES[$funcion] ?? $funcion;
            throw new ReglaNegocioException(
                "Tu plan no incluye {$texto}. Mejora tu plan en \"Mi licencia\" para usarlo.",
                403,
                ['funcion_plan' => $funcion],
            );
        }
    }

    /** Resumen para la web: límites, uso y funciones. */
    public static function resumen(int $empresaId): ?array
    {
        if (! self::aplica()) {
            return null;
        }
        $sus = self::suscripcion($empresaId);
        $recursos = [];
        foreach (['productos', 'usuarios', 'sucursales'] as $r) {
            $recursos[$r] = ['maximo' => self::maximo($empresaId, $r), 'uso' => self::uso($empresaId, $r)];
        }
        $funciones = [];
        foreach (array_keys(self::FUNCIONES) as $f) {
            $funciones[$f] = self::tieneFuncion($empresaId, $f);
        }

        return [
            'plan' => $sus?->plan?->nombre,
            'limites' => $recursos,
            'funciones' => $funciones,
        ];
    }
}
