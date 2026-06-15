// ============================================================
// 🔑 ضع مفتاح Gemini API هنا (لن تضطر للبحث عنه)
// ============================================================
const GEMINI_API_KEY = "AQ.Ab8RN6IZIELJN_SJw60XgIZ1873HgYhQFf6pyf2zJg87Va3khw";

import { GoogleGenAI, Type } from '@google/genai';

export const prerender = false;

// ==================== Rate Limiting ====================
const rateLimitMap = new Map();
const TIME_WINDOW = 60 * 1000;
const MAX_REQUESTS = 10;
const COOLDOWN_PERIOD = 3000;

function isRateLimited(clientIp) {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now - value.windowStart > TIME_WINDOW) rateLimitMap.delete(key);
  }
  if (!rateLimitMap.has(clientIp)) {
    rateLimitMap.set(clientIp, { windowStart: now, count: 1, lastRequest: now });
    return { limited: false };
  }
  const clientData = rateLimitMap.get(clientIp);
  if (now - clientData.lastRequest < COOLDOWN_PERIOD) return { limited: true, reason: 'يرجى الانتظار قليلاً.' };
  if (now - clientData.windowStart < TIME_WINDOW) {
    if (clientData.count >= MAX_REQUESTS) return { limited: true, reason: 'تم تجاوز الحد الأقصى.' };
    clientData.count++;
    clientData.lastRequest = now;
    return { limited: false };
  } else {
    clientData.windowStart = now;
    clientData.count = 1;
    clientData.lastRequest = now;
    return { limited: false };
  }
}

