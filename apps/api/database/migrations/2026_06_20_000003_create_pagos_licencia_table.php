<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Pagos de licencia reportados por la empresa y confirmados por el super-admin.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pagos_licencia', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->foreignId('suscripcion_id')->constrained('suscripciones')->cascadeOnDelete();
            $table->foreignId('plan_id')->nullable()->constrained('planes')->nullOnDelete();
            $table->enum('metodo', ['pago_movil', 'transferencia', 'usdt', 'zelle', 'efectivo', 'otro']);
            $table->enum('moneda', ['USD', 'VES'])->default('USD');
            $table->decimal('monto', 16, 2);
            $table->decimal('monto_usd', 14, 2);
            $table->string('referencia')->nullable();      // nº operación / hash USDT
            $table->string('comprobante_path')->nullable();
            $table->unsignedTinyInteger('meses')->default(1);
            $table->enum('estado', ['reportado', 'confirmado', 'rechazado'])->default('reportado');
            $table->foreignId('confirmado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('confirmado_el')->nullable();
            $table->string('motivo_rechazo')->nullable();
            $table->date('periodo_desde')->nullable();
            $table->date('periodo_hasta')->nullable();
            $table->text('nota')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pagos_licencia');
    }
};
