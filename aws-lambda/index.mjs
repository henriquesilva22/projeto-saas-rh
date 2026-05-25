export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const curriculo = (body.curriculo || '').toLowerCase();
    const palavras_chave = Array.isArray(body.palavras_chave) ? body.palavras_chave : [];

    if (!curriculo) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Campo "curriculo" obrigatório.' }),
      };
    }

    const encontradas = palavras_chave.filter((p) =>
      curriculo.includes(p.toLowerCase().trim())
    );

    const total = palavras_chave.length;
    const pontuacao = total > 0 ? Math.round((encontradas.length / total) * 100) : 0;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pontuacao,
        encontradas,
        nao_encontradas: palavras_chave.filter((p) => !encontradas.includes(p)),
        total_palavras: total,
        total_encontradas: encontradas.length,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Erro interno.', detalhes: err.message }),
    };
  }
};
