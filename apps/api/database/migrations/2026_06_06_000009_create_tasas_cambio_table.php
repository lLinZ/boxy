<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tasa de cambio BCV por día. Las ventas se "congelan" a la tasa del momento.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasas_cambio', function (Blueprint $table) {
            $table->id();
            $table->date('fecha');
            $table->string('fuente', 20)->default('BCV');
            $table->decimal('tasa', 18, 6); // Bs por 1 USD
            $table->timestamps();

            $table->unique(['fecha', 'fuente']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasas_cambio');
    }
};
