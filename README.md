# Homsa System — GitHub + Supabase

## نظام تسجيل دخول الموظفين

تم تحويل تسجيل الدخول إلى **Supabase Auth**. الموظف لا يستطيع إنشاء حساب بنفسه.
المدير أو مسؤول HR فقط يستطيع إنشاء حساب من شاشة **الموظفون**.

### 1) قاعدة البيانات

1. شغّل `database/schema.sql` إذا كنت تبدأ قاعدة جديدة.
2. بعده شغّل `database/auth-migration.sql`.
3. لا تستخدم جدول `users.password` القديم؛ كلمة المرور أصبحت داخل Supabase Auth.

### 2) إنشاء أول حساب مدير وHR

لأن الحسابات القديمة في `users` ليست حسابات Supabase Auth، أنشئ أولًا حسابين من:
Supabase Dashboard → Authentication → Users → Add user.

استخدم بريدًا اصطناعيًا بالشكل:
- `admin@login.homsa.local`
- `hr@login.homsa.local`

ثم اربط UUID الخاص بكل مستخدم في SQL:

```sql
update users set auth_user_id = 'AUTH-USER-UUID', status='active' where username='admin';
update users set auth_user_id = 'AUTH-USER-UUID', status='active' where username='hr';
```

إذا لم تكن سجلات `admin` و`hr` موجودة، أضفها مع `auth_user_id` و`status` و`role` و`name`.

### 3) Edge Function لإنشاء الموظفين

المجلد:
`supabase/functions/create-employee/index.ts`

من Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy create-employee
```

لا تضع `SUPABASE_SERVICE_ROLE_KEY` داخل GitHub أو داخل `index.html`.
Supabase يوفرها للـ Edge Function كـ secret/server environment variable.

من نفس المجلد فيه كمان `supabase/functions/update-account` — دي بتسمح لأي موظف مسجّل دخوله
إنه يغيّر اسم المستخدم و/أو كلمة المرور بتاعته بنفسه (بعد ما HR/المدير يعمله الحساب الأول).
انشرها بنفس الطريقة:

```bash
supabase functions deploy update-account
```

### 4) طريقة العمل

- Login: Username + Password.
- يتم تحويل Username داخليًا إلى بريد اصطناعي خاص بالنظام.
- الموظف لا يرى البريد الاصطناعي.
- Admin/HR → الموظفون → إضافة موظف + إنشاء حساب دخول (هما اللي بيحطوا بيانات الموظف واسم المستخدم وكلمة المرور الأولى).
- بعد كده أي موظف (بما فيهم Admin/HR) يقدر من زرار "تغيير بيانات الدخول" جوه القائمة الجانبية إنه يغيّر اسم المستخدم و/أو كلمة المرور بتاعته، بشرط إدخال كلمة المرور الحالية للتأكيد.
- كلمة المرور لا تُخزن في جدول `users`.
- Edge Function `create-employee` تتحقق من أن منشئ الحساب Admin أو HR قبل إنشاء الحساب.
- HR لا يستطيع إنشاء حساب Admin.

### 5) عمل أول حساب Admin (مثال: amr)

مينفعش تحط اسم مستخدم وباسورد جاهزين جوه الكود أو جوه قاعدة البيانات كنص عادي —
الباسورد لازم يتسجل جوه Supabase Auth نفسه (مشفّر بالكامل من عندهم). الخطوات:

1. Supabase Dashboard → Authentication → Users → **Add user**.
   - Email: `amr@login.homsa.local`
   - Password: `184775580`
   - فعّل "Auto Confirm User".
2. انسخ الـ UUID بتاع اليوزر اللي اتعمل، وشغّل في SQL Editor:
   ```sql
   insert into users (username, name, role, status, auth_user_id)
   values ('amr', 'Amr', 'admin', 'active', 'PASTE-THE-UUID-HERE')
   on conflict (username) do update
     set role='admin', status='active', auth_user_id=excluded.auth_user_id;
   ```
3. جرب تسجيل الدخول من الموقع بـ Username: `amr` و Password: `184775580`.
4. **مهم:** بعد أول دخول، خلّي amr يغيّر الباسورد من زرار "تغيير بيانات الدخول"، عشان الباسورد ده متسجّل هنا في الملف وممكن يبقى معروف لغيره.

نفس الأسلوب بالظبط تعمل بيه حساب HR، والـ Admin/HR بعد كده هما اللي بيعملوا باقي الموظفين من شاشة "الموظفون" (بيحطولهم اسم مستخدم وباسورد أول مرة)، وبعدين كل موظف يقدر يغيّرهم بنفسه.

### 6) الربط بين GitHub و Supabase

فيه طريقتين حسب اللي محتاجه:

**أ) لو عايز بس ترفع الكود على GitHub (الأغلب):**
1. اعمل ريبو جديد على GitHub.
2. من جوه مجلد المشروع:
   ```bash
   git init
   git add .
   git commit -m "Homsa system"
   git branch -M main
   git remote add origin https://github.com/USERNAME/REPO.git
   git push -u origin main
   ```
3. تأكد إن `.gitignore` مانع رفع أي ملف فيه `SERVICE_ROLE_KEY`. `index.html` نفسه آمن لأنه بيحتوي بس على Project URL و anon/publishable key، وده مصمم يتحط في المتصفح أصلاً.
4. تقدر تستضيف `index.html` مجانًا عبر GitHub Pages (Settings → Pages) لو عايز رابط مباشر.

**ب) لو عايز Supabase يشتغل مباشرة مع الريبو (نشر تلقائي لملفات SQL والـ Edge Functions):**
1. من Supabase Dashboard → Project Settings → **Integrations** → GitHub → Connect.
2. اختار الريبو، وحدد فولدر الـ Supabase (لو عندك) عشان أي تعديل في `supabase/functions` أو ملفات migrations يتنشر تلقائي مع كل push.
3. ده اختياري بالكامل — مش شرط عشان النظام يشتغل، مفيد بس لو الفريق أكتر من شخص وعايزين تتبع تاريخ التغييرات في قاعدة البيانات والـ Edge Functions.

`index.html` يحتوي فقط على Supabase URL وPublishable/Anon key، وده آمن يترفع على GitHub.
