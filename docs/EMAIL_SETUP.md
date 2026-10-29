# إعداد البريد الإلكتروني

## 1. رسائل تفعيل الحساب

1. أنشئ بريداً مرسلاً باسم توريد لدى مزود SMTP موثوق، ووثّق نطاق الإرسال (SPF وDKIM).
2. في Supabase Dashboard افتح **Authentication → Email / SMTP** وفعّل Custom SMTP.
3. أدخل Host وPort وUsername وPassword وSender email وSender name. لا تضع كلمة SMTP في ملفات Expo أو Vercel العامة.
4. فعّل **Confirm email**، واضبط قالب **Confirm signup** ليعرض `{{ .Token }}` بدلاً من رابط التأكيد. النسخة المحلية الجاهزة موجودة في `supabase/templates/confirmation.html`.
5. اجعل مدة الرمز 3600 ثانية وطوله 6 أرقام كما في `supabase/config.toml`، ثم اختبر التسجيل من بريد حقيقي قبل النشر.

## 2. إرسال بلاغات الدعم بالبريد

البلاغ يُحفظ في `support_cases` أولاً، ثم تستدعي طبقة البيانات وظيفة Supabase الخادمية `send-support-email`. الوظيفة تتحقق من جلسة الطبيب ومن ملكيته للبلاغ قبل الإرسال.

اضبط أسرار الوظيفة (استبدل القيم الفعلية محلياً ولا تحفظها في Git):

```powershell
supabase secrets set RESEND_API_KEY="re_..." SUPPORT_EMAIL_TO="support@your-domain.example" SUPPORT_EMAIL_FROM="Tawreed <support@your-domain.example>"
supabase functions deploy send-support-email
```

يجب توثيق النطاق لدى مزود البريد قبل استخدام عنوان `SUPPORT_EMAIL_FROM`. مفتاح Resend يبقى سراً داخل Supabase Edge Functions ولا يُضاف إلى متغيرات `EXPO_PUBLIC_*`.

## 3. تحقق ما قبل الإطلاق

- أنشئ حساب طبيب جديد وتأكد أن رسالة الرمز تصل وأن الرمز يفعّل الجلسة.
- أعد إرسال الرمز وتأكد من حدود المعدل وعدم كشف وجود حسابات أخرى.
- أرسل بلاغاً وتأكد من وجود صف واحد في `support_cases` ووصول البريد إلى عنوان الدعم.
- اختبر SPF/DKIM وReply-To من صندوق بريد خارجي.
