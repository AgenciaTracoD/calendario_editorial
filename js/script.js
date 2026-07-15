// Função (Conceitual) que desenha o calendário e insere os posts
function renderizarPostsNoCalendario(postsDoMes) {
  // ... sua lógica existente para encontrar o elemento do dia certo ...

  postsDoMes.forEach(post => {
    // 1. Criar o elemento do balão (você já faz isso)
    const postElement = document.createElement('div');
    postElement.className = 'calendario-post'; // sua classe de estilo

    // 2. Lógica de Status e Ícone (A NOVA PARTE)
    let iconStatus = '';
    let statusClass = ''; // Para manter sua lógica de cor existente

    switch (post.status.toLowerCase()) {
      case 'publicado':
        iconStatus = '✅'; // Ícone de Concluído
        statusClass = 'status-publicado'; // Ex: Fundo Verde
        break;
      case 'agendado':
        iconStatus = '📅'; // Ícone de Calendário/Agendado
        statusClass = 'status-agendado'; // Ex: Fundo Azul
        break;
      case 'aprovacao':
        iconStatus = '👍🏻'; // Ícone de Mãozinha levantada (esperando aprovação)
        statusClass = 'status-aprovacao'; // Ex: Fundo Amarelo
        break;
      case 'criacao':
        iconStatus = '🎨'; // Ícone de Paleta de Arte
        statusClass = 'status-criacao'; // Ex: Fundo Cinza Claro
        break;
      case 'recusado':
      case 'cancelado':
        iconStatus = '❌'; // Ícone de Erro
        statusClass = 'status-cancelado'; // Ex: Fundo Vermelho
        break;
      case 'pausado':
        iconStatus = '⏸️'; // Ícone de Pausa
        statusClass = 'status-pausado'; // Ex: Fundo Laranja
        break;
      default: // Status padrão (ex: 'Pendente' ou 'Planejado')
        iconStatus = '📝'; // Ícone de Caderno
        statusClass = 'status-pendente'; // Ex: Fundo Cinza
        break;
    }

    // 3. Aplicar a classe de cor existente (você já faz isso)
    postElement.classList.add(statusClass);

    // 4. Montar o HTML interno com o ÍCONE (A NOVA PARTE)
    // Usamos um span com classe para controlar o tamanho do ícone separadamente do texto
    postElement.innerHTML = `
      <span class="post-icon">${iconStatus}</span>
      <span class="post-title">${post.tema}</span>
    `;

    // ... sua lógica existente para dar appendChild no dia certo ...
  });
}
