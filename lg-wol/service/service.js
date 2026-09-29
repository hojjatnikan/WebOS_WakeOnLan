/*
 * Wake On LAN - webOS TV backend service.
 *
 * The web view of a webOS app runs inside a sandboxed browser and cannot open
 * raw UDP sockets, so the actual magic packets are emitted from here: a Node.js
 * service registered on the luna bus at luna://com.zcode.wol.service/<method>.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE MUST STAY ES5 AND CALLBACK-BASED. DO NOT MODERNISE IT.
 *
 * webOS TV maps JS services to very old Node runtimes:
 *
 *     webOS TV 3.x / 4.x  ->  Node v0.12.2
 *     webOS TV 5.0 / 6.0  ->  Node v8.12.0
 *     webOS TV 22 / 23    ->  Node v12.x
 *     webOS TV 25 / 26    ->  Node v16 / v20
 *
 * Node 0.12 has no native Promise (it arrived in Node 4) and, per LG's own
 * documentation, webOS TV 4.x and lower do not support ES6 syntax at all:
 * no const/let, no arrow functions, no destructuring, no template literals.
 *
 * A single `Promise` reference anywhere in this file makes the service throw on
 * load, which on the TV looks like nothing happening at all: luna reports the
 * service as missing and no process is left behind to inspect. That is exactly
 * how this file failed the first time it ran on a real 2018 set.
 *
 * So: var, function, and callbacks. The browser side (js/*.js) is a different
 * story - that runs in Chromium, where promises are fine.
 * ---------------------------------------------------------------------------
 *
 * Exposed methods
 *   network       - local IPv4 interfaces + derived broadcast addresses
 *   diagnostics   - real end-to-end self test of the UDP path on this TV
 *   send          - build and emit magic packets towards one MAC address
 *   probe         - TCP reachability check ("TCP ping") for one host
 *   arp           - IP/MAC pairs taken from the kernel ARP cache
 *   scanStart     - background /24 sweep, polled with scanStatus
 *   scanStatus    - progress + live hosts of a running/finished sweep
 *   scanCancel    - stop a running sweep
 *   backupWrite   - persist a JSON blob to disk
 *   backupRead    - read it back
 *
 * The file also loads under plain Node (no webos-service module), which is how
 * tools/selftest.js exercises the packet builder without a TV attached.
 */

'use strict';

var dgram = require('dgram');
var net = require('net');
var os = require('os');
var fs = require('fs');
var path = require('path');

// The service name has exactly one source of truth: the service's own
// package.json, which webOS also reads when it registers the service.
var SERVICE_NAME = require('./package.json').name;

// fs.R_OK and friends moved under fs.constants in modern Node, but Node 0.12 on
// webOS TV 4.x only exposes the top-level constants. Accept either.
var FS_FLAGS = (fs.constants && fs.constants.R_OK) ? fs.constants : fs;

/* ------------------------------------------------------------------ *
 * Small compatibility helpers
 * ------------------------------------------------------------------ */

function alloc(size) {
  return typeof Buffer.alloc === 'function' ? Buffer.alloc(size) : new Buffer(size);
}

function bufferFrom(array) {
  return typeof Buffer.from === 'function' ? Buffer.from(array) : new Buffer(array);
}

function delay(ms, callback) {
  setTimeout(callback, ms);
}

