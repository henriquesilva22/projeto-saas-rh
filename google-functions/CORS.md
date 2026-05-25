# Google Cloud Functions — Habilitar CORS (Passo a Passo)

> **Sintoma:** `No 'Access-Control-Allow-Origin' header` ou `CORS policy blocked`
> **Causa:** GCP Functions não tem painel de CORS — os headers devem ser retornados **pelo código da função**. Além disso, a função precisa ser **pública** (invocação não autenticada).

---

## Como CORS funciona no GCP Functions

Diferente de AWS API Gateway e Azure Function App, o Google Cloud Functions **não tem painel de CORS no console**.

Existem dois requisitos:

1. **Função pública** — sem autenticação obrigatória (IAM "allUsers" com papel invoker)
2. **Headers CORS no código** — a função deve retornar `Access-Control-Allow-Origin: *` em toda resposta, incluindo o preflight OPTIONS

O código já fornecido em `sugestao-treinamento/index.js` faz isso corretamente. Se a função que você deployou é diferente, veja a seção de correção de código abaixo.

---

## Parte 1 — Tornar a Função Pública

### Via Console GCP

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. No menu de busca, procure **Cloud Functions** e clique
3. Localize sua função `sugestao-treinamento` e clique nela
4. Clique na aba **Permissões** (ou **Security** dependendo da versão da interface)
5. Clique em **Adicionar principal** (ou **Grant Access**)
6. Preencha:
   - **Novo principal:** `allUsers`
   - **Papel:** `Cloud Functions Invoker`  
     *(procure digitando "invoker" no campo de papel)*
7. Clique em **Salvar**
8. Confirme o aviso de acesso público clicando em **Permitir acesso público**

> Se aparecer a mensagem *"This resource is public"* com um ícone de globo, está correto.

### Via gcloud CLI
```bash
gcloud functions add-iam-policy-binding sugestao-treinamento \
  --region=us-central1 \
  --member="allUsers" \
  --role="roles/cloudfunctions.invoker"
```

---

## Parte 2 — Verificar / Corrigir o Código da Função

### Verificar no Console GCP

1. Na função, clique na aba **Código-fonte** (ou **Source**)
2. Abra o arquivo `index.js`
3. Confirme que as primeiras linhas do handler definem os headers CORS:

```javascript
exports.sugestaoTreinamento = (req, res) => {
  // Estas 3 linhas DEVEM estar no início, antes de qualquer res.send/json
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Responder preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  // ...resto do código
};
```

> **Atenção:** `res.set()` deve ser chamado **antes** de qualquer `res.json()`, `res.send()` ou `res.status().json()`. Headers após o envio da resposta são ignorados.

### Se precisar corrigir o código

1. No console GCP → função → aba **Código-fonte**
2. Clique em **Editar** (ícone de lápis)
3. Substitua o conteúdo de `index.js` pelo código completo abaixo
4. Clique em **Implantar** e aguarde (leva 1–3 minutos)

```javascript
exports.sugestaoTreinamento = (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }

  try {
    const body = req.body || {};
    const pontuacao = parseInt(body.pontuacao, 10);

    if (isNaN(pontuacao) || pontuacao < 0 || pontuacao > 100) {
      res.status(400).json({ error: 'Campo "pontuacao" obrigatório (0–100).' });
      return;
    }

    let nivel, descricao, cursos;

    if (pontuacao >= 80) {
      nivel = 'Avançado';
      descricao = 'Perfil altamente qualificado. Cursos de liderança e especialização.';
      cursos = [
        { nome: 'Liderança e Gestão de Equipes',        carga: '40h', plataforma: 'Coursera'            },
        { nome: 'AWS Solutions Architect – Associate',   carga: '60h', plataforma: 'AWS Training'        },
        { nome: 'PMP — Gestão de Projetos',              carga: '35h', plataforma: 'PMI'                 },
        { nome: 'Design Thinking para RH',               carga: '20h', plataforma: 'Udemy'               },
      ];
    } else if (pontuacao >= 50) {
      nivel = 'Intermediário';
      descricao = 'Bom perfil técnico. Fortalecer competências práticas e transversais.';
      cursos = [
        { nome: 'Comunicação Corporativa e Escrita',     carga: '20h', plataforma: 'Alura'               },
        { nome: 'Excel Avançado e Power BI',             carga: '30h', plataforma: 'Udemy'               },
        { nome: 'Fundamentos de Cloud Computing',        carga: '25h', plataforma: 'Google Cloud Skills'  },
        { nome: 'Metodologias Ágeis (Scrum & Kanban)',   carga: '15h', plataforma: 'Coursera'            },
      ];
    } else if (pontuacao >= 20) {
      nivel = 'Básico';
      descricao = 'Perfil em desenvolvimento. Priorizar fundamentos.';
      cursos = [
        { nome: 'Pacote Office',                         carga: '20h', plataforma: 'Fundação Bradesco'   },
        { nome: 'Português Empresarial',                 carga: '15h', plataforma: 'Senai'               },
        { nome: 'Lógica de Programação',                 carga: '30h', plataforma: 'Alura'               },
        { nome: 'Ética Profissional',                    carga: '10h', plataforma: 'Sebrae'              },
      ];
    } else {
      nivel = 'Iniciante';
      descricao = 'Perfil inicial. Cursos de nivelamento recomendados.';
      cursos = [
        { nome: 'Introdução à Informática',              carga: '20h', plataforma: 'Fundação Bradesco'   },
        { nome: 'Digitação e Uso do Computador',         carga: '10h', plataforma: 'Senai'               },
        { nome: 'Matemática Básica',                     carga: '25h', plataforma: 'Khan Academy'        },
        { nome: 'Introdução ao Mercado de Trabalho',     carga: '10h', plataforma: 'Sebrae'              },
      ];
    }

    res.status(200).json({ pontuacao, nivel, descricao, total_cursos: cursos.length, cursos });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.', detalhes: err.message });
  }
};
```

