/**
 * WYS Stock Count — Google Apps Script backend
 *
 * SETUP (do this in your own Google account, e.g. wys.trt@gmail.com):
 * 1. Open your "Stock Count Test" Google Sheet (or a fresh sheet).
 *    Make sure row 1 has headers exactly: CODE | QTY | LAST SCANNED
 * 2. Extensions → Apps Script
 * 3. Delete whatever's in the editor, paste this whole file in
 * 4. Click Deploy → New deployment
 *    - Select type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    - Click Deploy, authorize when prompted (same "unverified app" warning
 *      as before — click Advanced → Go to project → Allow)
 * 5. Copy the Web app URL it gives you (ends in /exec)
 * 6. Paste that URL into the WYS app → Settings → Apps Script Web App URL
 *
 * WHAT IT DOES:
 * - doPost, normal scan (body: {code}): looks the code up in the sheet.
 *   Already exists → increments QTY, updates LAST SCANNED, replies "duplicate".
 *   New code → adds a row with QTY=1, replies "new".
 * - doPost, correction (body: {code, action:'adjust', delta}): adds `delta`
 *   (e.g. -1 or +1) to that code's QTY. Drops to 0 or below → row is deleted
 *   entirely, replies "removed". Otherwise replies "adjusted" with the new
 *   qty. Used by both the app's "Undo last scan" button and the Summary
 *   tab's +/- buttons — same relative-adjustment logic either way, which is
 *   what makes it safe even if someone else is scanning the same code at
 *   the same time (see WYS/CLAUDE.md for the concurrent-counting discussion).
 * - Both request types share one LockService lock, so two requests hitting
 *   the sheet at the same instant (two phones, or a scan + a correction)
 *   always apply one at a time — no lost updates.
 * - doGet: returns every row as JSON, for the app's Summary screen.
 *
 * If you ever change the code, just paste the new version in over this one
 * and click Deploy → Manage deployments → edit (pencil icon) → New version → Deploy.
 * (A brand new deployment would change the URL — editing the existing one keeps it the same.)
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse(e.postData.contents);
    var code = String(body.code || '').trim();
    if (!code) return jsonOut({ status: 'error', message: 'No code provided' });

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    var now = new Date();

    if (body.action === 'adjust') {
      var delta = Number(body.delta || 0);
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === code) {
          var adjustedQty = Number(data[i][1] || 0) + delta;
          if (adjustedQty <= 0) {
            sheet.deleteRow(i + 1);
            return jsonOut({ status: 'removed', code: code });
          }
          sheet.getRange(i + 1, 2).setValue(adjustedQty);
          sheet.getRange(i + 1, 3).setValue(now);
          return jsonOut({ status: 'adjusted', code: code, qty: adjustedQty });
        }
      }
      return jsonOut({ status: 'error', message: 'Code not found: ' + code });
    }

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === code) {
        var newQty = Number(data[i][1] || 0) + 1;
        sheet.getRange(i + 1, 2).setValue(newQty);
        sheet.getRange(i + 1, 3).setValue(now);
        return jsonOut({ status: 'duplicate', code: code, qty: newQty });
      }
    }

    sheet.appendRow([code, 1, now]);
    return jsonOut({ status: 'new', code: code, qty: 1 });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var items = [];
  var total = 0;

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var qty = Number(data[i][1] || 0);
    items.push({
      code: String(data[i][0]).trim(),
      qty: qty,
      lastScanned: data[i][2] ? new Date(data[i][2]).toISOString() : ''
    });
    total += qty;
  }

  return jsonOut({ items: items, total: total });
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
