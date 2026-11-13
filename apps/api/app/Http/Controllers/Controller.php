<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

abstract class Controller
{
    /** Tamaño de página acotado: evita que ?per_page=1000000 cargue todo en memoria. */
    protected function porPagina(Request $request, int $defecto = 30, int $maximo = 100): int
    {
        return max(1, min($request->integer('per_page', $defecto), $maximo));
    }
}
