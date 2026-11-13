<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Suscripcion extends Model
{
    protected $table = 'suscripciones';

    protected $fillable = [
        'empresa_id', 'plan_id', 'estado', 'precio_usd', 'max_sucursales',
        'max_usuarios', 'max_productos', 'features', 'trial_termina_el',
        'vence_el', 'gracia_hasta', 'suspendida_el', 'motivo_suspension',
    ];

    protected $casts = [
        'features' => 'array',
        'precio_usd' => 'decimal:2',
        'trial_termina_el' => 'datetime',
        'vence_el' => 'datetime',
        'gracia_hasta' => 'datetime',
        'suspendida_el' => 'datetime',
    ];

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function pagos(): HasMany
    {
        return $this->hasMany(PagoLicencia::class);
    }

    /** Fecha límite vigente según el estado. */
    public function fechaLimite(): ?Carbon
    {
        return match ($this->estado) {
            'trialing' => $this->trial_termina_el,
            'gracia' => $this->gracia_hasta,
            default => $this->vence_el,
        };
    }

    /** Regla central: ¿la empresa puede usar el sistema ahora mismo? */
    public function puedeOperar(): bool
    {
        return match ($this->estado) {
            'trialing' => $this->trial_termina_el && now()->lt($this->trial_termina_el),
            'activa' => $this->vence_el && now()->lt($this->vence_el),
            'gracia' => $this->gracia_hasta && now()->lt($this->gracia_hasta),
            default => false, // suspendida | vencida | cancelada
        };
    }

    public function diasRestantes(): int
    {
        $fin = $this->fechaLimite();

        return $fin ? max(0, (int) ceil(now()->floatDiffInDays($fin, false))) : 0;
    }
}
