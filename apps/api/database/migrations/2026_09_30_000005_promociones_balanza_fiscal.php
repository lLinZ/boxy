<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Fase 4 (ampliaciones): promociones, productos pesables y cola de la impresora fiscal.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promociones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->string('nombre');
            // porcentaje: X % de descuento · nxm: lleva N paga M · precio_cantidad: precio especial desde N unidades
            $table->string('tipo', 20);
            $table->foreignId('producto_id')->nullable()->constrained('productos')->cascadeOnDelete();
            $table->foreignId('categoria_id')->nullable()->constrained('categorias')->cascadeOnDelete();
            $table->decimal('valor', 12, 4)->default(0);        // % o precio especial
            $table->unsignedSmallInteger('lleva')->nullable();   // N en NxM
            $table->unsignedSmallInteger('paga')->nullable();    // M en NxM
            $table->decimal('cantidad_minima', 14, 3)->default(1);
            $table->date('desde')->nullable();
            $table->date('hasta')->nullable();
            $table->json('dias_semana')->nullable();             // [0..6] (0 = domingo); null = todos
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->index(['empresa_id', 'activo']);
        });

        Schema::table('productos', function (Blueprint $table) {
            $table->boolean('pesable')->default(false)->after('controla_stock');   // se vende por peso (KG)
            $table->string('codigo_balanza', 10)->nullable()->after('pesable');   // PLU de la balanza etiquetadora
            $table->index(['empresa_id', 'codigo_balanza']);
        });

        Schema::table('venta_items', function (Blueprint $table) {
            $table->decimal('promocion_usd', 14, 2)->default(0)->after('descuento_usd'); // parte del descuento que vino de promociones
            $table->foreignId('promocion_id')->nullable()->after('promocion_usd')->constrained('promociones')->nullOnDelete();
        });

        Schema::table('ventas', function (Blueprint $table) {
            // Impresora fiscal (opcional): el puente local imprime y reporta el número fiscal.
            $table->string('estado_fiscal', 15)->nullable()->after('puntos_ganados'); // pendiente | impresa | error
            $table->string('numero_fiscal', 30)->nullable()->after('estado_fiscal');
            $table->string('serial_fiscal', 30)->nullable()->after('numero_fiscal');
            $table->string('error_fiscal')->nullable()->after('serial_fiscal');
            $table->index(['empresa_id', 'estado_fiscal']);
        });
    }

    public function down(): void
    {
        Schema::table('ventas', function (Blueprint $table) {
            $table->dropIndex(['empresa_id', 'estado_fiscal']);
            $table->dropColumn(['estado_fiscal', 'numero_fiscal', 'serial_fiscal', 'error_fiscal']);
        });
        Schema::table('venta_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('promocion_id');
            $table->dropColumn('promocion_usd');
        });
        Schema::table('productos', function (Blueprint $table) {
            $table->dropIndex(['empresa_id', 'codigo_balanza']);
            $table->dropColumn(['pesable', 'codigo_balanza']);
        });
        Schema::dropIfExists('promociones');
    }
};
