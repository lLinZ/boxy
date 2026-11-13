<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Sucursal = tienda física de una empresa. El inventario y las ventas se scopean aquí.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sucursales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->string('codigo', 20); // ej: CCS-01
            $table->string('nombre');
            $table->string('direccion')->nullable();
            $table->string('telefono', 30)->nullable();
            // Correlativos fiscales por sucursal
            $table->unsignedBigInteger('proximo_numero_factura')->default(1);
            $table->unsignedBigInteger('proximo_numero_control')->default(1);
            $table->string('serie_control', 10)->default('00');
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->unique(['empresa_id', 'codigo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sucursales');
    }
};
