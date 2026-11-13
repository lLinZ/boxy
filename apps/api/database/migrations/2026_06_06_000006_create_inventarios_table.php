<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Stock actual de un producto en una sucursal concreta.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventarios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sucursal_id')->constrained('sucursales')->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->decimal('cantidad', 14, 3)->default(0);
            $table->decimal('stock_minimo', 14, 3)->default(0);
            $table->timestamps();

            $table->unique(['sucursal_id', 'producto_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventarios');
    }
};
