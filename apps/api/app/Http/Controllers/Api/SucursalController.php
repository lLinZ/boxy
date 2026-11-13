<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sucursal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SucursalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $sucursales = Sucursal::where('empresa_id', $request->user()->empresa_id)
            ->where('activo', true)
            ->orderBy('nombre')
            ->get(['id', 'nombre', 'codigo']);

        return response()->json($sucursales);
    }
}
