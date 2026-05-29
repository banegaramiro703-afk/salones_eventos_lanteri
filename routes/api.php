<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

use App\Http\Controllers\ReservationController;
use App\Models\Hall;

Route::apiResource('reservations', ReservationController::class);
Route::post('reservations/{id}/payments', [ReservationController::class, 'addPayment']);

Route::get('/halls', function () {
    if (Hall::count() === 0) {
        \Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
    }
    return response()->json(Hall::all());
});
