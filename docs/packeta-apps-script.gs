// LabuShop → Zásilkovna: vytvoří zásilku (vrátí trackovací číslo i podací kód), zjistí stav zásilek, případně zásilku stornuje.
// API heslo je uložené jen ve „Vlastnostech skriptu“ (PACKETA_PASSWORD), do appky ani na web se nikdy nedostane.
var API_URL = 'https://www.zasilkovna.cz/api/rest';

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var req = JSON.parse(e.postData.contents);
    var token = props.getProperty('TOKEN');
    if (!token || req.token !== token) return out_({ ok: false, error: 'Špatný token (musí být stejný v appce i ve vlastnostech skriptu).' });
    var pw = props.getProperty('PACKETA_PASSWORD');
    if (!pw) return out_({ ok: false, error: 'Ve vlastnostech skriptu chybí PACKETA_PASSWORD.' });

    if (req.action === 'status') return out_({ ok: true, items: status_(pw, Array.isArray(req.items) ? req.items : []) });

    var cancel = req.action === 'cancel';
    var xml;
    if (cancel) {
      if (!req.packetId) return out_({ ok: false, error: 'Chybí ID zásilky.' });
      xml = '<cancelPacket><apiPassword>' + esc_(pw) + '</apiPassword><packetId>' + esc_(req.packetId) + '</packetId></cancelPacket>';
    } else {
      var attrs = '';
      ['number', 'name', 'surname', 'email', 'phone', 'addressId', 'value', 'currency', 'weight', 'eshop'].forEach(function (k) {
        if (req[k] !== undefined && req[k] !== null && String(req[k]) !== '') attrs += '<' + k + '>' + esc_(req[k]) + '</' + k + '>';
      });
      xml = '<createPacket><apiPassword>' + esc_(pw) + '</apiPassword><packetAttributes>' + attrs + '</packetAttributes></createPacket>';
    }
    var r = UrlFetchApp.fetch(API_URL, { method: 'post', contentType: 'application/xml', payload: xml, muteHttpExceptions: true });

    var root = XmlService.parse(r.getContentText()).getRootElement();
    if (root.getChildText('status') === 'ok') {
      if (cancel) return out_({ ok: true, cancelled: true });
      var res = root.getChild('result');
      var barcode = res.getChildText('barcode');
      var code = '';
      try {   // podací kód (consignPassword) vrací packetInfo
        var inf = call_('packetInfo', pw, barcode);
        if (inf.getChildText('status') === 'ok') code = inf.getChild('result').getChildText('consignPassword') || '';
      } catch (ignore) {}
      return out_({ ok: true, id: res.getChildText('id'), barcode: barcode, barcodeText: res.getChildText('barcodeText'), consignPassword: code });
    }
    return out_({ ok: false, error: errText_(root) });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

// Stav zásilek (a podací kód, když o něj appka požádá přes info:true). Jen čtení.
function status_(pw, items) {
  return items.slice(0, 40).map(function (it) {
    var out = { id: it.id, ok: false };
    try {
      var st = call_('packetStatus', pw, it.id);
      if (st.getChildText('status') !== 'ok') { out.error = errText_(st); return out; }
      var res = st.getChild('result');
      out.ok = true;
      out.statusCode = Number(res.getChildText('statusCode'));
      out.codeText = res.getChildText('codeText');
      if (it.info) {
        var inf = call_('packetInfo', pw, it.id);
        if (inf.getChildText('status') === 'ok') out.consignPassword = inf.getChild('result').getChildText('consignPassword') || '';
      }
    } catch (err) {
      out.error = String(err && err.message || err);
    }
    return out;
  });
}

// Zavolá metodu s ID zásilky (zkusí zápis s písmenem Z i bez něj) a vrátí kořen odpovědi.
function call_(method, pw, packetId) {
  var id = String(packetId), alt = /^Z/i.test(id) ? id.slice(1) : 'Z' + id, root = null;
  [id, alt].some(function (pid) {
    var xml = '<' + method + '><apiPassword>' + esc_(pw) + '</apiPassword><packetId>' + esc_(pid) + '</packetId></' + method + '>';
    var r = UrlFetchApp.fetch(API_URL, { method: 'post', contentType: 'application/xml', payload: xml, muteHttpExceptions: true });
    root = XmlService.parse(r.getContentText()).getRootElement();
    return root.getChildText('status') === 'ok';
  });
  return root;
}

function errText_(root) {
  var det = [];
  var walk = function (el) {
    var kids = el.getChildren();
    if (!kids.length) { if (el.getText()) det.push(el.getName() + ': ' + el.getText()); return; }
    kids.forEach(walk);
  };
  var d = root.getChild('detail');
  if (d) walk(d);
  return [root.getChildText('fault'), root.getChildText('string'), det.join(', ')].filter(Boolean).join(' – ') || 'Zásilkovna vrátila chybu.';
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function esc_(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Jednorázově spusť tuhle funkci (tlačítko Spustit), aby Google zobrazil žádost o povolení.
// Jen zavolá web Zásilkovny, žádnou zásilku nevytváří.
function povolit() {
  UrlFetchApp.fetch(API_URL, { muteHttpExceptions: true });
}
