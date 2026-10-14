/* ===================== EVENTOS ===================== */
function rodadaDoBloco(tid, iso) {
  var d = PLANO && PLANO.days.find(function (x) { return x.iso === iso; }); var b = d && d.blocks.find(function (x) { return x.tid === tid; }); if (!b) return;
  if (b.disc && !CARREGADOS[b.disc] && nBancoDisc(b.disc) > 0) { toast('Carregando as questões…'); carregarDisc(b.disc, function (ok) { if (ok) rodadaDoBloco(tid, iso); }); return; }
  var ids;
  if (b.tema) ids = montarRodada(function (q) { return q.tema === b.tema; }, 10).map(function (q) { return q.id; });
  if ((!ids || !ids.length) && b.disc) ids = montarRodada(function (q) { return q.disc === b.disc; }, 10).map(function (q) { return q.id; });
  if (!ids || !ids.length) { toast('Ainda não há questões cadastradas para este tema — use o banco para treinar a disciplina'); FILTRO.disc = b.disc; FILTRO.tema = null; mostrar('banco'); return; }
  iniciarSessao(ids, (TIPO_TAG[b.type] ? TIPO_TAG[b.type][1] : 'Rodada') + ' · ' + fmtBR(d.date) + ' · ' + b.lbl, { tid: tid, iso: iso });
}
document.addEventListener('click', function (e) {
  var t = e.target.closest('button,[data-v],[data-disc],[data-sub],[data-mes],[data-snaprest],.mini[data-act],.chip[data-act]'); if (!t) return;
  if (t.dataset.v) { mostrar(t.dataset.v); return; }
  if (t.dataset.disc != null && t.classList.contains('dom')) { FILTRO.disc = t.dataset.disc; FILTRO.tema = null; FILTRO.sub = null; QS = null; mostrar('banco'); return; }
  if (t.dataset.arvDisc) { FILTRO.disc = t.dataset.arvDisc; FILTRO.tema = null; FILTRO.sub = null; setTimeout(renderBanco, 0); return; }
  if (t.dataset.arvTema) { var tm = TEMA_BY[t.dataset.arvTema]; FILTRO.disc = tm.disc; FILTRO.tema = tm.id; FILTRO.sub = null; renderBanco(); renderRailEsq(); return; }
  if (t.dataset.sub != null) { FILTRO.sub = t.dataset.sub || null; renderBanco(); return; }
  if (t.dataset.sem != null) { SEM_OFF = t.dataset.sem === '0' ? 0 : SEM_OFF + Number(t.dataset.sem); renderSemana(); return; }
  if (t.dataset.mes) { var seg = mondayOf(fromISO(t.dataset.mes + '-01')); SEM_OFF = Math.round(dayDiff(seg, mondayOf(fromISO(hojeISO()))) / 7); mostrar('semana'); return; }
  if (t.dataset.hz) { var m = Number(t.dataset.hz); ST.cfg.examDate = toISO(addMonths(fromISO(ST.cfg.startDate), m)); renderPlano(); return; }
  if (t.dataset.preset) { var p = PRESETS[t.dataset.preset]; if (p) { ST.cfg.hours = p.slice(); renderPlano(); } return; }
  if (t.dataset.rodadaBloco) { rodadaDoBloco(t.dataset.rodadaBloco, t.dataset.dia); return; }
  if (t.dataset.abrirQ) { var q = Q_BY[t.dataset.abrirQ]; var lista = filtrarQuestoes().map(function (x) { return x.id; }); var i = lista.indexOf(q.id); QS = { ids: lista.slice(0, 200), i: Math.max(0, i), sel: null, titulo: 'Banco de questões' }; renderSessao(); return; }
  if (t.dataset.alt != null && QS) { QS.sel = Number(t.dataset.alt); renderSessao(); return; }
  if (t.dataset.snaprest != null) { var s = SG.lista().find(function (x) { return String(x.__i) === t.dataset.snaprest; }); if (!s) { toast('Cópia não encontrada'); return; } var r = SG.unir(s); if (r.erro) { toast(r.erro); return; } var bn = document.querySelector('.sg-banner'); if (bn) bn.remove(); toast('Restauradas ' + r.add + ' respostas · total de ' + r.total); render(); return; }
  var act = t.dataset.act; if (!act) return;
  if (act === 'rail') { $('#cock').classList.toggle('mostra-rail'); return; }
  if (act === 'gerar') { lerFormPlano(); ST.cfg.anchor = null; ST.cfg.cfgEm = Date.now(); ST.planoFeito = true; salvar(); gerarPlano(); SG.snapshot('manual'); toast('Plano montado'); mostrar('hoje'); return; }
  if (act === 'replanejar') { lerFormPlano(); ST.cfg.anchor = hojeISO(); ST.cfg.cfgEm = Date.now(); salvar(); gerarPlano(); toast('Plano refeito a partir de hoje — o que você marcou continua marcado'); mostrar('hoje'); return; }
  if (act === 'padroes') { var nome = ST.cfg.nome; ST.cfg = cfgPadrao(); ST.cfg.nome = nome; renderPlano(); return; }
  if (act === 'rodada-filtro') { var ids = montarRodada(function (q) { return filtrarQuestoes().indexOf(q) >= 0; }, 10).map(function (q) { return q.id; }); iniciarSessao(ids, 'Rodada · ' + (FILTRO.tema && TEMA_BY[FILTRO.tema] ? TEMA_BY[FILTRO.tema].nome.slice(0, 60) : FILTRO.disc ? DISC_BY[FILTRO.disc].nome : 'banco completo')); return; }
  if (act === 'carregar-tudo') { toast('Carregando todas as disciplinas…'); carregarTudo(function () { renderBanco(); toast('Banco completo carregado'); }); return; }
  if (act === 'limpar-filtro') { FILTRO = { disc: null, tema: null, sub: null, status: 'todas', busca: '' }; renderBanco(); renderRailEsq(); return; }
  if (act === 'ir-erros') { FILTRO.status = 'erradas'; FILTRO.tema = null; QS = null; mostrar('banco'); return; }
  if (act === 'voltar-banco') { QS = null; renderBanco(); return; }
  if (act === 'confirmar' && QS) { var q2 = Q_BY[QS.ids[QS.i]]; if (QS.sel == null) return; QST.resp[q2.id] = QS.sel; QST.rev[q2.id] = q2.rev || 0; QST.fp[q2.id] = impressaoAltPar(q2.alternativas[QS.sel]); delete QST.rever[q2.id]; if (QST.del[q2.id] != null) { delete QST.del[q2.id]; QST.rev_del = QST.rev_del || {}; QST.rev_del[q2.id] = Date.now(); } QST.meta[q2.id] = { d: q2.disc, t: q2.tema };
    (QST.hist[q2.id] = QST.hist[q2.id] || []).push([Date.now(), QS.sel === q2.correta ? 1 : 0]); salvarQ(); SG.snapshot('resposta');
    if (QS.origem && PLANO) { var feitas = QS.ids.filter(function (id) { return QST.resp[id] != null; }).length; if (feitas >= QS.ids.length) { ST.done[QS.origem.tid] = 1; salvar(); } }
    QS.sel = null; renderSessao(); renderRailEsq(); renderRailDir(); return; }
  if (act === 'proxima' && QS) { QS.i = Math.min(QS.ids.length - 1, QS.i + 1); QS.sel = null; renderSessao(); window.scrollTo({ top: 0 }); return; }
  if (act === 'anterior' && QS) { QS.i = Math.max(0, QS.i - 1); QS.sel = null; renderSessao(); window.scrollTo({ top: 0 }); return; }
  if (act === 'refazer-q' && QS) { SG.snapshot('manual'); var id = QS.ids[QS.i]; delete QST.resp[id]; delete QST.fp[id]; delete QST.rever[id]; QST.del[id] = Date.now(); salvarQ(); QS.sel = null; renderSessao(); return; }
  if (act === 'zerar-rodada' && QS) { SG.snapshot('manual'); QS.ids.forEach(function (id) { delete QST.resp[id]; delete QST.fp[id]; delete QST.rever[id]; QST.del[id] = Date.now(); }); salvarQ(); QS.i = 0; QS.sel = null; renderSessao(); return; }
  if (act === 'marcar' && QS) { var id3 = QS.ids[QS.i]; if (QST.marc[id3]) delete QST.marc[id3]; else QST.marc[id3] = 1; salvarQ(); renderSessao(); return; }
  if (act === 'q-buscar') { buscarBanco(true); return; }
  if (act === 'nv-ativar') { var ne = $('#nv-email'), nc = $('#nv-codigo'); NUVEM.ativar(ne ? ne.value : '', nc ? nc.value : '').then(function (ok) { if (ok) renderProg(); }); return; }
  if (act === 'nv-agora') { NUVEM.sincronizar(true); return; }
  if (act === 'nv-desligar') { NUVEM.esquecer(); toast('Nuvem desligada neste aparelho — o progresso segue salvo aqui'); renderProg(); renderTopo(); return; }
  if (act === 'sg-baixar') { toast(SG.baixar() ? 'Backup baixado' : 'Não foi possível gerar o arquivo'); return; }
  if (act === 'sg-agora') { toast(SG.snapshot('manual') ? 'Cópia de segurança criada' : 'Não foi possível criar a cópia'); renderProg(); return; }
  if (act === 'sg-copiar') { var el = $('#sg-codigo'); if (!el) return; el.value = SG.codigo(); el.focus(); el.select(); if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(el.value).then(function () { toast('Código copiado'); }).catch(function () { toast('O código está selecionado: use Ctrl+C'); }); } else toast('O código está selecionado: use Ctrl+C'); return; }
  if (act === 'sg-colar') { var el2 = $('#sg-codigo'); if (!el2 || !el2.value.trim()) { toast('Cole o código no campo'); return; } var r2 = SG.unir(el2.value.trim()); if (r2.erro) { toast(r2.erro); return; } toast('Restauradas ' + r2.add + ' respostas · total de ' + r2.total); render(); return; }
  if (act === 'sg-fechar') { var b2 = t.closest('.sg-banner,.sg-aviso'); if (b2) b2.remove(); return; }
  if (act === 'zerar') { if (!confirm('Apagar plano, progresso e respostas deste navegador?')) return; SG.snapshot('manual'); ST = estadoInicial(); QST = { resp: {}, rev: {}, fp: {}, rever: {}, marc: {}, hist: {}, del: {}, meta: {}, rev_del: {} }; PLANO = null; salvar(); salvarQ(); mostrar('plano'); return; }
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.dataset.key) { var o1 = Number(t.dataset.o1 || 1); if (t.checked) ST.done[t.dataset.key] = Math.max(ST.done[t.dataset.key] || 0, o1); else delete ST.done[t.dataset.key]; salvar(); var blk = t.closest('.blk'); if (blk) blk.classList.toggle('done', t.checked); renderTopo(); renderRailDir(); return; }
  if (t.id === 'f-status') { FILTRO.status = t.value; renderBanco(); return; }
  if (t.id === 'diag-disc') { FILTRO.disc = t.value; renderDiag(); renderRailEsq(); return; }
  if (t.id === 'sg-import') { var f = t.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { var r = SG.unir(rd.result); if (r.erro) { toast(r.erro); return; } toast('Restauradas ' + r.add + ' respostas · total de ' + r.total); render(); }; rd.readAsText(f); t.value = ''; return; }
});
document.addEventListener('input', function (e) { if (e.target.id === 'f-busca') { FILTRO.busca = e.target.value; clearTimeout(window.__bt); window.__bt = setTimeout(renderBanco, 250); } });
document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('dom')) e.target.click(); });

/* tema claro/escuro — claro por padrão */
(function () { var raiz = document.documentElement, bt = $('#tema');
  try { var s = localStorage.getItem('bv-tema'); if (s === 'dark') raiz.setAttribute('data-theme', 'dark'); } catch (e) {}
  function rot() { bt.textContent = raiz.getAttribute('data-theme') === 'dark' ? 'Tema claro' : 'Tema escuro'; } rot();
  bt.addEventListener('click', function () { var n = raiz.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; if (n === 'dark') raiz.setAttribute('data-theme', 'dark'); else raiz.removeAttribute('data-theme'); try { localStorage.setItem('bv-tema', n); } catch (e) {} rot(); }); })();

/* ===================== PARTIDA ===================== */
carregar();
try { reconciliarRespostas(); } catch (e) {}
if (ST.planoFeito) gerarPlano();
mostrar(ST.planoFeito ? 'hoje' : 'plano');
SG.iniciar();
ofertaResgate();
NUVEM.iniciar();
setTimeout(function () { buscarBanco(false); var dh = diaHoje(); if (dh) dh.blocks.forEach(function (b) { if (b.type === 'q' && b.disc) carregarDisc(b.disc); }); }, 600);
</script>
</body>
</html>
