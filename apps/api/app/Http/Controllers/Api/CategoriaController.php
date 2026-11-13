<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Categoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoriaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $categorias = Categoria::where('empresa_id', $request->user()->empresa_id)
            ->withCount('productos')
            ->orderBy('nombre')
            ->get();

        return response()->json($categorias);
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'activo' => ['boolean'],
        ]);

        $categoria = Categoria::create([
            'empresa_id' => $request->user()->empresa_id,
            'nombre' => $datos['nombre'],
            'slug' => Str::slug($datos['nombre']),
            'activo' => $datos['activo'] ?? true,
        ]);

        return response()->json($categoria, 201);
    }

    public function update(Request $request, Categoria $categoria): JsonResponse
    {
        $this->autorizar($request, $categoria);

        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'activo' => ['boolean'],
        ]);

        $categoria->update([
            'nombre' => $datos['nombre'],
            'slug' => Str::slug($datos['nombre']),
            'activo' => $datos['activo'] ?? $categoria->activo,
        ]);

        return response()->json($categoria);
    }

    public function destroy(Request $request, Categoria $categoria): JsonResponse
    {
        $this->autorizar($request, $categoria);
        $categoria->delete();

        return response()->json(['message' => 'Categoría eliminada.']);
    }

    private function autorizar(Request $request, Categoria $categoria): void
    {
        abort_unless($categoria->empresa_id === $request->user()->empresa_id, 403);
    }
}
