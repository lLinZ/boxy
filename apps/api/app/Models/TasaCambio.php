<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TasaCambio extends Model
{
    protected $table = 'tasas_cambio';

    protected $fillable = ['fecha', 'fuente', 'tasa'];

    protected $casts = [
        'fecha' => 'date',
        'tasa' => 'decimal:6',
    ];

    /** Tasa vigente más reciente (BCV por defecto). */
    public static function vigente(string $fuente = 'BCV'): ?self
    {
        return static::where('fuente', $fuente)
            ->orderByDesc('fecha')
            ->first();
    }
}
