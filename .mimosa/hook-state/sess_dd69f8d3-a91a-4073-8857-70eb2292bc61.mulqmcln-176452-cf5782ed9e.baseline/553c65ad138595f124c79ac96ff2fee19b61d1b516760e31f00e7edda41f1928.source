/*
 * luna bridge.
 *
 * Two things matter here.
 *
 * 1. PalmServiceBridge is used directly instead of bundling LG's webOSTV.js.
 *    It is provided by the platform on every webOS TV generation, so the app
 *    keeps one code path and no third-party file to update. webOS.service is
 *    used as a fallback when it happens to be present.
 *
 * 2. When neither exists - a desktop browser, or a TV that refused to launch
 *    the service - the app must not simply die. A simulator answers the same
 *    calls with plausible data so the interface stays usable for development
 *    and screenshots, and the UI shows a "demo mode" banner so nobody mistakes
 *    simulated results for real ones.
 */

(function (global) {
  'use strict';

  var SERVICE_NAME = 'com.zcode.wol.service';
  var URI = 'luna://' + SERVICE_NAME + '/';
  var CALL_TIMEOUT_MS = 20000;

  function hasPalmBridge() {
    return typeof global.PalmServiceBridge === 'function';
  }

  function hasWebOSService() {
    return !!(global.webOS && global.webOS.service && typeof global.webOS.service.request === 'function');
  }

  function mode() {
    if (hasPalmBridge()) return 'PalmServiceBridge';
    if (hasWebOSService()) return 'webOS.service';
    return 'none';
  }

  /* ------------------------------------------------------------------ *
   * Real bridge
   * ------------------------------------------------------------------ */

  function viaPalmBridge(method, params, callback) {
    var bridge = new global.PalmServiceBridge();
    var settled = false;
    var timer = null;

    function settle(err, result) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback(err, result);
    }

    bridge.onservicecallback = function (raw) {
      var parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        return settle(new Error('MALFORMED_RESPONSE'));
      }
      if (parsed && (parsed.returnValue === false || parsed.errorCode)) {
        var err = new Error(parsed.errorText || 'SERVICE_ERROR');
        err.code = parsed.errorCode;
        return settle(err, parsed);
      }
      settle(null, parsed);
    };

    timer = setTimeout(function () {
      settle(new Error('TIMEOUT'));
    }, CALL_TIMEOUT_MS);

    try {
      bridge.call(URI + method, JSON.stringify(params || {}));
    } catch (e) {
      settle(e);
    }

    return {
      cancel: function () {
        settled = true;
        if (timer) clearTimeout(timer);
        try { bridge.cancel(); } catch (e) { /* nothing to cancel */ }
      }
    };
  }

  function viaWebOSService(method, params, callback) {
    var settled = false;
    var timer = null;

    function settle(err, result) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback(err, result);
    }

    timer = setTimeout(function () { settle(new Error('TIMEOUT')); }, CALL_TIMEOUT_MS);

    global.webOS.service.request(URI + method, {
      method: method,
      parameters: params || {},
      timeout: CALL_TIMEOUT_MS,
      onSuccess: function (result) { settle(null, result); },
      onFailure: function (failure) {
        var err = new Error((failure && failure.errorText) || 'SERVICE_ERROR');
        err.code = failure && failure.errorCode;
        settle(err, failure);
      }
    });

    return { cancel: function () { settled = true; if (timer) clearTimeout(timer); } };
  }

  /* ------------------------------------------------------------------ *
   * Simulator for development outside a TV
   * ------------------------------------------------------------------ */

  var fake = {
    interfaces: [
      { name: 'wlan0', address: '192.168.1.23', netmask: '255.255.255.0', mac: 'a4:c4:94:1b:2c:3d' }
    ],
    broadcasts: ['192.168.1.255'],
    arp: [
      { ip: '192.168.1.1', mac: '74:44:01:aa:bb:cc', device: 'wlan0', source: 'proc' },
      { ip: '192.168.1.20', mac: 'b8:27:eb:12:34:56', device: 'wlan0', source: 'proc' },
      { ip: '192.168.1.42', mac: 'f0:4d:a2:11:22:33', device: 'wlan0', source: 'proc' },
      { ip: '192.168.1.77', mac: '00:11:32:de:ad:be', device: 'wlan0', source: 'proc' }
    ],
    scan: null,
    scanSeq: 0
  };

  function fakeDelay(fn, ms) {
    var timer = setTimeout(fn, ms || 400);
    return { cancel: function () { clearTimeout(timer); } };
  }

  function simulate(method, params, callback) {
    var payload = params || {};

    switch (method) {
      case 'info':
        return fakeDelay(function () {
          callback(null, {
            returnValue: true,
            serviceName: SERVICE_NAME,
            interfaces: fake.interfaces,
            broadcasts: fake.broadcasts,
            subnetInfo: { prefixes: ['192.168.1'], assumed24: false },
            nodeVersion: 'simulated'
          });
        }, 150);

      case 'diagnostics':
        return fakeDelay(function () {
          callback(null, {
            returnValue: true,
            platform: 'linux (simulated)',
            arch: 'arm',
            nodeVersion: 'simulated',
            interfaces: fake.interfaces,
            broadcasts: fake.broadcasts,
            subnetInfo: { prefixes: ['192.168.1'], assumed24: false },
            timestamp: Date.now(),
            udp: {
              ok: true,
              error: null,
              targets: [
                { target: '255.255.255.255', port: 9, ok: true, error: null },
                { target: '192.168.1.255', port: 9, ok: true, error: null }
              ]
            },
            arp: { ok: true, count: fake.arp.length, error: null },
            backup: { ok: true, path: '/home/root/zcode-wol-backup.json', error: null }
          });
        }, 900);

      case 'send':
        return fakeDelay(function () {
          if (!payload.mac) {
            return callback(new Error('INVALID_MAC'));
          }
          callback(null, {
            returnValue: true,
            mac: payload.mac,
            port: payload.port || 9,
            repeat: 3,
            packetBytes: 102,
            targets: ['255.255.255.255', '192.168.1.255'],
            attempts: 6,
            delivered: 6,
            results: [
              { target: '255.255.255.255', port: 9, ok: true, error: null },
              { target: '192.168.1.255', port: 9, ok: true, error: null }
            ]
          });
        }, 450);

      case 'probe':
        return fakeDelay(function () {
          callback(null, { returnValue: true, ip: payload.ip, alive: true, openPorts: [], reason: 'refused' });
        }, 600);

      case 'arp':
        return fakeDelay(function () {
          callback(null, { returnValue: true, count: fake.arp.length, entries: fake.arp });
        }, 200);

      case 'scanStart':
        fake.scanSeq++;
        fake.scan = { scanId: 'sim-' + fake.scanSeq, status: 'running', done: 0, total: 254, found: [] };
        (function tick() {
          if (!fake.scan || fake.scan.status !== 'running') return;
          fake.scan.done = Math.min(fake.scan.total, fake.scan.done + 24);
          if (fake.scan.done > 60 && fake.scan.found.length === 0) {
            fake.scan.found.push(
              { ip: '192.168.1.1', mac: '74:44:01:aa:bb:cc', alive: true, openPorts: [80, 443], reason: 'open', device: 'wlan0', macSource: 'proc' },
              { ip: '192.168.1.20', mac: 'b8:27:eb:12:34:56', alive: true, openPorts: [22], reason: 'open', device: 'wlan0', macSource: 'proc' },
              { ip: '192.168.1.42', mac: 'f0:4d:a2:11:22:33', alive: true, openPorts: [], reason: 'refused', device: 'wlan0', macSource: 'proc' }
            );
          }
          if (fake.scan.done >= fake.scan.total) fake.scan.status = 'done';
          else setTimeout(tick, 260);
        }());
        return fakeDelay(function () {
          callback(null, { returnValue: true, scanId: fake.scan.scanId, total: 254, prefixes: ['192.168.1'], assumed24: false });
        }, 200);

      case 'scanStatus':
        return fakeDelay(function () {
          if (!fake.scan) return callback(null, { returnValue: true, status: 'idle', done: 0, total: 0, found: [] });
          var snapshot = {
            returnValue: true,
            scanId: fake.scan.scanId,
            status: fake.scan.status,
            done: fake.scan.done,
            total: fake.scan.total,
            found: fake.scan.found.slice()
          };
          callback(null, snapshot);
        }, 120);

      case 'scanCancel':
        if (fake.scan) fake.scan.status = 'cancelled';
        return fakeDelay(function () { callback(null, { returnValue: true, cancelled: true }); }, 100);

      case 'backupWrite':
        return fakeDelay(function () {
          callback(null, { returnValue: true, path: '/home/root/zcode-wol-backup.json' });
        }, 300);

      case 'backupRead':
        return fakeDelay(function () {
          var err = new Error('NO_BACKUP');
          err.code = 8;
          callback(err);
        }, 300);

      case 'log':
        return fakeDelay(function () { callback(null, { returnValue: true }); }, 10);

      default:
        return fakeDelay(function () { callback(new Error('NO_SUCH_METHOD')); }, 50);
    }
  }

  /* ------------------------------------------------------------------ *
   * Public surface
   * ------------------------------------------------------------------ */

  function call(method, params, callback) {
    var handler = callback || function () {};
    var kind = mode();

    if (kind === 'PalmServiceBridge') return viaPalmBridge(method, params, handler);
    if (kind === 'webOS.service') return viaWebOSService(method, params, handler);
    // No bridge: a desktop browser, or a TV that refused to start the service.
    return simulate(method, params, handler);
  }

  // Promise wrapper - keeps the view code readable, and Chromium on webOS 4.0
  // understands native promises.
  function request(method, params) {
    return new Promise(function (resolve, reject) {
      call(method, params, function (err, result) {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  global.Luna = {
    serviceName: SERVICE_NAME,
    uri: URI,
    mode: mode,
    isLive: function () { return mode() !== 'none'; },
    call: call,
    request: request
  };

}(window));
