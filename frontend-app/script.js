/**
 * RH SaaS — Frontend Multicloud
 * Fluxo: AWS + Azure paralelo → pontuação AWS → GCP encadeado.
 * Resiliência: AbortController timeout por serviço + try/catch isolado.
 */

// ─── ENDPOINTS ───────────────────────────────────────────────────────────────
const ENDPOINTS = {
  aws:   'https://ymjlkfllucqx53nea72zo2f5ie0gvxxz.lambda-url.us-east-1.on.aws/',
  azure: 'https://saas-conversor-moeda-d6fcaseqg0ecducd.canadaeast-01.azurewebsites.net/api/CalculadoraSalarioLiquido',
  gcp:   'https://sugestaotreinamento-941802379150.us-central1.run.app',
};

const TIMEOUT_MS = 12000; // 12s timeout por serviço

// ─── DICIONÁRIO DE SKILLS PARA EXTRAÇÃO ──────────────────────────────────────
const SKILLS_DICT = [
  // Linguagens
  'javascript','typescript','python','java','c#','c++','php','ruby','go','rust','swift','kotlin','scala','r',
  // Frontend
  'react','vue','angular','next.js','nuxt','svelte','html','css','sass','tailwind','bootstrap','jquery',
  // Backend / runtime
  'node.js','express','fastapi','django','flask','spring','laravel','rails',
  // Dados / BI
  'sql','mysql','postgresql','mongodb','redis','oracle','sql server','power bi','tableau','excel',
  'pandas','numpy','spark','hadoop','etl','data science','machine learning','ia','inteligência artificial',
  // Cloud / DevOps
  'aws','azure','gcp','google cloud','docker','kubernetes','terraform','ansible','ci/cd','git','github','gitlab',
  // Soft skills / gestão
  'gestão','liderança','scrum','kanban','agile','ágil','comunicação','negociação','atendimento',
  'gestão de projetos','gestão de pessoas','gestão de equipes','pmp','jira','confluence',
  // Mobile
  'react native','flutter','android','ios','xamarin',
  // Segurança
  'segurança','cibersegurança','pentest','lgpd',
  // Infra
  'linux','windows server','redes','tcp/ip','firewall','nginx','apache',
  // Certificações / outras
  'power automate','sharepoint','sap','salesforce','erp','crm',
].sort((a, b) => b.length - a.length); // ordenar do maior pro menor — evita match parcial sobrepor match exato

// ─── ESTADO ──────────────────────────────────────────────────────────────────
let analisando = false;
const timers = {}; // intervalos do ticker por card

// ─── UTILS ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function formatMs(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function latencyClass(ms) {
  if (ms < 500)  return 'latency-fast';
  if (ms < 1500) return 'latency-medium';
  return 'latency-slow';
}

