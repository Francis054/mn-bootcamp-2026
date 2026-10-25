/* Simulated beginner lab. Nothing here contacts a network or runs a command on the computer. */
(function () {
  var PROMPT = 'trainee@ws-01:~$';
  var BANNER = 'Simulated output. These lines are written for the lesson. This terminal does not run commands on your computer or contact a real network.';
  var FINDING = 'Anonymous FTP (port 21)';
  var KEY = 'mn-workstation-lab';
  var APPS = ['notes', 'terminal', 'map', 'lab', 'defend', 'progress'];
  var MODES = ['learn', 'practice', 'defend', 'assessment'];
  var MODE_LABEL = { learn: 'Learn', practice: 'Practice', defend: 'Defend', assessment: 'Assessment' };
  var APP_META = {
    notes: { label: 'Lesson', blurb: 'Addresses, ports, and services' },
    terminal: { label: 'Terminal', blurb: 'Simulated practice commands' },
    map: { label: 'Network', blurb: 'Model of the training LAN' },
    lab: { label: 'Lab brief', blurb: 'Target, checks, and finding' },
    defend: { label: 'Defend', blurb: 'The recommended fix' },
    progress: { label: 'Progress', blurb: 'Objectives and feedback' }
  };
  var OBJECTIVES = [
    { id: 'read', label: 'Read how an address, a port, and a service fit together' },
    { id: 'scan', label: 'List the services on the training target' },
    { id: 'name', label: 'Name the exposed service' },
    { id: 'fix', label: 'Review the recommended defensive fix' }
  ];
  var HINTS = [
    'Start with ip addr. This workstation should show 10.10.8.15 on eth0. The lab brief names the target.',
    'ping 10.10.8.20 checks that the target answers. Then nmap -sV 10.10.8.20 lists the programs behind the open ports.',
    'One listed port is FTP, port 21. Run ftp 10.10.8.20 and see whether it asks for a personal login.'
  ];
  var HELP = 'Practice commands for the Nyansa training LAN.\nSimulated terminal: nothing runs on your computer or on a real network.\n\n  help                     show this list\n  ip addr                  this workstation address\n  ping 10.10.8.20          does the training target answer\n  nmap -sV 10.10.8.20      services on the training target\n  ftp 10.10.8.20           try the file service\n  curl http://10.10.8.20/  read the lab portal\n  ssh trainee@10.10.8.20   try the remote login\n  hint                     next lesson hint\n  clear                    clear the screen\n\nAlso available: whoami, hostname, pwd, ls, cat lab-brief.txt, date, history.';
  var IP_REPORT = '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000\n    inet 127.0.0.1/8 scope host lo\n       valid_lft forever preferred_lft forever\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000\n    link/ether 02:10:08:00:00:15 brd ff:ff:ff:ff:ff:ff\n    inet 10.10.8.15/24 brd 10.10.8.255 scope global eth0\n       valid_lft forever preferred_lft forever\nSimulated addresses for ws-01.';
  var NMAP_REPORT = 'Starting Nmap 7.94 ( https://nmap.org ) at 2026-10-25 09:15 GMT\nNmap scan report for lab-server (10.10.8.20)\nHost is up (0.00041s latency).\nNot shown: 997 closed ports\nPORT   STATE SERVICE VERSION\n21/tcp open  ftp     vsftpd 3.0.5\n22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu\n80/tcp open  http    nginx 1.24.0\nService Info: OS: Linux\nNmap done: 1 IP address (1 host up) scanned in 1.84 seconds\nSimulated report. This target is fictional and was not contacted.';
  var FTP_REPORT = 'Connected to 10.10.8.20.\n220 (vsFTPd 3.0.5)\nName (10.10.8.20:trainee): anonymous\n331 Please specify the password.\nPassword: (empty — accepted)\n230 Login successful.\nRemote system type is UNIX.\nUsing binary mode to transfer files.\nftp> ls\n-rw-r--r--    1 ftp      ftp           312 Oct 25 09:00 README-lab.txt\n-rw-r--r--    1 ftp      ftp           188 Oct 25 09:00 backup-notes.txt\nftp> bye\n221 Goodbye.\nSimulated session. The username anonymous was accepted with no personal account.';
  var HTTP_REPORT = 'HTTP/1.1 200 OK\nServer: nginx/1.24.0\nContent-Type: text/html\n\nNyansa Lab Portal\nThe training target is online.\nThis page is meant to be readable on the lab LAN.\nSimulated page. No login and no secrets.';
  var SSH_REPORT = 'trainee@10.10.8.20: Permission denied (publickey).\nSSH is expected in this lab. It is asking for a key, which is a normal lock.\nThe exposed service is a different port.';
  var README_REPORT = 'Nyansa training server\nThis FTP share is part of the beginner lab.\nIf you can read this without a password, the share is exposed.\nWrite down the service name and the port, then open Defend.\nSimulated file.';
  var NOTES_REPORT = 'Lab backup note\nThis file sits on a share that did not ask for a personal login.\nNothing in it is a real password.\nRecord the service as FTP on port 21, then open Defend.\nSimulated file.';
  var LS_REPORT = 'lab-brief.txt\nnotes.txt';
  var BRIEF_REPORT = 'Nyansa training LAN\nYour address: 10.10.8.15 (ws-01)\nTraining target: 10.10.8.20 (lab-server)\nUse the lab brief beside this terminal for the checks.\nSimulated local file.';
  var NOTES_LOCAL = 'Ports to compare with the lesson\n21  FTP   file transfer\n22  SSH   remote login\n80  HTTP  website\nSimulated local file.';
  var FINDING_NOTE = {
    empty: 'Name the service or the port. One answer, from the scan.',
    ssh: 'SSH on port 22 is expected in this lab. It asked for a key. Look for the service that shares files without a personal login.',
    http: 'The lab portal on port 80 is meant to be readable. Look for the service that shares files without a personal login.',
    dns: 'The scan did not show a DNS service. Use the ports in the simulated nmap report.',
    unknown: 'That does not match the exposed service. Look again at which port accepted a login with no personal account.'
  };
  var UNSAFE = /[;&|`$<>(){}\\!\n\r]/;
  var QUOTES = /['"]/;

  function defaultFlags() {
    return { sawAddress: false, sawPing: false, sawScan: false, sawFtp: false, sawHttp: false, sawSsh: false };
  }
  function defaultObjectives() {
    return { read: false, scan: false, name: false, fix: false };
  }
  function isApp(value) { return APPS.indexOf(value) !== -1; }
  function isMode(value) { return MODES.indexOf(value) !== -1; }
  function completedCount(snapshot) {
    return OBJECTIVES.filter(function (item) { return snapshot.objectives[item.id]; }).length;
  }
  function fixAvailable(snapshot) {
    return snapshot.objectives.name || snapshot.flags.sawFtp;
  }
  function labTasks(snapshot) {
    return [
      { id: 'addr', label: 'Read this workstation address', detail: 'ip addr', done: snapshot.flags.sawAddress },
      { id: 'ping', label: 'Check that the training target answers', detail: 'ping 10.10.8.20', done: snapshot.flags.sawPing },
      { id: 'scan', label: 'List the services and their versions', detail: 'nmap -sV 10.10.8.20', done: snapshot.flags.sawScan },
      { id: 'ftp', label: 'Inspect the file service', detail: 'ftp 10.10.8.20', done: snapshot.flags.sawFtp },
      { id: 'name', label: 'Record the exposed service', detail: 'Use the form below', done: snapshot.objectives.name }
    ];
  }
  function isWindowShown(snapshot, app) {
    if (snapshot.open.indexOf(app) === -1) return false;
    if (app !== 'terminal' && app !== 'defend') return true;
    var defendOpen = snapshot.open.indexOf('defend') !== -1;
    var terminalOpen = snapshot.open.indexOf('terminal') !== -1;
    if (snapshot.active === 'defend' && defendOpen) return app === 'defend';
    if (snapshot.active === 'terminal' && terminalOpen) return app === 'terminal';
    if (terminalOpen) return app === 'terminal';
    if (defendOpen) return app === 'defend';
    return false;
  }
  function say(snapshot, kind, text) {
    var nextId = snapshot.nextLineId;
    var added = text.split('\n').map(function (part) {
      var line = { id: nextId, kind: kind, text: part };
      nextId += 1;
      return line;
    });
    var lines = snapshot.lines.concat(added);
    if (lines.length > 180) {
      var banner = null;
      for (var i = 0; i < lines.length; i += 1) if (lines[i].kind === 'banner') banner = lines[i];
      lines = lines.slice(-150);
      if (banner && (!lines[0] || lines[0].id !== banner.id)) {
        lines = [banner].concat(lines.filter(function (line) { return line.id !== banner.id; }));
      }
    }
    return Object.assign({}, snapshot, { lines: lines, nextLineId: nextId });
  }
  function createWorkstation() {
    var blank = {
      mode: 'learn',
      open: ['notes', 'map', 'lab', 'progress'],
      active: 'notes',
      lines: [],
      nextLineId: 1,
      history: [],
      hintsShown: 0,
      finding: '',
      findingNote: '',
      findingTone: '',
      flags: defaultFlags(),
      objectives: defaultObjectives()
    };
    return say(blank, 'banner', BANNER);
  }
  function openApp(snapshot, app, focus) {
    var open = snapshot.open.slice();
    if (open.indexOf(app) === -1) open.push(app);
    return Object.assign({}, snapshot, { open: open, active: focus === false ? snapshot.active : app });
  }
  function closeApp(snapshot, app) {
    var open = snapshot.open.filter(function (item) { return item !== app; });
    if (snapshot.active !== app) return Object.assign({}, snapshot, { open: open });
    return Object.assign({}, snapshot, { open: open, active: open.length ? open[open.length - 1] : null });
  }
  function enterMode(snapshot, mode) {
    var next = Object.assign({}, snapshot, { mode: mode });
    if (mode === 'practice') return openApp(openApp(next, 'lab', false), 'terminal', true);
    var app = mode === 'learn' ? 'notes' : mode === 'defend' ? 'defend' : 'progress';
    return openApp(next, app, true);
  }
  function withFlag(snapshot, patch, objective) {
    var objectives = Object.assign({}, snapshot.objectives);
    if (objective) objectives[objective] = true;
    return Object.assign({}, snapshot, { flags: Object.assign({}, snapshot.flags, patch), objectives: objectives });
  }
  function judgeFinding(raw) {
    var text = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return 'empty';
    var sets = {
      ftp: ['ftp', 'port 21', '21', '21 tcp', 'tcp 21', 'anonymous', 'anonymous ftp', 'ftp anonymous', 'vsftpd', 'file transfer', 'file transfer protocol', 'ftp port 21', 'port 21 ftp', 'anonymous ftp port 21'],
      ssh: ['ssh', '22', 'port 22', '22 tcp', 'openssh', 'secure shell'],
      http: ['http', '80', 'port 80', '80 tcp', 'nginx', 'web', 'website', 'portal', 'http portal'],
      dns: ['dns', '53', 'port 53', 'domain']
    };
    if (sets.ftp.indexOf(text) !== -1) return 'ftp';
    if (sets.ssh.indexOf(text) !== -1) return 'ssh';
    if (sets.http.indexOf(text) !== -1) return 'http';
    if (sets.dns.indexOf(text) !== -1) return 'dns';
    return 'unknown';
  }
  function recordFinding(snapshot, raw) {
    var judgement = judgeFinding(raw);
    if (judgement === 'ftp') {
      return Object.assign({}, snapshot, {
        finding: FINDING,
        findingTone: 'ok',
        findingNote: 'Recorded. Anonymous FTP on port 21 accepted the username anonymous and listed files. That is the exposed service.',
        objectives: Object.assign({}, snapshot.objectives, { name: true })
      });
    }
    if (snapshot.objectives.name) return snapshot;
    return Object.assign({}, snapshot, { findingTone: 'warn', findingNote: FINDING_NOTE[judgement] });
  }
  function buildFeedback(snapshot) {
    var done = completedCount(snapshot);
    var paragraphs = [];
    if (snapshot.objectives.name) paragraphs.push('You named the exposed service: anonymous FTP on port 21 of lab-server (10.10.8.20). The simulated session accepted the username anonymous and listed README-lab.txt and backup-notes.txt.');
    else if (snapshot.flags.sawScan) paragraphs.push('You have a service list for 10.10.8.20. Three ports answered. Record the one that shares files without a personal login.');
    else if (snapshot.flags.sawPing) paragraphs.push('The training target answered a ping. The next check is nmap -sV 10.10.8.20.');
    else paragraphs.push('The target has not been checked yet. In Practice, read your address, ping 10.10.8.20, then list services.');
    if (snapshot.flags.sawSsh && snapshot.objectives.name) paragraphs.push('SSH on port 22 refused a password and asked for a key. That door is not the problem in this lab.');
    if (snapshot.objectives.fix) paragraphs.push('The defensive fix is reviewed: turn off anonymous FTP or stop the service, move file sharing to SFTP on the SSH port, and do not leave lab notes on a share the whole training LAN can open.');
    else if (fixAvailable(snapshot)) paragraphs.push('Open Defend and review the recommended fix. That is the last security objective.');
    if (!snapshot.objectives.read) paragraphs.push('The Learn panel still has the short explanation of an address, a port, and a service.');
    if (!snapshot.objectives.scan && snapshot.objectives.name) paragraphs.push('The finding is recorded, and the scan objective is still open. Run nmap -sV 10.10.8.20 so the service list is part of your notes.');
    var title = done === 4 ? 'Practice complete' : done === 0 ? 'Assessment' : 'Assessment in progress';
    return { title: title, summary: done + ' of 4 objectives complete.', paragraphs: paragraphs };
  }
  function normalizeCommand(token) {
    var value = token.toLowerCase();
    if (value === '?' || value === 'commands') return 'help';
    if (value === 'ifconfig') return 'ip';
    return value;
  }
  function hostKind(host) {
    var value = host.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
    if (value === '10.10.8.20' || value === 'lab-server') return 'target';
    if (value === '10.10.8.15' || value === 'ws-01' || value === 'localhost' || value === '127.0.0.1') return 'self';
    if (/^10\.10\.8\.\d{1,3}$/.test(value)) return 'lan';
    return 'other';
  }
  function outsideCopy(host, kind) {
    if (kind === 'self') return host + ' is this workstation (ws-01), not the training target.';
    if (kind === 'lan') return 'No reply from ' + host + '. In this lab the training target is 10.10.8.20. Nothing was sent.';
    return host + ' is outside the training LAN. Practice only against 10.10.8.20. Nothing was sent.';
  }
  function printHint(snapshot) {
    if (snapshot.hintsShown >= HINTS.length) {
      return say(snapshot, 'out', 'No further hints. Compare the open ports with the lesson: which one shares files without a personal login?');
    }
    var text = HINTS[snapshot.hintsShown] || '';
    return say(Object.assign({}, snapshot, { hintsShown: snapshot.hintsShown + 1 }), 'out', text);
  }
  function handleCat(snapshot, args) {
    var name = (args[0] || '').replace(/^\.\//, '');
    if (args.length !== 1) return say(snapshot, 'err', 'Usage: cat lab-brief.txt');
    if (name === 'lab-brief.txt') return say(snapshot, 'out', BRIEF_REPORT);
    if (name === 'notes.txt') return say(snapshot, 'out', NOTES_LOCAL);
    if (name === 'README-lab.txt' || name === 'backup-notes.txt') {
      return say(snapshot, 'err', 'That file is on the training target, not on this workstation. Try ftp 10.10.8.20 or curl ftp://10.10.8.20/' + name);
    }
    return say(snapshot, 'err', 'cat: ' + name + ': No such file');
  }
  function handleIp(snapshot, args) {
    var joined = args.map(function (item) { return item.toLowerCase(); }).join(' ');
    var ok = joined === '' || ['a', 'addr', 'address', 'addr show', '-br', 'a show', 'eth0'].indexOf(joined) !== -1;
    if (!ok) return say(snapshot, 'err', 'Usage: ip addr');
    return say(withFlag(snapshot, { sawAddress: true }), 'out', IP_REPORT);
  }
  function handlePing(snapshot, args) {
    var count = 3;
    var hosts = [];
    for (var index = 0; index < args.length; index += 1) {
      var arg = args[index] || '';
      if (arg === '-c') {
        var value = Number(args[index + 1]);
        if (!Number.isInteger(value) || value < 1 || value > 4) return say(snapshot, 'err', 'This simulated ping accepts -c 1 to -c 4, then the training target.');
        count = value;
        index += 1;
        continue;
      }
      if (arg.charAt(0) === '-') return say(snapshot, 'err', 'This simulated ping only supports -c and the target 10.10.8.20.');
      hosts.push(arg);
    }
    if (hosts.length !== 1) return say(snapshot, 'err', 'Usage: ping 10.10.8.20');
    var host = hosts[0] || '';
    var kind = hostKind(host);
    if (kind !== 'target') return say(snapshot, 'err', outsideCopy(host, kind));
    var times = ['0.42', '0.38', '0.41', '0.39'];
    var lines = ['PING 10.10.8.20 (10.10.8.20) 56(84) bytes of data.'];
    for (var seq = 1; seq <= count; seq += 1) lines.push('64 bytes from 10.10.8.20: icmp_seq=' + seq + ' ttl=64 time=' + (times[seq - 1] || '0.40') + ' ms');
    lines.push('', '--- 10.10.8.20 ping statistics ---', count + ' packets transmitted, ' + count + ' received, 0% packet loss, time ' + (count * 12) + 'ms', 'Simulated replies. No packets left this browser.');
    return say(withFlag(snapshot, { sawPing: true }), 'out', lines.join('\n'));
  }
  function handleNmap(snapshot, args) {
    var flags = { '-sv': true, '-f': true, '-pn': true, '--open': true };
    var hosts = [];
    for (var i = 0; i < args.length; i += 1) {
      var arg = args[i];
      if (arg.charAt(0) === '-') {
        if (!flags[arg.toLowerCase()]) return say(snapshot, 'err', 'This simulated nmap supports -sV and -F against 10.10.8.20 only.');
        continue;
      }
      hosts.push(arg);
    }
    if (hosts.length !== 1) return say(snapshot, 'err', 'Usage: nmap -sV 10.10.8.20');
    var host = hosts[0] || '';
    var kind = hostKind(host);
    if (kind !== 'target') return say(snapshot, 'err', 'This simulated nmap only reports on 10.10.8.20. ' + outsideCopy(host, kind));
    return say(withFlag(snapshot, { sawScan: true }, 'scan'), 'out', NMAP_REPORT);
  }
  function handleFtp(snapshot, args) {
    if (args.length !== 1) return say(snapshot, 'err', 'Usage: ftp 10.10.8.20');
    var host = args[0] || '';
    var kind = hostKind(host);
    if (kind !== 'target') return say(snapshot, 'err', 'ftp: ' + outsideCopy(host, kind));
    return say(withFlag(snapshot, { sawFtp: true }), 'out', FTP_REPORT);
  }
  function decodePath(path) {
    var trimmed = path.replace(/\/+$/, '').toLowerCase();
    return trimmed === '' ? '/' : trimmed;
  }
  function handleCurl(snapshot, args) {
    if (args.length !== 1) return say(snapshot, 'err', 'Usage: curl http://10.10.8.20/');
    var raw = args[0] || '';
    var match = /^(https?|ftp):\/\/([^/\s]+)(\/[^?\s]*)?$/i.exec(raw);
    if (!match) return say(snapshot, 'err', 'Usage: curl http://10.10.8.20/');
    var proto = (match[1] || '').toLowerCase();
    var host = match[2] || '';
    var path = decodePath(match[3] || '/');
    if (proto === 'https') return say(snapshot, 'err', 'This lab target only has the plain HTTP page on port 80. Try curl http://10.10.8.20/');
    var kind = hostKind(host);
    if (kind !== 'target') return say(snapshot, 'err', 'curl: ' + outsideCopy(host, kind));
    if (proto === 'http') {
      if (path === '/') return say(withFlag(snapshot, { sawHttp: true }), 'out', HTTP_REPORT);
      return say(snapshot, 'err', 'HTTP/1.1 404 Not Found\nSimulated page. Nothing is published at ' + path + '.');
    }
    var next = withFlag(snapshot, { sawFtp: true });
    if (path === '/') return say(next, 'out', FTP_REPORT);
    if (path === '/readme-lab.txt') return say(next, 'out', README_REPORT);
    if (path === '/backup-notes.txt') return say(next, 'out', NOTES_REPORT);
    return say(next, 'err', '550 ' + path + ': No such file on the simulated FTP share.');
  }
  function handleSsh(snapshot, args) {
    if (args.length !== 1) return say(snapshot, 'err', 'Usage: ssh trainee@10.10.8.20');
    var token = args[0] || '';
    var at = token.indexOf('@');
    var host = at === -1 ? token : token.slice(at + 1);
    var user = at === -1 ? 'trainee' : token.slice(0, at);
    if (user.toLowerCase() !== 'trainee') return say(snapshot, 'err', 'This lab account is trainee. Try ssh trainee@10.10.8.20');
    var kind = hostKind(host);
    if (kind !== 'target') return say(snapshot, 'err', 'ssh: ' + outsideCopy(host, kind));
    return say(withFlag(snapshot, { sawSsh: true }), 'out', SSH_REPORT);
  }
  function applyCommand(snapshot, raw) {
    var input = raw.replace(/\r\n/g, '\n').trim();
    if (!input) return snapshot;
    if (input.length > 160) return say(snapshot, 'err', 'That line is too long for this practice terminal. Try a single command such as nmap -sV 10.10.8.20.');
    var history = snapshot.history.concat([input]).slice(-30);
    var next = Object.assign({}, snapshot, { history: history });
    if (UNSAFE.test(input)) return say(say(next, 'in', input), 'err', 'This practice terminal only runs one lesson command at a time. It cannot chain commands, redirect output, or touch a real system.');
    if (QUOTES.test(input)) return say(say(next, 'in', input), 'err', 'Quotes are not needed here. Try the command without them, for example ping 10.10.8.20.');
    var parts = input.split(/\s+/);
    var token = parts[0] || '';
    if (!/^[a-z?][a-z0-9+.-]*$/i.test(token)) return say(say(next, 'in', input), 'err', 'Type help for the lesson commands. This terminal is simulated.');
    var cmd = normalizeCommand(token);
    var args = parts.slice(1);
    if (cmd === 'clear') {
      var existing = null;
      for (var i = 0; i < next.lines.length; i += 1) if (next.lines[i].kind === 'banner') existing = next.lines[i];
      var banner = existing || { id: next.nextLineId, kind: 'banner', text: BANNER };
      return Object.assign({}, next, { lines: [banner], nextLineId: existing ? next.nextLineId : next.nextLineId + 1 });
    }
    next = say(next, 'in', input);
    if (cmd === 'sudo') return say(next, 'err', 'This terminal has no administrator path. Stay with the lesson commands from help.');
    if (cmd === 'help') return say(next, 'out', HELP);
    if (cmd === 'whoami') return say(next, 'out', 'trainee');
    if (cmd === 'hostname') return say(next, 'out', 'ws-01');
    if (cmd === 'pwd') return say(next, 'out', '/home/trainee');
    if (cmd === 'date') return say(next, 'out', 'Sun Oct 25 09:15:00 GMT 2026\nSimulated clock for the lab story. The taskbar clock is your own computer.');
    if (cmd === 'uname') return say(next, 'out', 'Linux ws-01 6.8.0-lab #1 SMP Sat Oct 25 09:15:00 GMT 2026 x86_64 GNU/Linux\nSimulated kernel string.');
    if (cmd === 'history') return say(next, 'out', next.history.map(function (item, index) { return '  ' + (index + 1) + '  ' + item; }).join('\n'));
    if (cmd === 'hint') return printHint(next);
    if (cmd === 'ls') return say(next, 'out', LS_REPORT);
    if (cmd === 'cd') return say(next, 'out', 'This practice terminal stays in /home/trainee.');
    if (cmd === 'exit') return say(next, 'out', 'There is nothing to exit. Close the window from its title bar, or keep working.');
    if (cmd === 'man') return say(next, 'err', 'Manual pages are not installed in this simulation. Type help.');
    if (cmd === 'wget') return say(next, 'err', 'Use curl for this lesson. Try curl http://10.10.8.20/');
    if (cmd === 'cat') return handleCat(next, args);
    if (cmd === 'ip') return handleIp(next, args);
    if (cmd === 'ping') return handlePing(next, args);
    if (cmd === 'nmap') return handleNmap(next, args);
    if (cmd === 'ftp') return handleFtp(next, args);
    if (cmd === 'curl') return handleCurl(next, args);
    if (cmd === 'ssh') return handleSsh(next, args);
    return say(next, 'err', 'bash: ' + cmd + ': command not found\nType help for the lesson commands. This terminal is simulated.');
  }

  function networkVisuals(snapshot) {
    var scanned = snapshot.flags.sawScan;
    var up = snapshot.flags.sawPing || scanned;
    var found = snapshot.flags.sawFtp || snapshot.objectives.name;
    var secured = snapshot.objectives.fix;
    var port21 = secured ? 'secured' : found ? 'exposed' : scanned ? 'online' : 'idle';
    function port21Detail(tone) {
      if (tone === 'secured') return 'FTP · marked secured in this lesson';
      if (tone === 'exposed') return 'FTP · anonymous login, exposed';
      if (tone === 'online') return 'FTP · open, not inspected';
      return 'FTP · not listed yet';
    }
    var summary = 'Your machine is ws-01. The training server stays dark until you ping or scan it.';
    if (port21 === 'secured') summary = 'Port 21 is marked secured. The red glow is gone and the port shows a lock. Nothing on a real network was changed.';
    else if (port21 === 'exposed') summary = 'Port 21 is the exposed service: anonymous FTP. It glows until you review the fix.';
    else if (scanned) summary = 'lab-server is lit and three ports are open. Inspect the file service before you name it.';
    else if (up) summary = 'lab-server is answering. Ports stay unknown until you scan.';
    return {
      summary: summary,
      items: [
        { id: 'you', label: 'ws-01', detail: '10.10.8.15 · your machine, where the checks run', tone: 'online' },
        { id: 'target', label: 'lab-server', detail: up ? '10.10.8.20 · answering on the training LAN' : '10.10.8.20 · not checked yet', tone: up ? 'online' : 'idle' },
        { id: 'p21', label: 'Port 21', detail: port21Detail(port21), tone: port21 },
        { id: 'p22', label: 'Port 22', detail: scanned || snapshot.flags.sawSsh ? 'SSH · open, asks for a key' : 'SSH · not listed yet', tone: scanned || snapshot.flags.sawSsh ? 'expected' : 'idle' },
        { id: 'p80', label: 'Port 80', detail: scanned || snapshot.flags.sawHttp ? 'HTTP · lab portal, meant to be readable' : 'HTTP · not listed yet', tone: scanned || snapshot.flags.sawHttp ? 'expected' : 'idle' }
      ]
    };
  }

  function repair(value) {
    if (!value || typeof value !== 'object' || value.v !== 1 || !value.state || typeof value.state !== 'object') return null;
    var source = value.state;
    var fallback = ['notes', 'map', 'lab', 'progress'];
    var open = [];
    if (Array.isArray(source.open)) {
      source.open.forEach(function (item) {
        if (isApp(item) && open.indexOf(item) === -1) open.push(item);
      });
    }
    if (!open.length) open = fallback;
    var active = isApp(source.active) && open.indexOf(source.active) !== -1 ? source.active : open[open.length - 1];
    var kinds = { banner: true, in: true, out: true, err: true };
    var cleaned = [];
    if (Array.isArray(source.lines)) {
      source.lines.forEach(function (item) {
        if (!item || typeof item !== 'object') return;
        if (!kinds[item.kind] || typeof item.text !== 'string') return;
        cleaned.push({ kind: item.kind, text: item.text.slice(0, 2000) });
      });
    }
    cleaned = cleaned.slice(-180);
    if (!cleaned.some(function (line) { return line.kind === 'banner'; })) cleaned.unshift({ kind: 'banner', text: BANNER });
    var lines = cleaned.map(function (line, index) { return { id: index + 1, kind: line.kind, text: line.text }; });
    var finding = source.finding === FINDING ? source.finding : '';
    var objectives = defaultObjectives();
    if (source.objectives && typeof source.objectives === 'object') {
      Object.keys(objectives).forEach(function (key) { objectives[key] = source.objectives[key] === true; });
    }
    if (finding) objectives.name = true;
    var flags = defaultFlags();
    if (source.flags && typeof source.flags === 'object') {
      Object.keys(flags).forEach(function (key) { flags[key] = source.flags[key] === true; });
    }
    var history = Array.isArray(source.history) ? source.history.filter(function (item) { return typeof item === 'string'; }).map(function (item) { return item.slice(0, 160); }).slice(-30) : [];
    var hintsShown = Number.isInteger(source.hintsShown) ? Math.min(3, Math.max(0, source.hintsShown)) : 0;
    var findingTone = finding ? 'ok' : (source.findingTone === 'warn' ? 'warn' : '');
    return {
      mode: isMode(source.mode) ? source.mode : 'learn',
      open: open,
      active: active,
      lines: lines,
      nextLineId: lines.length + 1,
      history: history,
      hintsShown: hintsShown,
      finding: finding,
      findingNote: typeof source.findingNote === 'string' ? source.findingNote.slice(0, 500) : '',
      findingTone: findingTone,
      flags: flags,
      objectives: objectives
    };
  }
  function load() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      return repair(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }
  function save(snapshot) {
    try { sessionStorage.setItem(KEY, JSON.stringify({ v: 1, state: snapshot })); } catch (error) { /* private mode still runs until reload */ }
  }

  var state = load() || createWorkstation();
  var histIndex = -1;
  var resetArmed = false;
  var launcher = false;
  var focusTerminal = false;
  var yaw = -32;
  var pitch = 18;
  var drag = null;
  var celebrateTimer = 0;
  var reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function esc(value) {
    return String(value).replace(/[&<>]/g, function (char) {
      return char === '&' ? '&amp;' : char === '<' ? '&lt;' : '&gt;';
    });
  }
  function setLive(message) {
    var node = document.getElementById('ws-live');
    node.textContent = '';
    window.setTimeout(function () { node.textContent = message; }, 20);
  }
  function celebrate(label) {
    var node = document.getElementById('ws-celebrate');
    var shards = '';
    for (var i = 0; i < 8; i += 1) shards += '<i style="--i:' + i + '"></i>';
    node.innerHTML = '<span class="ws-celebrate__shards">' + shards + '</span><p><strong>Objective complete</strong><span>' + esc(label) + '</span></p>';
    node.hidden = false;
    window.clearTimeout(celebrateTimer);
    celebrateTimer = window.setTimeout(function () { node.hidden = true; node.innerHTML = ''; }, 4200);
  }
  function commit(next, message) {
    var gained = OBJECTIVES.filter(function (item) { return !state.objectives[item.id] && next.objectives[item.id]; });
    state = next;
    save(state);
    render();
    if (gained.length) {
      var label = gained.map(function (item) { return item.label; }).join('. ');
      celebrate(label);
      setLive('Objective complete: ' + label + '.');
      return;
    }
    if (message) setLive(message);
  }
  function focusApp(app) {
    if (!isApp(app)) return;
    if (state.open.indexOf(app) === -1) {
      if (app === 'terminal') focusTerminal = true;
      commit(openApp(state, app, true), APP_META[app].label + ' open.');
      return;
    }
    if (state.active === app) return;
    if (app === 'terminal') focusTerminal = true;
    var next = Object.assign({}, state, { active: app });
    state = next;
    save(state);
    render();
  }

  function cube(tone, size) {
    return '<span class="ws-cube ws-cube--' + size + ' ws-cube--' + tone + '"><i></i><i></i><i></i><i></i><i></i><i></i></span>';
  }
  function renderMap() {
    var visual = networkVisuals(state);
    var byId = {};
    visual.items.forEach(function (item) { byId[item.id] = item; });
    var reduced = reducedQuery.matches;
    var tone = { idle: 'Idle', online: 'Online', exposed: 'Exposed', secured: 'Secured', expected: 'Expected' };
    var list = visual.items.map(function (item) {
      return '<li><span class="ws-status__tone ws-status__tone--' + item.tone + '">' + tone[item.tone] + '</span><span class="ws-status__name">' + esc(item.label) + '</span><span class="ws-status__detail">' + esc(item.detail) + '</span></li>';
    }).join('');
    var note = reduced
      ? 'Flat diagram, because reduced motion is on. The list is the same state, in text.'
      : 'Simulated model. Drag it to look around. The list is the same state, in text.';
    var picture = reduced
      ? '<div class="ws-flat" aria-hidden="true"><div class="ws-flat__node ws-flat__node--' + byId.you.tone + '"><b>' + esc(byId.you.label) + '</b><small>Your machine</small></div><span class="ws-flat__wire ws-flat__wire--' + byId.target.tone + '"></span><div class="ws-flat__host ws-flat__host--' + byId.target.tone + '"><div class="ws-flat__node"><b>' + esc(byId.target.label) + '</b><small>Training target</small></div><ul><li data-tone="' + byId.p21.tone + '">21 ' + tone[byId.p21.tone] + '</li><li data-tone="' + byId.p22.tone + '">22 ' + tone[byId.p22.tone] + '</li><li data-tone="' + byId.p80.tone + '">80 ' + tone[byId.p80.tone] + '</li></ul></div></div>'
      : '<div class="ws-scene" aria-hidden="true"><div class="ws-scene__world" data-testid="network-3d" style="transform:rotateX(' + pitch + 'deg) rotateY(' + yaw + 'deg);--yaw:' + yaw + 'deg;--pitch:' + pitch + 'deg"><div class="ws-floor"></div><div class="ws-cable ws-cable--' + byId.target.tone + '"></div><div class="ws-node ws-node--you">' + cube(byId.you.tone, 'host') + '<span class="ws-billboard">You</span></div><div class="ws-node ws-node--target">' + cube(byId.target.tone, 'host') + '<span class="ws-billboard">lab-server</span><div class="ws-port ws-port--21">' + cube(byId.p21.tone, 'port') + '<span class="ws-billboard">' + (byId.p21.tone === 'secured' ? '21 locked' : '21') + '</span></div><div class="ws-port ws-port--22">' + cube(byId.p22.tone, 'port') + '<span class="ws-billboard">22</span></div><div class="ws-port ws-port--80">' + cube(byId.p80.tone, 'port') + '<span class="ws-billboard">80</span></div></div></div></div><div class="ws-map__controls" role="group" aria-label="Rotate the network model"><button type="button" class="btn btn--ghost-light btn--xs" data-yaw="-24">Rotate left</button><button type="button" class="btn btn--ghost-light btn--xs" data-yaw="24">Rotate right</button><button type="button" class="btn btn--ghost-light btn--xs" data-yaw="reset">Reset view</button></div>';
    document.getElementById('ws-map').innerHTML = '<h3>Training network</h3><p class="ws-map__summary">' + esc(visual.summary) + '</p><div class="ws-map__view ' + (reduced ? 'ws-map__view--flat' : 'ws-map__view--orbit') + '">' + picture + '<div class="ws-map__readout"><ul class="ws-status">' + list + '</ul><p class="ws-map__note">' + note + '</p></div></div>';
  }
  function render() {
    var done = completedCount(state);
    document.getElementById('ws-score-text').textContent = done + ' of 4 objectives';
    document.querySelector('#ws-meter i').style.transform = 'scaleX(' + (done / 4) + ')';
    document.querySelectorAll('.tab').forEach(function (tab) {
      var on = tab.getAttribute('data-mode') === state.mode;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('.ws-window').forEach(function (win) {
      var app = win.getAttribute('data-app');
      win.hidden = !isWindowShown(state, app);
      win.classList.toggle('is-active', state.active === app);
    });
    document.querySelectorAll('[data-dock]').forEach(function (button) {
      var app = button.getAttribute('data-dock');
      var open = state.open.indexOf(app) !== -1;
      button.setAttribute('aria-pressed', open ? 'true' : 'false');
      button.setAttribute('aria-label', (open ? 'Focus ' : 'Open ') + APP_META[app].label);
      button.classList.toggle('is-active', state.active === app);
    });
    document.getElementById('ws-notes-actions').innerHTML = (state.objectives.read
      ? '<p class="ws-note ws-note--ok">Explanation marked as read.</p>'
      : '<button class="btn btn--sm" type="button" data-action="read">Mark this explanation as read</button>')
      + '<button class="btn btn--ghost-light btn--sm" type="button" data-action="show-map">Show the network model</button>';
    document.getElementById('ws-term').innerHTML = state.lines.map(function (line) {
      var prompt = line.kind === 'in' ? '<span class="ws-prompt">' + PROMPT + ' </span>' : '';
      return '<div class="ws-line ws-line--' + line.kind + '">' + prompt + esc(line.text) + '</div>';
    }).join('');
    document.getElementById('ws-tasks').innerHTML = labTasks(state).map(function (task) {
      return '<li data-done="' + (task.done ? 'true' : 'false') + '"><span class="ws-task__state">' + (task.done ? 'Done' : 'To do') + '</span><span>' + esc(task.label) + '</span><code>' + esc(task.detail) + '</code></li>';
    }).join('');
    var finding = document.getElementById('ws-finding');
    if (state.finding) {
      finding.innerHTML = '<p class="ws-note ws-note--ok">' + esc(state.findingNote) + ' Recorded as ' + esc(FINDING) + '.</p>';
    } else if (!finding.querySelector('#finding-service')) {
      finding.innerHTML = '<form id="ws-finding-form"><label for="finding-service">Which service should not be open like this?</label><input id="finding-service" class="ws-field" autocomplete="off" aria-describedby="finding-note"><p id="finding-note" class="ws-hint">Type the service name or the port number. One answer.</p><button class="btn btn--sm" type="submit">Record finding</button></form>';
    }
    var note = document.getElementById('finding-note');
    if (note && !state.finding) {
      note.textContent = state.findingNote || 'Type the service name or the port number. One answer.';
      note.className = state.findingTone === 'warn' ? 'ws-note ws-note--warn' : 'ws-hint';
      note.setAttribute('role', state.findingNote ? 'status' : '');
    }
    document.getElementById('ws-hints').innerHTML = state.hintsShown
      ? '<ol class="ws-hints">' + HINTS.slice(0, state.hintsShown).map(function (hint) { return '<li>' + esc(hint) + '</li>'; }).join('') + '</ol>'
      : '<p>Hints stay hidden until you ask. Three are available.</p>';
    document.getElementById('ws-hint-btn').disabled = state.hintsShown >= HINTS.length;
    var defend = document.getElementById('ws-defend');
    if (!fixAvailable(state)) {
      defend.innerHTML = '<h3>A fix has a shape before it has a name</h3><p>When a service is exposed, the usual defensive choices are to turn it off, replace it with one that asks for a personal login, or allow it only from a trusted machine.</p><p>The service in this lab is named here after you have seen it in the terminal. Inspect the file service from Practice, or record the finding, then come back.</p>';
    } else {
      defend.innerHTML = '<h3>Close the anonymous FTP share</h3><p>Port 21 on lab-server (10.10.8.20) is FTP, and the simulated session accepted the username anonymous. It then listed README-lab.txt and backup-notes.txt. Anyone on the training LAN could read those files. SSH on port 22 did not do that: it asked for a key. The website on port 80 is the lab portal and is meant to be readable.</p><ol class="ws-steps"><li>Turn anonymous login off. If nobody needs FTP, stop the service and close port 21.</li><li>Move file sharing to SFTP, which uses SSH on port 22. That door already asks for a key in this lab.</li><li>If a share has to remain, allow it only from the trainer machine, not from every address in 10.10.8.0/24.</li><li>Take lab notes off any share that opens without a personal login.</li></ol><p>You do not need another scan. Naming the open door and choosing this fix is the exercise. Nothing here changes a real server. The network model turns that port green once you mark the fix reviewed.</p><div class="ws-actions">' + (state.objectives.fix ? '<p class="ws-note ws-note--ok">Fix reviewed. Port 21 is marked secured in the model.</p>' : '<button class="btn btn--sm" type="button" data-action="review">I have reviewed the recommended fix</button>') + '</div>';
    }
    var feedback = buildFeedback(state);
    var objectives = OBJECTIVES.map(function (item) {
      var complete = state.objectives[item.id];
      return '<li data-done="' + (complete ? 'true' : 'false') + '"><span>' + (complete ? 'Complete' : 'Not yet') + '</span><span>' + esc(item.label) + '</span></li>';
    }).join('');
    var history = state.history.length
      ? '<ol class="ws-history">' + state.history.slice(-8).map(function (item) { return '<li><code>' + esc(item) + '</code></li>'; }).join('') + '</ol>'
      : '<p>Commands from the terminal are listed here.</p>';
    var reset = resetArmed
      ? '<button class="btn btn--danger btn--sm" type="button" data-action="reset-yes">Confirm reset</button><button class="btn btn--ghost-light btn--sm" type="button" data-action="reset-no">Keep my progress</button>'
      : '<button class="btn btn--ghost-light btn--sm" type="button" data-action="reset">Reset this practice</button>';
    document.getElementById('ws-progress').innerHTML = '<section id="ws-assessment" aria-labelledby="ws-feedback-title"><h3 id="ws-feedback-title">' + esc(feedback.title) + '</h3><p><strong>' + esc(feedback.summary) + '</strong></p>' + feedback.paragraphs.map(function (paragraph) { return '<p>' + esc(paragraph) + '</p>'; }).join('') + '</section><h3>Objectives</h3><ul class="ws-objectives">' + objectives + '</ul><h3>Commands you ran</h3>' + history + '<div class="ws-actions">' + reset + '</div>';
    renderMap();
    placeInk();
    var term = document.getElementById('ws-term');
    term.scrollTop = term.scrollHeight;
    var launch = document.getElementById('ws-launch');
    launch.setAttribute('aria-expanded', launcher ? 'true' : 'false');
    document.getElementById('ws-backdrop').hidden = !launcher;
    document.getElementById('ws-launcher').hidden = !launcher;
    if (focusTerminal && state.active === 'terminal') {
      var command = document.getElementById('ws-command');
      if (command) command.focus();
      focusTerminal = false;
    }
  }
  function placeInk() {
    var tab = document.querySelector('.tab[aria-selected="true"]');
    var ink = document.getElementById('ws-ink');
    if (!tab || !ink) return;
    ink.style.left = tab.offsetLeft + 'px';
    ink.style.width = tab.offsetWidth + 'px';
  }
  function fillLauncher() {
    var menu = document.getElementById('ws-launcher');
    menu.innerHTML = APPS.map(function (app, index) {
      var icon = { notes: 'book', terminal: 'terminal', map: 'network', lab: 'scan', defend: 'shield', progress: 'award' }[app];
      return '<button type="button" role="menuitem" data-dock="' + app + '" data-launcher="1"' + (index === 0 ? ' id="ws-launcher-first"' : '') + '><svg class="i" aria-hidden="true"><use href="#i-' + icon + '"/></svg><b>' + APP_META[app].label + '</b><small>' + APP_META[app].blurb + '</small></button>';
    }).join('');
  }
  function setLauncher(open) {
    launcher = open;
    document.getElementById('ws-launch').setAttribute('aria-expanded', open ? 'true' : 'false');
    document.getElementById('ws-backdrop').hidden = !open;
    document.getElementById('ws-launcher').hidden = !open;
    if (open) {
      var first = document.getElementById('ws-launcher-first');
      if (first) first.focus();
    }
  }
  function applyYaw(delta) {
    if (delta === 'reset') { yaw = -32; pitch = 18; }
    else yaw += Number(delta);
    var world = document.querySelector('[data-testid="network-3d"]');
    if (!world) return;
    world.style.transform = 'rotateX(' + pitch + 'deg) rotateY(' + yaw + 'deg)';
    world.style.setProperty('--yaw', yaw + 'deg');
    world.style.setProperty('--pitch', pitch + 'deg');
  }

  document.addEventListener('click', function (event) {
    var mode = event.target.closest('[data-mode]');
    if (mode && event.target.closest('#ws-tabs')) {
      var id = mode.getAttribute('data-mode');
      if (isMode(id) && id !== state.mode) {
        if (id === 'practice') focusTerminal = true;
        commit(enterMode(state, id), MODE_LABEL[id] + ' mode.');
      }
      return;
    }
    var yawButton = event.target.closest('[data-yaw]');
    if (yawButton) { applyYaw(yawButton.getAttribute('data-yaw')); return; }
    var command = event.target.closest('[data-command]');
    if (command) {
      var input = document.getElementById('ws-command');
      input.value = command.getAttribute('data-command');
      input.focus();
      histIndex = -1;
      return;
    }
    var close = event.target.closest('[data-close]');
    if (close) {
      var closing = close.getAttribute('data-close');
      commit(closeApp(state, closing), APP_META[closing].label + ' closed.');
      return;
    }
    var dock = event.target.closest('[data-dock]');
    if (dock) {
      var fromLauncher = dock.hasAttribute('data-launcher');
      focusApp(dock.getAttribute('data-dock'));
      if (fromLauncher) setLauncher(false);
      return;
    }
    var action = event.target.closest('[data-action]');
    if (!action) return;
    var name = action.getAttribute('data-action');
    if (name === 'read') commit(Object.assign({}, state, { objectives: Object.assign({}, state.objectives, { read: true }) }));
    else if (name === 'show-map') focusApp('map');
    else if (name === 'show-lab') focusApp('lab');
    else if (name === 'show-terminal') { focusTerminal = true; focusApp('terminal'); }
    else if (name === 'hint') {
      if (state.hintsShown >= HINTS.length) setLive('No further hints. Compare the open ports with the lesson.');
      else commit(Object.assign({}, state, { hintsShown: state.hintsShown + 1 }), 'A hint is shown in the lab brief.');
    } else if (name === 'review') {
      if (fixAvailable(state) && !state.objectives.fix) {
        commit(Object.assign({}, state, { objectives: Object.assign({}, state.objectives, { fix: true }) }));
      }
    } else if (name === 'reset') { resetArmed = true; render(); }
    else if (name === 'reset-no') { resetArmed = false; render(); }
    else if (name === 'reset-yes') {
      resetArmed = false;
      histIndex = -1;
      document.getElementById('ws-command').value = '';
      document.getElementById('ws-celebrate').hidden = true;
      commit(createWorkstation(), 'Practice reset. Progress in this tab has been cleared.');
    } else if (name === 'launcher') setLauncher(!launcher);
    else if (name === 'launcher-close') { setLauncher(false); document.getElementById('ws-launch').focus(); }
  });
  document.addEventListener('submit', function (event) {
    if (event.target.id === 'ws-form') {
      event.preventDefault();
      var input = document.getElementById('ws-command');
      var value = input.value;
      if (!value.trim()) return;
      var name = (value.trim().split(/\s+/)[0] || 'command').toLowerCase();
      focusTerminal = true;
      commit(applyCommand(state, value), name === 'clear' ? 'Terminal cleared. The simulated banner stays.' : 'Simulated output added for ' + name + '.');
      input.value = '';
      histIndex = -1;
      return;
    }
    if (event.target.id === 'ws-finding-form') {
      event.preventDefault();
      var field = document.getElementById('finding-service');
      var next = recordFinding(state, field ? field.value : '');
      commit(next, next.findingNote);
    }
  });
  document.addEventListener('keydown', function (event) {
    var command = document.getElementById('ws-command');
    if (document.activeElement === command && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      if (!state.history.length) return;
      event.preventDefault();
      var start = histIndex < 0 ? state.history.length : histIndex;
      var nextIndex = event.key === 'ArrowUp' ? Math.max(0, start - 1) : Math.min(state.history.length, start + 1);
      if (nextIndex === state.history.length) { histIndex = -1; command.value = ''; return; }
      histIndex = nextIndex;
      command.value = state.history[nextIndex] || '';
      return;
    }
    if (launcher && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      var items = Array.prototype.slice.call(document.querySelectorAll('#ws-launcher [role="menuitem"]'));
      var index = items.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      var next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next].focus();
      return;
    }
    if (launcher && event.key === 'Escape') {
      event.preventDefault();
      setLauncher(false);
      document.getElementById('ws-launch').focus();
      return;
    }
    if (event.target.closest && event.target.closest('#ws-tabs') && (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End')) {
      var tabs = Array.prototype.slice.call(document.querySelectorAll('#ws-tabs .tab'));
      var current = tabs.findIndex(function (tab) { return tab.getAttribute('aria-selected') === 'true'; });
      var target = current;
      if (event.key === 'ArrowRight') target = (current + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') target = (current - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') target = 0;
      else target = tabs.length - 1;
      event.preventDefault();
      var chosen = tabs[target].getAttribute('data-mode');
      if (chosen === 'practice') focusTerminal = true;
      commit(enterMode(state, chosen), MODE_LABEL[chosen] + ' mode.');
      document.getElementById('tab-' + chosen).focus();
    }
  });
  document.addEventListener('pointerdown', function (event) {
    var scene = event.target.closest('.ws-scene');
    if (scene && event.button === 0 && !reducedQuery.matches) {
      drag = { x: event.clientX, y: event.clientY, yaw: yaw, pitch: pitch };
      scene.classList.add('is-dragging');
      return;
    }
    var win = event.target.closest('.ws-window');
    if (!win || event.target.closest('button, a, input, textarea, label')) return;
    focusApp(win.getAttribute('data-app'));
  });
  window.addEventListener('pointermove', function (event) {
    if (!drag) return;
    yaw = drag.yaw + (event.clientX - drag.x) * 0.45;
    pitch = Math.min(42, Math.max(-12, drag.pitch - (event.clientY - drag.y) * 0.3));
    applyYaw(0);
  });
  window.addEventListener('pointerup', function () {
    drag = null;
    var scene = document.querySelector('.ws-scene');
    if (scene) scene.classList.remove('is-dragging');
  });
  reducedQuery.addEventListener('change', render);
  window.addEventListener('resize', placeInk);
  function tickClock() {
    document.getElementById('ws-clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  tickClock();
  window.setInterval(tickClock, 15000);
  fillLauncher();
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeInk);
})();
