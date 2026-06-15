/**
 * ============================================================
 * Fast Sokon - إعدادات Firebase المركزية
 * ============================================================
 * 
 * هذا الملف يحتوي على إعدادات الاتصال بقاعدة بيانات Firebase.
 * يتم استيراده في جميع صفحات التطبيق لضمان الاتساق وسهولة الصيانة.
 * 
 * @version 2.0.0
 * @lastUpdate 2026-06-10
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
    version: '2.0.0',
    
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
    
    // إعدادات الأمان
    security: {
        maxInvoiceItems: 500,
        maxInvoiceTotal: 1000000,
        maxImageSize: 20 * 1024 * 1024, // 20 ميجابايت
        sessionTimeout: 30 * 60 * 1000 // 30 دقيقة
    }
};

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
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
        }
    }
})();
