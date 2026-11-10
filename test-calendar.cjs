const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
let blob, clicked = false, removed = false, revoked = false;
const ctx = vm.createContext({
    TextEncoder, Blob, state:{tournaments:[]},
    URL:{createObjectURL(value) { blob = value; return 'blob:test'; }, revokeObjectURL() { revoked = true; }},
    setTimeout(callback) { callback(); },
    document:{body:{appendChild() {}},createElement() {return {click() {clicked=true;},remove() {removed=true;}};}},
    alert(message) {throw Error(message);}
});
vm.runInContext(html.slice(html.indexOf('        function tournamentSchedule('), html.indexOf('        function formatScheduleTime(')),ctx);
const event = {id:'test',name:'Mölkky, test; été\nSuite',date:'2026-03-28',location:'Salle, rue; A\nNancy',format:'Doublette',checkInTime:'08:00',firstThrowTime:'09:00'};
let ics = ctx.buildTournamentCalendar(event);
const unfold = value => value.replace(/\r\n /g, '');
assert(ics.endsWith('END:VCALENDAR\r\n'));
assert(ics.includes('DTSTART;TZID=Europe/Paris:20260328T080000'));
assert(!ics.includes('DTEND'));
assert(unfold(ics).includes('SUMMARY:Mölkky\\, test\\; été\\nSuite'));
assert(unfold(ics).includes('Premier lancer : 09:00'));
assert(ics.includes('TZID:Europe/Paris'));
const weekend = {...event,days:{day1:{date:'2026-03-28',format:'Quadrette'},day2:{date:'2026-03-29',format:'Doublette',checkInTime:'10:30'}}};
ics=ctx.buildTournamentCalendar(weekend);
assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,2);
assert(ics.includes('20260329T103000'));
assert(unfold(ics).includes('Quadruplette'));
assert(ics.includes('UID:test-day1@'));
ics=ctx.buildTournamentCalendar({...event,checkInTime:'',firstThrowTime:''});
assert(ics.includes('DTSTART;VALUE=DATE:20260328'));
assert(ics.includes('DTEND;VALUE=DATE:20260329'));
assert(ctx.buildTournamentCalendar({...event,checkInTime:'',firstThrowTime:'09:15'}).includes('20260328T091500'));
assert(ctx.buildTournamentCalendar({...event,name:'Open du Mambo',checkInTime:undefined,firstThrowTime:undefined}).includes('20260328T080000'));
assert.throws(()=>ctx.buildTournamentCalendar({...event,date:'2026-02-30'}));
ics=ctx.buildTournamentCalendar({...event,name:'é'.repeat(150)});
assert(ics.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
assert(unfold(ics).includes('SUMMARY:'+'é'.repeat(150)));
ctx.state.tournaments=[weekend];
ctx.downloadTournamentCalendar('test');
assert(blob instanceof Blob);
assert(clicked && removed && revoked);
assert.equal(blob.type,'text/calendar;charset=utf-8');
console.log('Calendar: dates, DST timezone, two days, times, defaults, escaping, folding and download passed.');
