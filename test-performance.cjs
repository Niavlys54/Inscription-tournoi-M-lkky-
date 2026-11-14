const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const ctx = vm.createContext({state:{tournaments:[]}});
vm.runInContext(html.slice(html.indexOf('        function escapeText('), html.indexOf('        function tournamentSchedule(')),ctx);
vm.runInContext(html.slice(html.indexOf('        function playerPerformance('), html.indexOf('        function isTournamentArchived(')),ctx);
const team = (phase, extra={}) => ({name:'Les Lauvains',playerIds:['sylvain','laura','laura'],results:{phase,tableau:'Principal',...extra}});
const mambo = {id:'mambo',name:'Open du MAMBO',date:'2026-11-14',format:'Doublette',results:{phase:'Vainqueur',podium:{first:'Laura et Sylvain'}},teams:{duo:team('Vainqueur')}};
for(const id of ['sylvain','laura']){
    const stats=ctx.playerPerformance(id,[mambo]);
    assert.equal(stats.records.length,1);
    assert.equal(stats.groups[0].wins,1);
    assert.equal(stats.groups[0].podiums,1);
}
assert.equal(ctx.playerPerformance('other',[mambo]).records.length,0);
assert.equal(ctx.playerPerformance('laura',[{...mambo,date:'2025-11-14'}]).records.length,0);
assert.equal(ctx.playerPerformance('laura',[{...mambo,teams:{}}]).records.length,0,'No guessing names in global podium');
assert.equal(ctx.playerPerformance('laura',[{...mambo,teams:{a:{...team('Vainqueur'),results:null}}}]).records.length,0);
const weekend={...mambo,id:'weekend',teams:{parent:team('Vainqueur')},days:{
    one:{date:'2026-11-15',format:'Quadrette',teams:{same:team('Finaliste',{tableau:'Consolante'})}},
    two:{date:'2026-11-16',format:'Doublette',teams:{same:team('Classé',{system:'swiss',rank:3})}}
}};
let stats=ctx.playerPerformance('laura',[mambo,weekend]);
assert.equal(stats.records.length,3,'Two days count independently; parent is not counted again');
assert.equal(stats.groups.find(g=>g.key==='principal').wins,1);
assert.equal(stats.groups.find(g=>g.key==='consolante').podiums,1);
assert.equal(stats.groups.find(g=>g.key==='consolante').wins,0);
assert.equal(stats.groups.find(g=>g.key==='swiss').podiums,1);
assert.equal(stats.records[0].date,'2026-11-16');
for(const [phase,rank,podium] of [['Demi-finale',null,false],['3e place',3,true],['Quart de finale',null,false],['Finaliste',2,true]]){
    const s=ctx.playerPerformance('laura',[{...mambo,teams:{a:team(phase)}}]);
    assert.equal(s.records[0].rank,rank);
    assert.equal(s.records[0].podium,podium);
}
stats=ctx.playerPerformance('laura',[{...mambo,teams:{a:team('Vainqueur',{rank:8,tableau:'Honneur'})}}]);
assert.equal(stats.groups.find(g=>g.key==='other').wins,0,'Exact rank takes priority over contradictory phase');
ctx.state.tournaments=[mambo,weekend];
let rendered=ctx.renderPlayerPerformance('laura');
assert(rendered.includes('Open du MAMBO'));
assert(rendered.includes('1 victoire'));
assert(rendered.includes('Consolante'));
assert(rendered.includes('Système suisse'));
assert(rendered.includes('Quadruplette'));
assert(!ctx.renderPlayerPerformance('nobody').includes('Open du MAMBO'));
ctx.state.tournaments=[{...mambo,name:'<img onerror=bad>',teams:{a:{...team('Vainqueur'),name:'<script>bad</script>'}}}];
rendered=ctx.renderPlayerPerformance('laura');
assert(!rendered.includes('<script>bad'));
assert(rendered.includes('&lt;img onerror=bad&gt;'));
console.log('OK : bilans par joueur, victoire Mambo pour les deux partenaires, tableaux distincts, suisse, deux jours, saison 2026, aucun doublon avec bilan général, rangs et rendu sécurisé.');
