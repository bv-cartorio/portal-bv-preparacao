# -*- coding: utf-8 -*-
"""Monta dist/ a partir de src/ e dados/. Uso: python3 ferramentas/build.py"""
import io,json,os,re,subprocess,shutil,sys
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S=os.path.join(R,'src')+'/'; D=os.path.join(R,'dist')+'/'; DB=os.path.join(R,'dados','banco')+'/'
tax=io.open(os.path.join(R,'dados','taxonomia.json'),encoding='utf-8').read()
idx=io.open(DB+'index.json',encoding='utf-8').read()
cfg=io.open(os.path.join(R,'dados','config.json'),encoding='utf-8').read()
ler=lambda n: io.open(S+n,encoding='utf-8').read()
html=''.join([ler('01_head.html'), ler('02_shell.html'),
  "'use strict';\nvar TAXONOMIA = "+tax+";\nvar BANCO_INDEX = "+idx+";\nvar CONFIG_REMOTA = "+cfg+";\n",
  ler('dados_disc.js'), ler('engine_planner_geral.js'), ler('03_core.js').replace("'use strict';\n",''),
  ler('04_salvaguarda.js'), ler('05_nuvem.js'), ler('06_render.js'), ler('07_boot.js')])
if os.path.isdir(D): shutil.rmtree(D)
os.makedirs(D+'dados/banco')
io.open(D+'index.html','w',encoding='utf-8').write(html)
for f in os.listdir(DB): shutil.copy(DB+f, D+'dados/banco/'+f)
shutil.copy(os.path.join(R,'dados','taxonomia.json'), D+'dados/taxonomia.json')
io.open(D+'.nojekyll','w').write('')
m=re.search(r'<script>(.*)</script>\s*</body>',html,re.S)
tmp=os.path.join(R,'dist','_check.js'); io.open(tmp,'w',encoding='utf-8').write(m.group(1))
r=subprocess.run(['node','--check',tmp],capture_output=True,text=True); os.remove(tmp)
print('index.html %d bytes · %s'%(len(html.encode('utf-8')),'SINTAXE OK' if r.returncode==0 else 'ERRO:\n'+r.stderr[:1200]))
sys.exit(0 if r.returncode==0 else 1)
