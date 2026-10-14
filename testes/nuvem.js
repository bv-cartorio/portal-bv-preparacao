/* Nuvem do Portal BV Preparação: dois aparelhos, mesmo aluno, união sem perda */
const { chromium } = require('playwright'); const BASE='http://127.0.0.1:8777/';
let falhas=0,total=0; const ok=(n,c,d)=>{total++;if(!c)falhas++;console.log((c?'  PASSA  ':'  FALHA  ')+n+(d!==undefined?'  ['+d+']':''));};
const pronto=pg=>pg.waitForFunction(()=>typeof NUVEM!=='undefined'&&typeof BANCO_INDEX!=='undefined'&&!!document.querySelector('.pane.on .cx'),null,{timeout:60000});
async function aparelho(browser){ const ctx=await browser.newContext(); const pg=await ctx.newPage(); await pg.goto(BASE,{waitUntil:'load'}); await pronto(pg); return {ctx,pg}; }
const foto=pg=>pg.evaluate(()=>({n:Object.keys(QST.resp).length, done:Object.keys(ST.done).length, plano:ST.planoFeito, dias:PLANO?PLANO.days.length:0, estado:NUVEM.situacao().estado}));
async function responder(pg,disc,ini,n){ await pg.evaluate(d=>new Promise(r=>carregarDisc(d,r)),disc);
  return pg.evaluate(({disc,ini,n})=>{ const qs=QUESTOES.filter(q=>q.disc===disc).slice(ini,ini+n); qs.forEach((q,k)=>{ const i=k%5; QST.resp[q.id]=i; QST.rev[q.id]=q.rev||0; QST.fp[q.id]=impressaoAltPar(q.alternativas[i]); QST.meta[q.id]={d:q.disc,t:q.tema}; (QST.hist[q.id]=QST.hist[q.id]||[]).push([Date.now()+k, i===q.correta?1:0]); }); salvarQ(); return Object.keys(QST.resp).length; },{disc,ini,n}); }
