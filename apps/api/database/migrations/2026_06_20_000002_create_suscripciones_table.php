<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Una suscripción por empresa = fuente de verdad de la licencia. El middleware la lee.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suscripciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->unique()->constrained('empresas')->cascadeOnDelete();
            $table->foreignId('plan_id')->nullable()->constrained('planes')->nullOnDelete();
            $table->enum('estado', ['trialing', 'activa', 'gracia', 'suspendida', 'vencida', 'cancelada'])
                ->default('trialing');
            // Snapshot del plan al activar (inmuniza ante cambios de tarifa/límites)
            $table->decimal('precio_usd', 10, 2)->nullable();
            $table->unsignedSmallInteger('max_sucursales')->nullable();
            $table->unsignedSmallInteger('max_usuarios')->nullable();
            $table->unsignedInteger('max_productos')->nullable();
            $table->json('features')->nullable();
            // Ciclo de vida
            $table->timestamp('trial_termina_el')->nullable();
            $table->timestamp('vence_el')->nullable();
            $table->timestamp('gracia_hasta')->nullable();
            $table->timestamp('suspendida_el')->nullable();
            $table->string('motivo_suspension')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suscripciones');
    }
};
