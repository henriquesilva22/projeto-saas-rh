# Google Cloud Functions — Sugestão de Treinamento

## Runtime
Node.js 20

## Deploy via Console GCP
1. console.cloud.google.com → **Cloud Functions → Criar Função**
2. Configurar:
   - Nome: `sugestao-treinamento`
   - Região: `us-central1` (ou `southamerica-east1`)
   - Gatilho: **HTTP**
   - Autenticação: **Permitir invocações não autenticadas** ✅
3. Runtime: **Node.js 20**
4. Ponto de entrada: `sugestaoTreinamento`
5. Colar código de `index.js` e `package.json`

## Deploy via gcloud CLI
```bash
cd google-functions/sugestao-treinamento

gcloud functions deploy sugestao-treinamento \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point sugestaoTreinamento \
  --region us-central1
```

## Endpoint após deploy
```
POST https://REGIAO-PROJETO.cloudfunctions.net/sugestao-treinamento
```

## Request
```json
{ "pontuacao": 75 }
```

## Response
```json
{
  "pontuacao": 75,
  "nivel": "Intermediário",
  "descricao": "Bom perfil técnico...",
  "total_cursos": 4,
  "cursos": [
    { "nome": "Comunicação Corporativa", "carga": "20h", "plataforma": "Alura" }
  ]
}
```

## CORS
CORS tratado no `index.js` via `res.set('Access-Control-Allow-Origin', '*')`.
GCP respeita os headers da função — nenhuma config extra necessária.