function clamp(value, min, max) {
  var n = Number(value);
  if (isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/* ------------------------------------------------------------------ *
 * MAC handling and the magic packet itself
 * ------------------------------------------------------------------ */

// Accepts "aa:bb:cc:dd:ee:ff", "AA-BB-CC-DD-EE-FF", "aabbccddeeff" and any
// other punctuation, returns the canonical colon form or null.
function normalizeMac(input) {
  if (typeof input !== 'string') return null;
  var hex = input.replace(/[^0-9a-fA-F]/g, '');
  if (hex.length !== 12) return null;
  hex = hex.toLowerCase();
  var groups = [];
  for (var i = 0; i < 12; i += 2) groups.push(hex.substr(i, 2));
  return groups.join(':');
}

function macToBuffer(mac) {
  var normalized = normalizeMac(mac);
  if (!normalized) return null;
  var bytes = [];
  var parts = normalized.split(':');
  for (var i = 0; i < parts.length; i++) bytes.push(parseInt(parts[i], 16));
  return bufferFrom(bytes);
}

// 6 x 0xFF followed by the MAC repeated 16 times = 102 bytes.
function buildMagicPacket(mac) {
  var macBuffer = macToBuffer(mac);
  if (!macBuffer) return null;
  var packet = alloc(6 + 16 * 6);
  packet.fill(0xff, 0, 6);
  for (var i = 0; i < 16; i++) macBuffer.copy(packet, 6 + i * 6);
  return packet;
}

/* ------------------------------------------------------------------ *
 * Network inventory
 * ------------------------------------------------------------------ */

function ipv4Interfaces() {
  var result = [];
  var interfaces = os.networkInterfaces() || {};
  Object.keys(interfaces).forEach(function (name) {
    var list = interfaces[name] || [];
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      var isIpv4 = entry.family === 4 || entry.family === 'IPv4';
      if (!isIpv4 || entry.internal) continue;
      result.push({
        name: name,
        address: entry.address,
        netmask: entry.netmask,
        mac: entry.mac,
        internal: false
      });
    }
  });
  return result;
}

function broadcastFor(address, netmask) {
  if (!address || !netmask) return null;
  var ip = String(address).split('.');
  var mask = String(netmask).split('.');
  if (ip.length !== 4 || mask.length !== 4) return null;
  var out = [];
  for (var i = 0; i < 4; i++) {
    var a = parseInt(ip[i], 10);
    var m = parseInt(mask[i], 10);
    if (isNaN(a) || isNaN(m)) return null;
    out.push((a & m) | (~m & 255));
  }
  return out.join('.');
}

function localBroadcasts() {
  var out = [];
  ipv4Interfaces().forEach(function (entry) {
    var broadcast = broadcastFor(entry.address, entry.netmask);
    if (broadcast && out.indexOf(broadcast) === -1) out.push(broadcast);
  });
  return out;
}

// The sweep assumes a /24, which is what virtually every home router hands out.
function localSubnets() {
  var out = [];
  var assumed24 = false;
  ipv4Interfaces().forEach(function (entry) {
    if (entry.netmask !== '255.255.255.0') assumed24 = true;
    var prefix = String(entry.address).split('.').slice(0, 3).join('.');
    if (prefix && out.indexOf(prefix) === -1) out.push(prefix);
  });
  return { prefixes: out, assumed24: assumed24 };
}

/* ------------------------------------------------------------------ *
 * ARP cache: the only way to learn a MAC without asking the user
 * ------------------------------------------------------------------ */

function readProcArp() {
  var entries = [];
  var text = fs.readFileSync('/proc/net/arp', 'utf8');
  var lines = text.split('\n');
  for (var i = 1; i < lines.length; i++) {
    var parts = lines[i].trim().split(/\s+/);
    if (parts.length < 4) continue;
    var mac = parts[3];
    if (!mac || mac === '00:00:00:00:00:00') continue;
    entries.push({
      ip: parts[0],
      mac: normalizeMac(mac) || mac,
      device: parts[5] || '',
      source: 'proc'
    });
  }
  return entries;
}

function parseIpNeigh(text) {
  var entries = [];
  String(text).split('\n').forEach(function (line) {
    var match = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+dev\s+(\S+)\s+lladdr\s+([0-9a-fA-F:]{17})/);
    if (!match) return;
    entries.push({
      ip: match[1],
      mac: normalizeMac(match[3]) || match[3],
      device: match[2],
      source: 'ip'
    });
  });
  return entries;
}

function parseArpDashA(text) {
  var entries = [];
  String(text).split('\n').forEach(function (line) {
    var match = line.match(/\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-fA-F:]{17})/);
    if (!match) return;
    var deviceMatch = line.match(/on\s+(\S+)/);
    entries.push({
      ip: match[1],
      mac: normalizeMac(match[2]) || match[2],
      device: deviceMatch ? deviceMatch[1] : '',
      source: 'arp'
    });
  });
  return entries;
}

