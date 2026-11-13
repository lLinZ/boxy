<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Fase 1: turnos de caja, vuelto, anulaciones y devoluciones.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('turnos_caja', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->foreignId('sucursal_id')->constrained('sucursales')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->string('estado', 10)->default('abierto'); // abierto | cerrado
            $table->timestamp('abierto_el')->nullable();
            $table->timestamp('cerrado_el')->nullable();
            $table->foreignId('cerrado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('tasa_apertura', 18, 6)->default(0);
            // Fondo de caja (sencillo) con el que se abre
            $table->decimal('fondo_bs', 16, 2)->default(0);
            $table->decimal('fondo_usd', 14, 2)->default(0);
            // Arqueo al cierre
            $table->decimal('esperado_bs', 16, 2)->nullable();
            $table->decimal('esperado_usd', 14, 2)->nullable();
            $table->decimal('contado_bs', 16, 2)->nullable();
            $table->decimal('contado_usd', 14, 2)->nullable();
            $table->decimal('diferencia_bs', 16, 2)->nullable();
            $table->decimal('diferencia_usd', 14, 2)->nullable();
            $table->json('resumen')->nullable(); // foto del resumen al cerrar
            $table->string('observacion', 500)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'estado']);
            $table->index(['sucursal_id', 'abierto_el']);
        });

        Schema::table('ventas', function (Blueprint $table) {
            $table->foreignId('turno_id')->nullable()->after('user_id')->constrained('turnos_caja')->nullOnDelete();
            $table->uuid('uuid')->nullable()->unique()->after('id'); // idempotencia (ventas sin conexión)
            $table->string('origen', 20)->default('pos')->after('estado'); // pos | offline
            // Vuelto entregado al cliente
            $table->decimal('vuelto_usd', 14, 2)->default(0)->after('total_bs');
            $table->string('vuelto_metodo', 30)->nullable()->after('vuelto_usd');
            $table->string('vuelto_moneda', 3)->nullable()->after('vuelto_metodo');
            $table->decimal('vuelto_monto', 16, 2)->default(0)->after('vuelto_moneda');
            // Anulación
            $table->timestamp('anulada_el')->nullable();
            $table->foreignId('anulada_por')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('autorizada_por')->nullable()->constrained('users')->nullOnDelete();
            $table->string('motivo_anulacion')->nullable();
            // Devoluciones acumuladas (parciales o totales)
            $table->decimal('devuelto_usd', 14, 2)->default(0);
            $table->index(['turno_id', 'estado']);
        });

        Schema::table('pagos', function (Blueprint $table) {
            // String en vez de enum: fiado (credito), puntos, biopago… sin migrar de nuevo.
            $table->string('metodo', 30)->change();
            $table->decimal('aplicado_usd', 14, 2)->default(0)->after('monto_usd'); // parte que cancela la venta
        });

        Schema::table('inventario_movimientos', function (Blueprint $table) {
            $table->string('tipo', 20)->change(); // + anulacion, compra, merma
        });

        Schema::create('devoluciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->foreignId('sucursal_id')->constrained('sucursales')->cascadeOnDelete();
            $table->foreignId('venta_id')->constrained('ventas')->cascadeOnDelete();
            $table->foreignId('turno_id')->nullable()->constrained('turnos_caja')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('autorizada_por')->nullable()->constrained('users')->nullOnDelete();
            $table->string('numero', 30);
            $table->string('motivo');
            $table->decimal('tasa', 18, 6)->default(0);
            $table->decimal('total_usd', 14, 2)->default(0);
            // Cómo se le devolvió el dinero al cliente
            $table->string('reintegro_metodo', 30); // efectivo_bs | efectivo_usd | pago_movil | cuenta_cliente
            $table->string('reintegro_moneda', 3);
            $table->decimal('reintegro_monto', 16, 2)->default(0);
            $table->timestamps();

            $table->unique(['sucursal_id', 'numero']);
        });

        Schema::create('devolucion_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('devolucion_id')->constrained('devoluciones')->cascadeOnDelete();
            $table->foreignId('venta_item_id')->constrained('venta_items')->cascadeOnDelete();
            $table->foreignId('producto_id')->nullable()->constrained('productos')->nullOnDelete();
            $table->string('descripcion');
            $table->decimal('cantidad', 14, 3);
            $table->decimal('total_usd', 14, 2);
            $table->boolean('reintegra_stock')->default(true); // false = producto dañado (merma)
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devolucion_items');
        Schema::dropIfExists('devoluciones');
        Schema::table('ventas', function (Blueprint $table) {
            $table->dropForeign(['turno_id']);
            $table->dropForeign(['anulada_por']);
            $table->dropForeign(['autorizada_por']);
            $table->dropIndex(['turno_id', 'estado']);
            $table->dropUnique(['uuid']);
            $table->dropColumn(['turno_id', 'anulada_por', 'autorizada_por', 'uuid', 'origen', 'vuelto_usd',
                'vuelto_metodo', 'vuelto_moneda', 'vuelto_monto', 'anulada_el', 'motivo_anulacion', 'devuelto_usd']);
        });
        Schema::table('pagos', function (Blueprint $table) {
            $table->dropColumn('aplicado_usd');
        });
        Schema::dropIfExists('turnos_caja');
    }
};
