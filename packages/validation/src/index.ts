import { z } from 'zod';

export const emailPasswordSchema = z.object({
  email: z.email('أدخل بريداً إلكترونياً صحيحاً'),
  password: z.string().min(8, 'يجب أن تتكون كلمة المرور من ٨ أحرف على الأقل'),
});

export const registerSchema = emailPasswordSchema.extend({
  firstName: z.string().trim().min(2, 'أدخل الاسم الأول').max(50),
  lastName: z.string().trim().min(2, 'أدخل الاسم الثاني').max(50),
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'استخدم رقم الهاتف بالصيغة الدولية مثل +963...'),
  preferredContact: z.enum(['phone', 'whatsapp', 'email']),
  deliveryAddress: z.string().trim().min(8, 'أدخل عنواناً واضحاً للتوصيل').max(300),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  googlePlaceId: z.string().trim().max(255).nullable(),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'أدخل الاسم الكامل').max(100),
  clinicName: z.string().trim().max(120).nullable(),
  defaultAddress: z.string().trim().min(8, 'أدخل عنواناً واضحاً').max(300),
});

export const checkoutSchema = z.object({
  recipientName: z.string().trim().min(2, 'أدخل اسم المستلم').max(100),
  recipientPhone: z.string().trim().min(7, 'أدخل رقم هاتف صحيحاً').max(25),
  deliveryAddress: z.string().trim().min(8, 'أدخل عنوان التوصيل').max(300),
  deliveryNotes: z.string().trim().max(500).optional(),
  acceptedTerms: z.boolean().refine((value) => value, 'يجب الموافقة على شروط الطلب والتوصيل'),
});

export type EmailPasswordInput = z.infer<typeof emailPasswordSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
