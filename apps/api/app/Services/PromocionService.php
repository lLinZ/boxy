<?php

namespace App\Services;

use App\Models\Promocion;
use Illuminate\Support\Carbon;

class PromocionService
{
    /**
     * Promociones activas de la empresa en un momento dado, en el formato que
     * espera CalculadoraVenta (y la web, que las aplica igual en el POS).
     */
    public function vigentes(int $empresaId, ?Carbon $momento = null): array
    {
        $momento ??= now();
        $hoy = $momento->toDateString();
        $dia = $momento->dayOfWeek; // 0 = domingo

        return Promocion::where('empresa_id', $empresaId)
            ->where('activo', true)
            ->where(fn ($q) => $q->whereNull('desde')->orWhere('desde', '<=', $hoy))
            ->where(fn ($q) => $q->whereNull('hasta')->orWhere('hasta', '>=', $hoy))
            ->get()
            ->filter(fn (Promocion $p) => empty($p->dias_semana) || in_array($dia, array_map('intval', $p->dias_semana), true))
            ->map(fn (Promocion $p) => [
                'id' => $p->id,
                'nombre' => $p->nombre,
                'tipo' => $p->tipo,
                'producto_id' => $p->producto_id,
                'categoria_id' => $p->categoria_id,
                'valor' => (float) $p->valor,
                'lleva' => $p->lleva,
                'paga' => $p->paga,
                'cantidad_minima' => (float) $p->cantidad_minima,
            ])
            ->values()
            ->all();
    }
}
