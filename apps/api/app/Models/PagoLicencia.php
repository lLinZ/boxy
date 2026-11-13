<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PagoLicencia extends Model
{
    protected $table = 'pagos_licencia';

    protected $fillable = [
        'empresa_id', 'suscripcion_id', 'plan_id', 'metodo', 'moneda',
        'monto', 'monto_usd', 'referencia', 'comprobante_path', 'meses',
        'estado', 'confirmado_por', 'confirmado_el', 'motivo_rechazo',
        'periodo_desde', 'periodo_hasta', 'nota',
    ];

    protected $casts = [
        'monto' => 'decimal:2',
        'monto_usd' => 'decimal:2',
        'confirmado_el' => 'datetime',
        'periodo_desde' => 'date',
        'periodo_hasta' => 'date',
    ];

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    public function suscripcion(): BelongsTo
    {
        return $this->belongsTo(Suscripcion::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }
}
