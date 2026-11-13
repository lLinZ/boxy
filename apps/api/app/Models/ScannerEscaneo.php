<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScannerEscaneo extends Model
{
    protected $table = 'scanner_escaneos';

    protected $fillable = ['user_id', 'codigo', 'procesado'];

    protected $casts = ['procesado' => 'boolean'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
