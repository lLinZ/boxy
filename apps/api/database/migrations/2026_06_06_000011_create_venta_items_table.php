<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('venta_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('venta_id')->constrained('ventas')->cascadeOnDelete();
            $table->foreignId('producto_id')->nullable()->constrained('productos')->nullOnDelete();
            $table->string('descripcion'); // se guarda el nombre al momento de vender
            $table->decimal('cantidad', 14, 3);
            $table->decimal('precio_unitario_usd', 12, 4);
            $table->enum('tipo_iva', ['general', 'reducido', 'exento'])->default('general');
            $table->decimal('alicuota_iva', 5, 2)->default(16); // % aplicado
            $table->decimal('descuento_usd', 14, 2)->default(0);
            $table->decimal('base_usd', 14, 2)->default(0);     // cantidad * precio - descuento
            $table->decimal('iva_usd', 14, 2)->default(0);
            $table->decimal('total_usd', 14, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('venta_items');
    }
};