// ─── EXTRAÇÃO DE PALAVRAS-CHAVE DO CURRÍCULO ──────────────────────────────────
function extrairPalavrasChave() {
  const texto = document.getElementById('curriculo').value.toLowerCase();
  if (!texto.trim()) {
    alert('Cole o texto do currículo primeiro.');
    return;
  }

  // Encontrar skills presentes no texto
  const encontradas = SKILLS_DICT.filter(skill => {
    // Usar word-boundary aproximado: skill cercado por não-alfanumérico ou início/fim
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![a-záàãâéêíóôõúüç])${escaped}(?![a-záàãâéêíóôõúüç])`, 'i');
    return re.test(texto);
  });

  if (encontradas.length === 0) {
    alert('Nenhuma palavra-chave reconhecida no texto. Tente adicionar manualmente.');
    return;
  }

  // Pegar as já inseridas no campo para não duplicar
  const jaExistentes = document.getElementById('palavras').value
    .split(',').map(p => p.trim().toLowerCase()).filter(Boolean);

  const novas   = encontradas.filter(s => !jaExistentes.includes(s));
  const todas   = [...new Set([...jaExistentes, ...encontradas])];

  // Renderizar chips clicáveis na área de sugestões
  const container = document.getElementById('kwSugestoes');
  container.innerHTML = `
    <div class="kw-sug-header">
      <span>✨ ${encontradas.length} habilidades detectadas</span>
      <button type="button" class="btn-sug-all" onclick="aplicarTodasSugestoes()">Aplicar todas</button>
    </div>
    <div class="kw-sug-chips" id="kwSugChips">
      ${encontradas.map(s => {
        const jatem = jaExistentes.includes(s);
        return `<span
          class="kw-sug-chip ${jatem ? 'already' : 'new'}"
          title="${jatem ? 'Já na lista' : 'Clique para adicionar'}"
          onclick="${jatem ? '' : `adicionarSugestao('${s.replace(/'/g,"\\'")}', this)`}"
          data-skill="${s}"
        >${escapeHtml(s)}${jatem ? ' ✓' : ' +'}</span>`;
      }).join('')}
    </div>`;
  container.classList.remove('hidden');

  // Guardar lista completa para "Aplicar todas"
  container.dataset.todas = todas.join(', ');
  container.dataset.encontradas = encontradas.join(', ');
}

function adicionarSugestao(skill, el) {
  const input = document.getElementById('palavras');
  const atual = input.value.split(',').map(p => p.trim()).filter(Boolean);
  if (!atual.map(p => p.toLowerCase()).includes(skill.toLowerCase())) {
    atual.push(skill);
    input.value = atual.join(', ');
  }
  el.classList.remove('new');
  el.classList.add('already');
  el.textContent = `${skill} ✓`;
  el.onclick = null;
}

function aplicarTodasSugestoes() {
  const container = document.getElementById('kwSugestoes');
  const todas = container.dataset.todas || '';
  document.getElementById('palavras').value = todas;
  // Marcar todos os chips como "already"
  container.querySelectorAll('.kw-sug-chip.new').forEach(chip => {
    chip.classList.remove('new');
    chip.classList.add('already');
    chip.textContent = `${chip.dataset.skill} ✓`;
    chip.onclick = null;
  });
}

// ─── FETCH COM TIMEOUT ────────────────────────────────────────────────────────
async function fetchTimeout(url, options, timeoutMs) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(tid);
    return res;
  } catch (err) {
    clearTimeout(tid);
    if (err.name === 'AbortError') {
      throw new Error(`Timeout após ${timeoutMs / 1000}s — sem resposta`);
    }
    throw err;
  }
}

// ─── TIMER LIVE POR CARD ──────────────────────────────────────────────────────
function startCardTimer(name) {
  const t0 = Date.now();
  const el = document.getElementById(`timer${name}`);
  if (!el) return;
  el.textContent = '0s';
  timers[name] = setInterval(() => {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
    if (el) el.textContent = `${elapsed}s`;
  }, 500);
}

function stopCardTimer(name) {
  if (timers[name]) {
    clearInterval(timers[name]);
    delete timers[name];
  }
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function setGlobalStatus(html, type) {
  const el = document.getElementById('statusGeral');
  el.innerHTML = html;
  el.className = `status-geral ${type}`;
  el.classList.remove('hidden');
}

function setCardIdle(name) {
  stopCardTimer(name);
  document.getElementById(`card${name}`).className = 'result-card idle';
  document.getElementById(`status${name}`).textContent = '🕐';
  document.getElementById(`body${name}`).innerHTML = `
    <div class="card-idle-state">
      <div class="idle-icon">⏸</div>
      <div class="idle-text">Pronto para analisar</div>
      <div class="idle-hint">Clique em "Analisar Candidato"</div>
    </div>`;
}

function setCardLoading(name) {
  stopCardTimer(name);
  document.getElementById(`card${name}`).className = 'result-card loading';
  document.getElementById(`status${name}`).textContent = '⏳';
  document.getElementById(`body${name}`).innerHTML = `
    <div class="loading-pulse">
      <div class="pulse-dot d1"></div>
      <div class="pulse-dot d2"></div>
      <div class="pulse-dot d3"></div>
    </div>
    <div class="loading-timer">Consultando... <span id="timer${name}">0s</span></div>`;
  startCardTimer(name);
}

function setCardOk(name, latencia) {
  stopCardTimer(name);
  document.getElementById(`card${name}`).classList.remove('loading');
  document.getElementById(`card${name}`).classList.add('success');
  document.getElementById(`status${name}`).textContent = '✅';
  // Badge de latência no header
  const badge = document.getElementById(`latBadge${name}`);
  if (badge) {
    badge.textContent = formatMs(latencia);
    badge.className = `lat-badge ${latencyClass(latencia)}`;
    badge.style.display = 'inline-block';
  }
}

function setCardErr(name, msg, latencia) {
  stopCardTimer(name);
  document.getElementById(`card${name}`).classList.remove('loading');
  document.getElementById(`card${name}`).classList.add('error');
  document.getElementById(`status${name}`).textContent = '❌';
  const latStr = latencia != null ? ` · ${formatMs(latencia)}` : '';
  document.getElementById(`body${name}`).innerHTML = `
    <div class="service-unavailable">
      <div class="err-icon">⚠️</div>
      <div class="err-title">Serviço Indisponível</div>
      <div class="err-detail">${escapeHtml(msg)}${escapeHtml(latStr)}</div>
      <div class="err-hint">Verifique endpoint e CORS nas configurações</div>
    </div>`;
  const badge = document.getElementById(`latBadge${name}`);
  if (badge) {
    badge.textContent = latencia != null ? formatMs(latencia) : '—';
    badge.className = 'lat-badge latency-slow';
    badge.style.display = 'inline-block';
  }
}

// ─── RENDER: AWS ──────────────────────────────────────────────────────────────
function renderAWS(data) {
  const p = data.pontuacao ?? 0;
  const scoreClass = p >= 70 ? 'score-high' : p >= 40 ? 'score-mid' : 'score-low';
  const found    = (data.encontradas    || []).map(k => `<span class="kw-chip kw-found">${escapeHtml(k)}</span>`).join('');
  const notFound = (data.nao_encontradas || []).map(k => `<span class="kw-chip kw-not-found">${escapeHtml(k)}</span>`).join('');

  const bodyEl = document.getElementById('bodyAWS');
  bodyEl.dataset.pontuacao = p;
  bodyEl.innerHTML = `
    <div class="score-circle ${scoreClass}">${p}%</div>
    <p style="text-align:center;font-size:.85rem;color:var(--text-muted);margin-bottom:12px;">
      ${data.total_encontradas ?? 0} de ${data.total_palavras ?? 0} palavras-chave encontradas
    </p>
    ${found    ? `<div style="margin-bottom:8px;"><div class="chip-label">Encontradas</div><div class="kw-list">${found}</div></div>` : ''}
    ${notFound ? `<div><div class="chip-label">Não encontradas</div><div class="kw-list">${notFound}</div></div>` : ''}
  `;
}

// ─── RENDER: Azure ────────────────────────────────────────────────────────────
// Suporte a snake_case (salario_bruto) e camelCase (salarioBruto) do endpoint externo
function renderAzure(data) {
  const bruto    = data.salario_bruto      ?? data.salarioBruto      ?? data.grossSalary   ?? data.bruto   ?? 0;
  const inss     = data.inss               ?? data.descontoINSS      ?? data.inssDiscount  ?? 0;
  const irrf     = data.irrf               ?? data.descontoIRRF      ?? data.irrfDiscount  ?? data.ir      ?? 0;
  const liquido  = data.salario_liquido    ?? data.salarioLiquido    ?? data.netSalary     ?? data.liquido ?? 0;
  const descontos = data.descontos_totais  ?? data.totalDescontos    ?? data.totalDiscounts ?? (inss + irrf);
  const aliquota = data.aliquota_efetiva_pct ?? data.aliquotaEfetiva ?? (bruto > 0 ? +((descontos / bruto) * 100).toFixed(1) : 0);

  // Se endpoint retornou formato diferente, logar para debug
  if (!data.salario_bruto && !data.salarioBruto) {
    console.warn('[Azure] Campos desconhecidos — raw:', data);
  }

  document.getElementById('bodyAzure').innerHTML = `
    <div class="salary-row"><span class="salary-label">Salário Bruto</span><span class="salary-val">${formatBRL(bruto)}</span></div>
    <div class="salary-row deduction"><span class="salary-label">INSS</span><span class="salary-val">− ${formatBRL(inss)}</span></div>
    <div class="salary-row deduction"><span class="salary-label">IRRF</span><span class="salary-val">− ${formatBRL(irrf)}</span></div>
    <div class="salary-row deduction"><span class="salary-label">Total Descontos</span><span class="salary-val">− ${formatBRL(descontos)}</span></div>
    <div class="salary-row highlight"><span class="salary-label">💰 Salário Líquido</span><span class="salary-val">${formatBRL(liquido)}</span></div>
    <div class="salary-row" style="margin-top:4px;">
      <span class="salary-label" style="font-size:.8rem;">Alíquota efetiva</span>
      <span class="salary-val" style="font-size:.85rem;color:var(--text-muted);">${aliquota}%</span>
    </div>
  `;
}

// ─── RENDER: GCP ──────────────────────────────────────────────────────────────
// Suporte a dois formatos:
//   Formato A (nosso): { nivel, descricao, cursos: [{nome,carga,plataforma}] }
//   Formato B (endpoint externo): { pontuacao, cursosSugeridos: ["string",...] }
function renderGCP(data) {
  // Normalizar lista de cursos — aceita cursos[] ou cursosSugeridos[]
  const listaBruta = data.cursos || data.cursosSugeridos || [];

  // Inferir nível pela pontuação se não vier no payload
  const p = data.pontuacao ?? 0;
  const nivel = data.nivel ||
    (p >= 80 ? 'Avançado' : p >= 50 ? 'Intermediário' : p >= 20 ? 'Básico' : 'Iniciante');

  const cursosHtml = listaBruta.map(c => {
    const nome  = typeof c === 'object' ? c.nome       : c;
    const carga = typeof c === 'object' ? c.carga      : '';
    const plat  = typeof c === 'object' ? c.plataforma : '';
    return `<div class="course-item">
      <div class="course-name">${escapeHtml(nome)}</div>
      ${carga ? `<div class="course-meta">⏱ ${escapeHtml(carga)} &nbsp;|&nbsp; 🎓 ${escapeHtml(plat)}</div>` : ''}
    </div>`;
  }).join('');

  const filtrados = data._filtrados || 0;
  const filtradoHint = filtrados > 0
    ? `<div style="font-size:.72rem;color:var(--text-muted);opacity:.6;margin-bottom:10px;">
         ✂️ ${filtrados} curso${filtrados > 1 ? 's' : ''} ocultado${filtrados > 1 ? 's' : ''} — candidato já possui essa habilidade
       </div>`
    : '';

  const semCursos = listaBruta.length > 0 && cursosHtml === ''
    ? `<p style="color:var(--green);font-size:.85rem;text-align:center;margin-top:12px;">
         🎉 Candidato já domina todos os cursos sugeridos para este nível!
       </p>`
    : '';

  document.getElementById('bodyGCP').innerHTML = `
    <span class="nivel-badge nivel-${nivel.replace(/\s/g,'')}">${escapeHtml(nivel)}</span>
    <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:8px;">${escapeHtml(data.descricao || `${listaBruta.length} cursos recomendados para este perfil.`)}</p>
    ${filtradoHint}
    ${cursosHtml || semCursos || '<p style="color:var(--text-muted);font-size:.85rem;">Nenhum curso retornado.</p>'}
  `;
}

// ─── RENDER: Latência ─────────────────────────────────────────────────────────
function renderLatency(metricas) {
  document.getElementById('latencyBody').innerHTML = metricas.map(m => {
    const latHtml = `<span class="${m.ok ? latencyClass(m.latencia) : 'latency-slow'}">${m.ok ? formatMs(m.latencia) : '—'}</span>`;
    const stHtml  = `<span style="color:var(--${m.ok ? 'green' : 'red'})">${m.status}</span>`;
    return `<tr><td>${escapeHtml(m.provedor)}</td><td>${escapeHtml(m.servico)}</td><td>${latHtml}</td><td>${stHtml}</td></tr>`;
  }).join('');
  document.getElementById('latencyCard').classList.remove('hidden');
}

// ─── CHAMADAS AOS SERVIÇOS ────────────────────────────────────────────────────
async function chamarAWS(curriculo, palavras_chave) {
  const t0 = performance.now();
  let statusHttp = '—';
  try {
    const res = await fetchTimeout(ENDPOINTS.aws, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curriculo, palavras_chave }),
    }, TIMEOUT_MS);
    statusHttp = res.status;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const lat = Math.round(performance.now() - t0);
    setCardOk('AWS', lat);
    renderAWS(data);
    return { provedor: 'AWS', servico: 'Validador de Currículo', latencia: lat, status: statusHttp, ok: true };
  } catch (err) {
    const lat = Math.round(performance.now() - t0);
    setCardErr('AWS', err.message, lat);
    return { provedor: 'AWS', servico: 'Validador de Currículo', latencia: lat, status: statusHttp, ok: false };
  }
}