// /proc/net/arp is the cheapest source and the only one that works when
// child_process is unavailable. The command line tools are queried only if it
// came back empty, because some firmwares hide /proc from the app sandbox.
// Both execFileSync calls use a fixed binary with a fixed argument list - no
// shell, and nothing from the caller ever reaches the command line.
function allArpEntries() {
  var collected = [];

  try {
    collected = collected.concat(readProcArp());
  } catch (e) { /* not readable on this firmware */ }

  if (collected.length === 0) {
    try {
      var childProcess = require('child_process');

      try {
        var ipNeigh = childProcess.execFileSync('ip', ['neigh', 'show'], {
          timeout: 1500,
          encoding: 'utf8'
        });
        collected = collected.concat(parseIpNeigh(ipNeigh));
      } catch (e) { /* ip(8) missing or blocked */ }

      if (collected.length === 0) {
        try {
          var arpDashA = childProcess.execFileSync('arp', ['-a'], {
            timeout: 1500,
            encoding: 'utf8'
          });
          collected = collected.concat(parseArpDashA(arpDashA));
        } catch (e) { /* arp(8) missing or blocked */ }
      }
    } catch (e) { /* child_process unavailable */ }
  }

  // De-duplicate by IP, keeping the first real hardware address seen.
  var byIp = {};
  var out = [];
  collected.forEach(function (entry) {
    if (byIp[entry.ip]) return;
    byIp[entry.ip] = true;
    out.push(entry);
  });
  return out;
}

