#!/usr/bin/env node
/*
 * Inspect the app running on a real TV.
 *
 * This is the tool for the one question that cannot be answered from the source:
 * what is actually happening inside the app on the device. It talks to the
 * DevTools endpoint that WebAppMgr exposes on port 9998, so it can read the
 * console, catch exceptions, evaluate expressions in the live page, and call a
 * luna method from inside the app - which is the only way to tell whether the
 * bundled JS service is registered and answering.
 *
 * Usage
 *
 *   # 1. forward the TV's debug port to this machine, in a separate terminal
 *   ares-novacom --device tv -f -p 9998:9998
 *
 *   # 2. look at the app
 *   node tools/tv-inspect.js                       # page state + console
 *   node tools/tv-inspect.js --watch               # keep printing console output
 *   node tools/tv-inspect.js --luna luna://com.zcode.wol.service/info
 *   node tools/tv-inspect.js --eval "Luna.mode()"
 *
 * Nothing is written to the device: every request is read-only.
 */

'use strict';

var http = require('http');

var ENDPOINT = 'http://127.0.0.1:9998';
var CONNECT_TIMEOUT_MS = 8000;
var WATCH_MS = 10000;

function parseArgs(argv) {
  var options = { watch: false, luna: null, eval: [], endpoint: ENDPOINT };
  for (var i = 0; i < argv.length; i++) {
    var arg = argv[i];
    if (arg === '--watch') options.watch = true;
    else if (arg === '--luna') options.luna = argv[++i];
    else if (arg === '--eval') options.eval.push(argv[++i]);
    else if (arg === '--endpoint') options.endpoint = argv[++i];
  }
  return options;
}

function fetchTargets(endpoint) {
  return new Promise(function (resolve, reject) {
    var request = http.get(endpoint + '/json', function (response) {
      var body = '';
      response.on('data', function (chunk) { body += chunk; });
      response.on('end', function () {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error('DevTools returned something that is not JSON. Is the port forwarded?'));
        }
      });
    });
    request.on('error', function (err) {
      reject(new Error('Cannot reach ' + endpoint + ' (' + err.message + ').\n' +
        'Start the tunnel first:  ares-novacom --device tv -f -p 9998:9998'));
    });
  });
}

// A very small CDP client: send a command, resolve on the matching id, print
// events as they arrive.
function connect(url, onEvent) {
  var socket = new WebSocket(url);
  var state = { nextId: 0, pending: {} };

  socket.addEventListener('message', function (event) {
    var message = JSON.parse(event.data);

    if (message.id && state.pending[message.id]) {
      state.pending[message.id](message);
      delete state.pending[message.id];
      return;
    }
    if (message.method && onEvent) onEvent(message);
  });

  var ready = new Promise(function (resolve, reject) {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', function () {
      reject(new Error('WebSocket to the TV failed. Is the app still running?'));
    });
    setTimeout(function () {
      reject(new Error('Timed out connecting to the TV debug socket'));
    }, CONNECT_TIMEOUT_MS);
  });

  function command(method, params) {
    return new Promise(function (resolve) {
      var id = ++state.nextId;
      state.pending[id] = resolve;
      socket.send(JSON.stringify({ id: id, method: method, params: params || {} }));
    });
  }

  return { ready: ready, command: command, close: function () { socket.close(); } };
}

function valueOf(response) {
  if (!response || !response.result) return response;
  var inner = response.result.result;
  if (inner && typeof inner.value !== 'undefined') return inner.value;
  if (inner && inner.description) return inner.description;
  if (response.result.exceptionDetails) {
    var details = response.result.exceptionDetails;
    return 'THREW: ' + (details.exception && details.exception.description || details.text);
  }
  return response.result;
}

function describeEvent(message) {
  if (message.method === 'Runtime.consoleAPICalled') {
    var args = message.params.args.map(function (arg) {
      if (typeof arg.value !== 'undefined') return String(arg.value);
      return arg.description || arg.type;
    });
    return '[console.' + message.params.type + '] ' + args.join(' ');
  }
  if (message.method === 'Runtime.exceptionThrown') {
    var details = message.params.exceptionDetails;
    var description = (details.exception && details.exception.description) || details.text;
    return '[EXCEPTION] ' + String(description).split('\n')[0];
  }
  if (message.method === 'Log.entryAdded') {
    var entry = message.params.entry;
    return '[log:' + entry.level + '] ' + String(entry.text).slice(0, 400);
  }
  return null;
}

