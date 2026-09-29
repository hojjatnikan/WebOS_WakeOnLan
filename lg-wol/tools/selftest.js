#!/usr/bin/env node
/*
 * Self-test for the parts of the service that can run outside a TV.
 *
 * The magic packet is the one thing in this app where being wrong is silent:
 * a malformed packet is still just a UDP datagram, the send succeeds, and the
 * machine simply never wakes. So the byte layout is asserted here rather than
 * trusted, and this file runs on plain Node with no TV attached.
 *
 *   node tools/selftest.js
 *
 * Exits non-zero if anything fails, so it works as a pre-commit or CI gate.
 */

'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

// service.js exports its helpers and stops before the luna registration when
// the webos-service module is absent, which is exactly the case here.
var service = require('../service/service.js');

var failures = 0;
var checks = 0;

function test(name, fn) {
  checks++;
  try {
    fn();
    console.log('  \u2713 ' + name);
  } catch (err) {
    failures++;
    console.log('  \u2717 ' + name);
    console.log('      ' + (err && err.message ? err.message : String(err)));
  }
}

function section(title) {
  console.log('');
  console.log(title);
}

/* ------------------------------------------------------------------ */

section('MAC normalisation');

test('canonical colon form is accepted unchanged', function () {
  assert.strictEqual(service.normalizeMac('aa:bb:cc:dd:ee:ff'), 'aa:bb:cc:dd:ee:ff');
});

test('uppercase is accepted', function () {
  assert.strictEqual(service.normalizeMac('AA:BB:CC:DD:EE:FF'), 'aa:bb:cc:dd:ee:ff');
});

test('dashes are accepted', function () {
  assert.strictEqual(service.normalizeMac('AA-BB-CC-DD-EE-FF'), 'aa:bb:cc:dd:ee:ff');
});

test('bare hex is accepted', function () {
  assert.strictEqual(service.normalizeMac('aabbccddeeff'), 'aa:bb:cc:dd:ee:ff');
});

test('windows style hex with dots is accepted', function () {
  assert.strictEqual(service.normalizeMac('aabb.ccdd.eeff'), 'aa:bb:cc:dd:ee:ff');
});

test('too few digits is rejected', function () {
  assert.strictEqual(service.normalizeMac('aa:bb:cc:dd:ee'), null);
});

test('too many digits is rejected', function () {
  assert.strictEqual(service.normalizeMac('aa:bb:cc:dd:ee:ff:00'), null);
});

test('non-hex characters are rejected', function () {
  assert.strictEqual(service.normalizeMac('zz:bb:cc:dd:ee:ff'), null);
});

test('empty and null are rejected', function () {
  assert.strictEqual(service.normalizeMac(''), null);
  assert.strictEqual(service.normalizeMac(null), null);
  assert.strictEqual(service.normalizeMac(undefined), null);
});

test('a number is rejected rather than coerced', function () {
  assert.strictEqual(service.normalizeMac(123456789012), null);
});

/* ------------------------------------------------------------------ */

section('Magic packet layout');

var MAC = 'aabbccddeeff';

test('packet is exactly 102 bytes', function () {
  var packet = service.buildMagicPacket(MAC);
  assert.strictEqual(packet.length, 102, 'expected 6 + 16*6 = 102 bytes');
});

test('the first six bytes are 0xFF', function () {
  var packet = service.buildMagicPacket(MAC);
  for (var i = 0; i < 6; i++) {
    assert.strictEqual(packet[i], 0xff, 'byte ' + i + ' should be 0xFF');
  }
});

test('the MAC appears sixteen times', function () {
  var packet = service.buildMagicPacket(MAC);
  var expected = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
  for (var repeat = 0; repeat < 16; repeat++) {
    var offset = 6 + repeat * 6;
    for (var b = 0; b < 6; b++) {
      assert.strictEqual(
        packet[offset + b],
        expected[b],
        'repetition ' + repeat + ' byte ' + b + ' is wrong'
      );
    }
  }
});

test('the whole packet matches the expected hex string', function () {
  var packet = service.buildMagicPacket(MAC);
  var expected = 'ff'.repeat(6) + MAC.repeat(16);
  assert.strictEqual(packet.toString('hex'), expected);
});

