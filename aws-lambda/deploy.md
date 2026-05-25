# AWS Lambda — Validador de Currículo

## Endpoint (já implantado)
```
POST https://bc9xz2gk6b.execute-api.us-east-1.amazonaws.com/default/validador-pontuacao-curriculo
```

## Runtime
Node.js 22.x (ESM — `index.mjs`, handler: `index.handler`)

## Request
```json
{
  "curriculo": "Texto completo do currículo...",
  "palavras_chave": ["javascript", "node.js", "sql", "gestão"]
}
```

## Response
```json
{
  "pontuacao": 75,
  "encontradas": ["javascript", "node.js", "sql"],
  "nao_encontradas": ["gestão"],
  "total_palavras": 4,
  "total_encontradas": 3
}
```

## Deploy manual (se necessário)
1. Zipar `index.mjs`
2. AWS Console → Lambda → Criar função → Node.js 22.x
3. Upload zip
4. API Gateway → HTTP API → Integração Lambda → Habilitar CORS
5. Handler: `index.handler`
