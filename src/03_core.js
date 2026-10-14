'use strict';
/* ===================== CONFIGURAÇÃO ===================== */
var CONFIG = {
  versaoPortal: '2026.10.14-cockpit-v0.1',
  banco: { url: 'banco.json' },          /* atualização remota do banco (mesma versão = nada a fazer) */
  sync: { url: '', intervalo: 300000, portal: 'preparacao' }
};
if (typeof CONFIG_REMOTA !== 'undefined' && CONFIG_REMOTA) { if (CONFIG_REMOTA.sync) Object.assign(CONFIG.sync, CONFIG_REMOTA.sync); }
var KEY_ST = 'bv-prep-estado-v1', KEY_Q = 'bv-prep-respostas-v1', KEY_SNAP = 'bv-prep-snap-', KEY_SNAP_I = 'bv-prep-snap-idx', N_SNAP = 5, SNAP_MS = 5 * 60 * 1000;

/* ===================== ARMAZENAMENTO (nunca silencioso) ===================== */
var mem = {}, FALHA_GRAVACAO = false;
var store = {
  get: function (k) { try { var v = localStorage.getItem(k); return v == null ? (mem[k] == null ? null : mem[k]) : v; } catch (e) { return mem[k] == null ? null : mem[k]; } },
  set: function (k, v) { mem[k] = v; try { localStorage.setItem(k, v); return true; } catch (e) { FALHA_GRAVACAO = true; try { avisoGravacao(); } catch (_) {} return false; } },
  del: function (k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) {} }
};

/* ===================== UTILITÁRIOS DE TELA ===================== */
function $(s) { return document.querySelector(s); }
function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function hojeISO() { var t = new Date(); t.setHours(0, 0, 0, 0); return toISO(t); }
function fmtL(iso) { var d = fromISO(iso); return DOWFULL[d.getDay()] + ', ' + d.getDate() + ' de ' + ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][d.getMonth()]; }
function fmtDH(iso) { try { var d = new Date(iso); var p = function (n) { return ('0' + n).slice(-2); }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' às ' + p(d.getHours()) + 'h' + p(d.getMinutes()); } catch (e) { return String(iso || ''); } }
var toastT;
function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2600); }

/* ===================== TAXONOMIA ===================== */
var DISCS = TAXONOMIA.disciplinas, TEMAS = TAXONOMIA.temas;
var DISC_BY = {}, TEMA_BY = {};
DISCS.forEach(function (d) { DISC_BY[d.id] = d; });
TEMAS.forEach(function (t) { TEMA_BY[t.id] = t; });
function temasDa(disc) { return TEMAS.filter(function (t) { return t.disc === disc; }); }

