<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Venta extends Model
{
    protected $table = 'ventas';

    protected $fillable = [
        'empresa_id', 'sucursal_id', 'user_id', 'cliente_id', 'tasa_cambio_id',
        'tipo_documento', 'numero_factura', 'numero_control', 'fecha', 'tasa',
        'subtotal_usd', 'descuento_usd', 'base_imponible_usd', 'iva_usd',
        'igtf_usd', 'total_usd', 'total_bs', 'estado', 'observacion',
        'uuid', 'turno_id', 'origen', 'vuelto_usd', 'vuelto_metodo', 'vuelto_moneda', 'vuelto_monto',
        'anulada_el', 'anulada_por', 'autorizada_por', 'motivo_anulacion', 'devuelto_usd', 'puntos_ganados',
        'estado_fiscal', 'numero_fiscal', 'serial_fiscal', 'error_fiscal',
    ];

    protected $casts = [
        'fecha' => 'datetime',
        'tasa' => 'decimal:6',
        'subtotal_usd' => 'decimal:2',
        'descuento_usd' => 'decimal:2',
        'base_imponible_usd' => 'decimal:2',
        'iva_usd' => 'decimal:2',
        'igtf_usd' => 'decimal:2',
        'total_usd' => 'decimal:2',
        'total_bs' => 'decimal:2',
        'vuelto_usd' => 'decimal:2',
        'vuelto_monto' => 'decimal:2',
        'devuelto_usd' => 'decimal:2',
        'anulada_el' => 'datetime',
    ];

    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class);
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(VentaItem::class);
    }

    public function pagos(): HasMany
    {
        return $this->hasMany(Pago::class);
    }

    public function turno(): BelongsTo
    {
        return $this->belongsTo(TurnoCaja::class, 'turno_id');
    }

    public function devoluciones(): HasMany
    {
        return $this->hasMany(Devolucion::class);
    }

    public function anuladaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'anulada_por');
    }

    public function autorizadaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autorizada_por');
    }
}
