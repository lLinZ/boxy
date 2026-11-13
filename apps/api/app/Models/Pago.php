<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Pago extends Model
{
    protected $table = 'pagos';

    protected $fillable = [
        'venta_id', 'metodo', 'moneda', 'monto', 'monto_usd', 'aplicado_usd',
        'aplica_igtf', 'igtf_usd', 'referencia',
    ];

    protected $casts = [
        'monto' => 'decimal:2',
        'monto_usd' => 'decimal:2',
        'aplicado_usd' => 'decimal:2',
        'aplica_igtf' => 'boolean',
        'igtf_usd' => 'decimal:2',
    ];

    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class);
    }
}
