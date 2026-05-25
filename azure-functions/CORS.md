# Azure Functions — Habilitar CORS (Passo a Passo)

> **Sintoma:** `400 The origin '...' is not allowed` ou `No 'Access-Control-Allow-Origin' header`
> **Causa:** Azure Function App valida a origem da requisição. Se não estiver na lista, bloqueia o preflight OPTIONS com 400.

---

## REGRA CRÍTICA DO AZURE

> Azure **não permite misturar** `*` com origens específicas.
> Se a lista tiver `https://functions.azure.com` E `*` ao mesmo tempo, o `*` é ignorado.
> A lista deve ter **SOMENTE `*`** — sem mais nada.

---

## Passo 1 — Acessar o Portal Azure

1. Acesse [portal.azure.com](https://portal.azure.com)
2. Faça login com sua conta
3. No campo de busca no topo, digite o nome do seu Function App:
   `saas-conversor-moeda-d6fcaseqg0ecducd`
4. Clique no recurso que aparecer (ícone de raio ⚡ = Function App)

---

## Passo 2 — Localizar as configurações de CORS

1. No menu lateral esquerdo, role até a seção **API**
2. Clique em **CORS**

> Se não encontrar "API" no menu lateral:
> - Clique em **Configurações** (ou Settings)
> - Procure por "CORS" na lista

---

## Passo 3 — Limpar origens existentes

1. Na tela de CORS, você verá uma lista de origens permitidas
2. **Apague TODAS** as entradas da lista, uma por uma clicando no ícone de lixeira (🗑) de cada uma
   - Isso inclui entradas padrão como:
     - `https://functions.azure.com`
     - `https://functions-staging.azure.com`
     - Qualquer outra URL que estiver listada
3. A lista deve ficar **completamente vazia** antes de continuar

---

## Passo 4 — Adicionar wildcard `*`

1. No campo de texto que diz **"Origens permitidas"** (ou *Allowed Origins*), digite:
   ```
   *
   ```
2. Clique no botão **+** (ou "Adicionar") ao lado do campo
3. O `*` deve aparecer na lista

---

## Passo 5 — Desabilitar credenciais (obrigatório com `*`)

1. Verifique se existe uma opção **"Habilitar Access-Control-Allow-Credentials"**
2. Se existir, certifique-se que está **DESABILITADA / desmarcada**

> `Allow-Credentials: true` é incompatível com `Allow-Origin: *`.
> Com `*`, credenciais (cookies, headers de auth) são bloqueadas pelo browser por padrão.

---

## Passo 6 — Salvar

1. Clique no botão **Salvar** no topo da página
2. Aguarde a mensagem de confirmação: *"CORS settings updated"*
3. **Aguarde 60 segundos** — Azure demora para propagar mudanças de CORS

---

## Passo 7 — Verificar se funcionou

### Via curl (terminal)
```bash
curl -si -X OPTIONS \
  "https://saas-conversor-moeda-d6fcaseqg0ecducd.canadaeast-01.azurewebsites.net/api/CalculadoraSalarioLiquido" \
  -H "Origin: http://127.0.0.1:5500" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  | head -20
```

**Resposta esperada (sucesso):**
```
HTTP/1.1 204 No Content
access-control-allow-origin: *
access-control-allow-methods: POST, OPTIONS
access-control-allow-headers: content-type
```

**Resposta de falha (ainda bloqueado):**
```
HTTP/1.1 400 The origin '...' is not allowed.
```

### Via curl — Teste real POST
```bash
curl -X POST \
  "https://saas-conversor-moeda-d6fcaseqg0ecducd.canadaeast-01.azurewebsites.net/api/CalculadoraSalarioLiquido" \
  -H "Content-Type: application/json" \
  -d '{"salario_bruto": 5000, "salarioBruto": 5000}'
```

Resposta esperada: JSON com campos de salário líquido, INSS, IRRF, etc.

---

## Passo 8 — Se o CORS do portal não resolver

Alguns Function Apps ignoram o CORS do portal quando a função usa **isolated process** ou **Flex Consumption**. Nesses casos, adicione os headers diretamente no código da função.

Abra o código da função `CalculadoraSalarioLiquido` no portal (ou VS Code) e verifique se o retorno inclui:

```javascript
// Node.js — Azure Functions v4 (modelo programático)
app.http('CalculadoraSalarioLiquido', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // ... lógica da função ...

    return new Response(JSON.stringify(resultado), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
});
```

---

## Tabela de Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `400 The origin '...' is not allowed` | Origem não está na lista | Limpar lista e adicionar `*` |
| `No 'Access-Control-Allow-Origin' header` | CORS não configurado | Seguir os Passos 1–6 |
| `*` na lista mas ainda bloqueando | Outras origens na lista conflitando | Apagar TUDO, deixar só `*` |
| `CORS policy: credentials flag` | Allow-Credentials ativo com `*` | Desabilitar Allow-Credentials |
| `HTTP 500` após configurar CORS | Erro na função em si | Ver logs: Function App → Monitor → Logs |
| `HTTP 401` ou `HTTP 403` | Função com autenticação obrigatória | Function App → Autenticação → Desabilitar, OU mudar `authLevel` para `anonymous` |

---

## Verificação de authLevel (se der 401/403)

1. Portal Azure → Function App → **Funções**
2. Clique em `CalculadoraSalarioLiquido`
3. Clique em **Chaves de função** (Function Keys)
4. Se a função exigir chave, mude o `authLevel`:
   - No código: `authLevel: 'anonymous'`
   - No `function.json`: `"authLevel": "anonymous"`

---

## Checklist Final

- [ ] Acessou Function App correto no portal
- [ ] Apagou TODAS as origens da lista CORS
- [ ] Adicionou SOMENTE `*`
- [ ] Allow-Credentials está DESABILITADO
- [ ] Clicou em Salvar e aguardou 60s
- [ ] curl OPTIONS retorna `HTTP 204` com header `access-control-allow-origin: *`
- [ ] curl POST retorna JSON com dados de salário
- [ ] Frontend mostra card Azure sem erro CORS
