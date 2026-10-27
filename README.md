# WebOS Wake On LAN

A practical **Wake-on-LAN app for LG webOS TVs** to wake PCs, NAS devices, consoles, and other LAN-connected hosts.

## Overview

This application lets you send WoL magic packets from your TV interface to devices in your local network.

> Note: A TV app cannot wake the TV itself when the TV is fully powered off.

## Features

- 🖥️ Save and manage multiple target devices
- 📶 Send Wake-on-LAN magic packets reliably
- 🔍 Network helper tools for discovery and diagnostics
- 🌍 Multi-language support (including Persian/RTL)
- 🧪 Built-in checks for compatibility and troubleshooting

## Requirements

- LG TV (webOS)
- Node.js + npm
- `@webos-tools/cli`
- Developer Mode enabled on TV

## Build & Install

From the `lg-wol` directory:

```bash
npm run icons
npm test
npm run package
```

Then install the generated IPK to your TV via `ares` commands or project scripts.

## Architecture

- Frontend UI runs in webOS browser sandbox
- Packet sending is handled by bundled Node.js service
- Communication between UI and service is via Luna service bridge

## Troubleshooting

If wake requests fail:

- Verify WoL is enabled on target BIOS/UEFI + NIC settings
- Prefer wired Ethernet on target device
- Ensure TV and target are on same L2 segment
- Use app diagnostics and service logs

## Contributing

Contributions and bug reports are welcome.

## License

MIT

---

## Donate

[![Donate](https://img.shields.io/badge/Donate-PayPal-00457C?logo=paypal&logoColor=white)](https://www.paypal.com/paypalme/HNDeveloper)