---

## Parte 3 — Configurar Ponto de Entrada Correto

1. No console GCP → função → aba **Configuração de runtime** (ou durante criação)
2. Certifique que:
   - **Runtime:** Node.js 20 (ou 18)
   - **Ponto de entrada (Entry point):** `sugestaoTreinamento`
   
> O ponto de entrada é o **nome do export** no `index.js` — deve ser `sugestaoTreinamento` (camelCase), não `sugestao-treinamento`.

---

## Parte 4 — Verificar URL do Endpoint

Após o deploy, a URL segue o padrão:
```
https://REGIAO-NOME_PROJETO.cloudfunctions.net/sugestao-treinamento
```

Para pegar a URL correta:
1. Console GCP → Cloud Functions → clique na função
2. Aba **Detalhes** (ou Overview)
3. Copie o valor em **URL de acionamento** (Trigger URL)

Atualize `frontend-app/script.js` linha com `gcp:`:
```javascript
gcp: 'https://REGIAO-NOME_PROJETO.cloudfunctions.net/sugestao-treinamento',
```

---

## Parte 5 — Testar

### curl OPTIONS (preflight)
```bash
curl -si -X OPTIONS \
  "https://SEU_ENDPOINT_GCP.cloudfunctions.net/sugestao-treinamento" \
  -H "Origin: http://127.0.0.1:5500" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  | head -15
```

**Resposta esperada:**
```
HTTP/2 204
access-control-allow-origin: *
access-control-allow-methods: POST, OPTIONS
access-control-allow-headers: Content-Type
```

### curl POST (teste real)
```bash
curl -X POST \
  "https://SEU_ENDPOINT_GCP.cloudfunctions.net/sugestao-treinamento" \
  -H "Content-Type: application/json" \
  -d '{"pontuacao": 75}'
```

**Resposta esperada:**
```json
{
  "pontuacao": 75,
  "nivel": "Intermediário",
  "descricao": "Bom perfil técnico...",
  "total_cursos": 4,
  "cursos": [...]
}
```

---

## Tabela de Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `No 'Access-Control-Allow-Origin'` | Headers CORS ausentes no código | Adicionar `res.set('Access-Control-Allow-Origin', '*')` antes de qualquer resposta |
| `HTTP 403 Forbidden` | Função não é pública | Adicionar IAM `allUsers` → `Cloud Functions Invoker` (Parte 1) |
| `HTTP 404 Not Found` | URL errada ou função não deployada | Verificar URL no console GCP → Detalhes |
| `HTTP 500` após CORS ok | Erro no código da função | Console GCP → Função → **Logs** |
| Timeout 12s | Cold start lento (1ª chamada) | Normal — 2ª chamada é rápida. Aumentar timeout no frontend se necessário |
| `FUNCTION_NOT_FOUND` | Entry point errado | Corrigir para `sugestaoTreinamento` nas configurações de runtime |
| `Cannot parse JSON` | Body sem `Content-Type: application/json` | Frontend já envia — verificar se o header está na requisição (F12 → Network) |

---

## Deploy via CLI (alternativa ao console)

```bash
cd google-functions/sugestao-treinamento

gcloud functions deploy sugestao-treinamento \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=sugestaoTreinamento \
  --trigger-http \
  --allow-unauthenticated \
  --max-instances=10
```

> `--allow-unauthenticated` = equivale a adicionar `allUsers` → Invoker no IAM. Sem essa flag, função exige token de autenticação e dará 403.

---

## Checklist Final

- [ ] Função deployada com sucesso (status "Ativo" no console)
- [ ] IAM configurado: `allUsers` tem papel `Cloud Functions Invoker`
- [ ] Código tem `res.set('Access-Control-Allow-Origin', '*')` antes de qualquer resposta
- [ ] Código responde OPTIONS com status `204`
- [ ] Entry point configurado como `sugestaoTreinamento`
- [ ] URL de acionamento copiada e colada em `script.js` (campo `gcp:`)
- [ ] curl OPTIONS retorna `204` com header CORS
- [ ] curl POST retorna JSON com `nivel` e `cursos`
- [ ] Frontend mostra card GCP sem erro CORS
