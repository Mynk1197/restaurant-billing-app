/**
 * Restaurant Billing backend. Bind this script to the billing Google Sheet.
 * Deploy: Deploy > New deployment > Web app > Execute as "Me", Access "Anyone".
 */

var SHEET_STAFF = 'Staff';
var SHEET_DISHES = 'Dishes';
var SHEET_SETTINGS = 'Settings';
var SHEET_BILLS = 'Bills';

var STAFF_HEADERS = ['Email', 'Name'];
var DISHES_HEADERS = ['Id', 'Name', 'Category', 'Price', 'Active'];
var SETTINGS_HEADERS = ['Key', 'Value'];
var BILLS_HEADERS = [
  'BillNo', 'DateTime', 'CustomerName', 'CustomerPhone',
  'Subtotal', 'Discount', 'SGST', 'CGST', 'Total', 'PaymentMethod', 'ItemsJSON'
];

var DEFAULT_SETTINGS = {
  RestaurantName: 'My Restaurant',
  Address: '',
  Phone: '',
  SGSTRate: '2.5',
  CGSTRate: '2.5',
  NextBillNumber: '1'
};

function doGet(e) {
  return handle(e);
}

function doPost(e) {
  return handle(e);
}

function handle(e) {
  var params = e.parameter || {};
  var action = params.action;
  var result;
  try {
    var staff = requireAuth(params);
    switch (action) {
      case 'login':
        result = { name: staff.name, email: staff.email };
        break;
      case 'getDishes':
        result = getDishes(params);
        break;
      case 'saveDish':
        result = saveDish(params);
        break;
      case 'getSettings':
        result = getSettings();
        break;
      case 'saveSettings':
        result = saveSettings(params);
        break;
      case 'createBill':
        result = createBill(params);
        break;
      case 'getBills':
        result = getBills(params);
        break;
      case 'getReports':
        result = getReports(params);
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }
    return jsonOut({ ok: true, data: result });
  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Auth ----------

function requireAuth(params) {
  var idToken = params.idToken;
  if (!idToken) throw new Error('Missing idToken');
  var email = verifyIdTokenAndGetEmail(idToken);
  var staff = getStaffByEmail(email);
  if (!staff) throw new Error('Not authorized: ' + email);
  return staff;
}

function verifyIdTokenAndGetEmail(idToken) {
  var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), {
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) throw new Error('Invalid Google token');
  var payload = JSON.parse(resp.getContentText());
  if (!payload.email || payload.email_verified !== 'true') throw new Error('Email not verified');
  return payload.email.toLowerCase();
}

function getStaffByEmail(email) {
  var rows = sheetToObjects(SHEET_STAFF, STAFF_HEADERS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].Email).toLowerCase() === email) {
      return { email: email, name: rows[i].Name };
    }
  }
  return null;
}

// ---------- Sheet helpers ----------

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Missing sheet: ' + name);
  return sh;
}

function sheetToObjects(name, headers) {
  var sh = getSheet(name);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) {
      var cell = row[i];
      obj[h] = cell instanceof Date ? Utilities.formatDate(cell, 'Asia/Kolkata', 'yyyy-MM-dd') : cell;
    });
    return obj;
  });
}

function appendRow(name, headers, obj) {
  var sh = getSheet(name);
  var row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sh.appendRow(row);
}

// Apps Script's setValue/appendRow silently converts a numeric-looking
// string (e.g. a phone number typed as plain digits) into a real Number
// cell, same as it does for date-looking strings. That breaks anything
// downstream expecting a string (jsPDF's text renderer throws on a
// number). Forcing the cell to plain-text format before writing keeps it
// stored exactly as the string that was sent.
function forceCellAsText(name, headers, rowIdx, columnHeader, value) {
  if (rowIdx < 0 || value === undefined || value === null || value === '') return;
  var sh = getSheet(name);
  var col = headers.indexOf(columnHeader) + 1;
  var cell = sh.getRange(rowIdx, col);
  cell.setNumberFormat('@');
  cell.setValue(String(value));
}

function findRowIndexByKey(name, headers, keyHeader, keyValue) {
  var sh = getSheet(name);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  var keyCol = headers.indexOf(keyHeader) + 1;
  var values = sh.getRange(2, keyCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(keyValue)) return i + 2; // 1-indexed sheet row
  }
  return -1;
}

