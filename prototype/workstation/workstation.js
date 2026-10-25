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
    { id: 'read', label: 'Finish the address section and submit its flag' },
    { id: 'scan', label: 'List the services on the training target' },
    { id: 'name', label: 'Submit the flag for the open file service' },
    { id: 'fix', label: 'Submit the flag for the blue-team fix' }
  ];
  var XP_PER_CHECK = 20;
  var XP_PER_TASK = 30;
  var XP_PER_FLAG = 30;
  var SECTIONS = [
    {
      id: 'address',
      title: 'Addresses',
      task: 'address',
      command: 'ip',
      unlocks: 'ip addr',
      paragraphs: [
        'Every device on this lab network has an IP address. That is the number other devices use to reach it. Your workstation is 10.10.8.15. The training server, lab-server, is 10.10.8.20.',
        'The /24 means the first three numbers, 10.10.8, name the network, and the last number picks the device. Addresses that start with 10 are private. They are used inside a lab or an office. 10.10.8.20 is not a public internet address.'
      ],
      questions: [
        { id: 'addr-target', kind: 'text', prompt: 'What is the IP address of the training target, lab-server?', accept: ['10.10.8.20'] },
        { id: 'addr-private', kind: 'choice', prompt: 'An address that starts with 10 is used…', accept: ['private'], choices: [
          { id: 'public', label: 'On the public internet' },
          { id: 'private', label: 'Inside a lab or an office' },
          { id: 'port', label: 'As a port number' }
        ] }
      ],
      hints: [
        'The lesson names two addresses. lab-server is the training target, and it is not 10.10.8.15.',
        'After ip addr is unlocked, eth0 shows your own address. The lesson flag is the last line of that simulated output.'
      ],
      flagAccept: ['MN{10.10.8.15}', '10.10.8.15']
    },
    {
      id: 'reach',
      title: 'Is the host there?',
      task: 'reach',
      command: 'ping',
      unlocks: 'ping 10.10.8.20',
      paragraphs: [
        'ping asks whether a host answers. It does not list services, and it does not open a door. In this lab the only host you may check is 10.10.8.20.',
        'Any other address is out of scope. The terminal will say that nothing was sent.'
      ],
      questions: [
        { id: 'reach-cmd', kind: 'choice', prompt: 'Which command only asks whether the target answers?', accept: ['ping'], choices: [
          { id: 'ping', label: 'ping 10.10.8.20' },
          { id: 'nmap', label: 'nmap -sV 10.10.8.20' },
          { id: 'ftp', label: 'ftp 10.10.8.20' }
        ] },
        { id: 'reach-scope', kind: 'choice', prompt: 'A host that is not 10.10.8.20 is…', accept: ['scope'], choices: [
          { id: 'scope', label: 'Out of scope for this lab' },
          { id: 'next', label: 'The next machine you should scan' },
          { id: 'target', label: 'The training target' }
        ] }
      ],
      hints: [
        'ping is the “are you there?” check. The host in scope is lab-server.',
        'The simulated ping ends with a lesson flag. Submit that flag before the next section opens.'
      ],
      flagAccept: ['MN{host-up}', 'host-up', 'host up']
    },
    {
      id: 'ports',
      title: 'Ports and services',
      task: 'ports',
      command: 'nmap',
      unlocks: 'nmap -sV 10.10.8.20',
      paragraphs: [
        'A port is a numbered door on an address. Port 21 is the usual door for FTP, an old way to move files. Port 22 is the usual door for SSH, a remote login. Port 80 is the usual door for a website.',
        'A service is the program listening behind a door. An open port only tells you that some program answered. nmap -sV lists the program. In this workstation that list is simulated.'
      ],
      questions: [
        { id: 'ports-ftp', kind: 'text', prompt: 'What is the usual port number for FTP?', accept: ['21'] },
        { id: 'ports-service', kind: 'choice', prompt: 'A service is…', accept: ['program'], choices: [
          { id: 'program', label: 'The program listening behind a door' },
          { id: 'address', label: 'The IP address itself' },
          { id: 'name', label: 'The computer’s hostname' }
        ] }
      ],
      hints: [
        'Use the port table in the lesson. FTP is the file door, and its usual number is in the low twenties.',
        'The simulated nmap report ends with a lesson flag. It names the three open ports.'
      ],
      flagAccept: ['MN{21-22-80}', '21-22-80', '21,22,80', '21 22 80']
    },
    {
      id: 'inspect',
      title: 'The open cupboard',
      task: 'inspect',
      command: 'ftp',
      unlocks: 'ftp 10.10.8.20',
      paragraphs: [
        'An open port is not always a problem. SSH that asks for a key is a normal lock. The website on port 80 is meant to be readable. A file service that lets anyone in with the name anonymous is an open cupboard.',
        'This is the red-team step, and it stays inside the lab. You look only at 10.10.8.20, with the prepared commands. You do not try this on a real server.'
      ],
      questions: [
        { id: 'inspect-lock', kind: 'choice', prompt: 'Which of these is a normal lock in this lab?', accept: ['ssh'], choices: [
          { id: 'ssh', label: 'SSH asking for a key' },
          { id: 'anon', label: 'FTP that accepts the name anonymous' },
          { id: 'share', label: 'A file share the whole lab can read' }
        ] },
        { id: 'inspect-port', kind: 'text', prompt: 'Which port number is the file service you should inspect?', accept: ['21'] }
      ],
      hints: [
        'The normal lock asks for a key. The file door is port 21.',
        'The simulated FTP session accepts anonymous and prints a lesson flag at the end.'
      ],
      flagAccept: ['MN{anonymous-ftp}', 'anonymous-ftp', 'anonymous ftp', 'anonymous', 'ftp', 'port 21']
    },
    {
      id: 'defend',
      title: 'Close the gap',
      task: 'defend',
      command: 'defend',
      unlocks: 'the recommended fix',
      paragraphs: [
        'The blue-team step is to close the gap you just found. Turn anonymous login off. If nobody needs FTP, stop the service and close port 21.',
        'Move file sharing to SFTP, which uses SSH on port 22. That door already asks for a key. Do not leave lab notes on a share the whole training LAN can open. Nothing here changes a real server.'
      ],
      questions: [
        { id: 'def-off', kind: 'choice', prompt: 'The first change for this file share is to…', accept: ['off'], choices: [
          { id: 'off', label: 'Turn anonymous login off' },
          { id: 'web', label: 'Publish the files on the public website' },
          { id: 'share', label: 'Give the class the anonymous password' }
        ] },
        { id: 'def-sftp', kind: 'choice', prompt: 'A safer file share in this lab uses…', accept: ['sftp'], choices: [
          { id: 'sftp', label: 'SFTP on the SSH port, 22' },
          { id: 'ftp', label: 'Anonymous FTP on port 21' },
          { id: 'new', label: 'A new website with no login' }
        ] }
      ],
      hints: [
        'Anonymous means anyone. The fix starts by turning that off.',
        'The safer share uses the door that already asks for a key. The lesson flag is printed at the end of the fix.'
      ],
      flagAccept: ['MN{close-anonymous-ftp}', 'close-anonymous-ftp', 'sftp']
    }
  ];
  var HELP = 'Practice commands for the Nyansa training LAN.\nSimulated terminal: nothing runs on your computer or on a real network.\nA command stays locked until that section’s lesson checks are correct.\n\n  help                     show this list\n  ip addr                  this workstation address\n  ping 10.10.8.20          does the training target answer\n  nmap -sV 10.10.8.20      services on the training target\n  ftp 10.10.8.20           try the file service\n  curl http://10.10.8.20/  read the lab portal\n  ssh trainee@10.10.8.20   try the remote login\n  hint                     next lesson hint\n  clear                    clear the screen\n\nAlso available: whoami, hostname, pwd, ls, cat lab-brief.txt, date, history.';
  var IP_REPORT = '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000\n    inet 127.0.0.1/8 scope host lo\n       valid_lft forever preferred_lft forever\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000\n    link/ether 02:10:08:00:00:15 brd ff:ff:ff:ff:ff:ff\n    inet 10.10.8.15/24 brd 10.10.8.255 scope global eth0\n       valid_lft forever preferred_lft forever\nSimulated addresses for ws-01.\nLesson flag: MN{10.10.8.15}';
  var NMAP_REPORT = 'Starting Nmap 7.94 ( https://nmap.org ) at 2026-10-25 09:15 GMT\nNmap scan report for lab-server (10.10.8.20)\nHost is up (0.00041s latency).\nNot shown: 997 closed ports\nPORT   STATE SERVICE VERSION\n21/tcp open  ftp     vsftpd 3.0.5\n22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu\n80/tcp open  http    nginx 1.24.0\nService Info: OS: Linux\nNmap done: 1 IP address (1 host up) scanned in 1.84 seconds\nSimulated report. This target is fictional and was not contacted.\nLesson flag: MN{21-22-80}';
  var FTP_REPORT = 'Connected to 10.10.8.20.\n220 (vsFTPd 3.0.5)\nName (10.10.8.20:trainee): anonymous\n331 Please specify the password.\nPassword: (empty — accepted)\n230 Login successful.\nRemote system type is UNIX.\nUsing binary mode to transfer files.\nftp> ls\n-rw-r--r--    1 ftp      ftp           312 Oct 25 09:00 README-lab.txt\n-rw-r--r--    1 ftp      ftp           188 Oct 25 09:00 backup-notes.txt\nftp> bye\n221 Goodbye.\nSimulated session. The username anonymous was accepted with no personal account.\nLesson flag: MN{anonymous-ftp}';
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
    return { sawAddress: false, sawPing: false, sawScan: false, sawFtp: false, sawHttp: false, sawSsh: false, sawFix: false };
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
      { id: 'name', label: 'Submit the lesson flag for the file service', detail: 'MN{…} from the FTP session', done: !!snapshot.flagsIn.inspect }
    ];
  }
  function sectionById(id) {
    for (var i = 0; i < SECTIONS.length; i += 1) if (SECTIONS[i].id === id) return SECTIONS[i];
    return SECTIONS[0];
  }
  function questionsDone(snapshot, section) {
    return section.questions.every(function (question) { return snapshot.checks[question.id] === true; });
  }
  function taskDone(snapshot, section) {
    if (section.task === 'address') return snapshot.flags.sawAddress;
    if (section.task === 'reach') return snapshot.flags.sawPing;
    if (section.task === 'ports') return snapshot.flags.sawScan;
    if (section.task === 'inspect') return snapshot.flags.sawFtp;
    return snapshot.flags.sawFix || !!snapshot.flagsIn.defend;
  }
  function sectionComplete(snapshot, section) {
    return questionsDone(snapshot, section) && taskDone(snapshot, section) && snapshot.flagsIn[section.id] === true;
  }
  function sectionUnlocked(snapshot, section) {
    var index = SECTIONS.indexOf(section);
    if (index <= 0) return true;
    return sectionComplete(snapshot, SECTIONS[index - 1]);
  }
  function currentSection(snapshot) {
    for (var i = 0; i < SECTIONS.length; i += 1) {
      if (!sectionComplete(snapshot, SECTIONS[i])) return SECTIONS[i];
    }
    return null;
  }
  function xpOf(snapshot) {
    var xp = 0;
    SECTIONS.forEach(function (section) {
      section.questions.forEach(function (question) {
        if (snapshot.checks[question.id]) xp += XP_PER_CHECK;
      });
      if (questionsDone(snapshot, section) && taskDone(snapshot, section)) xp += XP_PER_TASK;
      if (snapshot.flagsIn[section.id]) xp += XP_PER_FLAG;
    });
    return xp;
  }
  function xpMax() {
    var total = 0;
    SECTIONS.forEach(function (section) {
      total += section.questions.length * XP_PER_CHECK + XP_PER_TASK + XP_PER_FLAG;
    });
    return total;
  }
  function sameAnswer(raw, expected) {
    var tidy = function (value) {
      return String(value).trim().toLowerCase().replace(/\s+/g, '').replace(/^mn\{/, '').replace(/\}$/, '');
    };
    return tidy(raw) === tidy(expected);
  }
  function answerOk(question, raw) {
    return question.accept.some(function (expected) { return sameAnswer(raw, expected); });
  }
  function commandSectionId(cmd, args) {
    if (cmd === 'ip') return 'address';
    if (cmd === 'ping') return 'reach';
    if (cmd === 'nmap') return 'ports';
    if (cmd === 'ftp') return 'inspect';
    if (cmd === 'ssh') return 'ports';
    if (cmd === 'curl') {
      var raw = (args[0] || '').toLowerCase();
      return raw.indexOf('ftp://') === 0 ? 'inspect' : 'ports';
    }
    return '';
  }
  function gateMessage(snapshot, sectionId) {
    if (!sectionId) return '';
    var section = sectionById(sectionId);
    if (sectionUnlocked(snapshot, section) && questionsDone(snapshot, section)) return '';
    var needed = currentSection(snapshot) || section;
    if (!questionsDone(snapshot, needed)) return 'Locked. Answer the checks in “' + needed.title + '” before this command. Nothing was sent.';
    return 'Locked. Finish “' + needed.title + '”, including its lesson flag, before this command. Nothing was sent.';
  }
  function coachLine(snapshot) {
    var section = currentSection(snapshot);
    if (!section) return 'Every section is complete. Review the network model: port 21 should show a lock.';
    if (!sectionUnlocked(snapshot, section)) return 'Finish the previous section, including its lesson flag, to open “' + section.title + '”.';
    if (!questionsDone(snapshot, section)) return 'Read “' + section.title + '”, then answer the checks. The terminal task stays locked until both are right.';
    if (!taskDone(snapshot, section)) {
      if (section.task === 'defend') return 'The checks are correct. Open Defend, read the fix, and mark it as read. The lesson flag is at the end of that fix.';
      return 'The checks are correct. Run ' + section.unlocks + ' in the terminal. The output is simulated, and the lesson flag is on the last line.';
    }
    return 'Submit the lesson flag from this step. It is printed in the simulated output and looks like MN{…}.';
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
      objectives: defaultObjectives(),
      checks: {},
      flagsIn: {},
      sectionHints: {},
      walkthrough: false
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
    if (mode === 'practice') {
      var ready = questionsDone(next, sectionById('address'));
      next = openApp(openApp(next, 'lab', false), 'terminal', ready);
      if (!ready) return openApp(next, 'notes', true);
      return next;
    }
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
    else paragraphs.push('Start in Learn. Each terminal task stays locked until that section’s checks are correct.');
    if (snapshot.flags.sawSsh && snapshot.objectives.name) paragraphs.push('SSH on port 22 refused a password and asked for a key. That door is not the problem in this lab.');
    if (snapshot.objectives.fix) paragraphs.push('The defensive fix is reviewed: turn off anonymous FTP or stop the service, move file sharing to SFTP on the SSH port, and do not leave lab notes on a share the whole training LAN can open.');
    else if (fixAvailable(snapshot)) paragraphs.push('Open Defend and review the recommended fix. That is the last security objective.');
    if (!snapshot.objectives.read) paragraphs.push('The address section still needs its lesson flag before the later tasks open.');
    if (!snapshot.objectives.scan && snapshot.objectives.name) paragraphs.push('The finding is recorded, and the scan objective is still open. Run nmap -sV 10.10.8.20 so the service list is part of your notes.');
    var title = done === 4 ? 'Practice complete' : done === 0 ? 'Assessment' : 'Assessment in progress';
    var sectionsDone = SECTIONS.filter(function (section) { return sectionComplete(snapshot, section); }).length;
    return { title: title, summary: xpOf(snapshot) + ' / ' + xpMax() + ' XP. ' + sectionsDone + ' of ' + SECTIONS.length + ' sections complete.', paragraphs: paragraphs };
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
  function revealHint(snapshot) {
    var section = currentSection(snapshot);
    if (!section) return { snapshot: snapshot, text: 'Every section is complete. There are no further hints.' };
    if (!sectionUnlocked(snapshot, section)) return { snapshot: snapshot, text: 'Finish the previous section before a hint for this one.' };
    var shown = snapshot.sectionHints[section.id] || 0;
    if (shown >= section.hints.length) return { snapshot: snapshot, text: 'No further hints for “' + section.title + '”.' };
    var sectionHints = Object.assign({}, snapshot.sectionHints);
    sectionHints[section.id] = shown + 1;
    return { snapshot: Object.assign({}, snapshot, { sectionHints: sectionHints }), text: section.hints[shown] };
  }
  function printHint(snapshot) {
    var revealed = revealHint(snapshot);
    return say(revealed.snapshot, 'out', revealed.text);
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
    lines.push('', '--- 10.10.8.20 ping statistics ---', count + ' packets transmitted, ' + count + ' received, 0% packet loss, time ' + (count * 12) + 'ms', 'Simulated replies. No packets left this browser.', 'Lesson flag: MN{host-up}');
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
    var gated = commandSectionId(cmd, args);
    if (gated) {
      var locked = gateMessage(next, gated);
      if (locked) return say(next, 'err', locked);
    }
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
    if (!value || typeof value !== 'object' || value.v !== 2 || !value.state || typeof value.state !== 'object') return null;
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
    var knownQuestions = {};
    var knownSections = {};
    SECTIONS.forEach(function (section) {
      knownSections[section.id] = true;
      section.questions.forEach(function (question) { knownQuestions[question.id] = true; });
    });
    var checks = {};
    if (source.checks && typeof source.checks === 'object') {
      Object.keys(knownQuestions).forEach(function (id) { checks[id] = source.checks[id] === true; });
    }
    var flagsIn = {};
    var sectionHints = {};
    if (source.flagsIn && typeof source.flagsIn === 'object') {
      Object.keys(knownSections).forEach(function (id) { flagsIn[id] = source.flagsIn[id] === true; });
    }
    if (source.sectionHints && typeof source.sectionHints === 'object') {
      Object.keys(knownSections).forEach(function (id) {
        var count = source.sectionHints[id];
        sectionHints[id] = Number.isInteger(count) ? Math.max(0, Math.min(2, count)) : 0;
      });
    }
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
      objectives: objectives,
      checks: checks,
      flagsIn: flagsIn,
      sectionHints: sectionHints,
      walkthrough: source.walkthrough === true
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
    try { sessionStorage.setItem(KEY, JSON.stringify({ v: 2, state: snapshot })); } catch (error) { /* private mode still runs until reload */ }
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
  var checkFeedback = null;
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
    var sectionsGained = SECTIONS.filter(function (section) { return !sectionComplete(state, section) && sectionComplete(next, section); });
    state = next;
    save(state);
    render();
    if (sectionsGained.length) {
      var title = sectionsGained[0].title;
      celebrate(title + ' complete');
      setLive(title + ' complete. ' + xpOf(state) + ' of ' + xpMax() + ' XP.');
      return;
    }
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
  function renderFlagForm() {
    var finding = document.getElementById('ws-finding');
    var section = currentSection(state);
    if (!section) {
      finding.innerHTML = '<p class="ws-note ws-note--ok">Every lesson flag is in. ' + xpOf(state) + ' / ' + xpMax() + ' XP.</p>';
      return;
    }
    if (!sectionUnlocked(state, section) || !questionsDone(state, section)) {
      finding.innerHTML = '<p>Answer the checks for “' + esc(section.title) + '” before this flag box unlocks.</p>';
      return;
    }
    if (!taskDone(state, section)) {
      finding.innerHTML = '<p>Run <code>' + esc(section.unlocks) + '</code> first. The flag is printed at the end of that simulated output.</p>';
      return;
    }
    var sig = section.id + '|' + (state.findingNote || '');
    if (finding.getAttribute('data-sig') === sig && finding.querySelector('#ws-flag')) return;
    finding.setAttribute('data-sig', sig);
    var noteClass = state.findingTone === 'warn' ? 'ws-note ws-note--warn' : 'ws-hint';
    var note = state.findingNote ? '<p class="' + noteClass + '">' + esc(state.findingNote) + '</p>' : '<p class="ws-hint">Paste the lesson flag from the simulated output. It looks like MN{…}.</p>';
    finding.innerHTML = '<form id="ws-flag-form"><label for="ws-flag">Flag for “' + esc(section.title) + '”</label><input id="ws-flag" class="ws-field" name="flag" autocomplete="off" autocapitalize="off" spellcheck="false">' + note + '<button class="btn btn--sm" type="submit">Submit flag</button></form>';
  }
  function gradeQuestion(snapshot, question, raw) {
    if (!raw || !String(raw).trim()) {
      checkFeedback = { id: question.id, text: 'Choose or type an answer first.' };
      return { snapshot: snapshot, message: 'An answer is required.' };
    }
    if (!answerOk(question, raw)) {
      checkFeedback = { id: question.id, text: 'Not quite. Re-read the paragraph above this question, or ask for a hint.' };
      return { snapshot: snapshot, message: 'Check again. That answer does not match the lesson.' };
    }
    checkFeedback = null;
    var checks = Object.assign({}, snapshot.checks);
    checks[question.id] = true;
    return { snapshot: Object.assign({}, snapshot, { checks: checks }), message: 'Correct. ' + XP_PER_CHECK + ' XP.' };
  }
  function submitFlag(snapshot, raw) {
    var section = currentSection(snapshot);
    if (!section) return { snapshot: snapshot, message: 'Every lesson flag is already in.' };
    if (!questionsDone(snapshot, section)) return { snapshot: snapshot, message: 'Answer the lesson checks before you submit a flag.' };
    if (!taskDone(snapshot, section)) return { snapshot: snapshot, message: 'Run the unlocked step first. The flag is in that simulated output.' };
    var ok = section.flagAccept.some(function (expected) { return sameAnswer(raw, expected); });
    if (!ok) {
      return {
        snapshot: Object.assign({}, snapshot, { findingTone: 'warn', findingNote: 'That is not the flag for “' + section.title + '”. Read the last line of the simulated output for this step.' }),
        message: 'Flag not accepted.'
      };
    }
    var flagsIn = Object.assign({}, snapshot.flagsIn);
    flagsIn[section.id] = true;
    var next = Object.assign({}, snapshot, { flagsIn: flagsIn, findingTone: 'ok', findingNote: 'Flag accepted for ' + section.title + '.' });
    if (section.id === 'inspect') next = recordFinding(next, 'anonymous ftp');
    if (section.id === 'address') next = Object.assign({}, next, { objectives: Object.assign({}, next.objectives, { read: true }) });
    if (section.id === 'defend') {
      next = Object.assign({}, next, {
        flags: Object.assign({}, next.flags, { sawFix: true }),
        objectives: Object.assign({}, next.objectives, { fix: true })
      });
    }
    return { snapshot: next, message: 'Flag accepted for ' + section.title + '.' };
  }
  function questionById(id) {
    for (var s = 0; s < SECTIONS.length; s += 1) {
      for (var q = 0; q < SECTIONS[s].questions.length; q += 1) {
        if (SECTIONS[s].questions[q].id === id) return { section: SECTIONS[s], question: SECTIONS[s].questions[q] };
      }
    }
    return null;
  }
  function renderQuestion(question) {
    if (state.checks[question.id]) return '<p class="ws-q ws-q--done">Correct. ' + esc(question.prompt) + '</p>';
    var note = checkFeedback && checkFeedback.id === question.id ? '<p class="ws-q__note">' + esc(checkFeedback.text) + '</p>' : '';
    if (question.kind === 'choice') {
      var choices = question.choices.map(function (choice) {
        return '<label class="ws-choice"><input type="radio" name="' + esc(question.id) + '" value="' + esc(choice.id) + '"><span>' + esc(choice.label) + '</span></label>';
      }).join('');
      return '<form class="ws-q" data-qid="' + esc(question.id) + '"><fieldset><legend>' + esc(question.prompt) + '</legend>' + choices + '</fieldset><button class="btn btn--sm" type="submit">Check answer</button>' + note + '</form>';
    }
    return '<form class="ws-q" data-qid="' + esc(question.id) + '"><label for="ws-a-' + esc(question.id) + '">' + esc(question.prompt) + '</label><input id="ws-a-' + esc(question.id) + '" class="ws-field" name="answer" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn btn--sm" type="submit">Check answer</button>' + note + '</form>';
  }
  function renderPath() {
    var root = document.getElementById('ws-path');
    if (!root) return;
    var sig = pathSignature();
    if (root.getAttribute('data-sig') === sig) return;
    root.setAttribute('data-sig', sig);
    var guidePressed = state.walkthrough ? 'true' : 'false';
    var guideLabel = state.walkthrough ? 'Guide on' : 'Guide me';
    var walk = '<ol><li>Read Addresses. Answer the two checks. Run ip addr. Submit the lesson flag from the output.</li><li>Read the ping section. Answer the checks. Run ping 10.10.8.20. Submit its flag.</li><li>Read ports and services. Answer the checks. Run nmap -sV 10.10.8.20. Submit its flag.</li><li>Read the open-cupboard section. Answer the checks. Run ftp 10.10.8.20. Submit the flag from that session.</li><li>Read the blue-team fix. Answer the checks. Open Defend, read the fix, and submit its flag.</li></ol>';
    var coach = state.walkthrough ? '<p class="ws-coach">' + esc(coachLine(state)) + '</p>' : '';
    var cards = SECTIONS.map(function (section, index) {
      var done = sectionComplete(state, section);
      var open = sectionUnlocked(state, section);
      var current = currentSection(state) && currentSection(state).id === section.id;
      var klass = 'ws-section' + (done ? ' ws-section--done' : '') + (current ? ' ws-section--current' : '') + (!open ? ' ws-section--locked' : '');
      var kicker = done ? 'Done · 100 XP' : (!open ? 'Locked' : (current ? 'Current section' : 'Open'));
      if (!open) return '<article class="' + klass + '"><p class="ws-section__kicker">' + kicker + '</p><h3>' + (index + 1) + '. ' + esc(section.title) + '</h3><p>Finish the previous section, including its lesson flag, to open this one.</p></article>';
      if (done && !current) return '<article class="' + klass + '"><p class="ws-section__kicker">' + kicker + '</p><h3>' + (index + 1) + '. ' + esc(section.title) + '</h3></article>';
      var body = section.paragraphs.map(function (paragraph) { return '<p>' + esc(paragraph) + '</p>'; }).join('');
      var questions = section.questions.map(renderQuestion).join('');
      var lock = '';
      if (!questionsDone(state, section)) lock = '<p class="ws-locknote">Terminal task locked until both checks are correct.</p>';
      else if (!taskDone(state, section)) lock = '<p class="ws-locknote">Unlocked: <code>' + esc(section.unlocks) + '</code>. The lesson flag is in that simulated output.</p>';
      else if (!state.flagsIn[section.id]) lock = '<p class="ws-locknote">Task done. Submit the lesson flag in the lab brief.</p>';
      return '<article class="' + klass + '"><p class="ws-section__kicker">' + kicker + '</p><h3>' + (index + 1) + '. ' + esc(section.title) + '</h3>' + body + questions + lock + '</article>';
    }).join('');
    root.innerHTML = '<div class="ws-path__bar"><h3 id="ws-path-title">Learn, then practise</h3><button class="btn btn--ghost-light btn--xs" type="button" data-action="walkthrough" aria-pressed="' + guidePressed + '">' + guideLabel + '</button></div><p class="ws-path__intro">Each section is a short lesson and two checks, in the style of a guided academy room. The terminal task stays locked until those checks are right. Then you submit the lesson flag.</p><details class="ws-guide"><summary>Short guided walkthrough</summary>' + walk + '</details>' + coach + cards;
  }
  function pathSignature() {
    var bits = [state.walkthrough ? '1' : '0', String(xpOf(state))];
    SECTIONS.forEach(function (section) {
      bits.push(section.id, questionsDone(state, section) ? 'q' : '-', taskDone(state, section) ? 't' : '-', state.flagsIn[section.id] ? 'f' : '-');
      section.questions.forEach(function (question) { bits.push(state.checks[question.id] ? '1' : '0'); });
    });
    if (checkFeedback) bits.push(checkFeedback.id + checkFeedback.text);
    return bits.join('|');
  }
  function render() {
    var xp = xpOf(state);
    document.getElementById('ws-score-text').textContent = xp + ' / ' + xpMax() + ' XP';
    document.querySelector('#ws-meter i').style.transform = 'scaleX(' + (xp / xpMax()) + ')';
    renderPath();
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
    document.getElementById('ws-notes-actions').innerHTML = '<button class="btn btn--ghost-light btn--sm" type="button" data-action="show-map">Show the network model</button>';
    document.querySelectorAll('[data-command]').forEach(function (chip) {
      var command = chip.getAttribute('data-command') || '';
      var parts = command.split(/\s+/);
      var cmd = normalizeCommand(parts[0] || '');
      var locked = gateMessage(state, commandSectionId(cmd, parts.slice(1)));
      chip.disabled = !!locked;
      chip.title = locked ? 'Finish the lesson checks to unlock this command.' : '';
    });
    document.querySelectorAll('[data-action="walkthrough"]').forEach(function (button) {
      button.setAttribute('aria-pressed', state.walkthrough ? 'true' : 'false');
      if (button.id === 'ws-guide-btn') button.textContent = state.walkthrough ? 'Guide on' : 'Guide me';
    });
    document.getElementById('ws-term').innerHTML = state.lines.map(function (line) {
      var prompt = line.kind === 'in' ? '<span class="ws-prompt">' + PROMPT + ' </span>' : '';
      return '<div class="ws-line ws-line--' + line.kind + '">' + prompt + esc(line.text) + '</div>';
    }).join('');
    var sectionRows = SECTIONS.map(function (section) {
      var status = sectionComplete(state, section) ? 'Done' : (!sectionUnlocked(state, section) ? 'Locked' : (!questionsDone(state, section) ? 'Learn' : (!taskDone(state, section) ? 'Task' : 'Flag')));
      return '<li data-done="' + (sectionComplete(state, section) ? 'true' : 'false') + '"><span class="ws-task__state">' + status + '</span><span>' + esc(section.title) + '</span><code>100 XP</code></li>';
    }).join('');
    var taskRows = labTasks(state).map(function (task) {
      return '<li data-done="' + (task.done ? 'true' : 'false') + '"><span class="ws-task__state">' + (task.done ? 'Done' : 'To do') + '</span><span>' + esc(task.label) + '</span><code>' + esc(task.detail) + '</code></li>';
    }).join('');
    document.getElementById('ws-tasks').innerHTML = sectionRows + taskRows;
    renderFlagForm();
    var hintSection = currentSection(state);
    var shownHints = hintSection ? (state.sectionHints[hintSection.id] || 0) : 0;
    var hintList = hintSection ? hintSection.hints.slice(0, shownHints) : [];
    document.getElementById('ws-hints').innerHTML = hintList.length
      ? '<ol class="ws-hints">' + hintList.map(function (hint) { return '<li>' + esc(hint) + '</li>'; }).join('') + '</ol>'
      : '<p>Hints stay hidden until you ask. Each section has two, and they nudge you without printing the flag.</p>';
    document.getElementById('ws-hint-btn').disabled = !hintSection || shownHints >= (hintSection ? hintSection.hints.length : 0);
    var defend = document.getElementById('ws-defend');
    var defendSection = sectionById('defend');
    if (!sectionUnlocked(state, defendSection) || !questionsDone(state, defendSection)) {
      defend.innerHTML = '<h3>Learn the fix before you apply it</h3><p>The blue-team step stays locked until you finish “Close the gap” in the lesson. Answer those two checks first. The recommended change is explained there, and the lesson flag is printed at the end of this panel once the checks are right.</p>';
    } else if (!fixAvailable(state) && !state.flags.sawFtp && !state.objectives.name) {
      defend.innerHTML = '<h3>Inspect the file service first</h3><p>The checks are done. Run the unlocked FTP command, submit that flag, then come back. The fix names the service only after you have seen the simulated session.</p>';
    } else if (!state.objectives.fix) {
      defend.innerHTML = '<h3>Close the anonymous FTP share</h3><p>Port 21 on lab-server (10.10.8.20) is FTP, and the simulated session accepted the username anonymous. It then listed README-lab.txt and backup-notes.txt. Anyone on the training LAN could read those files. SSH on port 22 did not do that: it asked for a key. The website on port 80 is the lab portal and is meant to be readable.</p><ol class="ws-steps"><li>Turn anonymous login off. If nobody needs FTP, stop the service and close port 21.</li><li>Move file sharing to SFTP, which uses SSH on port 22. That door already asks for a key in this lab.</li><li>If a share has to remain, allow it only from the trainer machine, not from every address in 10.10.8.0/24.</li><li>Take lab notes off any share that opens without a personal login.</li></ol><p>You do not change a real server. The network model turns that port green once the lesson flag is accepted.</p><p><strong>Lesson flag: MN{close-anonymous-ftp}</strong></p><div class="ws-actions">' + (state.flags.sawFix ? '<p class="ws-note ws-note--ok">Fix read. Submit the lesson flag in the lab brief.</p>' : '<button class="btn btn--sm" type="button" data-action="review">I have read the recommended fix</button>') + '</div>';
    } else {
      defend.innerHTML = '<h3>Close the anonymous FTP share</h3><p class="ws-note ws-note--ok">Flag accepted. Port 21 is marked secured in the model. Anonymous login would be turned off, and file sharing would move to SFTP on port 22.</p>';
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
      if (command.disabled) return;
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
    if (name === 'show-map') focusApp('map');
    else if (name === 'show-lab') focusApp('lab');
    else if (name === 'show-terminal') { focusTerminal = true; focusApp('terminal'); }
    else if (name === 'hint') {
      var revealed = revealHint(state);
      commit(revealed.snapshot, revealed.text);
    } else if (name === 'walkthrough') {
      commit(Object.assign({}, state, { walkthrough: !state.walkthrough }), state.walkthrough ? 'Guide hidden.' : 'Guide on. The lesson names the next step.');
    } else if (name === 'review') {
      if (questionsDone(state, sectionById('defend')) && !state.flags.sawFix) {
        commit(Object.assign({}, state, { flags: Object.assign({}, state.flags, { sawFix: true }) }), 'Fix read. Submit the lesson flag from the end of the fix.');
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
      var next = applyCommand(state, value);
      var last = next.lines[next.lines.length - 1];
      var message = name === 'clear'
        ? 'Terminal cleared. The simulated banner stays.'
        : (last && last.kind === 'err' ? last.text.split('\n')[0] : 'Simulated output added for ' + name + '.');
      commit(next, message);
      input.value = '';
      histIndex = -1;
      return;
    }
    if (event.target.id === 'ws-flag-form') {
      event.preventDefault();
      var flagField = document.getElementById('ws-flag');
      var result = submitFlag(state, flagField ? flagField.value : '');
      commit(result.snapshot, result.message);
      return;
    }
    if (event.target.classList && event.target.classList.contains('ws-q')) {
      event.preventDefault();
      var found = questionById(event.target.getAttribute('data-qid'));
      if (!found) return;
      if (!sectionUnlocked(state, found.section)) {
        setLive('Finish the previous section before these checks.');
        return;
      }
      var raw = '';
      if (found.question.kind === 'choice') {
        var picked = event.target.querySelector('input:checked');
        raw = picked ? picked.value : '';
      } else {
        var answerField = event.target.querySelector('input');
        raw = answerField ? answerField.value : '';
      }
      var graded = gradeQuestion(state, found.question, raw);
      commit(graded.snapshot, graded.message);
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
