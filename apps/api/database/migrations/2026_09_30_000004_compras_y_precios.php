<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Fase 3: proveedores, compras (costo promedio), historial de precios y lotes.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proveedores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->string('tipo_documento', 1)->default('J');
            $table->string('documento', 20)->nullable();
            $table->string('nombre');
            $table->string('contacto')->nullable();
            $table->string('telefono', 30)->nullable();
            $table->string('email')->nullable();
            $table->string('direccion')->nullable();
            $table->text('notas')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->index(['empresa_id', 'nombre']);
        });

        Schema::create('compras', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->foreignId('sucursal_id')->constrained('sucursales')->cascadeOnDelete();
            $table->foreignId('proveedor_id')->nullable()->constrained('proveedores')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('numero', 30);                          // correlativo interno
            $table->string('documento_proveedor', 50)->nullable(); // nº de factura del proveedor
            $table->date('fecha');
            $table->decimal('tasa', 18, 6)->default(0);
            $table->string('moneda', 3)->default('USD');           // moneda en que vino la factura
            $table->decimal('subtotal_usd', 14, 2)->default(0);
            $table->decimal('iva_usd', 14, 2)->default(0);
            $table->decimal('total_usd', 14, 2)->default(0);
            $table->string('condicion', 10)->default('contado');   // contado | credito
            $table->date('vence_el')->nullable();
            $table->boolean('pagada')->default(true);
            $table->string('estado', 15)->default('registrada');   // registrada | anulada
            $table->string('observacion')->nullable();
            $table->timestamps();

            $table->unique(['sucursal_id', 'numero']);
            $table->index(['empresa_id', 'fecha']);
        });

        Schema::create('compra_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('compra_id')->constrained('compras')->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained('productos');
            $table->decimal('cantidad', 14, 3);
            $table->decimal('costo_unitario_usd', 12, 4);
            $table->decimal('iva_usd', 14, 2)->default(0);
            $table->decimal('total_usd', 14, 2);
            $table->decimal('costo_anterior_usd', 12, 4)->default(0); // costo promedio antes de la compra
            $table->decimal('costo_promedio_usd', 12, 4)->default(0); // costo promedio después
            $table->string('lote', 50)->nullable();
            $table->date('vence_el')->nullable();
            $table->timestamps();
        });

        Schema::create('precio_historial', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('precio_anterior_usd', 12, 4);
            $table->decimal('precio_nuevo_usd', 12, 4);
            $table->string('motivo', 100)->nullable(); // manual | masivo | compra
            $table->timestamps();

            $table->index(['producto_id', 'id']);
        });

        // Lotes con fecha de vencimiento (se cargan en las compras)
        Schema::create('lotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sucursal_id')->constrained('sucursales')->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->foreignId('compra_item_id')->nullable()->constrained('compra_items')->nullOnDelete();
            $table->string('lote', 50)->nullable();
            $table->date('vence_el');
            $table->decimal('cantidad', 14, 3);
            $table->timestamps();

            $table->index(['sucursal_id', 'vence_el']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lotes');
        Schema::dropIfExists('precio_historial');
        Schema::dropIfExists('compra_items');
        Schema::dropIfExists('compras');
        Schema::dropIfExists('proveedores');
    }
};
