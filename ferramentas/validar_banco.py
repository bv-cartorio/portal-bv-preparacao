# -*- coding: utf-8 -*-
"""Valida a taxonomia e o banco de questões. Uso: python3 ferramentas/validar_banco.py  (sai com 1 se houver erro)"""
import io,json,os,sys,glob,collections
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tax=json.load(io.open(os.path.join(R,'dados','taxonomia.json'),encoding='utf-8'))
discs={d['id'] for d in tax['disciplinas']}; temas={t['id']:t for t in tax['temas']}
erros=[]; avisos=[]; ids=set(); enunciados={}; total=0; por_disc=collections.Counter(); por_tema=collections.Counter()
for t in tax['temas']:
    if t['disc'] not in discs: erros.append(f"tema {t['id']}: disciplina desconhecida {t['disc']}")
for f in sorted(glob.glob(os.path.join(R,'dados','banco','*.json'))):
    nome=os.path.basename(f)
    if nome=='index.json': continue
    d=json.load(io.open(f,encoding='utf-8'))
    for q in d.get('questoes',[]):
        total+=1; k=f"{nome}:{q.get('id')}"
        if not q.get('id'): erros.append(f"{nome}: questão sem id"); continue
        if q['id'] in ids: erros.append(f"{k}: id duplicado")
        ids.add(q['id'])
        if q.get('disc') not in discs: erros.append(f"{k}: disciplina inválida {q.get('disc')}")
        elif q['disc']!=d.get('disc'): erros.append(f"{k}: está no arquivo da disciplina {d.get('disc')} mas declara {q['disc']}")
        if q.get('tema') not in temas: erros.append(f"{k}: tema inexistente {q.get('tema')}")
        elif temas[q['tema']]['disc']!=q.get('disc'): erros.append(f"{k}: tema {q['tema']} pertence a outra disciplina")
        alts=q.get('alternativas')
        if not isinstance(alts,list) or len(alts)!=5: erros.append(f"{k}: precisa de 5 alternativas")
        else:
            for i,a in enumerate(alts):
                if not isinstance(a,dict) or not a.get('t'): erros.append(f"{k}: alternativa {i} sem texto")
                if isinstance(a,dict) and not a.get('c'): avisos.append(f"{k}: alternativa {i} sem comentário")
        if not isinstance(q.get('correta'),int) or not (0<=q['correta']<5): erros.append(f"{k}: 'correta' deve ser índice 0–4")
        if len(str(q.get('enunciado','')))<60: erros.append(f"{k}: enunciado curto demais")
        if 'Dispositivo normativo' not in str(q.get('comentario','')): avisos.append(f"{k}: comentário sem transcrição do dispositivo")
        e=str(q.get('enunciado','')).strip().lower()[:160]
        if e in enunciados: avisos.append(f"{k}: enunciado parecido com {enunciados[e]}")
        enunciados[e]=q['id']
        por_disc[q.get('disc')]+=1; por_tema[q.get('tema')]+=1
ix=json.load(io.open(os.path.join(R,'dados','banco','index.json'),encoding='utf-8'))
if ix.get('total')!=total: erros.append(f"index.json: total {ix.get('total')} ≠ {total} questões nos arquivos")
for dd,n in por_disc.items():
    if ix['discs'].get(dd,{}).get('n')!=n: erros.append(f"index.json: disciplina {dd} com {ix['discs'].get(dd,{}).get('n')} ≠ {n}")
print(f"{total} questões · {len(por_disc)} disciplinas com banco · {len(por_tema)} temas com questões")
for a in avisos[:15]: print('  aviso:',a)
if len(avisos)>15: print(f'  … e mais {len(avisos)-15} avisos')
for e in erros: print('  ERRO:',e)
print('VALIDAÇÃO', 'OK' if not erros else f'FALHOU ({len(erros)} erros)')
sys.exit(1 if erros else 0)
