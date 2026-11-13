<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clientes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->string('tipo_documento', 1)->default('V'); // V, E, J, G, P
            $table->string('documento', 20); // cédula / RIF
            $table->string('nombre'); // nombre o razón social
            $table->string('direccion')->nullable();
            $table->string('telefono', 30)->nullable();
            $table->string('email')->nullable();
            $table->timestamps();

            $table->unique(['empresa_id', 'tipo_documento', 'documento']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clientes');
    }
};
