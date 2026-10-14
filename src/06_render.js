/* ===================== RENDERIZAÇÃO ===================== */
var VIEW = 'hoje', SEM_OFF = 0, FILTRO = { disc: null, tema: null, sub: null, status: 'todas', busca: '' }, QS = null;
var TIPO_TAG = { e: ['e', 'Leitura'], q: ['q', 'Questões'], v: ['v', 'Revisão'], s: ['s', 'Simulado'], p: ['p', '2ª fase'], n: ['n', 'Normas'] };
var FASE_COR = { c1: 'var(--seq4)', c2: 'var(--seq3)', c3: 'var(--seq2)', c4: 'var(--seq2)', rf: 'var(--laranja)' };

function isDone(b) { return (ST.done[b.tid] || 0) >= b.o1 - 1e-6; }
function diaHoje() { if (!PLANO) return null; var h = hojeISO(); var d = PLANO.days.find(function (x) { return x.iso === h; }); if (d) return d; return PLANO.days.find(function (x) { return x.iso > h; }) || null; }
function faseAtual() { if (!PLANO) return null; var h = fromISO(hojeISO()); var f = PLANO.phases.find(function (p) { return h >= p.from && h <= p.to; }); return f || PLANO.phases[0] || null; }
function diasParaProva() { return Math.max(0, dayDiff(fromISO(ST.cfg.examDate), fromISO(hojeISO()))); }
function progressoPlano() { if (!PLANO) return 0; var t = 0, f = 0; PLANO.days.forEach(function (d) { d.blocks.forEach(function (b) { t += b.min; if (isDone(b)) f += b.min; }); }); return t ? Math.round(100 * f / t) : 0; }

function render() { renderTopo(); renderRailEsq(); renderRailDir();
  if (VIEW === 'hoje') renderHoje(); else if (VIEW === 'semana') renderSemana(); else if (VIEW === 'plano') renderPlano();
  else if (VIEW === 'banco') renderBanco(); else if (VIEW === 'diag') renderDiag(); else if (VIEW === 'prog') renderProg();
  $('#rodape-ver').textContent = 'Portal ' + CONFIG.versaoPortal + ' · banco ' + BANCO_VER + ' · ' + BANCO_INDEX.total + ' questões · conteúdo ' + TAXONOMIA.versao; }
