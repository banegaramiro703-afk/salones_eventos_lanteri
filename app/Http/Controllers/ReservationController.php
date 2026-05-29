<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Reservation;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class ReservationController extends Controller
{
    /**
     * Display a listing of the reservations.
     * Useful for the calendar view (monthly, weekly, daily)
     */
    public function index(Request $request)
    {
        // Admins can fetch all reservations within a date range for the calendar, or all of them
        $query = Reservation::with(['hall', 'payments']);

        if ($request->has('start') && $request->has('end')) {
            $query->whereBetween('event_date', [$request->start, $request->end]);
        }

        $reservations = $query->orderBy('event_date', 'desc')->get();

        return response()->json($reservations);
    }

    /**
     * Store a newly created reservation in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'hall_id' => 'required|exists:halls,id',
            'client_name' => 'required|string|max:255',
            'client_contact' => 'required|string|max:255',
            'event_type' => 'required|string|max:100',
            'event_date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            // Quitamos la regla 'after:start_time' de aquí para permitir eventos que crucen la medianoche
            'end_time' => 'required|date_format:H:i',
            'total_amount' => 'required|numeric|min:0',
            'deposit_amount' => 'required|numeric|min:0', // Will be extracted
            'payment_method' => 'required|string|in:efectivo,transferencia,mixto', // Will be extracted
            'status' => 'required|in:pending,confirmed,cancelled',
            'notes' => 'nullable|string'
        ]);

        // STRICT VALIDATION: Prevent Double-Booking (Aquí es donde debes procesar el salto de día)
        $this->validateAvailability(
            $validated['hall_id'],
            $validated['event_date'],
            $validated['start_time'],
            $validated['end_time']
        );

        // Extract payment data
        $paymentAmount = $validated['deposit_amount'];
        $paymentMethod = $validated['payment_method'];
        unset($validated['deposit_amount'], $validated['payment_method']);

        $reservation = Reservation::create($validated);

        if ($paymentAmount > 0) {
            $reservation->payments()->create([
                'amount' => $paymentAmount,
                'payment_method' => $paymentMethod,
                'payment_date' => now()->toDateString()
            ]);
        }

        // Return with payments
        $reservation->load('payments', 'hall');

        return response()->json(['message' => 'Reserva creada exitosamente.', 'data' => $reservation], 201);
    }

    /**
     * Update the specified reservation in storage.
     */
    public function update(Request $request, $id)
    {
        $reservation = Reservation::findOrFail($id);

        $validated = $request->validate([
            'hall_id' => 'sometimes|exists:halls,id',
            'event_date' => 'sometimes|date',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i',
            'notes' => 'nullable|string',
            // ... otros campos
        ]);

        // If dates or times or hall change, re-validate availability
        if (isset($validated['event_date']) || isset($validated['start_time']) || isset($validated['end_time']) || isset($validated['hall_id'])) {
            $hallId = $validated['hall_id'] ?? $reservation->hall_id;
            $eventDate = $validated['event_date'] ?? $reservation->event_date;
            $startTime = $validated['start_time'] ?? $reservation->start_time;
            $endTime = $validated['end_time'] ?? $reservation->end_time;

            $this->validateAvailability($hallId, $eventDate, $startTime, $endTime, $reservation->id);
        }

        $reservation->update($request->except(['deposit_amount', 'payment_method']));

        return response()->json(['message' => 'Reserva actualizada exitosamente.', 'data' => $reservation]);
    }

    /**
     * Add a payment to an existing reservation.
     */
    public function addPayment(Request $request, $id)
    {
        $reservation = Reservation::findOrFail($id);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|in:efectivo,transferencia',
            'payment_date' => 'required|date'
        ]);

        $payment = $reservation->payments()->create($validated);

        return response()->json(['message' => 'Pago agregado exitosamente.', 'data' => $payment], 201);
    }

    /**
     * Core Logic: Check if a hall is available in the given date and time range.
     * Validates that no existing reservation overlaps with the requested times.
     */
    private function validateAvailability($hallId, $eventDate, $startTime, $endTime, $excludeReservationId = null)
    {
        // Creamos fechas completas para la solicitud actual con 1 hora de margen (limpieza)
        $requestedStart = Carbon::parse($eventDate . ' ' . $startTime)->subHour();
        $requestedEnd = Carbon::parse($eventDate . ' ' . $endTime)->addHour();

        // Si cruza la medianoche, sumamos 1 día a la fecha final
        if ($endTime < $startTime) {
            $requestedEnd->addDay();
        }

        // Buscamos reservas desde el día anterior hasta el día siguiente al fin del evento
        // para asegurarnos de cruzar eventos que pasen la medianoche
        $searchStart = Carbon::parse($eventDate)->subDay()->toDateString();
        $searchEnd = $requestedEnd->copy()->addDay()->toDateString();

        $overlapping = Reservation::where('hall_id', $hallId)
            ->whereBetween('event_date', [$searchStart, $searchEnd])
            ->whereIn('status', ['pending', 'confirmed'])
            ->when($excludeReservationId, function ($query) use ($excludeReservationId) {
                return $query->where('id', '!=', $excludeReservationId);
            })
            ->get()
            ->contains(function ($res) use ($requestedStart, $requestedEnd) {
                $resStart = Carbon::parse($res->event_date . ' ' . $res->start_time);
                $resEnd = Carbon::parse($res->event_date . ' ' . $res->end_time);

                if ($res->end_time < $res->start_time) {
                    $resEnd->addDay();
                }

                // Hay solapamiento si el inicio de uno es menor que el fin del otro en ambos sentidos
                return $requestedStart < $resEnd && $resStart < $requestedEnd;
            });

        if ($overlapping) {
            throw ValidationException::withMessages([
                'schedule_conflict' => ['El salón seleccionado está reservado o no cumple con la hora de limpieza requerida entre eventos.']
            ]);
        }
    }
}
