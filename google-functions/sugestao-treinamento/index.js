/**
 * Google Cloud Function — Sugestão de Treinamento (HTTP Trigger)
 * Node.js 20
 * Entry point: sugestaoTreinamento
 */
exports.sugestaoTreinamento = (req, res) => {
  // CORS headers — must be set before any res.send/json
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Use POST.' });
    return;
  }

  try {
    const body = req.body || {};
    const pontuacao = parseInt(body.pontuacao, 10);

    if (isNaN(pontuacao) || pontuacao < 0 || pontuacao > 100) {
      res.status(400).json({ error: 'Campo "pontuacao" obrigatório (0–100).' });
      return;
    }

    let nivel, cursos, descricao;

    if (pontuacao >= 80) {
      nivel = 'Avançado';
      descricao = 'Perfil altamente qualificado. Cursos de liderança e especialização.';
      cursos = [
        { nome: 'Liderança e Gestão de Equipes', carga: '40h', plataforma: 'Coursera' },
        { nome: 'AWS Solutions Architect – Associate', carga: '60h', plataforma: 'AWS Training' },
        { nome: 'PMP — Gestão de Projetos', carga: '35h', plataforma: 'PMI' },
        { nome: 'Design Thinking para RH', carga: '20h', plataforma: 'Udemy' },
      ];
    } else if (pontuacao >= 50) {
      nivel = 'Intermediário';
      descricao = 'Bom perfil técnico. Fortalecer competências práticas e transversais.';
      cursos = [
        { nome: 'Comunicação Corporativa e Escrita Profissional', carga: '20h', plataforma: 'Alura' },
        { nome: 'Excel Avançado e Power BI', carga: '30h', plataforma: 'Udemy' },
        { nome: 'Fundamentos de Cloud Computing', carga: '25h', plataforma: 'Google Cloud Skills Boost' },
        { nome: 'Metodologias Ágeis (Scrum & Kanban)', carga: '15h', plataforma: 'Coursera' },
      ];
    } else if (pontuacao >= 20) {
      nivel = 'Básico';
      descricao = 'Perfil em desenvolvimento. Priorizar fundamentos técnicos e comportamentais.';
      cursos = [
        { nome: 'Pacote Office — Word, Excel e PowerPoint', carga: '20h', plataforma: 'Fundação Bradesco' },
        { nome: 'Português Empresarial e Redação', carga: '15h', plataforma: 'Senai' },
        { nome: 'Lógica de Programação', carga: '30h', plataforma: 'Alura' },
        { nome: 'Ética e Comportamento Profissional', carga: '10h', plataforma: 'Sebrae' },
      ];
    } else {
      nivel = 'Iniciante';
      descricao = 'Perfil inicial. Cursos de nivelamento recomendados antes de especializações.';
      cursos = [
        { nome: 'Introdução à Informática', carga: '20h', plataforma: 'Fundação Bradesco' },
        { nome: 'Digitação e Uso do Computador', carga: '10h', plataforma: 'Senai' },
        { nome: 'Matemática Básica e Raciocínio Lógico', carga: '25h', plataforma: 'Khan Academy' },
        { nome: 'Introdução ao Mercado de Trabalho', carga: '10h', plataforma: 'Sebrae' },
      ];
    }

    res.status(200).json({
      pontuacao,
      nivel,
      descricao,
      total_cursos: cursos.length,
      cursos,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.', detalhes: err.message });
  }
};
