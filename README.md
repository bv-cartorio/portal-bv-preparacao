# Portal BV Preparação para Concursos de Cartório

Portal de preparação de médio e longo prazo da **BV Cartórios**: planner flexível por disciplinas, tempo e prazo, banco de questões comentadas organizado por **disciplina → tema → subtema**, diagnóstico por domínio e salvaguarda do progresso.

Produto independente do Portal ENAC 4.

## Como funciona a publicação

Todo `push` na branch `main` dispara a ação em `.github/workflows/publicar.yml`:

1. **valida** a taxonomia e o banco (`ferramentas/validar_banco.py`) — ids únicos, disciplina e tema existentes, cinco alternativas, gabarito válido;
2. **monta** o portal (`ferramentas/build.py`) em `dist/`;
3. **publica** `dist/` no GitHub Pages.

Se a validação falhar, nada é publicado e o erro aparece na aba *Actions*.

## O banco de dados vive aqui

| Pasta / arquivo | O que é |
|---|---|
| `dados/taxonomia.json` | disciplinas, temas (com e-book e páginas) e subtemas |
| `dados/banco/<disciplina>.json` | as questões daquela disciplina |
| `dados/banco/index.json` | versão do banco e contagens — o portal lê este arquivo para saber se há novidade |

Para acrescentar ou corrigir questões: edite o arquivo da disciplina, atualize o `total`, as contagens e a `versao` (formato `AAAA.MM.DD-rótulo`) em `index.json`, e faça o commit. O portal dos alunos busca o índice a cada abertura; se a versão for mais nova, recarrega as disciplinas abertas. Versão com data anterior é recusada.

Esquema de uma questão:

```json
{ "id": "R1-07", "disc": "ri", "tema": "R1", "subtema": null, "pi": 12,
  "fonte": "Lei 6.015/73, art. 1º", "banca": "BV · ENAC 4", "ano": 2026, "dificuldade": null,
  "formato": "afirmativas", "enunciado": "…", "alternativas": [{ "t": "…", "c": "…" }],
  "correta": 2, "comentario": "… \nDispositivo normativo: …", "rev": 0, "conferir": false }
```

Regras que o portal garante: nenhuma rotina remove resposta de aluno; respostas seguem a alternativa pela impressão digital do texto quando a ordem muda; o banco nunca é gravado no `localStorage` do aluno.

## Estrutura

```
src/          fontes do portal (CSS, casca, núcleo, motor do planner, salvaguarda, telas, partida)
dados/        taxonomia e banco de questões (o "banco de dados")
ferramentas/  build.py, validar_banco.py, gerar_dados.py
testes/       suíte de fumaça em navegador real (Playwright)
dist/         saída montada (gerada; não versionar)
```

Montar localmente: `python3 ferramentas/build.py` e servir `dist/` com qualquer servidor estático.

## Progresso do aluno

Fica no navegador (base primária), com cópia automática a cada 5 minutos, restauração em um clique e backup por arquivo ou código. A nuvem (abaixo) espelha esse progresso por e-mail e código de retomada; o GitHub guarda o conteúdo, não o progresso individual.

## Nuvem (sincronização a cada 5 minutos)

O script em `nuvem/Codigo.gs` roda na conta Google da BV e grava o progresso de cada aluno em uma planilha (painel) e em arquivos no Drive. Depois de publicado como *app da web*, cole a URL `/exec` em `dados/config.json`:

```json
{ "sync": { "url": "https://script.google.com/macros/s/.../exec", "intervalo": 300000, "portal": "preparacao" } }
```

O commit republica o portal com a nuvem ativa. O aluno liga a nuvem na aba **Progresso** com e-mail e código de retomada; dali em diante o portal sincroniza 1,5 s após abrir, a cada 5 minutos, ao esconder a aba e ao sair. Toda troca é união — nem o navegador nem a nuvem perdem registro; só sai a questão que o próprio aluno mandou refazer. O mesmo script atende o Portal ENAC 4 (campo `portal`).

Testes locais da nuvem: `node testes/stub_nuvem.js` imita o script; aponte `dados/config.json` para `http://127.0.0.1:8766/exec`, monte e rode `node testes/nuvem.js`.
