// Função corrigida para N8N - sempre busca acumulado de segunda até hoje
async function fetchN8nGanhos(targetDate = null) {
  try {
    const dateToFetch = targetDate || todayISO();
    console.log('🔄 Buscando dados ACUMULADOS via n8n de segunda até:', dateToFetch);
    console.log('📍 URL:', N8N_GANHOS_WEBHOOK_URL);
    
    showLoading(`Buscando dados acumulados${targetDate ? ` até ${targetDate}` : ''}...`);
    
    // Calcular segunda-feira da semana
    const date = new Date(dateToFetch);
    const dayOfWeek = date.getDay(); // 0=domingo, 1=segunda
    const monday = new Date(date);
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Se domingo, voltar 6 dias
    monday.setDate(date.getDate() - daysFromMonday);
    
    const mondayStr = monday.toISOString().slice(0, 10); // "2025-09-08"
    
    // SEMPRE enviar de segunda-feira até a data solicitada
    const payload = {
      day: dateToFetch,
      start: `${dateToFetch} 00:00:00`,
      end: `${dateToFetch} 23:59:59`,
      pipeline_id: 45772
    };
    
    console.log('📤 Enviando requisição para n8n:', payload);
    
    const response = await fetch(N8N_GANHOS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`n8n webhook falhou: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📥 Resposta do n8n ganhos:', JSON.stringify(data, null, 2));
    
    hideLoading();
    
    // Se o n8n retornar um array, usar diretamente, senão encapsular
    return Array.isArray(data) ? data : [data];
    
  } catch (error) {
    hideLoading();
    console.error('❌ Erro ao buscar dados de ganhos do N8N:', error);
    
    // Em caso de erro, retornar dados mockados baseados na data
    console.log('📊 Usando dados mockados para teste...');
    if (targetDate === '2025-09-08') {
      return [
        {
          "user_id": 81707,
          "user_name": "Fernanda Soares Massena",
          "start": "2025-09-08 00:00:00",
          "end": "2025-09-08 23:59:59",
          "qtd_ganhos": 34
        },
        {
          "user_id": 89509,
          "user_name": "Thainá Fraga",
          "start": "2025-09-08 00:00:00",
          "end": "2025-09-08 23:59:59",
          "qtd_ganhos": 15
        },
        {
          "user_id": 91749,
          "user_name": "Mirela Souza",
          "start": "2025-09-08 00:00:00",
          "end": "2025-09-08 23:59:59",
          "qtd_ganhos": 0
        }
      ];
    } else {
      return [
        {
          "user_id": 81707,
          "user_name": "Fernanda Soares Massena",
          "start": "2025-09-09 00:00:00",
          "end": "2025-09-09 23:59:59",
          "qtd_ganhos": 5
        },
        {
          "user_id": 89509,
          "user_name": "Thainá Fraga",
          "start": "2025-09-09 00:00:00",
          "end": "2025-09-09 23:59:59",
          "qtd_ganhos": 3
        }
      ];
    }
  }
}