async function chamarAzure(salario_bruto) {
  const t0 = performance.now();
  let statusHttp = '—';
  try {
    if (!ENDPOINTS.azure || ENDPOINTS.azure.includes('SUA_URL')) throw new Error('Endpoint não configurado');
    const res = await fetchTimeout(ENDPOINTS.azure, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salario_bruto, salarioBruto: salario_bruto }),
    }, TIMEOUT_MS);
    statusHttp = res.status;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const lat = Math.round(performance.now() - t0);
    setCardOk('Azure', lat);
    renderAzure(data);
    return { provedor: 'Azure', servico: 'Calculadora de Salário', latencia: lat, status: statusHttp, ok: true };
  } catch (err) {
    const lat = Math.round(performance.now() - t0);
    setCardErr('Azure', err.message, lat);
    return { provedor: 'Azure', servico: 'Calculadora de Salário', latencia: lat, status: statusHttp, ok: false };
  }
}

async function chamarGCP(pontuacao, palavras_chave = []) {
  const t0 = performance.now();
  let statusHttp = '—';
  try {
    if (!ENDPOINTS.gcp || ENDPOINTS.gcp.includes('SUA_URL')) throw new Error('Endpoint não configurado');
    const res = await fetchTimeout(ENDPOINTS.gcp, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pontuacao }),
    }, TIMEOUT_MS);
    statusHttp = res.status;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const lat = Math.round(performance.now() - t0);

    // Filtrar cursos que o candidato JÁ possui (match com palavras-chave)
    const skillsConhecidas = palavras_chave.map(p => p.toLowerCase().trim());
    const lista = data.cursos || data.cursosSugeridos || [];
    const filtrada = lista.filter(c => {
      const nome = (typeof c === 'object' ? c.nome : c).toLowerCase();
      // Remove se alguma skill conhecida aparece no nome do curso OU vice-versa
      return !skillsConhecidas.some(s => nome.includes(s) || s.includes(nome));
    });

    // Injetar lista filtrada de volta no payload
    const dataFiltrada = {
      ...data,
      cursos: filtrada,
      cursosSugeridos: filtrada,
      _filtrados: lista.length - filtrada.length, // quantos foram removidos
    };

    setCardOk('GCP', lat);
    renderGCP(dataFiltrada);
    return { provedor: 'GCP', servico: 'Sugestão de Treinamento', latencia: lat, status: statusHttp, ok: true };
  } catch (err) {
    const lat = Math.round(performance.now() - t0);
    setCardErr('GCP', err.message, lat);
    return { provedor: 'GCP', servico: 'Sugestão de Treinamento', latencia: lat, status: statusHttp, ok: false };
  }
}

