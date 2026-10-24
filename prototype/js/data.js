/* Sample data for the design prototype. Nothing here persists.
   VERIFIED items cite maximnyansa.com / official LinkedIn / GNBCC (see README).
   Everything else is a clearly-labelled placeholder. */
window.MN = window.MN || {};
MN.TODAY = new Date('2026-10-24T10:00:00Z');

MN.MODULES = [
  { id:'network', name:'Network security', short:'Network', icon:'network' },
  { id:'ethical', name:'Ethical hacking', short:'Ethical hacking', icon:'terminal' },
  { id:'vuln', name:'Vulnerability assessment', short:'Vulnerability', icon:'scan' },
  { id:'forensics', name:'Digital forensics', short:'Forensics', icon:'search' },
  { id:'awareness', name:'Security awareness', short:'Awareness', icon:'users' },
  { id:'incident', name:'Incident response', short:'Incident response', icon:'alert' }
];
MN.mod = id => MN.MODULES.find(m => m.id === id);

MN.PHOTOS = [
  { f:'hack-group-google-wall', w:1600, h:1066, cat:'hackathon', cap:'Group photo in front of the Google wall' },
  { f:'anniversary-signature-wall', w:1600, h:1067, cat:'anniversary', cap:'At the 10th anniversary signature wall' },
  { f:'vr-headset-moment', w:1600, h:1066, cat:'hackathon', cap:'Trying a VR headset' },
  { f:'guests-smiling', w:1280, h:1600, cat:'anniversary', cap:'Guests in the audience' },
  { f:'hack-coding-team', w:1600, h:1066, cat:'hackathon', cap:'A team working at a laptop' },
  { f:'participant-portrait', w:1066, h:1600, cat:'community', cap:'A participant wearing a lanyard' },
  { f:'electronics-lab', w:1600, h:1066, cat:'hackathon', cap:'Hands-on electronics at the build table' },
  { f:'trio-google-neon', w:1600, h:1066, cat:'hackathon', cap:'Three attendees by the neon sign' },
  { f:'banners-computer4schools', w:1600, h:1066, cat:'anniversary', cap:'Programme banners on display' },
  { f:'guest-print-shirt', w:1280, h:1600, cat:'community', cap:'A guest in a printed shirt' },
  { f:'vr-group-lounge', w:1600, h:1280, cat:'hackathon', cap:'A VR demo in the lounge' },
  { f:'presenters-yellow-room', w:1600, h:1066, cat:'community', cap:'Presenters in the yellow room' },
  { f:'selfie-orange-wall', w:1066, h:1600, cat:'community', cap:'A selfie by the orange wall' },
  { f:'guests-seated', w:1600, h:1066, cat:'anniversary', cap:'Guests seated together' },
  { f:'duo-google-wall', w:1600, h:1066, cat:'hackathon', cap:'Two attendees by the carved wall' },
  { f:'participant-phone', w:1066, h:1600, cat:'community', cap:'A participant checking her phone' },
  { f:'arc-wall-trio', w:1600, h:1066, cat:'community', cap:'Conversation by the arched mural' },
  { f:'vr-demo-group', w:1600, h:1066, cat:'hackathon', cap:'A VR demo with onlookers' },
  { f:'arc-wall-duo', w:1280, h:1600, cat:'community', cap:'Two attendees by the arched mural' },
  { f:'trio-google-wall', w:1600, h:1066, cat:'hackathon', cap:'Three attendees by the Google wall' },
  { f:'anniversary-group-outdoor', w:1600, h:1067, cat:'anniversary', cap:'Outdoor group photo' }
];
MN.PHOTO_CATS = { anniversary:'10th anniversary', hackathon:'AI for Impact hackathon (TBC)', community:'Community' };
MN.img = (f, size) => `${MN.root||''}assets/img/${f}-${size||1600}.webp`;

const hues=[140,95,170,60,120,190,80,150,30,110,200,160];
MN.TRAINEES = Array.from({length:12},(_,i)=>{
  const n=String(i+1).padStart(2,'0');
  const m=MN.MODULES[i%6];
  return { id:i+1, name:`Sample Trainee ${n}`, initials:`T${i+1}`, focus:m.id, hue:hues[i],
    track: i%3===0?'Blue team':i%3===1?'Red team':'GRC & awareness',
    status: 'In training',
    skills: [['Linux','Wireshark','Firewalls'],['Kali Linux','Python','OWASP Top 10'],['Nmap','OpenVAS','Risk reports'],['Autopsy','Chain of custody','Log analysis'],['Phishing drills','Policy writing','Training design'],['SIEM basics','Playbooks','Triage']][i%6] };
});

