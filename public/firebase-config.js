/**
 * ============================================================
 * Fast Sokon - إعدادات Firebase المركزية
 * ============================================================
 * 
 * هذا الملف يحتوي على إعدادات الاتصال بقاعدة بيانات Firebase.
 * يتم استيراده في جميع صفحات التطبيق لضمان الاتساق وسهولة الصيانة.
 * 
 * @version 1.0.0
 * @lastUpdate 2026-05-29
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
 * المشروع: i-excelled
 */
const devConfig = {
    apiKey: "AIzaSyCjCLdv6QWfJieZQO7Qt_U5W0UgxNx8TXQ",
    authDomain: "i-excelled.firebaseapp.com",
    databaseURL: "https://i-excelled-default-rtdb.firebaseio.com",
    projectId: "i-excelled",
    storageBucket: "i-excelled.firebasestorage.app",
    messagingSenderId: "872523261091",
    appId: "1:872523261091:web:77f465166d877b96b84b16",
    measurementId: "G-DJBW60TWCF"
};

/**
 * إعدادات بيئة الإنتاج (Production)
 * المشروع: i-excelled
 */
const prodConfig = {
    apiKey: "AIzaSyCjCLdv6QWfJieZQO7Qt_U5W0UgxNx8TXQ",
    authDomain: "i-excelled.firebaseapp.com",
    databaseURL: "https://i-excelled-default-rtdb.firebaseio.com",
    projectId: "i-excelled",
    storageBucket: "i-excelled.firebasestorage.app",
    messagingSenderId: "872523261091",
    appId: "1:872523261091:web:77f465166d877b96b84b16",
    measurementId: "G-DJBW60TWCF"
};

// ==================== اختيار الإعدادات النشطة ====================
const activeConfig = (CURRENT_ENV === ENV.PRODUCTION) ? prodConfig : devConfig;

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
        console.log(`🔥 Firebase تم التهيئة [${CURRENT_ENV}]`);
        console.log(`📁 المشروع: ${firebaseConfig.projectId}`);
    }
}

// تنفيذ التحقق التلقائي عند تحميل الملف
if (CURRENT_ENV === ENV.DEVELOPMENT) {
    validateConfig();
    logConfigInfo();
}