/* ===================== BANCO DE QUESTÕES (carregado por disciplina, sob demanda) ===================== */
var QUESTOES = [], Q_BY = {}, BANCO_VER = BANCO_INDEX.versao, CARREGADOS = {}, CARREGANDO = {}, BANCO_BASE = 'dados/banco/';
function indexarBanco() { Q_BY = {}; QUESTOES.forEach(function (q) { Q_BY[q.id] = q; }); }
function verNum(v) { var m = String(v || '').match(/(\d{4})[.\-_](\d{2})[.\-_](\d{2})/); return m ? Number(m[1] + m[2] + m[3]) : 0; }
function nBancoDisc(d) { var x = BANCO_INDEX.discs[d]; return x ? x.n : 0; }
function nBancoTema(t) { return BANCO_INDEX.temas[t] || 0; }
function carregarDisc(disc, cb, forcar) {
  if (!disc || !BANCO_INDEX.discs[disc]) { if (cb) cb(false); return; }
  if (CARREGADOS[disc] && !forcar) { if (cb) cb(true); return; }
  if (CARREGANDO[disc]) { CARREGANDO[disc].push(cb); return; }
  CARREGANDO[disc] = [cb];
  fetch(BANCO_BASE + BANCO_INDEX.discs[disc].arquivo, { cache: forcar ? 'no-cache' : 'default' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (p) {
    var qs = Array.isArray(p) ? p : p.questoes;
    QUESTOES = QUESTOES.filter(function (q) { return q.disc !== disc; }).concat(qs.filter(function (q) { return q && q.id && Array.isArray(q.alternativas) && q.alternativas.length >= 2; }));
    indexarBanco(); CARREGADOS[disc] = true; try { reconciliarRespostas(); } catch (e) {}
    var fila = CARREGANDO[disc]; delete CARREGANDO[disc]; fila.forEach(function (f) { if (f) f(true); });
  }).catch(function () { var fila = CARREGANDO[disc]; delete CARREGANDO[disc]; toast('Não consegui carregar as questões de ' + (DISC_BY[disc] ? DISC_BY[disc].nome : disc)); fila.forEach(function (f) { if (f) f(false); }); });
}
function carregarTudo(cb) { var ids = Object.keys(BANCO_INDEX.discs).filter(function (d) { return BANCO_INDEX.discs[d].n > 0; }), falta = ids.length; if (!falta) { cb(); return; }
  ids.forEach(function (d) { carregarDisc(d, function () { if (--falta === 0) cb(); }); }); }
/* atualização: o índice remoto diz a versão; se for mais nova, as disciplinas já carregadas são recarregadas */
function buscarBanco(manual) {
  fetch(BANCO_BASE + 'index.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (ix) {
    if (!ix || !ix.versao || ix.versao === BANCO_VER) { if (manual) toast('O banco já está na versão mais recente'); return; }
    if (!(verNum(ix.versao) >= verNum(BANCO_VER))) { if (manual) toast('O índice publicado é mais antigo que o deste portal'); return; }
    BANCO_INDEX = ix; BANCO_VER = ix.versao; var ja = Object.keys(CARREGADOS), falta = ja.length;
    if (!falta) { render(); toast('Banco de questões atualizado'); return; }
    ja.forEach(function (d) { carregarDisc(d, function () { if (--falta === 0) { render(); toast('Banco de questões atualizado'); } }, true); });
  }).catch(function () { if (manual) toast('Não consegui verificar o banco agora'); });
}

/* ===================== ESTADO ===================== */
function cfgPadrao() {
  var hoje = hojeISO(), prova = toISO(addMonths(fromISO(hoje), 12));
  var disc = {}; DISCS.forEach(function (d) { disc[d.id] = 1; });
  return { startDate: hoje, examDate: prova, hours: [0, 2, 2, 2, 2, 2, 4], level: 1, qmin: 45, smin: 240, pmin: 90, rfw: 0,
           incR: true, incP: false, incN: false, uf: '', arts: 1000, aph: 25, revx: 3, disc: disc, overrides: {}, base: {}, anchor: null, nome: '' };
}
function estadoInicial() { return { cfg: cfgPadrao(), done: {}, verConteudo: TAXONOMIA.versao, criado: new Date().toISOString(), planoFeito: false }; }
var ST = estadoInicial(), PLANO = null;
function carregar() { try { var r = store.get(KEY_ST); if (r) { var s = JSON.parse(r); ST = Object.assign(estadoInicial(), s); ST.cfg = Object.assign(cfgPadrao(), s.cfg || {}); ST.cfg.disc = Object.assign(cfgPadrao().disc, (s.cfg || {}).disc || {}); ST.done = s.done || {}; } } catch (e) { ST = estadoInicial(); } }
function salvar() { return store.set(KEY_ST, JSON.stringify(ST)); }
function gerarPlano() { try { PLANO = generate(ST.cfg); } catch (e) { PLANO = null; console.error(e); } return PLANO; }