const wk = n => { const d=new Date('2026-10-05T00:00:00Z'); d.setUTCDate(d.getUTCDate()+(n-1)*7); return d; };
MN.fmt = (d,o) => d.toLocaleDateString('en-GB',Object.assign({day:'numeric',month:'short',timeZone:'UTC'},o||{}));
const lessonTitles = {
  network:['How networks really move data','Firewalls, segmentation and VPNs'],
  ethical:['The ethical hacker\u2019s mindset and the law','Reconnaissance in a safe lab'],
  vuln:['Scanning and prioritising vulnerabilities','Writing a vulnerability report'],
  forensics:['Evidence handling basics','Reading the story in a disk image'],
  awareness:['Spotting social engineering','Designing an awareness session'],
  incident:['The incident response lifecycle','Tabletop exercise: a simulated breach']
};
const order=['network','network','ethical','ethical','vuln','vuln','forensics','awareness','forensics','incident','incident','awareness'];
const formats=['Lecture + lab','Hands-on lab','Workshop','Lecture + lab','Hands-on lab','Workshop'];
const seen={};
MN.CLASSES = order.map((m,i)=>{
  seen[m]=(seen[m]||0); const t=lessonTitles[m][seen[m]++ % 2];
  const d=wk(i+1); const end=new Date(d); end.setUTCDate(end.getUTCDate()+6);
  const status = MN.TODAY>end?'done':(MN.TODAY>=d?'now':'upcoming');
  return { id:i+1, week:i+1, module:m, title:t, date:d, status, format:formats[i%6], phase: i<4?1:i<8?2:3 };
});

MN.PROJECTS = [
  { id:1, title:'Home network hardening lab', module:'network', type:'Lab', cover:'terminal', img:'hack-coding-team' },
  { id:2, title:'Capture-the-flag practice set', module:'ethical', type:'CTF', cover:'flag', img:'electronics-lab' },
  { id:3, title:'Vulnerability scan of a test web app', module:'vuln', type:'Lab', cover:'scan', img:'vr-demo-group' },
  { id:4, title:'Forensic timeline from a disk image', module:'forensics', type:'Case study', cover:'grid', img:'participant-phone' },
  { id:5, title:'Phishing-awareness campaign for a school', module:'awareness', type:'Community project', cover:'wave', img:'presenters-yellow-room' },
  { id:6, title:'Incident response playbook', module:'incident', type:'Capstone', cover:'shield', img:'trio-google-neon' }
];

MN.EVENTS = [
  { id:'start', title:'Bootcamp training starts', date:'2026-10-05', when:'Mon 5 Oct 2026', place:'Maxim Nyansa Foundation premises, Tantra Hills, Accra', kind:'Milestone', verified:true,
    summary:'The free, in-person 2026 Cyber Security Bootcamp begins.', img:'electronics-lab' },
  { id:'hackathon', title:'AI for Impact hackathon', date:'2026-10-07', when:'October 2026 · date TBC', place:'Venue to be confirmed', kind:'Partner event', verified:false, tbc:true,
    summary:'A hackathon co-organised with STEMAIDE Africa. Whether bootcamp trainees took part is still to be confirmed.', img:'hack-group-google-wall' },
  { id:'reception', title:'10th anniversary reception with GNBCC', date:'2026-10-08', when:'Thu 8 Oct 2026 · 5–8 PM', place:'GNBCC, Cantonments, Accra', kind:'Anniversary', verified:true,
    summary:'An anniversary cocktail reception with the Ghana Netherlands Business & Culture Council.', img:'guests-seated' },
  { id:'durbar', title:'Grand Durbar', date:'2026-10-10', when:'Sat 10 Oct 2026 · 11:00 AM', place:'Maxim Nyansa Villa, Tantra Hills, Accra', kind:'Anniversary', verified:true,
    summary:'Reflections on ten years, a cybersecurity panel discussion, student performances, partner recognition and networking.', img:'anniversary-signature-wall' },
  { id:'midpoint', title:'Mid-bootcamp review', date:'2026-11-16', when:'Mid-November 2026 · sample date', place:'Tantra Hills, Accra', kind:'Milestone', verified:false, sample:true,
    summary:'Sample milestone — placeholder for a mid-point review.', img:'presenters-yellow-room' },
  { id:'graduation', title:'Graduation', date:'2026-12-18', when:'December 2026 · date TBC', place:'To be confirmed', kind:'Milestone', verified:false, tbc:true,
    summary:'Training ends in December 2026. Graduation details are still to be confirmed.', img:'anniversary-group-outdoor' }
];
MN.q = k => new URLSearchParams(location.search).get(k);
