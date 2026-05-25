# Azure Functions — Calculadora de Salário

## Runtime
Node.js 18 LTS

## Deploy via Portal Azure
1. Portal Azure → Criar recurso → **Function App**
2. Configurar:
   - Runtime: **Node.js 18**
   - OS: Linux
   - Plano: **Consumo (Serverless)**
3. Após criar → **Functions → + Criar → HTTP Trigger**
   - Nome: `calculadora-salario`
   - Auth: **Anonymous**
4. Upload dos arquivos `index.js` e `function.json` via editor inline ou VS Code Extension

## Deploy via Azure CLI
```bash
# Instalar Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Login
az login

# Criar Function App (substituir NOME_APP e RESOURCE_GROUP)
az functionapp create \
  --resource-group RESOURCE_GROUP \
  --consumption-plan-location brazilsouth \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name NOME_APP \
  --storage-account STORAGE_ACCOUNT

# Deploy
cd azure-functions
func azure functionapp publish NOME_APP
```

## Endpoint após deploy
```
POST https://NOME_APP.azurewebsites.net/api/calculadora-salario
```

## Request
```json
{ "salario_bruto": 5000 }
```

## Response
```json
{
  "salario_bruto": 5000.00,
  "inss": 520.53,
  "irrf": 95.23,
  "descontos_totais": 615.76,
  "salario_liquido": 4384.24,
  "aliquota_efetiva_pct": 12.3
}
```

## CORS
Configurado no `host.json` com `allowedOrigins: ["*"]`.
Também configure no Portal: Function App → **CORS → adicionar `*`**
