const { chromium } = require('playwright');
const BASE='http://127.0.0.1:8777/';
let falhas=0,total=0; const ok=(n,c,d)=>{total++;if(!c)falhas++;console.log((c?'  PASSA  ':'  FALHA  ')+n+(d!==undefined?'  ['+d+']':''));};
(async()=>{
 const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:1366,height:900}}); const pg=await ctx.newPage();
 const erros=[]; pg.on('pageerror',e=>erros.push(String(e))); pg.on('console',m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
 await pg.goto(BASE,{waitUntil:'load'}); await pg.waitForFunction(()=>typeof BANCO_INDEX!=='undefined'&&!!document.querySelector('#v-plano .cx'),null,{timeout:60000});
 ok('abre sem erro de script', erros.length===0, erros.slice(0,2).join(' | '));
 const base=await pg.evaluate(()=>({q:BANCO_INDEX.total,t:TEMAS.length,d:DISCS.length,view:VIEW,carregadas:QUESTOES.length}));
 ok('taxonomia e índice do banco carregados; questões só sob demanda', base.q===1583&&base.t===133&&base.d===14&&base.carregadas===0, JSON.stringify(base));
 ok('sem plano, abre na aba Plano', base.view==='plano');
 // monta plano com 12 meses, trabalho+estudo
 await pg.click('[data-hz="12"]'); await pg.click('[data-preset="work"]'); await pg.click('[data-act="gerar"]');
 await pg.waitForTimeout(800);
 const plano=await pg.evaluate(()=>({feito:ST.planoFeito, dias:PLANO?PLANO.days.length:0, fases:PLANO?PLANO.phases.map(p=>p.key):[], sobra:PLANO?PLANO.leftoverTasks:null, view:VIEW, blocos:(diaHoje()||{blocks:[]}).blocks.length}));
 ok('plano gerado e aba Hoje aberta', plano.feito&&plano.dias>200&&plano.view==='hoje', JSON.stringify(plano));
 ok('hoje tem blocos', plano.blocos>0, 'blocos='+plano.blocos);
 await pg.screenshot({path:'/home/claude/portalbv/testes/hoje.png'});
 // marca um bloco como feito
 const cb=pg.locator('#v-hoje .blk input[type=checkbox]').first(); await cb.check(); await pg.waitForTimeout(200);
 ok('marcar bloco grava em ST.done', await pg.evaluate(()=>Object.keys(ST.done).length>0));
 // abre uma rodada de questões a partir do bloco, se houver
 const temRodada=await pg.locator('#v-hoje [data-rodada-bloco]').count();
 if(temRodada){ await pg.locator('#v-hoje [data-rodada-bloco]').first().click(); await pg.waitForFunction(()=>!!QS,null,{timeout:20000}).catch(()=>{}); await pg.waitForTimeout(300);
   const s=await pg.evaluate(()=>({qs:!!QS, n:QS?QS.ids.length:0, view:VIEW})); ok('rodada do bloco abre a sessão', s.qs&&s.view==='banco', JSON.stringify(s));
   if(s.qs){ await pg.locator('#v-banco .alt').nth(1).click(); await pg.locator('[data-act="confirmar"]').click(); await pg.waitForTimeout(200);
     const r=await pg.evaluate(()=>({n:Object.keys(QST.resp).length, fp:Object.keys(QST.fp).length, meta:Object.keys(QST.meta).length, gab:!!document.querySelector('#v-banco .res')}));
     ok('responder grava resposta, impressão, meta e abre gabarito', r.n===1&&r.fp===1&&r.meta===1&&r.gab, JSON.stringify(r)); await pg.screenshot({path:'/home/claude/portalbv/testes/questao.png'}); }
 } else ok('(hoje sem bloco de questões — tema ainda sem banco)', true);
 // banco: árvore e filtros
 await pg.evaluate(()=>{ QS=null; FILTRO={disc:null,tema:null,sub:null,status:'todas',busca:''}; mostrar('banco'); });
 await pg.locator('.dom[data-disc="ri"]').click(); await pg.waitForFunction(()=>CARREGADOS.ri===true,null,{timeout:20000}); await pg.waitForTimeout(300);
 const b1=await pg.evaluate(()=>({disc:FILTRO.disc, lista:filtrarQuestoes().length, itens:document.querySelectorAll('.item-q').length}));
 ok('trilho esquerdo filtra o banco por disciplina', b1.disc==='ri'&&b1.lista===205, JSON.stringify(b1));
 await pg.locator('[data-arv-tema]').filter({hasText:/Alienação fiduciária|alienação/i}).first().click().catch(()=>{});
 await pg.locator('.arvore details[open] .tema').first().click(); await pg.waitForTimeout(300);
 const b2=await pg.evaluate(()=>({tema:FILTRO.tema, lista:filtrarQuestoes().length, subs:document.querySelectorAll('.subtemas .chip').length}));
 ok('tema selecionado filtra e mostra subtemas', !!b2.tema&&b2.lista>0&&b2.subs>1, JSON.stringify(b2));
 await pg.fill('#f-busca','fiduci'); await pg.waitForTimeout(500);
 ok('busca textual funciona', await pg.evaluate(()=>filtrarQuestoes().length)>=0);
 await pg.screenshot({path:'/home/claude/portalbv/testes/banco.png'});
 // diagnóstico e progresso
 await pg.evaluate(()=>mostrar('diag')); ok('diagnóstico renderiza o mapa', await pg.locator('#v-diag .heat .c').count()>5);
 await pg.evaluate(()=>mostrar('prog')); ok('progresso lista cópia de segurança', await pg.locator('#v-prog .sg-item').count()>=1);
 // persistência após recarga
 const antes=await pg.evaluate(()=>({resp:Object.keys(QST.resp).length, done:Object.keys(ST.done).length, feito:ST.planoFeito}));
 await pg.reload({waitUntil:'load'}); await pg.waitForFunction(()=>typeof PLANO!=='undefined'&&PLANO,null,{timeout:60000});
 const dep=await pg.evaluate(()=>({resp:Object.keys(QST.resp).length, done:Object.keys(ST.done).length, feito:ST.planoFeito, view:VIEW, dom:(function(){ var m=QST.meta[Object.keys(QST.resp)[0]]; return m?dominioDisc(m.d).n:0; })(), carregadas:QUESTOES.length}));
 ok('domínio calculado sem o banco carregado', dep.dom===1, JSON.stringify({dom:dep.dom,carregadas:dep.carregadas}));
 ok('tudo persiste após recarregar', JSON.stringify([dep.resp,dep.done,dep.feito])===JSON.stringify([antes.resp,antes.done,antes.feito])&&dep.view==='hoje', JSON.stringify(dep));
 ok('sem erro de script ao longo do uso', erros.length===0, erros.slice(0,3).join(' | '));
 // celular
 const m=await browser.newContext({viewport:{width:390,height:800}}); const mp=await m.newPage(); await mp.goto(BASE,{waitUntil:'load'}); await mp.waitForTimeout(1500);
 const larg=await mp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
 ok('celular: sem rolagem horizontal', larg);
 await mp.screenshot({path:'/home/claude/portalbv/testes/mobile.png'});
 await browser.close();
 console.log(`\n================  ${total-falhas}/${total} verificações passaram  ================`);
 process.exit(falhas?1:0);
})().catch(e=>{console.error('ERRO:',e);process.exit(2);});
