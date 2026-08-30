// ===================================
// Taekwondo CMK - Lógica Principal
// ===================================

let globalDeferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    if (window.tkdAppInstance) {
        window.tkdAppInstance.deferredPrompt = e;
        window.tkdAppInstance.showInstallBanner = true;
    }
});

// CONFIGURACIÓN SUPABASE
const SUPABASE_URL = 'https://ihxvrsdyxhslwahkklmh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iCPuyn5_jTXvtPl4zwwbVA_uf-F3W05';

function tkdApp() {
    return {
        view: 'dashboard',
        search: '',
        
        get hasAnyModalOpen() {
            return !!(this.showProfileModal || 
                      this.showEditModal || 
                      this.showExamModal || 
                      this.showPaymentModal || 
                      this.showSettingsModal || 
                      this.showStudentProfileModal || 
                      this.showStudentMenuModal ||
                      this.showMercadoPagoModal ||
                      this.showUpdatePasswordModal ||
                      this.showInstallHelpModal);
        },
        
        // Auth & Supabase
        supabase: null,
        user: null,
        authEmail: '',
        authPassword: '',
        authError: '',
        authLoading: false,
        showPassword: false,
        authMode: 'signin', // 'signin' | 'signup' | 'reset'
        resetEmailSent: false,
        newPassword: '',
        showUpdatePasswordModal: false,
        lastBilled: null,
        
        // Modales
        showProfileModal: false,
        showEditModal: false,
        isEditing: false,
        activeStudent: null,
        showStudentMenuModal: false,
        
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

        // Valores de Examen escalonados por cinturón de destino
        examTiers: { amarillos: 12000, azules: 15000, rojos: 18000, negros: 25000 },
        editExamTiers: { amarillos: 12000, azules: 15000, rojos: 18000, negros: 25000 },
        editSchedules: [],
        settingsTab: 'tuition', // 'tuition' | 'exams' | 'schedules' | 'theme'

        // Métodos de pago y Registro de transacciones
        paymentMethod: 'efectivo', // 'efectivo' | 'transferencia'
        historyTab: 'payments', // 'payments' | 'classes'
        paymentHistory: [],
        showMercadoPagoModal: false,
        showPartialPayModal: false,
        partialPayAmount: null,
        mpPaymentType: 'cuota',
        mpPaymentAmount: 0,

        // Misc
        appReady: false,
        toastMsg: '',
        toastTimer: null,
        confirmReset: false,
        showRevenue: true,
        billingInProgress: false,

        // Tema (light / dark / system)
        theme: localStorage.getItem('cmk-theme') || 'light',
        themeMode: localStorage.getItem('cmk-theme') || 'light',

        // Roles y Portal de Alumnos
        userRole: 'admin', // 'admin' | 'student'
        studentView: 'status', // 'status' | 'payments' | 'exam' | 'attendance' | 'schedule'
        linkedStudent: null,
        availableStudentsToLink: [],
        studentAttendanceDates: [],
        inputDni: '',
        linkByDniError: '',
        linkByDniLoading: false,
        studentAttendances: [],
        mpLoading: false,
        showStudentProfileModal: false,
        studentProfileForm: { name: '', rank: '', dni: '', phone: '', dob: '', location: '' },
        showInstallBanner: false,
        deferredPrompt: null,
        isPWAInstalled: window.matchMedia('(display-mode: standalone)').matches || (window.navigator && window.navigator.standalone === true),
        studentSchedules: [
            { day: 'Lunes', time: '18:00 - 19:30', location: 'Dojo Principal' },
            { day: 'Miércoles', time: '18:00 - 19:30', location: 'Dojo Principal' },
            { day: 'Viernes', time: '18:00 - 19:30', location: 'Dojo Principal' }
        ],

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
                this.appReady = true;
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

                // Auto-actualización al regresar a la pestaña (visibilidad)
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') {
                        if (this.userRole === 'student') {
                            this.loadStudentPortalData();
                        } else if (this.userRole === 'admin' && this.user) {
                            this.loadDataFromDB();
                        }
                    }
                });

                window.tkdAppInstance = this;
                const existingPrompt = globalDeferredPrompt || window.deferredInstallPrompt;
                if (existingPrompt) {
                    this.deferredPrompt = existingPrompt;
                    this.showInstallBanner = true;
                }

                // Registro PWA & Instalación
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.register('/sw.js').catch(() => {});
                }
                window.addEventListener('beforeinstallprompt', (e) => {
                    e.preventDefault();
                    globalDeferredPrompt = e;
                    window.deferredInstallPrompt = e;
                    this.deferredPrompt = e;
                    this.showInstallBanner = true;
                });
                window.addEventListener('appinstalled', () => {
                    this.isPWAInstalled = true;
                    this.showInstallBanner = false;
                    this.deferredPrompt = null;
                    globalDeferredPrompt = null;
                    window.deferredInstallPrompt = null;
                });

                // Aplicar tema guardado
                this.themeMode = localStorage.getItem('cmk-theme') || 'dark';
                this.applyTheme();
                // Escuchar cambios del sistema
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                    if (this.themeMode === 'system') this.applyTheme();
                });

                const { data: { session } } = await this.supabase.auth.getSession();
                if (session?.user) {
                    await this.startUserSession(session.user);
                    await this.checkMercadoPagoReturn();
                }

                this.supabase.auth.onAuthStateChange(async (event, session) => {
                    if (event === 'PASSWORD_RECOVERY') {
                        this.showUpdatePasswordModal = true;
                    }
                    if (session?.user) {
                        if (!this.user) {
                            await this.startUserSession(session.user);
                            await this.checkMercadoPagoReturn();
                        }
                    } else {
                        this.user = null;
                        this.students = [];
                        this.historyData = [];
                    }
                });
            } catch (e) {
                this.authError = "Error al conectar con Supabase. Verifica las credenciales.";
            } finally {
                setTimeout(() => {
                    this.appReady = true;
                }, 400);
            }
        },

        getStudentPaymentTransactions(studentId) {
            if (!studentId || !Array.isArray(this.paymentHistory)) return [];
            const st = this.students.find(s => s.id === studentId) || this.linkedStudent;
            const targetName = (st?.name || '').trim().toLowerCase();
            return this.paymentHistory.filter(tx => {
                if (tx.studentId && tx.studentId === studentId) return true;
                if (targetName && (tx.studentName || '').trim().toLowerCase() === targetName) return true;
                return false;
            });
        },

        async checkMercadoPagoReturn() {
            try {
                const params = new URLSearchParams(window.location.search);
                const mpStatus = params.get('mp_status') || params.get('collection_status') || params.get('status');
                const paymentId = params.get('payment_id') || params.get('collection_id');
                const type = params.get('type') || 'cuota';
                const studentId = params.get('student_id');
                const fallbackAmount = Number(params.get('amount') || 0);

                if (paymentId && !localStorage.getItem('cmk-processed-mp-' + paymentId)) {
                    // Verificación OBLIGATORIA y estricta en el servidor con la API oficial de Mercado Pago
                    try {
                        let verifyRes = await fetch('/api/verify-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ payment_id: paymentId })
                        }).catch(() => null);

                        if (!verifyRes || !verifyRes.ok) {
                            verifyRes = await fetch('/.netlify/functions/verify-payment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ payment_id: paymentId })
                            });
                        }

                        if (verifyRes.ok) {
                            const verifyData = await verifyRes.json();
                            if (verifyData.verified && verifyData.amount > 0) {
                                localStorage.setItem('cmk-processed-mp-' + paymentId, 'true');
                                await this.processMercadoPagoApproval({
                                    paymentId,
                                    type,
                                    studentId: studentId || this.linkedStudent?.id,
                                    amount: verifyData.amount
                                });
                            } else {
                                this.showToast('El pago no pudo ser verificado con Mercado Pago.');
                            }
                        }
                    } catch (err) {
                        console.warn("Server payment verification failed:", err);
                    }
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch (e) {
                console.warn("Mercado Pago return check:", e);
            }
        },


        async processMercadoPagoApproval(opts = {}) {
            const studentId = opts.studentId || this.linkedStudent?.id;
            let targetStudent = this.students.find(s => s.id === studentId);
            if (!targetStudent && this.linkedStudent?.id === studentId) {
                targetStudent = this.linkedStudent;
            }
            if (!targetStudent) return;

            const type = opts.type || this.mpPaymentType || 'cuota';
            const amount = Number(opts.amount || this.mpPaymentAmount || (type === 'examen' ? this.getExamFeeForStudent(targetStudent) : this.calcStudentDebt(studentId)));
            if (amount <= 0) return;

            const dateObj = new Date();
            const displayDate = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
            const dayOfWeek = dateObj.toLocaleDateString('es-AR', { weekday: 'long' });
            const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

            if (type === 'cuota') {
                const prevDebt = Number(targetStudent.debt || 0);
                const newDebt = Math.max(0, prevDebt - amount);
                targetStudent.debt = newDebt;

                // FIFO a desglose mensual
                let remaining = amount;
                const entries = this.getStudentMonthlyDebts(targetStudent.id);
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

                try {
                    await this.supabase.from('tkd_students').update({ debt: newDebt }).eq('id', targetStudent.id);
                } catch (e) {}
            } else if (type === 'examen') {
                targetStudent.exam_paid = true;
                targetStudent.exam_paid_amount = amount;
                try {
                    await this.supabase.from('tkd_students').update({ exam_paid: true, exam_paid_amount: amount }).eq('id', targetStudent.id);
                } catch (e) {}
            }

            this.addMonthlyRevenue(amount);

            // Registrar transacción en el historial de cobros con método Transferencia (Mercado Pago)
            const tx = {
                id: opts.paymentId ? `mp-${opts.paymentId}` : this.createId(),
                studentId: targetStudent.id,
                studentName: targetStudent.name,
                amount: amount,
                type: type === 'examen' ? 'Derecho a Examen' : 'Cuota Mensual',
                rank: type === 'examen' ? this.getNextRank(targetStudent.rank) : null,
                method: 'transferencia',
                date: displayDate,
                dayOfWeek: dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1),
                month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                timestamp: Date.now(),
                source: 'Mercado Pago'
            };

            if (!Array.isArray(this.paymentHistory)) this.paymentHistory = [];
            this.paymentHistory.unshift(tx);

            await this.saveSettingsToDB();
            this.showMercadoPagoModal = false;
            this.triggerHaptic('success');
            this.showToast(`🎉 ¡Pago de ${this.formatMoney(amount)} acreditado por Mercado Pago!`);
            
            if (this.userRole === 'student') {
                await this.loadStudentPortalData();
            }
        },

        // --- AUTENTICACIÓN ---
        formatAuthError(msg) {
            if (!msg) return 'Error al procesar la solicitud.';
            const m = String(msg).toLowerCase();
            if (m.includes('anonymous sign-ins are disabled') || m.includes('missing email') || m.includes('cannot be empty')) {
                return 'Por favor ingresá tu email y contraseña.';
            }
            if (m.includes('invalid login credentials') || m.includes('invalid email or password')) {
                return 'Email o contraseña incorrectos.';
            }
            if (m.includes('email not confirmed')) {
                return 'Confirmá tu email antes de entrar (revisá tu casilla de correo).';
            }
            if (m.includes('user already registered') || m.includes('already exists')) {
                return 'Ya existe una cuenta con este email. Probá iniciando sesión.';
            }
            if (m.includes('password should be at least') || m.includes('password is too short')) {
                return 'La contraseña debe tener al menos 6 caracteres.';
            }
            if (m.includes('rate limit')) {
                return 'Demasiados intentos seguidos. Por favor esperá unos minutos.';
            }
            if (m.includes('unable to validate email address') || m.includes('invalid email')) {
                return 'El formato de email no es válido (ej: nombre@correo.com).';
            }
            return 'Verificá tus credenciales e intentá nuevamente.';
        },

        async signIn() {
            if (!this.supabase) return;
            this.authError = '';
            
            const email = (this.authEmail || '').trim();
            const pass = this.authPassword || '';

            if (!email) {
                this.authError = 'Por favor ingresá tu email.';
                return;
            }
            if (!pass) {
                this.authError = 'Por favor ingresá tu contraseña.';
                return;
            }

            this.authLoading = true;
            const { error } = await this.supabase.auth.signInWithPassword({ email, password: pass });
            this.authLoading = false;
            if (error) {
                this.authError = this.formatAuthError(error.message);
            }
        },

        async signUp() {
            if (!this.supabase) return;
            this.authError = '';

            const email = (this.authEmail || '').trim();
            const pass = this.authPassword || '';

            if (!email) {
                this.authError = 'Por favor ingresá un email para registrarte.';
                return;
            }
            if (!pass) {
                this.authError = 'Por favor ingresá una contraseña (mínimo 6 caracteres).';
                return;
            }
            if (pass.length < 6) {
                this.authError = 'La contraseña debe tener al menos 6 caracteres.';
                return;
            }

            this.authLoading = true;
            const { error } = await this.supabase.auth.signUp({ email, password: pass });
            this.authLoading = false;
            if (error) {
                this.authError = this.formatAuthError(error.message);
            } else {
                this.showToast('¡Cuenta creada! Iniciando sesión...');
                await this.signIn();
            }
        },

        async signOut() {
            if (this.supabase) await this.supabase.auth.signOut();
        },

        async sendPasswordReset() {
            if (!this.supabase) return;
            this.authError = '';
            const email = (this.authEmail || '').trim();
            if (!email) {
                this.authError = 'Por favor ingresá tu email para recuperar la contraseña.';
                return;
            }
            this.authLoading = true;
            try {
                const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin
                });
                this.authLoading = false;
                if (error) {
                    this.authError = this.formatAuthError(error.message);
                } else {
                    this.resetEmailSent = true;
                    this.showToast('¡Enlace de recuperación enviado! Revisá tu correo.');
                }
            } catch (e) {
                this.authLoading = false;
                this.authError = 'Error al enviar enlace de recuperación.';
            }
        },

        async updatePassword() {
            if (!this.supabase) return;
            this.authError = '';
            const newPass = (this.newPassword || '').trim();
            if (!newPass || newPass.length < 6) {
                this.authError = 'La nueva contraseña debe tener al menos 6 caracteres.';
                return;
            }
            this.authLoading = true;
            try {
                const { error } = await this.supabase.auth.updateUser({ password: newPass });
                this.authLoading = false;
                if (error) {
                    this.authError = this.formatAuthError(error.message);
                } else {
                    this.showUpdatePasswordModal = false;
                    this.newPassword = '';
                    this.showToast('¡Contraseña actualizada exitosamente!');
                }
            } catch (e) {
                this.authLoading = false;
                this.authError = 'Error al actualizar contraseña.';
            }
        },

        showInstallHelpModal: false,


        async startUserSession(user) {
            this.user = user;
            this.authError = '';
            
            // Si es el admin principal
            if (user.email === 'aandres.moreno3@gmail.com') {
                this.userRole = 'admin';
                await this.loadDataFromDB();
                if (this.isOnline) this.syncOfflineQueue();
                this.checkNewMonthBilling();
            } else {
                // Cualquier otra cuenta entra en el Portal de Alumno
                this.userRole = 'student';
                let profile = null;
                try {
                    const { data } = await this.supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .maybeSingle();
                    profile = data;
                } catch (e) {
                    console.warn("Profiles check fallback:", e);
                }

                if (!profile) {
                    profile = { id: user.id, role: 'alumno' };
                    try {
                        await this.supabase.from('profiles').upsert(profile);
                    } catch (e) {}
                }

                await this.loadStudentPortalData(profile);
            }

            // Sugerir instalación de App si no está instalada
            if (!this.isPWAInstalled && (this.deferredPrompt || globalDeferredPrompt || window.deferredInstallPrompt)) {
                this.showInstallBanner = true;
            }
        },

        async loadStudentPortalData(profile = null) {
            try {
                // Cargar lista de alumnos para vincular y refrescar
                const { data: allStudents } = await this.supabase.from('tkd_students').select('*');
                this.students = Array.isArray(allStudents) ? allStudents.map(s => ({
                    ...s,
                    dni: s.dni || '',
                    cuota_fija: !!s.cuota_fija,
                    exam_paid: !!s.exam_paid,
                    exam_paid_amount: Number(s.exam_paid_amount || 0),
                    debt: Number(s.debt || 0),
                    archived: !!s.archived
                })) : [];
                this.availableStudentsToLink = this.students.filter(s => !s.archived);

                let st = null;
                const savedStudentId = profile?.student_id || localStorage.getItem(`cmk-student-link-${this.user?.id}`) || this.linkedStudent?.id;
                
                if (savedStudentId) {
                    st = this.students.find(s => s.id === savedStudentId);
                    if (!st) {
                        const { data: singleSt } = await this.supabase.from('tkd_students').select('*').eq('id', savedStudentId).maybeSingle();
                        if (singleSt) {
                            st = singleSt;
                            this.students.push(singleSt);
                        }
                    }
                }

                if (st) {
                    this.linkedStudent = {
                        ...st,
                        dni: st.dni || '',
                        cuota_fija: !!st.cuota_fija,
                        exam_paid: !!st.exam_paid,
                        exam_paid_amount: Number(st.exam_paid_amount || 0),
                        debt: Number(st.debt || 0)
                    };
                    if (this.user?.id) localStorage.setItem(`cmk-student-link-${this.user?.id}`, st.id);
                }

                // Cargar ajustes, deudas y asistencias del alumno
                const { data: settingsRows } = await this.supabase.from('tkd_settings').select('*');
                if (settingsRows && settingsRows.length > 0 && settingsRows[0].user_id) {
                    this.adminUserId = settingsRows[0].user_id;
                }
                const settingsData = this.pickLatestSettingsRow(settingsRows || []);
                if (settingsData) {
                    if (settingsData.price_tiers) this.priceTiers = { ...this.priceTiers, ...settingsData.price_tiers };
                    if (settingsData.exam_tiers) this.examTiers = { ...this.examTiers, ...settingsData.exam_tiers };
                    if (Array.isArray(settingsData.schedules) && settingsData.schedules.length > 0) this.studentSchedules = settingsData.schedules;
                    if (settingsData.debt_details) this.debtDetails = settingsData.debt_details;
                    if (Array.isArray(settingsData.payment_history)) this.paymentHistory = settingsData.payment_history;
                    if (settingsData.classes) this.classes = Array.isArray(settingsData.classes) ? settingsData.classes : [];
                    if (settingsData.current_month) this.currentMonth = settingsData.current_month;

                    this.migrateExistingDebts();

                    if (st) {
                        const attendances = [];
                        const seenClassKeys = new Set();
                        const stNameLower = (st.name || '').trim().toLowerCase();
                        const stIdStr = String(st.id || '');

                        const checkAndAdd = (c, monthName, isCurrent) => {
                            if (!c) return;
                            const key = `${c.id || c.date}-${c.dayOfWeek || ''}-${monthName}`;
                            if (seenClassKeys.has(key)) return;

                            const matchedById = Array.isArray(c.attendeeIds) && c.attendeeIds.some(id => String(id) === stIdStr);
                            const matchedByName = Array.isArray(c.attendees) && c.attendees.some(name => String(name).trim().toLowerCase() === stNameLower);

                            if (matchedById || matchedByName) {
                                seenClassKeys.add(key);
                                attendances.push({
                                    date: c.date,
                                    day: c.dayOfWeek || 'Clase',
                                    month: monthName || 'Mes en curso',
                                    isCurrent: !!isCurrent
                                });
                            }
                        };

                        // 1. Clases del mes en curso
                        if (Array.isArray(this.classes)) {
                            this.classes.forEach(c => checkAndAdd(c, this.currentMonth || 'Mes en curso', true));
                        }

                        // 2. Clases históricas
                        if (settingsData.history_data) {
                            const history = this.normalizeHistoryData(settingsData.history_data);
                            history.forEach(m => {
                                if (Array.isArray(m.classes)) {
                                    m.classes.forEach(c => checkAndAdd(c, m.name, false));
                                }
                            });
                        }
                        this.studentAttendanceDates = attendances;
                    }
                }
            } catch (err) {
                console.error("Error loading student portal data:", err);
            }
        },

        async linkStudentByDni(dniInput) {
            this.linkByDniError = '';
            const cleanDni = String(dniInput || '').replace(/\D/g, '').trim();
            if (!cleanDni || cleanDni.length < 6) {
                this.linkByDniError = 'Por favor ingresá un número de DNI válido (mínimo 6 dígitos).';
                return;
            }

            this.linkByDniLoading = true;
            try {
                // 1. Buscar en la lista activa o consultar Supabase directamente
                let st = this.availableStudentsToLink.find(s => {
                    const studentDni = String(s.dni || '').replace(/\D/g, '').trim();
                    return studentDni === cleanDni;
                });

                if (!st && this.supabase) {
                    const { data, error } = await this.supabase
                        .from('tkd_students')
                        .select('*')
                        .eq('dni', cleanDni)
                        .limit(1);

                    if (data && data.length > 0) {
                        st = data[0];
                    }
                }

                if (!st) {
                    this.linkByDniError = 'No encontramos ningún alumno registrado con el DNI ingresado. Verificá los números o pedile a tu profesor que registre tu ficha.';
                    this.linkByDniLoading = false;
                    return;
                }

                // 2. Guardar vinculación
                this.linkedStudent = st;
                if (this.user?.id) {
                    localStorage.setItem(`cmk-student-link-${this.user.id}`, st.id);
                    try {
                        await this.supabase.from('profiles').upsert({
                            id: this.user.id,
                            role: 'alumno',
                            student_id: st.id
                        });
                    } catch (e) {
                        console.warn("Could not persist student_id:", e);
                    }
                }

                this.showToast(`🥋 ¡Hola ${st.name}! Cuenta vinculada con éxito.`);
                await this.loadStudentPortalData({ student_id: st.id });
            } catch (err) {
                console.error("Error linking student by DNI:", err);
                this.linkByDniError = 'Ocurrió un error al verificar tu DNI. Intentá nuevamente.';
            } finally {
                this.linkByDniLoading = false;
            }
        },

        // --- GESTIÓN DE PERFIL PROPIO (ALUMNO) ---
        openStudentSelfProfile() {
            if (!this.linkedStudent) {
                const savedStudentId = localStorage.getItem(`cmk-student-link-${this.user?.id}`);
                if (savedStudentId) {
                    this.linkedStudent = this.availableStudentsToLink?.find(s => s.id === savedStudentId) || this.students?.find(s => s.id === savedStudentId) || null;
                }
            }
            if (!this.linkedStudent) {
                this.showToast('Primero identificá tu DNI para vincular tu perfil.');
                return;
            }
            this.studentProfileForm = {
                name: this.linkedStudent.name || '',
                rank: this.linkedStudent.rank || 'Blanco',
                dni: this.linkedStudent.dni || '',
                phone: this.linkedStudent.phone || '',
                dob: this.linkedStudent.dob || '',
                location: this.linkedStudent.location || ''
            };
            this.showStudentProfileModal = true;
        },

        async saveStudentSelfProfile() {
            if (!this.linkedStudent) return;
            const cleanDni = (this.studentProfileForm.dni || '').trim();
            const cleanPhone = (this.studentProfileForm.phone || '').trim();
            const cleanDob = (this.studentProfileForm.dob || '').trim();
            const cleanLocation = (this.studentProfileForm.location || '').trim();

            this.linkedStudent.dni = cleanDni;
            this.linkedStudent.phone = cleanPhone;
            this.linkedStudent.dob = cleanDob;
            this.linkedStudent.location = cleanLocation;

            try {
                if (this.supabase) {
                    await this.supabase
                        .from('tkd_students')
                        .update({
                            dni: cleanDni,
                            phone: cleanPhone,
                            dob: cleanDob || null,
                            location: cleanLocation
                        })
                        .eq('id', this.linkedStudent.id);
                }

                // Sincronizar en array local
                const idx = this.students.findIndex(s => s.id === this.linkedStudent.id);
                if (idx !== -1) {
                    this.students[idx] = { ...this.students[idx], ...this.linkedStudent };
                }

                this.showStudentProfileModal = false;
                this.triggerHaptic('success');
                this.showToast('✅ ¡Tus datos personales se actualizaron correctamente!');
            } catch (err) {
                console.error("Error saving personal data:", err);
                this.showToast('Error al guardar datos personales.');
            }
        },

        // --- INSTALACIÓN PWA ---
        async installPWA() {
            const promptEvent = this.deferredPrompt || globalDeferredPrompt || window.deferredInstallPrompt;
            if (promptEvent) {
                try {
                    promptEvent.prompt();
                    const choiceResult = await promptEvent.userChoice;
                    if (choiceResult && choiceResult.outcome === 'accepted') {
                        this.isPWAInstalled = true;
                        this.showInstallBanner = false;
                        localStorage.setItem('cmk-pwa-installed', 'true');
                        this.showToast('🥋 ¡Gracias por instalar la app de Taekwondo CMK!');
                    }
                    this.deferredPrompt = null;
                    globalDeferredPrompt = null;
                    window.deferredInstallPrompt = null;
                } catch (err) {
                    console.warn('PWA prompt error:', err);
                    this.showInstallHelpModal = true;
                }
            } else {
                this.showInstallHelpModal = true;
            }
        },

        openPartialPaymentModal() {
            if (!this.linkedStudent) {
                this.showToast('No tenés un perfil vinculado. Avisale al profe.');
                return;
            }
            const currentDebt = this.calcStudentDebt(this.linkedStudent.id);
            if (currentDebt <= 0) {
                this.showToast('¡No tenés saldo pendiente para abonar!');
                return;
            }
            this.partialPayAmount = Math.round(currentDebt / 2) || 5000;
            this.showPartialPayModal = true;
        },

        closePartialPaymentModal() {
            this.showPartialPayModal = false;
        },

        async payWithMercadoPago(type = 'cuota', customAmount = null) {
            if (!this.linkedStudent) {
                this.showToast('No tenés un perfil vinculado. Avisale al profe.');
                return;
            }
            this.mpPaymentType = type;
            const maxDebt = this.calcStudentDebt(this.linkedStudent.id);

            if (customAmount !== null && customAmount !== undefined) {
                const numCustom = Number(customAmount);
                if (isNaN(numCustom) || numCustom <= 0) {
                    this.showToast('Por favor ingresá un monto válido.');
                    return;
                }
                this.mpPaymentAmount = numCustom;
            } else {
                this.mpPaymentAmount = type === 'examen' 
                    ? this.getExamFeeForStudent(this.linkedStudent) 
                    : maxDebt;
            }

            if (this.mpPaymentAmount <= 0) {
                this.showToast('¡No tenés saldo pendiente para abonar!');
                return;
            }

            this.showPartialPayModal = false;
            this.mpLoading = true;
            try {
                const reqPayload = {
                    student_id: this.linkedStudent.id,
                    student_name: this.linkedStudent.name,
                    amount: this.mpPaymentAmount,
                    type: type,
                    origin_url: window.location.origin
                };

                let res = await fetch('/api/create-preference', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reqPayload)
                }).catch(() => null);

                if (!res || !res.ok) {
                    res = await fetch('/.netlify/functions/create-preference', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(reqPayload)
                    }).catch(() => null);
                }

                if (res && res.ok) {
                    const data = await res.json();
                    if (data?.init_point) {
                        this.showToast('🥋 Redirigiendo a Mercado Pago...');
                        window.location.assign(data.init_point);
                        return;
                    }
                } else if (res) {
                    const errData = await res.json().catch(() => ({}));
                    console.error("Function Error:", res.status, errData);
                }

                if (this.supabase?.functions) {
                    const { data, error } = await this.supabase.functions.invoke('create-mp-preference', {
                        body: {
                            student_id: this.linkedStudent.id,
                            student_name: this.linkedStudent.name,
                            amount: this.mpPaymentAmount,
                            type: type
                        }
                    });
                    if (!error && data?.init_point) {
                        this.showToast('🥋 Redirigiendo a Mercado Pago...');
                        window.location.assign(data.init_point);
                        return;
                    }
                }

                this.showMercadoPagoModal = true;
            } catch (err) {
                console.error("Payment error:", err);
                this.showMercadoPagoModal = true;
            } finally {
                this.mpLoading = false;
            }
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

                    // Cargar valores de examen escalonados
                    if (settingsData.exam_tiers && typeof settingsData.exam_tiers === 'object') {
                        this.examTiers = {
                            amarillos: Number(settingsData.exam_tiers.amarillos) || 12000,
                            azules: Number(settingsData.exam_tiers.azules) || 15000,
                            rojos: Number(settingsData.exam_tiers.rojos) || 18000,
                            negros: Number(settingsData.exam_tiers.negros) || 25000
                        };
                    }

                    // Cargar horarios de clases
                    if (Array.isArray(settingsData.schedules) && settingsData.schedules.length > 0) {
                        this.studentSchedules = settingsData.schedules;
                    }

                    // Sincronizar copias de edición con los datos cargados
                    this.editTiers = { ...this.priceTiers };
                    this.editExamTiers = { ...this.examTiers };
                    this.editSchedules = JSON.parse(JSON.stringify(this.studentSchedules || []));

                    // Cargar historial de pagos
                    if (Array.isArray(settingsData.payment_history)) {
                        this.paymentHistory = settingsData.payment_history;
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
                const cachedExamTiers = localStorage.getItem('cmk-cache-exam-tiers');
                if (cachedExamTiers) this.examTiers = JSON.parse(cachedExamTiers);
                const cachedSchedules = localStorage.getItem('cmk-cache-schedules');
                if (cachedSchedules) this.studentSchedules = JSON.parse(cachedSchedules);
                const cachedPayments = localStorage.getItem('cmk-cache-payments');
                if (cachedPayments) this.paymentHistory = JSON.parse(cachedPayments);
                const cachedDebts = localStorage.getItem('cmk-cache-debts');
                if (cachedDebts) this.debtDetails = JSON.parse(cachedDebts);
            } catch(e) {}
        },

        updateLocalCache() {
            localStorage.setItem('cmk-cache-students', JSON.stringify(this.students));
            localStorage.setItem('cmk-cache-history', JSON.stringify(this.historyData));
            localStorage.setItem('cmk-cache-tiers', JSON.stringify(this.priceTiers));
            localStorage.setItem('cmk-cache-exam-tiers', JSON.stringify(this.examTiers));
            localStorage.setItem('cmk-cache-schedules', JSON.stringify(this.studentSchedules));
            localStorage.setItem('cmk-cache-payments', JSON.stringify(this.paymentHistory));
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
            if (rows.length === 1) return this.unwrapSettingsMeta(rows[0]);

            const rowTime = (row) => {
                const updated = Date.parse(row?.updated_at || '');
                if (!Number.isNaN(updated)) return updated;
                const created = Date.parse(row?.created_at || '');
                if (!Number.isNaN(created)) return created;
                return -1;
            };

            const withTime = rows.filter(r => rowTime(r) >= 0);
            const bestRow = withTime.length > 0
                ? withTime.reduce((best, row) => rowTime(row) > rowTime(best) ? row : best, withTime[0])
                : rows.reduce((best, row) => {
                    const bestHistory = Array.isArray(best?.history_data) ? best.history_data.length : 0;
                    const rowHistory = Array.isArray(row?.history_data) ? row.history_data.length : 0;
                    if (rowHistory > bestHistory) return row;
                    if (Number(row?.revenue || 0) > Number(best?.revenue || 0)) return row;
                    return best;
                }, rows[0]);

            return this.unwrapSettingsMeta(bestRow);
        },

        unwrapSettingsMeta(row) {
            if (!row) return null;
            const res = { ...row };
            // Extraer metadatos resilientes de history_data si están presentes
            const meta = Array.isArray(res.history_data) && res.history_data[0]?._cmk_meta ? res.history_data[0]._cmk_meta : null;
            if (meta) {
                if (!res.price_tiers && meta.price_tiers) res.price_tiers = meta.price_tiers;
                if (!res.exam_tiers && meta.exam_tiers) res.exam_tiers = meta.exam_tiers;
                if (!res.schedules && meta.schedules) res.schedules = meta.schedules;
                if (!res.debt_details && meta.debt_details) res.debt_details = meta.debt_details;
                if (!res.payment_history && meta.payment_history) res.payment_history = meta.payment_history;
            }
            return res;
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
                    dayOfWeek: current.dayOfWeek || clase?.dayOfWeek || 'Clase',
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

            const historyCopy = Array.isArray(this.historyData) ? JSON.parse(JSON.stringify(this.historyData)) : [];
            if (historyCopy.length === 0) historyCopy.push({ id: 'cmk-meta', name: 'Ajustes', open: false, classes: [] });
            historyCopy[0]._cmk_meta = {
                price_tiers: this.priceTiers,
                debt_details: this.debtDetails,
                exam_tiers: this.examTiers,
                schedules: this.studentSchedules,
                payment_history: this.paymentHistory
            };

            const targetUserId = (this.userRole === 'student' && this.adminUserId) ? this.adminUserId : this.user.id;

            const payload = {
                user_id: targetUserId,
                revenue: 0,
                history_data: historyCopy,
                last_billed: this.lastBilled,
                price_tiers: this.priceTiers,
                debt_details: this.debtDetails,
                exam_tiers: this.examTiers,
                schedules: this.studentSchedules,
                payment_history: this.paymentHistory
            };

            const { data: updatedRows, error: updateError } = await this.supabase
                .from('tkd_settings')
                .update(payload)
                .eq('user_id', targetUserId)
                .select('user_id');
            
            if (updateError) {
                // Fallback si alguna columna no existe aún en Supabase: guardamos en history_data
                const simplifiedPayload = {
                    user_id: targetUserId,
                    revenue: 0,
                    history_data: historyCopy,
                    last_billed: this.lastBilled
                };
                const retryRes = await this.supabase
                    .from('tkd_settings')
                    .update(simplifiedPayload)
                    .eq('user_id', targetUserId)
                    .select('user_id');
                
                if (retryRes.error || !retryRes.data?.length) {
                    await this.supabase.from('tkd_settings').insert(simplifiedPayload);
                }
            } else if (!updatedRows || updatedRows.length === 0) {
                const { error: insertError } = await this.supabase.from('tkd_settings').insert(payload);
                if (insertError) {
                    await this.supabase.from('tkd_settings').insert({
                        user_id: targetUserId,
                        revenue: 0,
                        history_data: historyCopy,
                        last_billed: this.lastBilled
                    });
                }
            }
            return true;
        },

        getExamFeeForStudent(student) {
            if (!student) return Number(this.examTiers?.amarillos || 12000);
            const nextRank = (this.getNextRank(student.rank) || '').toLowerCase();
            if (nextRank.includes('amarillo')) return Number(this.examTiers?.amarillos || 12000);
            if (nextRank.includes('azul')) return Number(this.examTiers?.azules || 15000);
            if (nextRank.includes('rojo')) return Number(this.examTiers?.rojos || 18000);
            if (nextRank.includes('negro') || nextRank.includes('dan')) return Number(this.examTiers?.negros || 25000);
            return Number(this.examTiers?.amarillos || 12000);
        },

        openSettingsModal() {
            this.editTiers = {
                tier1: Number(this.priceTiers?.tier1) || 12500,
                tier2: Number(this.priceTiers?.tier2) || 15000,
                tier3: Number(this.priceTiers?.tier3) || 18000
            };
            this.editExamTiers = {
                amarillos: Number(this.examTiers?.amarillos) || 12000,
                azules: Number(this.examTiers?.azules) || 15000,
                rojos: Number(this.examTiers?.rojos) || 18000,
                negros: Number(this.examTiers?.negros) || 25000
            };
            this.editSchedules = JSON.parse(JSON.stringify(this.studentSchedules || []));
            this.settingsTab = 'tuition';
            this.showSettingsModal = true;
        },

        addScheduleRow() {
            this.editSchedules.push({ day: 'Sábado', time: '10:00 - 11:30', location: 'Dojo Principal' });
        },

        removeScheduleRow(index) {
            this.editSchedules.splice(index, 1);
        },

        async saveSettings() {
            this.priceTiers = {
                tier1: Number(this.editTiers.tier1) || 12500,
                tier2: Number(this.editTiers.tier2) || 15000,
                tier3: Number(this.editTiers.tier3) || 18000,
                lastApplied: Number(this.priceTiers.lastApplied) || 1
            };
            this.examTiers = {
                amarillos: Number(this.editExamTiers.amarillos) || 12000,
                azules: Number(this.editExamTiers.azules) || 15000,
                rojos: Number(this.editExamTiers.rojos) || 18000,
                negros: Number(this.editExamTiers.negros) || 25000
            };
            this.studentSchedules = JSON.parse(JSON.stringify(this.editSchedules));
            this.editTiers = { ...this.priceTiers };
            this.editExamTiers = { ...this.examTiers };
            
            this.updateLocalCache();
            const ok = await this.saveSettingsToDB(true);
            if (ok) {
                this.showSettingsModal = false;
                this.triggerHaptic('success');
                this.showToast('Ajustes y valores de examen guardados correctamente');
            }
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

        // --- RECAUDACIÓN MENSUAL ---
        getCurrentMonthRevenue() {
            try {
                const dateObj = new Date();
                const currentMonthIdx = dateObj.getMonth();
                const currentYear = dateObj.getFullYear();
                const currentMonthName = dateObj.toLocaleDateString('es-AR', { month: 'long' }).toLowerCase();

                let total = 0;

                // 1. Buscar en historyData (caja por mes)
                const historyArray = Array.isArray(this.historyData) ? this.historyData : [];
                const monthGroup = historyArray.find(m => {
                    if (!m || typeof m.name !== 'string') return false;
                    const nameLower = m.name.toLowerCase();
                    return nameLower.includes(currentMonthName) || (nameLower.includes(String(currentYear)) && nameLower.includes(currentMonthName.slice(0, 4)));
                });

                if (monthGroup && typeof monthGroup.revenue === 'number' && monthGroup.revenue > 0) {
                    total = monthGroup.revenue;
                }

                // 2. Si historyData es 0 o hay transacciones en paymentHistory del mes actual
                if (total === 0 && Array.isArray(this.paymentHistory)) {
                    this.paymentHistory.forEach(tx => {
                        if (!tx) return;
                        const txDate = tx.timestamp ? new Date(tx.timestamp) : null;
                        if (txDate && txDate.getMonth() === currentMonthIdx && txDate.getFullYear() === currentYear) {
                            total += Number(tx.amount || 0);
                        } else if (tx.month && tx.month.toLowerCase().includes(currentMonthName)) {
                            total += Number(tx.amount || 0);
                        }
                    });
                }

                return total;
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
            if (!studentId) return [];
            const s = this.students.find(st => st.id === studentId) || (this.linkedStudent?.id === studentId ? this.linkedStudent : null) || this.availableStudentsToLink?.find(st => st.id === studentId);
            const actualDebt = Number(s?.debt || 0);

            let entries = Array.isArray(this.debtDetails[studentId]) ? this.debtDetails[studentId] : [];

            // Si el alumno tiene deuda en la base de datos pero todas las entradas de debtDetails están marcadas como pagadas o vacías
            const unpaidTotal = entries.filter(d => !d.paid && Number(d.amount || 0) > 0).reduce((sum, d) => sum + Number(d.amount || 0), 0);

            if (actualDebt > 0 && unpaidTotal === 0) {
                // Hay inconsistencia: el alumno debe en BD pero debtDetails decía pagado. Reconciliar al monto real de BD
                entries = [{
                    month: 'legacy',
                    label: 'Cuota Pendiente',
                    amount: actualDebt,
                    paid: false
                }];
                this.debtDetails[studentId] = entries;
            } else if (actualDebt === 0 && unpaidTotal > 0) {
                // Alumno está al día en BD
                entries.forEach(e => e.paid = true);
            } else if (entries.length === 0 && actualDebt > 0) {
                entries = [{
                    month: 'legacy',
                    label: 'Cuota Pendiente',
                    amount: actualDebt,
                    paid: false
                }];
                this.debtDetails[studentId] = entries;
            }

            return entries;
        },

        getUnpaidMonths(studentId) {
            if (!studentId) return [];
            return this.getStudentMonthlyDebts(studentId).filter(d => !d.paid && Number(d.amount || 0) > 0);
        },

        getPaidMonths(studentId) {
            if (!studentId) return [];
            return this.getStudentMonthlyDebts(studentId).filter(d => d.paid);
        },

        calcStudentDebt(studentId) {
            if (!studentId) return 0;
            const unpaidEntries = this.getUnpaidMonths(studentId);
            const unpaidTotal = unpaidEntries.reduce((sum, d) => sum + Number(d.amount || 0), 0);
            if (unpaidTotal === 0) {
                const s = this.students.find(st => st.id === studentId) || (this.linkedStudent?.id === studentId ? this.linkedStudent : null) || this.availableStudentsToLink?.find(st => st.id === studentId);
                if (s && Number(s.debt || 0) > 0) return Number(s.debt);
            }
            return unpaidTotal;
        },

        // --- SISTEMA DE TEMAS (LIGHT / DARK / SYSTEM) ---
        applyTheme() {
            let isDark = false;
            const mode = this.themeMode || 'light';
            this.theme = mode;
            if (mode === 'dark') isDark = true;
            else if (mode === 'system') isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            
            document.documentElement.classList.toggle('dark', isDark);
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', isDark ? '#0f172a' : '#ffffff');
            localStorage.setItem('cmk-theme', mode);
        },

        setTheme(mode) {
            this.themeMode = mode;
            this.applyTheme();
        },

        toggleTheme() {
            const isDark = document.documentElement.classList.contains('dark');
            const next = isDark ? 'light' : 'dark';
            this.themeMode = next;
            this.applyTheme();
            this.showToast(`Modo ${next === 'dark' ? 'Oscuro' : 'Claro'} activado`);
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
            const studentsToCheck = [...(this.students || [])];
            if (this.linkedStudent && !studentsToCheck.some(s => s.id === this.linkedStudent.id)) {
                studentsToCheck.push(this.linkedStudent);
            }
            for (let s of studentsToCheck) {
                const currentDebt = Number(s.debt || 0);
                const existingEntries = Array.isArray(this.debtDetails[s.id]) ? this.debtDetails[s.id] : [];
                const unpaidSum = existingEntries.filter(d => !d.paid && Number(d.amount || 0) > 0).reduce((sum, d) => sum + Number(d.amount || 0), 0);
                
                if (currentDebt > 0 && unpaidSum === 0) {
                    this.debtDetails[s.id] = [{
                        month: 'legacy',
                        label: 'Cuota Pendiente',
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

            let rawPhone = String(student.phone).replace(/\D/g, '');
            // Normalizar formato celular Argentina: 549 + código de área + número
            if (rawPhone.startsWith('0')) rawPhone = rawPhone.slice(1);
            if (rawPhone.startsWith('15') && rawPhone.length === 10) rawPhone = '11' + rawPhone.slice(2);
            if (rawPhone.length === 10) rawPhone = '549' + rawPhone;
            else if (rawPhone.length === 11 && rawPhone.startsWith('54')) rawPhone = '549' + rawPhone.slice(2);
            else if (!rawPhone.startsWith('54') && rawPhone.length >= 8) rawPhone = '549' + rawPhone;

            const firstName = (student.name || '').trim().split(' ')[0];
            const lines = unpaid.map(d => `• ${d.label}: ${this.formatMoney(d.amount)}`);
            const total = unpaid.reduce((sum, d) => sum + Number(d.amount || 0), 0);

            const msg = `🥋 *Taekwondo Chang Moo Kwan*\n\n`
                + `Hola ${firstName}! Te paso el detalle de tus cuotas pendientes:\n\n`
                + lines.join('\n') + `\n\n`
                + `*Total a abonar:* ${this.formatMoney(total)}\n\n`
                + `¡Muchas gracias! 🙏🥋`;

            return 'https://wa.me/' + rawPhone + '?text=' + encodeURIComponent(msg);
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
            this.paymentMethod = 'efectivo';
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

            // Aplicar pago FIFO a desglose mensual y registrar qué meses se cubrieron
            let remaining = amount;
            const entries = this.getStudentMonthlyDebts(this.paymentStudent.id);
            const affectedMonths = [];
            let hadPartial = false;

            for (let entry of entries) {
                if (entry.paid || remaining <= 0) continue;
                const prevEntryAmount = Number(entry.amount || 0);
                const monthLabel = entry.label || this.getMonthLabel(entry.month);

                if (remaining >= prevEntryAmount) {
                    remaining -= prevEntryAmount;
                    entry.paid = true;
                    entry.paidAmount = (entry.paidAmount || 0) + prevEntryAmount;
                    affectedMonths.push(monthLabel);
                } else {
                    entry.amount = prevEntryAmount - remaining;
                    entry.paidAmount = (entry.paidAmount || 0) + remaining;
                    hadPartial = true;
                    affectedMonths.push(`${monthLabel} (Parcial)`);
                    remaining = 0;
                }
            }
            this.debtDetails = { ...this.debtDetails };

            this.addMonthlyRevenue(amount);

            // Registrar transacción en el historial de cobros con fecha, día, método y mes exacto
            const dateObj = new Date();
            const displayDate = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
            const dayOfWeek = dateObj.toLocaleDateString('es-AR', { weekday: 'long' });
            const currentMonthName = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            const currentMonthCapitalized = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

            let typeLabel = 'Cuota Mensual';
            if (affectedMonths.length > 0) {
                typeLabel = hadPartial ? `Pago Parcial - ${affectedMonths.join(', ')}` : `Cuota ${affectedMonths.join(', ')}`;
            } else {
                typeLabel = `Cuota ${currentMonthCapitalized}`;
            }

            const tx = {
                id: this.createId(),
                studentId: this.paymentStudent.id,
                studentName: this.paymentStudent.name,
                amount: amount,
                type: typeLabel,
                concept: typeLabel,
                method: this.paymentMethod || 'efectivo',
                date: displayDate,
                dayOfWeek: dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1),
                month: currentMonthCapitalized,
                timestamp: Date.now()
            };
            if (!Array.isArray(this.paymentHistory)) this.paymentHistory = [];
            this.paymentHistory.unshift(tx);

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
            const currentMonthIdx = dateObj.getMonth();
            const currentYear = dateObj.getFullYear();
            const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            const currentMonthNameLower = dateObj.toLocaleDateString('es-AR', { month: 'long' }).toLowerCase();
            let monthGroup = this.historyData.find(m => m.name.toLowerCase() === monthName.toLowerCase());
            
            if (!monthGroup) return;
            
            const previousRevenue = Number(monthGroup.revenue || 0);
            const previousPaymentHistory = Array.isArray(this.paymentHistory) ? [...this.paymentHistory] : [];
            monthGroup.revenue = 0;
            this.historyData = [...this.historyData];

            // Limpiar transacciones del mes actual del historial de cobros
            if (Array.isArray(this.paymentHistory)) {
                this.paymentHistory = this.paymentHistory.filter(tx => {
                    if (!tx) return true;
                    const txDate = tx.timestamp ? new Date(tx.timestamp) : null;
                    if (txDate && txDate.getMonth() === currentMonthIdx && txDate.getFullYear() === currentYear) return false;
                    if (tx.month && tx.month.toLowerCase().includes(currentMonthNameLower)) return false;
                    return true;
                });
            }
            
            this.confirmReset = false;
            const saved = await this.saveSettingsToDB();
            if (!saved) {
                monthGroup.revenue = previousRevenue;
                this.paymentHistory = previousPaymentHistory;
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
            setTimeout(() => {
                if (!this.showProfileModal) {
                    this.activeStudent = null;
                }
            }, 350);
        },

        openEditModal(student = null) {
            this.showProfileModal = false;
            const baseAmount = Number(this.priceTiers.tier1) || 15000;
            if (student) {
                this.isEditing = true;
                this.form = { 
                    ...student, 
                    dni: student.dni || '', 
                    tuition: student.tuition ? Number(student.tuition) : baseAmount,
                    cuota_fija: !!student.cuota_fija 
                };
            } else {
                this.isEditing = false;
                this.form = { id: this.createId(), name: '', dob: '', rank: 'Blanco', tuition: baseAmount, debt: baseAmount, phone: '', location: '', dni: '', cuota_fija: false, exam_paid: false, exam_paid_amount: 0 };
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
            this.examPaymentAmount = this.getExamFeeForStudent(student);
            this.paymentMethod = 'efectivo';
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

            // Registrar transacción de examen en el historial de cobros
            const dateObj = new Date();
            const displayDate = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
            const dayOfWeek = dateObj.toLocaleDateString('es-AR', { weekday: 'long' });
            const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

            const tx = {
                id: this.createId(),
                studentId: this.examPaymentStudent.id,
                studentName: this.examPaymentStudent.name,
                amount: amount,
                type: 'Derecho a Examen',
                rank: this.getNextRank(this.examPaymentStudent.rank),
                method: this.paymentMethod || 'efectivo',
                date: displayDate,
                dayOfWeek: dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1),
                month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                timestamp: Date.now()
            };
            if (!Array.isArray(this.paymentHistory)) this.paymentHistory = [];
            this.paymentHistory.unshift(tx);
            
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
    };
}

// Registro global seguro en window y en Alpine
window.tkdApp = tkdApp;
if (window.Alpine) {
    window.Alpine.data('tkdApp', tkdApp);
} else {
    document.addEventListener('alpine:init', () => {
        window.Alpine.data('tkdApp', tkdApp);
    });
}

// --- Registro del Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
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

