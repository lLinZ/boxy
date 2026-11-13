<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Venta = comprobante (factura/nota). Montos canónicos en USD + total convertido a Bs a la tasa.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ventas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->foreignId('sucursal_id')->constrained('sucursales')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('cliente_id')->nullable()->constrained('clientes')->nullOnDelete();
            $table->foreignId('tasa_cambio_id')->nullable()->constrained('tasas_cambio')->nullOnDelete();

            $table->enum('tipo_documento', ['factura', 'nota_entrega', 'nota_credito'])->default('factura');
            $table->string('numero_factura', 30)->nullable();
            $table->string('numero_control', 30)->nullable();
            $table->dateTime('fecha');

            $table->decimal('tasa', 18, 6)->default(0); // Bs/USD usado en esta venta

            // Totales en USD (canónico)
            $table->decimal('subtotal_usd', 14, 2)->default(0);     // suma de items sin IVA
            $table->decimal('descuento_usd', 14, 2)->default(0);
            $table->decimal('base_imponible_usd', 14, 2)->default(0);
            $table->decimal('iva_usd', 14, 2)->default(0);
            $table->decimal('igtf_usd', 14, 2)->default(0);         // 3% sobre pagos en divisa
            $table->decimal('total_usd', 14, 2)->default(0);
            $table->decimal('total_bs', 16, 2)->default(0);         // total_usd * tasa (+ igtf)

            $table->enum('estado', ['borrador', 'emitida', 'anulada'])->default('borrador');
            $table->string('observacion')->nullable();
            $table->timestamps();

            $table->unique(['sucursal_id', 'numero_factura']);
            $table->index(['empresa_id', 'fecha']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ventas');
    }
};
