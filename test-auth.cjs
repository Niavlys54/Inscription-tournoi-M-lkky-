const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(__dirname+'/index.html','utf8');
const UID = 'th9gEGFrlQUJt299LlV6VdGgl643';
const elements = {};
const el = id => elements[id] ||= {value:'',textContent:'',disabled:false};
const writes = [];
let authListener;
let signedInUid = UID;
let failLogin = false;
let renders = 0;
const ctx = vm.createContext({
    ADMIN_UID:UID,
    state:{isAdmin:false,members:[],tournaments:[]},
    DEFAULT_MEMBERS:[{id:'1',name:'Test'}],
    document:{getElementById:el},
    alert:()=>{},
    confirm:()=>true,
    render:()=>renders++,
    switchTab:()=>{},
    openModal:id=>{el(id).open=true;},
    closeModal:id=>{el(id).open=false;},
    db:{ref:path=>({
        on:(_,cb)=>cb({val:()=>null}),
        set:value=>{writes.push({path,value});return Promise.resolve();},
        remove:()=>{writes.push({path,remove:true});return Promise.resolve();}
    })},
    auth:{
        currentUser:null,
        onAuthStateChanged:cb=>{authListener=cb;cb(null);},
        signInWithEmailAndPassword:async()=>{
            if (failLogin) throw Error('Simulated authentication error');
            ctx.auth.currentUser={uid:signedInUid};
            authListener(ctx.auth.currentUser);
            return {user:ctx.auth.currentUser};
        },
        signOut:async()=>{ctx.auth.currentUser=null;authListener(null);}
    }
});
vm.runInContext(html.slice(html.indexOf('        function initApp('),html.indexOf('        function switchTab(')),ctx);
(async()=>{
    ctx.initApp();
    assert.equal(writes.length,0,'Visitors never initialize or overwrite database data');
    assert.equal(ctx.requireAdmin(),false);
    ctx.clearAllTournaments();
    ctx.resetDefaultData();
    assert.equal(writes.length,0);
    el('admin-email').value='test@example.invalid';
    el('admin-password').value='local-test-only';
    await ctx.signInAdmin({preventDefault(){}});
    assert.equal(ctx.state.isAdmin,true);
    assert.equal(ctx.requireAdmin(),true);
    assert.equal(el('admin-password').value,'');
    assert.equal(el('modal-admin-login').open,false);
    await ctx.auth.signOut();
    assert.equal(ctx.state.isAdmin,false);
    signedInUid='other-user';
    await ctx.signInAdmin({preventDefault(){}});
    assert.equal(ctx.state.isAdmin,false);
    assert.equal(ctx.auth.currentUser,null);
    assert(el('admin-login-error').textContent.includes('pas les droits'));
    failLogin=true;
    await ctx.signInAdmin({preventDefault(){}});
    assert(el('admin-login-error').textContent.includes('Connexion impossible'));
    assert.equal(el('admin-login-submit').disabled,false);
    assert.equal(el('admin-password').value,'');
    assert(!html.includes('const pass = prompt('));
    assert(html.includes('firebase-auth-compat.js'));
    assert(renders>0);
    console.log('OK : connexion Firebase simulée, UID administrateur seul, refus des autres comptes, déconnexion, erreurs et effacement du mot de passe ; aucune écriture automatique des visiteurs.');
})().catch(e=>{console.error(e);process.exitCode=1;});