var PROBES = [
  'document.title',
  'document.readyState',
  'typeof PalmServiceBridge',
  'typeof webOS',
  'Luna.mode()',
  'Luna.isLive()',
  'I18N.code()',
  'document.documentElement.getAttribute("dir")',
  'document.querySelectorAll("[data-nav]").length',
  'document.getElementById("demoBanner").className',
  'document.getElementById("statusText").textContent',
  'Store.devices.list().length',
  'Nav.scopeDepth()'
];

async function main() {
  var options = parseArgs(process.argv.slice(2));
  var targets = await fetchTargets(options.endpoint);
  var page = null;

  for (var i = 0; i < targets.length; i++) {
    if (targets[i].type === 'page') { page = targets[i]; break; }
  }

  if (!page) {
    console.log('No page target found. Is the app running on the TV?');
    console.log('Targets seen: ' + targets.map(function (t) { return t.type + ':' + t.title; }).join(', '));
    process.exit(1);
  }

  console.log('App on the TV: ' + page.title);
  console.log('URL:           ' + page.url);
  console.log('');

  var client = connect(page.webSocketDebuggerUrl, function (message) {
    var line = describeEvent(message);
    if (line) console.log('   ' + line);
  });

  await client.ready;
  await client.command('Runtime.enable');
  await client.command('Log.enable');

  console.log('Page state');
  for (var p = 0; p < PROBES.length; p++) {
    var probe = PROBES[p];
    var response = await client.command('Runtime.evaluate', { expression: probe, returnByValue: true });
    console.log('   ' + probe.padEnd(52) + ' => ' + JSON.stringify(valueOf(response)));
  }

  if (options.eval.length) {
    console.log('');
    console.log('Evaluated expressions');
    for (var e = 0; e < options.eval.length; e++) {
      var custom = await client.command('Runtime.evaluate', {
        expression: options.eval[e],
        returnByValue: true,
        awaitPromise: true
      });
      console.log('   ' + options.eval[e]);
      console.log('      => ' + JSON.stringify(valueOf(custom)));
    }
  }

  if (options.luna) {
    // Luna.call() takes a bare method name - it builds the luna:// URL for this
    // app's own service itself - so a full URI is accepted here and reduced to
    // its last path segment.
    var method = options.luna.replace(/^luna:\/\//, '').split('/').pop();

    console.log('');
    console.log('Calling "' + method + '" on the app\'s own service from inside the app');

    // Fire and store, then read the slot back a moment later. Runtime.evaluate's
    // awaitPromise is not dependable on the older Chromium builds these TVs run,
    // and a promise that never resolves looks identical to a service that never
    // answered - which is exactly the distinction this tool exists to make.
    await client.command('Runtime.evaluate', {
      expression: 'window.__wolProbe = "pending";\n' +
        'Luna.call(' + JSON.stringify(method) + ', {}, function (err, result) {\n' +
        '  window.__wolProbe = err\n' +
        '    ? "ERROR: " + err.message + (err.code ? " (code " + err.code + ")" : "")\n' +
        '    : "OK: " + JSON.stringify(result);\n' +
        '});\n' +
        '"started"',
      returnByValue: true
    });

    await new Promise(function (resolve) { setTimeout(resolve, 3000); });

    var probeResponse = await client.command('Runtime.evaluate', {
      expression: 'window.__wolProbe',
      returnByValue: true
    });
    console.log('   ' + valueOf(probeResponse));
  }

  if (options.watch) {
    console.log('');
    console.log('Listening for console output for ' + (WATCH_MS / 1000) + 's...');
    await new Promise(function (resolve) { setTimeout(resolve, WATCH_MS); });
  }

  client.close();
  process.exit(0);
}

main().catch(function (err) {
  console.log('');
  console.log('FAILED: ' + err.message);
  process.exit(1);
});