function arpLookup(ip, entries) {
  for (var i = 0; i < (entries || []).length; i++) {
    if (entries[i].ip === ip) return entries[i];
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * TCP probing
 * ------------------------------------------------------------------ */

// A closed port answering with RST means the host is awake, an open port means
// the same, silence means it is off or firewalled. ECONNREFUSED is valuable
// information, not a failure.
function tcpProbe(ip, port, timeoutMs, callback) {
  var socket = new net.Socket();
  var settled = false;

  function finish(state, detail) {
    if (settled) return;
    settled = true;
    try { socket.destroy(); } catch (e) { /* already gone */ }
    callback({ port: port, state: state, detail: detail || null });
  }

  socket.setTimeout(timeoutMs, function () { finish('timeout', 'ETIMEDOUT'); });
  socket.once('connect', function () { finish('open'); });
  socket.once('error', function (err) {
    var code = err && err.code ? err.code : 'EUNKNOWN';
    if (code === 'ECONNREFUSED') finish('refused', code);
    else finish('dead', code);
  });

  try {
    socket.connect(port, ip);
  } catch (e) {
    finish('dead', 'EINVAL');
  }
}

var DEFAULT_PROBE_PORTS = [9, 80, 443, 22, 3389, 445, 5900, 62078];

function probeHost(ip, ports, timeoutMs, callback) {
  var list = (ports && ports.length ? ports : DEFAULT_PROBE_PORTS).slice(0, 16);
  var open = [];
  var alive = false;
  var reason = null;
  var index = 0;

  function next() {
    if (index >= list.length) {
      return callback({ alive: alive, openPorts: open, reason: reason });
    }
    var port = list[index++];
    tcpProbe(ip, port, timeoutMs, function (result) {
      if (result.state === 'open') { open.push(port); alive = true; reason = reason || 'open'; }
      else if (result.state === 'refused' && !alive) { alive = true; reason = 'refused'; }
      next();
    });
  }

  next();
}

/* ------------------------------------------------------------------ *
 * Sending
 * ------------------------------------------------------------------ */

function sendPacket(packet, target, port, callback) {
  var socket = dgram.createSocket('udp4');
  var settled = false;

  function finish(error) {
    if (settled) return;
    settled = true;
    try { socket.close(); } catch (e) { /* already closed */ }
    callback({
      target: target,
      port: port,
      ok: !error,
      error: error ? (error.code || error.message) : null
    });
  }

  socket.once('error', function (err) { finish(err); });

  try {
    socket.bind(0, function () {
      try { socket.setBroadcast(true); } catch (e) { /* unicast needs no broadcast */ }
      socket.send(packet, 0, packet.length, port, target, function (err) {
        finish(err || null);
      });
    });
  } catch (e) {
    finish(e);
  }
}

// WOL is fire-and-forget UDP, so the same packet goes out over every plausible
// route: the unicast address (works when the ARP entry is still warm), the
// limited broadcast, and each interface's directed broadcast. Then it is
// repeated a few times because the first datagram is frequently lost.
function sendWake(options, callback) {
  var packet = buildMagicPacket(options.mac);
  if (!packet) {
    return callback(new Error('INVALID_MAC'));
  }

  var port = clamp(options.port || 9, 1, 65535);
  var repeat = clamp(options.repeat || 3, 1, 10);
  var intervalMs = clamp(options.intervalMs || 120, 20, 2000);

  var targets = [];
  function addTarget(value) {
    if (value && targets.indexOf(value) === -1) targets.push(value);
  }
  addTarget(options.ip);
  if (options.broadcast) addTarget(options.broadcast);
  addTarget('255.255.255.255');
  if (options.useLocalBroadcast !== false) {
    localBroadcasts().forEach(addTarget);
  }

  var results = [];
  var targetIndex = 0;
  var round = 0;

  function finish() {
    var okCount = 0;
    for (var i = 0; i < results.length; i++) if (results[i].ok) okCount++;
    callback(null, {
      packetBytes: packet.length,
      port: port,
      repeat: repeat,
      targets: targets,
      attempts: results.length,
      delivered: okCount,
      results: results
    });
  }

  function afterSend(result) {
    results.push(result);
    step();
  }

  function step() {
    if (targetIndex >= targets.length) return finish();

    var target = targets[targetIndex];

    if (round >= repeat) {
      targetIndex++;
      round = 0;
      return step();
    }

    var isFirstRound = round === 0;
    round++;

    if (isFirstRound) {
      sendPacket(packet, target, port, afterSend);
    } else {
      delay(intervalMs, function () {
        sendPacket(packet, target, port, afterSend);
      });
    }
  }

  step();
}

/* ------------------------------------------------------------------ *
 * Background sweep
 * ------------------------------------------------------------------ */

var SCAN_DEFAULT_PORTS = [9, 80, 443];

function scanSnapshot(scan) {
  return {
    scanId: scan.id,
    status: scan.status,
    done: scan.done,
    total: scan.total,
    cancelled: !!scan.cancelled,
    found: scan.found,
    ports: scan.ports,
    startedAt: scan.startedAt,
    finishedAt: scan.finishedAt || null
  };
}

// A plain counter-based worker pool. A promise pool would be tidier and is
// unusable here - see the note at the top of this file.
function runScan(scan, callback) {
  var arp = allArpEntries();
  var queue = scan.hosts.slice();
  var active = 0;
  var finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    scan.status = scan.cancelled ? 'cancelled' : 'done';
    scan.finishedAt = Date.now();
    callback();
  }

  function pump() {
    if (finished) return;

    if (scan.cancelled) {
      if (active === 0) finish();
      return;
    }

    while (active < scan.concurrency && queue.length) {
      (function (ip) {
        active++;
        probeHost(ip, scan.ports, scan.timeoutMs, function (result) {
          active--;
          scan.done++;

          if (result.alive) {
            var arpEntry = arpLookup(ip, arp);
            scan.found.push({
              ip: ip,
              mac: arpEntry ? arpEntry.mac : null,
              alive: true,
              openPorts: result.openPorts,
              reason: result.reason,
              device: arpEntry ? arpEntry.device : null,
              macSource: arpEntry ? arpEntry.source : null
            });
          }

          pump();
        });
      }(queue.shift()));
    }

    if (active === 0 && queue.length === 0) finish();
  }

  pump();
}

/* ------------------------------------------------------------------ *
 * Config backup on disk
 * ------------------------------------------------------------------ */

var BACKUP_NAME = 'zcode-wol-backup.json';

// os.homedir() only exists from Node 2.0, so the environment is consulted first
// and a couple of known writable locations are tried after it.
function backupDirectory() {
  var candidates = [];
  if (process.env && process.env.HOME) candidates.push(process.env.HOME);
  candidates.push('/home/root');
  candidates.push('/tmp');

  for (var i = 0; i < candidates.length; i++) {
    var dir = candidates[i];
    if (!dir) continue;
    try {
      fs.accessSync(dir, FS_FLAGS.R_OK | FS_FLAGS.W_OK);
      return dir;
    } catch (e) { /* try the next one */ }
  }
  return null;
}

function backupPath() {
  var dir = backupDirectory();
  return dir ? path.join(dir, BACKUP_NAME) : null;
}

/* ------------------------------------------------------------------ *
 * Diagnostics
 * ------------------------------------------------------------------ */

function diagnostics(callback) {
  var report = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    interfaces: ipv4Interfaces(),
    broadcasts: localBroadcasts(),
    subnetInfo: localSubnets(),
    timestamp: Date.now(),
    udp: { ok: false, error: null, targets: [] },
    arp: { ok: false, count: 0, error: null },
    backup: { ok: false, path: backupPath(), error: null }
  };

  var arpEntries = allArpEntries();
  report.arp.ok = arpEntries.length > 0;
  report.arp.count = arpEntries.length;

  try {
    fs.accessSync(path.dirname(report.backup.path || ''), FS_FLAGS.W_OK);
    report.backup.ok = !!report.backup.path;
  } catch (e) {
    report.backup.error = String(e && e.message ? e.message : e);
  }

  // Prove the UDP path by actually broadcasting one packet to port 9 with a
  // throw away MAC. This is the one check that answers "will WOL ever work from
  // this TV on this firmware".
  sendWake({ mac: '01:02:03:04:05:06', port: 9, repeat: 1, intervalMs: 20 }, function (err, result) {
    if (err) {
      report.udp.error = String(err && err.message ? err.message : err);
    } else {
      report.udp.ok = result.delivered > 0;
      report.udp.targets = result.results;
    }
    callback(report);
  });
}