// ---------- Dishes ----------

function getDishes(params) {
  var all = sheetToObjects(SHEET_DISHES, DISHES_HEADERS);
  if (params.activeOnly === 'true') {
    all = all.filter(function (d) { return String(d.Active) === 'Y'; });
  }
  return all;
}

function saveDish(params) {
  var dish = JSON.parse(params.dish);
  if (dish.Id) {
    var rowIdx = findRowIndexByKey(SHEET_DISHES, DISHES_HEADERS, 'Id', dish.Id);
    if (rowIdx < 0) throw new Error('Dish not found');
    var sh = getSheet(SHEET_DISHES);
    DISHES_HEADERS.forEach(function (h, i) {
      if (dish[h] !== undefined) sh.getRange(rowIdx, i + 1).setValue(dish[h]);
    });
    return { id: dish.Id };
  }
  dish.Id = 'D' + new Date().getTime() + Math.floor(Math.random() * 1000);
  if (dish.Active === undefined) dish.Active = 'Y';
  appendRow(SHEET_DISHES, DISHES_HEADERS, dish);
  return { id: dish.Id };
}

// ---------- Settings ----------

function getSettings() {
  var sh = getSheet(SHEET_SETTINGS);
  var lastRow = sh.getLastRow();
  var settings = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { settings[k] = DEFAULT_SETTINGS[k]; });
  if (lastRow >= 2) {
    var values = sh.getRange(2, 1, lastRow - 1, 2).getValues();
    values.forEach(function (row) {
      if (row[0]) settings[row[0]] = row[1];
    });
  }
  return settings;
}

function setSettingValue(key, value) {
  var rowIdx = findRowIndexByKey(SHEET_SETTINGS, SETTINGS_HEADERS, 'Key', key);
  var sh = getSheet(SHEET_SETTINGS);
  if (rowIdx < 0) {
    sh.appendRow([key, value]);
    rowIdx = sh.getLastRow();
  }
  forceCellAsText(SHEET_SETTINGS, SETTINGS_HEADERS, rowIdx, 'Value', value);
}

function saveSettings(params) {
  var fields = JSON.parse(params.settings);
  Object.keys(fields).forEach(function (key) {
    setSettingValue(key, fields[key]);
  });
  return getSettings();
}

// ---------- Bills ----------

