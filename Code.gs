/**
 * Homsa System -> Google Sheets sync endpoint
 * 1) افتح Extensions > Apps Script داخل Google Sheet.
 * 2) الصق هذا الملف واضبط SECRET.
 * 3) Deploy > New deployment > Web app.
 * 4) Execute as: Me, Who has access: Anyone with the link.
 * 5) انسخ رابط Web App إلى GOOGLE_SHEETS_WEBHOOK في index.html.
 */
const SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET';

function doGet(e) {
  try {
    const p = e && e.parameter || {};
    if (SECRET !== 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET' && p.token !== SECRET) {
      return json({ok:false, error:'Unauthorized'});
    }
    if (p.action === 'list' && p.table) {
      const ss = SpreadsheetApp.getActive();
      const sheet = ss.getSheetByName(safeSheetName(p.table));
      return json({ok:true, rows: sheet ? readRows(sheet) : []});
    }
    return json({ok:true, service:'homsa-google-sheets-sync'});
  } catch (err) {
    return json({ok:false, error:String(err)});
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents || '{}');
    if (SECRET !== 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET' && body.token !== SECRET) {
      return json({ok:false, error:'Unauthorized'}, 401);
    }
    if (!body.table || !body.action) return json({ok:false, error:'Missing action/table'}, 400);

    const ss = SpreadsheetApp.getActive();
    const sheet = getOrCreateSheet(ss, safeSheetName(body.table));
    if (body.action === 'delete') deleteRowById(sheet, String(body.payload && body.payload.id || ''));
    else if (body.action === 'upsert') upsertRow(sheet, body.payload || {});
    else return json({ok:false, error:'Unknown action'}, 400);

    return json({ok:true});
  } catch (err) {
    return json({ok:false, error:String(err)}, 500);
  }
}

function readRows(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const h = sheet.getRange(1,1,1,lastCol).getValues()[0].map(String);
  const values = sheet.getRange(2,1,lastRow-1,lastCol).getValues();
  return values.filter(row => row.some(v => v !== '')).map(row => {
    const obj = {};
    h.forEach((key,i) => {
      let v = row[i];
      if (v instanceof Date) v = v.toISOString();
      if (typeof v === 'string') {
        const t=v.trim();
        if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
          try { v=JSON.parse(t); } catch(_) {}
        }
      }
      obj[key]=v;
    });
    return obj;
  });
}

function safeSheetName(name) { return String(name).replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 90); }
function getOrCreateSheet(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1,1,1,1).setValue('id'); sh.setFrozenRows(1); }
  return sh;
}
function headers(sheet) {
  const last = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1,1,1,last).getValues()[0].map(String).filter(Boolean);
}
function ensureHeaders(sheet, keys) {
  let h = headers(sheet);
  const missing = keys.filter(k => !h.includes(k));
  if (missing.length) { sheet.getRange(1,h.length+1,1,missing.length).setValues([missing]); h = h.concat(missing); }
  return h;
}
function upsertRow(sheet, obj) {
  const keys = Object.keys(obj || {});
  if (!keys.length) return;
  const h = ensureHeaders(sheet, keys);
  const idCol = h.indexOf('id') + 1;
  const id = String(obj.id || '');
  let row = sheet.getLastRow() + 1;
  if (id && idCol) {
    const values = sheet.getLastRow() > 1 ? sheet.getRange(2,idCol,sheet.getLastRow()-1,1).getValues().flat().map(String) : [];
    const found = values.indexOf(id); if (found >= 0) row = found + 2;
  }
  const values = h.map(k => { const v=obj[k]; return v === null || v === undefined ? '' : (typeof v==='object' ? JSON.stringify(v) : v); });
  sheet.getRange(row,1,1,h.length).setValues([values]);
}
function deleteRowById(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return;
  const h = headers(sheet), idCol=h.indexOf('id')+1; if (!idCol) return;
  const values=sheet.getRange(2,idCol,sheet.getLastRow()-1,1).getValues().flat().map(String);
  const found=values.indexOf(id); if(found>=0) sheet.deleteRow(found+2);
}
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
