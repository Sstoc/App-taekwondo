// ===================================
// Taekwondo CMK - Lógica Principal
// ===================================

// CONFIGURACIÓN SUPABASE
const SUPABASE_URL = 'https://ihxvrsdyxhslwahkklmh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iCPuyn5_jTXvtPl4zwwbVA_uf-F3W05';

document.addEventListener('alpine:init', () => {
    Alpine.data('tkdApp', () => ({
        view: 'dashboard',
        search: '',
        
        // Auth & Supabase
        supabase: null,
        user: null,
        authEmail: '',
        authPassword: '',
        authError: '',
        authLoading: false,
        showPassword: false,
        lastBilled: null,
        
        // Modales
        showProfileModal: false,
        showEditModal: false,
        isEditing: false,
        activeStudent: null,
        
        // Modal Examen
        showExamModal: false,
        examPaymentStudent: null,
        examPaymentAmount: 15000,

        // Modal de Cobro (nuevo)
        showPaymentModal: false,
        paymentStudent: null,
        paymentAmount: 0,

        // Modal de Configuración (nuevo)
        showSettingsModal: false,

        // Cuotas escalonadas (nuevo)
        priceTiers: { tier1: 12500, tier2: 15000, tier3: 18000 },
        editTiers: { tier1: 12500, tier2: 15000, tier3: 18000 },

        // Misc
        toastMsg: '',
        toastTimer: null,
        confirmReset: false,
        showRevenue: false,
        billingInProgress: false,

        // Tema (light / dark / system)
        themeMode: 'system',
        
        form: { id: null, name: '', dob: '', rank: 'Blanco', tuition: 12500, debt: 12500, phone: '', location: '', dni: '', cuota_fija: false, exam_paid: false, exam_paid_amount: 0, archived: false },
        archiveFilter: 'active',
        
        attendanceBuffer: [],
        isOnline: navigator.onLine,
        offlineQueue: JSON.parse(localStorage.getItem('cmk-offline-queue') || '[]'),
        
        menu: [
            { id: 'dashboard', label: 'General', icon: 'fa-solid fa-chart-pie' },
            { id: 'students', label: 'Alumnos', icon: 'fa-solid fa-users' },
            { id: 'attendance', label: 'Asistencia', icon: 'fa-solid fa-clipboard-check' },
            { id: 'history', label: 'Historial', icon: 'fa-solid fa-clock-rotate-left' },
            { id: 'exams', label: 'Examen', icon: 'fa-solid fa-graduation-cap' }
        ],

        ranks: ['Blanco', 'Amarillo', 'Amarillo Int.', 'Amarillo Avz.', 'Azul', 'Azul Int.', 'Azul Avz.', 'Rojo', 'Rojo Avz.', 'Negro'],

        students: [],
        historyData: [],
        debtDetails: {},

        async init() {
            if (SUPABASE_URL === 'TU_URL_AQUI' || !SUPABASE_URL.startsWith('http')) {
                this.authError = "ADVERTENCIA: Debes colocar tus credenciales reales de Supabase en el código para iniciar sesión.";
                return;
            }

            try {
                this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

                // Carga optimista desde cache local
                this.loadLocalCache();

                // Listeners de conexión
                window.addEventListener('online', () => {
                    this.isOnline = true;
                    if (this.offlineQueue.length > 0) {
                        this.showToast('Conexión restaurada. Sincronizando...');
                        this.syncOfflineQueue();
                    }
                });
                window.addEventListener('offline', () => {
                    this.isOnline = false;
                    this.showToast('Mala conexión. Modo Offline activado.');
                });

                // Aplicar tema guardado
                this.themeMode = localStorage.getItem('cmk-theme') || 'system';
                this.applyTheme();
                // Escuchar cambios del sistema
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                    if (this.themeMode === 'system') this.applyTheme();
                });

                const { data: { session } } = await this.supabase.auth.getSession();
                if (session?.user) {
                    this.startUserSession(session.user);
                }

                this.supabase.auth.onAuthStateChange((_event, session) => {
                    if (session?.user) {
                        if (!this.user) this.startUserSession(session.user);
                    } else {
                        this.user = null;
                        this.students = [];
                        this.historyData = [];
                    }
                });
            } catch (e) {
                this.authError = "Error al conectar con Supabase. Verifica las credenciales.";
            }
        },

        // --- AUTENTICACIÓN ---
        async signIn() {
            if (!this.supabase) return;
            this.authError = ''; this.authLoading = true;
            const { error } = await this.supabase.auth.signInWithPassword({ email: this.authEmail, password: this.authPassword });
            this.authLoading = false;
            if (error) this.authError = 'Error: verifica tus credenciales';
        },

        async signUp() {
            if (!this.supabase) return;
            this.authError = ''; this.authLoading = true;
            const { error } = await this.supabase.auth.signUp({ email: this.authEmail, password: this.authPassword });
            this.authLoading = false;
            if (error) this.authError = error.message; else await this.signIn();
        },

        async signOut() {
            if (this.supabase) await this.supabase.auth.signOut();
        },

        async startUserSession(user) {
            this.user = user;
            this.authError = '';
            await this.loadDataFromDB();
            if (this.isOnline) this.syncOfflineQueue();
            this.checkNewMonthBilling();
        },

        // --- CONEXIÓN A DB ESTRICTA (SUPABASE) ---
        async loadDataFromDB() {
            try {
                const { data: studentsData } = await this.supabase.from('tkd_students').select('*').eq('user_id', this.user.id).order('name');
                if (studentsData) {
                    this.students = studentsData.map(s => ({
                        ...s,
                        dni: s.dni || '',
                        cuota_fija: !!s.cuota_fija,
                        exam_paid: !!s.exam_paid,
                        exam_paid_amount: Number(s.exam_paid_amount || 0),
                        archived: !!s.archived
                    }));
                }

                const { data: settingsRows } = await this.supabase
                    .from('tkd_settings')
                    .select('*')
                    .eq('user_id', this.user.id);
                const settingsData = this.pickLatestSettingsRow(settingsRows || []);
                if (settingsData) {
                    this.historyData = this.normalizeHistoryData(settingsData.history_data || []);
                    this.lastBilled = settingsData.last_billed;

                    // MIGRACIÓN: Mover el recaudo global viejo al mes actual si existe
                    const oldGlobalRevenue = Number(settingsData.revenue || 0);
                    if (oldGlobalRevenue > 0) {
                        const dateObj = new Date();
                        const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                        let currentMonth = this.historyData.find(m => m && typeof m.name === 'string' && m.name.toLowerCase() === monthName.toLowerCase());
                        
                        if (!currentMonth) {
                            currentMonth = { id: this.createId(), name: monthName, open: true, revenue: oldGlobalRevenue, classes: [] };
                            this.historyData.unshift(currentMonth);
                        } else if ((currentMonth.revenue || 0) === 0) {
                            // Solo si el mes actual aún no tenía recaudo migrado
                            currentMonth.revenue = oldGlobalRevenue;
                        }
                    }

                    // Cargar cuotas escalonadas
                    if (settingsData.price_tiers && typeof settingsData.price_tiers === 'object') {
                        this.priceTiers = {
                            tier1: Number(settingsData.price_tiers.tier1) || 12500,
                            tier2: Number(settingsData.price_tiers.tier2) || 15000,
                            tier3: Number(settingsData.price_tiers.tier3) || 18000,
                            lastApplied: Number(settingsData.price_tiers.lastApplied) || 1
                        };
                    }

                    // Cargar desglose de deudas
                    if (settingsData.debt_details && typeof settingsData.debt_details === 'object') {
                        this.debtDetails = settingsData.debt_details;
                    }
                    this.updateLocalCache();
                    this.migrateExistingDebts();
                } else {
                    if (this.isOnline) await this.supabase.from('tkd_settings').insert({ user_id: this.user.id });
                }
            } catch (e) { console.error(e); }
        },

        loadLocalCache() {
            try {
                const cachedDocs = localStorage.getItem('cmk-cache-students');
                if (cachedDocs) this.students = JSON.parse(cachedDocs);
                const cachedHis = localStorage.getItem('cmk-cache-history');
                if (cachedHis) this.historyData = JSON.parse(cachedHis);
                const cachedTiers = localStorage.getItem('cmk-cache-tiers');
                if (cachedTiers) this.priceTiers = JSON.parse(cachedTiers);
                const cachedDebts = localStorage.getItem('cmk-cache-debts');
                if (cachedDebts) this.debtDetails = JSON.parse(cachedDebts);
            } catch(e) {}
        },

        updateLocalCache() {
            localStorage.setItem('cmk-cache-students', JSON.stringify(this.students));
            localStorage.setItem('cmk-cache-history', JSON.stringify(this.historyData));
            localStorage.setItem('cmk-cache-tiers', JSON.stringify(this.priceTiers));
            localStorage.setItem('cmk-cache-debts', JSON.stringify(this.debtDetails));
        },

        enqueueOfflineAction(action) {
            this.offlineQueue.push(action);
            localStorage.setItem('cmk-offline-queue', JSON.stringify(this.offlineQueue));
        },

        async syncOfflineQueue() {
            if (this.offlineQueue.length === 0 || !this.isOnline || !this.user) return;
            const queue = [...this.offlineQueue];
            this.offlineQueue = [];
            localStorage.setItem('cmk-offline-queue', JSON.stringify([]));

            let needsSettingsSync = false;
            for (let action of queue) {
                try {
                    if (action.type === 'saveSettings') needsSettingsSync = true;
                    if (action.type === 'upsertStudent') await this.supabase.from('tkd_students').upsert(action.payload);
                    if (action.type === 'updateStudent') await this.supabase.from('tkd_students').update(action.payload).eq('id', action.id);
                    if (action.type === 'deleteStudent') await this.supabase.from('tkd_students').delete().eq('id', action.id);
                } catch(e) { console.error("Sync error:", e); }
            }
            if (needsSettingsSync) await this.saveSettingsToDB(true);
            this.showToast('Sincronización completada');
        },

        pickLatestSettingsRow(rows) {
            if (!Array.isArray(rows) || rows.length === 0) return null;
            if (rows.length === 1) return rows[0];

            const rowTime = (row) => {
                const updated = Date.parse(row?.updated_at || '');
                if (!Number.isNaN(updated)) return updated;
                const created = Date.parse(row?.created_at || '');
                if (!Number.isNaN(created)) return created;
                return -1;
            };

            const withTime = rows.filter(r => rowTime(r) >= 0);
            if (withTime.length > 0) {
                return withTime.reduce((best, row) => rowTime(row) > rowTime(best) ? row : best, withTime[0]);
            }

            return rows.reduce((best, row) => {
                const bestHistory = Array.isArray(best?.history_data) ? best.history_data.length : 0;
                const rowHistory = Array.isArray(row?.history_data) ? row.history_data.length : 0;
                if (rowHistory > bestHistory) return row;
                if (Number(row?.revenue || 0) > Number(best?.revenue || 0)) return row;
                return best;
            }, rows[0]);
        },

        normalizeHistoryData(rawHistory) {
            if (!Array.isArray(rawHistory)) return [];
            return rawHistory.map(month => {
                const normalizedMonth = {
                    id: month?.id || this.createId(),
                    name: month?.name || '',
                    open: !!month?.open,
                    revenue: Number(month?.revenue || 0),
                    classes: Array.isArray(month?.classes) ? month.classes.map(clase => ({
                        id: clase?.id || '',
                        date: clase?.date || '',
                        dayOfWeek: clase?.dayOfWeek || 'Clase',
                        open: !!clase?.open,
                        attendees: Array.isArray(clase?.attendees)
                            ? clase.attendees.filter(Boolean)
                            : (typeof clase?.attendees === 'string' ? [clase.attendees] : []),
                        attendeeIds: Array.isArray(clase?.attendeeIds)
                            ? clase.attendeeIds.filter(Boolean)
                            : []
                    })) : []
                };
                normalizedMonth.classes = this.mergeDuplicateClasses(normalizedMonth.classes);
                return normalizedMonth;
            });
        },

        mergeDuplicateClasses(classes) {
            if (!Array.isArray(classes)) return [];
            const map = new Map();
            classes.forEach(clase => {
                const dateKey = (clase?.date || '').toString().trim().toLowerCase();
                const idKey = (clase?.id || '').toString().trim();
                const key = idKey !== '' ? ('id:' + idKey) : ('date:' + dateKey);
                if (!map.has(key)) {
                    map.set(key, {
                        id: idKey,
                        date: clase?.date || '',
                        dayOfWeek: clase?.dayOfWeek || 'Clase',
                        open: !!clase?.open,
                        attendees: Array.isArray(clase?.attendees) ? [...new Set(clase.attendees.filter(Boolean))] : [],
                        attendeeIds: Array.isArray(clase?.attendeeIds) ? [...new Set(clase.attendeeIds.filter(Boolean))] : []
                    });
                    return;
                }
                const current = map.get(key);
                const merged = {
                    id: current.id || idKey,
                    date: current.date || clase?.date || '',
                    dayOfWeek: current.dayOfWeek !== 'Clase' ? current.dayOfWeek : (clase?.dayOfWeek || 'Clase'),
                    open: current.open || !!clase?.open,
                    attendees: [...new Set([...(current.attendees || []), ...((Array.isArray(clase?.attendees) ? clase.attendees : []).filter(Boolean))])],
                    attendeeIds: [...new Set([...(current.attendeeIds || []), ...((Array.isArray(clase?.attendeeIds) ? clase.attendeeIds : []).filter(Boolean))])]
                };
                map.set(key, merged);
            });
            return Array.from(map.values());
        },

        createId() {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return window.crypto.randomUUID();
            }
            return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        },

        async saveSettingsToDB(force = false) {
            this.updateLocalCache();
            if (!this.user) return false;

            if (!this.isOnline && !force) {
                this.enqueueOfflineAction({ type: 'saveSettings' });
                return true;
            }

            const payload = {
                user_id: this.user.id,
                revenue: 0, // Lo forzamos a 0 para no volver a migrarlo la próxima vez
                history_data: this.historyData,
                last_billed: this.lastBilled,
                price_tiers: this.priceTiers,
                debt_details: this.debtDetails
            };

            const { data: updatedRows, error: updateError } = await this.supabase
                .from('tkd_settings')
                .update(payload)
                .eq('user_id', this.user.id)
                .select('user_id');
            
            let error = updateError;
            if (!error && (!updatedRows || updatedRows.length === 0)) {
                const { error: insertError } = await this.supabase.from('tkd_settings').insert(payload);
                error = insertError;
            }
            
            if (error) {
                console.error(error);
                this.showToast('Error al guardar en Supabase');
                return false;
            }
            return true;
        },

        showToast(msg) {
            if (this.toastTimer) clearTimeout(this.toastTimer);
            this.toastMsg = msg;
            this.toastTimer = setTimeout(() => { this.toastMsg = ''; this.toastTimer = null; }, 3500);
        },

        // --- CUOTAS ESCALONADAS ---
        getCurrentTierAmount(student) {
            // Alumnos con cuota fija siempre usan su tuition
            if (student && student.cuota_fija) {
                return Number(student.tuition) || 0;
            }
            const day = new Date().getDate();
            if (day <= 10) return Number(this.priceTiers.tier1) || 12500;
            if (day <= 20) return Number(this.priceTiers.tier2) || 15000;
            return Number(this.priceTiers.tier3) || 18000;
        },

        getCurrentTierLabel() {
            const day = new Date().getDate();
            if (day <= 10) return 'Días 1-10';
            if (day <= 20) return 'Días 11-20';
            return 'Días 21+';
        },

        openSettingsModal() {
            this.editTiers = { tier1: this.priceTiers.tier1, tier2: this.priceTiers.tier2, tier3: this.priceTiers.tier3 };
            this.showSettingsModal = true;
        },

        async savePriceTiers() {
            this.priceTiers = {
                tier1: Number(this.editTiers.tier1) || 12500,
                tier2: Number(this.editTiers.tier2) || 15000,
                tier3: Number(this.editTiers.tier3) || 18000,
                lastApplied: this.priceTiers.lastApplied || 1
            };
            const saved = await this.saveSettingsToDB();
            if (saved) {
                this.showSettingsModal = false;
                this.showToast('Ajustes guardados correctamente');
            }
        },

        // --- RECAUDACIÓN MENSUAL ---
        getCurrentMonthRevenue() {
            try {
                const dateObj = new Date();
                const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                const historyArray = Array.isArray(this.historyData) ? this.historyData : [];
                const monthGroup = historyArray.find(m => m && typeof m.name === 'string' && m.name.toLowerCase() === monthName.toLowerCase());
                return monthGroup ? Number(monthGroup.revenue || 0) : 0;
            } catch (error) {
                console.error("Error in getCurrentMonthRevenue:", error);
                return 0;
            }
        },

        addMonthlyRevenue(amount) {
            try {
                const dateObj = new Date();
                const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                if (!Array.isArray(this.historyData)) this.historyData = [];
                let monthGroup = this.historyData.find(m => m && typeof m.name === 'string' && m.name.toLowerCase() === monthName.toLowerCase());
                if (!monthGroup) {
                    monthGroup = { id: this.createId(), name: monthName, open: true, revenue: 0, classes: [] };
                    this.historyData.unshift(monthGroup);
                }
                monthGroup.revenue = Number(monthGroup.revenue || 0) + Number(amount);
                this.historyData = [...this.historyData];
            } catch (error) {
                console.error("Error in addMonthlyRevenue:", error);
            }
        },

        // --- UTILIDADES GLOBALES / HAPTICS ---
        triggerHaptic(type = 'light') {
            try {
                if (navigator.vibrate) {
                    if (type === 'light') navigator.vibrate(20);
                    else if (type === 'heavy') navigator.vibrate([30, 50, 30]);
                    else if (type === 'success') navigator.vibrate([10, 30, 20, 30, 10, 50, 20]);
                }
            } catch(e) {}
        },

        // --- DESGLOSE DE DEUDA MENSUAL ---
        getStudentMonthlyDebts(studentId) {
            return Array.isArray(this.debtDetails[studentId]) ? this.debtDetails[studentId] : [];
        },

        getUnpaidMonths(studentId) {
            return this.getStudentMonthlyDebts(studentId).filter(d => !d.paid && d.amount > 0);
        },

        calcStudentDebt(studentId) {
            return this.getUnpaidMonths(studentId).reduce((sum, d) => sum + Number(d.amount || 0), 0);
        },

        getMonthLabel(monthKey) {
            if (monthKey === 'legacy') return 'Deuda anterior';
            const [year, month] = monthKey.split('-');
            const date = new Date(Number(year), Number(month) - 1);
            const formatted = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            return formatted.charAt(0).toUpperCase() + formatted.slice(1);
        },

        migrateExistingDebts() {
            let migrated = false;
            for (let s of this.students) {
                const currentDebt = Number(s.debt || 0);
                const existingEntries = this.getStudentMonthlyDebts(s.id);
                if (currentDebt > 0 && existingEntries.length === 0) {
                    this.debtDetails[s.id] = [{
                        month: 'legacy',
                        label: 'Deuda anterior',
                        amount: currentDebt,
                        paid: false
                    }];
                    migrated = true;
                }
            }
            if (migrated) {
                this.debtDetails = { ...this.debtDetails };
            }
        },

        buildWhatsAppDebtUrl(student) {
            if (!student || !student.phone) return '#';
            const unpaid = this.getUnpaidMonths(student.id);
            if (unpaid.length === 0) return '#';

            const lines = unpaid.map(d => '- ' + d.label + ': ' + this.formatMoney(d.amount));
            const total = unpaid.reduce((sum, d) => sum + Number(d.amount || 0), 0);

            const msg = 'Hola ' + student.name.split(' ')[0] + '! Te paso el detalle de las cuotas pendientes de Taekwondo:\n\n'
                + lines.join('\n') + '\n\n'
                + 'Total: ' + this.formatMoney(total) + '\n\n'
                + 'Muchas gracias! 🥋';

            return 'https://wa.me/' + student.phone + '?text=' + encodeURIComponent(msg);
        },

        // --- TEMA ---
        applyTheme() {
            let isDark = false;
            if (this.themeMode === 'dark') isDark = true;
            else if (this.themeMode === 'system') isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.classList.toggle('dark', isDark);
            // Actualizar meta theme-color
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', isDark ? '#0f172a' : '#ffffff');
        },

        setTheme(mode) {
            this.themeMode = mode;
            localStorage.setItem('cmk-theme', mode);
            this.applyTheme();
        },

        // --- MOTOR DE MESES ---
        async checkNewMonthBilling() {
            if (this.billingInProgress || !this.isOnline) return;
            this.billingInProgress = true;
            const today = new Date();
            const currentMonthKey = today.getFullYear() + '-' + (today.getMonth() + 1).toString().padStart(2, '0');

            try {
                if (this.lastBilled !== currentMonthKey && this.students.length > 0) {
                    const previousDebts = new Map(this.students.map(s => [s.id, Number(s.debt || 0)]));
                    const previousLastBilled = this.lastBilled;
                    for (let s of this.students) {
                        if (s.archived) continue; // No facturar a archivados
                        // Cuota fija usa su tuition, normales usan tier1 (base)
                        const monthlyAmount = s.cuota_fija ? Number(s.tuition) : Number(this.priceTiers.tier1);
                        s.debt = Number(s.debt) + monthlyAmount;

                        // Crear entrada mensual en debtDetails
                        if (!Array.isArray(this.debtDetails[s.id])) this.debtDetails[s.id] = [];
                        this.debtDetails[s.id].push({
                            month: currentMonthKey,
                            label: this.getMonthLabel(currentMonthKey),
                            amount: monthlyAmount,
                            paid: false
                        });

                        await this.supabase.from('tkd_students').update({ debt: s.debt }).eq('id', s.id);
                    }
                    this.lastBilled = currentMonthKey;
                    // Resetear tier aplicado al empezar mes nuevo
                    this.priceTiers.lastApplied = 1;
                    const saved = await this.saveSettingsToDB();
                    if (!saved) {
                        this.students = this.students.map(s => ({ ...s, debt: previousDebts.get(s.id) ?? s.debt }));
                        this.lastBilled = previousLastBilled;
                        return;
                    }
                    this.showToast('Nuevo mes: cuotas agregadas a la deuda');
                } else if (!this.lastBilled) {
                    this.lastBilled = currentMonthKey;
                    this.priceTiers.lastApplied = 1;
                    const saved = await this.saveSettingsToDB();
                    if (!saved) this.lastBilled = null;
                }

                // Aplicar ajuste de tier si cambió el rango de días
                await this.applyTierAdjustment();
            } finally {
                this.billingInProgress = false;
            }
        },

        // Ajuste automático: si pasamos de tier (días 11-20 o días 21+), sumar la diferencia a quienes no pagaron la cuota actual
        async applyTierAdjustment() {
            if (!this.isOnline) return;
            const today = new Date();
            const day = today.getDate();
            const currentMonthKey = today.getFullYear() + '-' + (today.getMonth() + 1).toString().padStart(2, '0');

            let currentTier = 1;
            if (day > 20) currentTier = 3;
            else if (day > 10) currentTier = 2;

            const lastApplied = Number(this.priceTiers.lastApplied) || 1;

            if (currentTier > lastApplied && this.students.length > 0) {
                const tierValues = { 
                    1: Number(this.priceTiers.tier1) || 12500, 
                    2: Number(this.priceTiers.tier2) || 15000, 
                    3: Number(this.priceTiers.tier3) || 18000 
                };
                const diff = tierValues[currentTier] - tierValues[lastApplied];

                if (diff > 0) {
                    const previousDebts = new Map(this.students.map(s => [s.id, Number(s.debt || 0)]));
                    let adjusted = 0;

                    for (let s of this.students) {
                        if (s.archived || s.cuota_fija) continue; // No aplicar recargo a archivados ni cuota fija

                        const monthEntries = this.getStudentMonthlyDebts(s.id);
                        const currentMonthEntry = monthEntries.find(d => d.month === currentMonthKey);

                        // Aplica recargo si:
                        // 1) Existe la entrada del mes actual y no está pagada completamente (!currentMonthEntry.paid)
                        // 2) O no existe entrada del mes actual pero el alumno tiene deuda acumulada (> 0)
                        let shouldAdjust = false;
                        if (currentMonthEntry && !currentMonthEntry.paid) {
                            shouldAdjust = true;
                        } else if (!currentMonthEntry && Number(s.debt || 0) > 0) {
                            shouldAdjust = true;
                        }

                        if (shouldAdjust) {
                            s.debt = Number(s.debt || 0) + diff;

                            if (currentMonthEntry) {
                                currentMonthEntry.amount = Number(currentMonthEntry.amount || 0) + diff;
                            } else if (monthEntries.length > 0) {
                                const unpaidEntries = monthEntries.filter(d => !d.paid);
                                const targetEntry = unpaidEntries[unpaidEntries.length - 1] || monthEntries[monthEntries.length - 1];
                                if (targetEntry) {
                                    targetEntry.amount = Number(targetEntry.amount || 0) + diff;
                                }
                            }

                            await this.supabase.from('tkd_students').update({ debt: s.debt }).eq('id', s.id);
                            adjusted++;
                        }
                    }

                    this.debtDetails = { ...this.debtDetails };
                    this.priceTiers.lastApplied = currentTier;
                    const saved = await this.saveSettingsToDB();
                    if (!saved) {
                        // Revertir
                        this.students.forEach(s => {
                            if (previousDebts.has(s.id)) s.debt = previousDebts.get(s.id);
                        });
                        return;
                    }

                    if (adjusted > 0) {
                        const tierRangeName = currentTier === 2 ? 'días 11-20' : 'días 21+';
                        this.showToast(`Recargo (${tierRangeName}) aplicado: +${this.formatMoney(diff)} a ${adjusted} alumno${adjusted > 1 ? 's' : ''}`);
                    }
                }
            }
        },

        // --- PAGOS MENSUALES (MODAL DE COBRO) ---
        openPaymentModal(student) {
            if (!student) return;
            this.paymentStudent = student;
            // Sugerir cobrar exactamente el total de la deuda calculada
            this.paymentAmount = this.calcStudentDebt(student.id);
            this.showPaymentModal = true;
        },

        async confirmPayment() {
            if (!this.paymentStudent) return;
            const amount = Number(this.paymentAmount) || 0;
            if (amount <= 0) {
                this.showToast('Ingresá un monto válido');
                return;
            }

            const previousDebt = Number(this.paymentStudent.debt || 0);

            // Restar del debt, si queda < 0 poner en 0
            const newDebt = Math.max(0, previousDebt - amount);
            this.paymentStudent.debt = newDebt;

            // Aplicar pago FIFO a desglose mensual
            let remaining = amount;
            const entries = this.getStudentMonthlyDebts(this.paymentStudent.id);
            for (let entry of entries) {
                if (entry.paid || remaining <= 0) continue;
                if (remaining >= entry.amount) {
                    remaining -= entry.amount;
                    entry.paid = true;
                } else {
                    entry.amount -= remaining;
                    remaining = 0;
                }
            }
            this.debtDetails = { ...this.debtDetails };

            this.addMonthlyRevenue(amount);

            // Actualizar en la lista de students
            const index = this.students.findIndex(s => s.id === this.paymentStudent.id);
            if (index !== -1) this.students[index] = { ...this.paymentStudent };

            if (this.user) {
                if (!this.isOnline) {
                    this.enqueueOfflineAction({ type: 'updateStudent', id: this.paymentStudent.id, payload: { debt: newDebt } });
                    this.saveSettingsToDB();
                } else {
                    const { error } = await this.supabase.from('tkd_students').update({ debt: newDebt }).eq('id', this.paymentStudent.id);
                    if (error) {
                        this.addMonthlyRevenue(-amount); // Revertir sumatoria
                        this.paymentStudent.debt = previousDebt;
                        if (index !== -1) this.students[index] = { ...this.paymentStudent };
                        this.showToast('Error al actualizar deuda');
                        return;
                    }
                    const saved = await this.saveSettingsToDB();
                    if (!saved) {
                        this.addMonthlyRevenue(-amount);
                        this.paymentStudent.debt = previousDebt;
                        if (index !== -1) this.students[index] = { ...this.paymentStudent };
                        return;
                    }
                }
            }

            // Actualizar activeStudent si está abierto el perfil
            if (this.activeStudent && this.activeStudent.id === this.paymentStudent.id) {
                this.activeStudent.debt = newDebt;
            }

            this.showPaymentModal = false;
            // Cerrar también el perfil del alumno al confirmar cobro
            this.closeProfileModal();
            this.triggerHaptic('success');
            if (newDebt > 0) {
                this.showToast('Pago parcial registrado. Resta: ' + this.formatMoney(newDebt));
            } else {
                this.showToast('Cobro registrado. Cuota al día');
            }
        },

        async resetCaja() {
            const dateObj = new Date();
            const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            let monthGroup = this.historyData.find(m => m.name.toLowerCase() === monthName.toLowerCase());
            
            if (!monthGroup) return; // Nada que reiniciar
            
            const previousRevenue = Number(monthGroup.revenue || 0);
            monthGroup.revenue = 0;
            this.historyData = [...this.historyData];
            
            this.confirmReset = false;
            const saved = await this.saveSettingsToDB();
            if (!saved) {
                monthGroup.revenue = previousRevenue;
                this.historyData = [...this.historyData];
                return;
            }
            this.showToast('Caja mensual reiniciada a cero');
        },

        // --- PERFIL Y CRUD ---
        openStudentProfile(student) {
            this.activeStudent = { ...student };
            this.showProfileModal = true;
        },
        closeProfileModal() {
            this.showProfileModal = false;
            this.activeStudent = null;
        },

        openEditModal(student = null) {
            this.showProfileModal = false;
            if (student) {
                this.isEditing = true;
                this.form = { ...student, dni: student.dni || '', cuota_fija: !!student.cuota_fija };
            } else {
                this.isEditing = false;
                const currentAmount = this.getCurrentTierAmount(null);
                this.form = { id: this.createId(), name: '', dob: '', rank: 'Blanco', tuition: currentAmount, debt: currentAmount, phone: '', location: '', dni: '', cuota_fija: false, exam_paid: false, exam_paid_amount: 0 };
            }
            setTimeout(() => { this.showEditModal = true; }, 100);
        },
        closeEditModal() { 
            this.showEditModal = false; 
        },

        async saveStudent() {
            if (!this.form.name) {
                this.showToast("El nombre es obligatorio");
                return;
            }
            
            this.form.debt = Number(this.form.debt);
            this.form.tuition = Number(this.form.tuition);
            this.form.exam_paid_amount = Number(this.form.exam_paid_amount || 0);

            if (this.user) {
                const dbPayload = {
                    id: this.form.id,
                    user_id: this.user.id,
                    name: this.form.name,
                    dob: this.form.dob || null,
                    rank: this.form.rank,
                    tuition: this.form.tuition,
                    debt: this.form.debt,
                    phone: this.form.phone,
                    location: this.form.location,
                    dni: this.form.dni || '',
                    cuota_fija: this.form.cuota_fija || false,
                    exam_paid: this.form.exam_paid || false,
                    exam_paid_amount: this.form.exam_paid_amount,
                    archived: this.form.archived || false
                };

                if (!this.isOnline) {
                    this.enqueueOfflineAction({ type: 'upsertStudent', payload: dbPayload });
                } else {
                    let { error } = await this.supabase.from('tkd_students').upsert(dbPayload);
                    if (error) {
                        const fallbackPayload = { ...dbPayload };
                        delete fallbackPayload.exam_paid_amount;
                        delete fallbackPayload.dni;
                        delete fallbackPayload.cuota_fija;
                        const retry = await this.supabase.from('tkd_students').upsert(fallbackPayload);
                        error = retry.error;
                    }
                    if (error) { this.showToast("Error guardando en BD"); return; }
                }
            }

            // Sincronizar debtDetails con el valor de deuda guardado manualmente en el formulario
            const inputDebt = Number(this.form.debt) || 0;
            const currentCalcDebt = this.calcStudentDebt(this.form.id);
            if (inputDebt !== currentCalcDebt) {
                if (inputDebt === 0) {
                    const entries = this.getStudentMonthlyDebts(this.form.id);
                    entries.forEach(e => e.paid = true);
                } else {
                    this.debtDetails[this.form.id] = [{
                        month: 'legacy',
                        label: 'Deuda anterior',
                        amount: inputDebt,
                        paid: false
                    }];
                }
                this.debtDetails = { ...this.debtDetails };
            }

            if (this.isEditing) {
                const index = this.students.findIndex(s => s.id === this.form.id);
                if (index !== -1) this.students[index] = { ...this.form };
                this.showToast('Cambios guardados');
            } else {
                this.students.push({ ...this.form });
                this.showToast('Alumno registrado');
            }
            
            this.saveSettingsToDB();
            this.triggerHaptic('success');
            this.closeEditModal();
        },

        async deleteStudentConfirmed() {
            if(this.activeStudent) {
                if (this.user) {
                    if (!this.isOnline) {
                        this.enqueueOfflineAction({ type: 'deleteStudent', id: this.activeStudent.id });
                    } else {
                        await this.supabase.from('tkd_students').delete().eq('id', this.activeStudent.id);
                    }
                }
                this.students = this.students.filter(s => s.id !== this.activeStudent.id);
                this.updateLocalCache();
                this.triggerHaptic('heavy');
                this.closeProfileModal();
                this.showToast('Alumno eliminado con éxito');
            }
        },

        async toggleArchiveStudent(student) {
            if (!student) return;
            const newArchived = !student.archived;
            student.archived = newArchived;

            // Actualizar en el array reactivo
            const index = this.students.findIndex(s => s.id === student.id);
            if (index !== -1) {
                this.students[index] = { ...student };
            }

            if (this.user) {
                if (!this.isOnline) {
                    this.enqueueOfflineAction({ type: 'updateStudent', id: student.id, payload: { archived: newArchived } });
                    this.saveSettingsToDB();
                } else {
                    const { error } = await this.supabase.from('tkd_students').update({ archived: newArchived }).eq('id', student.id);
                    if (error) {
                        this.showToast('Error al actualizar estado en Supabase');
                        student.archived = !newArchived;
                        if (index !== -1) this.students[index] = { ...student };
                        return;
                    }
                    await this.saveSettingsToDB();
                }
            }

            // Actualizar activeStudent si está abierto el perfil
            if (this.activeStudent && this.activeStudent.id === student.id) {
                this.activeStudent.archived = newArchived;
            }

            this.triggerHaptic('heavy');
            this.closeProfileModal();
            this.showToast(newArchived ? 'Alumno archivado con éxito' : 'Alumno desarchivado con éxito');
        },

        // --- ASISTENCIA INTELIGENTE ---
        getLocalISODate() {
            const dateObj = new Date();
            const tzOffset = dateObj.getTimezoneOffset() * 60000;
            return (new Date(dateObj - tzOffset)).toISOString().split('T')[0];
        },

        hasAttendanceToday() {
            const localISOTime = this.getLocalISODate();
            return this.historyData.some(month =>
                Array.isArray(month.classes) && month.classes.some(c => c.id === localISOTime)
            );
        },

        async clearTodayAttendance() {
            const localISOTime = this.getLocalISODate();
            this.historyData = this.historyData.map(month => ({
                ...month,
                classes: Array.isArray(month.classes) ? month.classes.filter(c => c.id !== localISOTime) : []
            }));
            this.historyData = this.historyData.filter(month => (Array.isArray(month.classes) && month.classes.length > 0) || Number(month.revenue || 0) > 0);
            const saved = await this.saveSettingsToDB();
            if (!saved) return;
            this.attendanceBuffer = [];
            this.showToast('Asistencia de hoy eliminada');
        },

        getAttendeeIds(clase) {
            if (!clase) return [];
            if (Array.isArray(clase.attendeeIds) && clase.attendeeIds.length > 0) {
                return clase.attendeeIds;
            }
            // Compatibilidad con historial antiguo guardado por nombres.
            const attendeeNames = Array.isArray(clase.attendees) ? clase.attendees : [];
            return this.students
                .filter(s => attendeeNames.includes(s.name))
                .map(s => s.id);
        },

        getClassAttendeeNames(clase) {
            if (!clase) return [];
            const names = Array.isArray(clase.attendees) ? clase.attendees.filter(Boolean) : [];
            if (names.length > 0) return names;
            const ids = Array.isArray(clase.attendeeIds) ? clase.attendeeIds : [];
            if (ids.length === 0) return [];
            const byId = new Map(this.students.map(s => [s.id, s.name]));
            return ids.map(id => byId.get(id) || ('Alumno eliminado (' + String(id).slice(0, 8) + ')'));
        },

        get studentsForAttendance() {
            const localISOTime = this.getLocalISODate();
            
            let todaysAttendeeIds = [];
            this.historyData.forEach(month => {
                if (!Array.isArray(month.classes)) return;
                const todaysClass = month.classes.find(c => c.id === localISOTime);
                if (!todaysClass) return;
                const ids = this.getAttendeeIds(todaysClass);
                const names = this.getClassAttendeeNames(todaysClass);
                if (ids.length > 0 || names.length > 0) {
                    todaysAttendeeIds.push(...ids);
                }
            });
            
            return this.students.filter(s => !s.archived && !todaysAttendeeIds.includes(s.id));
        },

        toggleBuffer(id) {
            if (this.attendanceBuffer.includes(id)) {
                this.attendanceBuffer = this.attendanceBuffer.filter(sid => sid !== id);
            } else {
                this.attendanceBuffer.push(id);
            }
        },

        async saveAttendance() {
            if (this.attendanceBuffer.length === 0) return;

            const dateObj = new Date();
            const localISOTime = this.getLocalISODate();
            
            const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            const displayDate = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
            const dayOfWeek = dateObj.toLocaleDateString('es-AR', { weekday: 'long' }); 
            
            const selectedStudents = this.students.filter(s => this.attendanceBuffer.includes(s.id));
            const names = selectedStudents.map(s => s.name);
            const ids = selectedStudents.map(s => s.id);

            let monthGroup = this.historyData.find(m => m.name.toLowerCase() === monthName.toLowerCase());
            if (!monthGroup) {
                monthGroup = { id: this.createId(), name: monthName, open: true, classes: [] };
                this.historyData.unshift(monthGroup);
            }
            monthGroup.open = true;
            monthGroup.classes = this.mergeDuplicateClasses(monthGroup.classes);
            
            let todaysClass = monthGroup.classes.find(c => c.id === localISOTime || c.date === displayDate);
            if (todaysClass) {
                todaysClass.id = localISOTime;
                todaysClass.open = true;
                names.forEach(n => {
                    if (!todaysClass.attendees.includes(n)) todaysClass.attendees.push(n);
                });
                if (!Array.isArray(todaysClass.attendeeIds)) todaysClass.attendeeIds = [];
                ids.forEach(id => {
                    if (!todaysClass.attendeeIds.includes(id)) todaysClass.attendeeIds.push(id);
                });
            } else {
                monthGroup.classes.unshift({
                    id: localISOTime,
                    date: displayDate,
                    dayOfWeek: dayOfWeek,
                    open: true,
                    attendees: names,
                    attendeeIds: ids
                });
            }
            monthGroup.classes = this.mergeDuplicateClasses(monthGroup.classes);
            
            // Forzar reactividad profunda en Alpine.js
            this.historyData = JSON.parse(JSON.stringify(this.historyData));
            const saved = await this.saveSettingsToDB();
            if (!saved) return;
            this.attendanceBuffer = [];
            this.showToast('Asistencia guardada con éxito');
            this.view = 'history';
        },

        // --- PAGOS DE EXAMEN (CUSTOM UI MODAL) ---
        get examList() {
            return this.students.map(student => ({
                id: student.id,
                name: student.name,
                current: student.rank,
                next: this.getNextRank(student.rank),
                exam_paid: !!student.exam_paid
            }));
        },

        async promotePaidStudents() {
            const paidStudents = this.students.filter(s => s.exam_paid);
            if (paidStudents.length === 0) {
                this.showToast('No hay ningún alumno con examen pagado para promocionar');
                return;
            }

            if (!confirm('¿Estás seguro de que querés promocionar a los ' + paidStudents.length + ' alumnos que pagaron al siguiente cinturón?')) {
                return;
            }

            let promotedCount = 0;
            for (let s of paidStudents) {
                const nextRank = this.getNextRank(s.rank);
                if (nextRank && nextRank !== 'Dan (Máximo)') {
                    s.rank = nextRank;
                }
                s.exam_paid = false;
                s.exam_paid_amount = 0;

                // Actualizar en Supabase / Offline
                const payload = { rank: s.rank, exam_paid: false, exam_paid_amount: 0 };
                if (this.user) {
                    if (!this.isOnline) {
                        this.enqueueOfflineAction({ type: 'updateStudent', id: s.id, payload: payload });
                    } else {
                        await this.supabase.from('tkd_students').update(payload).eq('id', s.id);
                    }
                }
                promotedCount++;
            }

            // Guardar settings y cache
            await this.saveSettingsToDB();
            this.students = [...this.students];
            this.triggerHaptic('success');
            this.showToast('Promoción completada: ' + promotedCount + ' alumnos pasaron al siguiente cinturón');
        },

        openExamPayment(student) {
            if (!student) return;
            this.examPaymentStudent = student;
            this.examPaymentAmount = 15000;
            this.showExamModal = true;
        },

        async confirmExamPayment() {
            if (!this.examPaymentStudent) return;
            const amount = Number(this.examPaymentAmount) || 0;
            if (amount <= 0) {
                this.showToast('Ingresá un monto válido');
                return;
            }
            const previousPaid = !!this.examPaymentStudent.exam_paid;
            const previousPaidAmount = Number(this.examPaymentStudent.exam_paid_amount || 0);
            
            this.addMonthlyRevenue(amount);
            this.examPaymentStudent.exam_paid = true;
            this.examPaymentStudent.exam_paid_amount = amount;
            
            if (this.user) {
                if (!this.isOnline) {
                    this.enqueueOfflineAction({ type: 'updateStudent', id: this.examPaymentStudent.id, payload: { exam_paid: true, exam_paid_amount: amount } });
                    this.saveSettingsToDB();
                } else {
                    let { error } = await this.supabase
                        .from('tkd_students')
                        .update({ exam_paid: true, exam_paid_amount: amount })
                        .eq('id', this.examPaymentStudent.id);
                    if (error && String(error.message || '').toLowerCase().includes('exam_paid_amount')) {
                        const retry = await this.supabase
                            .from('tkd_students')
                            .update({ exam_paid: true })
                            .eq('id', this.examPaymentStudent.id);
                        error = retry.error;
                    }
                    if (error) {
                        this.addMonthlyRevenue(-amount);
                        this.examPaymentStudent.exam_paid = previousPaid;
                        this.examPaymentStudent.exam_paid_amount = previousPaidAmount;
                        this.showToast('Error al registrar pago de examen');
                        return;
                    }
                    const saved = await this.saveSettingsToDB();
                    if (!saved) {
                        this.addMonthlyRevenue(-amount);
                        this.examPaymentStudent.exam_paid = previousPaid;
                        this.examPaymentStudent.exam_paid_amount = previousPaidAmount;
                        return;
                    }
                }
            }

            this.students = [...this.students];
            this.showExamModal = false;
            this.triggerHaptic('success');
            this.showToast('Pago de examen registrado exitosamente');
        },

        async cancelExamPay(student) {
            if (!student) return;
            const paidAmount = Number(student.exam_paid_amount);
            const discount = paidAmount > 0 ? paidAmount : 15000;
            const previousPaid = !!student.exam_paid;
            const previousPaidAmount = Number(student.exam_paid_amount || 0);
            student.exam_paid = false;
            student.exam_paid_amount = 0;
            
            this.addMonthlyRevenue(-discount);

            if (this.user) {
                if (!this.isOnline) {
                    this.enqueueOfflineAction({ type: 'updateStudent', id: student.id, payload: { exam_paid: false, exam_paid_amount: 0 } });
                    this.saveSettingsToDB();
                } else {
                    let { error } = await this.supabase
                        .from('tkd_students')
                        .update({ exam_paid: false, exam_paid_amount: 0 })
                        .eq('id', student.id);
                    if (error && String(error.message || '').toLowerCase().includes('exam_paid_amount')) {
                        const retry = await this.supabase
                            .from('tkd_students')
                            .update({ exam_paid: false })
                            .eq('id', student.id);
                        error = retry.error;
                    }
                    if (error) {
                        this.addMonthlyRevenue(discount);
                        student.exam_paid = previousPaid;
                        student.exam_paid_amount = previousPaidAmount;
                        this.showToast('Error al anular pago de examen');
                        return;
                    }
                    const saved = await this.saveSettingsToDB();
                    if (!saved) {
                        this.addMonthlyRevenue(discount);
                        student.exam_paid = previousPaid;
                        student.exam_paid_amount = previousPaidAmount;
                        return;
                    }
                }
            }
            this.students = [...this.students];
            this.showToast('Pago anulado y descontado de caja');
            this.triggerHaptic('heavy');
        },

        // --- UTILIDADES ---
        get filteredStudents() {
            const showArchived = this.archiveFilter === 'archived';
            const baseList = this.students.filter(s => !!s.archived === showArchived);
            if (this.search === '') return baseList;
            return baseList.filter(s => s.name.toLowerCase().includes(this.search.toLowerCase()));
        },

        getUpcomingExamDate() {
            const today = new Date();
            const year = today.getFullYear();
            
            // Meses en JS son 0-indexados: 3 = Abril, 7 = Agosto, 11 = Diciembre
            const dates = [
                new Date(year, 3, 10),
                new Date(year, 7, 10),
                new Date(year, 11, 10)
            ];
            
            // Buscamos la primera fecha de examen del año que todavía no haya pasado
            for (let i = 0; i < dates.length; i++) {
                if (today <= dates[i]) {
                    return dates[i];
                }
            }
            
            // Si ya pasaron los 3 del año, el próximo es abril del año que viene
            return new Date(year + 1, 3, 10);
        },

        formatExamDate(date) {
            if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
            const formatted = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            return formatted.charAt(0).toUpperCase() + formatted.slice(1);
        },



        getGreeting() {
            const h = new Date().getHours();
            if (h < 12) return '☀️ Buen día';
            if (h < 19) return '🌤️ Buenas tardes';
            return '🌙 Buenas noches';
        },

        getPageTitle() {
            const map = { 'dashboard': 'General', 'students': 'Alumnos', 'attendance': 'Tomar Lista', 'history': 'Historial', 'exams': 'Examen' };
            return map[this.view];
        },
        getPageSubtitle() {
            if (this.view === 'attendance') return 'Seleccioná a los presentes';
            if (this.view === 'students') return 'Tocá un alumno para ver su perfil';
            return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
        },

        calculateAge(dob) {
            if(!dob) return '-';
            const diff = Date.now() - new Date(dob).getTime();
            return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        },

        countSaturdays(targetDate) {
            let count = 0; let current = new Date();
            while (current <= targetDate) {
                if (current.getDay() === 6) count++;
                current.setDate(current.getDate() + 1);
            }
            return count;
        },

        getNextRank(rank) {
            const idx = this.ranks.indexOf(rank);
            return (idx !== -1 && idx < this.ranks.length - 1) ? this.ranks[idx+1] : 'Dan (Máximo)';
        },

        formatMoney(amount) { 
            return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(amount || 0); 
        },

        getCardStyle(rank) {
            if (!rank) return 'card-Blanco';
            let isAvz = rank.includes('Avz');
            
            if (rank.includes('Blanco')) return 'card-Blanco';
            if (rank.includes('Amarillo')) return isAvz ? 'card-Amarillo-Avz' : 'card-Amarillo';
            if (rank.includes('Azul')) return isAvz ? 'card-Azul-Avz' : 'card-Azul';
            if (rank.includes('Rojo')) return isAvz ? 'card-Rojo-Avz' : 'card-Rojo';
            if (rank.includes('Negro')) return 'card-Negro';
            
            return 'card-Blanco';
        }
    }));
});

