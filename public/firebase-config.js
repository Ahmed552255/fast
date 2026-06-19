/**
 * ============================================================
 * Fast Sokon - إعدادات Firebase المركزية
 * ============================================================
 * 
 * هذا الملف يحتوي على إعدادات الاتصال بقاعدة بيانات Firebase.
 * يتم استيراده في جميع صفحات التطبيق لضمان الاتساق وسهولة الصيانة.
 * 
 * ✅ الميزة الجديدة: مزامنة تلقائية للفواتير المحلية كل 16 ثانية
 * 🔄 يتبع نظام التخزين في صفحة المراجعة (IndexedDB + localStorage)
 * 📅 الفواتير تُرفع بتاريخ وقت الرفع السحابي (serverTimestamp)
 * 
 * @version 2.3.0
 * @lastUpdate 2026-06-18
 * @project i-excelled
 */

// ==================== بيئة التشغيل ====================
const ENV = {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production'
};

// اختر البيئة المناسبة (يمكن تعديلها حسب مرحلة النشر)
const CURRENT_ENV = ENV.DEVELOPMENT;

// ==================== إعدادات Firebase للمشروع ====================

/**
 * إعدادات المشروع الموحدة (Development & Production)
 * 
 * 🔐 Project: i-excelled
 * 📧 Auth Domain: i-excelled.firebaseapp.com
 * 🗄️ Database: i-excelled-default-rtdb.firebaseio.com
 */
const firebaseConfig = {
    // أساسيات الاتصال
    apiKey: "AIzaSyDosyySkPDI-uCQzHOk7jTDUFp2U2jQAzo",
    authDomain: "i-excelled.firebaseapp.com",
    databaseURL: "https://i-excelled-default-rtdb.firebaseio.com",
    projectId: "i-excelled",
    storageBucket: "i-excelled.firebasestorage.app",
    messagingSenderId: "872523261091",
    appId: "1:872523261091:web:0d8bb389f377752cb84b16",
    measurementId: "G-DLN1FG2Y4D",
    
    // ==================== إعدادات إضافية ====================
    
    // معلومات التطبيق
    appName: 'Fast Sokon',
    version: '2.3.0',
    
    // إعدادات Realtime Database
    database: {
        paths: {
            users: 'users',
            invoices: 'invoices',
            profile: 'profile',
            health: 'health'
        }
    },
    
    // إعدادات Firestore
    firestore: {
        collections: {
            users: 'users',
            invoices: 'invoices'
        }
    },
    
    // إعدادات المصادقة
    auth: {
        providers: ['password', 'google'],
        persistence: 'local',
        tenantId: null
    },
    
    // إعدادات التخزين المؤقت
    cache: {
        enabled: true,
        maxAge: 5 * 60 * 1000, // 5 دقائق
        maxEntries: 100
    },
    
    // ==================== إعدادات المزامنة التلقائية ====================
    sync: {
        enabled: true,                    // تفعيل المزامنة التلقائية
        interval: 16000,                  // كل 16 ثانية
        retryOnFailure: true,             // إعادة المحاولة عند الفشل
        maxRetries: 3,                    // الحد الأقصى للمحاولات
        retryDelay: 5000,                 // تأخير بين المحاولات (5 ثواني)
        batchSize: 10,                    // عدد الفواتير في الدفعة الواحدة
        deleteAfterSync: true,            // حذف من المحلي بعد الرفع الناجح
        requireAuth: true,                // يتطلب تسجيل الدخول للمزامنة
        syncOnConnect: true,              // مزامنة فورية عند استعادة الاتصال
        useServerTimestamp: true,         // ✅ استخدام توقيت الخادم كتاريخ للفاتورة
        debug: CURRENT_ENV === 'development' // تفعيل سجلات التصحيح في بيئة التطوير
    },
    
    // إعدادات الأمان
    security: {
        maxInvoiceItems: 500,
        maxInvoiceTotal: 1000000,
        maxImageSize: 20 * 1024 * 1024, // 20 ميجابايت
        sessionTimeout: 30 * 60 * 1000 // 30 دقيقة
    }
};

// ==================== نظام المزامنة التلقائية ====================

