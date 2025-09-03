# Integração n8n com PipeRun - Guia Completo

## Visão Geral

Esta integração usa n8n como intermediário entre o frontend e a API do PipeRun, eliminando problemas de CORS e centralizando a lógica de automação.

## Etapas de Implementação

### 1. Configurar Workflow no n8n

1. **Importe o workflow:**
   - Acesse seu n8n
   - Vá em "Workflows" → "Import from File"
   - Selecione o arquivo `n8n-workflow.json`

2. **Configure o webhook:**
   - No nó "Webhook - Receber Pedido"
   - Defina o path como `piperun-report`
   - Ative o webhook
   - Anote a URL gerada (ex: `https://seu-n8n.com/webhook/piperun-report`)

3. **Teste endpoints PipeRun:**
   - No workflow, verifique se as URLs base estão corretas
   - Ajuste conforme necessário para sua conta PipeRun

### 2. Configurar Frontend

1. **Configure a URL do webhook:**
   - Edite o arquivo `n8n-config.js`
   - Substitua `webhookUrl` pela URL real do seu n8n

2. **Teste a integração:**
   - Abra o aplicativo
   - Clique em "Testar API"
   - Verifique no console se a comunicação está funcionando

### 3. Estrutura de Comunicação

#### Requisição (Frontend → n8n)
```json
{
  "action": "generate_report",
  "date": "2025-09-02",
  "account_id": "user123",
  "config": {
    "token": "6cc7a96c25ac9a34a84d4219e23aab20",
    "funnel_id": "45772",
    "stage_id": "262331"
  }
}
```

#### Resposta (n8n → Frontend)
```json
{
  "success": true,
  "data": {
    "totalAtendimentos": 15,
    "qualificados": 8,
    "perdidos": 3,
    "tentativasContato": 4,
    "duplicados": 2,
    "cardsMql": 5,
    "motivoPerda": "- Produto que não trabalhamos"
  },
  "timestamp": "2025-09-02T10:30:00Z"
}
```

### 4. Configurações Avançadas

#### Timeout
```javascript
// Em n8n-config.js
window.N8N_CONFIG = {
  webhookUrl: 'https://seu-n8n.com/webhook/piperun-report',
  timeout: 20000, // 20 segundos
  debug: true
};
```

#### Tratamento de Erro
O workflow n8n inclui tratamento de erro automático que retorna:
```json
{
  "success": false,
  "error": "Descrição do erro",
  "data": {
    // Dados padrão para evitar quebra do frontend
  }
}
```

### 5. Monitoramento

#### Logs no n8n
- Acesse "Executions" no n8n
- Monitore as execuções do workflow
- Verifique erros e performance

#### Logs no Frontend
- Abra Developer Tools (F12)
- Console mostra todas as interações
- Busque por mensagens iniciadas com "n8n"

### 6. Troubleshooting

#### Erro: "Webhook n8n indisponível"
1. Verifique se o workflow está ativo
2. Confirme a URL do webhook
3. Teste o endpoint diretamente

#### Erro: "Timeout após Xs"
1. Aumente o timeout em `n8n-config.js`
2. Verifique performance das APIs PipeRun
3. Otimize o workflow n8n

#### Dados não aparecem
1. Verifique tokens e IDs no payload
2. Confirme que o PipeRun está respondendo
3. Analise logs de execução no n8n

### 7. Vantagens desta Abordagem

✅ **Sem CORS:** n8n faz as requisições server-side
✅ **Centralizado:** Toda lógica PipeRun em um lugar
✅ **Escalável:** Fácil adicionar mais integrações
✅ **Monitorável:** Logs e métricas centralizadas
✅ **Flexível:** Pode processar/transformar dados
✅ **Seguro:** Tokens ficam no servidor n8n

### 8. Próximos Passos

1. **Cache:** Implementar cache de dados no n8n
2. **Webhook Async:** Para relatórios demorados
3. **Notificações:** Alertas em caso de falha
4. **Métricas:** Dashboard de performance
5. **Backup:** Dados históricos no n8n

## URLs Importantes

- **Workflow n8n:** `n8n-workflow.json`
- **Configuração:** `n8n-config.js` 
- **Documentação n8n:** https://docs.n8n.io/
- **API PipeRun:** https://ajuda.piperun.com/

## Suporte

Se encontrar problemas:
1. Verifique os logs no console (F12)
2. Confirme as execuções no n8n
3. Teste endpoints individualmente
4. Valide configurações de token/IDs