// ==================== إعادة المحاولة ====================
async function generateContentWithRetry(ai, options, retries = 3, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    try { 
      return await ai.models.generateContent(options); 
    } catch (error) {
      if ((error.status === 503 || error.status === 500) && i < retries - 1) {
        console.warn(`⚠️ محاولة ${i + 1} فشلت، إعادة بعد ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}

// ==================== دمج الصور ====================
function mergeImages(images) {
  return new Promise((resolve, reject) => {
    if (images.length === 1) {
      resolve(images[0].split(',')[1]);
      return;
    }

    const img1 = new Image();
    const img2 = new Image();
    let loaded = 0;

    const tryMerge = () => {
      if (loaded < 2) return;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const maxW = Math.max(img1.width, img2.width, 800);
      const h1 = Math.round(img1.height * (maxW / img1.width));
      const h2 = Math.round(img2.height * (maxW / img2.width));
      const sep = 30;

      canvas.width = maxW;
      canvas.height = h1 + sep + h2;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img1, 0, 0, maxW, h1);
      
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, h1, canvas.width, sep);
      ctx.fillStyle = '#9d8cff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📄 الصفحة 1', canvas.width / 2 - 60, h1 + 20);
      ctx.fillText('📄 الصفحة 2', canvas.width / 2 + 60, h1 + 20);
      
      ctx.drawImage(img2, 0, h1 + sep, maxW, h2);

      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };

    img1.onload = () => { loaded++; tryMerge(); };
    img2.onload = () => { loaded++; tryMerge(); };
    img1.onerror = () => resolve(images[0].split(',')[1]);
    img2.onerror = () => resolve(images[0].split(',')[1]);
    img1.src = images[0];
    img2.src = images[1];
  });
}

// ==================== إصلاح JSON المقطوع ====================
function repairJSON(text) {
  // المستوى 1: محاولة مباشرة
  try { return JSON.parse(text); } catch (e) {}

  // المستوى 2: إصلاح الأقواس الناقصة
  let fixed = text;
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;

  // إزالة فواصل زائدة
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  fixed = fixed.replace(/,\s*$/, '');
  
  // إصلاح نصوص مقطوعة
  fixed = fixed.replace(/:\s*"([^"]*?)$/gm, ':$1"');
  
  // إزالة نص بعد آخر }
  const lastBrace = fixed.lastIndexOf('}');
  if (lastBrace !== -1) fixed = fixed.substring(0, lastBrace + 1);
  
  // إغلاق الأقواس
  for (let i = 0; i < (openBrackets - closeBrackets); i++) fixed += ']';
  for (let i = 0; i < (openBraces - closeBraces); i++) fixed += '}';

  try { return JSON.parse(fixed); } catch (e) {}

  // المستوى 3: استخراج طوارئ
  console.warn('🆘 استخراج طوارئ...');
  const result = { store: 'غير معروف', date: new Date().toISOString().split('T')[0], items: [] };
  
  const storeMatch = text.match(/"store"\s*:\s*"([^"]*)"/);
  if (storeMatch) result.store = storeMatch[1];
  
  const dateMatch = text.match(/"date"\s*:\s*"([^"]*)"/);
  if (dateMatch) result.date = dateMatch[1];

  const itemBlocks = text.match(/\{[^}]*"name"[^}]*\}/g);
  if (itemBlocks) {
    itemBlocks.forEach(block => {
      try {
        const item = {};
        const n = block.match(/"name"\s*:\s*"([^"]*)"/);
        const q = block.match(/"quantity"\s*:\s*(\d+)/);
        const p = block.match(/"price"\s*:\s*([\d.]+)/);
        if (n) { item.name = n[1]; item.quantity = q ? parseInt(q[1]) : 1; item.price = p ? parseFloat(p[1]) : 0; result.items.push(item); }
      } catch (e) {}
    });
  }

  if (result.items.length === 0) throw new Error('تعذر استخراج البيانات');
  return result;
}

// ==================== API Endpoint ====================
export const POST = async ({ request }) => {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || 'localhost';
    const rateCheck = isRateLimited(clientIp);
    if (rateCheck.limited) return new Response(JSON.stringify({ success: false, error: { message: rateCheck.reason } }), { status: 429 });

    const body = await request.json();
    const { image, images } = body; // دعم الصيغتين
    
    // تجميع الصور
    let imageList = [];
    if (images && Array.isArray(images)) imageList = images.slice(0, 2);
    else if (image) imageList = [image];

    if (imageList.length === 0) return new Response(JSON.stringify({ success: false, error: { message: 'الصورة مفقودة.' } }), { status: 400 });

    console.log(`📸 ${imageList.length} صورة`);

    // دمج الصور
    const base64Data = await mergeImages(imageList);
    
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const systemInstruction = `OCR دقيق لاستخراج بيانات الفاتورة. أرسل JSON مضغوط بدون مسافات. انقل كل قيمة حرفياً.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        store: { type: Type.STRING },
        date: { type: Type.STRING },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              price: { type: Type.NUMBER },
              expiry: { type: Type.STRING },
              publicPrice: { type: Type.NUMBER },
              sellingPrice: { type: Type.NUMBER },
              discount: { type: Type.NUMBER },
              bonus: { type: Type.NUMBER }
            }
          }
        }
      }
    };

    const result = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: [{ 
        role: "user", 
        parts: [
          { text: imageList.length > 1 ? "استخرج كل الأصناف من الصفحتين وادمجها." : "استخرج بيانات الفاتورة." },
          { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
        ] 
      }],
      config: { 
        temperature: 0, 
        systemInstruction, 
        responseMimeType: "application/json", 
        responseSchema,
        maxOutputTokens: 8192
      }
    });

    // معالجة وإصلاح JSON
    const responseText = result.text;
    console.log(`📝 طول الـ JSON: ${responseText.length} حرف`);
    
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      console.warn('⚠️ JSON مقطوع، جاري الإصلاح...');
      parsed = repairJSON(responseText);
    }

    // إضافة البيانات الوصفية
    const finalResult = {
      text: JSON.stringify({
        store: parsed.store,
        date: parsed.date,
        items: parsed.items
      }),
      meta: {
        imageCount: imageList.length,
        itemCount: parsed.items?.length || 0,
        timestamp: Date.now()
      }
    };

    console.log(`✅ ${parsed.items?.length || 0} صنف مستخرج`);
    
    return new Response(JSON.stringify(finalResult), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return new Response(JSON.stringify({ success: false, error: { message: error.message } }), { status: 500 });
  }
};