/**
 * نظام مزامنة الفواتير المحلية مع السحابة
 * يراقب التخزين المحلي كل 16 ثانية ويرفع الفواتير الجديدة
 * 
 * 🔄 يتبع نظام التخزين في صفحة المراجعة:
 * - IndexedDB: FastSokonLocalDB
 * - localStorage: fast_sokon_invoices
 * - localStorage: last_valid_state
 * - localStorage: crash_recovery
 * 
 * 📅 الفواتير تُرفع بتاريخ وقت الرفع السحابي (serverTimestamp)
 */
class LocalToCloudSync {
    constructor(config) {
        this.config = config;
        this.syncInterval = null;
        this.isSyncing = false;
        this.syncStats = {
            total: 0,
            success: 0,
            failed: 0,
            pending: 0,
            lastSync: null,
            lastError: null
        };
        this.retryQueue = [];
        this.listeners = [];
        
        // بدء المراقبة التلقائية إذا كانت مفعلة
        if (this.config.sync?.enabled) {
            this.startAutoSync();
        }
        
        // مراقبة استعادة الاتصال
        if (this.config.sync?.syncOnConnect) {
            this.listenForReconnection();
        }
        
        console.log('🔄 LocalToCloudSync initialized - interval:', this.config.sync?.interval || 16000, 'ms');
        console.log('📦 Following Page Review storage system (IndexedDB + localStorage)');
        console.log('📅 Using server timestamp for invoice dates');
    }

    /**
     * بدء المزامنة التلقائية
     */
    startAutoSync() {
        if (this.syncInterval) {
            console.warn('⚠️ Auto-sync already running');
            return;
        }
        
        const interval = this.config.sync?.interval || 16000;
        
        // تشغيل أول مزامنة بعد 3 ثواني (لإعطاء وقت لتحميل الصفحة)
        setTimeout(() => {
            this.syncNow();
        }, 3000);
        
        // ثم كل 16 ثانية
        this.syncInterval = setInterval(() => {
            this.syncNow();
        }, interval);
        
        console.log(`🔄 Auto-sync started (every ${interval / 1000}s)`);
    }

