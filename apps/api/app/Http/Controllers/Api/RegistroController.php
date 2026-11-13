<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Empresa;
use App\Models\Plan;
use App\Models\Sucursal;
use App\Models\Suscripcion;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Onboarding self-service: crea empresa + sucursal + usuario admin e inicia
 * el trial. Es público (fuera de auth). Devuelve token para entrar de una.
 */
class RegistroController extends Controller
{
    /** Planes visibles para la landing / pricing (público). */
    public function planes(): JsonResponse
    {
        $planes = Plan::where('activo', true)->where('visible', true)
            ->orderBy('orden')->get();

        return response()->json($planes);
    }

    /** Configuración pública que la web necesita antes de iniciar sesión. */
    public function configuracion(): JsonResponse
    {
        return response()->json([
            'modo' => config('boxy.modo'),
            'registro_publico' => (bool) config('boxy.registro_publico'),
            'ventas' => (object) config('boxy.ventas', []),
        ]);
    }

    public function registrar(Request $request): JsonResponse
    {
        // En una instalación dedicada (una sola tienda) no se registran empresas nuevas
        abort_unless(config('boxy.registro_publico'), 404);

        $datos = $request->validate([
            'empresa_nombre' => ['required', 'string', 'max:255'],
            'rif' => ['nullable', 'string', 'max:20'],
            'admin_nombre' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', \Illuminate\Validation\Rules\Password::defaults()],
            'sucursal_nombre' => ['nullable', 'string', 'max:255'],
            'plan_codigo' => ['nullable', 'string', 'exists:planes,codigo'],
        ]);

        $plan = Plan::where('codigo', $datos['plan_codigo'] ?? 'minimarket')->first()
            ?? Plan::where('activo', true)->orderBy('orden')->first();

        $resultado = DB::transaction(function () use ($datos, $plan) {
            $empresa = Empresa::create([
                'nombre' => $datos['empresa_nombre'],
                'razon_social' => $datos['empresa_nombre'],
                'tipo_rif' => 'J',
                'rif' => $datos['rif'] ?? ('TEMP-'.uniqid()),
            ]);

            $sucursal = Sucursal::create([
                'empresa_id' => $empresa->id,
                'codigo' => 'PRINCIPAL',
                'nombre' => $datos['sucursal_nombre'] ?? 'Sucursal principal',
                'serie_control' => '00',
            ]);

            $user = User::create([
                'name' => $datos['admin_nombre'],
                'email' => $datos['email'],
                'password' => Hash::make($datos['password']),
                'empresa_id' => $empresa->id,
                'sucursal_id' => $sucursal->id,
                'rol' => 'admin',
            ]);

            $diasTrial = $plan?->dias_trial ?? 14;
            Suscripcion::create([
                'empresa_id' => $empresa->id,
                'plan_id' => $plan?->id,
                'estado' => 'trialing',
                'precio_usd' => $plan?->precio_mensual_usd,
                'max_sucursales' => $plan?->max_sucursales,
                'max_usuarios' => $plan?->max_usuarios,
                'max_productos' => $plan?->max_productos,
                'features' => $plan?->features,
                'trial_termina_el' => Carbon::now()->addDays($diasTrial),
            ]);

            return $user;
        });

        $token = $resultado->createToken('web', ['*'], now()->addMinutes(config('boxy.sesion_minutos')))->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $resultado->load(['empresa', 'sucursal']),
        ], 201);
    }
}