function createBill(params) {
  var items = JSON.parse(params.items); // [{dishId, name, price, qty}]
  if (!items.length) throw new Error('Bill has no items');

  var settings = getSettings();
  var sgstRate = parseFloat(settings.SGSTRate) || 0;
  var cgstRate = parseFloat(settings.CGSTRate) || 0;
  var discount = parseFloat(params.discount) || 0;

  var subtotal = 0;
  var lineItems = items.map(function (it) {
    var qty = parseFloat(it.qty) || 0;
    var price = parseFloat(it.price) || 0;
    var lineTotal = qty * price;
    subtotal += lineTotal;
    return { dishId: it.dishId, name: it.name, category: it.category || '', price: price, qty: qty, lineTotal: lineTotal };
  });

  var taxableAmount = Math.max(subtotal - discount, 0);
  var sgst = round2(taxableAmount * sgstRate / 100);
  var cgst = round2(taxableAmount * cgstRate / 100);
  var total = round2(taxableAmount + sgst + cgst);

  var billNo = parseInt(settings.NextBillNumber, 10) || 1;
  setSettingValue('NextBillNumber', String(billNo + 1));

  var dateTime = new Date().toISOString();
  var bill = {
    BillNo: billNo,
    DateTime: dateTime,
    CustomerName: params.customerName || '',
    CustomerPhone: params.customerPhone || '',
    Subtotal: round2(subtotal),
    Discount: round2(discount),
    SGST: sgst,
    CGST: cgst,
    Total: total,
    PaymentMethod: params.paymentMethod || 'Cash',
    ItemsJSON: JSON.stringify(lineItems)
  };
  appendRow(SHEET_BILLS, BILLS_HEADERS, bill);
  forceCellAsText(SHEET_BILLS, BILLS_HEADERS, getSheet(SHEET_BILLS).getLastRow(), 'CustomerPhone', bill.CustomerPhone);

  return {
    billNo: billNo,
    dateTime: dateTime,
    customerName: bill.CustomerName,
    customerPhone: bill.CustomerPhone,
    items: lineItems,
    subtotal: bill.Subtotal,
    discount: bill.Discount,
    sgst: sgst,
    cgst: cgst,
    total: total,
    paymentMethod: bill.PaymentMethod,
    restaurantName: settings.RestaurantName,
    address: settings.Address,
    phone: settings.Phone,
    sgstRate: sgstRate,
    cgstRate: cgstRate
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function billRowToBill(row, settings) {
  var items = JSON.parse(row.ItemsJSON || '[]');
  return {
    billNo: row.BillNo,
    dateTime: row.DateTime,
    customerName: row.CustomerName,
    customerPhone: row.CustomerPhone,
    items: items,
    subtotal: row.Subtotal,
    discount: row.Discount,
    sgst: row.SGST,
    cgst: row.CGST,
    total: row.Total,
    paymentMethod: row.PaymentMethod,
    restaurantName: settings.RestaurantName,
    address: settings.Address,
    phone: settings.Phone
  };
}

function getBills(params) {
  var all = sheetToObjects(SHEET_BILLS, BILLS_HEADERS);
  var search = String(params.search || '').toLowerCase();
  var dateFrom = params.dateFrom;
  var dateTo = params.dateTo;

  var filtered = all.filter(function (b) {
    if (dateFrom || dateTo) {
      var d = String(b.DateTime).slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
    }
    if (search) {
      var haystack = (String(b.CustomerName) + ' ' + String(b.CustomerPhone) + ' ' + String(b.BillNo)).toLowerCase();
      if (haystack.indexOf(search) < 0) return false;
    }
    return true;
  });

  filtered.sort(function (a, b) { return Number(b.BillNo) - Number(a.BillNo); });

  var settings = getSettings();
  return filtered.map(function (row) { return billRowToBill(row, settings); });
}

function getReports(params) {
  var dateFrom = params.dateFrom;
  var dateTo = params.dateTo;
  var all = sheetToObjects(SHEET_BILLS, BILLS_HEADERS).filter(function (b) {
    var d = String(b.DateTime).slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  var totalSales = 0;
  var gstCollected = 0;
  var byPaymentMethod = {};
  var byItemMap = {};

  all.forEach(function (b) {
    totalSales += Number(b.Total) || 0;
    gstCollected += (Number(b.SGST) || 0) + (Number(b.CGST) || 0);
    var method = b.PaymentMethod || 'Cash';
    byPaymentMethod[method] = (byPaymentMethod[method] || 0) + (Number(b.Total) || 0);

    var items = [];
    try { items = JSON.parse(b.ItemsJSON || '[]'); } catch (e) { items = []; }
    items.forEach(function (it) {
      var key = it.name;
      if (!byItemMap[key]) byItemMap[key] = { name: key, qty: 0, amount: 0 };
      byItemMap[key].qty += Number(it.qty) || 0;
      byItemMap[key].amount += Number(it.lineTotal) || 0;
    });
  });

  var byItem = Object.keys(byItemMap).map(function (k) { return byItemMap[k]; });
  byItem.sort(function (a, b) { return b.amount - a.amount; });

  return {
    totalSales: round2(totalSales),
    billCount: all.length,
    gstCollected: round2(gstCollected),
    byPaymentMethod: byPaymentMethod,
    byItem: byItem
  };
}

// ---------- One-time setup helper ----------
// Run this once from the Apps Script editor to create sheet tabs with headers.
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var defs = [
    [SHEET_STAFF, STAFF_HEADERS],
    [SHEET_DISHES, DISHES_HEADERS],
    [SHEET_SETTINGS, SETTINGS_HEADERS],
    [SHEET_BILLS, BILLS_HEADERS]
  ];
  defs.forEach(function (def) {
    var name = def[0], headers = def[1];
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  });

  var settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (settingsSheet.getLastRow() < 2) {
    Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
      settingsSheet.appendRow([key, DEFAULT_SETTINGS[key]]);
    });
  }
}
