# Configuração do ID do PipeRun

Para que o sistema de progress funcione corretamente, é necessário configurar o ID do PipeRun para cada usuário no Firebase.

## Como configurar:

1. Acesse o console do Firebase: https://console.firebase.google.com/
2. Selecione o projeto "relatorio-pre-vendas"
3. Vá em "Firestore Database"
4. Navegue até a coleção `accounts`
5. Selecione o documento do usuário (ID da conta, ex: PV001)
6. Clique em "Editar documento" ou no ícone de lápis
7. Adicione o campo `piperunUserId` com o valor numérico do ID do PipeRun
8. Salve as alterações

### Passo a passo detalhado:

```
Firebase Console > Firestore Database > accounts > [ID_DA_CONTA]
```

**Campos existentes:**
- `id`: "PV001" (string)
- `name`: "João Silva" (string)  
- `createdAt`: timestamp

**Campo a adicionar:**
- `piperunUserId`: 81707 (number) ← **IMPORTANTE: usar tipo number, não string**

### ⚠️ Atenção:
- O campo `piperunUserId` deve ser do tipo **number** (numérico)
- Não use aspas ao inserir o valor no Firebase
- Exemplo correto: `81707` (sem aspas)
- Exemplo incorreto: `"81707"` (com aspas)

## Exemplo de estrutura no Firebase:

```
accounts/
├── PV001/
│   ├── id: "PV001"
│   ├── name: "João Silva"
│   ├── piperunUserId: 81707
│   └── createdAt: timestamp
├── PV002/
│   ├── id: "PV002"
│   ├── name: "Maria Santos"
│   ├── piperunUserId: 89509
│   └── createdAt: timestamp
```

## IDs do PipeRun de exemplo:

- Fernanda Soares Massena: 81707
- Thainá Fraga: 89509

### Exemplo de implementação:
- Meta semanal: 150 ganhos
- Período: Segunda 00:00 às Domingo 23:59
- Reset automático toda semana

## Como o sistema funciona:

1. **Busca automática**: O sistema busca o `piperunUserId` da conta do usuário automaticamente
2. **Requisição N8N**: Faz uma requisição POST para `https://n8n.unitycompany.com.br/webhook/user-ganhos` enviando o `account_id`
3. **Dados do dia**: O N8N retorna os ganhos do dia atual para o usuário
4. **Acumulação diária**: O sistema salva os ganhos de cada dia e acumula de segunda a sábado
5. **Exemplo de acumulação**: 
   - Segunda: 35 ganhos → Total: 35
   - Terça: 4 ganhos → Total: 39 (35 + 4)
   - Quarta: 12 ganhos → Total: 51 (35 + 4 + 12)
   - E assim por diante...
6. **Atualização**: Atualiza a barra de progresso com o total acumulado da semana
7. **Reset semanal**: Todo domingo à meia-noite, os dados são resetados para a nova semana
8. **Histórico**: Os dados da semana anterior são salvos no histórico
9. **Auto-atualização**: Durante horário comercial (8h-18h), o sistema atualiza automaticamente a cada 15 minutos

## Estrutura de dados no Firebase:

### Coleção `daily-ganhos`:
```
daily-ganhos/
├── {accountId}/
│   └── days/
│       ├── 2025-09-09/
│       │   ├── date: "2025-09-09"
│       │   ├── ganhos: 35
│       │   ├── accountId: "PV001"
│       │   └── updatedAt: timestamp
│       ├── 2025-09-10/
│       │   ├── date: "2025-09-10"
│       │   ├── ganhos: 4
│       │   └── updatedAt: timestamp
│       └── ...
```

### Coleção `progress`:
```
progress/
├── {accountId}/
│   ├── currentWeekGanhos: 39
│   ├── target: 150
│   ├── weekStart: "2025-09-09"
│   ├── weekEnd: "2025-09-15"
│   ├── dailyGanhos: {"2025-09-09": 35, "2025-09-10": 4}
│   ├── weekDates: ["2025-09-09", "2025-09-10", ...]
│   └── lastUpdated: timestamp
```

## Formato de resposta do N8N:

```json
[
  {
    "user_id": 81707,
    "user_name": "Fernanda Soares Massena",
    "start": "2025-09-08 00:00:00",
    "end": "2025-09-08 23:59:59",
    "qtd_ganhos": 20
  },
  {
    "user_id": 89509,
    "user_name": "Thainá Fraga",
    "start": "2025-09-08 00:00:00",
    "end": "2025-09-08 23:59:59",
    "qtd_ganhos": 10
  }
]
```

## Meta semanal:

- **Objetivo**: 150 ganhos por semana
- **Período**: De segunda-feira 00:00 até domingo 23:59
- **Reset**: Automático todo domingo à meia-noite

## Como testar se está funcionando:

1. **Configure o ID do PipeRun** no Firebase conforme instruções acima
2. **Faça login** na aplicação com a conta configurada
3. **Clique no botão de atualizar** (ícone de seta circular) na seção de progresso
4. **Verifique os logs no console** do navegador (F12):
   - Deve aparecer: `🎯 Atualizando ganhos para usuário ID: [SEU_ID]`
   - Deve aparecer: `📊 Dados recebidos: [array com dados]`
   - Deve aparecer: `✅ Dados do usuário encontrados: [seus dados]`

### Possíveis problemas e soluções:

**Erro: "ID do PipeRun não configurado"**
- Verifique se o campo `piperunUserId` foi adicionado no Firebase
- Certifique-se que é do tipo `number`, não `string`

**Erro: "Seus dados não foram encontrados"**
- Verifique se o ID do PipeRun está correto
- Confirme se o usuário está ativo no sistema do PipeRun
- Verifique os logs para ver quais IDs estão disponíveis

**Erro: "n8n webhook falhou"**
- Verifique se o webhook do N8N está ativo
- Confirme se a URL está correta
- Teste o webhook diretamente no N8N
