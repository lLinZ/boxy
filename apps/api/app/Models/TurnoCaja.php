<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Turno de caja de un cajero: apertura con fondo, ventas del turno y arqueo al cierre. */
class TurnoCaja extends Model
{
    protected $table = 'turnos_caja';

    protected $fillable = [
        'empresa_id', 'sucursal_id', 'user_id', 'estado', 'abierto_el', 'cerrado_el', 'cerrado_por',
        'tasa_apertura', 'fondo_bs', 'fondo_usd', 'esperado_bs', 'esperado_usd', 'contado_bs',
        'contado_usd', 'diferencia_bs', 'diferencia_usd', 'resumen', 'observacion',
    ];

    protected $casts = [
        'abierto_el' => 'datetime',
        'cerrado_el' => 'datetime',
        'tasa_apertura' => 'decimal:6',
        'fondo_bs' => 'decimal:2',
        'fondo_usd' => 'decimal:2',
        'esperado_bs' => 'decimal:2',
        'esperado_usd' => 'decimal:2',
        'contado_bs' => 'decimal:2',
        'contado_usd' => 'decimal:2',
        'diferencia_bs' => 'decimal:2',
        'diferencia_usd' => 'decimal:2',
        'resumen' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class);
    }

    public function cerradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cerrado_por');
    }

    public function ventas(): HasMany
    {
        return $this->hasMany(Venta::class, 'turno_id');
    }

    public function estaAbierto(): bool
    {
        return $this->estado === 'abierto';
    }
}
