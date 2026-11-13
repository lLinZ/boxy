<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categorias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->string('nombre');
            $table->string('slug');
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->unique(['empresa_id', 'slug']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categorias');
    }
};
