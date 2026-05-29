<?php

namespace Database\Seeders;

use App\Models\Hall;
use Illuminate\Database\Seeder;

class HallSeeder extends Seeder
{
    public function run(): void
    {
        Hall::firstOrCreate(
            ['name' => 'Salón Grande'],
            ['capacity' => 200, 'description' => 'Salón principal para eventos grandes']
        );

        Hall::firstOrCreate(
            ['name' => 'Salón Chico'],
            ['capacity' => 80, 'description' => 'Salón secundario para eventos más íntimos']
        );
    }
}
