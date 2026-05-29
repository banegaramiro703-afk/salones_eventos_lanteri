const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        // State
        const currentDate = ref(new Date());
        const isModalOpen = ref(false);
        const isEventModalOpen = ref(false);
        const activeEvent = ref(null);
        const currentView = ref('month'); // 'month', 'week', 'day', 'list', 'clients', 'summary'
        const isSidebarOpen = ref(false);
        
        const paymentForm = ref({
            amount: '',
            method: 'efectivo',
            date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
        });
        
        const form = ref({
            hall_id: '',
            date: '',
            startTime: '',
            endTime: '',
            client: '',
            type: '',
            depositAmount: '',
            totalAmount: '',
            paymentMethod: 'efectivo',
            notes: ''
        });

        const availableHalls = ref([]);
        const eventsList = ref([]);
        const allEventsList = ref([]);

        // Computed
        const currentMonthName = computed(() => {
            return currentDate.value.toLocaleString('es-ES', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
        });

        const currentYear = computed(() => {
            return currentDate.value.getFullYear();
        });

        const uniqueClients = computed(() => {
            const clientsMap = new Map();
            allEventsList.value.forEach(e => {
                if (!clientsMap.has(e.client_name)) {
                    clientsMap.set(e.client_name, {
                        name: e.client_name,
                        contact: e.client_contact,
                        eventsCount: 1,
                        lastEventDate: e.event_date
                    });
                } else {
                    const client = clientsMap.get(e.client_name);
                    client.eventsCount++;
                    if (e.event_date > client.lastEventDate) {
                        client.lastEventDate = e.event_date;
                    }
                }
            });
            // Convert to array and sort alphabetically
            return Array.from(clientsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        });

        const calendarDays = computed(() => {
            const year = currentDate.value.getFullYear();
            const month = currentDate.value.getMonth();
            
            const firstDayOfMonth = new Date(year, month, 1);
            const lastDayOfMonth = new Date(year, month + 1, 0);
            
            // Adjust to Monday as first day of week
            let startingDayOfWeek = firstDayOfMonth.getDay() || 7; 
            startingDayOfWeek--; 
            
            const daysInMonth = lastDayOfMonth.getDate();
            const days = [];

            // Previous month trailing days
            const prevMonthLastDay = new Date(year, month, 0).getDate();
            for (let i = startingDayOfWeek - 1; i >= 0; i--) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(prevMonthLastDay - i).padStart(2, '0')}`;
                days.push({
                    number: prevMonthLastDay - i,
                    isCurrentMonth: false,
                    date: dateStr,
                    events: []
                });
            }

            // Current month days
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                // Filter events for this day
                const dayEvents = eventsList.value.filter(e => e.event_date === dateStr).sort((a, b) => a.start_time.localeCompare(b.start_time));
                
                days.push({
                    number: i,
                    isCurrentMonth: true,
                    date: dateStr,
                    events: dayEvents.map(e => {
                        const totalPaid = e.payments ? e.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
                        return {
                            id: e.id,
                            title: e.client_name + ' - ' + e.event_type,
                            time: e.start_time.substring(0, 5),
                            hall: e.hall.name.toLowerCase().includes('grande') ? 'grande' : 'chico',
                            deposit_amount: totalPaid,
                            raw: e
                        };
                    })
                });
            }

            // Next month leading days (to fill 42 cells grid if needed, typically 35 or 42)
            const totalCells = days.length > 35 ? 42 : 35;
            let nextMonthDay = 1;
            while (days.length < totalCells) {
                const dateStr = `${year}-${String(month + 2).padStart(2, '0')}-${String(nextMonthDay).padStart(2, '0')}`;
                days.push({
                    number: nextMonthDay,
                    isCurrentMonth: false,
                    date: dateStr,
                    events: []
                });
                nextMonthDay++;
            }

            return days;
        });

        const weekDays = computed(() => {
            const year = currentDate.value.getFullYear();
            const month = currentDate.value.getMonth();
            const date = currentDate.value.getDate();
            
            const currentDayOfWeek = currentDate.value.getDay() || 7; // 1-7 (Mon-Sun)
            const startOfWeek = new Date(year, month, date - currentDayOfWeek + 1);
            
            const days = [];
            for (let i = 0; i < 7; i++) {
                const dayDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
                const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
                
                const dayEvents = eventsList.value.filter(e => e.event_date === dateStr).sort((a, b) => a.start_time.localeCompare(b.start_time));
                
                days.push({
                    name: dayDate.toLocaleString('es-ES', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase()),
                    number: dayDate.getDate(),
                    date: dateStr,
                    isToday: dateStr === new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
                    events: dayEvents.map(e => {
                        const totalPaid = e.payments ? e.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
                        return {
                            id: e.id,
                            title: e.client_name + ' - ' + e.event_type,
                            time: e.start_time.substring(0, 5) + ' - ' + e.end_time.substring(0, 5),
                            hall: e.hall.name.toLowerCase().includes('grande') ? 'grande' : 'chico',
                            deposit_amount: totalPaid,
                            raw: e
                        };
                    })
                });
            }
            return days;
        });

        const currentDay = computed(() => {
            const year = currentDate.value.getFullYear();
            const month = currentDate.value.getMonth();
            const date = currentDate.value.getDate();
            const dayDate = new Date(year, month, date);
            const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
            
            const dayEvents = eventsList.value.filter(e => e.event_date === dateStr).sort((a, b) => a.start_time.localeCompare(b.start_time));
            
            return {
                name: dayDate.toLocaleString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' }).replace(/^\w/, c => c.toUpperCase()),
                date: dateStr,
                events: dayEvents.map(e => {
                    const totalPaid = e.payments ? e.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
                    return {
                        id: e.id,
                        title: e.client_name + ' - ' + e.event_type,
                        time: e.start_time.substring(0, 5) + ' - ' + e.end_time.substring(0, 5),
                        hall: e.hall.name.toLowerCase().includes('grande') ? 'grande' : 'chico',
                        status: e.status,
                        notes: e.notes,
                        deposit_amount: totalPaid,
                        raw: e
                    };
                })
            };
        });

        const summaryData = computed(() => {
            const currentMonthEvents = allEventsList.value.filter(e => {
                const eDate = new Date(e.event_date);
                return eDate.getMonth() === currentDate.value.getMonth() && eDate.getFullYear() === currentDate.value.getFullYear();
            });

            let totalIncome = 0;
            let cashIncome = 0;
            let transferIncome = 0;
            let eventsPerHall = {};

            currentMonthEvents.forEach(e => {
                if (e.payments) {
                    e.payments.forEach(p => {
                        const amount = parseFloat(p.amount) || 0;
                        totalIncome += amount;
                        if (p.payment_method === 'efectivo') {
                            cashIncome += amount;
                        } else if (p.payment_method === 'transferencia') {
                            transferIncome += amount;
                        } else {
                            cashIncome += amount / 2;
                            transferIncome += amount / 2;
                        }
                    });
                }

                const hallName = e.hall.name;
                eventsPerHall[hallName] = (eventsPerHall[hallName] || 0) + 1;
            });

            return {
                totalEvents: currentMonthEvents.length,
                totalIncome,
                cashIncome,
                transferIncome,
                eventsPerHall
            };
        });

        let chartHall = null;
        let chartPayment = null;

        const renderCharts = () => {
            setTimeout(() => {
                if (currentView.value !== 'summary') return;

                const hallCtx = document.getElementById('chartHall');
                const paymentCtx = document.getElementById('chartPayment');

                if (!hallCtx || !paymentCtx || typeof Chart === 'undefined') return;

                if (chartHall) chartHall.destroy();
                if (chartPayment) chartPayment.destroy();

                chartHall = new Chart(hallCtx, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(summaryData.value.eventsPerHall),
                        datasets: [{
                            data: Object.values(summaryData.value.eventsPerHall),
                            backgroundColor: ['#192b45', '#f39c12', '#e2e8f0'],
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        cutout: '80%', 
                        plugins: { legend: { position: 'bottom' } } 
                    }
                });

                chartPayment = new Chart(paymentCtx, {
                    type: 'bar',
                    data: {
                        labels: ['Efectivo', 'Transferencia'],
                        datasets: [{
                            label: 'Ingresos ($)',
                            data: [summaryData.value.cashIncome, summaryData.value.transferIncome],
                            backgroundColor: ['#192b45', '#f39c12'],
                            barThickness: 35,
                            borderRadius: 6,
                            borderWidth: 0
                        }]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        scales: { 
                            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)' }, border: { display: false } },
                            x: { grid: { display: false }, border: { display: false } }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            }, 100);
        };

        Vue.watch(summaryData, () => {
            if (currentView.value === 'summary') {
                renderCharts();
            }
        });

        // Methods
        const nextPeriod = () => {
            if (currentView.value === 'month' || currentView.value === 'summary') {
                currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1);
            } else if (currentView.value === 'week') {
                currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), currentDate.value.getDate() + 7);
            } else if (currentView.value === 'day') {
                currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), currentDate.value.getDate() + 1);
            }
            fetchReservations();
            if (currentView.value === 'summary') {
                fetchAllReservations();
                renderCharts();
            }
        };

        const prevPeriod = () => {
            if (currentView.value === 'month' || currentView.value === 'summary') {
                currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1);
            } else if (currentView.value === 'week') {
                currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), currentDate.value.getDate() - 7);
            } else if (currentView.value === 'day') {
                currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), currentDate.value.getDate() - 1);
            }
            fetchReservations();
            if (currentView.value === 'summary') {
                fetchAllReservations();
                renderCharts();
            }
        };

        const changeView = (view) => {
            currentView.value = view;
            if (view === 'list' || view === 'clients' || view === 'summary') {
                fetchAllReservations();
            }
            if (view === 'summary') {
                renderCharts();
            }
        };

        const openModal = () => {
            // Reset form
            form.value = { hall_id: '', date: '', startTime: '', endTime: '', client: '', type: '', depositAmount: '', totalAmount: '', paymentMethod: 'efectivo', notes: '' };
            isModalOpen.value = true;
        };

        const closeModal = () => {
            isModalOpen.value = false;
        };

        const fetchHalls = async () => {
            try {
                const response = await fetch('/api/halls');
                if(response.ok) {
                    availableHalls.value = await response.json();
                }
            } catch (e) {
                console.error("Error fetching halls:", e);
            }
        };

        const fetchReservations = async () => {
            try {
                // Fetch a 3-month window to cover trailing/leading days and weeks crossing months
                const centerDate = currentDate.value;
                const prevMonth = new Date(centerDate.getFullYear(), centerDate.getMonth() - 1, 1);
                const nextMonth = new Date(centerDate.getFullYear(), centerDate.getMonth() + 2, 0);
                
                const start = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
                const end = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(nextMonth.getDate()).padStart(2, '0')}`;

                const response = await fetch(`/api/reservations?start=${start}&end=${end}`);
                if(response.ok) {
                    eventsList.value = await response.json();
                }
            } catch (e) {
                console.error("Error fetching reservations:", e);
            }
        };

        const fetchAllReservations = async () => {
            try {
                const response = await fetch('/api/reservations');
                if(response.ok) {
                    allEventsList.value = await response.json();
                }
            } catch (e) {
                console.error("Error fetching all reservations:", e);
            }
        };

        const saveReservation = async () => {
            try {
                const payload = {
                    hall_id: form.value.hall_id,
                    client_name: form.value.client,
                    client_contact: form.value.client, // Simplified for now
                    event_type: form.value.type,
                    event_date: form.value.date,
                    start_time: form.value.startTime,
                    end_time: form.value.endTime,
                    deposit_amount: form.value.depositAmount || 0,
                    total_amount: form.value.totalAmount || 0,
                    payment_method: form.value.paymentMethod,
                    status: 'confirmed',
                    notes: form.value.notes
                };

                const response = await fetch('/api/reservations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if(response.ok) {
                    alert('Reserva guardada con éxito.');
                    closeModal();
                    fetchReservations(); // Refresh calendar
                } else {
                    if (data.errors && data.errors.schedule_conflict) {
                        alert(data.errors.schedule_conflict[0]);
                    } else if (data.message) {
                        alert("Error: " + data.message);
                    } else {
                        alert('Ocurrió un error al guardar la reserva.');
                    }
                }
            } catch (e) {
                console.error("Error saving:", e);
                alert('Ocurrió un error en la conexión.');
            }
        };

        const viewEvent = (eventRaw) => {
            activeEvent.value = eventRaw;
            paymentForm.value = { amount: '', method: 'efectivo', date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0] };
            isEventModalOpen.value = true;
        };

        const closeEventModal = () => {
            isEventModalOpen.value = false;
            activeEvent.value = null;
        };

        const activeEventTotalPaid = computed(() => {
            if (!activeEvent.value || !activeEvent.value.payments) return 0;
            return activeEvent.value.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        });

        const activeEventBalance = computed(() => {
            if (!activeEvent.value) return 0;
            const total = parseFloat(activeEvent.value.total_amount) || 0;
            return Math.max(0, total - activeEventTotalPaid.value);
        });

        const submitNewPayment = async () => {
            if (!activeEvent.value || !paymentForm.value.amount) return;
            
            try {
                const payload = {
                    amount: paymentForm.value.amount,
                    payment_method: paymentForm.value.method,
                    payment_date: paymentForm.value.date
                };

                const response = await fetch(`/api/reservations/${activeEvent.value.id}/payments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const newPayment = await response.json();
                    activeEvent.value.payments.push(newPayment.data);
                    paymentForm.value.amount = '';
                    // Also refresh the background data
                    fetchReservations();
                    fetchAllReservations();
                    alert('Pago agregado exitosamente.');
                } else {
                    const data = await response.json();
                    alert(data.message || 'Error al agregar pago');
                }
            } catch (e) {
                console.error(e);
                alert('Ocurrió un error en la conexión.');
            }
        };

        const calculateEventDeposit = (eventRaw) => {
            return eventRaw.payments ? eventRaw.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
        };

        onMounted(() => {
            fetchHalls();
            fetchReservations();
        });

        return {
            currentDate,
            currentMonthName,
            currentYear,
            uniqueClients,
            weekDays,
            currentDay,
            calendarDays,
            isModalOpen,
            isEventModalOpen,
            activeEvent,
            paymentForm,
            activeEventTotalPaid,
            activeEventBalance,
            currentView,
            form,
            availableHalls,
            eventsList,
            allEventsList,
            summaryData,
            isSidebarOpen,
            nextPeriod,
            prevPeriod,
            changeView,
            openModal,
            closeModal,
            closeEventModal,
            submitNewPayment,
            calculateEventDeposit,
            saveReservation,
            viewEvent
        };
    }
}).mount('#app');
