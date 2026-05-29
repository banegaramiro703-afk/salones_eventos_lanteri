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
        // Admins can fetch all reservations within a date range for the calendar
        $start = $request->query('start');
        $end = $request->query('end');

        $reservations = Reservation::with('hall')
            ->whereBetween('event_date', [$start, $end])
            ->get();

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
            'end_time' => 'required|date_format:H:i|after:start_time',
            'deposit_amount' => 'required|numeric|min:0',
            'total_amount' => 'required|numeric|min:0',
            'status' => 'required|in:pending,confirmed,cancelled'
        ]);

        // STRICT VALIDATION: Prevent Double-Booking
        $this->validateAvailability(
            $validated['hall_id'],
            $validated['event_date'],
            $validated['start_time'],
            $validated['end_time']
        );

        $reservation = Reservation::create($validated);

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
            'end_time' => 'sometimes|date_format:H:i|after:start_time',
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

        $reservation->update($request->all());

        return response()->json(['message' => 'Reserva actualizada exitosamente.', 'data' => $reservation]);
    }

    /**
     * Core Logic: Check if a hall is available in the given date and time range.
     * Validates that no existing reservation overlaps with the requested times.
     */
    private function validateAvailability($hallId, $eventDate, $startTime, $endTime, $excludeReservationId = null)
    {
        $overlapping = Reservation::where('hall_id', $hallId)
            ->where('event_date', $eventDate)
            ->whereIn('status', ['pending', 'confirmed'])
            ->when($excludeReservationId, function($query) use ($excludeReservationId) {
                return $query->where('id', '!=', $excludeReservationId);
            })
            ->where(function($query) use ($startTime, $endTime) {
                $query->where(function($q) use ($startTime, $endTime) {
                    // Start time falls within an existing event
                    $q->where('start_time', '<', $endTime)
                      ->where('end_time', '>', $startTime);
                });
            })
            ->exists();

        if ($overlapping) {
            throw ValidationException::withMessages([
                'schedule_conflict' => ['El salón seleccionado ya se encuentra reservado en el horario especificado (superposición de horarios).']
            ]);
        }
    }
}