/* ------------------------------------------------------------------ *
 * Module export when running outside webOS (see tools/selftest.js)
 * ------------------------------------------------------------------ */

var WebOSService = null;
try {
  WebOSService = require('webos-service');
} catch (e) {
  WebOSService = null;
}

var helpers = {
  normalizeMac: normalizeMac,
  buildMagicPacket: buildMagicPacket,
  broadcastFor: broadcastFor,
  parseIpNeigh: parseIpNeigh,
  parseArpDashA: parseArpDashA,
  readProcArp: readProcArp,
  ipv4Interfaces: ipv4Interfaces,
  localBroadcasts: localBroadcasts,
  probeHost: probeHost,
  backupPath: backupPath
};

if (!WebOSService) {
  // Plain Node, or tools/selftest.js running on a PC: hand the pure helpers to
  // the caller. The registration block below still runs, against the stub, so
  // this file needs no top-level "return" - that is illegal outside a function
  // and makes ares-package's minifier reject the whole service.
  module.exports = helpers;
}

// require('webos-service') exports the Service constructor itself in current
// runtimes; older ones exposed it as a .Service property. Accept both.
//
// With no module present a no-op stub is returned instead, which is what lets
// this file load on a plain Node process.
function serviceConstructor(webosService) {
  if (!webosService) {
    return function () {
      return { register: function () {} };
    };
  }
  return typeof webosService === 'function' ? webosService : webosService.Service;
}

/* ------------------------------------------------------------------ *
 * luna interface
 * ------------------------------------------------------------------ */

var service = new (serviceConstructor(WebOSService))(SERVICE_NAME);
var lastScan = null;
var scanCounter = 0;

function respondError(message, errorText, errorCode) {
  message.respond({
    returnValue: false,
    errorCode: errorCode || 1,
    errorText: String(errorText)
  });
}

function errorTextOf(err) {
  if (!err) return 'UNKNOWN';
  return err.code || err.message || String(err);
}

// Deliberately not called "info": webos-service registers a built-in /info that
// describes the service, and it wins the name collision. The app would receive
// the framework's command list instead of this payload, silently breaking the
// network badge and the Discover tab. The built-in list also contains /quit.
service.register('network', function (message) {
  message.respond({
    returnValue: true,
    serviceName: SERVICE_NAME,
    interfaces: ipv4Interfaces(),
    broadcasts: localBroadcasts(),
    subnetInfo: localSubnets(),
    nodeVersion: process.version
  });
});

service.register('diagnostics', function (message) {
  diagnostics(function (report) {
    report.returnValue = true;
    message.respond(report);
  });
});

service.register('send', function (message) {
  var payload = message.payload || {};
  var mac = normalizeMac(payload.mac);
  if (!mac) {
    return respondError(message, 'INVALID_MAC', 2);
  }

  sendWake({
    mac: mac,
    ip: payload.ip || null,
    port: payload.port,
    broadcast: payload.broadcast || null,
    repeat: payload.repeat,
    intervalMs: payload.intervalMs,
    useLocalBroadcast: payload.useLocalBroadcast
  }, function (err, result) {
    if (err) return respondError(message, errorTextOf(err));
    result.returnValue = true;
    result.mac = mac;
    message.respond(result);
  });
});

