import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supportRecipient = Deno.env.get('SUPPORT_EMAIL_TO');
    const supportSender = Deno.env.get('SUPPORT_EMAIL_FROM');
    if (!supabaseUrl || !anonKey || !resendApiKey || !supportRecipient || !supportSender) throw new Error('Support email is not configured');

    const { caseId } = await request.json() as { caseId?: string };
    if (!caseId) return new Response('Invalid case', { status: 400, headers: corsHeaders });
    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const { data: supportCase, error: caseError } = await client.from('support_cases').select('id, subject, message, created_at').eq('id', caseId).single();
    if (caseError || !supportCase) return new Response('Not found', { status: 404, headers: corsHeaders });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: supportSender,
        to: [supportRecipient],
        reply_to: userData.user.email,
        subject: `[توريد] ${supportCase.subject}`,
        text: `رقم البلاغ: ${supportCase.id}\nبريد الطبيب: ${userData.user.email ?? 'غير متوفر'}\nوقت الإرسال: ${supportCase.created_at}\n\n${supportCase.message}`,
      }),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
    return Response.json({ sent: true }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Support email failed' }, { status: 500, headers: corsHeaders });
  }
});
