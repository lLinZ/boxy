<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sucursal;
use App\Support\Auditoria;
use App\Support\LimitesPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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

    /** Nueva sucursal de la empresa, dentro del límite del plan. */
    public function store(Request $request): JsonResponse
    {
        $empresaId = $request->user()->empresa_id;
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:30'],
        ]);

        $sucursal = DB::transaction(function () use ($empresaId, $datos) {
            // Bloquea la empresa para que dos altas a la vez no se salten el límite.
            DB::table('empresas')->where('id', $empresaId)->lockForUpdate()->first();
            LimitesPlan::exigirCupo($empresaId, 'sucursales');

            return Sucursal::create([
                ...$datos,
                'empresa_id' => $empresaId,
                'codigo' => $this->codigoLibre($empresaId, $datos['nombre']),
                'activo' => true,
            ]);
        });

        Auditoria::registrar('sucursal.creada', ['objetivo_id' => $sucursal->id, 'nombre' => $sucursal->nombre]);

        return response()->json($sucursal, 201);
    }

    /** Límites, uso y funciones del plan de la empresa (null en modo dedicado). */
    public function plan(Request $request): JsonResponse
    {
        return response()->json(LimitesPlan::resumen($request->user()->empresa_id));
    }

    /** Código corto único por empresa, ej. "CENTRO-02". */
    private function codigoLibre(int $empresaId, string $nombre): string
    {
        $base = Str::upper(Str::limit(Str::slug($nombre, ''), 12, '')) ?: 'SUC';
        $n = Sucursal::where('empresa_id', $empresaId)->count() + 1;
        do {
            $codigo = sprintf('%s-%02d', $base, $n++);
        } while (Sucursal::where('empresa_id', $empresaId)->where('codigo', $codigo)->exists());

        return $codigo;
    }
}
