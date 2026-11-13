<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Las pruebas no escriben en la bitácora de seguridad real (la prueba de la bitácora la redirige)
        config(['logging.channels.seguridad' => config('logging.channels.null')]);
    }
}
