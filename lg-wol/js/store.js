/*
 * Device list and settings.
 *
 * localStorage is the right home for this: it is per-app, survives app updates,
 * needs no permission request, and keeps the app a pure client of its own
 * backend. The trade-off is that uninstalling the app removes the data, which
 * is exactly what the Settings > Backup panel is for - it writes the same JSON
 * to a real file through the service so the list can move between TVs.
 *
 * Everything is guarded: some firmwares hand out a localStorage that throws on
 * write, and a WOL app that refuses to start because it could not persist a
 * nickname would be absurd. In that case the store degrades to memory only.
 */

(function (global) {
  'use strict';

  var DEVICES_KEY = 'zcode.wol.devices.v1';
  var SETTINGS_KEY = 'zcode.wol.settings.v1';
  var SCHEMA_VERSION = 1;

  var DEFAULT_SETTINGS = {
    language: null,          // null = follow the TV, resolved at startup
    port: 9,
    repeat: 3,
    intervalMs: 120,
    timeoutMs: 400,
    broadcast: '',
    autoProbe: false
  };

  var memory = {};
  var storageWorks = null;

  function storageAvailable() {
    if (storageWorks !== null) return storageWorks;
    try {
      var probe = '__wol_probe__';
      global.localStorage.setItem(probe, '1');
      global.localStorage.removeItem(probe);
      storageWorks = true;
    } catch (e) {
      storageWorks = false;
    }
    return storageWorks;
  }

  function readRaw(key) {
    if (storageAvailable()) {
      try { return global.localStorage.getItem(key); } catch (e) { /* fall through */ }
    }
    return memory[key] || null;
  }

  function writeRaw(key, value) {
    if (storageAvailable()) {
      try {
        global.localStorage.setItem(key, value);
        return true;
      } catch (e) { /* quota or read-only, keep it in memory */ }
    }
    memory[key] = value;
    return false;
  }

  function readJson(key, fallback) {
    var raw = readRaw(key);
    if (!raw) return fallback;
    try {
      var parsed = JSON.parse(raw);
      return parsed === null || typeof parsed === 'undefined' ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    return writeRaw(key, JSON.stringify(value));
  }

  /* ---------------------------------------------------------------- utils */

  function normalizeMac(input) {
    var hex = String(input == null ? '' : input).replace(/[^0-9a-fA-F]/g, '');
    if (hex.length !== 12) return null;
    hex = hex.toLowerCase();
    var groups = [];
    for (var i = 0; i < 12; i += 2) groups.push(hex.substr(i, 2));
    return groups.join(':');
  }

  function isValidIpv4(value) {
    if (!value) return true; // empty means "not set"
    var parts = String(value).split('.');
    if (parts.length !== 4) return false;
    for (var i = 0; i < 4; i++) {
      if (!/^\d{1,3}$/.test(parts[i])) return false;
      var n = parseInt(parts[i], 10);
      if (n < 0 || n > 255) return false;
    }
    return true;
  }

  // Only needs to be unique inside this app; a counter plus the clock beats a
  // random suffix and keeps the identifier reproducible between sessions.
  var idCounter = 0;
  function newId() {
    idCounter++;
    return 'd' + Date.now().toString(36) + '-' + idCounter;
  }

  function clampInt(value, min, max, fallback) {
    var n = parseInt(value, 10);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  /* -------------------------------------------------------------- devices */

  var devices = [];
  try {
    var stored = readJson(DEVICES_KEY, []);
    devices = Array.isArray(stored) ? stored : [];
  } catch (e) {
    devices = [];
  }

  // Only the persisted fields are written. Status and busy flags live on the
  // same objects but must not survive a restart, or a device would come back
  // claiming to be awake.
  function persist() {
    writeJson(DEVICES_KEY, devices.filter(isStorable).map(toStored));
  }

  // Transient UI state (status, busy flags) is kept on the live object but must
  // never reach storage: a device would come back "awake" after a reboot.
  function isStorable(device) {
    return !!device && typeof device === 'object' && !!device.mac;
  }

  function toStored(device) {
    return {
      id: device.id,
      name: device.name,
      mac: device.mac,
      ip: device.ip || '',
      port: device.port || null,
      broadcast: device.broadcast || '',
      wakeOn: device.wakeOn || '',
      lastWakeAt: device.lastWakeAt || null,
      createdAt: device.createdAt || Date.now()
    };
  }

  function hydrate(raw, index) {
    return {
      id: raw.id || newId(),
      name: raw.name || raw.mac || ('Device ' + (index + 1)),
      mac: normalizeMac(raw.mac) || raw.mac,
      ip: raw.ip || '',
      port: raw.port ? parseInt(raw.port, 10) : null,
      broadcast: raw.broadcast || '',
      wakeOn: raw.wakeOn || '',
      lastWakeAt: raw.lastWakeAt || null,
      createdAt: raw.createdAt || Date.now(),
      status: 'unknown',
      busy: false
    };
  }

  devices = devices.map(hydrate);

  function list() {
    return devices.slice();
  }

  function get(id) {
    for (var i = 0; i < devices.length; i++) {
      if (devices[i].id === id) return devices[i];
    }
    return null;
  }

  function validate(draft) {
    var errors = {};
    if (!draft.name || !String(draft.name).trim()) errors.name = 'error.nameRequired';

    if (!draft.mac || !normalizeMac(draft.mac)) errors.mac = 'error.macInvalid';
    if (draft.ip && !isValidIpv4(draft.ip)) errors.ip = 'error.ipInvalid';

    if (draft.port !== null && draft.port !== '' && typeof draft.port !== 'undefined') {
      var port = parseInt(draft.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) errors.port = 'error.portInvalid';
    }

    if (draft.broadcast && !isValidIpv4(draft.broadcast)) errors.broadcast = 'error.ipInvalid';

    return errors;
  }

  function add(draft) {
    var device = hydrate({
      id: newId(),
      name: String(draft.name || '').trim(),
      mac: normalizeMac(draft.mac),
      ip: String(draft.ip || '').trim(),
      port: draft.port === '' || draft.port === null || typeof draft.port === 'undefined'
        ? null
        : clampInt(draft.port, 1, 65535, null),
      broadcast: String(draft.broadcast || '').trim(),
      wakeOn: String(draft.wakeOn || '').trim(),
      createdAt: Date.now()
    }, devices.length);

    devices.push(device);
    persist();
    return device;
  }

  function update(id, draft) {
    var device = get(id);
    if (!device) return null;

    device.name = String(draft.name || '').trim();
    device.mac = normalizeMac(draft.mac) || device.mac;
    device.ip = String(draft.ip || '').trim();
    device.port = draft.port === '' || draft.port === null || typeof draft.port === 'undefined'
      ? null
      : clampInt(draft.port, 1, 65535, null);
    device.broadcast = String(draft.broadcast || '').trim();
    device.wakeOn = String(draft.wakeOn || '').trim();

    persist();
    return device;
  }

  function remove(id) {
    for (var i = 0; i < devices.length; i++) {
      if (devices[i].id === id) {
        devices.splice(i, 1);
        persist();
        return true;
      }
    }
    return false;
  }

  function markWoken(id) {
    var device = get(id);
    if (!device) return;
    device.lastWakeAt = Date.now();
    persist();
  }

  function clear() {
    devices = [];
    persist();
  }

  function findByMac(mac) {
    var normalized = normalizeMac(mac);
    if (!normalized) return null;
    for (var i = 0; i < devices.length; i++) {
      if (devices[i].mac === normalized) return devices[i];
    }
    return null;
  }

  /* ------------------------------------------------------------- settings */

  var settings = {};
  (function loadSettings() {
    var stored = readJson(SETTINGS_KEY, {}) || {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
      // An explicit null in storage (language = "follow the TV") is a real
      // value, so only an absent key falls through to the default.
      settings[key] = Object.prototype.hasOwnProperty.call(stored, key)
        ? stored[key]
        : DEFAULT_SETTINGS[key];
    });
  }());

  function getSettings() {
    var copy = {};
    Object.keys(settings).forEach(function (key) { copy[key] = settings[key]; });
    return copy;
  }

  function saveSettings(patch) {
    Object.keys(patch || {}).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) settings[key] = patch[key];
    });
    writeJson(SETTINGS_KEY, settings);
    return getSettings();
  }

  function resetSettings() {
    settings = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (key) { settings[key] = DEFAULT_SETTINGS[key]; });
    writeJson(SETTINGS_KEY, settings);
    return getSettings();
  }

  /* --------------------------------------------------------- import/export */

  function exportPayload() {
    return {
      schema: SCHEMA_VERSION,
      app: 'com.zcode.wol',
      exportedAt: new Date().toISOString(),
      settings: getSettings(),
      devices: devices.filter(isStorable).map(toStored)
    };
  }

  function exportJson() {
    return JSON.stringify(exportPayload(), null, 2);
  }

  // Accepts either the full payload or a bare array of devices, because both
  // shapes are what a hand-edited backup tends to look like.
  function importJson(text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: 'backup.badJson' };
    }

    var incoming = Array.isArray(parsed) ? parsed : (parsed && parsed.devices);
    if (!Array.isArray(incoming)) return { ok: false, error: 'backup.badJson' };

    var accepted = incoming
      .filter(function (raw) { return raw && normalizeMac(raw.mac); })
      .map(hydrate);

    if (!accepted.length) return { ok: false, error: 'backup.badJson' };

    devices = accepted;
    persist();

    if (!Array.isArray(parsed) && parsed.settings) saveSettings(parsed.settings);

    return { ok: true, count: accepted.length };
  }

  global.Store = {
    normalizeMac: normalizeMac,
    isValidIpv4: isValidIpv4,
    devices: {
      list: list,
      get: get,
      add: add,
      update: update,
      remove: remove,
      clear: clear,
      markWoken: markWoken,
      findByMac: findByMac,
      validate: validate,
      toStored: toStored
    },
    settings: {
      defaults: DEFAULT_SETTINGS,
      get: getSettings,
      save: saveSettings,
      reset: resetSettings
    },
    backup: {
      exportJson: exportJson,
      importJson: importJson,
      schema: SCHEMA_VERSION
    },
    storageAvailable: storageAvailable
  };

}(window));
