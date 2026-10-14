/* Imita o Apps Script v2 (mesma união) para testar sem a conta Google */
const http=require('http'); const base={}, codigos={}; const MAPAS=['resp','rev','fp','rever','marc','meta'];
const contar=o=>o?Object.keys(o).length:0;
function unir(a,b){ a=a||{}; b=b||{};
  const aj=(b.ajustes&&(!a.ajustes||(Number(b.ajustes.cfgEm)||0)>=(Number(a.ajustes.cfgEm)||0)))?b.ajustes:(a.ajustes||b.ajustes||null);
  const out={v:2,nome:(b.nome||a.nome||''),ajustes:aj,bancoVer:b.bancoVer||a.bancoVer||'',stats:b.stats||a.stats||{},em:new Date().toISOString()};
  if(Array.isArray(a.done)||Array.isArray(b.done)){ const d={}; (a.done||[]).forEach(k=>d[k]=1); (b.done||[]).forEach(k=>d[k]=1); out.done=Object.keys(d); }
  else { out.done={}; [a.done||{},b.done||{}].forEach(m=>Object.keys(m).forEach(k=>{ out.done[k]=Math.max(out.done[k]||0,Number(m[k])||1); })); }
  MAPAS.forEach(c=>{ const m={},A=a[c]||{},B=b[c]||{}; Object.keys(A).forEach(k=>m[k]=A[k]); Object.keys(B).forEach(k=>m[k]=B[k]); out[c]=m; });
  out.hist={}; [a.hist||{},b.hist||{}].forEach(h=>Object.keys(h).forEach(id=>{ const L=out.hist[id]||[]; const v={}; L.forEach(x=>v[x[0]]=1); (h[id]||[]).forEach(x=>{ if(!v[x[0]]){L.push(x);v[x[0]]=1;} }); L.sort((x,y)=>x[0]-y[0]); out.hist[id]=L.slice(-50); }));
  const ap={},rv={};
  [a.apagadas||{},b.apagadas||{}].forEach(m=>Object.keys(m).forEach(id=>{ if(!ap[id]||m[id]>ap[id]) ap[id]=m[id]; }));
  [a.revividas||{},b.revividas||{}].forEach(m=>Object.keys(m).forEach(id=>{ if(!rv[id]||m[id]>rv[id]) rv[id]=m[id]; }));
  Object.keys(ap).forEach(id=>{ if(rv[id]&&rv[id]>=ap[id]){ delete ap[id]; return; } MAPAS.forEach(c=>{ delete out[c][id]; }); });
  out.apagadas=ap; out.revividas=rv; out.__acrescentadas=contar(out.resp)-contar(a.resp); return out; }
http.createServer((req,res)=>{ let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
  res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Content-Type','application/json'); let r={ok:false,erro:'falha'};
  try{ const q=JSON.parse(body||'{}'); const portal=q.portal||'enac4'; const email=String(q.email||'').trim().toLowerCase(), codigo=String(q.codigo||'').trim().toUpperCase(); const k=portal+':'+email;
    if(!email||email.indexOf('@')<1) r={ok:false,erro:'email_invalido'}; else if(codigo.length<4) r={ok:false,erro:'codigo_curto'};
    else if(codigos[k]&&codigos[k]!==codigo) r={ok:false,erro:'codigo_nao_confere'};
    else if(q.acao==='carregar') r={ok:true,acao:'carregar',achou:!!base[k],dados:base[k]||null};
    else { codigos[k]=codigo; const u=unir(base[k],q.dados||{}); const ac=u.__acrescentadas; delete u.__acrescentadas; base[k]=u; r={ok:true,acao:'salvar',dados:u,acrescentadas:ac}; }
  }catch(e){ r={ok:false,erro:'falha',detalhe:String(e)}; } res.end(JSON.stringify(r)); }); }).listen(8766,'127.0.0.1',()=>console.log('stub v2 em 8766'));
