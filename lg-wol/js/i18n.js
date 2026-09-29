/*
 * Translations and text direction.
 *
 * LG's store listings are per-language, so the strings for the languages you
 * intend to publish in belong here. Adding one is two steps: append an entry to
 * LANGUAGES and add a STRINGS block with the same keys. A missing key falls back
 * to English rather than showing a raw identifier.
 */

(function (global) {
  'use strict';

  var LANGUAGES = [
    { code: 'en', label: 'English', dir: 'ltr' },
    { code: 'fa', label: 'فارسی', dir: 'rtl' },
    { code: 'ko', label: '한국어', dir: 'ltr' }
  ];

  var STRINGS = {

    /* ------------------------------------------------------------ English */
    en: {
      'app.title': 'Wake On LAN',
      'app.tagline': 'Wake sleeping computers on your network from your TV',

      'tab.devices': 'Devices',
      'tab.discover': 'Discover',
      'tab.settings': 'Settings',

      'banner.demoTitle': 'Demo mode',
      'banner.demoBody': 'The webOS bridge was not found, so calls are simulated. Install on a TV to send real packets.',

      'action.add': 'Add device',
      'action.wakeAll': 'Wake all',
      'action.refresh': 'Check status',
      'action.autoProbe': 'Auto check',
      'action.scan': 'Scan network',
      'action.stop': 'Stop',
      'action.refreshArp': 'Refresh',
      'action.runDiagnostics': 'Run test',
      'action.export': 'Write backup',
      'action.import': 'Restore',
      'action.resetSettings': 'Reset settings',
      'action.wake': 'Wake',
      'action.probe': 'Check',
      'action.edit': 'Edit',
      'action.delete': 'Delete',
      'action.save': 'Save',
      'action.cancel': 'Cancel',
      'action.confirm': 'Confirm',
      'action.close': 'Close',
      'action.keypad': 'Keypad',
      'action.saveAsDevice': 'Add',
      'action.applyRestore': 'Restore',

      'label.name': 'Name',
      'label.mac': 'MAC address',
      'label.ip': 'IP address',
      'label.port': 'UDP port',
      'label.broadcast': 'Broadcast address',
      'label.wakeOn': 'Wake-on setting',
      'label.openPorts': 'Open ports',
      'label.source': 'Source',
      'label.vendor': 'Maker',
      'label.sourceScan': 'Scan',
      'label.lastWake': 'Last wake',

      'hint.name': 'Anything you will recognise in the list.',
      'hint.mac': 'Format: 1A:2B:3C:4D:5E:6F',
      'hint.ip': 'Optional. Used for one extra unicast packet and for status checks.',
      'hint.broadcast': 'Optional. Use it when the router blocks 255.255.255.255.',
      'hint.wakeOn': 'A reminder for yourself, e.g. “enable WOL in BIOS first”.',

      'empty.devicesTitle': 'No devices yet',
      'empty.devicesBody': 'Add one manually, or open Discover and pick a computer that is already awake.',
      'counter.devices': '{count} devices',

      'discover.interfacesTitle': "This TV's network",
      'discover.hostsTitle': 'Devices found on the network',
      'discover.hint': 'Only devices that are currently awake answer a scan. To find the address of a sleeping computer, look it up in your router\'s client list, or check the ARP cache below.',
      'discover.noHosts': 'Nothing found yet. Press “Scan network”.',
      'discover.arpTitle': 'ARP cache (known addresses)',
      'discover.arpHint': 'The kernel ARP cache often contains the MAC of devices that are asleep right now — exactly what you need to wake them.',
      'discover.macUnknown': 'unknown',
      'discover.noInterface': 'No IPv4 interface was reported by this TV.',
      'discover.alwaysBroadcast': '255.255.255.255 is used as well.',

      'form.addTitle': 'Add device',
      'form.editTitle': 'Edit device',

      'error.nameRequired': 'Give the device a name.',
      'error.macInvalid': 'The MAC address must be 12 hexadecimal digits, for example 1A:2B:3C:4D:5E:6F.',
      'error.ipInvalid': 'That is not a valid IP address.',
      'error.portInvalid': 'The port must be between 1 and 65535.',

      'status.ready': 'Ready',
      'status.unknown': 'Unknown',
      'status.online': 'Awake',
      'status.offline': 'Asleep or unreachable',
      'status.probing': 'Checking…',
      'status.sending': 'Sending…',
      'status.woke': 'Packet sent',

      'toast.deviceSaved': 'Device saved.',
      'toast.deviceDeleted': 'Device deleted.',
      'toast.woke': '“{name}”: magic packet sent to {ok} of {total} targets.',
      'toast.wakeFailed': '“{name}”: sending failed ({error}).',
      'toast.wakeAll': 'Waking {count} devices.',
      'toast.online': '“{name}” is awake.',
      'toast.offline': '“{name}” did not answer.',
      'toast.scanStarted': 'Scanning {total} addresses…',
      'toast.scanDone': 'Scan finished: {count} hosts answered.',
      'toast.arpFound': '{count} addresses in the ARP cache.',
      'toast.arpNone': 'The ARP cache could not be read on this TV.',
      'toast.noBridge': 'The webOS bridge is unavailable, so packets cannot be sent.',
      'toast.macFilled': 'MAC address filled in from the ARP cache.',
      'toast.savedAsDevice': '“{name}” was added to your devices.',
      'toast.settingsReset': 'Settings are back to their defaults.',
      'toast.noIpToProbe': 'None of your devices has an IP address, so there is nothing to check.',

      'confirm.deleteTitle': 'Delete device',
      'confirm.deleteBody': 'Delete “{name}”? This cannot be undone.',
      'confirm.resetTitle': 'Reset settings',
      'confirm.resetBody': 'Return every setting to its default? Your device list is kept.',

      'backup.exportTitle': 'Backup written',
      'backup.importTitle': 'Restore from backup',
      'backup.exportHint': 'This text was written to the file below on the TV. You can copy it and keep it somewhere else.',
      'backup.importHint': 'Paste a backup below and press Restore. Your current devices are replaced.',
      'backup.writeFailed': 'Writing the backup failed: {error}',
      'backup.readFailed': 'Reading the backup failed: {error}',
      'backup.badJson': 'That text is not a valid backup.',
      'backup.restored': 'Restored {count} devices.',

      'settings.language': 'Language',
      'settings.languageHint': 'The interface language and text direction follow this setting.',
      'settings.packetTitle': 'Magic packet',
      'settings.defaultPort': 'Default UDP port',
      'settings.defaultPortHint': '9 is the standard. A few machines listen on 7 instead.',
      'settings.repeat': 'Packets per target',
      'settings.repeatHint': 'UDP is lossy and the first datagram is often dropped. 3 is a good default.',
      'settings.interval': 'Gap between packets (ms)',
      'settings.timeout': 'Reachability timeout (ms)',
      'settings.timeoutHint': 'How long each status probe waits for an answer.',
      'settings.forceBroadcast': 'Extra broadcast address',
      'settings.forceBroadcastHint': 'Optional. Leave empty to use the address detected from this TV\'s network only.',
      'settings.diagnostics': 'Diagnostics',
      'settings.diagnosticsHint': 'Sends one real packet to your network and reports what this TV\'s firmware allows. Run it first if waking does not work.',
      'settings.storage': 'Backup',
      'settings.storageHint': 'Device lists live in this app\'s local storage and survive updates. A backup writes the same data to a file on the TV so it can be moved to another one.',
      'settings.about': 'About',
      'about.body': 'Wake On LAN sends a magic packet over your local network to switch on a sleeping computer, NAS or media player. The packet is a broadcast containing the target\'s MAC address; nothing leaves your home network and no internet connection or account is required.',
      'about.version': 'Version',
      'about.service': 'Backend service',
      'about.bridge': 'luna bridge',
      'about.tvLimit': 'A TV cannot wake itself: a powered-off TV runs no code, and this app always runs on the TV. Use it to wake your other machines.',

      'diag.idle': 'Not run yet.',
      'diag.running': 'Running…',
      'diag.title': 'Diagnostics result',

      'macpad.title': 'Enter MAC address',
      'macpad.hint': 'A TV remote is a poor keyboard. Pick one hexadecimal digit at a time, or use the field above with the on-screen keyboard.',
      'macpad.backspace': 'Delete',
      'macpad.clear': 'Clear',
      'macpad.done': 'Use this address',

      'nav.hint': 'Arrows to move · Enter to select · Back to return',
      'vendor.unknown': 'Unknown maker'
    },

    /* ------------------------------------------------------------- Persian */
    fa: {
      'app.title': 'بیدارباش شبکه',
      'app.tagline': 'کامپیوترهای خوابرفته در شبکه را با تلویزیون روشن کنید',

      'tab.devices': 'دستگاه‌ها',
      'tab.discover': 'کشف شبکه',
      'tab.settings': 'تنظیمات',

      'banner.demoTitle': 'حالت نمایشی',
      'banner.demoBody': 'پل webOS پیدا نشد، پس پاسخ‌ها شبیه‌سازی می‌شوند. برای ارسال واقعی بسته‌ها اپ را روی تلویزیون نصب کنید.',

      'action.add': 'افزودن دستگاه',
      'action.wakeAll': 'بیدار کردن همه',
      'action.refresh': 'بررسی وضعیت',
      'action.autoProbe': 'بررسی خودکار',
      'action.scan': 'جست‌وجوی شبکه',
      'action.stop': 'توقف',
      'action.refreshArp': 'به‌روزرسانی',
      'action.runDiagnostics': 'اجرای آزمون',
      'action.export': 'نوشتن پشتیبان',
      'action.import': 'بازگردانی',
      'action.resetSettings': 'بازنشانی تنظیمات',
      'action.wake': 'بیدار کن',
      'action.probe': 'بررسی',
      'action.edit': 'ویرایش',
      'action.delete': 'حذف',
      'action.save': 'ذخیره',
      'action.cancel': 'انصراف',
      'action.confirm': 'تأیید',
      'action.close': 'بستن',
      'action.keypad': 'صفحه‌کلید',
      'action.saveAsDevice': 'افزودن',
      'action.applyRestore': 'بازگردانی',

      'label.name': 'نام',
      'label.mac': 'نشانی MAC',
      'label.ip': 'نشانی IP',
      'label.port': 'پورت UDP',
      'label.broadcast': 'نشانی broadcast',
      'label.wakeOn': 'تنظیم بیدارباش',
      'label.openPorts': 'پورت‌های باز',
      'label.source': 'منبع',
      'label.vendor': 'سازنده',
      'label.sourceScan': 'جست‌وجو',
      'label.lastWake': 'آخرین بیدارباش',

      'hint.name': 'هر نامی که در فهرست بشناسید.',
      'hint.mac': 'قالب: 1A:2B:3C:4D:5E:6F',
      'hint.ip': 'اختیاری. برای یک بستهٔ unicast اضافه و بررسی وضعیت به کار می‌رود.',
      'hint.broadcast': 'اختیاری. وقتی روتر نشانی ۲۵۵.۲۵۵.۲۵۵.۲۵۵ را مسدود می‌کند به کار می‌آید.',
      'hint.wakeOn': 'یادآوری برای خودتان، مثلاً «اول WOL را در BIOS فعال کن».',

      'empty.devicesTitle': 'هنوز دستگاهی اضافه نشده',
      'empty.devicesBody': 'یک دستگاه را دستی اضافه کنید، یا از تب «کشف شبکه» کامپیوتری را که همین حالا روشن است انتخاب کنید.',
      'counter.devices': '{count} دستگاه',

      'discover.interfacesTitle': 'شبکهٔ این تلویزیون',
      'discover.hostsTitle': 'دستگاه‌های پیداشده در شبکه',
      'discover.hint': 'فقط دستگاه‌هایی که همین حالا روشن‌اند به جست‌وجو پاسخ می‌دهند. برای یافتن نشانی یک کامپیوتر خاموش، فهرست کلاینت‌های روتر را ببینید یا از جدول ARP پایین استفاده کنید.',
      'discover.noHosts': 'چیزی پیدا نشد. روی «جست‌وجوی شبکه» بزنید.',
      'discover.arpTitle': 'جدول ARP (نشانی‌های شناخته‌شده)',
      'discover.arpHint': 'جدول ARP هسته اغلب نشانی MAC دستگاه‌هایی را دارد که همین حالا خوابیده‌اند — دقیقاً همان چیزی که برای بیدار کردنشان لازم است.',
      'discover.macUnknown': 'نامشخص',
      'discover.noInterface': 'این تلویزیون هیچ اینترفیس IPv4 گزارش نکرد.',
      'discover.alwaysBroadcast': 'نشانی ۲۵۵.۲۵۵.۲۵۵.۲۵۵ هم استفاده می‌شود.',

      'form.addTitle': 'افزودن دستگاه',
      'form.editTitle': 'ویرایش دستگاه',

      'error.nameRequired': 'یک نام برای دستگاه بنویسید.',
      'error.macInvalid': 'نشانی MAC باید ۱۲ رقم مبنای ۱۶ باشد، مانند 1A:2B:3C:4D:5E:6F.',
      'error.ipInvalid': 'این نشانی IP معتبر نیست.',
      'error.portInvalid': 'پورت باید بین ۱ و ۶۵۵۳۵ باشد.',

      'status.ready': 'آماده',
      'status.unknown': 'نامشخص',
      'status.online': 'روشن',
      'status.offline': 'خاموش یا در دسترس نیست',
      'status.probing': 'در حال بررسی…',
      'status.sending': 'در حال ارسال…',
      'status.woke': 'بسته ارسال شد',

      'toast.deviceSaved': 'دستگاه ذخیره شد.',
      'toast.deviceDeleted': 'دستگاه حذف شد.',
      'toast.woke': '«{name}»: بستهٔ بیدارباش به {ok} از {total} مقصد ارسال شد.',
      'toast.wakeFailed': '«{name}»: ارسال ناموفق بود ({error}).',
      'toast.wakeAll': '{count} دستگاه بیدار می‌شود.',
      'toast.online': '«{name}» روشن است.',
      'toast.offline': '«{name}» پاسخی نداد.',
      'toast.scanStarted': 'جست‌وجوی {total} نشانی آغاز شد…',
      'toast.scanDone': 'جست‌وجو تمام شد: {count} میزبان پاسخ داد.',
      'toast.arpFound': '{count} نشانی در جدول ARP.',
      'toast.arpNone': 'جدول ARP روی این تلویزیون خوانده نشد.',
      'toast.noBridge': 'پل webOS در دسترس نیست، پس بسته‌ای ارسال نمی‌شود.',
      'toast.macFilled': 'نشانی MAC از جدول ARP پر شد.',
      'toast.savedAsDevice': '«{name}» به فهرست دستگاه‌ها اضافه شد.',
      'toast.settingsReset': 'تنظیمات به مقدار پیش‌فرض بازگشت.',
      'toast.noIpToProbe': 'هیچ‌کدام از دستگاه‌ها نشانی IP ندارند، پس چیزی برای بررسی نیست.',

      'confirm.deleteTitle': 'حذف دستگاه',
      'confirm.deleteBody': '«{name}» حذف شود؟ این کار برگشت‌پذیر نیست.',
      'confirm.resetTitle': 'بازنشانی تنظیمات',
      'confirm.resetBody': 'همهٔ تنظیمات به مقدار پیش‌فرض برگردند؟ فهرست دستگاه‌ها دست‌نخورده می‌ماند.',

      'backup.exportTitle': 'پشتیبان نوشته شد',
      'backup.importTitle': 'بازگردانی از پشتیبان',
      'backup.exportHint': 'این متن در فایل زیر روی تلویزیون نوشته شد. می‌توانید آن را کپی کنید و جای دیگری نگه دارید.',
      'backup.importHint': 'محتوای پشتیبان را در کادر زیر بچسبانید و «بازگردانی» را بزنید. دستگاه‌های فعلی جایگزین می‌شوند.',
      'backup.writeFailed': 'نوشتن پشتیبان ناموفق بود: {error}',
      'backup.readFailed': 'خواندن پشتیبان ناموفق بود: {error}',
      'backup.badJson': 'این متن یک پشتیبان معتبر نیست.',
      'backup.restored': '{count} دستگاه بازگردانی شد.',

      'settings.language': 'زبان',
      'settings.languageHint': 'زبان و جهت متن رابط با این تنظیم تعیین می‌شود.',
      'settings.packetTitle': 'بستهٔ جادویی',
      'settings.defaultPort': 'پورت پیش‌فرض UDP',
      'settings.defaultPortHint': '۹ استاندارد است. شمار کمی از دستگاه‌ها روی ۷ گوش می‌دهند.',
      'settings.repeat': 'تعداد بسته برای هر مقصد',
      'settings.repeatHint': 'UDP بسته گم می‌کند و نخستین بسته اغلب از دست می‌رود. ۳ مقدار مناسبی است.',
      'settings.interval': 'فاصلهٔ بین بسته‌ها (میلی‌ثانیه)',
      'settings.timeout': 'مهلت بررسی دسترس‌پذیری (میلی‌ثانیه)',
      'settings.timeoutHint': 'هر بررسی وضعیت چقدر برای پاسخ صبر کند.',
      'settings.forceBroadcast': 'نشانی broadcast اضافی',
      'settings.forceBroadcastHint': 'اختیاری. خالی بگذارید تا فقط نشانی تشخیص‌داده‌شده از شبکهٔ این تلویزیون استفاده شود.',
      'settings.diagnostics': 'عیب‌یابی',
      'settings.diagnosticsHint': 'یک بستهٔ واقعی به شبکه می‌فرستد و گزارش می‌دهد که نرم‌افزار این تلویزیون چه چیزی را اجازه می‌دهد. اگر بیدار کردن کار نکرد، اول این را اجرا کنید.',
      'settings.storage': 'پشتیبان‌گیری',
      'settings.storageHint': 'فهرست دستگاه‌ها در حافظهٔ محلی همین اپ ذخیره می‌شود و بعد از به‌روزرسانی باقی می‌ماند. پشتیبان همان داده را در فایلی روی تلویزیون می‌نویسد تا بتوانید به تلویزیون دیگری منتقل کنید.',
      'settings.about': 'درباره',
      'about.body': 'بیدارباش شبکه یک «بستهٔ جادویی» روی شبکهٔ محلی می‌فرستد تا کامپیوتر، NAS یا پخش‌کنندهٔ رسانهٔ خواب‌رفته را روشن کند. این بسته یک broadcast است که نشانی MAC مقصد را در خود دارد؛ هیچ داده‌ای از خانه بیرون نمی‌رود و به اینترنت یا حساب کاربری نیازی نیست.',
      'about.version': 'نسخه',
      'about.service': 'سرویس پشتیبان',
      'about.bridge': 'پل luna',
      'about.tvLimit': 'تلویزیون نمی‌تواند خودش را بیدار کند: تلویزیون خاموش هیچ کدی اجرا نمی‌کند و این اپ همیشه روی تلویزیون اجرا می‌شود. از آن برای روشن کردن دستگاه‌های دیگر استفاده کنید.',

      'diag.idle': 'هنوز اجرا نشده.',
      'diag.running': 'در حال اجرا…',
      'diag.title': 'نتیجهٔ عیب‌یابی',

      'macpad.title': 'ورود نشانی MAC',
      'macpad.hint': 'کنترل تلویزیون صفحه‌کلید خوبی نیست. هر بار یک رقم مبنای ۱۶ انتخاب کنید، یا از کادر بالا و صفحه‌کلید روی صفحه استفاده کنید.',
      'macpad.backspace': 'حذف',
      'macpad.clear': 'پاک کردن',
      'macpad.done': 'استفاده از این نشانی',

      'nav.hint': 'کلیدهای جهت‌دار برای جابه‌جایی · Enter برای انتخاب · Back برای بازگشت',
      'vendor.unknown': 'سازندهٔ نامشخص'
    },

    /* -------------------------------------------------------------- Korean */
    ko: {
      'app.title': '웨이크 온 랜',
      'app.tagline': 'TV로 네트워크의 잠든 컴퓨터를 깨웁니다',

      'tab.devices': '기기',
      'tab.discover': '네트워크 검색',
      'tab.settings': '설정',

      'banner.demoTitle': '데모 모드',
      'banner.demoBody': 'webOS 브리지를 찾을 수 없어 응답을 시뮬레이션합니다. 실제 패킷 전송은 TV에서 실행하세요.',

      'action.add': '기기 추가',
      'action.wakeAll': '모두 깨우기',
      'action.refresh': '상태 확인',
      'action.autoProbe': '자동 확인',
      'action.scan': '네트워크 검색',
      'action.stop': '중지',
      'action.refreshArp': '새로 고침',
      'action.runDiagnostics': '테스트 실행',
      'action.export': '백업 저장',
      'action.import': '복원',
      'action.resetSettings': '설정 초기화',
      'action.wake': '깨우기',
      'action.probe': '확인',
      'action.edit': '편집',
      'action.delete': '삭제',
      'action.save': '저장',
      'action.cancel': '취소',
      'action.confirm': '확인',
      'action.close': '닫기',
      'action.keypad': '키패드',
      'action.saveAsDevice': '추가',
      'action.applyRestore': '복원',

      'label.name': '이름',
      'label.mac': 'MAC 주소',
      'label.ip': 'IP 주소',
      'label.port': 'UDP 포트',
      'label.broadcast': '브로드캐스트 주소',
      'label.wakeOn': '웨이크 설정',
      'label.openPorts': '열린 포트',
      'label.source': '출처',
      'label.vendor': '제조사',
      'label.sourceScan': '검색',
      'label.lastWake': '마지막 깨우기',

      'hint.name': '목록에서 알아볼 수 있는 이름이면 됩니다.',
      'hint.mac': '형식: 1A:2B:3C:4D:5E:6F',
      'hint.ip': '선택 사항입니다. 유니캐스트 패킷 한 번과 상태 확인에 사용됩니다.',
      'hint.broadcast': '선택 사항입니다. 공유기가 255.255.255.255를 막을 때 사용하세요.',
      'hint.wakeOn': '메모용입니다. 예: “BIOS에서 WOL을 먼저 켜기”.',

      'empty.devicesTitle': '등록된 기기가 없습니다',
      'empty.devicesBody': '직접 추가하거나, 검색 탭에서 현재 켜져 있는 컴퓨터를 선택하세요.',
      'counter.devices': '기기 {count}대',

      'discover.interfacesTitle': '이 TV의 네트워크',
      'discover.hostsTitle': '네트워크에서 찾은 기기',
      'discover.hint': '검색에는 현재 켜져 있는 기기만 응답합니다. 꺼져 있는 컴퓨터의 주소는 공유기의 클라이언트 목록이나 아래 ARP 캐시에서 확인하세요.',
      'discover.noHosts': '아직 찾은 기기가 없습니다. “네트워크 검색”을 누르세요.',
      'discover.arpTitle': 'ARP 캐시 (알려진 주소)',
      'discover.arpHint': '커널 ARP 캐시에는 지금 잠들어 있는 기기의 MAC 주소가 남아 있는 경우가 많습니다.',
      'discover.macUnknown': '알 수 없음',
      'discover.noInterface': '이 TV에서 IPv4 인터페이스를 보고하지 않았습니다.',
      'discover.alwaysBroadcast': '255.255.255.255도 함께 사용됩니다.',

      'form.addTitle': '기기 추가',
      'form.editTitle': '기기 편집',

      'error.nameRequired': '기기 이름을 입력하세요.',
      'error.macInvalid': 'MAC 주소는 16진수 12자리여야 합니다. 예: 1A:2B:3C:4D:5E:6F.',
      'error.ipInvalid': '올바른 IP 주소가 아닙니다.',
      'error.portInvalid': '포트는 1에서 65535 사이여야 합니다.',

      'status.ready': '준비됨',
      'status.unknown': '알 수 없음',
      'status.online': '켜짐',
      'status.offline': '꺼짐 또는 응답 없음',
      'status.probing': '확인 중…',
      'status.sending': '전송 중…',
      'status.woke': '전송됨',

      'toast.deviceSaved': '기기를 저장했습니다.',
      'toast.deviceDeleted': '기기를 삭제했습니다.',
      'toast.woke': '“{name}”: {total}개 대상 중 {ok}개로 패킷을 보냈습니다.',
      'toast.wakeFailed': '“{name}”: 전송에 실패했습니다 ({error}).',
      'toast.wakeAll': '기기 {count}대를 깨웁니다.',
      'toast.online': '“{name}”이(가) 켜져 있습니다.',
      'toast.offline': '“{name}”이(가) 응답하지 않습니다.',
      'toast.scanStarted': '{total}개 주소를 검색합니다…',
      'toast.scanDone': '검색 완료: 호스트 {count}개가 응답했습니다.',
      'toast.arpFound': 'ARP 캐시에 주소 {count}개.',
      'toast.arpNone': '이 TV에서는 ARP 캐시를 읽을 수 없습니다.',
      'toast.noBridge': 'webOS 브리지를 사용할 수 없어 패킷을 보낼 수 없습니다.',
      'toast.macFilled': 'ARP 캐시에서 MAC 주소를 채웠습니다.',
      'toast.savedAsDevice': '“{name}”을(를) 기기 목록에 추가했습니다.',
      'toast.settingsReset': '설정을 기본값으로 되돌렸습니다.',
      'toast.noIpToProbe': 'IP 주소가 있는 기기가 없어 확인할 수 없습니다.',

      'confirm.deleteTitle': '기기 삭제',
      'confirm.deleteBody': '“{name}”을(를) 삭제할까요? 되돌릴 수 없습니다.',
      'confirm.resetTitle': '설정 초기화',
      'confirm.resetBody': '모든 설정을 기본값으로 되돌릴까요? 기기 목록은 유지됩니다.',

      'backup.exportTitle': '백업 저장됨',
      'backup.importTitle': '백업에서 복원',
      'backup.exportHint': '아래 파일에 기록했습니다. 복사해 다른 곳에 보관할 수 있습니다.',
      'backup.importHint': '백업 내용을 붙여넣고 복원을 누르세요. 현재 기기 목록이 대체됩니다.',
      'backup.writeFailed': '백업 저장 실패: {error}',
      'backup.readFailed': '백업 읽기 실패: {error}',
      'backup.badJson': '올바른 백업 형식이 아닙니다.',
      'backup.restored': '기기 {count}대를 복원했습니다.',

      'settings.language': '언어',
      'settings.languageHint': '인터페이스 언어와 글자 방향이 이 설정을 따릅니다.',
      'settings.packetTitle': '매직 패킷',
      'settings.defaultPort': '기본 UDP 포트',
      'settings.defaultPortHint': '9가 표준입니다. 일부 기기는 7을 사용합니다.',
      'settings.repeat': '대상당 패킷 수',
      'settings.repeatHint': 'UDP는 손실될 수 있어 첫 패킷이 자주 유실됩니다. 3을 권장합니다.',
      'settings.interval': '패킷 간격 (ms)',
      'settings.timeout': '응답 대기 시간 (ms)',
      'settings.timeoutHint': '상태 확인이 응답을 기다리는 시간입니다.',
      'settings.forceBroadcast': '추가 브로드캐스트 주소',
      'settings.forceBroadcastHint': '선택 사항입니다. 비워 두면 이 TV의 네트워크에서 감지한 주소만 사용합니다.',
      'settings.diagnostics': '진단',
      'settings.diagnosticsHint': '실제 패킷을 한 번 보내 이 TV의 펌웨어가 무엇을 허용하는지 알려줍니다. 깨우기가 안 되면 먼저 실행하세요.',
      'settings.storage': '백업',
      'settings.storageHint': '기기 목록은 앱의 로컬 저장소에 보관되어 업데이트 후에도 남습니다. 백업은 같은 데이터를 TV의 파일로 기록해 다른 TV로 옮길 수 있게 합니다.',
      'settings.about': '정보',
      'about.body': '웨이크 온 랜은 로컬 네트워크로 매직 패킷을 보내 잠든 컴퓨터, NAS, 미디어 플레이어를 켭니다. 패킷은 대상의 MAC 주소를 담은 브로드캐스트이며, 집 밖으로 나가지 않고 인터넷 연결이나 계정이 필요 없습니다.',
      'about.version': '버전',
      'about.service': '백엔드 서비스',
      'about.bridge': 'luna 브리지',
      'about.tvLimit': 'TV는 스스로를 깨울 수 없습니다. 꺼진 TV는 코드를 실행하지 않으며 이 앱은 항상 TV에서 실행됩니다. 다른 기기를 깨우는 데 사용하세요.',

      'diag.idle': '아직 실행하지 않았습니다.',
      'diag.running': '실행 중…',
      'diag.title': '진단 결과',

      'macpad.title': 'MAC 주소 입력',
      'macpad.hint': '리모컨은 키보드로 불편합니다. 16진수를 하나씩 선택하거나 위 입력란과 화면 키보드를 사용하세요.',
      'macpad.backspace': '지우기',
      'macpad.clear': '비우기',
      'macpad.done': '이 주소 사용',

      'nav.hint': '방향키 이동 · Enter 선택 · Back 뒤로',
      'vendor.unknown': '제조사 알 수 없음'
    }
  };

  var current = 'en';
  var listeners = [];

  function languageInfo(code) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return LANGUAGES[i];
    }
    return LANGUAGES[0];
  }

  function format(template, vars) {
    if (!vars) return template;
    return String(template).replace(/\{(\w+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match;
    });
  }

  function t(key, vars) {
    var table = STRINGS[current] || STRINGS.en;
    var template = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : STRINGS.en[key];
    if (typeof template === 'undefined') return key;
    return format(template, vars);
  }

  function apply(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      nodes[i].textContent = t(key);
    }
    var holders = scope.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < holders.length; j++) {
      holders[j].setAttribute('placeholder', t(holders[j].getAttribute('data-i18n-placeholder')));
    }
  }

  function set(code) {
    var info = languageInfo(code);
    current = info.code;

    var html = document.documentElement;
    html.setAttribute('lang', info.code);
    html.setAttribute('dir', info.dir);

    apply(document);
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](info.code); } catch (e) { /* a broken listener must not stop the rest */ }
    }
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  global.I18N = {
    languages: LANGUAGES,
    t: t,
    set: set,
    apply: apply,
    onChange: onChange,
    info: function () { return languageInfo(current); },
    code: function () { return current; }
  };

}(window));
