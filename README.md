# Relatório Pré-Vendas (SPA)

Aplicação web simples para registrar contagens diárias por pré-vendedor, criar campos dinâmicos, salvar no Firebase Firestore por dia e gerar relatório no formato de mensagem para WhatsApp.

## Recursos

- Login leve por ID pré-definido (sem senha). Cadastro simples: Nome + ID único.
- Campos dinâmicos por grupos, com botões +1/-1 e remoção/edição de itens.
- Salva automaticamente por conta e por data no Firestore: `daily/{YYYY-MM-DD}/entries/{accountId}`.
- Geração de relatório no formato:
  - Cabeçalho com data e horário (8h às 18h, etc.).
  - Resumo (Total de Atendimentos, Qualificados, etc.).
  - Linhas de produtos/interesses.
  - Total de Steel Frame (soma de linhas que contêm “Steel Frame”).
  - Tentativas de contato, CARDS NO MQL, Perdidos e razões (texto livre).
- Pré-visualização e botão para abrir no WhatsApp.
- Seleção de contas a somar no relatório de um dia específico.

## Estrutura

- `index.html`: Interface e diálogos.
- `styles.css`: Estilos básicos.
- `main.js`: Lógica do app e integração com Firestore (compat APIs do Firebase v10).
- `firebase-config.sample.js`: Modelo de configuração. Copie para `firebase-config.js` e preencha.

## Configuração do Firebase

1. Crie um projeto no Firebase.
2. Adicione um App Web e copie o objeto `firebaseConfig`.
3. Copie `firebase-config.sample.js` para `firebase-config.js` e cole suas credenciais:

```js
window.FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

4. No console Firebase, habilite Firestore Database.
5. (Opcional mas recomendado) Regras de segurança básicas (ajuste para seu uso real):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /accounts/{id} {
      allow read, write: if true; // Restringir em produção
    }
    match /daily/{date}/entries/{accountId} {
      allow read, write: if true; // Restringir em produção
    }
  }
}
```

6. Hospede localmente (abrir `index.html`) ou use o Firebase Hosting.

## Como usar

- Acesse `index.html` no navegador.
- Cadastre (Nome + ID) ou entre com um ID existente.
- Ajuste Data, horários, crie grupos/itens e use +1/-1.
- O app salva automaticamente no Firestore.
- Para relatório: clique em “Gerar Relatório”, selecione a data e as contas para somar.
- Copie o texto ou clique para abrir no WhatsApp.

## Observações

- O app usa os builds `compat` do Firebase para simplicidade. Em projetos maiores, prefira os módulos com tree-shaking.
- IDs são públicos; para produção, considere autenticação adequada.
- Evite commitar `firebase-config.js` ao repositório.
