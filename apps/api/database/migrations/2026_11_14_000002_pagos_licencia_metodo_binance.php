<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Los clientes también pagan la licencia por Binance Pay.
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql' && DB::getDriverName() !== 'mariadb') {
            return; // SQLite no valida enums
        }
        DB::statement("ALTER TABLE pagos_licencia MODIFY metodo ENUM('pago_movil','transferencia','usdt','binance','zelle','efectivo','otro') NOT NULL");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql' && DB::getDriverName() !== 'mariadb') {
            return;
        }
        DB::table('pagos_licencia')->where('metodo', 'binance')->update(['metodo' => 'otro']);
        DB::statement("ALTER TABLE pagos_licencia MODIFY metodo ENUM('pago_movil','transferencia','usdt','zelle','efectivo','otro') NOT NULL");
    }
};
