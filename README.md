# نظام إدارة همسة للسياحة — GitHub Pages + Google Sheets

هذه النسخة لا تستخدم Supabase نهائياً.

## طريقة العمل
- الواجهة: GitHub Pages
- قاعدة البيانات: Google Sheets
- API: Google Apps Script Web App
- رابط الـ Web App مضبوط بالفعل داخل `index.html`.

## أول مرة
1. افتح ملف `google-apps-script/Code.gs` داخل مشروع Google Apps Script المرتبط بـ Google Sheet.
2. الصق الكود بالكامل.
3. Deploy > Manage deployments > Edit > New version > Deploy.
4. تأكد أن Web App متاح لـ **Anyone** أو **Anyone with the link** حسب إعدادات Google.
5. ادخل الموقع وسجّل:
   - Username: `admin`
   - Password: `admin123`

سيتم إنشاء Sheet باسم `users` تلقائياً عند أول تسجيل دخول، وبقية الأوراق تُنشأ تلقائياً عند إضافة البيانات.

## مهم
بعد تعديل `Code.gs` يجب عمل **New version ثم Deploy** حتى تظهر خاصية تحميل البيانات من Google Sheets، وليس فقط حفظها.

## GitHub Pages
ارفع محتويات المشروع إلى المستودع، ثم فعّل:
Settings > Pages > Deploy from a branch > main / root.
