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
      .select('role, status')
      .eq('auth_user_id', actor.id)
      .single();

    if (profileError || !actorProfile || !['admin', 'hr'].includes(actorProfile.role) || actorProfile.status !== 'active') {
      return json({ error: 'فقط المدير أو HR يستطيع إنشاء حساب موظف' }, 403);
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = String(body.role || '').trim();
    const employeeData = body.employeeData || {};

    const allowedRoles = ['hr','pr_out','pr_in','reception','accounting','callcenter','accommodation','system'];
    if (actorProfile.role === 'hr' && role === 'admin') return json({ error: 'مسؤول HR لا يستطيع إنشاء حساب مدير' }, 403);
    if (!allowedRoles.includes(role) && !(actorProfile.role === 'admin' && role === 'admin')) {
      return json({ error: 'الصلاحية المطلوبة غير مسموحة' }, 400);
    }
    if (!name || !username || password.length < 8 || !role) {
      return json({ error: 'الاسم واسم المستخدم والدور وكلمة المرور (8 أحرف على الأقل) مطلوبة' }, 400);
    }
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return json({ error: 'اسم المستخدم يجب أن يكون إنجليزيًا ويحتوي على حروف أو أرقام أو . _ - فقط' }, 400);
    }

    const { data: existing } = await admin.from('users').select('id').eq('username', username).maybeSingle();
    if (existing) return json({ error: 'اسم المستخدم مستخدم بالفعل' }, 409);

    const email = usernameEmail(username);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, name, role },
    });
    if (createError || !created.user) return json({ error: createError?.message || 'فشل إنشاء حساب الدخول' }, 400);

    const { data: profile, error: insertError } = await admin.from('users').insert({
      auth_user_id: created.user.id,
      username,
      name,
      role,
      status: 'active',
      created_by: actor.id,
    }).select().single();

    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: insertError.message }, 400);
    }

    const { data: employee, error: employeeError } = await admin.from('employees').insert({
      ...employeeData,
      name,
      user_id: created.user.id,
      username,
      status: 'active',
    }).select().single();

    if (employeeError) {
      await admin.from('users').delete().eq('id', profile.id);
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: employeeError.message }, 400);
    }

    return json({ ok: true, user: profile, employee });
  } catch (e) {
    console.error(e);
    return json({ error: 'حدث خطأ غير متوقع أثناء إنشاء الحساب' }, 500);
  }
});