function mostrar(v) { VIEW = v; $$('main .pane').forEach(function (s) { s.classList.remove('on'); }); $('#v-' + v).classList.add('on');
  $$('#abas [data-v]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.v === v)); }); render(); window.scrollTo({ top: 0 }); }

function renderTopo() {
  var f = faseAtual(), n = diasParaProva();
  $('#topo-st').innerHTML = (ST.planoFeito ? '<span>' + esc(f ? f.name : '') + '</span><span><b class="num">' + n + '</b> dias para a prova</span><span>Plano <b>' + progressoPlano() + '%</b></span>' : '<span>Monte o seu plano na aba <b>Plano</b></span>') + (ST.cfg.nome ? '<span>' + esc(ST.cfg.nome) + '</span>' : '') + (typeof NUVEM !== 'undefined' && NUVEM.ligado() ? '<span title="nuvem">☁ ' + esc(NUVEM.situacao().estado) + '</span>' : '');
}

function renderRailEsq() {
  var h = '<h5>Disciplinas e domínio</h5>', grupos = {};
  DISCS.forEach(function (d) { (grupos[d.grupo] = grupos[d.grupo] || []).push(d); });
  Object.keys(grupos).forEach(function (g) {
    h += '<div class="grupo">' + esc(g) + '</div>';
    grupos[g].forEach(function (d) {
      var dm = dominioDisc(d.id), fator = ST.cfg.disc[d.id], fora = fator === 0, nT = temasDa(d.id).length;
      h += '<div class="dom' + (FILTRO.disc === d.id && VIEW === 'banco' ? ' sel' : '') + (fora ? ' fora' : '') + '" data-disc="' + d.id + '" role="button" tabindex="0">' +
        '<span class="n">' + esc(d.nome) + '</span><span class="v">' + (dm.pct == null ? '—' : dm.pct + '%') + '</span>' +
        '<span class="b"><i style="width:' + (dm.pct || 0) + '%"></i></span>' +
        '<span class="q">' + nT + ' temas · ' + dm.tot + ' questões' + (fora ? ' · fora do plano' : fator < 1 ? ' · leitura dinâmica' : '') + '</span></div>';
    });
  });
  h += '<p class="muted" style="font-size:11.5px;margin-top:12px">Domínio = acertos sobre as questões respondidas. Toque numa disciplina para abrir o banco.</p>';
  $('#rail-esq').innerHTML = h;
}

function renderRailDir() {
  var h = '', dia = diaHoje();
  h += '<h5>Vencendo hoje</h5>';
  var rev = dia ? dia.blocks.filter(function (b) { return b.type === 'v' && !isDone(b); }) : [];
  if (!rev.length) h += '<div class="mini vazio">Nenhuma revisão pendente para hoje.</div>';
  rev.forEach(function (b) { h += '<div class="mini"><b>' + esc(b.lbl) + '</b><span>' + esc(b.sub || '') + '</span></div>'; });
  var err = Object.keys(QST.resp).filter(function (id) { return statusQ(id) === false; }), marc = Object.keys(QST.marc || {}).length;
  h += '<h5 style="margin-top:16px">Caderno de erros</h5><div class="mini" data-act="ir-erros" style="cursor:pointer"><b>' + err.length + (err.length === 1 ? ' questão' : ' questões') + '</b><span>' + (marc ? marc + ' marcadas para revisar · ' : '') + 'toque para treinar</span></div>';
  h += '<h5 style="margin-top:16px">Próximos</h5>';
  var prox = [];
  if (PLANO) { var hj = hojeISO(); PLANO.days.forEach(function (d) { if (d.iso < hj || prox.length >= 3) return; d.blocks.forEach(function (b) { if ((b.type === 's' || b.type === 'p') && prox.length < 3) prox.push({ d: d, b: b }); }); }); }
  if (!prox.length) h += '<div class="mini vazio">Simulados e tarefas de 2ª fase aparecem aqui.</div>';
  prox.forEach(function (x) { h += '<div class="mini"><b>' + DOW[x.d.date.getDay()] + ' ' + fmtBR(x.d.date) + ' · ' + esc(TIPO_TAG[x.b.type][1]) + '</b><span>' + esc(x.b.lbl) + '</span></div>'; });
  h += '<h5 style="margin-top:16px">Atalhos</h5><div class="chips" style="margin-top:0"><a class="chip" href="https://bvcartorios.com.br" target="_blank" rel="noopener">BV Cartórios</a><button class="chip" data-act="sg-baixar">Backup</button><button class="chip" data-act="q-buscar">Atualizar banco</button></div>';
  $('#rail-dir').innerHTML = h;
}

/* ---------- blocos ---------- */
function blocoHTML(b, dia) {
  var tg = TIPO_TAG[b.type] || ['n', b.type], done = isDone(b), acao = '';
  if (b.type === 'q') acao = '<button class="btn p sm acao" data-rodada-bloco="' + esc(b.tid) + '" data-dia="' + dia.iso + '">Abrir</button>';
  var sub = b.sub || '';
  if (b.type === 'e' && b.tema && TEMA_BY[b.tema] && TEMA_BY[b.tema].ebook) { var t = TEMA_BY[b.tema]; sub = 'E-book ' + DISC_BY[t.disc].ebook + ' · p. ' + t.pi + '–' + t.pf + (b.parts ? ' · parte ' + b.part + ' de ' + b.parts : ''); }
  return '<div class="blk' + (done ? ' done' : '') + '"><input type="checkbox" data-key="' + esc(b.tid) + '" data-o1="' + b.o1 + '" ' + (done ? 'checked' : '') + ' aria-label="Concluir"><div class="t"><span class="tag ' + tg[0] + '">' + tg[1] + '</span>' + esc(b.lbl) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div><div class="m">' + fmtH(b.min) + '</div>' + acao + '</div>';
}
function diaHTML(d, hoje) {
  return '<div class="dia' + (d.iso === hoje ? ' hoje' : '') + '"><div><div class="dw">' + DOWFULL[d.date.getDay()] + (d.iso === hoje ? ' · hoje' : '') + '</div><div class="dt">' + fmtBR(d.date) + '</div><div class="cap">' + fmtH(d.cap) + (d.ovr ? ' · ajustado' : '') + '</div></div><div>' + d.blocks.map(function (b) { return blocoHTML(b, d); }).join('') + '</div></div>';
}

/* ---------- HOJE ---------- */
function renderHoje() {
  if (!ST.planoFeito || !PLANO) { $('#v-hoje').innerHTML = '<div class="cx"><div class="kick">Bem-vindo</div><h2>Comece montando o seu plano</h2><p>Escolha as disciplinas, a data da prova e as horas de cada dia. O portal distribui todo o conteúdo em ciclos de estudo, revisão e reta final, e passa a mostrar aqui, todo dia, o que fazer.</p><div class="lin" style="margin-top:12px"><button class="btn p" data-v="plano">Montar o plano</button><button class="btn g" data-v="banco">Explorar o banco de questões</button></div></div>'; return; }
  var d = diaHoje(), hj = hojeISO(), f = faseAtual(), h = '';
  h += '<div class="cx"><div class="kick">' + esc(fmtL(hj)) + (d && d.iso !== hj ? ' · próximo dia com estudo: ' + fmtBR(d.date) : '') + '</div><h2>' + (d ? (d.iso === hj ? 'Hoje: ' : 'Próximo: ') + fmtH(d.cap) + ' de estudo' : 'Plano concluído') + '</h2>';
  h += '<div class="fase">' + PLANO.phases.map(function (p) { return '<i style="width:' + Math.max(2, Math.round(100 * p.min / PLANO.totalMin)) + '%;background:' + (FASE_COR[p.key] || 'var(--seq2)') + '"></i>'; }).join('') + '</div>';
  h += '<div class="fase-l">' + PLANO.phases.map(function (p) { return '<span' + (f && p.key === f.key ? ' style="color:var(--acc-ink);font-weight:700"' : '') + '>' + esc(p.short) + (f && p.key === f.key ? ' · você está aqui' : '') + '</span>'; }).join('') + '</div></div>';
  if (d) h += '<div class="cx">' + d.blocks.map(function (b) { return blocoHTML(b, d); }).join('') + '</div>';
  if (PLANO.leftoverTasks > 0) h += '<div class="aviso" style="margin-top:12px"><span class="ic">!</span><div><b>' + PLANO.leftoverTasks + ' tarefas não cabem no prazo</b> com as horas atuais (' + fmtH(PLANO.leftoverMin) + '). Aumente a disponibilidade, use leitura dinâmica em alguma disciplina ou estenda a data-alvo na aba Plano.</div></div>';
  $('#v-hoje').innerHTML = h;
}

/* ---------- SEMANA ---------- */
function renderSemana() {
  if (!PLANO) { $('#v-semana').innerHTML = '<div class="cx"><p>Monte o plano para ver a semana.</p></div>'; return; }
  var hj = hojeISO(), seg = mondayOf(fromISO(hj)); seg = addDays(seg, SEM_OFF * 7); var dom = addDays(seg, 6);
  var dias = PLANO.days.filter(function (d) { return d.date >= seg && d.date <= dom; });
  var tot = 0, feito = 0; dias.forEach(function (d) { d.blocks.forEach(function (b) { tot += b.min; if (isDone(b)) feito += b.min; }); });
  var h = '<div class="semana-nav"><button class="btn g sm" data-sem="-1">‹ anterior</button><h2>' + fmtBR(seg) + ' a ' + fmtBR(dom) + '/' + dom.getFullYear() + ' · ' + fmtH(tot) + (tot ? ' · ' + Math.round(100 * feito / tot) + '% feito' : '') + '</h2><div class="lin"><button class="btn g sm" data-sem="0">esta semana</button><button class="btn g sm" data-sem="1">próxima ›</button></div></div>';
  h += '<div class="cx">' + (dias.length ? dias.map(function (d) { return diaHTML(d, hj); }).join('') : '<p class="muted">Nenhum estudo planejado nesta semana.</p>') + '</div>';
  $('#v-semana').innerHTML = h;
}

/* ---------- PLANO ---------- */
var PRESETS = { full: [4, 6, 6, 6, 6, 6, 4], work: [3, 2.5, 2.5, 2.5, 2.5, 2.5, 5], wknd: [6, 2, 2, 2, 2, 2, 6], leve: [3, 1, 1, 1, 1, 1, 2] };
function renderPlano() {
  var c = ST.cfg, h = '';
  var meses = Math.round(dayDiff(fromISO(c.examDate), fromISO(c.startDate)) / 30.44);
  h += '<div class="cx"><div class="kick">Passo 1</div><h2>Horizonte, disponibilidade e disciplinas</h2><p>Tudo aqui é editável. Gere o plano de novo sempre que a rotina mudar: o que você já marcou como concluído continua marcado.</p>';
  h += '<label class="f">Em quanto tempo você quer estar pronto?</label><div class="hz">' + [6, 12, 18, 24].map(function (m) { return '<button type="button" class="hzbtn' + (meses === m ? ' on' : '') + '" data-hz="' + m + '"><div class="m">' + m + '</div><div class="u">meses</div></button>'; }).join('') + '</div>';
  h += '<div class="g2"><div><label class="f" for="pl-inicio">Começar em</label><input type="date" id="pl-inicio" value="' + c.startDate + '"></div><div><label class="f" for="pl-prova">Data da prova ou data-alvo</label><input type="date" id="pl-prova" value="' + c.examDate + '"></div></div>';
  h += '<label class="f">Horas por dia da semana</label><div class="days7">' + [1, 2, 3, 4, 5, 6, 0].map(function (i) { return '<div class="daybox"><div class="d">' + DOW[i] + '</div><input type="number" min="0" max="14" step="0.5" data-h="' + i + '" value="' + (c.hours[i] || 0) + '"></div>'; }).join('') + '</div>';
  h += '<div class="presets"><button type="button" class="chip" data-preset="work">Trabalho + estudo</button><button type="button" class="chip" data-preset="full">Dedicação total</button><button type="button" class="chip" data-preset="wknd">Fim de semana reforçado</button><button type="button" class="chip" data-preset="leve">Ritmo leve</button></div>';
  var tot = c.hours.reduce(function (a, b) { return a + (b || 0); }, 0);
  h += '<p class="muted" style="font-size:13px;margin-top:8px"><b>' + tot.toLocaleString('pt-BR') + ' h por semana</b> · ' + Math.round(tot * meses * 4.348) + ' h até a data-alvo.</p>';
  h += '<div class="g2"><div><label class="f" for="pl-nivel">Seu ponto de partida</label><select id="pl-nivel"><option value="1.3"' + (c.level == 1.3 ? ' selected' : '') + '>Começando do zero (30% a mais na teoria)</option><option value="1"' + (c.level == 1 ? ' selected' : '') + '>Já tenho base</option><option value="0.75"' + (c.level == 0.75 ? ' selected' : '') + '>Avançado (25% a menos)</option></select></div><div><label class="f" for="pl-nome">Seu nome (opcional)</label><input type="text" id="pl-nome" value="' + esc(c.nome || '') + '" maxlength="60"></div></div>';
  h += '<div class="g2"><div><label class="f" for="pl-qmin">Minutos de questões por tema</label><input type="number" id="pl-qmin" value="' + c.qmin + '" min="15" max="180" step="5"></div><div><label class="f" for="pl-rfw">Reta final</label><select id="pl-rfw">' + [0, 3, 4, 6, 8, 10].map(function (w) { return '<option value="' + w + '"' + (c.rfw == w ? ' selected' : '') + '>' + (w ? w + ' semanas' : 'Automática') + '</option>'; }).join('') + '</select></div></div>';
  h += '<label class="switch"><input type="checkbox" id="pl-incR"' + (c.incR ? ' checked' : '') + '> <span>Revisão espaçada dos temas estudados (24h, 7, 30 e 90 dias)</span></label>';
  h += '<label class="switch"><input type="checkbox" id="pl-incP"' + (c.incP ? ' checked' : '') + '> <span>Trilha de 2ª fase: peças práticas e questões discursivas</span></label>';
  h += '<h3 style="margin-top:18px">Disciplinas do plano</h3><p class="muted" style="font-size:13.5px;margin-bottom:8px">Escolha, disciplina por disciplina: estudo <b>completo</b>, <b>leitura dinâmica</b> (metade do tempo) ou <b>fora do plano</b>. As questões e revisões acompanham a escolha.</p><div class="disc-grid">';
  DISCS.forEach(function (d) { var f = c.disc[d.id], hs = temasDa(d.id).reduce(function (a, t) { return a + t.h; }, 0);
    h += '<div class="disc-row' + (f === 0 ? ' cut' : f < 1 ? ' half' : '') + '"><span class="nm">' + esc(d.nome) + '</span><span class="hs">' + hs.toLocaleString('pt-BR') + ' h · ' + temasDa(d.id).length + ' temas</span><select data-disc-f="' + d.id + '"><option value="1"' + (f === 1 ? ' selected' : '') + '>Completo</option><option value="0.5"' + (f === 0.5 ? ' selected' : '') + '>Leitura dinâmica</option><option value="0"' + (f === 0 ? ' selected' : '') + '>Fora do plano</option></select></div>'; });
  h += '</div><div class="lin" style="margin-top:18px"><button class="btn p" data-act="gerar">' + (ST.planoFeito ? 'Refazer o plano' : 'Gerar meu plano') + '</button>' + (ST.planoFeito ? '<button class="btn g" data-act="replanejar">Replanejar a partir de hoje</button>' : '') + '<button class="btn g" data-act="padroes">Restaurar padrões</button></div></div>';

  if (ST.planoFeito && PLANO) {
    var v = verdictOf(PLANO), tx = v === 'ok' ? 'O plano fecha com folga.' : v === 'tight' ? 'O plano fecha, mas apertado.' : 'As horas não bastam para o conteúdo escolhido.';
    var sub = PLANO.leftoverTasks ? PLANO.leftoverTasks + ' tarefas ficam de fora (' + fmtH(PLANO.leftoverMin) + '). Aumente as horas, use leitura dinâmica ou estenda a data-alvo.' : 'Base teórica até ' + fmtBR(PLANO.c1End || PLANO.finish) + ' · ' + PLANO.nRev + ' ciclo(s) de revisão · reta final de ' + PLANO.rfW + ' semanas a partir de ' + fmtBR(PLANO.rfDate) + '.';
    h += '<div class="cx" style="margin-top:12px"><div class="kick">Passo 2</div><h2>Diagnóstico</h2><div class="verdict ' + v + '" style="margin-top:8px"><b>' + tx + '</b>' + esc(sub) + '</div>';
    h += '<div class="kpis" style="margin-top:12px"><div class="kpi"><div class="v">' + PLANO.days.length + '</div><div class="k">dias de estudo</div></div><div class="kpi"><div class="v">' + fmtHr(PLANO.totalMin) + '</div><div class="k">planejadas</div></div><div class="kpi"><div class="v">' + Math.round(PLANO.minWeekly) + 'h</div><div class="k">mínimo semanal</div></div><div class="kpi"><div class="v">' + Math.round(PLANO.idealWeekly) + 'h</div><div class="k">ideal semanal</div></div><div class="kpi"><div class="v">' + progressoPlano() + '%</div><div class="k">concluído</div></div></div>';
    h += '<h3 style="margin-top:18px">Mapa mês a mês</h3><div class="meses" style="margin-top:8px">' + mapaMeses() + '</div></div>';
  }
  $('#v-plano').innerHTML = h;
}
function mapaMeses() {
  var ms = {}, ordem = [], hj = hojeISO().slice(0, 7);
  PLANO.days.forEach(function (d) { var k = d.iso.slice(0, 7); if (!ms[k]) { ms[k] = { k: k, min: 0, feito: 0, fases: {}, discs: {} }; ordem.push(k); }
    d.blocks.forEach(function (b) { ms[k].min += b.min; if (isDone(b)) ms[k].feito += b.min; ms[k].fases[b.phase] = (ms[k].fases[b.phase] || 0) + b.min; if (b.disc && DISC_BY[b.disc]) ms[k].discs[b.disc] = (ms[k].discs[b.disc] || 0) + b.min; }); });
  return ordem.map(function (k) { var m = ms[k], fase = Object.keys(m.fases).sort(function (a, b) { return m.fases[b] - m.fases[a]; })[0];
    var top = Object.keys(m.discs).sort(function (a, b) { return m.discs[b] - m.discs[a]; }).slice(0, 3).map(function (d) { return DISC_BY[d].curto; }).join(', ');
    var dt = fromISO(k + '-01');
    return '<button type="button" class="mes' + (k === hj ? ' now' : '') + '" data-mes="' + k + '"><div class="mn">' + MESES[dt.getMonth()] + ' ' + String(dt.getFullYear()).slice(2) + '</div><div class="mf">' + esc(phaseShort(fase)) + ' · ' + fmtHr(m.min) + '<br>' + esc(top) + '</div><div class="mp"><i style="width:' + (m.min ? Math.round(100 * m.feito / m.min) : 0) + '%"></i></div></button>'; }).join('');
}
function lerFormPlano() {
  var c = ST.cfg; var g = function (id) { return $(id); };
  if (g('#pl-inicio') && g('#pl-inicio').value) c.startDate = g('#pl-inicio').value;
  if (g('#pl-prova') && g('#pl-prova').value) c.examDate = g('#pl-prova').value;
  $$('[data-h]').forEach(function (x) { c.hours[Number(x.dataset.h)] = Math.max(0, Number(x.value || 0)); });
  if (g('#pl-nivel')) c.level = Number(g('#pl-nivel').value);
  if (g('#pl-nome')) c.nome = g('#pl-nome').value.trim();
  if (g('#pl-qmin')) c.qmin = clamp(Number(g('#pl-qmin').value || 45), 15, 180);
  if (g('#pl-rfw')) c.rfw = Number(g('#pl-rfw').value);
  if (g('#pl-incR')) c.incR = g('#pl-incR').checked;
  if (g('#pl-incP')) c.incP = g('#pl-incP').checked;
  $$('[data-disc-f]').forEach(function (s) { c.disc[s.dataset.discF] = Number(s.value); });
  if (fromISO(c.examDate) <= fromISO(c.startDate)) c.examDate = toISO(addMonths(fromISO(c.startDate), 6));
}

/* ---------- BANCO ---------- */
function filtrarQuestoes() {
  var b = FILTRO.busca.trim().toLowerCase();
  return QUESTOES.filter(function (q) {
    if (FILTRO.disc && q.disc !== FILTRO.disc) return false;
    if (FILTRO.tema && q.tema !== FILTRO.tema) return false;
    if (FILTRO.sub && !(q.subtema === FILTRO.sub || (b === '' && temaTexto(q).indexOf(normAlt(subNome(FILTRO.sub))) >= 0))) return false;
    var s = statusQ(q.id);
    if (FILTRO.status === 'nao' && s != null) return false;
    if (FILTRO.status === 'erradas' && s !== false) return false;
    if (FILTRO.status === 'certas' && s !== true) return false;
    if (FILTRO.status === 'marcadas' && !QST.marc[q.id]) return false;
    if (b && (q.enunciado + ' ' + (q.fonte || '') + ' ' + q.id).toLowerCase().indexOf(b) < 0) return false;
    return true;
  });
}
function subNome(sid) { var t = TEMA_BY[sid.split('.')[0]]; var s = t && t.subtemas.find(function (x) { return x.id === sid; }); return s ? s.nome : ''; }
function temaTexto(q) { return normAlt(q.enunciado + ' ' + (q.fonte || '') + ' ' + (q.comentario || '')); }
function renderBanco() {
  if (QS) { renderSessao(); return; }
  if (FILTRO.disc && !CARREGADOS[FILTRO.disc] && nBancoDisc(FILTRO.disc) > 0) { carregarDisc(FILTRO.disc, function () { if (VIEW === 'banco' && !QS) renderBanco(); }); }
  var h = '<div class="banco"><div class="arvore">';
  DISCS.forEach(function (d) { var ts = temasDa(d.id), n = nBancoDisc(d.id);
    h += '<details' + (FILTRO.disc === d.id ? ' open' : '') + '><summary data-arv-disc="' + d.id + '"><span>' + esc(d.nome) + '</span><span class="ct">' + n + '</span></summary>';
    ts.forEach(function (t) { var nt = nBancoTema(t.id); h += '<button type="button" class="tema' + (FILTRO.tema === t.id ? ' sel' : '') + '" data-arv-tema="' + t.id + '" title="' + esc(t.nome) + '"><span>' + esc(t.nome) + '</span><span class="ct">' + (nt || '—') + '</span></button>'; });
    h += '</details>'; });
  h += '</div><div>';
  var lista = filtrarQuestoes(), tema = FILTRO.tema ? TEMA_BY[FILTRO.tema] : null, carregando = FILTRO.disc && !CARREGADOS[FILTRO.disc] && nBancoDisc(FILTRO.disc) > 0;
  var todasCarregadas = Object.keys(BANCO_INDEX.discs).every(function (d) { return !BANCO_INDEX.discs[d].n || CARREGADOS[d]; });
  h += '<div class="cx"><div class="kick">' + (FILTRO.disc ? esc(DISC_BY[FILTRO.disc].nome) : 'Todo o banco') + (tema ? ' · tema' : '') + '</div><h2 style="font-size:17px">' + (tema ? esc(tema.nome) : (FILTRO.disc ? 'Todos os temas' : BANCO_INDEX.total + ' questões comentadas')) + '</h2>';
  if (carregando) h += '<p class="muted" style="font-size:13px">Carregando as questões de ' + esc(DISC_BY[FILTRO.disc].nome) + '…</p>';
  if (!FILTRO.disc && !todasCarregadas) h += '<p class="muted" style="font-size:13px">A busca em todo o banco usa as disciplinas já abertas (' + QUESTOES.length + ' questões carregadas). <button class="chip" data-act="carregar-tudo">Carregar todas as disciplinas</button></p>';
  if (tema) { h += '<p class="muted" style="font-size:13px">' + (tema.ebook ? 'E-book ' + esc(DISC_BY[tema.disc].ebook) + ', p. ' + tema.pi + '–' + tema.pf + ' · ' : '') + tema.h + ' h de estudo-base' + (tema.origem === 'planner-geral' ? ' · questões ainda não cadastradas para este tema' : '') + '</p>';
    if (tema.subtemas.length) h += '<div class="subtemas"><span class="chip' + (!FILTRO.sub ? ' n' : '') + '" data-sub="">Todos</span>' + tema.subtemas.map(function (s) { return '<span class="chip' + (FILTRO.sub === s.id ? ' n' : '') + '" data-sub="' + s.id + '">' + esc(s.nome) + '</span>'; }).join('') + '</div>'; }
  h += '<div class="filtros"><select id="f-status"><option value="todas"' + (FILTRO.status === 'todas' ? ' selected' : '') + '>Todas</option><option value="nao"' + (FILTRO.status === 'nao' ? ' selected' : '') + '>Não respondidas</option><option value="erradas"' + (FILTRO.status === 'erradas' ? ' selected' : '') + '>Erradas</option><option value="certas"' + (FILTRO.status === 'certas' ? ' selected' : '') + '>Certas</option><option value="marcadas"' + (FILTRO.status === 'marcadas' ? ' selected' : '') + '>Marcadas</option></select><input type="search" id="f-busca" placeholder="buscar no enunciado, fonte ou código…" value="' + esc(FILTRO.busca) + '"><button class="btn p sm" data-act="rodada-filtro"' + (lista.length ? '' : ' disabled') + '>Rodada com ' + Math.min(10, lista.length) + '</button>' + (FILTRO.disc || FILTRO.tema ? '<button class="btn g sm" data-act="limpar-filtro">Limpar</button>' : '') + '</div>';
  h += '<p class="muted" style="font-size:12.5px;margin-bottom:8px">' + lista.length + ' questões encontradas' + (lista.length > 60 ? ' · mostrando as 60 primeiras' : '') + '</p><div class="lista-q">';
  lista.slice(0, 60).forEach(function (q) { var s = statusQ(q.id); var st = s == null ? '<span class="st n">não feita</span>' : s ? '<span class="st c">certa</span>' : '<span class="st e">errada</span>'; if (QST.marc[q.id]) st += ' <span class="st m">marcada</span>';
    h += '<button type="button" class="item-q" data-abrir-q="' + q.id + '"><div><div class="id">' + q.id + ' · ' + esc(TEMA_BY[q.tema] ? TEMA_BY[q.tema].nome.slice(0, 70) : q.tema) + '</div><div class="en">' + esc(q.enunciado.slice(0, 220)) + '</div></div><div>' + st + '</div></button>'; });
  if (!lista.length) h += '<p class="muted">Nenhuma questão com esses filtros.</p>';
  h += '</div></div></div></div>';
  $('#v-banco').innerHTML = h;
}

/* ---------- SESSÃO DE QUESTÕES ---------- */
var RX_ABERT = /(analise as (?:afirmativas|assertivas|proposições)[^.]*\.)\s*/i;
var RX_FECHO = /\s*((?:Nesse cen[áa]rio|Diante do exposto|À luz|Com base|Assim)[^:]{0,140}:|(?:Est[áa] correto o que se afirma em|É correto apenas o que se afirma em)[^:]{0,60}:)\s*$/;
var RX_ITEM = /(?=(?:^|\s)(?:I|II|III|IV|V|VI)\.\s)/;
function enunciadoHTML(t) {
  t = String(t || '').trim(); var m = t.match(RX_ABERT);
  if (!m) return '<div class="q-en"><b>' + esc(t) + '</b></div>';
  var i = m.index + m[0].length, cab = t.slice(0, i).trim(), resto = t.slice(i), fecho = '', mf = resto.match(RX_FECHO);
  if (mf) { fecho = mf[1].trim(); resto = resto.slice(0, mf.index); }
  var itens = resto.split(RX_ITEM).map(function (x) { return x.trim(); }).filter(Boolean);
  return '<div class="q-en"><b>' + esc(cab) + '</b></div><div class="q-itens">' + itens.map(function (x) { return '<div>' + esc(x) + '</div>'; }).join('') + '</div>' + (fecho ? '<div class="q-en q-fecho"><b>' + esc(fecho) + '</b></div>' : '');
}
function iniciarSessao(ids, titulo, origem) { if (!ids.length) { toast('Nenhuma questão disponível'); return; } QS = { ids: ids, i: 0, sel: null, titulo: titulo, origem: origem || null }; var p = ids.findIndex(function (id) { return QST.resp[id] == null; }); QS.i = p < 0 ? 0 : p; mostrar('banco'); }
function renderSessao() {
  var q = Q_BY[QS.ids[QS.i]]; if (!q) { QS = null; renderBanco(); return; }
  var resp = QST.resp[q.id], LET = ['A', 'B', 'C', 'D', 'E'], ac = 0, er = 0; QS.ids.forEach(function (id) { var s = statusQ(id); if (s === true) ac++; else if (s === false) er++; });
  var acertou = resp === q.correta, t = TEMA_BY[q.tema], h = '';
  h += '<button class="btn g sm" data-act="voltar-banco">‹ Voltar ao banco</button>';
  h += '<div class="q-top" style="margin-top:12px"><div><div class="kick">' + esc(QS.titulo) + '</div><h2 style="font-size:17px">' + esc(DISC_BY[q.disc] ? DISC_BY[q.disc].nome : '') + '</h2></div><button class="btn g sm" data-act="zerar-rodada">Refazer a rodada</button></div>';
  h += '<div class="placar"><div class="pl"><b>' + (QS.i + 1) + '/' + QS.ids.length + '</b>questão</div><div class="pl ac"><b>' + ac + '</b>certas</div><div class="pl er"><b>' + er + '</b>erradas</div><div class="pl"><b>' + (QS.ids.length - ac - er) + '</b>restantes</div></div>';
  h += '<div class="q-cx"><div class="q-num">' + q.id + ' · ' + esc(t ? t.nome.slice(0, 90) : '') + (q.fonte ? ' · ' + esc(q.fonte.slice(0, 80)) : '') + '</div>' + enunciadoHTML(q.enunciado);
  q.alternativas.forEach(function (a, k) { var cls = 'alt'; if (resp != null) { if (k === q.correta) cls += ' certa'; else if (k === resp) cls += ' errada'; } else if (QS.sel === k) cls += ' sel';
    h += '<button class="' + cls + '" ' + (resp != null ? 'disabled' : '') + ' data-alt="' + k + '"><span class="le">' + LET[k] + '</span><span>' + esc(a.t) + (resp != null && a.c ? '<span class="cm">' + esc(a.c) + '</span>' : '') + '</span></button>'; });
  if (resp == null) h += '<div class="q-acao"><button class="btn p" data-act="confirmar" ' + (QS.sel == null ? 'disabled' : '') + '>Confirmar resposta</button><span class="muted" style="font-size:13px">Escolha uma alternativa e confirme para abrir o gabarito comentado.</span></div>';
  else {
    h += '<div class="q-acao"><button class="btn g sm" data-act="refazer-q">Refazer esta questão</button><button class="btn g sm" data-act="marcar">' + (QST.marc[q.id] ? 'Desmarcar' : 'Marcar para revisar') + '</button>' + (t && t.ebook ? '<span class="chip">E-book, p. ' + (q.pi || t.pi) + '</span>' : '') + '</div>';
    var partes = String(q.comentario || '').split(/\n(?=Dispositivo normativo)/);
    h += '<div class="res' + (acertou ? '' : ' erro') + '"><b>' + (acertou ? '✓ Resposta correta' : '✕ Resposta incorreta') + '</b> · Gabarito: ' + LET[q.correta] + (acertou ? '' : ' · você marcou ' + LET[resp]) + (QST.rever[q.id] ? '<div class="aviso" style="margin:8px 0"><span class="ic">!</span><div>Esta questão foi revisada depois da sua resposta. A marcação foi preservada; confira o gabarito.</div></div>' : '');
    h += '<div class="lb">Gabarito comentado</div><p>' + esc(partes[0].trim()).replace(/\n/g, '<br>') + '</p>';
    if (partes[1]) h += '<div class="lb">Dispositivo</div><div class="disp">' + esc(partes[1].trim()) + '</div>';
    h += '</div>';
  }
  h += '</div><div class="lin" style="margin-top:12px;justify-content:space-between"><button class="btn g" data-act="anterior" ' + (QS.i === 0 ? 'disabled' : '') + '>‹ Anterior</button><button class="btn p" data-act="proxima" ' + (QS.i >= QS.ids.length - 1 ? 'disabled' : '') + '>Próxima ›</button></div>';
  $('#v-banco').innerHTML = h;
}

/* ---------- DIAGNÓSTICO ---------- */
function renderDiag() {
  var resp = 0, ac = 0; Object.keys(QST.resp).forEach(function (id) { var s = statusQ(id); if (s == null) return; resp++; if (s) ac++; });
  var h = '<div class="kpis"><div class="kpi"><div class="v">' + resp + '</div><div class="k">respondidas</div></div><div class="kpi"><div class="v">' + (resp ? Math.round(100 * ac / resp) : 0) + '%</div><div class="k">aproveitamento</div></div><div class="kpi"><div class="v">' + (resp - ac) + '</div><div class="k">caderno de erros</div></div><div class="kpi"><div class="v">' + Object.keys(ST.done).length + '</div><div class="k">tarefas concluídas</div></div></div>';
  var disc = FILTRO.disc || DISCS[0].id;
  h += '<div class="cx" style="margin-top:12px"><div class="lin" style="justify-content:space-between"><div><div class="kick">Domínio por tema</div><h2 style="font-size:17px">' + esc(DISC_BY[disc].nome) + '</h2></div><select id="diag-disc" style="width:auto">' + DISCS.map(function (d) { return '<option value="' + d.id + '"' + (d.id === disc ? ' selected' : '') + '>' + esc(d.nome) + '</option>'; }).join('') + '</select></div>';
  h += '<div class="heat" style="margin-top:12px">' + temasDa(disc).map(function (t) { var d = dominioTema(t.id); return '<div class="c n' + nivelHeat(d.pct) + '" title="' + esc(t.nome) + '"><b>' + esc(t.nome.slice(0, 48)) + '</b>' + (d.n ? d.pct + '% · ' + d.n + ' de ' + d.tot : (d.tot ? 'sem respostas · ' + d.tot + ' q.' : 'sem questões ainda')) + '</div>'; }).join('') + '</div>';
  h += '<p class="muted" style="font-size:12px;margin-top:10px">Escala: claro = baixo domínio ou sem dados; escuro = alto. Abaixo de 50%, o tema merece voltar à rodada — use "Rodada com erradas" no banco.</p></div>';
  $('#v-diag').innerHTML = h;
}

/* ---------- PROGRESSO ---------- */
function renderProg() {
  var ls = SG.lista(), u = ls[0];
  var h = '<div class="cx"><div class="kick">Cópia de segurança automática</div><h2 style="font-size:17px">Seu progresso, protegido</h2><p>A cada 5 minutos, na abertura, ao trocar de aba e ao sair, o portal guarda uma cópia do seu progresso neste navegador — cinco cópias em rotação. ' + (u ? 'A última é de <b>' + fmtDH(u.em) + '</b>, com ' + u.n + ' respostas.' : 'A primeira cópia é criada em instantes.') + '</p>';
  ls.forEach(function (s) { h += '<div class="sg-item"><div><b>' + s.n + ' respostas</b> · ' + fmtDH(s.em) + (s.motivo === 'manual' ? ' · manual' : '') + '</div><button class="btn g sm" data-snaprest="' + s.__i + '">Restaurar esta</button></div>'; });
  h += '<div class="lin" style="margin-top:12px"><button class="btn g sm" data-act="sg-agora">Criar cópia agora</button></div></div>';
  h += '<div class="cx"><div class="kick">Backup</div><h2 style="font-size:17px">Levar para outro aparelho</h2><p>Restaurar nunca apaga nada: acrescenta o que falta e conserva o que você já tem.</p><div class="lin" style="margin-top:10px"><button class="btn p" data-act="sg-baixar">Baixar backup (.json)</button><label class="btn g" style="display:inline-block">Restaurar de arquivo<input type="file" id="sg-import" accept="application/json" hidden></label></div>';
  h += '<label class="f" for="sg-codigo">Código de progresso</label><textarea id="sg-codigo" spellcheck="false" placeholder="Gere e copie, ou cole um código seu para restaurar."></textarea><div class="lin" style="margin-top:8px"><button class="btn g sm" data-act="sg-copiar">Gerar e copiar código</button><button class="btn g sm" data-act="sg-colar">Restaurar do código</button></div></div>';
  h += painelNuvem();
  h += '<div class="cx"><div class="kick">Zona de risco</div><p>Apagar plano, progresso e respostas deste navegador. Uma cópia de segurança é feita antes.</p><div class="lin" style="margin-top:8px"><button class="btn g sm danger" data-act="zerar">Zerar tudo neste navegador</button></div></div>';
  $('#v-prog').innerHTML = h;
}