test('an invalid MAC produces null instead of a bad packet', function () {
  assert.strictEqual(service.buildMagicPacket('not-a-mac'), null);
  assert.strictEqual(service.buildMagicPacket(''), null);
});

test('punctuation does not change the packet', function () {
  var a = service.buildMagicPacket('AA:BB:CC:DD:EE:FF');
  var b = service.buildMagicPacket('aabbccddeeff');
  var c = service.buildMagicPacket('AA-BB-CC-DD-EE-FF');
  assert.strictEqual(a.toString('hex'), b.toString('hex'));
  assert.strictEqual(b.toString('hex'), c.toString('hex'));
});

/* ------------------------------------------------------------------ */

section('Broadcast address arithmetic');

test('/24 network', function () {
  assert.strictEqual(service.broadcastFor('192.168.1.23', '255.255.255.0'), '192.168.1.255');
});

test('/16 network', function () {
  assert.strictEqual(service.broadcastFor('10.0.5.7', '255.255.0.0'), '10.0.255.255');
});

test('/8 network', function () {
  assert.strictEqual(service.broadcastFor('172.20.3.4', '255.0.0.0'), '172.255.255.255');
});

test('/25 network, host in the lower half', function () {
  assert.strictEqual(service.broadcastFor('192.168.1.23', '255.255.255.128'), '192.168.1.127');
});

test('/25 network, host in the upper half', function () {
  assert.strictEqual(service.broadcastFor('192.168.1.200', '255.255.255.128'), '192.168.1.255');
});

test('a missing netmask yields null', function () {
  assert.strictEqual(service.broadcastFor('192.168.1.23', null), null);
  assert.strictEqual(service.broadcastFor('192.168.1.23', undefined), null);
});

test('a malformed address yields null', function () {
  assert.strictEqual(service.broadcastFor('192.168.1', '255.255.255.0'), null);
  assert.strictEqual(service.broadcastFor('192.168.1.1.1', '255.255.255.0'), null);
  assert.strictEqual(service.broadcastFor('192.168.a.1', '255.255.255.0'), null);
});

/* ------------------------------------------------------------------ */

section('ARP output parsing');

test('ip neigh output is parsed', function () {
  var text = [
    '192.168.1.1 dev wlan0 lladdr 74:44:01:aa:bb:cc REACHABLE',
    '192.168.1.9 dev wlan0  FAILED',
    '192.168.1.42 dev wlan0 lladdr f0:4d:a2:11:22:33 STALE'
  ].join('\n');

  var entries = service.parseIpNeigh(text);
  assert.strictEqual(entries.length, 2, 'the FAILED line must be skipped');
  assert.strictEqual(entries[0].ip, '192.168.1.1');
  assert.strictEqual(entries[0].mac, '74:44:01:aa:bb:cc');
  assert.strictEqual(entries[0].device, 'wlan0');
  assert.strictEqual(entries[1].ip, '192.168.1.42');
});

test('arp -a output is parsed', function () {
  var text = [
    '? (192.168.1.1) at 74:44:01:aa:bb:cc [ether] on wlan0',
    '? (192.168.1.9) at <incomplete> on wlan0',
    'gateway (192.168.1.254) at b8:27:eb:12:34:56 [ether] on eth0'
  ].join('\n');

  var entries = service.parseArpDashA(text);
  assert.strictEqual(entries.length, 2, 'the incomplete entry must be skipped');
  assert.strictEqual(entries[0].ip, '192.168.1.1');
  assert.strictEqual(entries[0].mac, '74:44:01:aa:bb:cc');
  assert.strictEqual(entries[1].ip, '192.168.1.254');
  assert.strictEqual(entries[1].device, 'eth0');
});

test('empty command output yields no entries', function () {
  assert.deepStrictEqual(service.parseIpNeigh(''), []);
  assert.deepStrictEqual(service.parseArpDashA(''), []);
});

/* ------------------------------------------------------------------ */

section('Local environment (informational)');

