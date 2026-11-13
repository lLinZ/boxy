<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** Hash bcrypt de una clave aleatoria descartada: no corresponde a ninguna cuenta. */
    private const HASH_FICTICIO = '$2y$12$iz3y7FfZiavinjrwNMatvuAZ5o77jReSIqnd9.C8ltWhzAB2/BkDO';

    /** Login: devuelve un token de acceso (sirve para web y app móvil). */
    public function login(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'max:255'],
            'device_name' => ['nullable', 'string', 'max:60'],
        ]);

        $user = User::where('email', $datos['email'])->first();

        // Si el correo no existe se compara igual contra un hash ficticio: así la
        // respuesta tarda lo mismo y el tiempo no revela qué cuentas existen.
        $claveOk = Hash::check($datos['password'], $user?->password ?? self::HASH_FICTICIO);

        // Mismo mensaje para clave errada y usuario desactivado: no revela qué cuentas existen
        if (! $user || ! $claveOk || ! $user->activo) {
            Auditoria::registrar('login.fallido', [
                'email' => $datos['email'],
                'motivo' => ! $user ? 'no_existe' : (! $claveOk ? 'clave' : 'inactivo'),
            ]);
            throw ValidationException::withMessages([
                'email' => ['Credenciales inválidas.'],
            ]);
        }

        Auditoria::registrar('login.ok', ['usuario_id' => $user->id, 'empresa_id' => $user->empresa_id]);
        $user->forceFill(['ultimo_acceso_el' => now()])->save();
        $token = $user->createToken($datos['device_name'] ?? 'web', ['*'], now()->addMinutes(config('boxy.sesion_minutos')))->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user->load(['empresa', 'sucursal']),
        ]);
    }

    /** Usuario autenticado actual (con sus permisos). */
    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user()->load(['empresa', 'sucursal']));
    }

    /** Logout: revoca el token actual. */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Sesión cerrada.']);
    }

    /** Cambio de clave propio. Cierra las demás sesiones del usuario. */
    public function cambiarClave(Request $request): JsonResponse
    {
        $user = $request->user();
        $datos = $request->validate([
            'actual' => ['required', 'string'],
            'nueva' => ['required', 'string', 'confirmed', Password::defaults(), 'different:actual'],
        ]);

        if (! Hash::check($datos['actual'], $user->password)) {
            throw ValidationException::withMessages(['actual' => ['La clave actual no es correcta.']]);
        }

        $user->update(['password' => $datos['nueva'], 'debe_cambiar_clave' => false]);
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();
        Auditoria::registrar('cuenta.clave_cambiada');

        return response()->json(['message' => 'Clave actualizada.']);
    }

    /** PIN de supervisor propio (para autorizar anulaciones, descuentos, etc. en caja). */
    public function cambiarPin(Request $request): JsonResponse
    {
        $user = $request->user();
        $datos = $request->validate([
            'clave' => ['required', 'string'],
            'pin' => ['nullable', 'digits_between:4,6'],
        ]);

        if (! Hash::check($datos['clave'], $user->password)) {
            throw ValidationException::withMessages(['clave' => ['La clave no es correcta.']]);
        }

        $user->update(['pin_supervisor' => $datos['pin'] ?: null]);
        Auditoria::registrar($datos['pin'] ? 'cuenta.pin_cambiado' : 'cuenta.pin_eliminado');

        return response()->json(['message' => $datos['pin'] ? 'PIN actualizado.' : 'PIN eliminado.']);
    }
}