    /**
     * إيقاف المزامنة التلقائية
     */
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('⏸️ Auto-sync stopped');
        }
    }

    /**
     * الاستماع لاستعادة الاتصال بالإنترنت
     */
    listenForReconnection() {
        if (typeof window === 'undefined') return;
        
        window.addEventListener('online', () => {
            console.log('🌐 اتصال الإنترنت استعاد - بدء المزامنة الفورية');
            this.syncNow();
        });
    }

    /**
     * التحقق من وجود مستخدم مسجل الدخول
     */
    getCurrentUser() {
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                return firebase.auth().currentUser;
            }
        } catch (e) {
            console.warn('⚠️ Cannot check auth state:', e.message);
        }
        return null;
    }

    /**
     * التحقق من وجود Firestore
     */
    getFirestore() {
        try {
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                return firebase.firestore();
            }
        } catch (e) {
            console.warn('⚠️ Cannot access Firestore:', e.message);
        }
        return null;
    }

    /**
     * جلب الفواتير من IndexedDB (نفس قاعدة بيانات صفحة المراجعة)
     */
    async getInvoicesFromIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                resolve([]);
                return;
            }

            const request = indexedDB.open('FastSokonLocalDB', 1);

            request.onerror = () => {
                console.warn('⚠️ Cannot open IndexedDB (FastSokonLocalDB)');
                resolve([]);
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                
                try {
                    if (!db.objectStoreNames.contains('invoices')) {
                        db.close();
                        resolve([]);
                        return;
                    }

                    const tx = db.transaction('invoices', 'readonly');
                    const store = tx.objectStore('invoices');
                    const getAllRequest = store.getAll();

                    getAllRequest.onsuccess = () => {
                        db.close();
                        const invoices = getAllRequest.result || [];
                        
                        if (this.config.sync?.debug && invoices.length > 0) {
                            console.log(`📦 IndexedDB: ${invoices.length} invoices found`);
                        }
                        
                        resolve(invoices.map(inv => ({
                            ...inv,
                            _source: 'IndexedDB',
                            id: inv.id || 'idb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
                        })));
                    };

                    getAllRequest.onerror = () => {
                        db.close();
                        console.warn('⚠️ Error reading from IndexedDB');
                        resolve([]);
                    };
                } catch (e) {
                    db.close();
                    console.warn('⚠️ IndexedDB access error:', e.message);
                    resolve([]);
                }
            };

            request.onblocked = () => {
                console.warn('⚠️ IndexedDB blocked');
                resolve([]);
            };
        });
    }

    /**
     * جلب الفواتير من localStorage (نفس مفاتيح صفحة المراجعة)
     */
    getInvoicesFromLocalStorage() {
        const invoices = [];

        // 1. المفتاح الرئيسي: fast_sokon_invoices (تستخدمه صفحة المراجعة)
        try {
            const mainInvoices = JSON.parse(localStorage.getItem('fast_sokon_invoices') || '[]');
            if (Array.isArray(mainInvoices) && mainInvoices.length > 0) {
                if (this.config.sync?.debug) {
                    console.log(`📦 localStorage (fast_sokon_invoices): ${mainInvoices.length} invoices`);
                }
                mainInvoices.forEach(inv => {
                    invoices.push({
                        ...inv,
                        _source: 'fast_sokon_invoices',
                        id: inv.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                    });
                });
            }
        } catch (e) {
            console.warn('⚠️ fast_sokon_invoices read failed:', e.message);
        }

        // 2. آخر حالة صالحة: last_valid_state (تحفظها صفحة المراجعة تلقائياً)
        try {
            const lastState = JSON.parse(localStorage.getItem('last_valid_state') || 'null');
            if (lastState && lastState.items && lastState.items.length > 0) {
                const alreadyExists = invoices.some(inv => 
                    inv.timestamp === lastState.timestamp || 
                    JSON.stringify(inv.items) === JSON.stringify(lastState.items)
                );
                
                if (!alreadyExists) {
                    if (this.config.sync?.debug) {
                        console.log('📦 localStorage (last_valid_state): 1 invoice');
                    }
                    invoices.push({
                        ...lastState,
                        id: lastState.id || `last_state_${lastState.timestamp || Date.now()}`,
                        _source: 'last_valid_state',
                        store: lastState.store || lastState.supplier || 'غير محدد',
                        originalInvoiceDate: lastState.date || lastState.dateStr || null,
                        total: parseFloat(lastState.total) || 0,
                        itemCount: lastState.itemCount || lastState.items?.length || 0,
                        paymentStatus: lastState.paymentStatus || 'unpaid'
                    });
                }
            }
        } catch (e) {
            console.warn('⚠️ last_valid_state read failed:', e.message);
        }

        // 3. استرداد الأعطال: crash_recovery (يحفظها نظام AutoRecovery)
        try {
            const recovery = JSON.parse(localStorage.getItem('crash_recovery') || 'null');
            if (recovery && recovery.items && recovery.items.length > 0) {
                const alreadyExists = invoices.some(inv => 
                    inv.timestamp === recovery.timestamp ||
                    (inv._source === 'crash_recovery')
                );
                
                if (!alreadyExists) {
                    if (this.config.sync?.debug) {
                        console.log('📦 localStorage (crash_recovery): 1 invoice');
                    }
                    invoices.push({
                        ...recovery,
                        id: `recovery_${recovery.timestamp || Date.now()}`,
                        _source: 'crash_recovery',
                        store: recovery.context || recovery.store || 'استرداد تلقائي',
                        originalInvoiceDate: recovery.date || null,
                        total: recovery.total || 0,
                        itemCount: recovery.itemCount || recovery.items?.length || 0,
                        paymentStatus: recovery.paymentStatus || 'unpaid'
                    });
                }
            }
        } catch (e) {
            console.warn('⚠️ crash_recovery read failed:', e.message);
        }

        // 4. نسخة احتياطية قديمة: fast_sokon_backup_invoices (للتغطية الكاملة)
        try {
            const backupInvoices = JSON.parse(localStorage.getItem('fast_sokon_backup_invoices') || '[]');
            if (Array.isArray(backupInvoices) && backupInvoices.length > 0) {
                backupInvoices.forEach(inv => {
                    const alreadyExists = invoices.some(existing => 
                        existing.id === inv.id || 
                        JSON.stringify(existing.items) === JSON.stringify(inv.items)
                    );
                    
                    if (!alreadyExists) {
                        invoices.push({
                            ...inv,
                            _source: 'fast_sokon_backup_invoices',
                            id: inv.id || `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                        });
                    }
                });
                
                if (this.config.sync?.debug && backupInvoices.length > 0) {
                    console.log(`📦 localStorage (fast_sokon_backup_invoices): ${backupInvoices.length} invoices`);
                }
            }
        } catch (e) {
            console.warn('⚠️ fast_sokon_backup_invoices read failed:', e.message);
        }

        return invoices;
    }

    /**
     * جلب جميع الفواتير المحلية (IndexedDB + localStorage)
     * يتبع نفس نظام التخزين في صفحة المراجعة
     */
    async getAllLocalInvoices() {
        const allInvoices = [];

        // 1. جلب من IndexedDB (نفس قاعدة بيانات صفحة المراجعة)
        try {
            const idbInvoices = await this.getInvoicesFromIndexedDB();
            allInvoices.push(...idbInvoices);
        } catch (error) {
            console.warn('⚠️ IndexedDB fetch error:', error.message);
        }

        // 2. جلب من localStorage (نفس مفاتيح صفحة المراجعة)
        try {
            const localInvoices = this.getInvoicesFromLocalStorage();
            
            // إزالة التكرارات بين IndexedDB و localStorage
            localInvoices.forEach(inv => {
                const isDuplicate = allInvoices.some(existing => 
                    existing.id === inv.id || 
                    (existing.timestamp && existing.timestamp === inv.timestamp) ||
                    JSON.stringify(existing.items) === JSON.stringify(inv.items)
                );
                
                if (!isDuplicate) {
                    allInvoices.push(inv);
                }
            });
        } catch (error) {
            console.warn('⚠️ localStorage fetch error:', error.message);
        }

        if (this.config.sync?.debug) {
            console.log(`📊 Total local invoices found: ${allInvoices.length}`);
        }

        return allInvoices;
    }

    /**
     * حذف فاتورة من جميع أماكن التخزين المحلي
     * يمسح من نفس الأماكن اللي بتستخدمها صفحة المراجعة
     */
    async removeLocalInvoice(invoiceId, invoiceTimestamp) {
        let removed = false;

        // 1. حذف من IndexedDB (نفس قاعدة بيانات صفحة المراجعة)
        try {
            const db = await new Promise((resolve, reject) => {
                const request = indexedDB.open('FastSokonLocalDB', 1);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            if (db.objectStoreNames.contains('invoices')) {
                const tx = db.transaction('invoices', 'readwrite');
                const store = tx.objectStore('invoices');
                
                const getAllRequest = store.getAll();
                
                await new Promise((resolve) => {
                    getAllRequest.onsuccess = () => {
                        const invoices = getAllRequest.result;
                        const toDelete = invoices.find(inv => 
                            inv.id === invoiceId || inv.timestamp === invoiceTimestamp
                        );
                        
                        if (toDelete) {
                            store.delete(toDelete.id);
                            removed = true;
                            if (this.config.sync?.debug) {
                                console.log(`🗑️ Deleted from IndexedDB: ${toDelete.id}`);
                            }
                        }
                        
                        tx.oncomplete = () => {
                            db.close();
                            resolve();
                        };
                    };
                });
            } else {
                db.close();
            }
        } catch (e) {
            console.warn('⚠️ Failed to delete from IndexedDB:', e.message);
        }

        // 2. حذف من fast_sokon_invoices (المفتاح الرئيسي في صفحة المراجعة)
        try {
            const invoices = JSON.parse(localStorage.getItem('fast_sokon_invoices') || '[]');
            const filtered = invoices.filter(inv => 
                inv.id !== invoiceId && inv.timestamp !== invoiceTimestamp
            );
            if (filtered.length !== invoices.length) {
                localStorage.setItem('fast_sokon_invoices', JSON.stringify(filtered));
                removed = true;
                if (this.config.sync?.debug) {
                    console.log('🗑️ Deleted from fast_sokon_invoices');
                }
            }
        } catch (e) {
            console.warn('⚠️ Failed to delete from fast_sokon_invoices:', e.message);
        }

        // 3. حذف من last_valid_state إذا كان مطابقاً
        try {
            const lastState = JSON.parse(localStorage.getItem('last_valid_state') || 'null');
            if (lastState && (lastState.id === invoiceId || lastState.timestamp === invoiceTimestamp)) {
                localStorage.removeItem('last_valid_state');
                removed = true;
                if (this.config.sync?.debug) {
                    console.log('🗑️ Deleted last_valid_state');
                }
            }
        } catch (e) {
            console.warn('⚠️ Failed to delete last_valid_state:', e.message);
        }

        // 4. حذف من crash_recovery إذا كان مطابقاً
        try {
            const recovery = JSON.parse(localStorage.getItem('crash_recovery') || 'null');
            if (recovery && (recovery.timestamp === invoiceTimestamp || `recovery_${recovery.timestamp}` === invoiceId)) {
                localStorage.removeItem('crash_recovery');
                removed = true;
                if (this.config.sync?.debug) {
                    console.log('🗑️ Deleted crash_recovery');
                }
            }
        } catch (e) {
            console.warn('⚠️ Failed to delete crash_recovery:', e.message);
        }

        // 5. حذف من fast_sokon_backup_invoices (للتغطية الكاملة)
        try {
            const backupInvoices = JSON.parse(localStorage.getItem('fast_sokon_backup_invoices') || '[]');
            const filtered = backupInvoices.filter(inv => 
                inv.id !== invoiceId && inv.timestamp !== invoiceTimestamp
            );
            if (filtered.length !== backupInvoices.length) {
                localStorage.setItem('fast_sokon_backup_invoices', JSON.stringify(filtered));
                removed = true;
                if (this.config.sync?.debug) {
                    console.log('🗑️ Deleted from fast_sokon_backup_invoices');
                }
            }
        } catch (e) {
            console.warn('⚠️ Failed to delete from fast_sokon_backup_invoices:', e.message);
        }

        return removed;
    }

    /**
     * رفع فاتورة واحدة إلى Firestore
     * 📅 التاريخ = وقت الرفع السحابي (serverTimestamp)
     */
    async uploadInvoice(invoice, firestore, user) {
        const invoiceData = {
            // البيانات الأساسية
            store: invoice.store || invoice.supplier || 'غير محدد',
            
            // ✅✅✅ تاريخ الفاتورة = وقت الرفع السحابي
            date: firebase.firestore.FieldValue.serverTimestamp(),
            
            // ✅ التاريخ الأصلي للفاتورة (للرجوع إليه فقط)
            originalInvoiceDate: invoice.date || invoice.dateStr || invoice.originalInvoiceDate || null,
            
            total: parseFloat(invoice.total) || 0,
            itemCount: invoice.itemCount || invoice.items?.length || 0,
            paymentStatus: invoice.paymentStatus || 'unpaid',
            
            // الأصناف
            items: (invoice.items || []).map(item => ({
                name: item.name || '',
                quantity: parseInt(item.quantity) || 1,
                price: parseFloat(item.price) || 0,
                publicPrice: parseFloat(item.publicPrice) || 0,
                sellingPrice: parseFloat(item.sellingPrice) || 0,
                discount: parseFloat(item.discount) || 0,
                bonus: parseInt(item.bonus) || 0,
                expiry: item.expiry || ''
            })),
            
            // بيانات إضافية
            activeColumns: invoice.activeColumns || [],
            source: invoice._source || 'auto_sync',
            syncedFromLocal: true,
            originalLocalId: invoice.id || invoice._source + '_' + Date.now(),
            
            // بيانات التعريف
            metadata: {
                // ✅ جميع التواريخ = وقت الخادم
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                syncedAt: firebase.firestore.FieldValue.serverTimestamp(),
                
                userId: user.uid,
                userEmail: user.email,
                version: firebaseConfig.version || '2.3.0',
                syncSource: 'local_to_cloud',
                deviceInfo: navigator.userAgent?.substring(0, 100) || 'unknown'
            }
        };
        
        const docRef = await firestore
            .collection(firebaseConfig.firestore.collections.users)
            .doc(user.uid)
            .collection(firebaseConfig.firestore.collections.invoices)
            .add(invoiceData);
        
        return docRef.id;
    }

    /**
     * تنفيذ المزامنة الآن
     */
    async syncNow() {
        // منع التشغيل المتزامن
        if (this.isSyncing) {
            if (this.config.sync?.debug) {
                console.log('⏳ Sync already in progress, skipping');
            }
            return { success: false, reason: 'already_syncing' };
        }
        
        this.isSyncing = true;
        const startTime = Date.now();
        
        try {
            // التحقق من المصادقة
            if (this.config.sync?.requireAuth) {
                const user = this.getCurrentUser();
                if (!user) {
                    if (this.config.sync?.debug) {
                        console.log('🔒 No authenticated user, skipping sync');
                    }
                    this.syncStats.lastSync = Date.now();
                    this.notifyListeners('skipped', { reason: 'no_auth' });
                    return { success: false, reason: 'no_auth' };
                }
            }
            
            // التحقق من الاتصال
            if (!navigator.onLine) {
                if (this.config.sync?.debug) {
                    console.log('📡 Offline, skipping sync');
                }
                this.syncStats.lastSync = Date.now();
                this.notifyListeners('skipped', { reason: 'offline' });
                return { success: false, reason: 'offline' };
            }
            
            // جلب جميع الفواتير المحلية (IndexedDB + localStorage)
            const allLocalInvoices = await this.getAllLocalInvoices();
            
            // إضافة قائمة إعادة المحاولة
            const pendingRetries = [...this.retryQueue];
            this.retryQueue = [];
            
            const allPending = [...allLocalInvoices, ...pendingRetries];
            
            // إزالة التكرارات
            const uniqueInvoices = [];
            const seenIds = new Set();
            
            allPending.forEach(invoice => {
                const key = invoice.id || invoice._source + '_' + invoice.timestamp;
                if (!seenIds.has(key)) {
                    seenIds.add(key);
                    uniqueInvoices.push(invoice);
                }
            });
            
            if (uniqueInvoices.length === 0) {
                if (this.config.sync?.debug) {
                    console.log('📭 No local invoices to sync');
                }
                this.syncStats.pending = 0;
                this.syncStats.lastSync = Date.now();
                this.isSyncing = false;
                this.notifyListeners('completed', { synced: 0, total: 0 });
                return { success: true, synced: 0, total: 0 };
            }
            
            // تحديث الإحصائيات
            this.syncStats.pending = uniqueInvoices.length;
            this.syncStats.total += uniqueInvoices.length;
            
            console.log(`📤 Starting sync: ${uniqueInvoices.length} invoices pending (using server timestamp)`);
            
            const firestore = this.getFirestore();
            const user = this.getCurrentUser();
            
            if (!firestore || !user) {
                this.isSyncing = false;
                return { success: false, reason: 'no_firestore_or_user' };
            }
            
            // معالجة الفواتير على دفعات
            const batchSize = this.config.sync?.batchSize || 10;
            let synced = 0;
            let failed = 0;
            
            for (let i = 0; i < uniqueInvoices.length; i += batchSize) {
                const batch = uniqueInvoices.slice(i, i + batchSize);
                
                const results = await Promise.allSettled(
                    batch.map(invoice => this.uploadInvoice(invoice, firestore, user))
                );
                
                results.forEach((result, index) => {
                    const invoice = batch[index];
                    
                    if (result.status === 'fulfilled') {
                        synced++;
                        this.syncStats.success++;
                        
                        // حذف من جميع أماكن التخزين المحلي بعد الرفع الناجح
                        if (this.config.sync?.deleteAfterSync) {
                            this.removeLocalInvoice(invoice.id, invoice.timestamp);
                            if (this.config.sync?.debug) {
                                console.log(`✅ Synced & removed: ${invoice.id || invoice._source} → ${result.value}`);
                            }
                        } else {
                            if (this.config.sync?.debug) {
                                console.log(`✅ Synced: ${invoice.id} → ${result.value}`);
                            }
                        }
                    } else {
                        failed++;
                        this.syncStats.failed++;
                        
                        // إضافة إلى قائمة إعادة المحاولة
                        if (this.config.sync?.retryOnFailure) {
                            const retryCount = invoice._retryCount || 0;
                            if (retryCount < (this.config.sync?.maxRetries || 3)) {
                                this.retryQueue.push({
                                    ...invoice,
                                    _retryCount: retryCount + 1,
                                    _lastError: result.reason?.message || 'Unknown error'
                                });
                            }
                        }
                        
                        console.warn(`❌ Failed: ${invoice.id} - ${result.reason?.message}`);
                    }
                });
            }
            
            // تحديث الإحصائيات النهائية
            this.syncStats.lastSync = Date.now();
            this.syncStats.lastError = failed > 0 ? `${failed} invoices failed` : null;
            this.syncStats.pending = this.retryQueue.length;
            
            const duration = Date.now() - startTime;
            
            console.log(`📊 Sync completed: ${synced}✅ / ${failed}❌ / ${this.retryQueue.length}🔄 (${duration}ms)`);
            
            this.isSyncing = false;
            
            this.notifyListeners('completed', {
                synced,
                failed,
                pending: this.retryQueue.length,
                total: uniqueInvoices.length,
                duration
            });
            
            return {
                success: failed === 0,
                synced,
                failed,
                pending: this.retryQueue.length,
                total: uniqueInvoices.length,
                duration
            };
            
        } catch (error) {
            console.error('❌ Sync error:', error);
            this.syncStats.lastError = error.message;
            this.syncStats.lastSync = Date.now();
            this.isSyncing = false;
            
            this.notifyListeners('error', { error: error.message });
            
            return { success: false, error: error.message };
        }
    }

    /**
     * إضافة مستمع للتغييرات
     */
    addListener(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    /**
     * إزالة مستمع
     */
    removeListener(callback) {
        this.listeners = this.listeners.filter(cb => cb !== callback);
    }

    /**
     * إشعار المستمعين
     */
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data, this.syncStats);
            } catch (e) {
                console.warn('⚠️ Listener error:', e.message);
            }
        });
    }

    /**
     * الحصول على إحصائيات المزامنة
     */
    getStats() {
        return {
            ...this.syncStats,
            isRunning: !!this.syncInterval,
            isSyncing: this.isSyncing,
            config: this.config.sync
        };
    }

    /**
     * مزامنة فاتورة واحدة يدوياً
     */
    async syncSingleInvoice(invoiceId) {
        const allInvoices = await this.getAllLocalInvoices();
        const invoice = allInvoices.find(inv => inv.id === invoiceId || inv._source + '_' + inv.timestamp === invoiceId);
        
        if (invoice) {
            const firestore = this.getFirestore();
            const user = this.getCurrentUser();
            
            if (!firestore || !user) {
                return { success: false, error: 'No Firestore or user' };
            }
            
            try {
                const cloudId = await this.uploadInvoice(invoice, firestore, user);
                
                if (this.config.sync?.deleteAfterSync) {
                    await this.removeLocalInvoice(invoiceId);
                }
                
                return { success: true, cloudId };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
        
        return { success: false, error: 'Invoice not found locally' };
    }

    /**
     * إيقاف وتنظيف النظام
     */
    destroy() {
        this.stopAutoSync();
        this.listeners = [];
        this.retryQueue = [];
        console.log('🛑 LocalToCloudSync destroyed');
    }
}

// ==================== دوال مساعدة ====================

/**
 * التحقق من صحة الإعدادات
 * @returns {boolean}
 */
function validateConfig() {
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
    const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
    
    if (missingFields.length > 0) {
        console.error('❌ إعدادات Firebase ناقصة:', missingFields.join(', '));
        console.error('⚠️ التطبيق قد لا يعمل بشكل صحيح');
        return false;
    }
    return true;
}

/**
 * الحصول على مسار Realtime Database للمستخدم
 * @param {string} uid - معرف المستخدم
 * @returns {string}
 */
function getUserPath(uid) {
    return `${firebaseConfig.database.paths.users}/${uid}`;
}

/**
 * الحصول على مسار الفواتير في Firestore
 * @param {string} uid - معرف المستخدم
 * @returns {string}
 */
function getInvoicesCollection(uid) {
    return `${firebaseConfig.firestore.collections.users}/${uid}/${firebaseConfig.firestore.collections.invoices}`;
}

/**
 * طباعة معلومات التهيئة
 */
function logConfigInfo() {
    if (CURRENT_ENV === ENV.DEVELOPMENT) {
        console.log('🔥 ====================================');
        console.log(`🔥 Firebase Initialized [${CURRENT_ENV}]`);
        console.log(`📁 Project: ${firebaseConfig.projectId}`);
        console.log(`📧 Auth Domain: ${firebaseConfig.authDomain}`);
        console.log(`🗄️ Database: ${firebaseConfig.databaseURL}`);
        console.log(`📦 Version: ${firebaseConfig.version}`);
        console.log(`🔄 Auto-Sync: ${firebaseConfig.sync?.enabled ? 'Enabled' : 'Disabled'}`);
        console.log(`⏱️ Sync Interval: ${(firebaseConfig.sync?.interval || 16000) / 1000}s`);
        console.log(`🗑️ Delete After Sync: ${firebaseConfig.sync?.deleteAfterSync ? 'Yes' : 'No'}`);
        console.log(`📅 Date System: Server Timestamp (upload time)`);
        console.log('📦 Following: Page Review Storage System');
        console.log('   - IndexedDB: FastSokonLocalDB');
        console.log('   - localStorage: fast_sokon_invoices');
        console.log('   - localStorage: last_valid_state');
        console.log('   - localStorage: crash_recovery');
        console.log('🔥 ====================================');
    }
}

/**
 * التحقق من الاتصال بالسيرفر
 * @returns {Promise<boolean>}
 */
async function checkFirebaseConnection() {
    try {
        if (!window.firebase || !window.firebase.database) {
            return false;
        }
        
        const db = window.firebase.database();
        const snapshot = await db.ref('.info/connected').once('value');
        return snapshot.val() === true;
    } catch (error) {
        console.warn('⚠️ Firebase connection check failed:', error);
        return false;
    }
}

// ==================== التصدير (للاستخدام في ES Modules) ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        firebaseConfig,
        ENV,
        CURRENT_ENV,
        LocalToCloudSync,
        validateConfig,
        getUserPath,
        getInvoicesCollection,
        checkFirebaseConnection
    };
}

// ==================== التهيئة التلقائية ====================
(function initFirebase() {
    // التحقق من صحة الإعدادات
    if (!validateConfig()) {
        console.error('❌ فشل التحقق من إعدادات Firebase');
        return;
    }
    
    // طباعة معلومات التهيئة في بيئة التطوير
    logConfigInfo();
    
    // محاولة تهيئة Firebase إذا لم يتم تهيئته بعد
    if (typeof firebase !== 'undefined' && !firebase.apps?.length) {
        try {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase initialized successfully');
            
            // ✨ بدء نظام المزامنة التلقائية
            window.firebaseSync = new LocalToCloudSync(firebaseConfig);
            
            // إضافة مستمع للأحداث مع عرض إحصائيات مفصلة
            window.firebaseSync.addListener((event, data, stats) => {
                if (firebaseConfig.sync?.debug) {
                    switch(event) {
                        case 'completed':
                            console.log(`📊 Sync stats: ${data.synced} synced, ${data.failed} failed, ${data.pending} pending`);
                            break;
                        case 'skipped':
                            console.log(`⏭️ Sync skipped: ${data.reason}`);
                            break;
                        case 'error':
                            console.error(`❌ Sync error: ${data.error}`);
                            break;
                    }
                }
            });
            
            // عرض إحصائيات أولية
            console.log('📊 Initial sync stats:', window.firebaseSync.getStats());
            
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
        }
    }
})();
