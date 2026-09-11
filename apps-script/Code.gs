/**
 * QuickTab backend. Bind this script to the billing Google Sheet.
 * Deploy: Deploy > New deployment > Web app > Execute as "Me", Access "Anyone".
 */

var SHEET_STAFF = 'Staff';
var SHEET_DISHES = 'Dishes';
var SHEET_SETTINGS = 'Settings';
var SHEET_BILLS = 'Bills';
var SHEET_ORDERS = 'Orders';

var STAFF_HEADERS = ['Email', 'Name'];
var DISHES_HEADERS = ['Id', 'Name', 'Category', 'Price', 'Active'];
var SETTINGS_HEADERS = ['Key', 'Value'];
var BILLS_HEADERS = [
  'BillNo', 'DateTime', 'CustomerName', 'CustomerPhone',
  'Subtotal', 'Discount', 'SGST', 'CGST', 'Total', 'PaymentMethod', 'ItemsJSON',
  'Status', 'VoidReason', 'VoidedAt', 'TableNumber'
];
// An open dine-in order (a "tab" for a table) -- rows here exist only while
// a table's order is unfinished. Finalizing moves it into Bills and deletes
// the row; cancelling just deletes the row. Presence in this sheet is what
// "occupied" means, so there's no separate Status column.
var ORDERS_HEADERS = [
  'OrderId', 'TableNumber', 'CustomerName', 'CustomerPhone',
  'PaymentMethod', 'Discount', 'ItemsJSON', 'UpdatedAt'
];

var DEFAULT_SETTINGS = {
  RestaurantName: 'My Restaurant',
  Address: '',
  Phone: '',
  SGSTRate: '2.5',
  CGSTRate: '2.5',
  NextBillNumber: '1',
  TableCount: '12'
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
      case 'voidBill':
        result = voidBill(params);
        break;
      case 'getOpenOrders':
        result = getOpenOrders();
        break;
      case 'getOrder':
        result = getOrder(params);
        break;
      case 'saveOrder':
        result = saveOrder(params);
        break;
      case 'cancelOrder':
        result = cancelOrder(params);
        break;
      case 'finalizeOrder':
        result = finalizeOrder(params);
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

// Every action pays for this before doing anything else, and verifying the
// token means an extra network round trip out to Google's own servers on
// top of the one the client already made to reach this script -- caching
// the result (keyed by a hash of the token, since the token itself is far
// too long for a cache key) cuts that out for repeated calls within the
// window. 5 minutes is short enough that removing someone from the Staff
// sheet takes effect quickly, and well under the token's own ~1hr lifetime,
// so this can't return a validation result for a token Google has since
// invalidated by more than the cache window.
var AUTH_CACHE_SECONDS = 300;

function requireAuth(params) {
  var idToken = params.idToken;
  if (!idToken) throw new Error('Missing idToken');

  var cache = CacheService.getScriptCache();
  var cacheKey = 'auth_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var email = verifyIdTokenAndGetEmail(idToken);
  var staff = getStaffByEmail(email);
  if (!staff) throw new Error('Not authorized: ' + email);

  cache.put(cacheKey, JSON.stringify(staff), AUTH_CACHE_SECONDS);
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
    ItemsJSON: JSON.stringify(lineItems),
    Status: 'Active',
    TableNumber: params.tableNumber || ''
  };
  appendRow(SHEET_BILLS, BILLS_HEADERS, bill);
  var billRowIdx = getSheet(SHEET_BILLS).getLastRow();
  forceCellAsText(SHEET_BILLS, BILLS_HEADERS, billRowIdx, 'CustomerPhone', bill.CustomerPhone);
  forceCellAsText(SHEET_BILLS, BILLS_HEADERS, billRowIdx, 'TableNumber', bill.TableNumber);

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
    cgstRate: cgstRate,
    status: 'Active',
    tableNumber: bill.TableNumber
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Rows written before the Status column existed come back with it blank --
// treated as Active so old bills don't vanish from History/Reports.
function billStatus(row) {
  return row.Status || 'Active';
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
    phone: settings.Phone,
    status: billStatus(row),
    voidReason: row.VoidReason || '',
    voidedAt: row.VoidedAt || '',
    tableNumber: row.TableNumber || ''
  };
}

