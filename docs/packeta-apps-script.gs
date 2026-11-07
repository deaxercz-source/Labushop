// LabuShop → Zásilkovna: vytvoří zásilku a vrátí její kód, případně ji stornuje.
// API heslo je uložené jen ve „Vlastnostech skriptu“ (PACKETA_PASSWORD), do appky ani na web se nikdy nedostane.
function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var req = JSON.parse(e.postData.contents);
    var token = props.getProperty('TOKEN');
    if (!token || req.token !== token) return out_({ ok: false, error: 'Špatný token (musí být stejný v appce i ve vlastnostech skriptu).' });
    var pw = props.getProperty('PACKETA_PASSWORD');
    if (!pw) return out_({ ok: false, error: 'Ve vlastnostech skriptu chybí PACKETA_PASSWORD.' });

    if (req.action === 'info') return out_(info_(pw, req.packetId));
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
    var r = UrlFetchApp.fetch('https://www.zasilkovna.cz/api/rest', {
      method: 'post', contentType: 'application/xml', payload: xml, muteHttpExceptions: true
    });

    var root = XmlService.parse(r.getContentText()).getRootElement();
    if (root.getChildText('status') === 'ok') {
      if (cancel) return out_({ ok: true, cancelled: true });
      var res = root.getChild('result');
      return out_({ ok: true, id: res.getChildText('id'), barcode: res.getChildText('barcode'), barcodeText: res.getChildText('barcodeText') });
    }
    var det = [];
    var walk = function (el) {
      var kids = el.getChildren();
      if (!kids.length) { if (el.getText()) det.push(el.getName() + ': ' + el.getText()); return; }
      kids.forEach(walk);
    };
    var d = root.getChild('detail');
    if (d) walk(d);
    return out_({ ok: false, error: [root.getChildText('fault'), root.getChildText('string'), det.join(', ')].filter(Boolean).join(' – ') || 'Zásilkovna vrátila chybu.' });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
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
  UrlFetchApp.fetch('https://www.zasilkovna.cz/api/rest', { muteHttpExceptions: true });
}

// Zkouška: vrátí surové odpovědi Zásilkovny o zásilce (jen čtení, nic nemění).
function info_(pw, packetId) {
  if (!packetId) return { ok: false, error: 'Chybí ID zásilky.' };
  var raw = {};
  ['packetInfo', 'packetStatus', 'packetTracking'].forEach(function (m) {
    var text = '';
    [String(packetId), 'Z' + packetId].some(function (pid) {
      var xml = '<' + m + '><apiPassword>' + esc_(pw) + '</apiPassword><packetId>' + esc_(pid) + '</packetId></' + m + '>';
      text = UrlFetchApp.fetch('https://www.zasilkovna.cz/api/rest', { method: 'post', contentType: 'application/xml', payload: xml, muteHttpExceptions: true }).getContentText();
      return text.indexOf('<status>ok</status>') >= 0;
    });
    raw[m] = text.split(pw).join('***');
  });
  return { ok: true, raw: raw };
}
