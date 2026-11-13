<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Kardex: cada cambio de stock queda registrado (auditable).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventario_movimientos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sucursal_id')->constrained('sucursales')->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('tipo', ['entrada', 'salida', 'ajuste', 'venta', 'devolucion']);
            $table->decimal('cantidad', 14, 3); // positivo suma, negativo resta
            $table->decimal('cantidad_anterior', 14, 3)->default(0);
            $table->decimal('cantidad_nueva', 14, 3)->default(0);
            $table->decimal('costo_usd', 12, 4)->default(0);
            $table->nullableMorphs('referencia'); // ej: venta que originó el movimiento
            $table->string('observacion')->nullable();
            $table->timestamps();

            $table->index(['sucursal_id', 'producto_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventario_movimientos');
    }
};