function getBills(params) {
  var all = sheetToObjects(SHEET_BILLS, BILLS_HEADERS);
  var search = String(params.search || '').toLowerCase();
  var dateFrom = params.dateFrom;
  var dateTo = params.dateTo;
  var includeVoided = params.includeVoided === 'true';

  var filtered = all.filter(function (b) {
    if (!includeVoided && billStatus(b) === 'Voided') return false;
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

function voidBill(params) {
  var reason = String(params.reason || '').trim();
  if (!reason) throw new Error('A reason is required to void a bill.');
  var rowIdx = findRowIndexByKey(SHEET_BILLS, BILLS_HEADERS, 'BillNo', params.billNo);
  if (rowIdx < 0) throw new Error('Bill not found');
  var sh = getSheet(SHEET_BILLS);
  var statusCol = BILLS_HEADERS.indexOf('Status') + 1;
  var existing = sh.getRange(rowIdx, statusCol).getValue();
  if (existing === 'Voided') throw new Error('This bill is already voided.');
  var voidedAt = new Date().toISOString();
  sh.getRange(rowIdx, statusCol).setValue('Voided');
  sh.getRange(rowIdx, BILLS_HEADERS.indexOf('VoidedAt') + 1).setValue(voidedAt);
  forceCellAsText(SHEET_BILLS, BILLS_HEADERS, rowIdx, 'VoidReason', reason);
  return { billNo: params.billNo, status: 'Voided', voidReason: reason, voidedAt: voidedAt };
}

// ---------- Dine-in orders (tables) ----------

function orderRowToOrder(row) {
  return {
    orderId: row.OrderId,
    tableNumber: row.TableNumber,
    customerName: row.CustomerName,
    customerPhone: row.CustomerPhone,
    paymentMethod: row.PaymentMethod,
    discount: row.Discount,
    items: JSON.parse(row.ItemsJSON || '[]'),
    updatedAt: row.UpdatedAt
  };
}

// Every open order at once, for the Tables grid to know which table numbers
// are occupied.
function getOpenOrders() {
  var all = sheetToObjects(SHEET_ORDERS, ORDERS_HEADERS);
  return all.map(orderRowToOrder);
}

function getOrder(params) {
  var all = sheetToObjects(SHEET_ORDERS, ORDERS_HEADERS);
  var found = null;
  if (params.orderId) {
    found = all.filter(function (o) { return String(o.OrderId) === String(params.orderId); })[0];
  } else if (params.tableNumber) {
    found = all.filter(function (o) { return String(o.TableNumber) === String(params.tableNumber); })[0];
  }
  return found ? orderRowToOrder(found) : null;
}

// Upserts a table's draft order -- called repeatedly (debounced client-side)
// as items/customer/payment/discount change, so the current state of an
// in-progress order is never lost and any device can see it. Reuses an
// existing open order for the table if no orderId was given and one already
// exists there, instead of creating a duplicate (guards a double-tap
// starting the same table twice).
function saveOrder(params) {
  var sh = getSheet(SHEET_ORDERS);
  var orderId = params.orderId;
  var rowIdx = orderId ? findRowIndexByKey(SHEET_ORDERS, ORDERS_HEADERS, 'OrderId', orderId) : -1;
  if (rowIdx < 0 && !orderId) {
    rowIdx = findRowIndexByKey(SHEET_ORDERS, ORDERS_HEADERS, 'TableNumber', params.tableNumber);
    if (rowIdx >= 0) orderId = String(sh.getRange(rowIdx, ORDERS_HEADERS.indexOf('OrderId') + 1).getValue());
  }
  if (!orderId) orderId = 'O' + new Date().getTime() + Math.floor(Math.random() * 1000);

  var fields = {
    OrderId: orderId,
    TableNumber: params.tableNumber,
    CustomerName: params.customerName || '',
    CustomerPhone: params.customerPhone || '',
    PaymentMethod: params.paymentMethod || 'Cash',
    Discount: params.discount || '0',
    ItemsJSON: params.items || '[]',
    UpdatedAt: new Date().toISOString()
  };

  if (rowIdx < 0) {
    appendRow(SHEET_ORDERS, ORDERS_HEADERS, fields);
    rowIdx = sh.getLastRow();
  } else {
    ORDERS_HEADERS.forEach(function (h, i) {
      sh.getRange(rowIdx, i + 1).setValue(fields[h]);
    });
  }
  forceCellAsText(SHEET_ORDERS, ORDERS_HEADERS, rowIdx, 'CustomerPhone', fields.CustomerPhone);
  forceCellAsText(SHEET_ORDERS, ORDERS_HEADERS, rowIdx, 'TableNumber', fields.TableNumber);
  return { orderId: orderId };
}

// Frees a table without creating a bill -- e.g. an accidental tap, or a
// guest who leaves without ordering.
function cancelOrder(params) {
  var rowIdx = findRowIndexByKey(SHEET_ORDERS, ORDERS_HEADERS, 'OrderId', params.orderId);
  if (rowIdx < 0) throw new Error('Order not found');
  getSheet(SHEET_ORDERS).deleteRow(rowIdx);
  return { ok: true };
}

// Converts a table's draft order into a real bill (same createBill logic,
// so totals/tax are computed the same way and it shows up in
// History/Reports normally), then frees the table.
function finalizeOrder(params) {
  var rowIdx = findRowIndexByKey(SHEET_ORDERS, ORDERS_HEADERS, 'OrderId', params.orderId);
  if (rowIdx < 0) throw new Error('Order not found');
  var order = sheetToObjects(SHEET_ORDERS, ORDERS_HEADERS)[rowIdx - 2];
  if (!order.ItemsJSON || order.ItemsJSON === '[]') throw new Error('Add at least one dish before finalizing.');

  var bill = createBill({
    customerName: order.CustomerName,
    customerPhone: order.CustomerPhone,
    items: order.ItemsJSON,
    discount: order.Discount,
    paymentMethod: order.PaymentMethod,
    tableNumber: order.TableNumber
  });
  getSheet(SHEET_ORDERS).deleteRow(rowIdx);
  return bill;
}

function getReports(params) {
  var dateFrom = params.dateFrom;
  var dateTo = params.dateTo;
  var all = sheetToObjects(SHEET_BILLS, BILLS_HEADERS).filter(function (b) {
    if (billStatus(b) === 'Voided') return false;
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
    [SHEET_BILLS, BILLS_HEADERS],
    [SHEET_ORDERS, ORDERS_HEADERS]
  ];
  defs.forEach(function (def) {
    var name = def[0], headers = def[1];
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  });

  // Backfills any DEFAULT_SETTINGS key not already present (e.g. TableCount
  // added after a Sheet was already set up), instead of only seeding
  // defaults the very first time this runs.
  var settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  var presentKeys = {};
  if (settingsSheet.getLastRow() >= 2) {
    settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 1).getValues().forEach(function (row) {
      if (row[0]) presentKeys[row[0]] = true;
    });
  }
  Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
    if (!presentKeys[key]) settingsSheet.appendRow([key, DEFAULT_SETTINGS[key]]);
  });
}
