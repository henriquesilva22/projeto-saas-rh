/**
 * RH SaaS — Frontend Multicloud
 * Orquestra chamadas para AWS Lambda, Azure Functions e Google Cloud Functions.
 * Fluxo: AWS + Azure em paralelo → pontuação AWS → GCP encadeado.
 * Resiliência: try/catch por serviço. Falha individual não derruba os demais.
 */

// ─── ENDPOINTS ──────────────────────────────────────────────────────────────
// Substitua os valores SUA_URL_* após fazer o deploy de cada serviço.
const ENDPOINTS = {
  aws:   'https://bc9xz2gk6b.execute-api.us-east-1.amazonaws.com/default/validador-pontuacao-curriculo',
  azure: 'https://saas-conversor-moeda-d6fcaseqg0ecducd.canadaeast-01.azurewebsites.net/api/CalculadoraSalarioLiquido',
  gcp:   'https://sugestaotreinamento-941802379150.us-central1.run.app',
};

// ─── ESTADO ─────────────────────────────────────────────────────────────────
let analisando = false;

// ─── UTILS ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function latencyClass(ms) {
  if (ms < 500)  return 'latency-fast';
  if (ms < 1500) return 'latency-medium';
  return 'latency-slow';
}

// ─── UI HELPERS ─────────────────────────────────────────────────────────────
function setGlobalStatus(html, type) {
  const el = document.getElementById('statusGeral');
  el.innerHTML = html;
  el.className = `status-geral ${type}`;
  el.classList.remove('hidden');
}

function setCardLoading(name) {
  document.getElementById(`body${name}`).innerHTML = `
    <div class="loading-pulse">
      <div class="pulse-dot d1"></div>
      <div class="pulse-dot d2"></div>
      <div class="pulse-dot d3"></div>
    </div>`;
  document.getElementById(`status${name}`).textContent = '⏳';
  document.getElementById(`card${name}`).className = 'result-card';
}

function setCardOk(name) {
  document.getElementById(`card${name}`).classList.add('success');
  document.getElementById(`status${name}`).textContent = '✅';
}

function setCardErr(name, msg) {
  document.getElementById(`card${name}`).classList.add('error');
  document.getElementById(`status${name}`).textContent = '❌';
  document.getElementById(`body${name}`).innerHTML = `
    <div class="service-unavailable">
      <div class="err-icon">⚠️</div>
      <div class="err-title">Serviço Indisponível</div>
      <div class="err-detail">${escapeHtml(msg)}</div>
    </div>`;
}

// ─── RENDER: AWS (pontuação de currículo) ────────────────────────────────────
function renderAWS(data) {
  const p = data.pontuacao ?? 0;
  const scoreClass = p >= 70 ? 'score-high' : p >= 40 ? 'score-mid' : 'score-low';

  const found = (data.palavrasEncontradas || []).map(
    (k) => `<span class="kw-chip kw-found">${escapeHtml(k)}</span>`).join('');
  const totalEncontradas = data.totalPalavrasEncontradas
    ?? (data.palavrasEncontradas ? data.palavrasEncontradas.length : 0);

  const bodyEl = document.getElementById('bodyAWS');
  bodyEl.dataset.pontuacao = p; // armazena para GCP usar
  bodyEl.innerHTML = `
    <div class="score-circle ${scoreClass}">${p}%</div>
    <p style="text-align:center;font-size:.85rem;color:var(--text-muted);margin-bottom:12px;">
      ${totalEncontradas} palavras-chave encontradas
    </p>
    ${found ? `<div style="margin-bottom:8px;">
      <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px;">Encontradas</div>
      <div class="kw-list">${found}</div></div>` : ''}
  `;
}