service.register('probe', function (message) {
  var payload = message.payload || {};
  var ip = payload.ip;
  if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(String(ip))) {
    return respondError(message, 'INVALID_IP', 3);
  }

  var ports = [];
  if (Array.isArray(payload.ports) && payload.ports.length) {
    for (var i = 0; i < payload.ports.length; i++) ports.push(clamp(payload.ports[i], 1, 65535));
  } else {
    ports = DEFAULT_PROBE_PORTS;
  }

  probeHost(ip, ports, clamp(payload.timeoutMs || 400, 100, 4000), function (result) {
    result.returnValue = true;
    result.ip = ip;
    message.respond(result);
  });
});

service.register('arp', function (message) {
  var entries = allArpEntries();
  message.respond({
    returnValue: true,
    count: entries.length,
    entries: entries
  });
});

service.register('scanStart', function (message) {
  var payload = message.payload || {};

  if (lastScan && lastScan.status === 'running') {
    return respondError(message, 'SCAN_ALREADY_RUNNING', 4);
  }

  var prefixes;
  var assumed24 = false;
  if (payload.prefix) {
    prefixes = [String(payload.prefix).replace(/\.$/, '')];
  } else {
    var subnets = localSubnets();
    prefixes = subnets.prefixes;
    assumed24 = subnets.assumed24;
  }

  if (!prefixes.length) {
    return respondError(message, 'NO_LOCAL_SUBNET', 5);
  }

  var hosts = [];
  var maxHosts = clamp(payload.maxHosts || 512, 2, 1024);
  prefixes.forEach(function (prefix) {
    for (var i = 1; i <= 254 && hosts.length < maxHosts; i++) {
      hosts.push(prefix + '.' + i);
    }
  });

  var ports = [];
  if (Array.isArray(payload.ports) && payload.ports.length) ports = payload.ports;
  else ports = SCAN_DEFAULT_PORTS;

  scanCounter++;
  lastScan = {
    id: 'scan-' + scanCounter,
    status: 'running',
    cancelled: false,
    done: 0,
    total: hosts.length,
    found: [],
    hosts: hosts,
    ports: ports,
    timeoutMs: clamp(payload.timeoutMs || 350, 100, 3000),
    concurrency: clamp(payload.concurrency || 48, 4, 128),
    assumed24: assumed24,
    startedAt: Date.now(),
    finishedAt: null
  };

  var scan = lastScan;
  runScan(scan, function () { /* the client polls scanStatus */ });

  message.respond({
    returnValue: true,
    scanId: scan.id,
    total: scan.total,
    prefixes: prefixes,
    assumed24: assumed24
  });
});

service.register('scanStatus', function (message) {
  var payload = message.payload || {};
  if (!lastScan) {
    return message.respond({ returnValue: true, status: 'idle', found: [], done: 0, total: 0 });
  }
  if (payload.scanId && payload.scanId !== lastScan.id) {
    return respondError(message, 'UNKNOWN_SCAN', 6);
  }
  var snapshot = scanSnapshot(lastScan);
  snapshot.returnValue = true;
  message.respond(snapshot);
});

service.register('scanCancel', function (message) {
  if (lastScan && lastScan.status === 'running') {
    lastScan.cancelled = true;
    lastScan.status = 'cancelled';
    lastScan.finishedAt = Date.now();
  }
  message.respond({ returnValue: true, cancelled: true });
});

service.register('backupWrite', function (message) {
  var payload = message.payload || {};
  var file = backupPath();
  if (!file) {
    return respondError(message, 'NO_WRITABLE_DIR', 7);
  }
  try {
    var data = typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data || {});
    fs.writeFileSync(file, data, 'utf8');
    message.respond({ returnValue: true, path: file });
  } catch (err) {
    respondError(message, errorTextOf(err));
  }
});

service.register('backupRead', function (message) {
  var file = backupPath();
  if (!file) {
    return respondError(message, 'NO_WRITABLE_DIR', 7);
  }
  try {
    var data = fs.readFileSync(file, 'utf8');
    message.respond({ returnValue: true, path: file, data: data });
  } catch (err) {
    respondError(message, 'NO_BACKUP', 8);
  }
});

service.register('log', function (message) {
  var payload = message.payload || {};
  console.log('[wol] ' + String(payload.message || ''));
  message.respond({ returnValue: true });
});

console.log('[wol] ' + SERVICE_NAME + ' started on ' + process.version);
