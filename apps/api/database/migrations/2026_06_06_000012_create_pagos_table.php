<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Pagos de una venta. El pago en divisas (efectivo USD / Zelle) genera IGTF 3%.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pagos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('venta_id')->constrained('ventas')->cascadeOnDelete();
            $table->enum('metodo', [
                'efectivo_bs', 'efectivo_usd', 'pago_movil',
                'transferencia', 'tarjeta', 'zelle', 'otro',
            ]);
            $table->enum('moneda', ['VES', 'USD'])->default('VES');
            $table->decimal('monto', 16, 2);       // en la moneda del pago
            $table->decimal('monto_usd', 14, 2);   // equivalente en USD
            $table->boolean('aplica_igtf')->default(false);
            $table->decimal('igtf_usd', 14, 2)->default(0);
            $table->string('referencia')->nullable(); // nro de operación / banco
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pagos');
    }
};
