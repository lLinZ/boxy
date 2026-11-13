<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ReglaNegocioException;
use App\Http\Controllers\Controller;
use App\Models\Suscripcion;
use App\Models\User;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

// Gestión de usuarios de la empresa (permiso usuarios.gestionar, en la ruta).
class UserController extends Controller
{
    private const ROLES = ['admin', 'gerente', 'cajero', 'inventario'];

    public function index(Request $request): JsonResponse
    {
        $usuarios = User::where('empresa_id', $request->user()->empresa_id)
            ->with('sucursal:id,nombre,codigo')
            ->orderBy('name')
            ->get();

        return response()->json($usuarios);
    }

    public function store(Request $request): JsonResponse
    {
        $empresaId = $request->user()->empresa_id;
        $datos = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', Password::defaults()],
            'rol' => ['required', Rule::in(self::ROLES)],
            'sucursal_id' => ['required', Rule::exists('sucursales', 'id')->where('empresa_id', $empresaId)],
            'pin' => ['nullable', 'digits_between:4,6'],
        ]);

        $this->verificarLimitePlan($empresaId);

        $usuario = User::create([
            'name' => $datos['name'],
            'email' => $datos['email'],
            'password' => $datos['password'],
            'rol' => $datos['rol'],
            'sucursal_id' => $datos['sucursal_id'],
            'pin_supervisor' => $datos['pin'] ?? null,
            'empresa_id' => $empresaId,
            // La clave la puso el admin: el usuario la cambia en su primer ingreso
            'debe_cambiar_clave' => true,
        ]);

        Auditoria::registrar('usuario.creado', ['objetivo_id' => $usuario->id, 'email' => $usuario->email, 'rol' => $usuario->rol]);

        return response()->json($usuario->load('sucursal:id,nombre,codigo'), 201);
    }

    public function update(Request $request, User $usuario): JsonResponse
    {
        $yo = $request->user();
        abort_unless($usuario->empresa_id === $yo->empresa_id, 404);

        $datos = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($usuario->id)],
            'password' => ['nullable', 'string', Password::defaults()],
            'rol' => ['required', Rule::in(self::ROLES)],
            'sucursal_id' => ['required', Rule::exists('sucursales', 'id')->where('empresa_id', $yo->empresa_id)],
            'activo' => ['boolean'],
            'pin' => ['nullable', 'digits_between:4,6'],
            'quitar_pin' => ['nullable', 'boolean'],
        ]);

        if ($usuario->id === $yo->id && ($datos['rol'] !== 'admin' || ($datos['activo'] ?? true) === false)) {
            throw new ReglaNegocioException('No puedes quitarte el rol de administrador ni desactivarte a ti mismo.');
        }

        $cambios = collect($datos)->only(['name', 'email', 'rol', 'sucursal_id', 'activo'])->all();
        $cierraSesiones = false;

        if (! empty($datos['password'])) {
            $cambios['password'] = $datos['password'];
            $cambios['debe_cambiar_clave'] = $usuario->id !== $yo->id;
            $cierraSesiones = true;
        }
        if (! empty($datos['pin'])) {
            $cambios['pin_supervisor'] = $datos['pin'];
        } elseif ($request->boolean('quitar_pin')) {
            $cambios['pin_supervisor'] = null;
        }
        if (array_key_exists('activo', $datos) && ! $datos['activo']) {
            $cierraSesiones = true;
        }
        if ($datos['rol'] !== $usuario->rol) {
            $cierraSesiones = true; // los permisos cambian: que vuelva a entrar
        }

        $antes = $usuario->only(['email', 'rol', 'activo']);
        $usuario->update($cambios);

        // Solo lo sensible: rol, activación, correo, clave o PIN puestos por otro
        $sensibles = array_filter([
            'rol' => $antes['rol'] !== $usuario->rol ? "{$antes['rol']} → {$usuario->rol}" : null,
            'activo' => $antes['activo'] != $usuario->activo ? ($usuario->activo ? 'activado' : 'desactivado') : null,
            'email' => $antes['email'] !== $usuario->email ? "{$antes['email']} → {$usuario->email}" : null,
            'clave' => isset($cambios['password']) ? 'cambiada' : null,
            'pin' => array_key_exists('pin_supervisor', $cambios) ? ($cambios['pin_supervisor'] ? 'cambiado' : 'quitado') : null,
        ]);
        if ($sensibles) {
            Auditoria::registrar('usuario.modificado', ['objetivo_id' => $usuario->id, ...$sensibles]);
        }

        if ($cierraSesiones) {
            $usuario->tokens()
                ->when($usuario->id === $yo->id, fn ($q) => $q->where('id', '!=', $yo->currentAccessToken()->id))
                ->delete();
        }

        return response()->json($usuario->load('sucursal:id,nombre,codigo'));
    }

    /** Baja lógica: desactiva el usuario (no se borra, conserva auditoría). */
    public function destroy(Request $request, User $usuario): JsonResponse
    {
        abort_unless($usuario->empresa_id === $request->user()->empresa_id, 404);
        abort_if($usuario->id === $request->user()->id, 422, 'No puedes desactivarte a ti mismo.');

        $usuario->update(['activo' => false]);
        $usuario->tokens()->delete(); // cierra sus sesiones
        Auditoria::registrar('usuario.desactivado', ['objetivo_id' => $usuario->id, 'email' => $usuario->email]);

        return response()->json(['message' => 'Usuario desactivado.']);
    }

    /** En el SaaS, el plan limita cuántos usuarios activos puede tener la empresa (0 = sin límite). */
    private function verificarLimitePlan(int $empresaId): void
    {
        if (config('boxy.modo') !== 'saas') {
            return;
        }
        $maximo = (int) (Suscripcion::where('empresa_id', $empresaId)->value('max_usuarios') ?? 0);
        $activos = User::where('empresa_id', $empresaId)->where('activo', true)->count();
        if ($maximo > 0 && $activos >= $maximo) {
            throw new ReglaNegocioException("Tu plan permite {$maximo} usuarios activos. Mejora el plan para agregar más.");
        }
    }
}
