<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reservation_id')->constrained()->onDelete('cascade');
            $table->decimal('amount', 10, 2);
            $table->string('payment_method');
            $table->date('payment_date');
            $table->timestamps();
        });

        // Migrate existing data
        $reservations = \Illuminate\Support\Facades\DB::table('reservations')->where('deposit_amount', '>', 0)->get();
        foreach($reservations as $res) {
            \Illuminate\Support\Facades\DB::table('payments')->insert([
                'reservation_id' => $res->id,
                'amount' => $res->deposit_amount,
                'payment_method' => $res->payment_method ?? 'efectivo',
                'payment_date' => $res->created_at ? \Carbon\Carbon::parse($res->created_at)->toDateString() : now()->toDateString(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn(['deposit_amount', 'payment_method']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->decimal('deposit_amount', 10, 2)->default(0);
            $table->string('payment_method')->default('efectivo');
        });

        Schema::dropIfExists('payments');
    }
};
