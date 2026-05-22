/**
 * ============================================================
 * Fast Sokon - إعدادات Firebase المركزية
 * ============================================================
 * 
 * هذا الملف يحتوي على إعدادات الاتصال بقاعدة بيانات Firebase.
 * يتم استيراده في جميع صفحات التطبيق لضمان الاتساق وسهولة الصيانة.
 * 
 * @version 1.0.0
 * @lastUpdate 2026-05-09
 * @author Fast Sokon Team
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
 * إعدادات بيئة التطوير (Development)
 */
const devConfig = {
    apiKey: "AIzaSyAfYqB_0OcQcnYvxP6C0J4cuViY6EmLE8U",
    authDomain: "fast-sokon.firebaseapp.com",
    databaseURL: "https://fast-sokon-default-rtdb.firebaseio.com",
    projectId: "fast-sokon",
    storageBucket: "fast-sokon.firebasestorage.app",
    messagingSenderId: "45959507911",
    appId: "1:45959507911:web:e78de78f4a928062dff3e2",
    measurementId: "G-2R52W7Q4CE"
};

/**
 * إعدادات بيئة الإنتاج (Production )
 */
const prodConfig = {
    apiKey: "AIzaSyAfYqB_0OcQcnYvxP6C0J4cuViY6EmLE8U",
    authDomain: "fast-sokon.firebaseapp.com",
    databaseURL: "https://fast-sokon-default-rtdb.firebaseio.com",
    projectId: "fast-sokon",
    storageBucket: "fast-sokon.firebasestorage.app",
    messagingSenderId: "45959507911",
    appId: "1:45959507911:web:e78de78f4a928062dff3e2",
    measurementId: "G-2R52W7Q4CE"
};

// ==================== اختيار الإعدادات النشطة ====================
const activeConfig = (CURRENT_ENV === ENV.PRODUCTION ) ? prodConfig : devConfig;

/**
 * كائن الإعدادات الرئيسي الذي يتم استخدامه في التطبيق
 * @type {Object}
 */
const firebaseConfig = {
    ...activeConfig,
    
    // إعدادات إضافية مخصصة للتطبيق
    appName: 'Fast Sokon',
    version: '1.0.0',
    
    // إعدادات Realtime Database
    database: {
        paths: {
            users: 'users',
            invoices: 'invoices'
        }
    },
    
    // إعدادات المصادقة
    auth: {
        providers: ['password', 'google'],
        persistence: 'local'
    }
};

// ==================== دوال مساعدة ====================

function validateConfig() {
    const requiredFields = ['apiKey', 'authDomain', 'projectId'];
    const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
    
    if (missingFields.length > 0) {
        console.error('⚠️ إعدادات Firebase ناقصة:', missingFields.join(', '));
        return false;
    }
    return true;
}

function logConfigInfo() {
    if (CURRENT_ENV === ENV.DEVELOPMENT) {
        console.log(`🔥 Firebase initialized [${CURRENT_ENV}]`);
        console.log(`📁 Project: ${firebaseConfig.projectId}`);
    }
}

// تنفيذ التحقق التلقائي عند تحميل الملف
if (CURRENT_ENV === ENV.DEVELOPMENT) {
    validateConfig();
    logConfigInfo();
}