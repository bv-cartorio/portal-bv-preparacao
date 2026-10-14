/* ===================== PROGRESSO EM NUVEM =====================
   Navegador = base primária; nuvem = espelho por e-mail + código de retomada.
   Toda troca é UNIÃO. Só sai a questão que o aluno mandou refazer ("apagadas");
   responder de novo desfaz ("revividas"). Sincroniza 1,5 s após abrir, a cada
   intervalo configurado (5 minutos), ao esconder a aba e ao sair.           */
var SYNC_CFG = Object.assign({ url: '', intervalo: 300000, portal: 'preparacao' }, CONFIG.sync || {});
var KEY_SYNC = 'bv-prep-sync-v1';
var NUVEM = (function () {
  var cred = null, estado = 'desligado', ultima = null, msg = '', emCurso = false;
  function lerCred() { try { var r = store.get(KEY_SYNC); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function guardarCred(c) { cred = c; store.set(KEY_SYNC, JSON.stringify(c)); }
  function esquecer() { cred = null; estado = 'desligado'; msg = ''; store.del(KEY_SYNC); }
  function disponivel() { return !!String(SYNC_CFG.url || '').trim(); }
  function ligado() { return !!(disponivel() && cred && cred.email && cred.codigo); }
  function situacao() { return { estado: estado, msg: msg, ultima: ultima, cred: cred, disponivel: disponivel() }; }
  function placar() { var ac = 0, er = 0; Object.keys(QST.resp).forEach(function (id) { var s = statusQ(id); if (s === true) ac++; else if (s === false) er++; }); return { certas: ac, erradas: er }; }
  function pacote() { var p = placar(), c = ST.cfg || {};
    var meses = Math.round(dayDiff(fromISO(c.examDate), fromISO(c.startDate)) / 30.44);
    return { v: 2, nome: c.nome || '', ajustes: ST.planoFeito ? c : null, done: ST.done || {}, resp: QST.resp || {}, rev: QST.rev || {}, fp: QST.fp || {}, rever: QST.rever || {},
      marc: QST.marc || {}, meta: QST.meta || {}, hist: QST.hist || {}, apagadas: QST.del || {}, revividas: QST.rev_del || {}, bancoVer: BANCO_VER,
      stats: { certas: p.certas, erradas: p.erradas, modelo: (ST.planoFeito ? meses + ' meses' : 'sem plano'), inicio: c.startDate || '' } }; }
  function corpo(acao, dados, origem) { return JSON.stringify({ portal: SYNC_CFG.portal, acao: acao, email: cred.email, codigo: cred.codigo, nome: (ST.cfg && ST.cfg.nome) || '', origem: origem || (navigator.userAgent || '').slice(0, 80), dados: dados || null }); }
  function chamar(acao, dados) {
    return fetch(SYNC_CFG.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: corpo(acao, dados), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { if (!j || j.ok !== true) throw new Error((j && j.erro) || 'resposta inesperada'); return j; });
  }
  function adotar(d) {
    if (!d) return { novas: 0 };
    var novas = 0;
    ['resp', 'rev', 'fp', 'rever', 'marc', 'meta'].forEach(function (c) { var v = d[c]; if (!v) return; QST[c] = QST[c] || {}; Object.keys(v).forEach(function (id) { if (c === 'resp' && QST.resp[id] == null) novas++; QST[c][id] = v[id]; }); });
    if (d.hist) Object.keys(d.hist).forEach(function (id) { var L = QST.hist[id] || [], vistos = {}; L.forEach(function (x) { vistos[x[0]] = 1; }); (d.hist[id] || []).forEach(function (x) { if (!vistos[x[0]]) L.push(x); }); L.sort(function (x, y) { return x[0] - y[0]; }); QST.hist[id] = L.slice(-50); });
    if (d.done) { var dn = Array.isArray(d.done) ? d.done.reduce(function (m, k) { m[k] = 1; return m; }, {}) : d.done; Object.keys(dn).forEach(function (k) { ST.done[k] = Math.max(ST.done[k] || 0, Number(dn[k]) || 1); }); }
    if (d.ajustes && (!ST.planoFeito || (Number(d.ajustes.cfgEm) || 0) > (Number(ST.cfg.cfgEm) || 0))) { ST.cfg = Object.assign(cfgPadrao(), d.ajustes); ST.cfg.disc = Object.assign(cfgPadrao().disc, d.ajustes.disc || {}); ST.planoFeito = true; gerarPlano(); }
    salvarQ(); salvar(); try { reconciliarRespostas(); } catch (e) {} try { SG.snapshot('nuvem'); } catch (e) {}
    return { novas: novas };
  }
  function sincronizar(manual) {
    if (!ligado()) { if (manual) toast('Informe e-mail e código para ativar'); return Promise.resolve(null); }
    if (emCurso) return Promise.resolve(null);
    emCurso = true; estado = 'sincronizando'; if (VIEW === 'prog') renderProg();
    return chamar('salvar', pacote()).then(function (r) {
      var a = adotar(r.dados); ultima = new Date().toISOString(); estado = 'em dia';
      msg = a.novas ? ('chegaram ' + a.novas + ' respostas de outro aparelho') : 'tudo sincronizado';
      if (manual) toast(a.novas ? ('Chegaram ' + a.novas + ' respostas de outro aparelho') : 'Progresso sincronizado');
      if (VIEW === 'prog') renderProg(); else render();
      return r;
    }).catch(function (e) {
      estado = 'erro'; msg = String(e.message || e);
      if (/codigo_nao_confere/.test(msg)) { msg = 'o código não confere com o e-mail já cadastrado'; if (manual) toast('Esse e-mail já tem outro código de retomada'); }
      else if (manual) toast('Não consegui falar com a nuvem agora — o progresso segue salvo neste navegador');
      if (VIEW === 'prog') renderProg(); return null;
    }).then(function (r) { emCurso = false; return r; });
  }
  function ativar(email, codigo) {
    email = String(email || '').trim().toLowerCase(); codigo = String(codigo || '').trim().toUpperCase();
    if (email.indexOf('@') < 1) { toast('Informe um e-mail válido'); return Promise.resolve(false); }
    if (codigo.length < 4) { toast('O código precisa de pelo menos 4 caracteres'); return Promise.resolve(false); }
    guardarCred({ email: email, codigo: codigo });
    return sincronizar(true).then(function (r) { if (!r) { if (estado === 'erro' && /não confere/.test(msg)) esquecer(); return false; } return true; });
  }
  function aoSair() { if (!ligado()) return; try { fetch(SYNC_CFG.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: corpo('salvar', pacote(), 'saida'), keepalive: true, redirect: 'follow' }); } catch (e) {} }
  function iniciar() { cred = lerCred(); if (!ligado()) return; estado = 'aguardando';
    setTimeout(function () { sincronizar(false); }, 1500); setInterval(function () { sincronizar(false); }, SYNC_CFG.intervalo);
    try { document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') aoSair(); }); window.addEventListener('beforeunload', aoSair); } catch (e) {} }
  return { iniciar: iniciar, ativar: ativar, sincronizar: sincronizar, esquecer: esquecer, situacao: situacao, ligado: ligado, disponivel: disponivel, adotar: adotar, pacote: pacote };
})();
function painelNuvem() {
  var s = NUVEM.situacao();
  if (!s.disponivel) return '<div class="cx"><div class="kick">Nuvem</div><h2 style="font-size:17px">Progresso na nuvem</h2><p>Em implantação. Enquanto não entrar, use o backup desta aba para levar o progresso a outro aparelho.</p></div>';
  var cores = { 'em dia': 'var(--ok)', 'sincronizando': 'var(--muted)', 'erro': 'var(--bad)', 'aguardando': 'var(--muted)', 'desligado': 'var(--muted)' };
  if (!NUVEM.ligado()) return '<div class="cx"><div class="kick">Nuvem</div><h2 style="font-size:17px">Progresso na nuvem</h2><p>Ligue a nuvem e o seu progresso passa a acompanhar você em qualquer aparelho. No primeiro acesso, o que já está neste navegador sobe para a sua conta; depois, a sincronização é automática a cada 5 minutos e ao sair. O código de retomada é escolhido por você e serve para reencontrar o seu progresso — não é senha, e aqui não há nada além das suas marcações.</p>' +
    '<div class="g2" style="margin-top:8px"><div><label class="f" for="nv-email">Seu e-mail</label><input type="email" id="nv-email" placeholder="voce@exemplo.com" autocomplete="email"></div><div><label class="f" for="nv-codigo">Código de retomada (4+ caracteres)</label><input type="text" id="nv-codigo" placeholder="ex.: BV-2027" autocomplete="off"></div></div>' +
    '<div class="lin" style="margin-top:12px"><button class="btn p" data-act="nv-ativar">Ativar e sincronizar</button></div></div>';
  return '<div class="cx"><div class="kick">Nuvem</div><h2 style="font-size:17px">Progresso na nuvem</h2><p>Ligado como <b>' + esc(s.cred.email) + '</b> · código <b>' + esc(s.cred.codigo) + '</b>. Última sincronização: <b style="color:' + (cores[s.estado] || 'inherit') + '">' + (s.ultima ? fmtDH(s.ultima) : 'ainda não') + '</b>' + (s.msg ? ' · ' + esc(s.msg) : '') + '. Automática a cada 5 minutos e ao sair. Em outro aparelho, use o mesmo e-mail e código.</p>' +
    '<div class="lin" style="margin-top:12px"><button class="btn p" data-act="nv-agora">Sincronizar agora</button><button class="btn g" data-act="nv-desligar">Desligar neste aparelho</button></div></div>';
}