// ─── ORQUESTRADOR ─────────────────────────────────────────────────────────────
async function analisarCandidato() {
  if (analisando) return;

  const curriculo   = document.getElementById('curriculo').value.trim();
  const palavrasRaw = document.getElementById('palavras').value.trim();
  const salarioRaw  = document.getElementById('salario').value.trim();

  if (!curriculo) { alert('Preencha o texto do currículo.'); return; }

  const palavras_chave = palavrasRaw ? palavrasRaw.split(',').map(p => p.trim()).filter(Boolean) : [];
  const salario_bruto  = parseFloat(salarioRaw) || 0;

  analisando = true;
  const btn = document.getElementById('btnAnalisar');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⏳</span> Analisando...';

  // Timer global no status bar
  const globalT0 = Date.now();
  const globalTimerEl = document.getElementById('globalTimer');
  const globalInterval = setInterval(() => {
    if (globalTimerEl) globalTimerEl.textContent = `${((Date.now() - globalT0) / 1000).toFixed(0)}s`;
  }, 500);

  setGlobalStatus('⏳ Consultando serviços… <span id="globalTimer">0s</span>', 'loading');
  ['AWS', 'Azure', 'GCP'].forEach(setCardLoading);
  document.getElementById('latencyCard').classList.add('hidden');

  // 1. AWS + Azure paralelo
  const [mAWS, mAzure] = await Promise.all([
    chamarAWS(curriculo, palavras_chave),
    chamarAzure(salario_bruto),
  ]);

  // 2. GCP encadeado com pontuação real da AWS
  const pontuacao = mAWS.ok
    ? parseInt(document.getElementById('bodyAWS').dataset.pontuacao || '0', 10)
    : 0;
  const mGCP = await chamarGCP(pontuacao, palavras_chave);

  clearInterval(globalInterval);

  renderLatency([mAWS, mAzure, mGCP]);

  const totalMs = Date.now() - globalT0;
  const ok = [mAWS, mAzure, mGCP].filter(m => m.ok).length;

  if (ok === 3)      setGlobalStatus(`✅ Todos os serviços responderam · ${formatMs(totalMs)}`, 'success');
  else if (ok > 0)   setGlobalStatus(`⚠️ ${ok}/3 serviços disponíveis · ${formatMs(totalMs)} · Verifique cards com erro`, 'loading');
  else               setGlobalStatus(`❌ Nenhum serviço respondeu · ${formatMs(totalMs)} · Confirme endpoints e CORS`, 'error');

  analisando = false;
  btn.disabled = false;
  btn.innerHTML = '<span class="btn-icon">🚀</span> Analisar Candidato';
}

// ─── INIT: estado idle ao carregar ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ['AWS', 'Azure', 'GCP'].forEach(setCardIdle);
});
