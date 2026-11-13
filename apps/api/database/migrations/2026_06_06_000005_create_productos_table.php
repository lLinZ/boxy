<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Productos definidos a nivel de empresa (catálogo). El stock vive en 'inventarios' por sucursal.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('productos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->foreignId('categoria_id')->nullable()->constrained('categorias')->nullOnDelete();
            $table->string('sku', 50);
            $table->string('codigo_barra', 50)->nullable();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            $table->string('unidad', 20)->default('UND'); // UND, KG, LT, etc.
            // Precios canónicos en USD (Venezuela: referencia en divisa, cobro en Bs al cambio BCV)
            $table->decimal('precio_costo_usd', 12, 4)->default(0);
            $table->decimal('precio_venta_usd', 12, 4)->default(0);
            // Tipo de IVA SENIAT: general 16, reducido 8, exento 0
            $table->enum('tipo_iva', ['general', 'reducido', 'exento'])->default('general');
            $table->boolean('controla_stock')->default(true);
            $table->string('imagen_path')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->unique(['empresa_id', 'sku']);
            $table->index(['empresa_id', 'codigo_barra']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('productos');
    }
};