// --- Registro del Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
}

// ===================================
// LIQUID GLASS CANVAS SHADER (PERFECT VSYNC & HIDPI)
// ===================================
(function initLiquidCanvas() {
    function startCanvas() {
        const canvas = document.getElementById('bg-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        let width = 0, height = 0, dpr = 1;

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        window.addEventListener('resize', resize, { passive: true });
        resize();

        let lastTime = performance.now();
        let t = 0;

        function render(now) {
            const dt = Math.min((now - lastTime) / 1000, 0.05);
            lastTime = now;
            t += dt * 0.18; // Delta-time continuo perfecto

            ctx.clearRect(0, 0, width, height);

            const isDark = document.documentElement.classList.contains('dark');

            const r1 = Math.max(width, height) * 0.45;
            const r2 = Math.max(width, height) * 0.40;
            const r3 = Math.max(width, height) * 0.35;

            const x1 = width * 0.3 + Math.sin(t * 0.7) * (width * 0.15);
            const y1 = height * 0.3 + Math.cos(t * 0.5) * (height * 0.15);

            const x2 = width * 0.7 + Math.cos(t * 0.6) * (width * 0.15);
            const y2 = height * 0.7 + Math.sin(t * 0.8) * (height * 0.15);

            const x3 = width * 0.5 + Math.sin(t * 1.0) * (width * 0.1);
            const y3 = height * 0.5 + Math.cos(t * 0.4) * (height * 0.1);

            // Esfera 1 (Indigo)
            const g1 = ctx.createRadialGradient(x1, y1, 10, x1, y1, r1);
            g1.addColorStop(0, isDark ? 'rgba(79, 70, 229, 0.35)' : 'rgba(129, 140, 248, 0.40)');
            g1.addColorStop(1, 'rgba(129, 140, 248, 0)');
            ctx.fillStyle = g1;
            ctx.beginPath(); ctx.arc(x1, y1, r1, 0, Math.PI * 2); ctx.fill();

            // Esfera 2 (Púrpura)
            const g2 = ctx.createRadialGradient(x2, y2, 10, x2, y2, r2);
            g2.addColorStop(0, isDark ? 'rgba(124, 58, 237, 0.30)' : 'rgba(192, 132, 252, 0.38)');
            g2.addColorStop(1, 'rgba(192, 132, 252, 0)');
            ctx.fillStyle = g2;
            ctx.beginPath(); ctx.arc(x2, y2, r2, 0, Math.PI * 2); ctx.fill();

            // Esfera 3 (Celeste)
            const g3 = ctx.createRadialGradient(x3, y3, 10, x3, y3, r3);
            g3.addColorStop(0, isDark ? 'rgba(14, 165, 233, 0.25)' : 'rgba(56, 189, 248, 0.35)');
            g3.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.fillStyle = g3;
            ctx.beginPath(); ctx.arc(x3, y3, r3, 0, Math.PI * 2); ctx.fill();

            requestAnimationFrame(render);
        }

        requestAnimationFrame(render);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startCanvas);
    } else {
        startCanvas();
    }
})();
