/*****************************************************************
 *  PROGRESSO EM NUVEM — BV Cartórios (um script para os dois portais)
 *  O campo "portal" da requisição escolhe a planilha e a pasta:
 *    "preparacao" → Portal BV Preparação
 *    "enac4"      → Portal ENAC 4 (padrão quando o campo não vem)
 *  Planilha = painel · Drive = um arquivo .json por aluno
 *
 *  Regras: toda gravação é UNIÃO (a nuvem nunca diminui); só sai a
 *  questão que o aluno mandou refazer (lista "apagadas"), e responder
 *  de novo desfaz a exclusão ("revividas"). O código identifica, não
 *  protege: aqui só há marcações de questões e de metas.
 *****************************************************************/

var PORTAIS = {
  preparacao: { planilha: '1dM81xXmgFQAWj9HupYt9BjDrShz2Ed0gRnZN1BGllt0', pasta: '1tmQhYpWVXCzVqsuDWeEIB6CWGJB0is0Q' },
  enac4:      { planilha: '18VebBOs6bBVJdW36-T-cqzQ1cTZJJ71IzYiTq6xd6PA', pasta: '1b8Lzq7nm34_C5IZLC2JBcQ21T3F5GsSg' }
};
var MAPAS = ['resp', 'rev', 'fp', 'rever', 'marc', 'meta'];   /* campos id → valor, unidos chave a chave */

function doGet(e)  { return responder(processar((e && e.parameter) || {})); }
function doPost(e) { var corpo = {}; try { corpo = JSON.parse(e.postData.contents); } catch (err) { corpo = (e && e.parameter) || {}; } return responder(processar(corpo)); }
function responder(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function norm(s)  { return String(s == null ? '' : s).trim(); }
function slug(em) { return norm(em).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
function contar(o) { return o ? Object.keys(o).length : 0; }

function processar(req) {
  var P = PORTAIS[norm(req.portal) || 'enac4']; if (!P) return { ok: false, erro: 'portal_desconhecido' };
  var email = norm(req.email).toLowerCase(), codigo = norm(req.codigo).toUpperCase();
  if (!email || email.indexOf('@') < 1) return { ok: false, erro: 'email_invalido' };
  if (codigo.length < 4) return { ok: false, erro: 'codigo_curto' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (e) { return { ok: false, erro: 'ocupado' }; }
  try {
    var pl = SpreadsheetApp.openById(P.planilha), ab = pl.getSheetByName('alunos');
    var linha = acharLinha(ab, email);
    if (linha && norm(ab.getRange(linha, 2).getValue()).toUpperCase() !== codigo) return { ok: false, erro: 'codigo_nao_confere' };
    var guardado = lerArquivo(P, email);
    if (req.acao === 'carregar') return { ok: true, acao: 'carregar', achou: !!guardado, dados: guardado };
    var uniao = unir(guardado, req.dados || {}), acrescentadas = uniao.__acrescentadas; delete uniao.__acrescentadas;
    gravarArquivo(P, email, uniao);
    var st = uniao.stats || {}, agora = new Date(), nResp = contar(uniao.resp);
    var fila = [email, codigo, norm(req.nome) || (guardado && guardado.nome) || '', st.modelo || '', st.inicio || '',
                (uniao.done ? (Array.isArray(uniao.done) ? uniao.done.length : contar(uniao.done)) : 0), nResp,
                st.certas || 0, st.erradas || 0, nResp ? ((st.certas || 0) / nResp) : 0, agora, slug(email) + '.json'];
    if (linha) ab.getRange(linha, 1, 1, fila.length).setValues([fila]); else ab.appendRow(fila);
    pl.getSheetByName('historico').appendRow([agora, email, 'sincronizar', fila[5], nResp, st.certas || 0, acrescentadas, norm(req.origem)]);
    return { ok: true, acao: 'salvar', dados: uniao, acrescentadas: acrescentadas };
  } catch (err) { return { ok: false, erro: 'falha', detalhe: String(err) }; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

function acharLinha(ab, email) { var n = ab.getLastRow(); if (n < 2) return 0; var col = ab.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) if (norm(col[i][0]).toLowerCase() === email) return i + 2; return 0; }
function pasta(P) { return DriveApp.getFolderById(P.pasta); }
function lerArquivo(P, email) { var it = pasta(P).getFilesByName(slug(email) + '.json'); if (!it.hasNext()) return null;
  try { return JSON.parse(it.next().getBlob().getDataAsString('UTF-8')); } catch (e) { return null; } }
function gravarArquivo(P, email, obj) { var nome = slug(email) + '.json', txt = JSON.stringify(obj), it = pasta(P).getFilesByName(nome);
  if (it.hasNext()) it.next().setContent(txt); else pasta(P).createFile(nome, txt, MimeType.PLAIN_TEXT); }

/* união: acrescenta e atualiza; só retira o que o aluno mandou refazer */
function unir(a, b) {
  a = a || {}; b = b || {};
  var aj = (b.ajustes && (!a.ajustes || (Number(b.ajustes.cfgEm) || 0) >= (Number(a.ajustes.cfgEm) || 0))) ? b.ajustes : (a.ajustes || b.ajustes || null);
  var out = { v: 2, nome: norm(b.nome) || a.nome || '', ajustes: aj, bancoVer: b.bancoVer || a.bancoVer || '',
              stats: b.stats || a.stats || {}, em: new Date().toISOString() };
  /* done: aceita lista (ENAC 4) ou mapa (Preparação) */
  if (Array.isArray(a.done) || Array.isArray(b.done)) { var d = {}; (a.done || []).forEach(function (k) { d[k] = 1; }); (b.done || []).forEach(function (k) { d[k] = 1; }); out.done = Object.keys(d); }
  else { out.done = {}; [a.done || {}, b.done || {}].forEach(function (m) { Object.keys(m).forEach(function (k) { out.done[k] = Math.max(out.done[k] || 0, Number(m[k]) || 1); }); }); }
  MAPAS.forEach(function (c) { var m = {}, A = a[c] || {}, B = b[c] || {}; Object.keys(A).forEach(function (k) { m[k] = A[k]; }); Object.keys(B).forEach(function (k) { m[k] = B[k]; }); out[c] = m; });
  /* histórico de respostas: concatena sem repetir a mesma marca de tempo */
  out.hist = {}; [a.hist || {}, b.hist || {}].forEach(function (h) { Object.keys(h).forEach(function (id) { var L = out.hist[id] || []; var vistos = {}; L.forEach(function (x) { vistos[x[0]] = 1; });
    (h[id] || []).forEach(function (x) { if (!vistos[x[0]]) { L.push(x); vistos[x[0]] = 1; } }); L.sort(function (x, y) { return x[0] - y[0]; }); out.hist[id] = L.slice(-50); }); });
  var apagadas = {}, revividas = {};
  [a.apagadas || {}, b.apagadas || {}].forEach(function (m) { Object.keys(m).forEach(function (id) { if (!apagadas[id] || m[id] > apagadas[id]) apagadas[id] = m[id]; }); });
  [a.revividas || {}, b.revividas || {}].forEach(function (m) { Object.keys(m).forEach(function (id) { if (!revividas[id] || m[id] > revividas[id]) revividas[id] = m[id]; }); });
  Object.keys(apagadas).forEach(function (id) { if (revividas[id] && revividas[id] >= apagadas[id]) { delete apagadas[id]; return; }
    MAPAS.forEach(function (c) { delete out[c][id]; }); });
  out.apagadas = apagadas; out.revividas = revividas;
  out.__acrescentadas = contar(out.resp) - contar(a.resp);
  return out;
}
