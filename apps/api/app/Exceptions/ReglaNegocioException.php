<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Una regla del negocio impide la operación (caja cerrada, pago incompleto,
 * PIN inválido…). Se responde 422 con el mensaje para mostrarlo tal cual.
 */
class ReglaNegocioException extends RuntimeException
{
    public function __construct(string $message, private readonly int $estado = 422, private readonly array $extra = [])
    {
        parent::__construct($message);
    }

    public function render()
    {
        return response()->json(['message' => $this->getMessage(), ...$this->extra], $this->estado);
    }
}
