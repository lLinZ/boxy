<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Movimiento del estado de cuenta (fiado): cargo = aumenta la deuda, abono = la reduce. */
class CuentaMovimiento extends Model
{
    protected $table = 'cuenta_movimientos';

    protected $fillable = [
        'empresa_id', 'cliente_id', 'tipo', 'venta_id', 'devolucion_id', 'turno_id', 'user_id', 'metodo',
        'moneda', 'monto', 'monto_usd', 'igtf_usd', 'tasa', 'saldo_usd', 'referencia', 'nota',
    ];

    protected $casts = [
        'monto' => 'decimal:2',
        'monto_usd' => 'decimal:2',
        'igtf_usd' => 'decimal:2',
        'tasa' => 'decimal:6',
        'saldo_usd' => 'decimal:2',
    ];

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
