<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Puntos de fidelización ganados o canjeados por un cliente. */
class PuntosMovimiento extends Model
{
    protected $table = 'puntos_movimientos';

    protected $fillable = [
        'empresa_id', 'cliente_id', 'venta_id', 'tipo', 'puntos', 'saldo', 'nota',
    ];

    protected $casts = [
        'puntos' => 'integer',
        'saldo' => 'integer',
    ];

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }
}