var interfaces = service.ipv4Interfaces();
if (interfaces.length) {
  interfaces.forEach(function (entry) {
    console.log('    interface ' + entry.name + ': ' + entry.address + ' / ' + entry.netmask);
  });
  console.log('    derived broadcast: ' + service.localBroadcasts().join(', '));
} else {
  console.log('    no non-internal IPv4 interface on this machine');
}

try {
  var arpEntries = service.readProcArp();
  console.log('    /proc/net/arp is readable, ' + arpEntries.length + ' entries');
} catch (err) {
  console.log('    /proc/net/arp is not available here (expected on Windows and macOS)');
}

console.log('    backup file would be written to: ' + service.backupPath());

/* ------------------------------------------------------------------ */

section('Node 0.12 compatibility of the service');

// This is the guard for a bug that cost real debugging time. webOS TV 4.x (and
// 3.x) run JS services on Node v0.12.2, which has no Promise and, per LG's own
// docs, no ES6 at all. A single Promise reference in the service makes it throw
// on load; on the TV that looks like the service simply not existing, with no
// process left behind to inspect.
//
// Source order matters here: the service is scanned as written, not as packaged.
function stripCommentsAndStrings(source) {
  var out = '';
  var i = 0;
  while (i < source.length) {
    var ch = source[i];
    var next = source[i + 1];

    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      var quote = ch;
      i++;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === quote) { i++; break; }
        i++;
      }
      out += '""';
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

test('service.js uses no syntax that webOS TV 4.x cannot run', function () {
  var raw = fs.readFileSync(path.join(ROOT, 'service', 'service.js'), 'utf8');
  var code = stripCommentsAndStrings(raw);

  // Each entry names something that is fine in Chromium (the web view) but not
  // on the Node 0.12 runtime behind the service.
  var forbidden = [
    { pattern: /=>/, label: 'arrow function' },
    { pattern: /\bPromise\b/, label: 'Promise (added in Node 4)' },
    { pattern: /\basync\b/, label: 'async' },
    { pattern: /\bawait\b/, label: 'await' },
    { pattern: /\bconst\s+[A-Za-z_$]/, label: 'const' },
    { pattern: /\blet\s+[A-Za-z_$]/, label: 'let' },
    { pattern: /`/, label: 'template literal' },
    { pattern: /\bos\.homedir\b/, label: 'os.homedir (added in Node 2.0)' },
    { pattern: /\bObject\.assign\b/, label: 'Object.assign' },
    { pattern: /\.\.\./, label: 'spread or rest operator' }
  ];

  var found = [];
  forbidden.forEach(function (rule) {
    if (rule.pattern.test(code)) found.push(rule.label);
  });

  assert.deepStrictEqual(found, [],
    'service/service.js uses ' + found.join(', ') +
    ' - webOS TV 4.x runs this file on Node v0.12.2');
});

test('service.js does not require a top-level return', function () {
  var raw = fs.readFileSync(path.join(ROOT, 'service', 'service.js'), 'utf8');
  var code = stripCommentsAndStrings(raw);

  // A top-level "return" is legal for Node (it wraps the file in a function) but
  // makes ares-package's minifier reject the whole service, because it parses the
  // file as a script. Anchored at column zero on purpose: every nested return in
  // this file is indented, so zero indentation means top level.
  assert.ok(!/^return\b/m.test(code),
    'a top-level return breaks ares-package minification; see the note at the top of service.js');
});

/* ------------------------------------------------------------------ */

section('TCP probe against the loopback interface');

// Informational rather than asserted: on a machine with a packet-dropping
// firewall this can legitimately time out, and that is not a code defect.
var finished = false;

service.probeHost('127.0.0.1', [1], 600, function (result) {
  console.log('    probe of 127.0.0.1:1 -> alive=' + result.alive + ' reason=' + result.reason);
  finished = true;
  report();
});

function report() {
  if (!finished) return;
  console.log('');
  if (failures === 0) {
    console.log('All ' + checks + ' checks passed.');
    process.exit(0);
  } else {
    console.log(failures + ' of ' + checks + ' checks FAILED.');
    process.exit(1);
  }
}