// ─── RENDER: Azure (salário) ─────────────────────────────────────────────────
function renderAzure(data) {
  document.getElementById('bodyAzure').innerHTML = `
    <div class="salary-row">
      <span class="salary-label">Salário Bruto</span>
      <span class="salary-val">${formatBRL(data.salarioBruto)}</span>
    </div>
    <div class="salary-row deduction">
      <span class="salary-label">INSS</span>
      <span class="salary-val">− ${formatBRL(data.descontoINSS)}</span>
    </div>
    <div class="salary-row deduction">
      <span class="salary-label">IRRF</span>
      <span class="salary-val">− ${formatBRL(data.descontoIR)}</span>
    </div>
    <div class="salary-row deduction">
      <span class="salary-label">Total Descontos</span>
      <span class="salary-val">− ${formatBRL(data.totalDescontos)}</span>
    </div>
    <div class="salary-row highlight">
      <span class="salary-label">💰 Salário Líquido</span>
      <span class="salary-val">${formatBRL(data.salarioLiquido)}</span>
    </div>
    <div class="salary-row" style="margin-top:4px;">
      <span class="salary-label" style="font-size:.8rem;">Alíquota efetiva</span>
      <span class="salary-val" style="font-size:.85rem;color:var(--text-muted);">${data.aliquota_efetiva_pct}%</span>
    </div>
  `;
}

// ─── RENDER: GCP (treinamentos) ──────────────────────────────────────────────
function renderGCP(data) {
  const nivel = 'Treinamentos sugeridos';
  const nivelClass = `nivel-${nivel.replace(/\s/g, '')}`;
  const cursosHtml = (data.cursosSugeridos || []).map((c) => {
    const nome      = typeof c === 'object' ? c.nome      : c;
    const carga     = typeof c === 'object' ? c.carga     : '';
    const plataforma = typeof c === 'object' ? c.plataforma : '';
    return `
      <div class="course-item">
        <div class="course-name">${escapeHtml(nome)}</div>
        ${carga ? `<div class="course-meta">⏱ ${escapeHtml(carga)} &nbsp;|&nbsp; 🎓 ${escapeHtml(plataforma)}</div>` : ''}
      </div>`;
  }).join('');

  document.getElementById('bodyGCP').innerHTML = `
    <span class="nivel-badge ${nivelClass}">${escapeHtml(nivel)}</span>
    <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:12px;">${escapeHtml(data.descricao || '')}</p>
    ${cursosHtml}
  `;
}

// ─── RENDER: Latência ────────────────────────────────────────────────────────
function renderLatency(metricas) {
  document.getElementById('latencyBody').innerHTML = metricas.map((m) => {
    const latHtml = m.ok
      ? `<span class="${latencyClass(m.latencia)}">${m.latencia} ms</span>`
      : `<span class="latency-slow">—</span>`;
    const statusHtml = m.ok
      ? `<span style="color:var(--green)">${m.status}</span>`
      : `<span style="color:var(--red)">${m.status}</span>`;
    return `<tr>
      <td>${escapeHtml(m.provedor)}</td>
      <td>${escapeHtml(m.servico)}</td>
      <td>${latHtml}</td>
      <td>${statusHtml}</td>
    </tr>`;
  }).join('');
  document.getElementById('latencyCard').classList.remove('hidden');
}

// ─── CHAMADAS AOS SERVIÇOS ───────────────────────────────────────────────────
async function chamarAWS(curriculo, palavras_chave) {
  const t0 = performance.now();
  let statusHttp = '—';
  try {
    const res = await fetch(ENDPOINTS.aws, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curriculo, palavras_chave }),
    });
    statusHttp = res.status;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const latencia = Math.round(performance.now() - t0);
    setCardOk('AWS');
    renderAWS(data);
    return { provedor: 'AWS', servico: 'Validador de Currículo', latencia, status: statusHttp, ok: true };
  } catch (err) {
    const latencia = Math.round(performance.now() - t0);
    setCardErr('AWS', err.message);
    return { provedor: 'AWS', servico: 'Validador de Currículo', latencia, status: statusHttp, ok: false };
  }
}

