/*
 * Offline MAC vendor lookup.
 *
 * Deliberately a local table rather than a web service: a store review is much
 * friendlier to an app that makes no network requests at all, and the promise
 * in the About panel ("nothing leaves your home network") stays literally true.
 * Roughly the fifty prefixes a home network actually runs into; the first three
 * bytes of a MAC identify the manufacturer.
 */

(function (global) {
  'use strict';

  var VENDORS = {
    '000C29': 'VMware',
    '001132': 'Synology',
    '0011D8': 'ASUS',
    '0013A9': 'Sony',
    '00155D': 'Microsoft (Hyper-V)',
    '001A79': 'TP-Link',
    '001B21': 'Intel',
    '001CC4': 'HP',
    '001E06': 'Wistron (Acer)',
    '001FF3': 'Apple',
    '002248': 'Microsoft',
    '00224D': 'Intel',
    '0023AE': 'Dell',
    '0024E8': 'Dell',
    '002590': 'Super Micro',
    '0026BB': 'Apple',
    '0026C7': 'Apple',
    '002710': 'Intel',
    '005056': 'VMware',
    '0050B6': 'Dell',
    '0080E1': 'STMicroelectronics',
    '00A0C9': 'Intel',
    '00D0B7': 'Intel',
    '00E04C': 'Realtek',
    '00E0B8': 'AMD',
    '00E04F': 'Apple',
    '040CCE': 'Apple',
    '08CC68': 'Cisco',
    '0C8910': 'HP',
    '109836': 'Amazon',
    '10C37B': 'ASUS',
    '10BF48': 'Synology',
    '14DDA9': 'ASUS',
    '18A905': 'Samsung',
    '18C04D': 'HP',
    '1C872C': 'ASUS',
    '20CF30': 'ASUS',
    '24F5A2': 'Belkin',
    '28C2DD': 'Espressif (IoT)',
    '2C3376': 'Acer',
    '2C542D': 'Samsung',
    '2CFDA1': 'ASUS',
    '303A64': 'Intel',
    '340286': 'Intel',
    '34E6D7': 'Dell',
    '3810D5': 'Intel',
    '3C2AF4': 'Intel',
    '3C5A37': 'Samsung',
    '3C7C3F': 'ASUS',
    '3CA82A': 'HP',
    '3CD92B': 'HP',
    '40B034': 'HP',
    '44D244': 'Seiko Epson',
    '48D224': 'LG Electronics',
    '4C3275': 'Intel',
    '50EB71': 'Intel',
    '525400': 'QEMU',
    '54A050': 'ASUS',
    '5C514F': 'Intel',
    '5CE0C5': 'Intel',
    '60A44C': 'ASUS',
    '60D9C7': 'LG Electronics',
    '68DB96': 'Cisco',
    '6C8814': 'Intel',
    '6CF049': 'Intel',
    '70F1A1': 'LG Electronics',
    '744401': 'Netgear',
    '74D435': 'Intel',
    '78E3B5': 'HP',
    '7C7A91': 'Intel',
    '80CE62': 'Intel',
    '84C9B2': 'Dell',
    '88E9FE': 'Apple',
    '8C1645': 'Intel',
    '8CC8CD': 'Intel',
    '901B0E': 'Fujitsu',
    '940C6D': 'TP-Link',
    '94C691': 'ELECOM',
    '98B785': 'Intel',
    'A0A8CD': 'Intel',
    'A40CC3': 'Intel',
    'A44CC8': 'Intel',
    'A4B1C1': 'Intel',
    'A4C494': 'Intel',
    'A85BB0': 'Samsung',
    'A8B1D4': 'Cisco',
    'AC2205': 'Compal',
    'B0487A': 'TP-Link',
    'B0BE76': 'TP-Link',
    'B40B44': 'Smartisan',
    'B827EB': 'Raspberry Pi Foundation',
    'B8AEED': 'Apple',
    'BC1485': 'Samsung',
    'BC305B': 'Dell',
    'BCD177': 'Intel',
    'C025E9': 'TP-Link',
    'C05627': 'Belkin',
    'C0A0BB': 'D-Link',
    'C46E1F': 'TP-Link',
    'C82A14': 'Apple',
    'CC2D1B': 'Sichuan AI-Link',
    'CCB255': 'D-Link',
    'D017C2': 'ASUS',
    'D0577B': 'Intel',
    'D850E6': 'ASUS',
    'D8C4E9': 'Intel',
    'DC85DE': 'AzureWave',
    'DCA632': 'Raspberry Pi Trading',
    'DCA904': 'Apple',
    'DCD321': 'HUMAX',
    'E076D0': 'AMD',
    'E0CB4E': 'ASUS',
    'E4CE8F': 'Apple',
    'E89EB4': 'Hon Hai (Foxconn)',
    'E8B2AC': 'Apple',
    'EC8EB5': 'HP',
    'F04DA2': 'Dell',
    'F0DEF1': 'Wistron',
    'F4CE46': 'Intel',
    'F81A67': 'TP-Link',
    'F8BC12': 'Dell',
    'F8E43B': 'ASUS',
    'FCAA14': 'GIGA-BYTE',
    'FCFBFB': 'Cisco'
  };

  function prefixOf(mac) {
    var hex = String(mac || '').replace(/[^0-9a-fA-F]/g, '');
    if (hex.length < 6) return null;
    return hex.substr(0, 6).toUpperCase();
  }

  function vendorFor(mac) {
    var prefix = prefixOf(mac);
    if (!prefix) return null;
    return VENDORS[prefix] || null;
  }

  // The second-least-significant bit of the first byte is set when the address
  // is assigned locally, which means the vendor table cannot help and the
  // device is likely Windows/NetworkManager MAC randomisation.
  function isRandomised(mac) {
    var hex = String(mac || '').replace(/[^0-9a-fA-F]/g, '');
    if (hex.length < 2) return false;
    var first = parseInt(hex.substr(0, 2), 16);
    return (first & 0x02) === 0x02;
  }

  // A friendly default name so the user only has to type a label when the
  // suggestion is wrong.
  function suggestName(mac, index) {
    if (isRandomised(mac)) return 'Device ' + (index || 1);
    return vendorFor(mac) || null;
  }

  global.OUI = {
    vendorFor: vendorFor,
    isRandomised: isRandomised,
    suggestName: suggestName,
    tableSize: Object.keys(VENDORS).length
  };

}(window));
