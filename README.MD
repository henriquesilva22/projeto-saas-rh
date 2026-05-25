# ☁️ RH SaaS — Plataforma Multicloud de Recursos Humanos

> **FATEC** · Implementação de Micro-Serviços SaaS (FaaS / Serverless) · **Grupo B**

[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-FF9900?logo=amazonaws&logoColor=white)](https://aws.amazon.com/lambda/)
[![Azure Functions](https://img.shields.io/badge/Azure-Functions-0078D4?logo=microsoftazure&logoColor=white)](https://azure.microsoft.com/products/functions)
[![Google Cloud](https://img.shields.io/badge/GCP-Cloud_Run-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![Firebase](https://img.shields.io/badge/Firebase-Hosting-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/products/hosting)

---

## 🎯 Objetivo

Sistema SaaS de RH que integra **três funções serverless em nuvens distintas**, orquestradas por um frontend estático hospedado no Firebase Hosting. Demonstra comunicação multicloud simultânea, resiliência a falhas e comparação de latência entre provedores.

---

## 🏗️ Diagrama de Arquitetura

```
┌────────────────────────────────────────────────────────────────────┐
│                        USUÁRIO (Browser)                            │
│          https://saas-rh-multicloud.web.app  (Firebase Hosting)    │
└──────────────────┬──────────────┬─────────────────┬───────────────┘
                   │ POST         │ POST             │ POST
                   │ (paralelo)   │ (paralelo)       │ (encadeado*)
                   ▼              ▼                  ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │  AWS Lambda  │  │    Azure     │  │   Google     │
        │  us-east-1   │  │  canadaeast  │  │  us-central1 │
        │              │  │              │  │              │
        │  Validador   │  │ Calculadora  │  │  Sugestão    │
        │  Currículo   │  │  Salário     │  │ Treinamento  │
        │  Node.js     │  │  Node.js     │  │  Node.js     │
        │              │  │              │  │              │
        │ pontuacao ──────────────────────────────► input  │
        └──────────────┘  └──────────────┘  └──────────────┘

* GCP recebe a pontuação calculada pela AWS como input
```

**Fluxo de orquestração:**
1. AWS (validação) + Azure (salário) chamados **em paralelo** via `Promise.all`
2. Pontuação retornada pela AWS alimenta o GCP (treinamentos encadeados)
3. Cada chamada tem `try/catch` + `AbortController` (12s timeout) — falha isolada não afeta os demais

---

## ⚡ Endpoints em Produção

| Provedor | Serviço | Endpoint | Região |
|----------|---------|----------|--------|
| **AWS Lambda** | Validador de Currículo | `https://ymjlkfllucqx53nea72zo2f5ie0gvxxz.lambda-url.us-east-1.on.aws/` | us-east-1 |
| **Azure Functions** | Calculadora de Salário | `https://saas-conversor-moeda-d6fcaseqg0ecducd.canadaeast-01.azurewebsites.net/api/CalculadoraSalarioLiquido` | Canada East |
| **Google Cloud Run** | Sugestão de Treinamento | `https://sugestaotreinamento-941802379150.us-central1.run.app` | us-central1 |
| **Firebase Hosting** | Frontend (Static) | `https://saas-rh-multicloud.web.app` | Global CDN |

---

## 📊 Métricas de Latência

Medições via `performance.now()` no browser — aba Network do DevTools.

| Provedor | Serviço | Latência Média | HTTP Status |
|----------|---------|---------------|-------------|
| AWS Lambda | Validador de Currículo | ~326 ms | ✅ 200 |
| Azure Functions | Calculadora de Salário | ~314 ms | ✅ 200 |
| Google Cloud Run | Sugestão de Treinamento | ~349 ms | ✅ 200 |
| **Total orquestrado** | AWS+Azure paralelo → GCP | **~676 ms** | — |

> **Análise:** AWS e Azure executam em paralelo (~326ms simultâneos). GCP executa após AWS retornar (~349ms adicionais). Arquitetura paralela economiza ~30% vs execução sequencial (~989ms).

---

## Estrutura do Repositório

```
/aws-lambda
  index.mjs          ← Código da função Lambda (Node.js ESM)
  deploy.md          ← Instruções de deploy

/azure-functions
  host.json          ← Configuração global + CORS
  package.json
  calculadora-salario/
    index.js         ← Lógica da função (INSS + IRRF 2024)
    function.json    ← Binding HTTP Trigger (anonymous)
  deploy.md          ← Instruções de deploy

/google-functions
  sugestao-treinamento/
    index.js         ← Lógica da função (cursos por pontuação)
    package.json
  deploy.md          ← Instruções de deploy

/frontend-app
  index.html         ← Estrutura da página única
  style.css          ← Tema dark, responsivo
  script.js          ← Orquestração fetch + fallback + latências

README.md            ← Este arquivo
```

---

## 🗂️ Estrutura do Repositório

```
/
├── aws-lambda/
│   ├── index.mjs              # Função Lambda — Node.js ESM
│   ├── deploy.md              # Instruções de deploy
│   └── CONFIGURACAO.md        # Guia CORS + diagnóstico passo a passo
│
├── azure-functions/
│   ├── calculadora-salario/
│   │   ├── index.js           # Função Azure — INSS + IRRF 2024
│   │   └── function.json      # Binding HTTP Trigger (anonymous)
│   ├── host.json              # Config global + CORS
│   ├── package.json
│   ├── deploy.md              # Instruções de deploy
│   └── CORS.md                # Guia CORS passo a passo
│
├── google-functions/
│   ├── sugestao-treinamento/
│   │   ├── index.js           # Função GCP — sugestão por pontuação
│   │   └── package.json
│   ├── deploy.md              # Instruções de deploy
│   └── CORS.md                # Guia CORS passo a passo
│
├── frontend-app/
│   ├── index.html             # SPA — cards multicloud
│   ├── style.css              # Tema dark, responsivo, estados visuais
│   └── script.js              # Orquestração, extração de skills, fallback
│
├── .gitignore
└── README.md
```

---

## 🚀 Como Executar Localmente

```bash
# Servidor estático (recomendado — evita CORS de file://)
npx serve frontend-app
# ou
npx http-server frontend-app -p 5500
```

Endpoints já configurados em `frontend-app/script.js` linhas 8–12.

---

## ☁️ Contratos de API

### AWS Lambda — Validador de Currículo
```
POST https://ymjlkfllucqx53nea72zo2f5ie0gvxxz.lambda-url.us-east-1.on.aws/
```
```json
// Request
{ "curriculo": "texto do currículo...", "palavras_chave": ["javascript", "node.js"] }

// Response
{ "pontuacao": 75, "encontradas": ["javascript"], "nao_encontradas": ["node.js"],
  "total_palavras": 2, "total_encontradas": 1 }
```

### Azure Functions — Calculadora de Salário
```
POST https://saas-conversor-moeda-d6fcaseqg0ecducd.canadaeast-01.azurewebsites.net/api/CalculadoraSalarioLiquido
```
```json
// Request
{ "salario_bruto": 5000 }

// Response
{ "salarioBruto": 5000, "inss": 400.00, "irrf": 0.00,
  "descontos": 775.00, "salarioLiquido": 4225.00 }
```

### Google Cloud Run — Sugestão de Treinamento
```
POST https://sugestaotreinamento-941802379150.us-central1.run.app
```
```json
// Request
{ "pontuacao": 90 }

// Response
{ "pontuacao": 90, "cursosSugeridos": ["React", "Node.js", "APIs REST", "Cloud Computing"] }
```

| Pontuação | Nível | Cursos sugeridos |
|-----------|-------|-----------------|
| 80–100 | Avançado | React, Node.js, APIs REST, Cloud |
| 50–79 | Intermediário | React, Node.js, APIs REST, Cloud |
| 0–49 | Iniciante | HTML Básico, CSS Básico, Lógica |

---

## 🛡️ Resiliência e Tratamento de Erros

```
Promise.all([chamarAWS(), chamarAzure()])   ← paralelo, isolados
    ↓
chamarGCP(pontuacao)                         ← encadeado, isolado
```

- **Timeout 12s** por serviço via `AbortController`
- **try/catch independente** — 1 serviço falhar não cancela os outros
- **Timer ao vivo** durante loading (`Consultando... 3s`)
- **Badge de latência** no header de cada card após resposta
- **Status geral:** `✅ 3/3` · `⚠️ 2/3` · `❌ 0/3` com tempo total
- **Filtro de skills:** cursos que candidato já domina são removidos da lista GCP

---

## ✨ Funcionalidade Extra: Extração de Skills

Botão **✨ Extrair do currículo** varre o texto contra dicionário de 60+ tecnologias:

```
texto → parse regex → chips clicáveis → campo palavras-chave
```

- Chip **roxo** = nova skill detectada (clique para adicionar)  
- Chip **verde** = já estava na lista  
- **Aplicar todas** = preenche campo em um clique

---

## 🔧 CORS — Configuração por Provedor

| Provedor | Onde configurar | Guia |
|----------|----------------|------|
| AWS Lambda URL | Configuração da Function URL → CORS | [`aws-lambda/CONFIGURACAO.md`](aws-lambda/CONFIGURACAO.md) |
| Azure Functions | Portal → Function App → API → CORS → somente `*` | [`azure-functions/CORS.md`](azure-functions/CORS.md) |
| Google Cloud Run | Headers no código (`res.set(...)`) + IAM allUsers | [`google-functions/CORS.md`](google-functions/CORS.md) |

---

## 🧠 Por que Serverless?

| Aspecto | FaaS (Serverless) | VM Tradicional |
|---------|-------------------|----------------|
| Gerenciamento de SO | ❌ Zero | ✅ Manual (patches, updates) |
| Escalabilidade | Automática (0 → N) | Manual (provisionar VMs) |
| Custo | Por invocação | Por hora (mesmo ocioso) |
| Deploy | Upload de arquivo | Nginx + configuração de servidor |
| Free tier | AWS: 1M req/mês · Azure: 1M · GCP: 2M | Não se aplica |

> **Conclusão:** FaaS elimina toda a camada de infraestrutura. A equipe foca 100% na lógica de negócio. Para projetos acadêmicos, os custos são efetivamente zero dentro do free tier.