async function chamarAzure(salario_bruto) {
  const t0 = performance.now();
  let statusHttp = '—';
  try {
    if (!ENDPOINTS.azure || ENDPOINTS.azure.includes('SUA_URL')) {
      throw new Error('Endpoint Azure não configurado em script.js');
    }
    const res = await fetch(ENDPOINTS.azure, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salarioBruto: salario_bruto }),
    });
    statusHttp = res.status;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const latencia = Math.round(performance.now() - t0);
    setCardOk('Azure');
    renderAzure(data);
    return { provedor: 'Azure', servico: 'Calculadora de Salário', latencia, status: statusHttp, ok: true };
  } catch (err) {
    const latencia = Math.round(performance.now() - t0);
    setCardErr('Azure', err.message);
    return { provedor: 'Azure', servico: 'Calculadora de Salário', latencia, status: statusHttp, ok: false };
  }
}

async function chamarGCP(pontuacao) {
  const t0 = performance.now();
  let statusHttp = '—';
  try {
    if (!ENDPOINTS.gcp || ENDPOINTS.gcp.includes('SUA_URL')) {
      throw new Error('Endpoint GCP não configurado em script.js');
    }
    const res = await fetch(ENDPOINTS.gcp, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pontuacao }),
    });
    statusHttp = res.status;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const latencia = Math.round(performance.now() - t0);
    setCardOk('GCP');
    renderGCP(data);
    return { provedor: 'GCP', servico: 'Sugestão de Treinamento', latencia, status: statusHttp, ok: true };
  } catch (err) {
    const latencia = Math.round(performance.now() - t0);
    setCardErr('GCP', err.message);
    return { provedor: 'GCP', servico: 'Sugestão de Treinamento', latencia, status: statusHttp, ok: false };
  }
}

// ─── ORQUESTRADOR PRINCIPAL ──────────────────────────────────────────────────
async function analisarCandidato() {
  if (analisando) return;

  const curriculo  = document.getElementById('curriculo').value.trim();
  const palavrasRaw = document.getElementById('palavras').value.trim();
  const salarioRaw = document.getElementById('salario').value.trim();

  if (!curriculo) {
    alert('Por favor, preencha o texto do currículo.');
    return;
  }

  const palavras_chave = palavrasRaw
    ? palavrasRaw.split(',').map((p) => p.trim()).filter(Boolean)
    : [];
  const salario_bruto = parseFloat(salarioRaw) || 0;

  // Travar UI
  analisando = true;
  const btn = document.getElementById('btnAnalisar');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⏳</span> Analisando...';

  setGlobalStatus('⏳ Consultando serviços em nuvem...', 'loading');
  ['AWS', 'Azure', 'GCP'].forEach(setCardLoading);
  document.getElementById('latencyCard').classList.add('hidden');

  // 1. AWS + Azure em paralelo (independentes)
  const [mAWS, mAzure] = await Promise.all([
    chamarAWS(curriculo, palavras_chave),
    chamarAzure(salario_bruto),
  ]);

  // 2. GCP depende da pontuação gerada pela AWS
  const pontuacao = mAWS.ok
    ? parseInt(document.getElementById('bodyAWS').dataset.pontuacao || '0', 10)
    : 0;
  const mGCP = await chamarGCP(pontuacao);

  // 3. Latências
  renderLatency([mAWS, mAzure, mGCP]);

  // 4. Status geral
  const ok = [mAWS, mAzure, mGCP].filter((m) => m.ok).length;
  if (ok === 3) {
    setGlobalStatus('✅ Todos os serviços responderam com sucesso.', 'success');
  } else if (ok > 0) {
    setGlobalStatus(`⚠️ ${ok}/3 serviços disponíveis. Verifique os cards com erro.`, 'loading');
  } else {
    setGlobalStatus('❌ Nenhum serviço respondeu. Verifique os endpoints e o CORS.', 'error');
  }

  analisando = false;
  btn.disabled = false;
  btn.innerHTML = '<span class="btn-icon">🚀</span> Analisar Candidato';
}
