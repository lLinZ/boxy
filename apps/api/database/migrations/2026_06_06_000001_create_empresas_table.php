<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Empresa = franquiciante o franquiciado. Es el "tenant" raíz del sistema.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('empresas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('razon_social');
            $table->string('tipo_rif', 1)->default('J'); // V, E, J, G, P
            $table->string('rif', 20)->unique();
            $table->string('direccion_fiscal')->nullable();
            $table->string('telefono', 30)->nullable();
            $table->string('email')->nullable();
            $table->string('logo_path')->nullable();
            $table->boolean('es_franquicia')->default(false); // true = sucursal franquiciada
            $table->foreignId('matriz_id')->nullable()->constrained('empresas')->nullOnDelete();
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('empresas');
    }
};
