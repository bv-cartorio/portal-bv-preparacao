/* ================================================================
   UTILITÁRIOS
================================================================ */
var DAY_MS = 86400000;
var DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
var DOWFULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function toISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function fromISO(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function fmtBR(d) { return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }
function fmtBRfull(d) { return fmtBR(d) + '/' + d.getFullYear(); }
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) {
  var x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  var last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(d.getDate(), last));
  return x;
}
function mondayOf(d) { var x = new Date(d); var wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
function dayDiff(a, b) { return Math.round((a - b) / DAY_MS); }
function fmtH(min) {
  min = Math.round(min);
  var h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return m + ' min';
  if (m === 0) return h + 'h';
  return h + 'h' + String(m).padStart(2, '0');
}
function fmtHr(min) { return Math.round(min / 60).toLocaleString('pt-BR') + 'h'; }
function r5(x) { return Math.round(x / 5) * 5; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function isValidISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(fromISO(s).getTime()); }

/* ================================================================
   FASES DO PLANO
================================================================ */
function phaseName(key) {
  if (key === 'c1') return 'Ciclo 1 · Base teórica';
  if (key === 'c2') return 'Ciclo 2 · Revisão ativa';
  if (key === 'c3') return 'Ciclo 3 · Aprofundamento';
  if (key === 'rf') return 'Reta final';
  if (key === 'c4') return 'Ciclo 4 · Lapidação';
  return 'Ciclo ' + key.slice(1) + ' · Manutenção';
}
function phaseShort(key) { return key === 'rf' ? 'Reta final' : 'Ciclo ' + key.slice(1); }
function recCycles(months) { return months <= 8 ? 1 : months <= 14 ? 2 : months <= 20 ? 3 : 4; }
var CYCLE_W = [1, 0.85, 0.7, 0.6, 0.5, 0.5, 0.5, 0.5];
var CYCLE_NAMES = [
  ['Revisão ativa', 'Questões'],
  ['Lei seca e jurisprudência', 'Questões'],
  ['Pontos fracos e caderno de erros', 'Questões mistas'],
  ['Revisão final', 'Questões e caderno de erros']
];
var CYCLE_SPLIT = [0.55, 0.5, 0.4, 0.6];
var SR_COST = { 1: 8, 7: 10, 30: 12, 90: 12 };
var SR_LATE = { 1: 4, 7: 7, 30: 14, 90: 30 };
var SR_LBL = { 1: '24h', 7: '7 dias', 30: '30 dias', 90: '90 dias' };
var CK_MIN = 90;

/* ================================================================
   MONTAGEM DAS FILAS
================================================================ */
function discF(cfg, k) { var v = cfg.disc ? cfg.disc[k] : 1; return typeof v === 'number' ? v : 1; }
function normasLbl(cfg) { var u = String(cfg.uf || '').trim(); return u ? 'Normas ' + u : 'Normas estaduais'; }
function normasOn(cfg) { return !!cfg.incN && discF(cfg, 'normas') > 0 && cfg.arts > 0; }

/* intercala trilhas de forma proporcional: avança sempre a trilha mais atrasada */
function mergeTracks(tracks) {
  var st = tracks.map(function (t) {
    var tot = 0; t.items.forEach(function (it) { tot += it.w; });
    return { items: t.items, i: 0, done: 0, tot: tot || 1, s: t.s || 0 };
  });
  var out = [];
  for (;;) {
    var best = -1, bestV = Infinity;
    for (var k = 0; k < st.length; k++) {
      var s = st[k]; if (s.i >= s.items.length) continue;
      var v = s.s + (1 - s.s) * s.done / s.tot;
      if (v < bestV - 1e-9) { bestV = v; best = k; }
    }
    if (best < 0) break;
    var S = st[best], it = S.items[S.i++];
    S.done += it.w;
    for (var j = 0; j < it.tasks.length; j++) out.push(it.tasks[j]);
  }
  return out;
}

function normasItems(cfg, prefix, totalMin, leitura) {
  var items = [], arts = Math.round(cfg.arts);
  var n = Math.max(1, Math.round(totalMin / 60));
  var per = arts / n;
  for (var i = 0; i < n; i++) {
    var a = Math.floor(i * per) + 1, b = i === n - 1 ? arts : Math.floor((i + 1) * per);
    if (b < a) b = a;
    var min = Math.max(10, Math.round(totalMin / n));
    items.push({ w: min, tasks: [{
      id: prefix + ':' + i, type: 'n', disc: 'normas',
      lbl: normasLbl(cfg) + ' · arts. ' + a + '–' + b + ' (' + leitura + ')' + (discF(cfg, 'normas') < 1 ? ' · leitura dinâmica' : ''),
      min: min, div: true, rng: [a, b], units: b - a + 1
    }] });
  }
  return items;
}

function p2Items(cfg, prefix, n, offset) {
  var pool = P2_LIST.filter(function (p) { return discF(cfg, p.d) > 0; });
  var items = [];
  if (!pool.length) return items;
  for (var i = 0; i < n; i++) {
    var p = pool[(offset + i) % pool.length];
    items.push({ w: cfg.pmin, tasks: [{ id: prefix + ':' + i, type: 'p', disc: p.d, lbl: '2ª fase · ' + p.l, min: cfg.pmin, div: false }] });
  }
  return items;
}

/* Ciclo 1: teoria tema a tema + questões do tema, com normas e 2ª fase em trilhas próprias */
function buildC1(cfg, spanW) {
  var theory = 0, trs = [];
  TRACKS.forEach(function (keys) {
    var items = [];
    keys.forEach(function (k) {
      var f = discF(cfg, k); if (f === 0) return;
      var D = DISC[k];
      D.units.forEach(function (U, ui) {
        U.t.forEach(function (tp, ti) {
          var min = Math.max(20, r5(tp[1] * 60 * cfg.level * f));
          theory += min;
          var key = k + ':' + ui + ':' + ti;
          items.push({ w: min, tasks: [
            { id: 't:' + key, type: 'e', disc: k, tema: tp[2] || null, lbl: D.short + ' · ' + tp[0] + (f < 1 ? ' · leitura dinâmica' : ''),
              sub: 'Material-base: e-book BV de ' + D.book, min: min, div: true, topic: D.short + ' — ' + tp[0] },
            { id: 'q:' + key, type: 'q', disc: k, tema: tp[2] || null, lbl: 'Questões · ' + tp[0],
              min: tp[1] >= 3 ? cfg.qmin : Math.max(15, r5(cfg.qmin * 0.65)), div: false }
          ] });
        });
      });
    });
    if (items.length) trs.push({ items: items, s: 0 });
  });
  if (normasOn(cfg)) {
    var nMin = cfg.arts / cfg.aph * 60 * discF(cfg, 'normas');
    trs.push({ items: normasItems(cfg, 'n1', nMin, '1ª leitura'), s: 0 });
  }
  if (cfg.incP) {
    var share = spanW < 34 ? 0 : spanW < 60 ? 0.05 : 0.08;
    var nP = Math.round(share * theory / cfg.pmin);
    if (nP > 0) { var pi = p2Items(cfg, 'p1', nP, 0); if (pi.length) trs.push({ items: pi, s: 0.35 }); }
  }
  return { tasks: mergeTracks(trs), theory: theory };
}

/* Ciclos de revisão e reta final: dimensionados pelo orçamento B (minutos) */
function buildCycle(cfg, key, kind, B, rfW) {
  var isRF = key === 'rf';
  var names = CYCLE_NAMES[kind], split = CYCLE_SPLIT[kind];
  var sims = 0;
  if (isRF) sims = clamp(Math.floor(0.3 * B / cfg.smin), 0, Math.max(1, rfW));
  else if (B >= 5 * cfg.smin) sims = (kind >= 1 && B >= 12 * cfg.smin) ? 2 : 1;
  var pShare = cfg.incP ? (isRF ? 0.12 : [0.15, 0.2, 0.2][kind]) : 0;
  var nP = Math.floor(pShare * B / cfg.pmin);
  var normMin = 0, leitura = '';
  if (normasOn(cfg)) {
    var rate = cfg.aph * (key === 'c2' ? 1.5 : cfg.revx);
    leitura = key === 'c2' ? '2ª leitura' : key === 'c3' ? '3ª leitura' : isRF ? 'leitura final' : 'releitura';
    normMin = Math.min(cfg.arts / rate * 60 * discF(cfg, 'normas'), (isRF ? 0.15 : 0.2) * B);
    if (normMin < 20) normMin = 0;
  }
  var vespera = isRF ? 30 : 0;
  var rest = B - sims * cfg.smin - nP * cfg.pmin - normMin - vespera;
  if (rest < 0.25 * B) { nP = 0; sims = Math.min(sims, 1); rest = B - sims * cfg.smin - normMin - vespera; }
  if (rest < 30) { sims = 0; normMin = 0; rest = Math.max(20, B - vespera); }

  /* pesos por unidade e por disciplina */
  var units = [], totW = 0, discW = {}, nDisc = 0;
  TRACKS.forEach(function (keys, tr) {
    keys.forEach(function (k) {
      var f = discF(cfg, k); if (f === 0) return;
      var D = DISC[k];
      D.units.forEach(function (U, ui) {
        var h = 0; U.t.forEach(function (tp) { h += tp[1]; });
        var w = h * f * D.rw;
        units.push({ k: k, ui: ui, tr: tr, w: w, name: U.name });
        totW += w;
        if (!discW[k]) { discW[k] = 0; nDisc++; }
        discW[k] += w;
      });
    });
  });
  var trs = [];
  function pair(idr, idq, disc, title, min, tr) {
    var a = Math.max(10, Math.round(min * split)), b = Math.max(10, Math.round(min * (1 - split)));
    return { w: a + b, tr: tr, tasks: [
      { id: idr, type: 'v', disc: disc, lbl: names[0] + ' · ' + title, min: a, div: true },
      { id: idq, type: 'q', disc: disc, lbl: names[1] + ' · ' + title, min: b, div: true }
    ] };
  }
  var content = [];
  if (!units.length) {
    /* todas as disciplinas cortadas: nada a revisar */
  } else if (rest / units.length >= 45) {
    units.forEach(function (u) {
      content.push(pair(key + ':r:' + u.k + ':' + u.ui, key + ':q:' + u.k + ':' + u.ui, u.k, DISC[u.k].short + ' — ' + u.name, rest * u.w / totW, u.tr));
    });
  } else if (rest / nDisc >= 30) {
    var seen = {};
    units.forEach(function (u) {
      if (seen[u.k]) return; seen[u.k] = 1;
      content.push(pair(key + ':r:' + u.k, key + ':q:' + u.k, u.k, DISC[u.k].name, rest * discW[u.k] / totW, u.tr));
    });
  } else {
    content.push(pair(key + ':r:all', key + ':q:all', null, 'todas as disciplinas', rest, 0));
  }
  var byTr = {};
  content.forEach(function (it) { (byTr[it.tr] = byTr[it.tr] || []).push(it); });
  Object.keys(byTr).forEach(function (t) { trs.push({ items: byTr[t], s: 0 }); });
  if (normMin > 0) trs.push({ items: normasItems(cfg, key + ':n', normMin, leitura), s: 0 });
  if (nP > 0) {
    var off = isRF ? 3 : (parseInt(key.slice(1), 10) || 2) * 5;
    var pi = p2Items(cfg, key + ':p', nP, off);
    if (pi.length) trs.push({ items: pi, s: 0 });
  }
  var list = mergeTracks(trs);
  /* simulados distribuídos ao longo do ciclo, o último no fim */
  if (sims > 0) {
    var L = list.length, out = [], next = 1;
    for (var i = 0; i < L; i++) {
      out.push(list[i]);
      if (next <= sims && i + 1 >= Math.round(L * next / sims)) {
        out.push({ id: key + ':s:' + (next - 1), type: 's', disc: null,
          lbl: 'Simulado completo · 100 questões, com correção comentada', min: cfg.smin, div: true });
        next++;
      }
    }
    list = out;
  }
  if (isRF) list.push({ id: 'rf:vespera', type: 'v', disc: null, lbl: 'Véspera · leitura leve dos resumos e descanso', min: vespera, div: false });
  return list;
}

/* ================================================================
   MOTOR DE DISTRIBUIÇÃO
================================================================ */
function capFor(cfg, iso, dow) {
  if (cfg.overrides && Object.prototype.hasOwnProperty.call(cfg.overrides, iso)) return Math.round(cfg.overrides[iso] * 60);
  return Math.round((cfg.hours[dow] || 0) * 60);
}

function generate(cfg) {
  var planStart = fromISO(cfg.startDate), exam = fromISO(cfg.examDate);
  var start = cfg.anchor && isValidISO(cfg.anchor) ? fromISO(cfg.anchor) : planStart;
  if (start < planStart) start = planStart;
  var base = cfg.base || {};
  var spanW = Math.max(0, dayDiff(exam, planStart) / 7);
  var months = spanW / 4.348;
  var rec = recCycles(months);
  var rfW = cfg.rfw > 0 ? cfg.rfw : (spanW <= 30 ? 4 : spanW <= 56 ? 6 : 8);
  rfW = Math.max(1, Math.min(rfW, Math.floor(spanW * 0.35) || 1));
  var rfDate = addDays(exam, -rfW * 7);

  var days = [], weeklyCap = 0, i;
  for (i = 0; i < 7; i++) weeklyCap += cfg.hours[i] || 0;
  for (var d = new Date(start), g = 0; d < exam && g < 1200; d = addDays(d, 1), g++) {
    var iso = toISO(d), cap = capFor(cfg, iso, d.getDay());
    if (cap <= 0) continue;
    days.push({ date: new Date(d), iso: iso, cap: cap, rem: cap, used: 0, main: 0, blocks: [], ext: false, started: false,
      ovr: !!(cfg.overrides && Object.prototype.hasOwnProperty.call(cfg.overrides, iso)) });
  }
  var rfIdx = days.length;
  for (i = 0; i < days.length; i++) { if (days[i].date >= rfDate) { rfIdx = i; break; } }

  var P = { di: 0 };
  var due = [], lastCk = 0, curPhase = 'c1';
  var mon0 = mondayOf(planStart);

  function applyBase(list) {
    var out = [];
    list.forEach(function (t) {
      var b = clamp(base[t.id] || 0, 0, 1);
      if (b >= 0.985) return;
      t.full = t.min; t.b = b;
      if (b > 0) t.min = Math.max(5, Math.round(t.full * (1 - b)));
      out.push(t);
    });
    return out;
  }
  function addBlock(day, task, consumed, chunk, isLast, phase) {
    var full = task.full || task.min, b = task.b || 0;
    var sub = task.sub || '';
    if (task.rng && task.div) {
      var f0 = consumed / task.min, f1 = isLast ? 1 : (consumed + chunk) / task.min;
      var u0 = Math.round(f0 * task.units), u1 = Math.round(f1 * task.units);
      if (u1 <= u0) u1 = u0 + 1;
      var a = task.rng[0] + u0, z = Math.min(task.rng[1], task.rng[0] + u1 - 1);
      if (!(consumed === 0 && isLast)) sub = 'trecho de hoje: arts. ' + a + '–' + z;
    }
    day.blocks.push({ tid: task.id, type: task.type, phase: phase, disc: task.disc || null, tema: task.tema || null, lbl: task.lbl, sub: sub,
      min: Math.round(chunk), o0: b + consumed / full, o1: isLast ? 1 : b + (consumed + chunk) / full, part: 0, parts: 0 });
    if (isLast && task.topic && cfg.incR) {
      [1, 7, 30, 90].forEach(function (r) {
        var on = addDays(day.date, r);
        if (on < rfDate) due.push({ lbl: task.topic, on: on, r: r });
      });
    }
  }
  function simple(day, id, type, phase, lbl, sub, min) {
    day.blocks.push({ tid: id, type: type, phase: phase, disc: null, lbl: lbl, sub: sub || '', min: Math.round(min), o0: 0, o1: 1, part: 0, parts: 0 });
    day.rem -= min; day.used += min;
  }
  function startDay(day, phase) {
    if (day.started) return;
    day.started = true;
    /* revisão espaçada: temas concluídos há 1, 7, 30 e 90 dias */
    if (cfg.incR && due.length && phase !== 'rf') {
      var budget = clamp(Math.round(day.cap * 0.2), 10, 45), used = 0, items = [], keep = [];
      due.sort(function (a, b) { return a.on - b.on; });
      due.forEach(function (it) {
        if (it.on > day.date) { keep.push(it); return; }
        if (dayDiff(day.date, it.on) > SR_LATE[it.r]) return;
        var c = SR_COST[it.r];
        if (used + c <= budget) { items.push(it); used += c; } else keep.push(it);
      });
      due = keep;
      if (items.length) {
        simple(day, 'sr:' + day.iso, 'v', phase,
          'Revisão espaçada · ' + items.length + (items.length === 1 ? ' tema' : ' temas'),
          items.map(function (x) { return x.lbl + ' (' + SR_LBL[x.r] + ')'; }).join(' · '), used);
      }
    }
    /* checkpoint mensal no Ciclo 1 */
    if (phase === 'c1') {
      var wk = Math.floor(dayDiff(day.date, mon0) / 7);
      if (wk > 0 && wk % 4 === 0 && wk !== lastCk && day.rem >= 30) {
        lastCk = wk;
        simple(day, 'ck:' + wk, 's', phase, 'Checkpoint mensal · mini-simulado de 30 questões e caderno de erros',
          'Mede o que ficou das últimas quatro semanas e alimenta as revisões.', Math.min(CK_MIN, day.rem));
      }
    }
  }
  function packList(list, limitIdx, phase) {
    var ti = 0, consumed = 0;
    curPhase = phase;
    while (ti < list.length && P.di < limitIdx) {
      var day = days[P.di];
      startDay(day, phase);
      if (day.rem < 15) { P.di++; continue; }
      var task = list[ti], left = task.min - consumed;
      /* simulado começa em sessão própria: não entra em sobra pequena de um dia já ocupado */
      if (task.type === 's' && consumed === 0 && day.main > 0 && day.rem < Math.min(task.min, 0.75 * day.cap)) { P.di++; continue; }
      if (task.div) {
        var chunk = Math.min(left, day.rem);
        if (chunk < 15 && chunk < left) { P.di++; continue; }
        var isLast = consumed + chunk >= task.min - 0.5;
        addBlock(day, task, consumed, chunk, isLast, phase);
        consumed += chunk; day.rem -= chunk; day.used += chunk; day.main += chunk;
        if (isLast) { ti++; consumed = 0; } else { P.di++; }
      } else if (left <= day.rem) {
        addBlock(day, task, 0, left, true, phase);
        day.rem -= left; day.used += left; day.main += left; ti++;
      } else if (day.main === 0) {
        addBlock(day, task, 0, left, true, phase);
        day.used += left; day.main += left; day.rem = 0; day.ext = true; ti++;
      } else { P.di++; }
    }
    var lo = 0, n = 0;
    for (var k = ti; k < list.length; k++) { lo += list[k].min; n++; }
    return { next: ti, leftoverMin: Math.max(0, lo - consumed), leftoverTasks: n };
  }
  function filler(from, to, phase) {
    for (var k = from; k < to; k++) {
      var day = days[k];
      startDay(day, phase);
      if (day.rem >= 20) simple(day, 'fl:' + day.iso, 'v', phase, 'Revisão livre · caderno de erros, fichas e pontos fracos', '', day.rem);
    }
  }
  function remFrom(a, b) { var s = 0; for (var k = a; k < b; k++) s += days[k].rem; return s; }

  /* ---------- Ciclo 1 ---------- */
  var c1 = buildC1(cfg, spanW);
  var L1t = c1.theory, c1Full = 0;
  c1.tasks.forEach(function (t) { c1Full += t.min; });
  var res = packList(applyBase(c1.tasks), days.length, 'c1');
  var leftoverMin = res.leftoverMin, leftoverTasks = res.leftoverTasks;
  var ideal = 0.45 * L1t, nRev = 0, hasCycles = false;

  if (!leftoverTasks && days.length) {
    /* ---------- Ciclos de revisão ---------- */
    var R = P.di < rfIdx ? remFrom(P.di, rfIdx) : 0;
    var startedC = 1, keepC = 1;
    function scan(obj, isBase) {
      for (var id in obj) {
        var m = /^c(\d+):/.exec(id);
        if (m && obj[id] > 0) { var c = +m[1]; if (isBase) startedC = Math.max(startedC, c); keepC = Math.max(keepC, c); }
      }
    }
    scan(base, true); scan(cfg.done || {}, false);
    var nNew = (L1t > 0 && R >= 0.15 * L1t) ? clamp(Math.round(R / ideal), 1, rec + 2) : 0;
    var firstC = Math.max(2, startedC);
    var lastC = firstC + nNew - 1;
    if (R >= 120) lastC = Math.max(lastC, keepC, startedC >= 2 ? startedC : 0);
    lastC = Math.min(lastC, 9);
    if (lastC >= firstC && R >= 120) {
      var cs = [], den = 0;
      for (var c = firstC; c <= lastC; c++) {
        var w = CYCLE_W[Math.min(c - 2, 7)], rho = 1, kind = Math.min(c - 2, 2);
        if (c === startedC) {
          var tot = 0, rm = 0;
          buildCycle(cfg, 'c' + c, kind, ideal * w, rfW).forEach(function (t) { tot += t.min; rm += t.min * (1 - clamp(base[t.id] || 0, 0, 1)); });
          rho = tot ? rm / tot : 1;
        }
        if (rho < 0.03) continue;
        cs.push({ c: c, w: w, rho: rho, kind: kind }); den += w * rho;
      }
      if (cs.length) {
        hasCycles = true;
        var X = 0.93 * R / den;
        cs.forEach(function (o) { packList(applyBase(buildCycle(cfg, 'c' + o.c, o.kind, o.w * X, rfW)), rfIdx, 'c' + o.c); });
        filler(Math.min(P.di, rfIdx), rfIdx, 'c' + cs[cs.length - 1].c);
        P.di = Math.max(P.di, rfIdx);
      }
      nRev = lastC - 1;
    } else if (startedC >= 2) nRev = startedC - 1;

    /* ---------- Reta final ---------- */
    var rfBegin = P.di;
    var F = remFrom(rfBegin, days.length);
    if (F >= 30) {
      var totF = 0, rmF = 0;
      buildCycle(cfg, 'rf', 3, F * 0.95, rfW).forEach(function (t) { totF += t.min; rmF += t.min * (1 - clamp(base[t.id] || 0, 0, 1)); });
      var rhoF = totF ? clamp(rmF / totF, 0.2, 1) : 1;
      packList(applyBase(buildCycle(cfg, 'rf', 3, F * 0.95 / rhoF, rfW)), days.length, 'rf');
      filler(rfBegin, days.length, 'rf');
    }
  }

  /* ---------- pós-processo ---------- */
  days = days.filter(function (dy) { return dy.blocks.length > 0; });
  var counts = {}, seenP = {}, totalMin = 0, ph = {}, order = [];
  days.forEach(function (dy) {
    dy.blocks.forEach(function (b) {
      counts[b.tid] = (counts[b.tid] || 0) + 1; totalMin += b.min;
      if (!ph[b.phase]) { ph[b.phase] = { key: b.phase, name: phaseName(b.phase), short: phaseShort(b.phase), from: dy.date, to: dy.date, min: 0 }; order.push(b.phase); }
      ph[b.phase].to = dy.date; ph[b.phase].min += b.min;
    });
  });
  days.forEach(function (dy) {
    dy.blocks.forEach(function (b) {
      if (counts[b.tid] > 1) { seenP[b.tid] = (seenP[b.tid] || 0) + 1; b.part = seenP[b.tid]; b.parts = counts[b.tid]; }
    });
  });
  var over = cfg.incR ? 0.1 * L1t : 0;
  var preW = Math.max(1, spanW - rfW);
  return {
    days: days, totalMin: totalMin, leftoverMin: leftoverMin, leftoverTasks: leftoverTasks,
    phases: order.map(function (k) { return ph[k]; }),
    nRev: nRev, rec: rec, hasCycles: hasCycles,
    start: start, planStart: planStart, exam: exam, rfDate: rfDate, rfW: rfW,
    spanW: spanW, months: months, weeklyCap: weeklyCap,
    c1End: ph.c1 ? ph.c1.to : null,
    finish: days.length ? days[days.length - 1].date : null,
    minWeekly: (c1Full + over) / 60 / preW,
    idealWeekly: (c1Full + over + rec * ideal) / 60 / preW
  };
}

/* veredito resumido de um plano */
function verdictOf(s) {
  if (s.leftoverTasks > 0) return 'bad';
  if (!s.days.length) return 'bad';
  if (s.c1End && s.c1End >= s.rfDate) return 'tight';
  if (s.nRev < s.rec) return 'tight';
  return 'ok';
}

if (typeof module !== 'undefined' && typeof DISC !== 'undefined') {
  module.exports = { DISC: DISC, TRACKS: TRACKS, generate: generate, verdictOf: verdictOf, buildC1: buildC1, buildCycle: buildCycle,
    toISO: toISO, fromISO: fromISO, addMonths: addMonths, addDays: addDays, fmtH: fmtH, dayDiff: dayDiff, phaseName: phaseName };
}

