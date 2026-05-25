# AWS Lambda — Configuração Completa (Passo a Passo)

> **Problema comum:** `Failed to fetch` no browser = CORS não configurado no API Gateway.
> A Lambda pode estar funcionando, mas o browser bloqueia a resposta se os headers CORS estiverem ausentes.

---

## Pré-requisitos

- Conta AWS ativa (free tier suficiente)
- Acesso ao [console.aws.amazon.com](https://console.aws.amazon.com)
- Endpoint atual: `https://bc9xz2gk6b.execute-api.us-east-1.amazonaws.com/default/validador-pontuacao-curriculo`

---

## PARTE 1 — Verificar/Atualizar o Código da Lambda

### 1.1 Acessar a função

1. Acesse [console.aws.amazon.com](https://console.aws.amazon.com)
2. No campo de busca no topo, digite **Lambda** e clique
3. No menu lateral clique em **Funções**
4. Localize a função `validador-pontuacao-curriculo` e clique nela

### 1.2 Verificar o código

1. Na aba **Código**, clique em `index.mjs` (ou `index.js`)
2. Confirme que o código retorna os headers CORS em **todas** as respostas:

```javascript
// O retorno DEVE ter esses headers:
headers: {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
```

3. Se o código não tiver esses headers, substitua **todo o conteúdo** pelo código abaixo e clique em **Deploy**:

```javascript
export const handler = async (event) => {
  // CORS headers obrigatórios em TODAS as respostas
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Responder preflight OPTIONS (enviado automaticamente pelo browser antes do POST)
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const curriculo = (body.curriculo || '').toLowerCase();
    const palavras_chave = Array.isArray(body.palavras_chave) ? body.palavras_chave : [];

    if (!curriculo) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Campo "curriculo" obrigatório.' }),
      };
    }

    const encontradas = palavras_chave.filter(p =>
      curriculo.includes(p.toLowerCase().trim())
    );

    const total = palavras_chave.length;
    const pontuacao = total > 0 ? Math.round((encontradas.length / total) * 100) : 0;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        pontuacao,
        encontradas,
        nao_encontradas: palavras_chave.filter(p => !encontradas.includes(p)),
        total_palavras: total,
        total_encontradas: encontradas.length,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Erro interno.', detalhes: err.message }),
    };
  }
};
```

4. Clique no botão laranja **Deploy** (aguarde aparecer "Changes deployed")

### 1.3 Verificar o Runtime e Handler

1. Role a página até a seção **Configurações de runtime**
2. Clique em **Editar**
3. Confirme:
   - **Runtime:** Node.js 22.x (ou 20.x, 18.x — qualquer um funciona)
   - **Handler:** `index.handler`
4. Se alterou algo, clique em **Salvar**

---

## PARTE 2 — Configurar CORS no API Gateway

> Esta é a etapa mais crítica. O browser exige que o servidor HTTP (API Gateway) retorne headers CORS — não basta a Lambda retornar.

### 2.1 Identificar o tipo de API

1. No Console AWS, busque **API Gateway** na barra de pesquisa
2. Você verá a API ligada ao endpoint atual. Existem dois tipos:
   - **HTTP API** (mais novo, mais simples)
   - **REST API** (mais antigo)
   
   Para saber qual é: olhe a coluna **Tipo de protocolo** ou verifique se a URL tem `/default/` no path (indica HTTP API)

---

### 2.2-A Se for HTTP API (mais provável — URL tem `/default/`)

1. Clique na API para abrir
2. No menu lateral esquerdo, clique em **CORS**
3. Clique em **Configurar**
4. Preencha exatamente assim:

   | Campo | Valor |
   |-------|-------|
   | **Access-Control-Allow-Origin** | `*` |
   | **Access-Control-Allow-Headers** | `content-type` |
   | **Access-Control-Allow-Methods** | `POST, OPTIONS` |
   | **Access-Control-Expose-Headers** | *(deixar vazio)* |
   | **Access-Control-Max-Age** | `300` |
   | **Access-Control-Allow-Credentials** | *(desabilitado — incompatível com `*`)* |

5. Clique em **Salvar**

---

### 2.2-B Se for REST API

1. Clique na API para abrir
2. No menu lateral, clique em **Recursos**
3. Clique no recurso que representa seu endpoint (geralmente `/validador-pontuacao-curriculo`)
4. Clique no método **POST**
5. Clique em **Habilitar CORS** (botão no topo direito)
6. Na janela que abrir:
   - **Access-Control-Allow-Origin:** `'*'`
   - **Access-Control-Allow-Headers:** `'Content-Type,X-Amz-Date,Authorization,X-Api-Key'`
   - Marque os métodos: **POST**, **OPTIONS**
7. Clique em **Habilitar CORS e substituir cabeçalhos existentes**
8. Confirme clicando em **Sim, substituir os valores existentes**
9. **Importante:** Clique em **Ações → Implantar API**
   - Selecione o estágio: `default` (ou `prod`)
   - Clique em **Implantar**

---

## PARTE 3 — Testar se Funcionou

### 3.1 Teste direto (sem browser) via AWS Console

1. Na função Lambda, clique na aba **Teste**
2. Clique em **Criar novo evento de teste**
3. Cole este JSON no campo de evento:

```json
{
  "httpMethod": "POST",
  "body": "{\"curriculo\": \"profissional com experiência em javascript node.js sql gestão\", \"palavras_chave\": [\"javascript\", \"node.js\", \"sql\", \"gestão\", \"python\"]}",
  "headers": { "Content-Type": "application/json" }
}
```

4. Clique em **Testar**
5. Resultado esperado (statusCode 200):

```json
{
  "statusCode": 200,
  "headers": { "Access-Control-Allow-Origin": "*", ... },
  "body": "{\"pontuacao\":80,\"encontradas\":[\"javascript\",\"node.js\",\"sql\",\"gestão\"],\"nao_encontradas\":[\"python\"],\"total_palavras\":5,\"total_encontradas\":4}"
}
```

### 3.2 Teste real via curl (terminal)

```bash
curl -X POST "https://bc9xz2gk6b.execute-api.us-east-1.amazonaws.com/default/validador-pontuacao-curriculo" \
  -H "Content-Type: application/json" \
  -d '{"curriculo":"javascript node.js sql","palavras_chave":["javascript","python"]}'
```

Resposta esperada:
```json
{"pontuacao":50,"encontradas":["javascript"],"nao_encontradas":["python"],"total_palavras":2,"total_encontradas":1}
```

### 3.3 Verificar headers CORS via curl

```bash
curl -I -X OPTIONS "https://bc9xz2gk6b.execute-api.us-east-1.amazonaws.com/default/validador-pontuacao-curriculo" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST"
```

Deve retornar **obrigatoriamente**:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
```

Se esses headers **não aparecerem**, CORS não está configurado no API Gateway (voltar à Parte 2).

### 3.4 Testar no browser (DevTools)

1. Abra `frontend-app/index.html` no browser
2. Pressione **F12** → aba **Network**
3. Clique em "Analisar Candidato"
4. Procure a requisição para `validador-pontuacao-curriculo`
5. Verifique:
   - **Status:** deve ser `200`
   - Aba **Response Headers:** deve ter `access-control-allow-origin: *`
   - Se aparecer erro `CORS policy` no console → API Gateway CORS não configurado

---

## PARTE 4 — Diagnóstico de Erros Comuns

| Erro no frontend | Causa | Solução |
|------------------|-------|---------|
| `Failed to fetch` | CORS bloqueando no browser | Configurar CORS no API Gateway (Parte 2) |
| `Failed to fetch` + sem requisição na aba Network | URL incorreta ou sem internet | Verificar endpoint em `script.js` linha 11 |
| `HTTP 500` | Erro no código da Lambda | Ver logs no CloudWatch (Lambda → Monitor → Ver logs) |
| `HTTP 403` | Lambda sem permissão pública | API Gateway → Autorização → deve ser `NONE` |
| `HTTP 404` | Rota não existe no API Gateway | Verificar path da rota no API Gateway |
| Timeout 12s | Lambda cold start ou sem resposta | Aumentar timeout da Lambda (Config → Geral → Timeout: 30s) |
| `Cannot read properties of undefined` | Lambda retornou HTML em vez de JSON | Lambda com erro, retornou página de erro da AWS |

---

## PARTE 5 — Verificar Permissões da Lambda (se HTTP 403)

1. Na função Lambda, clique na aba **Configuração**
2. Clique em **Permissões** no menu lateral
3. Role até **Política baseada em recursos**
4. Deve existir uma entrada com:
   - **Principal:** `apigateway.amazonaws.com`
   - **Ação:** `lambda:InvokeFunction`
5. Se não existir:
   - Vá ao API Gateway → sua API → Integrações
   - Delete e recrie a integração apontando para a Lambda
   - O API Gateway cria a permissão automaticamente ao integrar

---

## PARTE 6 — Logs para Debug (CloudWatch)

Se a Lambda retornar 500 ou comportamento inesperado:

1. Na função Lambda, clique na aba **Monitor**
2. Clique em **Ver logs no CloudWatch**
3. Clique no log stream mais recente (topo da lista)
4. Procure linhas com `ERROR` ou a mensagem de erro
5. Cada invocação gera um bloco `START ... END ... REPORT`

---

## Checklist Final

- [ ] Código da Lambda tem `Access-Control-Allow-Origin: *` em todos os retornos
- [ ] Handler configurado como `index.handler`
- [ ] Runtime: Node.js 18.x ou superior
- [ ] Botão **Deploy** clicado após alterar código
- [ ] CORS configurado no API Gateway com `Allow-Origin: *` e métodos `POST, OPTIONS`
- [ ] REST API: re-implantada no estágio após configurar CORS
- [ ] Teste curl retorna `{"pontuacao": ...}` sem erros
- [ ] Headers CORS aparecem na resposta curl do OPTIONS
- [ ] Frontend abre sem erros `CORS policy` no console do browser (F12)