/* respostas: resp (índice), fp (impressão da alternativa), rever (sinalização), marc (marcadas), hist (histórico), del (refazer) */
function carregarQ() { var o = { resp: {}, rev: {}, fp: {}, rever: {}, marc: {}, hist: {}, del: {}, meta: {}, rev_del: {} };
  try { var r = store.get(KEY_Q); if (r) { var s = JSON.parse(r); Object.keys(o).forEach(function (k) { o[k] = s[k] || {}; }); } } catch (e) {} return o; }
var QST = carregarQ();
function salvarQ() { return store.set(KEY_Q, JSON.stringify(QST)); }

/* ===================== IMPRESSÃO DIGITAL E RECONCILIAÇÃO (nunca apaga) ===================== */
function normAlt(t) { return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/<[^>]*>/g, ' ').replace(/[^0-9a-zA-Z]+/g, ' ').trim().toLowerCase(); }
function fnv(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
function impressaoAltPar(a) { if (a == null) return ''; var t = (typeof a === 'string') ? a : (a.t || ''), c = (typeof a === 'string') ? '' : (a.c || ''); return fnv(normAlt(c)) + ':' + fnv(normAlt(t)); }
function casaPar(p, a) { if (!p) return false; var n = impressaoAltPar(a), x = String(p).split(':'), y = n.split(':'); return (!!x[0] && x[0] === y[0]) || (!!x[1] && x[1] === y[1]); }
function reconciliarRespostas() {
  var mud = 0;
  QUESTOES.forEach(function (q) {
    var i = QST.resp[q.id]; if (i == null) return;
    var alts = q.alternativas || [], fp = QST.fp[q.id];
    if (!fp) { if (alts[i] != null) { QST.fp[q.id] = impressaoAltPar(alts[i]); mud++; } else { QST.rever[q.id] = 1; mud++; } return; }
    if (alts[i] != null && casaPar(fp, alts[i])) { if (QST.rever[q.id]) { delete QST.rever[q.id]; mud++; } return; }
    var k = -1; for (var x = 0; x < alts.length; x++) if (casaPar(fp, alts[x])) { k = x; break; }
    if (k >= 0) { QST.resp[q.id] = k; delete QST.rever[q.id]; } else { QST.rever[q.id] = 1; } mud++;
  });
  if (mud) salvarQ();
}

/* ===================== DOMÍNIO POR TEMA E DISCIPLINA (independe do banco carregado) ===================== */
function statusQ(id) { var i = QST.resp[id]; if (i == null) return null; var q = Q_BY[id]; if (q) return i === q.correta;
  var h = QST.hist[id]; if (h && h.length) return !!h[h.length - 1][1]; return null; }
function dominioPor(campo, valor) {
  var ac = 0, n = 0;
  Object.keys(QST.resp).forEach(function (id) { var m = QST.meta[id] || (Q_BY[id] ? { d: Q_BY[id].disc, t: Q_BY[id].tema } : null); if (!m || m[campo] !== valor) return; var s = statusQ(id); if (s == null) return; n++; if (s) ac++; });
  return { n: n, ac: ac, pct: n ? Math.round(100 * ac / n) : null };
}
function dominioTema(tid) { var d = dominioPor('t', tid); d.tot = nBancoTema(tid); return d; }
function dominioDisc(did) { var d = dominioPor('d', did); d.tot = nBancoDisc(did); return d; }
function nivelHeat(pct) { if (pct == null) return 1; return pct < 40 ? 2 : pct < 60 ? 3 : pct < 80 ? 4 : 5; }

/* ===================== RODADAS ===================== */
/* escolhe até n questões de um tema (ou de uma disciplina): primeiro as não feitas, depois as erradas, depois as demais */
function montarRodada(filtro, n) {
  var pool = QUESTOES.filter(filtro);
  var naoFeitas = pool.filter(function (q) { return QST.resp[q.id] == null; });
  var erradas = pool.filter(function (q) { return statusQ(q.id) === false; });
  var certas = pool.filter(function (q) { return statusQ(q.id) === true; });
  var out = naoFeitas.concat(erradas, certas).slice(0, n);
  return out;
}
