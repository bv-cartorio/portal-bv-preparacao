/* ===================== SALVAGUARDA DO PROGRESSO ===================== */
var SG = (function () {
  var ultima = '', ultimoSnap = 0;
  function lerLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function escLS(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function nResp() { return Object.keys(QST.resp || {}).length; }
  function snapshot(motivo) {
    var ag = Date.now(); if (motivo === 'resposta' && ag - ultimoSnap < 60000) return null;
    var plano, resp; try { plano = JSON.stringify(ST); resp = JSON.stringify(QST); } catch (e) { return null; }
    var n = nResp(), assin = plano.length + ':' + resp.length + ':' + n;
    if (assin === ultima && motivo !== 'manual') return null;
    var i = parseInt(lerLS(KEY_SNAP_I) || '0', 10); if (!(i >= 0 && i < N_SNAP)) i = 0;
    var ok = escLS(KEY_SNAP + i, JSON.stringify({ v: 1, em: new Date().toISOString(), motivo: motivo || 'auto', n: n, plano: plano, resp: resp }));
    if (!ok) { try { avisoGravacao(); } catch (e) {} return null; }
    escLS(KEY_SNAP_I, String((i + 1) % N_SNAP)); ultima = assin; ultimoSnap = ag; return { i: i, n: n };
  }
  function lista() { var out = []; for (var i = 0; i < N_SNAP; i++) { var b = lerLS(KEY_SNAP + i); if (!b) continue; try { var o = JSON.parse(b); if (o && o.v === 1) { o.__i = i; out.push(o); } } catch (e) {} }
    out.sort(function (a, b) { return String(b.em || '').localeCompare(String(a.em || '')); }); return out; }
  function melhor() { var m = null; lista().forEach(function (s) { if (!m || (s.n || 0) > (m.n || 0)) m = s; }); return m; }
  function pacote() { return { portal: 'BV Preparação', v: 1, em: new Date().toISOString(), n: nResp(), plano: JSON.stringify(ST), resp: JSON.stringify(QST) }; }
  function baixar() { try { var b = new Blob([JSON.stringify(pacote())], { type: 'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'progresso-bv-preparacao-' + hojeISO() + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); return true; } catch (e) { return false; } }
  function codigo() { try { return btoa(unescape(encodeURIComponent(JSON.stringify(pacote())))); } catch (e) { return ''; } }
  function unir(pac) {
    var o = pac;
    if (typeof o === 'string') { var t = o.trim(); try { o = JSON.parse(t); } catch (e) { try { o = JSON.parse(decodeURIComponent(escape(atob(t.replace(/\s+/g, ''))))); } catch (e2) { return { erro: 'Arquivo ou código inválido' }; } } }
    if (!o || typeof o !== 'object') return { erro: 'Backup sem conteúdo reconhecível' };
    snapshot('manual');
    var vq = o.resp, vp = o.plano;
    if (typeof vq === 'string') { try { vq = JSON.parse(vq); } catch (e) { vq = null; } }
    if (typeof vp === 'string') { try { vp = JSON.parse(vp); } catch (e) { vp = null; } }
    var add = 0;
    if (vq && typeof vq === 'object') {
      ['resp', 'rev', 'fp', 'rever', 'marc', 'hist', 'del', 'meta', 'rev_del'].forEach(function (c) { var v = vq[c]; if (!v || typeof v !== 'object') return; QST[c] = QST[c] || {};
        Object.keys(v).forEach(function (id) { if (c === 'resp' && QST.resp[id] == null) add++; QST[c][id] = v[id]; }); });
      salvarQ();
    }
    if (vp && typeof vp === 'object') {
      if (!ST.planoFeito && vp.cfg) { ST.cfg = Object.assign(cfgPadrao(), vp.cfg); ST.planoFeito = !!vp.planoFeito; }
      if (vp.done) Object.keys(vp.done).forEach(function (k) { ST.done[k] = vp.done[k]; });
      salvar(); if (ST.planoFeito) gerarPlano();
    }
    try { reconciliarRespostas(); } catch (e) {}
    return { add: add, total: nResp() };
  }
  function iniciar() {
    snapshot('abertura'); setInterval(function () { snapshot('auto'); }, SNAP_MS);
    try { document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') snapshot('saida'); }); window.addEventListener('beforeunload', function () { snapshot('saida'); }); } catch (e) {}
  }
  return { snapshot: snapshot, lista: lista, melhor: melhor, baixar: baixar, codigo: codigo, unir: unir, iniciar: iniciar, nResp: nResp };
})();
function avisoGravacao() {
  if (document.querySelector('.sg-aviso')) return;
  var d = document.createElement('div'); d.className = 'sg-aviso'; d.setAttribute('role', 'status');
  d.innerHTML = '<div>Este navegador não está conseguindo gravar o seu progresso. Baixe o backup na aba <b>Progresso</b>.</div><button class="btn g sm" data-act="sg-fechar" style="color:#fff;border-color:rgba(255,255,255,.5)">fechar</button>';
  document.body.appendChild(d);
}
function ofertaResgate() {
  try { var m = SG.melhor(); if (!m) return; var atual = SG.nResp(); if ((m.n || 0) <= atual) return;
    var d = document.createElement('div'); d.className = 'sg-banner';
    d.innerHTML = '<div><b>Há uma cópia de segurança com ' + m.n + ' respostas</b><span>Este navegador tem ' + atual + ' agora. A cópia é de ' + fmtDH(m.em) + '.</span></div><div class="lin"><button class="btn p sm" data-snaprest="' + m.__i + '">Restaurar</button><button class="btn g sm" data-act="sg-fechar" style="color:#fff;border-color:rgba(255,255,255,.5)">Depois</button></div>';
    document.body.appendChild(d); } catch (e) {}
}
