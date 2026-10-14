# -*- coding: utf-8 -*-
"""Gera dados/taxonomia.json, dados/banco/*.json e src/dados_disc.js.
Fontes: ferramentas/recortes_enac4.json (recortes dos e-books), ferramentas/disc_planner_geral.json (temas do
Planner Geral para Tributário, Processo Civil e Empresarial) e um banco de questões no esquema do ENAC 4 passado
como argumento (caminho do banco-enac4.json). Uso: python3 ferramentas/gerar_dados.py /caminho/banco-enac4.json"""
import io,json,re,os,sys,collections
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F=os.path.join(R,'ferramentas')
REC=json.load(io.open(os.path.join(F,'recortes_enac4.json'),encoding='utf-8'))
PG=json.load(io.open(os.path.join(F,'disc_planner_geral.json'),encoding='utf-8'))
BANCO=json.load(io.open(sys.argv[1],encoding='utf-8'))['questoes'] if len(sys.argv)>1 else []
EB2DISC={'nr':'tg','not':'notas','ri':'ri','rcpn':'rcpn','rtd':'rtd','prot':'prot','mlg':'mlg','leg':'leg','civ':'civil','con':'consti','adm':'adm'}
DISCIPLINAS=[
 {'id':'tg','nome':'Legislação Notarial e Registral','curto':'Not/Reg','ebook':'Legislação Notarial e Registral — LRP, Lei 8.935 e SERP','grupo':'Notarial e Registral','rw':1.25},
 {'id':'notas','nome':'Tabelionato de Notas','curto':'Notas','ebook':'Tabelionato de Notas','grupo':'Notarial e Registral','rw':1.25},
 {'id':'ri','nome':'Registro de Imóveis','curto':'RI','ebook':'Registro de Imóveis','grupo':'Notarial e Registral','rw':1.25},
 {'id':'rcpn','nome':'Registro Civil das Pessoas Naturais','curto':'RCPN','ebook':'Registro Civil das Pessoas Naturais','grupo':'Notarial e Registral','rw':1.25},
 {'id':'rtd','nome':'RTD e RCPJ','curto':'RTD/RCPJ','ebook':'Registro de Títulos e Documentos e RCPJ','grupo':'Notarial e Registral','rw':1.25},
 {'id':'prot','nome':'Tabelionato de Protesto','curto':'Protesto','ebook':'Tabelionato de Protesto','grupo':'Notarial e Registral','rw':1.25},
 {'id':'mlg','nome':'Marco Legal das Garantias','curto':'MLG','ebook':'Marco Legal das Garantias','grupo':'Notarial e Registral','rw':1.1},
 {'id':'leg','nome':'Legislação Especial','curto':'Leg. Especial','ebook':'Legislação Especial','grupo':'Notarial e Registral','rw':1.0},
 {'id':'civil','nome':'Direito Civil','curto':'Civil','ebook':'Direito Civil','grupo':'Direito Privado','rw':1.0},
 {'id':'emp','nome':'Direito Empresarial','curto':'Empresarial','ebook':'Direito Empresarial','grupo':'Direito Privado','rw':0.8},
 {'id':'consti','nome':'Direito Constitucional','curto':'Constitucional','ebook':'Direito Constitucional','grupo':'Direito Público','rw':0.8},
 {'id':'adm','nome':'Direito Administrativo','curto':'Administrativo','ebook':'Direito Administrativo','grupo':'Direito Público','rw':0.8},
 {'id':'trib','nome':'Direito Tributário','curto':'Tributário','ebook':'Direito Tributário','grupo':'Direito Público','rw':0.8},
 {'id':'pcivil','nome':'Direito Processual Civil','curto':'Processo Civil','ebook':'Processo Civil','grupo':'Direito Público','rw':0.8},
]
RITMO=15.0
def subtemas(titulo,prefixo):
    t=re.sub(r'\([^)]*\)','',titulo)
    t=re.sub(r'^[^—:]+[—:]\s*','',t) if ('—' in t or ':' in t) and len(t.split('—')[0])<70 else t
    partes=[p.strip(' .;') for p in re.split(r';|,|\be\b(?=\s+[a-záéíóúç])',t) if p.strip(' .;')]
    out=[];vistos=set()
    for p in partes:
        if len(p)<4 or p.lower() in vistos: continue
        vistos.add(p.lower()); out.append({'id':f'{prefixo}.{len(out)+1}','nome':p[0].upper()+p[1:]})
    return out[:8]