(async()=>{
 const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 console.log('\n1) Aparelho A: monta plano, responde e liga a nuvem');
 const A=await aparelho(browser);
 await A.pg.click('[data-hz="12"]'); await A.pg.click('[data-preset="work"]'); await A.pg.click('[data-act="gerar"]'); await A.pg.waitForTimeout(600);
 await responder(A.pg,'ri',0,40);
 await A.pg.evaluate(()=>{ const d=diaHoje(); d.blocks.forEach(b=>{ ST.done[b.tid]=b.o1; }); salvar(); });
 const r1=await A.pg.evaluate(()=>NUVEM.ativar('aluno@teste.com','BV-2027'));
 ok('ativação no A', r1===true); const fA=await foto(A.pg); ok('A: 40 respostas, tarefas marcadas, em dia', fA.n===40&&fA.done>0&&fA.estado==='em dia', JSON.stringify(fA));
 console.log('\n2) Aparelho B, do zero, mesmo e-mail e código');
 const B=await aparelho(browser); const r2=await B.pg.evaluate(()=>NUVEM.ativar('aluno@teste.com','BV-2027')); await B.pg.waitForTimeout(300);
 const fB=await foto(B.pg); ok('B recebe respostas, tarefas e reconstrói o plano', r2===true&&fB.n===40&&fB.done===fA.done&&fB.plano&&fB.dias>200, JSON.stringify(fB));
 ok('B: domínio calculado sem baixar o banco', await B.pg.evaluate(()=>dominioDisc('ri').n===40&&QUESTOES.length===0));
 ok('B herda as horas e o horizonte do A (plano idêntico)', fB.dias===fA.dias&&JSON.stringify(await B.pg.evaluate(()=>ST.cfg.hours))==='[3,2.5,2.5,2.5,2.5,2.5,5]', fA.dias+' vs '+fB.dias);
 console.log('\n2b) B muda o horizonte para 18 meses; A acompanha');
 await B.pg.evaluate(()=>{ ST.cfg.examDate=toISO(addMonths(fromISO(ST.cfg.startDate),18)); ST.cfg.cfgEm=Date.now(); salvar(); gerarPlano(); });
 await B.pg.evaluate(()=>NUVEM.sincronizar(true)); await A.pg.evaluate(()=>NUVEM.sincronizar(true));
 ok('A adota o novo horizonte', await A.pg.evaluate(()=>ST.cfg.examDate)===await B.pg.evaluate(()=>ST.cfg.examDate));
 console.log('\n3) União: respostas diferentes em cada aparelho');
 await responder(B.pg,'civil',0,25); await B.pg.evaluate(()=>NUVEM.sincronizar(true));
 await responder(A.pg,'notas',0,10); await A.pg.evaluate(()=>NUVEM.sincronizar(true));
 ok('A soma as 25 do B', (await foto(A.pg)).n===75, JSON.stringify(await foto(A.pg)));
 await B.pg.evaluate(()=>NUVEM.sincronizar(true)); ok('B soma as 10 do A', (await foto(B.pg)).n===75);
 console.log('\n4) Perda total no navegador: a nuvem repõe sozinha');
 await B.pg.evaluate(()=>{ localStorage.removeItem('bv-prep-respostas-v1'); localStorage.removeItem('bv-prep-estado-v1'); for(let i=0;i<5;i++) localStorage.removeItem('bv-prep-snap-'+i); });
 await B.pg.goto(BASE,{waitUntil:'load'}); await pronto(B.pg); await B.pg.waitForTimeout(3500);
 const rB=await foto(B.pg); ok('reabrindo, volta tudo', rB.n===75&&rB.plano&&rB.done===fA.done, JSON.stringify(rB));
 console.log('\n5) Refazer uma questão vale para a nuvem; responder de novo desfaz');
 const alvo=await A.pg.evaluate(()=>{ const id=Object.keys(QST.resp)[0]; delete QST.resp[id]; delete QST.fp[id]; QST.del[id]=Date.now(); salvarQ(); return id; });
 await A.pg.evaluate(()=>NUVEM.sincronizar(true)); await B.pg.evaluate(()=>NUVEM.sincronizar(true));
 const C=await aparelho(browser); await C.pg.evaluate(()=>NUVEM.ativar('aluno@teste.com','BV-2027')); await C.pg.waitForTimeout(300);
 ok('aparelho novo não recebe a questão refeita', await C.pg.evaluate(a=>QST.resp[a]==null&&Object.keys(QST.resp).length===74,alvo));
 const re=await A.pg.evaluate(async a=>{ await new Promise(r=>carregarDisc('ri',r)); const q=Q_BY[a]; QST.resp[a]=0; QST.fp[a]=impressaoAltPar(q.alternativas[0]); QST.meta[a]={d:q.disc,t:q.tema}; delete QST.del[a]; QST.rev_del[a]=Date.now(); salvarQ(); await NUVEM.sincronizar(true); return Object.keys(QST.resp).length; },alvo);
 ok('responder de novo devolve à nuvem', re===75, 'n='+re);
 console.log('\n6) Código divergente e falha de rede');
 const D=await aparelho(browser); const r4=await D.pg.evaluate(()=>NUVEM.ativar('aluno@teste.com','OUTRO')); ok('código divergente é recusado e nada é exposto', r4===false&&(await foto(D.pg)).n===0);
 await A.ctx.route(/127\.0\.0\.1:8766/, r=>r.abort()); const antes=(await foto(A.pg)).n; await A.pg.evaluate(()=>NUVEM.sincronizar(true)); const dep=await foto(A.pg);
 ok('sem rede, nada muda e o estado vira erro', dep.n===antes&&dep.estado==='erro', JSON.stringify(dep));
 await browser.close(); console.log(`\n================  ${total-falhas}/${total} verificações passaram  ================`); process.exit(falhas?1:0);
})().catch(e=>{console.error('ERRO:',e);process.exit(2);});
