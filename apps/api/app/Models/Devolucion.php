<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Devolución (parcial o total) de una venta: reingresa stock y reintegra el dinero. */
class Devolucion extends Model
{
    protected $table = 'devoluciones';

    protected $fillable = [
        'empresa_id', 'sucursal_id', 'venta_id', 'turno_id', 'user_id', 'autorizada_por', 'numero',
        'motivo', 'tasa', 'total_usd', 'reintegro_metodo', 'reintegro_moneda', 'reintegro_monto',
    ];

    protected $casts = [
        'tasa' => 'decimal:6',
        'total_usd' => 'decimal:2',
        'reintegro_monto' => 'decimal:2',
    ];

    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(DevolucionItem::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function autorizadaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autorizada_por');
    }
}
