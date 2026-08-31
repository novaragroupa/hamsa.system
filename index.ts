import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function usernameEmail(username: string) {
  return `${username.trim().toLowerCase()}@login.homsa.local`;
}

// كل موظف مسجّل دخوله يقدر يغيّر اسم المستخدم و/أو كلمة المرور بتاعته من هنا.
// مفيش حاجة بتتبعت غير التوكن بتاعه، والسيرفر (service role) هو اللي بيعمل التعديل.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'غير مصرح' }, 401);
    const token = authHeader.replace('Bearer ', '').trim();

    const { data: { user: actor }, error: actorError } = await admin.auth.getUser(token);
    if (actorError || !actor) return json({ error: 'جلسة الدخول غير صالحة' }, 401);

    const { data: actorProfile, error: profileError } = await admin
      .from('users')
      .select('id, username, status')
      .eq('auth_user_id', actor.id)
      .single();

    if (profileError || !actorProfile || actorProfile.status !== 'active') {
      return json({ error: 'الحساب غير مفعّل' }, 403);
    }

    const body = await req.json();
    const newUsername = body.newUsername ? String(body.newUsername).trim().toLowerCase() : null;
    const newPassword = body.newPassword ? String(body.newPassword) : null;
    const currentPassword = String(body.currentPassword || '');

    if (!newUsername && !newPassword) {
      return json({ error: 'لازم تحدد اسم مستخدم جديد أو كلمة مرور جديدة على الأقل' }, 400);
    }
    if (newPassword && newPassword.length < 8) {
      return json({ error: 'كلمة المرور الجديدة لازم تكون 8 أحرف على الأقل' }, 400);
    }
    if (newUsername && !/^[a-z0-9._-]{3,40}$/.test(newUsername)) {
      return json({ error: 'اسم المستخدم يجب أن يكون إنجليزيًا ويحتوي على حروف أو أرقام أو . _ - فقط' }, 400);
    }
    if (!currentPassword) {
      return json({ error: 'أدخل كلمة المرور الحالية للتأكيد' }, 400);
    }

    // تأكيد الهوية: نتحقق من كلمة المرور الحالية قبل أي تعديل حساس
    const check = await admin.auth.signInWithPassword({
      email: usernameEmail(actorProfile.username),
      password: currentPassword,
    });
    if (check.error) return json({ error: 'كلمة المرور الحالية غير صحيحة' }, 401);

    if (newUsername && newUsername !== actorProfile.username) {
      const { data: existing } = await admin.from('users').select('id').eq('username', newUsername).maybeSingle();
      if (existing) return json({ error: 'اسم المستخدم ده مستخدم بالفعل' }, 409);
      const { data: existingEmp } = await admin.from('employees').select('id').eq('username', newUsername).maybeSingle();
      if (existingEmp) return json({ error: 'اسم المستخدم ده مستخدم بالفعل' }, 409);
    }

    const updatePayload: Record<string, unknown> = {};
    if (newUsername) updatePayload.email = usernameEmail(newUsername);
    if (newPassword) updatePayload.password = newPassword;

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(actor.id, updatePayload);
    if (authUpdateError) return json({ error: authUpdateError.message }, 400);

    if (newUsername) {
      const { error: userUpdateError } = await admin.from('users').update({ username: newUsername }).eq('id', actorProfile.id);
      if (userUpdateError) return json({ error: userUpdateError.message }, 400);
      await admin.from('employees').update({ username: newUsername }).eq('user_id', actor.id);
    }

    return json({ ok: true, username: newUsername || actorProfile.username });
  } catch (e) {
    console.error(e);
    return json({ error: 'حدث خطأ غير متوقع أثناء تعديل بيانات الدخول' }, 500);
  }
});
