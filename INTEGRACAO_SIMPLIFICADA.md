# Integração Simplificada com n8n

## O que mudou

Simplifiquei completamente a integração para trabalhar com seu n8n que já tem toda a lógica implementada.

## Estrutura atual

### 1. Payload enviado (Frontend → n8n)
```json
{
  "date": "2025-09-03",
  "account_id": "user123"
}
```

### 2. Resposta esperada (n8n → Frontend)
```json
[
  {
    "date": "2025-09-03",
    "pipeline_id": 45772,
    "atendimentos": {
      "total": 19
    },
    "ganhos": {
      "total_ganho": 0
    },
    "perdidos": {
      "total_perdidos": 0,
      "motivos_de_perda": [],
      "total_duplicados": 0
    },
    "mql": {
      "total_mql": 0
    }
  }
]
```

### 3. Conversão automática
O frontend converte automaticamente para o formato interno:
```javascript
{
  totalAtendimentos: 19,
  qualificados: 0,      // baseado em mql.total_mql
  perdidos: 0,          // perdidos.total_perdidos - total_duplicados
  tentativasContato: 19, // calculado automaticamente
  duplicados: 0,        // perdidos.total_duplicados
  cardsMql: 0,          // mql.total_mql
  motivoPerda: "- Produto que não trabalhamos" // primeiro motivo ou padrão
}
```

## Como testar

1. **Configure a URL:** Edite `n8n-config.js` com sua URL real
2. **Teste:** Clique em "Testar API" no frontend
3. **Verifique:** Console (F12) mostra todo o fluxo
4. **Gere relatório:** Use "Gerar Relatório" normalmente

## Arquivos importantes

- `main.js`: Lógica simplificada
- `n8n-config.js`: URL do webhook
- Este arquivo: documentação

## Próximos passos

Sua integração está pronta! O n8n faz todo o trabalho pesado e o frontend só precisa:
1. Enviar data + account_id
2. Receber o JSON estruturado
3. Converter para formato interno
4. Exibir no relatório

Simples e direto! 🚀
