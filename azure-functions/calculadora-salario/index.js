module.exports = async function (context, req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    };
    return;
  }

  try {
    const body = req.body || {};
    const salario_bruto = parseFloat(body.salario_bruto);

    if (isNaN(salario_bruto) || salario_bruto <= 0) {
      context.res = {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: { error: 'Campo "salario_bruto" obrigatório e deve ser positivo.' },
      };
      return;
    }

    // ─── INSS 2024 (tabela progressiva) ───────────────────────────────────────
    // Faixa 1: até R$ 1.412,00 → 7,5%
    // Faixa 2: R$ 1.412,01 até R$ 2.666,68 → 9%
    // Faixa 3: R$ 2.666,69 até R$ 4.000,03 → 12%
    // Faixa 4: R$ 4.000,04 até R$ 7.786,02 → 14%
    const faixasINSS = [
      { limite: 1412.0,  aliquota: 0.075 },
      { limite: 2666.68, aliquota: 0.09  },
      { limite: 4000.03, aliquota: 0.12  },
      { limite: 7786.02, aliquota: 0.14  },
    ];

    let inss = 0;
    let base_restante = Math.min(salario_bruto, 7786.02);
    let faixa_anterior = 0;

    for (const faixa of faixasINSS) {
      if (base_restante <= 0) break;
      const base_faixa = Math.min(base_restante, faixa.limite - faixa_anterior);
      inss += base_faixa * faixa.aliquota;
      base_restante -= base_faixa;
      faixa_anterior = faixa.limite;
    }

    // ─── IRRF 2025 (tabela vigente) ───────────────────────────────────────────
    // Até R$ 2.428,80          → Isento       dedução R$ 0,00
    // R$ 2.428,81 – R$ 2.826,65 → 7,5%        dedução R$ 182,16
    // R$ 2.826,66 – R$ 3.751,05 → 15%         dedução R$ 394,16
    // R$ 3.751,06 – R$ 4.664,68 → 22,5%       dedução R$ 675,49
    // Acima de R$ 4.664,68     → 27,5%        dedução R$ 908,73
    const base_irrf = salario_bruto - inss;
    let irrf = 0;

    if (base_irrf <= 2428.80) {
      irrf = 0;
    } else if (base_irrf <= 2826.65) {
      irrf = base_irrf * 0.075 - 182.16;
    } else if (base_irrf <= 3751.05) {
      irrf = base_irrf * 0.15 - 394.16;
    } else if (base_irrf <= 4664.68) {
      irrf = base_irrf * 0.225 - 675.49;
    } else {
      irrf = base_irrf * 0.275 - 908.73;
    }

    irrf = Math.max(0, irrf);

    const salario_liquido = salario_bruto - inss - irrf;

    context.res = {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: {
        salario_bruto: +salario_bruto.toFixed(2),
        inss: +inss.toFixed(2),
        irrf: +irrf.toFixed(2),
        descontos_totais: +(inss + irrf).toFixed(2),
        salario_liquido: +salario_liquido.toFixed(2),
        aliquota_efetiva_pct: +(((inss + irrf) / salario_bruto) * 100).toFixed(1),
      },
    };
  } catch (err) {
    context.res = {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: { error: 'Erro interno.', detalhes: err.message },
    };
  }
};