TEMAS=[]
for r in REC:
    d=EB2DISC[r['eb']]; pags=max(1,r['pf']-r['pi']+1); h=round(max(0.5,pags/RITMO)*2)/2
    TEMAS.append({'id':r['id'],'disc':d,'nome':r['t'],'h':h,'prio':r.get('p',2),'ebook':True,'pi':r['pi'],'pf':r['pf'],'unidade':'E-book BV','subtemas':subtemas(r['t'],r['id']),'origem':'recorte'})
for k in ['trib','pcivil','emp']:
    for ui,U in enumerate(PG[k]['units']):
        for ti,(nome,h) in enumerate(U['t']):
            tid=f'{k.upper()[:2]}{ui+1}-{ti+1:02d}'
            TEMAS.append({'id':tid,'disc':k,'nome':nome,'h':h,'prio':2,'ebook':False,'pi':None,'pf':None,'unidade':U['name'],'subtemas':subtemas(nome,tid),'origem':'planner-geral'})
VER=os.environ.get('VERSAO','2026.10.14-v0.1')
json.dump({'versao':VER,'disciplinas':DISCIPLINAS,'temas':TEMAS},io.open(os.path.join(R,'dados','taxonomia.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
if BANCO:
    Q=[]
    for q in BANCO:
        rec=next((r for r in REC if r['id']==q['recorte']),None)
        Q.append({'id':q['id'],'disc':EB2DISC[rec['eb']],'tema':q['recorte'],'subtema':None,'pi':q.get('pi'),'fonte':q.get('fonte',''),'banca':'BV · ENAC 4','ano':2026,'dificuldade':None,'formato':q.get('formato',''),'enunciado':q['enunciado'],'alternativas':q['alternativas'],'correta':q['correta'],'comentario':q['comentario'],'rev':q.get('rev',0),'conferir':bool(q.get('conferir'))})
    por=collections.defaultdict(list)
    for q in Q: por[q['disc']].append(q)
    os.makedirs(os.path.join(R,'dados','banco'),exist_ok=True)
    idx={'versao':VER,'gerado':VER[:10].replace('.','-'),'total':len(Q),'discs':{},'temas':collections.Counter(q['tema'] for q in Q)}
    for d in DISCIPLINAS:
        qs=por.get(d['id'],[])
        json.dump({'versao':VER,'disc':d['id'],'total':len(qs),'questoes':qs},io.open(os.path.join(R,'dados','banco',d['id']+'.json'),'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
        idx['discs'][d['id']]={'n':len(qs),'arquivo':d['id']+'.json'}
    json.dump(idx,io.open(os.path.join(R,'dados','banco','index.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=0)
DISC={}
for d in DISCIPLINAS:
    units={}
    for t in [t for t in TEMAS if t['disc']==d['id']]: units.setdefault(t['unidade'],[]).append([t['nome'],t['h'],t['id']])
    DISC[d['id']]={'name':d['nome'],'short':d['curto'],'rw':d['rw'],'book':d['ebook'],'qc':None,'units':[{'name':n,'t':v} for n,v in units.items()]}
TRACKS=[['tg','rcpn','notas','ri','mlg','prot','rtd','leg'],['civil','emp'],['consti','adm','trib'],['pcivil']]
io.open(os.path.join(R,'src','dados_disc.js'),'w',encoding='utf-8').write('/* gerado por ferramentas/gerar_dados.py */\nvar DISC = '+json.dumps(DISC,ensure_ascii=False)+';\nvar TRACKS = '+json.dumps(TRACKS)+';\nvar DISC_ORDER = '+json.dumps([d['id'] for d in DISCIPLINAS])+';\n')
print('taxonomia:',len(DISCIPLINAS),'disciplinas,',len(TEMAS),'temas; questões:',len(BANCO))
