<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Planes de licencia del SaaS (lo que paga cada empresa para usar Crotone).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('planes', function (Blueprint $table) {
            $table->id();
            $table->string('codigo')->unique();           // basico | minimarket | franquicia
            $table->string('nombre');
            $table->string('descripcion')->nullable();
            $table->decimal('precio_mensual_usd', 10, 2);
            $table->unsignedSmallInteger('max_sucursales')->default(1); // 0 = ilimitado
            $table->unsignedSmallInteger('max_usuarios')->default(3);   // 0 = ilimitado
            $table->unsignedInteger('max_productos')->default(0);       // 0 = ilimitado
            $table->json('features')->nullable();
            $table->unsignedSmallInteger('dias_trial')->default(14);
            $table->unsignedSmallInteger('dias_gracia')->default(5);
            $table->unsignedSmallInteger('orden')->default(0);
            $table->boolean('visible')->default(true);
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('planes');
    }
};
