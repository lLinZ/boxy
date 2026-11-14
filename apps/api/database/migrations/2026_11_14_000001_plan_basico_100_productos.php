<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * El plan Básico pasa de 500 a 100 productos. Se actualiza el plan y las
 * suscripciones del Básico que todavía tienen el límite viejo de 500.
 * Bajar el límite no borra nada: solo impide crear productos nuevos por
 * encima del tope (los que ya existen siguen funcionando).
 */
return new class extends Migration
{
    public function up(): void
    {
        $planId = DB::table('planes')->where('codigo', 'basico')->value('id');
        if (! $planId) {
            return;
        }
        DB::table('planes')->where('id', $planId)->update(['max_productos' => 100, 'updated_at' => now()]);
        DB::table('suscripciones')->where('plan_id', $planId)->where('max_productos', 500)
            ->update(['max_productos' => 100, 'updated_at' => now()]);
    }

    public function down(): void
    {
        $planId = DB::table('planes')->where('codigo', 'basico')->value('id');
        if (! $planId) {
            return;
        }
        DB::table('planes')->where('id', $planId)->update(['max_productos' => 500]);
        DB::table('suscripciones')->where('plan_id', $planId)->where('max_productos', 100)->update(['max_productos' => 500]);
    }
};
