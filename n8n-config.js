// Configuração para n8n - versão simplificada
// Seu n8n já tem toda a lógica, só precisamos da URL

window.N8N_CONFIG = {
  // URL do seu webhook n8n que retorna os dados do PipeRun
  webhookUrl: 'https://n8n.unitycompany.com.br/webhook/report/today',
  
  // Timeout para requisições (opcional) - padrão 15 segundos
  timeout: 15000,
  
  // Debug mode (opcional)
  debug: true
};

// Aplicar configurações no main.js
if (window.N8N_CONFIG) {
  console.log('✅ Configuração n8n carregada:', window.N8N_CONFIG.webhookUrl);
} else {
  console.warn('⚠️ Configuração n8n não encontrada');
}
