/**
 * ============================================================
 *  Homsa System — Google Apps Script Backend (Sheets as DB)
 * ============================================================
 * خطوات التركيب:
 * 1) افتح Google Sheet جديد، وسمّه مثلاً "Homsa_Database".
 * 2) اعمل تبويب (Tab) لكل جدول بنفس الأسماء دي بالظبط:
 *    employees, companies, visits, indoor_leads, indoor_data,
 *    reception_desk, reception_media, accounting,
 *    callcenter_feedback, callcenter_payments, accommodation, users
 * 3) في السطر الأول من كل تبويب اكتب أسماء الأعمدة (id, ثم باقي
 *    الحقول بنفس أسماء الحقول اللي في النظام بالإنجليزي، مثال
 *    لجدول employees: id, name, specialNumber, companyNumber,
 *    department, phone, address, hireDate, salary, photo).
 * 4) من القائمة: Extensions > Apps Script، والصق الكود ده كامل.
 * 5) اضغط Deploy > New deployment > Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6) هيديك رابط (Web app URL) — ده اللي هنحطه في الواجهة الأمامية
 *    بدل التخزين المؤقت الحالي.
 * ============================================================
 */

const SHEET_NAME_USERS = 'users';

function getSheet_(name){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if(!sheet) throw new Error('لا يوجد تبويب باسم: ' + name);
  return sheet;
}

function sheetToObjects_(sheet){
  const values = sheet.getDataRange().getValues();
  if(values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(row=>{
    const obj = {};
    headers.forEach((h,i)=> obj[h] = row[i]);
    return obj;
  });
}

function appendObject_(sheet, obj){
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h=> obj[h] !== undefined ? obj[h] : '');
  sheet.appendRow(row);
}

function updateObjectById_(sheet, obj){
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const idCol = headers.indexOf('id');
  const values = sheet.getDataRange().getValues();
  for(let r=1; r<values.length; r++){
    if(values[r][idCol] === obj.id){
      const row = headers.map(h=> obj[h] !== undefined ? obj[h] : values[r][headers.indexOf(h)]);
      sheet.getRange(r+1,1,1,headers.length).setValues([row]);
      return true;
    }
  }
  return false;
}

function deleteObjectById_(sheet, id){
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id');
  for(let r=1; r<values.length; r++){
    if(values[r][idCol] === id){ sheet.deleteRow(r+1); return true; }
  }
  return false;
}

function jsonOut_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** GET: ?action=list&table=employees  |  ?action=login&u=...&p=... */
function doGet(e){
  try{
    const action = e.parameter.action;
    if(action === 'login'){
      const users = sheetToObjects_(getSheet_(SHEET_NAME_USERS));
      const found = users.find(u=> u.username===e.parameter.u && String(u.password)===e.parameter.p);
      if(!found) return jsonOut_({ok:false, error:'بيانات الدخول غير صحيحة'});
      delete found.password;
      return jsonOut_({ok:true, user:found});
    }
    if(action === 'list'){
      const data = sheetToObjects_(getSheet_(e.parameter.table));
      return jsonOut_({ok:true, data});
    }
    return jsonOut_({ok:false, error:'action غير معروف'});
  }catch(err){
    return jsonOut_({ok:false, error:String(err)});
  }
}

/** POST body JSON: {action:'add'|'update'|'delete', table:'employees', record:{...}} */
function doPost(e){
  try{
    const body = JSON.parse(e.postData.contents);
    const sheet = getSheet_(body.table);
    if(body.action === 'add'){
      if(!body.record.id) body.record.id = Utilities.getUuid();
      appendObject_(sheet, body.record);
      return jsonOut_({ok:true, id: body.record.id});
    }
    if(body.action === 'update'){
      const done = updateObjectById_(sheet, body.record);
      return jsonOut_({ok:done});
    }
    if(body.action === 'delete'){
      const done = deleteObjectById_(sheet, body.id);
      return jsonOut_({ok:done});
    }
    return jsonOut_({ok:false, error:'action غير معروف'});
  }catch(err){
    return jsonOut_({ok:false, error:String(err)});
  }
}
