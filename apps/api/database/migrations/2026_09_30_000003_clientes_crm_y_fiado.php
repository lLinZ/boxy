<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Fase 2: CRM (ficha del cliente), fiado con abonos y puntos de fidelización.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clientes', function (Blueprint $table) {
            $table->date('fecha_nacimiento')->nullable()->after('email');
            $table->text('notas')->nullable()->after('fecha_nacimiento');
            $table->boolean('credito_habilitado')->default(false)->after('notas');
            $table->decimal('limite_credito_usd', 14, 2)->default(0)->after('credito_habilitado');
            $table->decimal('saldo_usd', 14, 2)->default(0)->after('limite_credito_usd'); // deuda actual (fiado)
            $table->integer('puntos')->default(0)->after('saldo_usd');
        });

        // Estado de cuenta del fiado: cargos (ventas a crédito) y abonos.
        Schema::create('cuenta_movimientos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->foreignId('cliente_id')->constrained('clientes')->cascadeOnDelete();
            $table->string('tipo', 20); // cargo | abono | reverso | ajuste
            $table->foreignId('venta_id')->nullable()->constrained('ventas')->nullOnDelete();
            $table->foreignId('devolucion_id')->nullable()->constrained('devoluciones')->nullOnDelete();
            $table->foreignId('turno_id')->nullable()->constrained('turnos_caja')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('metodo', 30)->nullable(); // cómo se pagó el abono
            $table->string('moneda', 3)->nullable();
            $table->decimal('monto', 16, 2)->default(0);      // en la moneda del abono
            $table->decimal('monto_usd', 14, 2);               // + aumenta la deuda, - la reduce
            $table->decimal('igtf_usd', 14, 2)->default(0);
            $table->decimal('tasa', 18, 6)->default(0);
            $table->decimal('saldo_usd', 14, 2);               // saldo después del movimiento
            $table->string('referencia')->nullable();
            $table->string('nota')->nullable();
            $table->timestamps();

            $table->index(['cliente_id', 'id']);
        });

        Schema::create('puntos_movimientos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->foreignId('cliente_id')->constrained('clientes')->cascadeOnDelete();
            $table->foreignId('venta_id')->nullable()->constrained('ventas')->nullOnDelete();
            $table->string('tipo', 20); // gana | canje | reverso | ajuste
            $table->integer('puntos');   // + suma, - resta
            $table->integer('saldo');
            $table->string('nota')->nullable();
            $table->timestamps();

            $table->index(['cliente_id', 'id']);
        });

        Schema::table('ventas', function (Blueprint $table) {
            $table->integer('puntos_ganados')->default(0)->after('devuelto_usd');
        });
    }

    public function down(): void
    {
        Schema::table('ventas', function (Blueprint $table) {
            $table->dropColumn('puntos_ganados');
        });
        Schema::dropIfExists('puntos_movimientos');
        Schema::dropIfExists('cuenta_movimientos');
        Schema::table('clientes', function (Blueprint $table) {
            $table->dropColumn(['fecha_nacimiento', 'notas', 'credito_habilitado', 'limite_credito_usd', 'saldo_usd', 'puntos']);
        });
    }
};
