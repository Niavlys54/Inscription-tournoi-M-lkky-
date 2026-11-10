const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(script[1]);
const elements = {};
const el = id => elements[id] ||= {value:'', checked:false, disabled:false, style:{}, reset() {}};
const writes = [];
const removals = [];
const alerts = [];
let checkedPlayers = [];
const timers = new Map();
let timerId = 0;
const ctx = vm.createContext({
    console,
    setTimeout:(callback, delay) => { timers.set(++timerId,{callback,delay}); return timerId; },
    clearTimeout:id => timers.delete(id),
    document: {getElementById:el, querySelectorAll:() => checkedPlayers.map(value => ({value}))},
    state:{isAdmin:true, members:[{id:'a',name:'Laura'},{id:'b',name:'Sylvain'},{id:'c',name:'Fabienne'}],tournaments:[],currentArchiveYear:'2026',openAvailabilityMenus:{}},
    db:{ref:path => ({set:data => {writes.push({path,data}); return Promise.resolve();},remove:() => {removals.push(path); return Promise.resolve();}})},
    alert:message => alerts.push(message),
    confirm:() => true
});
ctx.ADMIN_UID = 'th9gEGFrlQUJt299LlV6VdGgl643';
ctx.auth = {currentUser:{uid:ctx.ADMIN_UID}};
vm.runInContext(html.slice(html.indexOf('        function toggleAdminMode('), html.indexOf('        function switchTab(')),ctx);
vm.runInContext(html.slice(html.indexOf('        function setStatus('), html.lastIndexOf("        document.addEventListener('DOMContentLoaded'")), ctx);
const run = code => vm.runInContext(code, ctx);
const event = {preventDefault() {}};
const tournament = {
    id:'weekend',name:'Tournoi test',date:'2026-11-07',endDate:'2026-11-08',format:'Quadrette',
    statuses:{a:'registered',b:'registered',c:'registered'},
    days:{
        day1:{date:'2026-11-07',format:'Quadrette',teams:{one:{id:'one',name:'Samedi',playerIds:['a','b','c'],externalPlayers:['Invité — Metz']}}},
        day2:{date:'2026-11-08',format:'Doublette'}
    }
};
ctx.state.tournaments = [tournament];
let card = run("renderTournamentCard(state.tournaments[0], false)");
assert(card.includes('samedi 7 novembre — Quadruplette'));
assert(card.includes('dimanche 8 novembre — Doublette'));
assert(card.includes('Invité — Metz (Ext.)'));
assert.equal((card.match(/id="avail-container-weekend"/g) || []).length, 1);
assert(card.includes("openTeamModal('weekend', 'day2')"));
assert(card.includes("openResultsModal('weekend', 'day1')"));
assert.equal((card.match(/Ajouter au calendrier/g) || []).length, 1);
assert(!card.includes('google.com/maps/dir/'));
tournament.location = 'Salle & stade, Nancy';
card = run("renderTournamentCard(state.tournaments[0], false)");
assert(card.includes('destination=Salle%20%26%20stade%2C%20Nancy'));
assert(card.includes('rel="noopener noreferrer"'));
assert(card.includes('Salle &amp; stade, Nancy'));
delete tournament.location;
assert.equal(run('isTournamentArchived(state.tournaments[0])'), false);
ctx.openResultsModal('weekend','day1');
el('res-phase').value = 'Quart de finale';
el('res-details').value = 'Laura, Sylvain, Fabienne et invité';
ctx.saveResults(event);
assert.equal(writes.at(-1).path, 'tournaments/weekend/days/day1/results');
tournament.days.day1.results = writes.at(-1).data;
assert.equal(run('isTournamentArchived(state.tournaments[0])'), false);
ctx.openResultsModal('weekend','day2');
assert.equal(el('res-details').value, '');
el('res-phase').value = 'Finaliste';
ctx.saveResults(event);
assert.equal(writes.at(-1).path,'tournaments/weekend/days/day2/results');
tournament.days.day2.results = writes.at(-1).data;
assert.equal(run('isTournamentArchived(state.tournaments[0])'), true);
ctx.openTeamModal('weekend','day2');
checkedPlayers = ['a'];
el('team-name').value = 'Dimanche';
el('team-external').value = 'Partenaire — Autre club';
ctx.saveTeam(event);
assert.match(writes.at(-1).path,/days\/day2\/teams\//);
assert.equal(writes.at(-1).data.externalPlayers[0], 'Partenaire — Autre club');
assert.equal(tournament.days.day1.teams.one.playerIds.length, 3);
checkedPlayers = ['a','b','c'];
const before = writes.length;
ctx.saveTeam(event);
assert.equal(writes.length, before);
assert(alerts.at(-1).includes('2 joueur'));
ctx.openTournamentModal('weekend');
assert.equal(el('t-two-days').checked,true);
assert.equal(el('t-two-days').disabled,true);
assert.equal(el('t-format-day2').value,'Doublette');
ctx.saveTournament(event);
assert.equal(writes.at(-1).data.days.day2.results.phase,'Finaliste');
assert.equal(writes.at(-1).data.days.day1.teams.one.externalPlayers[0],'Invité — Metz');
ctx.openTournamentModal();
assert.equal(el('t-two-days').checked,false);
const legacy = {id:'old',name:'Ancien',date:'2026-05-01',format:'Doublette',teams:{old:{id:'old',name:'Ancienne équipe',playerIds:['a','b']}},results:{phase:'Vainqueur',details:'Historique'}};
ctx.state.tournaments = [legacy];
assert.equal(run('isTournamentArchived(state.tournaments[0])'), true);
assert(run('renderTournamentCard(state.tournaments[0], true)').includes('Historique'));
ctx.openResultsModal('old');
assert.equal(el('res-day-id').value,'');
ctx.openTournamentModal('old');
el('t-two-days').checked = true;
el('t-end-date').value = '2026-05-02';
ctx.saveTournament(event);
assert.equal(writes.at(-1).data.days.day1.results.phase,'Vainqueur');
assert.equal(writes.at(-1).data.days.day1.teams.old.name,'Ancienne équipe');
assert(!writes.at(-1).data.id);
assert(!html.includes('btn-year-2024'));
assert(!html.includes('btn-year-2025'));
assert(html.includes('btn-year-2026'));
console.log('OK : rendu des deux jours, partenaires extérieurs, chemins de sauvegarde distincts, archivage après deux résultats, validation des équipes, conservation et conversion des anciens tournois, onglet 2026.');
ctx.state.members.push({id:'guest',name:'Partenaire externe',role:'Club de Metz',isGuest:true});
ctx.document.querySelectorAll = () => [];
ctx.render();
assert.equal(el('member-count').textContent, 3);
assert(!el('members-grid').innerHTML.includes('Partenaire externe'));
assert(!html.includes('id="guests-grid"'));
assert(!el('player-stats-grid').innerHTML.includes('Partenaire externe'));
legacy.teams.old.playerIds = ['a','guest'];
legacy.statuses = {guest:'registered'};
const guestCard = ctx.renderTournamentCard(legacy, false);
assert(guestCard.includes('Partenaire externe — Club de Metz (Ext.)'));
const availability = guestCard.slice(guestCard.indexOf('id="avail-container-old"'));
assert(!availability.includes('Partenaire externe'));
legacy.statuses = {};
ctx.openTeamModal('old');
assert(el('team-players-checkboxes').innerHTML.includes('Club de Metz'));
assert.equal(ctx.state.members.length,4);
console.log('OK : invités absents de l’effectif, des statistiques et disponibilités ; aucune section hors club ; invités conservés et sélectionnables sans statut inscrit ; club visible dans les équipes.');
ctx.state.tournaments = [
    {id:'past',date:'2026-11-05',name:'Passé'},
    {id:'today',date:'2026-11-06',name:'Aujourd’hui'},
    {id:'tomorrow',date:'2026-11-07',name:'Demain'},
    {id:'later',date:'2026-11-08',name:'Trop loin'},
    {id:'ongoing',date:'2026-11-05',endDate:'2026-11-07',name:'En cours'},
    {id:'archived',date:'2026-11-07',name:'Archivé',results:{phase:'Vainqueur'}},
    {id:'invalid',date:'',name:'Sans date'}
];
const near = ctx.upcomingTournaments(new Date('2026-11-06T12:00:00Z'));
assert.deepEqual(Array.from(near, item => item.tournament.id),['ongoing','today','tomorrow']);
const midnightParis = ctx.upcomingTournaments(new Date('2026-11-06T23:30:00Z'));
assert(midnightParis.some(item => item.tournament.id === 'later' && item.daysUntil === 1));
ctx.showSuccessToast('Tournoi créé');
assert.equal(el('success-toast-message').textContent,'Tournoi créé');
assert.equal(el('success-toast').style.display,'flex');
assert(html.includes("showSuccessToast(existingTournament ?"));
assert(html.includes('item.daysUntil <= 1 && item.endDays >= 0'));
assert(!html.includes('7 prochains jours'));
console.log('OK : rappel veille/jour même, exclusion des dates passées/lointaines/archivées, tournoi en cours et minuit Paris, confirmation accessible après sauvegarde.');
assert(html.includes('id="notification-stack"'));
assert(!html.includes('bottom:24px'));
const toastTimer = Array.from(timers.values()).at(-1);
assert.equal(toastTimer.delay,10000);
toastTimer.callback();
assert.equal(el('success-toast').style.display,'none');
ctx.upcomingTournaments = () => [{tournament:{id:'notice',name:'Tournoi demain',date:'2026-11-07'},daysUntil:1}];
ctx.renderUpcomingAlerts();
assert.equal(el('upcoming-alert').style.display,'block');
const reminderTimer = Array.from(timers.values()).at(-1);
assert.equal(reminderTimer.delay,10000);
reminderTimer.callback();
assert.equal(el('upcoming-alert').style.display,'none');
const timerCount = timers.size;
ctx.renderUpcomingAlerts();
assert.equal(el('upcoming-alert').style.display,'none');
assert.equal(timers.size,timerCount);
console.log('OK : banderoles en haut, fermeture après 10 secondes, rappel non réaffiché aux mises à jour identiques.');
for (const [name,checkIn,firstThrow] of [
    ['Open du Mambo','08:00','09:00'],
    ['Black Mölkky','17:00','18:00'],
    ['Bazar au MCM','09:30','']
]) {
    const t = {id:'schedule',name,date:'2026-11-07',format:'Doublette'};
    const schedule = ctx.tournamentSchedule(t);
    assert.equal(schedule.checkInTime,checkIn);
    assert.equal(schedule.firstThrowTime,firstThrow);
    const card = ctx.renderTournamentCard(t,false);
    assert(card.includes('Émargement :'));
    assert(card.includes(ctx.formatScheduleTime(checkIn)));
    assert.equal(card.includes('Premier lancer :'),Boolean(firstThrow));
    ctx.state.tournaments = [t];
    ctx.openTournamentModal('schedule');
    assert.equal(el('t-check-in').value,checkIn);
    assert.equal(el('t-first-throw').value,firstThrow);
    ctx.saveTournament(event);
    assert.equal(writes.at(-1).data.checkInTime,checkIn);
    assert.equal(writes.at(-1).data.firstThrowTime,firstThrow);
}
assert.equal(ctx.formatScheduleTime('09:30'),'9 h 30');
assert.equal(ctx.formatScheduleTime('08:00'),'8 h');
assert.equal(ctx.tournamentSchedule({name:'Open du Mambo',checkInTime:'10:00'}).checkInTime,'10:00');
assert.equal(ctx.tournamentSchedule({name:'Black Mölkky',checkInTime:''}).checkInTime,'');
assert.equal(ctx.tournamentSchedule({name:'Autre tournoi'}).checkInTime,'');
console.log('OK : horaires des trois tournois, absence de premier lancer inventé au MCM, affichage et modification des horaires.');
const countTournament = {
    id:'count',name:'Test participants',date:'2026-11-07',format:'Doublette',
    days:{day1:{date:'2026-11-07',format:'Quadrette',results:{phase:'Finaliste',details:'Samedi',extra:'Conservé'}},day2:{date:'2026-11-08',format:'Doublette',results:{phase:'Quart de finale'}}}
};
ctx.state.tournaments = [countTournament];
ctx.openResultsModal('count','day1');
assert.equal(el('res-player-count').value,'');
el('res-player-count').value = '120';
ctx.saveResults(event);
assert.equal(writes.at(-1).path,'tournaments/count/days/day1/results');
assert.equal(writes.at(-1).data.playerCount,120);
assert.equal(writes.at(-1).data.extra,'Conservé');
countTournament.days.day1.results = writes.at(-1).data;
ctx.openResultsModal('count','day2');
assert.equal(el('res-player-count').value,'');
el('res-player-count').value = '96';
ctx.saveResults(event);
countTournament.days.day2.results = writes.at(-1).data;
let countCard = ctx.renderTournamentCard(countTournament,true);
assert(countCard.includes('Nombre total de joueurs :</strong> 120'));
assert(countCard.includes('Nombre total de joueurs :</strong> 96'));
ctx.openResultsModal('count','day1');
assert.equal(el('res-player-count').value,120);
for (const invalid of ['0','-1','2.5','abc']) {
    el('res-player-count').value = invalid;
    const writeCount = writes.length;
    ctx.saveResults(event);
    assert.equal(writes.length,writeCount);
}
el('res-player-count').value = '';
ctx.saveResults(event);
assert.equal(writes.at(-1).data.playerCount,null);
assert(!ctx.renderTournamentCard({id:'legacy',name:'Ancien',date:'2026-01-01',format:'Doublette',results:{phase:'Finaliste'}},true).includes('Nombre total de joueurs :'));
console.log('OK : nombre de joueurs facultatif, sauvegarde/réouverture, nombres indépendants par journée, validation, suppression du nombre et anciens résultats compatibles.');
ctx.openResultsModal('count','day1');
assert.equal(el('res-podium-first').value,'');
el('res-podium-first').value = '  Laura & Sylvain — Pagny  ';
el('res-podium-second').value = '<img src=x onerror=alert(1)>';
el('res-podium-third').value = 'Équipe de Metz';
ctx.saveResults(event);
assert.equal(writes.at(-1).path,'tournaments/count/days/day1/results');
assert.equal(writes.at(-1).data.podium.first,'Laura & Sylvain — Pagny');
assert.equal(writes.at(-1).data.extra,'Conservé');
countTournament.days.day1.results = writes.at(-1).data;
ctx.openResultsModal('count','day2');
assert.equal(el('res-podium-first').value,'');
el('res-podium-first').value = 'Gagnants du dimanche';
ctx.saveResults(event);
countTournament.days.day2.results = writes.at(-1).data;
const podiumCard = ctx.renderTournamentCard(countTournament,true);
assert(podiumCard.includes('Laura &amp; Sylvain — Pagny'));
assert(podiumCard.includes('Gagnants du dimanche'));
assert(podiumCard.includes('🥉 3e'));
assert(podiumCard.includes('&lt;img'));
assert(!podiumCard.includes('<img src=x'));
ctx.openResultsModal('count','day1');
assert.equal(el('res-podium-third').value,'Équipe de Metz');
for (const place of ['first','second','third']) el('res-podium-'+place).value = '';
ctx.saveResults(event);
countTournament.days.day1.results = writes.at(-1).data;
assert(!ctx.renderTournamentCard({...countTournament,days:null,results:countTournament.days.day1.results},true).includes('Classement final du tournoi'));
ctx.state.tournaments = [legacy];
ctx.openResultsModal('old');
el('res-podium-third').value = 'Troisièmes';
ctx.saveResults(event);
assert.equal(writes.at(-1).path,'tournaments/old/results');
assert.equal(writes.at(-1).data.podium.third,'Troisièmes');
assert(!ctx.renderTournamentCard(legacy,true).includes('Classement final du tournoi'));
console.log('OK : podium facultatif, sauvegarde et réouverture, deux journées distinctes, tournoi simple, échappement HTML, effacement et anciens résultats compatibles.');
(async()=>{
    const teamTournament = {id:'team-results',name:'Week-end équipes',date:'2026-11-20',format:'Doublette',days:{
        day1:{date:'2026-11-20',format:'Quadrette',teams:{
            same:{id:'same',name:'Samedi',playerIds:['a','b','c'],externalPlayers:['Partenaire — Metz']},
            other:{id:'other',name:'Autre équipe',playerIds:[]}
        }},
        day2:{date:'2026-11-21',format:'Doublette',teams:{same:{id:'same',name:'Dimanche',playerIds:['a'],externalPlayers:['Autre partenaire — Boulay']}}}
    }};
    ctx.state.tournaments=[teamTournament];
    ctx.state.isAdmin=true;
    ctx.openTeamResultsModal('team-results','same','day1');
    assert.equal(el('tr-phase').value,'');
    assert.equal(el('tr-tableau').value,'Principal');
    assert(el('team-results-label').textContent.includes('Quadruplette'));
    el('tr-tableau').value='Consolante';
    el('tr-phase').value='Finaliste';
    el('tr-rank').value='2';
    el('tr-details').value='<script>alert(1)</script>';
    await ctx.saveTeamResults(event);
    assert.equal(writes.at(-1).path,'tournaments/team-results/days/day1/teams/same/results');
    assert.equal(writes.at(-1).data.phase,'Finaliste');
    assert.equal(writes.at(-1).data.rank,2);
    teamTournament.days.day1.teams.same.results=writes.at(-1).data;
    assert.equal(ctx.isTournamentArchived(teamTournament),false,'A team result alone never archives the weekend');
    ctx.openTeamResultsModal('team-results','other','day1');
    assert.equal(el('tr-phase').value,'');
    assert.equal(el('tr-details').value,'');
    el('tr-phase').value='Quart de finale';
    await ctx.saveTeamResults(event);
    teamTournament.days.day1.teams.other.results=writes.at(-1).data;
    assert.equal(writes.at(-1).path,'tournaments/team-results/days/day1/teams/other/results');
    ctx.openTeamResultsModal('team-results','same','day2');
    assert.equal(el('tr-phase').value,'');
    el('tr-phase').value='Vainqueur';
    await ctx.saveTeamResults(event);
    teamTournament.days.day2.teams.same.results=writes.at(-1).data;
    assert.equal(writes.at(-1).path,'tournaments/team-results/days/day2/teams/same/results');
    assert.equal(teamTournament.days.day1.teams.same.results.phase,'Finaliste');
    ctx.openTeamResultsModal('team-results','same','day1');
    assert.equal(el('tr-rank').value,2);
    assert.equal(el('tr-phase').value,'Finaliste');
    for (const rank of ['0','-1','2.5','abc']) {
        el('tr-rank').value=rank;
        const n=writes.length;
        await ctx.saveTeamResults(event);
        assert.equal(writes.length,n);
    }
    el('tr-rank').value='';
    el('tr-phase').value='Classé';
    const n=writes.length;
    await ctx.saveTeamResults(event);
    assert.equal(writes.length,n);
    el('tr-rank').value='12';
    await ctx.saveTeamResults(event);
    assert.equal(writes.at(-1).data.rank,12);
    const rendered=ctx.renderTournamentCard(teamTournament,false);
    assert(rendered.includes('Consolante :</strong> Finaliste'));
    assert(rendered.includes('Principal :</strong> Quart de finale'));
    assert(rendered.includes('Principal :</strong> Vainqueur'));
    assert(rendered.includes('Partenaire — Metz (Ext.)'));
    assert(rendered.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert(!rendered.includes('<script>alert(1)</script>'));
    assert(rendered.includes("openTeamResultsModal('team-results', 'same', 'day2')"));
    ctx.state.isAdmin=false;
    const publicCard=ctx.renderTournamentCard(teamTournament,true);
    assert(publicCard.includes('Consolante :</strong> Finaliste'));
    assert(!publicCard.includes('onclick="openTeamResultsModal'));
    ctx.auth.currentUser=null;
    const blocked=writes.length;
    await ctx.saveTeamResults(event);
    assert.equal(writes.length,blocked);
    ctx.auth.currentUser={uid:ctx.ADMIN_UID};
    ctx.state.isAdmin=true;
    assert(ctx.renderTournamentCard(teamTournament,true).includes('onclick="openTeamResultsModal'));
    const originalRef=ctx.db.ref;
    ctx.db.ref=()=>({set:()=>Promise.reject(Error('Offline'))});
    el('tr-phase').value='Finaliste';
    await ctx.saveTeamResults(event);
    assert(el('tr-error').textContent.includes('non enregistré'));
    assert.equal(el('tr-submit').disabled,false);
    ctx.db.ref=originalRef;
    await ctx.deleteTeamResults();
    assert.equal(removals.at(-1),'tournaments/team-results/days/day1/teams/same/results');
    assert.equal(teamTournament.days.day1.teams.same.externalPlayers[0],'Partenaire — Metz');
    const single={id:'single-teams',name:'Un jour',date:'2026-11-22',format:'Doublette',teams:{a:{id:'a',name:'Duo',playerIds:['a','b']}},results:{phase:'Podium / Bilan Club',podium:{first:'Autre équipe'},playerCount:100}};
    ctx.state.tournaments=[single];
    ctx.openTeamResultsModal('single-teams','a');
    el('tr-phase').value='Demi-finale';
    await ctx.saveTeamResults(event);
    assert.equal(writes.at(-1).path,'tournaments/single-teams/teams/a/results');
    assert.equal(single.results.playerCount,100);
    assert.equal(single.results.podium.first,'Autre équipe');
    console.log('OK : résultats par équipe et journée, tournois simples/archivés, compositions et bilan préservés, validation, rendu public sécurisé, droits admin et erreurs réseau, effacement du résultat seul.');
})().catch(error=>{console.error(error);process.exitCode=1;});
