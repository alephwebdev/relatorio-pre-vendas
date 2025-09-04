(function(){
  // ---- Minimal state management ----
  const state = {
    account: null, // { id, name }
    date: todayISO(),
    startTime: '08:00',
    endTime: '18:00',
    groups: [], // mantém compatibilidade mas não usado
    products: [
      // Produtos/Interesses padrão
      { id: uid(), name: 'Placas Drywall', value: 0 },
      { id: uid(), name: 'Perfis Drywall', value: 0 },
      { id: uid(), name: 'Glasroc X', value: 0 },
      { id: uid(), name: 'Painel wall', value: 0 },
      { id: uid(), name: 'Placa Cimentícia', value: 0 },
      { id: uid(), name: 'Perfis de Steel Frame', value: 0 },
      { id: uid(), name: 'Steel Frame Obras', value: 0 },
      { id: uid(), name: 'Quartzolit', value: 0 },
      { id: uid(), name: 'Acústica', value: 0 },
      { id: uid(), name: 'Piso Vinílico', value: 0 },
      { id: uid(), name: 'MEGA SALDÃO DE FORROS', value: 0 },
      { id: uid(), name: 'TOTAL STEEL FRAME PRODUTOS', value: 0 }
    ],
    pipeRunData: {
      totalAtendimentos: 0,
      qualificados: 0,
      perdidos: 0,
      tentativasContato: 0,
      duplicados: 0,
      cardsMql: 0,
      motivoPerda: '- Aguardando dados do PipeRun'
    },
    pipeRunConfig: {
      apiKey: '6cc7a96c25ac9a34a84d4219e23aab20',
      baseUrl: 'https://app.pipe.run/webservice/integracao', // URL base inicial
      funnelId: '45772',
      stageId: '262331'
    },
  accountsCache: [], // fetched list for report selection
  productStructure: [] // estrutura global compartilhada [{id,name,order}]
  };

  // ---- Firebase Init ----
  const cfg = window.FIREBASE_CONFIG || {};
  let app, db;
  console.log('🔥 Firebase config:', cfg);
  console.log('🔥 Firebase SDK loaded:', !!window.firebase);
  try{
    if(!window.firebase) throw new Error('SDK do Firebase não carregou. Verifique sua conexão.');
    if(!cfg || !cfg.projectId) throw new Error('Configuração do Firebase ausente. Crie firebase-config.js baseado em firebase-config.sample.js');
    app = firebase.initializeApp(cfg);
    db = firebase.firestore();
    console.log('✅ Firebase inicializado com sucesso');
  }catch(err){
    console.error('❌ Erro ao inicializar Firebase:', err);
    // Degrade: mostra erro e bloqueia login
    window.addEventListener('DOMContentLoaded', ()=>{
      const errEl = document.querySelector('#login-error');
      if(errEl){ errEl.classList.remove('d-none'); errEl.textContent = err.message; }
      const btn = document.querySelector('#login-form button[type="submit"]');
      if(btn){ btn.disabled = true; }
    });
    // Create no-op db to avoid further crashes
    db = {
      collection(){ throw err; }
    };
  }

  // Collections
  const colAccounts = () => db.collection('accounts');
  // daily data under /daily/{date}/entries/{accountId}
  const dailyDoc = (date, accountId) => db.collection('daily').doc(date).collection('entries').doc(accountId);
  // global structure config: /config/products
  const structureDoc = () => db.collection('config').doc('products');

  // ---- DOM refs ----
  const loginView = qs('#login-view');
  const appView = qs('#app-view');
  const loginForm = qs('#login-form');
  const signupForm = qs('#signup-form');
  const loginIdInput = qs('#login-id');
  const signupNameInput = qs('#signup-name');
  const signupIdInput = qs('#signup-id');
  const loginError = qs('#login-error');

  const accountNameEl = qs('#account-name');
  const accountIdEl = qs('#account-id');
  const currentDayEl = qs('#current-day');
  const dateInput = qs('#date');
  const startTimeInput = qs('#start-time');
  const endTimeInput = qs('#end-time');
  const generateReportBtn = qs('#generate-report-btn');
  const historyBtn = qs('#history-btn');
  const saveIndicator = qs('#save-indicator');
  const productsGrid = qs('#products-grid');
  const productsCount = qs('#products-count');
  
  // Modal elements
  const reportOutput = null; // Removido da interface
  const copyReportBtn = null; // Removido da interface  
  const whatsappLink = null; // Removido da interface
  const logoutBtn = qs('#logout-btn');

  const reportModal = new bootstrap.Modal(qs('#report-modal'));
  const reportDate = qs('#report-date');
  const sumSelected = qs('#sum-selected');
  const accountsList = qs('#accounts-list');
  const runReportBtn = qs('#run-report-btn');

  const historyModal = new bootstrap.Modal(qs('#history-modal'));
  const histStart = qs('#hist-start');
  const histEnd = qs('#hist-end');
  const histSumPeriod = qs('#hist-sum-period');
  const accountsListHistory = qs('#accounts-list-history');
  const runHistoryBtn = qs('#run-history-btn');
  const historyResults = qs('#history-results');

  const structureBtn = qs('#structure-btn');
  const structureModal = new bootstrap.Modal(qs('#structure-modal'));
  const structureEditor = qs('#structure-editor');
  const addProductStructBtn = qs('#add-product-struct');
  const saveStructureBtn = qs('#save-structure-btn');

  const finalReportModal = new bootstrap.Modal(qs('#final-report-modal'));
  const finalReportText = qs('#final-report-text');
  const copyFinalReportBtn = qs('#copy-final-report-btn');
  const whatsappFinalLink = qs('#whatsapp-final-link');

  // ---- Helpers ----
  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }
  function uid(){ return Math.random().toString(36).slice(2,9); }
  function todayISO(){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
  function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }

  // ---- Sistema de Notificações ----
  const toastContainer = qs('#toast-container');
  
  function showToast(message, type = 'info', duration = 3000) {
    const toastId = `toast-${uid()}`;
    const icons = {
      success: 'bi-check-circle-fill',
      info: 'bi-info-circle-fill',
      warning: 'bi-exclamation-triangle-fill',
      error: 'bi-x-circle-fill'
    };
    
    const titles = {
      success: 'Sucesso',
      info: 'Informação',
      warning: 'Atenção',
      error: 'Erro'
    };
    
    const toastHTML = `
      <div id="${toastId}" class="toast custom-toast toast-${type}" role="alert">
        <div class="toast-header">
          <i class="bi ${icons[type]} toast-icon ${type}"></i>
          <strong class="me-auto">${titles[type]}</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
          ${message}
        </div>
      </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
      autohide: true,
      delay: duration
    });
    
    // Remover o elemento do DOM após esconder
    toastElement.addEventListener('hidden.bs.toast', () => {
      toastElement.remove();
    });
    
    toast.show();
    return toast;
  }
  
  // Funções de conveniência
  function showSuccess(message, duration = 3000) {
    return showToast(message, 'success', duration);
  }
  
  function showInfo(message, duration = 3000) {
    return showToast(message, 'info', duration);
  }
  
  function showWarning(message, duration = 4000) {
    return showToast(message, 'warning', duration);
  }
  
  function showError(message, duration = 5000) {
    return showToast(message, 'error', duration);
  }

  // Função para definir horários automáticos baseado no dia da semana
  function getWorkingHours(date) {
    const d = new Date(date + 'T00:00:00');
    const dayOfWeek = d.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
    
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Segunda a sexta: 8:00 às 18:00
      return { start: '08:00', end: '18:00' };
    } else if (dayOfWeek === 6) {
      // Sábado: 8:00 às 12:00
      return { start: '08:00', end: '12:00' };
    } else {
      // Domingo: sem horário padrão, manter atual
      return { start: '08:00', end: '18:00' };
    }
  }

  // Loading functions
  function showLoading(message = 'Carregando...') {
    const existing = qs('.loading-overlay');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <span class="loading-text">${message}</span>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function hideLoading() {
    const overlay = qs('.loading-overlay');
    if (overlay) overlay.remove();
  }

  function setButtonLoading(button, loading = true) {
    if (loading) {
      button.classList.add('loading');
      button.disabled = true;
    } else {
      button.classList.remove('loading');
      button.disabled = false;
    }
  }

  function show(view){
    console.log('Showing view:', view);
    if(view==='app'){
      loginView.classList.add('d-none');
      appView.classList.remove('d-none');
    }else{
      appView.classList.add('d-none');
      loginView.classList.remove('d-none');
    }
    console.log('View switched to:', view);
  }

  function setSaving(flag){
    saveIndicator.textContent = flag ? 'Salvando...' : 'Salvo';
    if(!flag){ setTimeout(()=>{ if(saveIndicator.textContent==='Salvo') saveIndicator.textContent=''; }, 1500); }
  }

  // ---- Render ----
  function render(){
    dateInput.value = state.date;
    startTimeInput.value = state.startTime;
    endTimeInput.value = state.endTime;

    renderProducts();

    // Atualizar informações do usuário
    accountNameEl.textContent = state.account?.name || '';
    accountIdEl.textContent = state.account ? `ID: ${state.account.id}` : '';
    
    // Adicionar o dia da semana atual
    if (currentDayEl) {
      const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const today = new Date();
      currentDayEl.textContent = weekdays[today.getDay()];
      
      // Destacar se for fim de semana
      if (today.getDay() === 0 || today.getDay() === 6) {
        currentDayEl.classList.add('weekend');
      } else {
        currentDayEl.classList.remove('weekend');
      }
    }
  }

  function renderProducts(){
    productsGrid.innerHTML = '';
    
    // Atualizar contador de produtos
    if (productsCount) {
      const count = state.products.length;
      productsCount.textContent = `${count} produto${count !== 1 ? 's' : ''}`;
    }
    
    // Renderizar produtos em layout horizontal simplificado
    state.products.forEach((product, index) => {
      const productCard = document.createElement('div');
      productCard.className = 'product-item';
      productCard.innerHTML = `
        <div class="product-card-inline">
          <div class="product-info">
            <h6 class="product-name">${escapeHtml(product.name)}</h6>
          </div>
          <div class="product-controls-inline">
            <button class="btn btn-outline-secondary btn-control decr-product" data-product-id="${product.id}" title="Diminuir">
              <i class="bi bi-dash"></i>
            </button>
            <input type="number" class="form-control product-value-inline" 
                   value="${product.value}" min="0" data-product-id="${product.id}">
            <button class="btn btn-outline-secondary btn-control incr-product" data-product-id="${product.id}" title="Aumentar">
              <i class="bi bi-plus"></i>
            </button>
          </div>
        </div>
      `;
      productsGrid.appendChild(productCard);
    });

    // Adicionar event listeners
    productsGrid.addEventListener('click', handleProductActions);
    productsGrid.addEventListener('input', handleProductValueChange);
  }

  function handleProductActions(e) {
    const productId = e.target.closest('[data-product-id]')?.dataset.productId;
    if (!productId) return;

    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    if (e.target.closest('.incr-product')) {
      product.value += 1;
      saveDailyDebounced();
      renderProducts();
    } else if (e.target.closest('.decr-product')) {
      product.value = Math.max(0, product.value - 1);
      saveDailyDebounced();
      renderProducts();
    } else if (e.target.closest('.remove-product')) {
      if (confirm(`Tem certeza que deseja remover "${product.name}"?`)) {
        state.products = state.products.filter(p => p.id !== productId);
        saveDailyDebounced();
        renderProducts();
      }
    }
  }

  function handleProductValueChange(e) {
    if (!e.target.classList.contains('product-value-inline')) return;
    
    const productId = e.target.dataset.productId;
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    product.value = Math.max(0, parseInt(e.target.value) || 0);
    saveDailyDebounced();
  }

  function renderGroup(group){
    const el = document.createElement('div');
    el.className = 'group card';
    el.dataset.groupId = group.id;
    el.innerHTML = `
      <div class="group-header">
        <div class="group-title">
          <input class="group-name form-control" value="${escapeHtml(group.name)}" />
        </div>
        <div class="actions">
          <button class="btn btn-outline-primary btn-sm add-item">
            <i class="bi bi-plus-circle"></i> Item
          </button>
        </div>
      </div>
      <div class="group-items"></div>
    `;
    const itemsEl = qs('.group-items', el);
    group.items.forEach(item => itemsEl.appendChild(renderItem(group, item)));

    qs('.add-item', el).addEventListener('click', (e)=>{
      e.preventDefault();
      const item = { id: uid(), name: 'Novo Item', value: 0 };
      group.items.push(item);
      itemsEl.appendChild(renderItem(group, item));
      saveDailyDebounced();
    });
  // remover grupo desabilitado no layout principal (use o editor de estrutura)
    qs('.group-name', el).addEventListener('input', (e)=>{
      group.name = e.target.value;
      saveDailyDebounced();
    });

    return el;
  }

  function renderItem(group, item){
    const row = document.createElement('div');
    row.className = 'item';
    row.dataset.itemId = item.id;
    row.innerHTML = `
      <input class="item-name form-control form-control-sm" value="${escapeHtml(item.name)}" />
      <div class="counter">
        <button class="decr btn btn-outline-secondary btn-sm" title="Diminuir">
          <i class="bi bi-dash"></i>
        </button>
        <input class="value item-value form-control form-control-sm" type="number" min="0" step="1" value="${item.value}" />
        <button class="incr btn btn-outline-secondary btn-sm" title="Aumentar">
          <i class="bi bi-plus"></i>
        </button>
      </div>
    `;
    const nameInput = qs('.item-name', row);
  const valueInput = qs('.item-value', row);

    nameInput.addEventListener('input', (e)=>{
      item.name = e.target.value;
      saveDailyDebounced();
      updateReportPreviewCurrent();
    });
    qs('.incr', row).addEventListener('click', (e)=>{
      e.preventDefault();
      const next = (Number(valueInput.value||0) + 1);
      item.value = next; valueInput.value = String(next);
      saveDailyDebounced(); updateReportPreviewCurrent();
      showInfo(`${item.name}: ${next}`, 1500);
    });
    qs('.decr', row).addEventListener('click', (e)=>{
      e.preventDefault();
      const next = Math.max(0, Number(valueInput.value||0) - 1);
      item.value = next; valueInput.value = String(next);
      saveDailyDebounced(); updateReportPreviewCurrent();
      showInfo(`${item.name}: ${next}`, 1500);
    });
    valueInput.addEventListener('input', (e)=>{
      const n = Math.max(0, parseInt(e.target.value||'0',10) || 0);
      item.value = n;
      saveDailyDebounced();
      updateReportPreviewCurrent();
    });
  // remover item desabilitado no layout principal (use o editor de estrutura)

    return row;
  }

  function escapeHtml(s){ return s.replace(/[&<>\"]+/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]||c)); }

  // ---- PipeRun Integration (via n8n webhook) ----
  const N8N_WEBHOOK_URL = window.N8N_CONFIG?.webhookUrl || 'https://n8n.unitycompany.com.br/webhook/report/today';
  const N8N_TIMEOUT = window.N8N_CONFIG?.timeout || 15000;
  
  // Teste simples chamando o n8n
  async function testPipeRunConnectivity() {
    console.log('Testando conectividade via n8n webhook...');
    console.log('URL configurada:', N8N_WEBHOOK_URL);
    
    try {
      // Fazer um teste simples com dados mínimos
      const testPayload = {
        date: new Date().toISOString().split('T')[0],
        account_id: state.account?.id || 'test'
      };
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT);
      
      const resp = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!resp.ok) throw new Error(`n8n respondeu ${resp.status}: ${resp.statusText}`);
      const data = await resp.json();
      console.log('n8n OK:', data);
      return 'n8n';
    } catch (e) {
      console.log('Falha no webhook n8n:', e.message);
      if (e.name === 'AbortError') {
        throw new Error(`Timeout após ${N8N_TIMEOUT}ms. Verifique se o n8n está ativo.`);
      }
      throw new Error('Webhook n8n indisponível. Verifique a URL e se o workflow está ativo.');
    }
  }

  async function fetchPipeRunData() {
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log('🔄 Buscando dados do PipeRun via n8n para:', today);
      
      // Payload exato para o n8n
      const payload = {
        date: today,
        account_id: state.account?.id || 'unknown'
      };
      
      console.log('📤 Enviando requisição para n8n:', payload);
      console.log('📍 URL:', N8N_WEBHOOK_URL);
      
      // Fazer requisição para o webhook do n8n
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`n8n webhook falhou: ${response.status} - ${response.statusText}`);
      }
      
      const rawResult = await response.json();
      console.log('📥 Resposta completa do n8n:', JSON.stringify(rawResult, null, 2));
      
      // O n8n retorna um array, pegar o primeiro item
      const data = Array.isArray(rawResult) ? rawResult[0] : rawResult;
      
      if (!data) {
        throw new Error('n8n retornou dados vazios ou em formato inesperado');
      }
      
      console.log('📊 Dados extraídos do array:', JSON.stringify(data, null, 2));
      
      // Validar estrutura dos dados recebidos (nova estrutura)
      if (typeof data.total_atendimentos !== 'number') {
        console.warn('⚠️ Estrutura de dados inesperada:', data);
        throw new Error('Dados do n8n não contêm estrutura esperada (total_atendimentos)');
      }
      
      // Converter estrutura do n8n para nossa estrutura interna
      const convertedData = convertN8nToPipeRunData(data);
      
      // Atualizar state com dados convertidos
      state.pipeRunData = convertedData;
      
      console.log('✅ Dados do PipeRun atualizados via n8n!');
      console.log('📈 Resumo:', {
        atendimentos: convertedData.totalAtendimentos,
        mql: convertedData.cardsMql,
        perdidos: convertedData.perdidos,
        duplicados: convertedData.duplicados,
        tentativas: convertedData.tentativasContato
      });
      
      showSuccess('Dados do PipeRun atualizados com sucesso!', 3000);
      
    } catch (error) {
      console.error('❌ Erro ao buscar dados via n8n:', error);
      
      // Mostrar dados de exemplo em caso de erro para teste
      const exemploData = {
        totalAtendimentos: 0,
        qualificados: 0,
        perdidos: 0,
        tentativasContato: 0,
        duplicados: 0,
        cardsMql: 0,
        motivoPerda: '- Erro ao conectar com n8n'
      };
      
      state.pipeRunData = exemploData;
      console.log('📊 Usando dados zerados devido ao erro:', exemploData);
      
      const errorDetails = [
        'Detalhes do erro:',
        error.message,
        '',
        'Possíveis causas:',
        '• Webhook n8n indisponível ou inativo',
        '• URL do webhook incorreta',
        '• Workflow n8n com erro',
        '• Estrutura de dados retornada diferente do esperado',
        '',
        'Dados zerados carregados temporariamente.'
      ].join('\n');
      
      showError(`Erro ao conectar com N8N: ${errorDetails}`);
      
      // Re-throw o erro para que quem chamou saiba que falhou
      throw error;
    }
  }

  // Função para converter dados do n8n para formato interno
  function convertN8nToPipeRunData(n8nData) {
    console.log('Dados recebidos do n8n (raw):', JSON.stringify(n8nData, null, 2));
    
  // Usar exatamente os dados que vêm do n8n com os cálculos solicitados
    const totalAtendimentos = n8nData.total_atendimentos || 0;
    const totalGanhos = n8nData.total_ganho || 0;
    const totalPerdidosRaw = n8nData.total_perdidos || 0;
    const totalDuplicados = n8nData.total_duplicados || 0;
    const totalMql = n8nData.total_mql || 0;
    
  // Cálculos conforme solicitado:
  // - Qualificados = total_ganho
  // - Perdidos = total_perdidos (exatamente como vem do n8n)
  // - Duplicados = total_duplicados (separado)
  // - Tentativas = total_atendimentos - total_ganho - perdidos (não considerar duplicados)
    const qualificados = totalGanhos;
  const perdidos = Math.max(0, totalPerdidosRaw);
  const tentativasContato = Math.max(0, totalAtendimentos - totalGanhos - perdidos);
    
    // Processar motivos de perda - mostrar todos os motivos do N8N
    let motivosPerdaTexto = '';
    console.log('🔍 Verificando motivos_de_perda:', n8nData.motivos_de_perda);
    const motivosArray = Array.isArray(n8nData.motivos_de_perda) ? n8nData.motivos_de_perda : [];
    const filteredMotivos = motivosArray.filter(m => String(m).trim().toUpperCase() !== 'LEAD DUPLICADO');
    if (filteredMotivos.length > 0) {
      motivosPerdaTexto = filteredMotivos.map(motivo => `- ${motivo}`).join('\n');
      console.log('✅ Motivos processados (sem LEAD DUPLICADO):', motivosPerdaTexto);
    } else {
      // nenhum motivo útil após filtro; manter texto vazio para não imprimir fallback padrão
      motivosPerdaTexto = '';
      console.log('ℹ️ Nenhum motivo de perda (após filtro de duplicados)');
    }
    
    // Mapear para nossa estrutura
    const convertedData = {
      totalAtendimentos: totalAtendimentos,
      qualificados: qualificados,        // = total_ganho
      perdidos: perdidos,                // = total_perdidos - total_duplicados
      tentativasContato: tentativasContato, // = total_atendimentos - total_ganho - perdidos
      duplicados: totalDuplicados,
      cardsMql: totalMql,               // Manter para compatibilidade
      motivoPerda: motivosPerdaTexto,
      // Dados extras do n8n para referência
      // manter compatibilidade e permitir renderização condicional sem fallback
      n8nData: {
        motivos_de_perda: filteredMotivos
      },
      _n8nData: {
        total_ganho: totalGanhos,
        total_perdidos_raw: totalPerdidosRaw,
        total_mql: totalMql,
        data_original: n8nData.date || n8nData.day
      }
    };
    
    console.log('✅ Dados calculados conforme regras:', {
      totalAtendimentos,
      qualificados: `${qualificados} (= total_ganho: ${totalGanhos})`,
      perdidos: `${perdidos} (= total_perdidos: ${totalPerdidosRaw})`,
  tentativasContato: `${tentativasContato} (= ${totalAtendimentos} - ${totalGanhos} - ${perdidos})`,
      duplicados: totalDuplicados
    });
    
    return convertedData;
  }

  // Funções removidas - agora tudo é feito pelo n8n
  async function fetchPipeRunReport(date) {
    // Esta função não é mais necessária - n8n faz tudo
    throw new Error('Use fetchPipeRunData() que chama o n8n');
  }

  async function fetchPipeRunMQLCards() {
    // Esta função não é mais necessária - n8n faz tudo
    throw new Error('Use fetchPipeRunData() que chama o n8n');
  }

  function processPipeRunData(reportData, mqlCards) {
    // Esta função não é mais necessária - n8n processa tudo
    throw new Error('Processamento feito pelo n8n');
  }

  // ---- Persistence ----
  async function ensureAccount(id, name){
    const ref = colAccounts().doc(id);
    const snap = await ref.get();
    if(!snap.exists){ await ref.set({ id, name, createdAt: Date.now() }); }
    return (await ref.get()).data();
  }

  async function getAccount(id){
    const snap = await colAccounts().doc(id).get();
    return snap.exists ? snap.data() : null;
  }

  async function loadDaily(date, accountId){
    const snap = await dailyDoc(date, accountId).get();
    return snap.exists ? snap.data() : null;
  }

  async function saveDaily(){
    if(!state.account) return;
    setSaving(true);
    const payload = {
      account: state.account, // {id,name}
      date: state.date,
      startTime: state.startTime,
      endTime: state.endTime,
      products: state.products,
      pipeRunData: state.pipeRunData,
      pipeRunConfig: state.pipeRunConfig,
      updatedAt: Date.now()
    };
    await dailyDoc(state.date, state.account.id).set(payload, { merge: true });
    setSaving(false);
    showSuccess('Dados salvos automaticamente', 2000);
  }

  const saveDailyDebounced = debounce(saveDaily, 500);

  async function listAccounts(){
    const snap = await colAccounts().get();
    state.accountsCache = snap.docs.map(d=>d.data());
  }

  // ---- Global Product Structure (Shared across accounts) ----
  let unsubscribeStructure = null;

  function sortByOrder(arr){ return [...arr].sort((a,b)=> (a.order??0) - (b.order??0)); }

  function mergeStructureWithDaily(structureProducts, dailyProducts){
    const dailyById = new Map();
    const dailyByName = new Map();
    (dailyProducts||[]).forEach(p=>{
      if(p?.id) dailyById.set(p.id, p);
      if(p?.name) dailyByName.set(String(p.name).trim().toLowerCase(), p);
    });
    return sortByOrder(structureProducts||[]).map(sp=>{
      const match = dailyById.get(sp.id) || dailyByName.get(String(sp.name||'').trim().toLowerCase());
      return { id: sp.id, name: sp.name, value: Number(match?.value)||0 };
    });
  }

  async function ensureGlobalStructure(){
    const ref = structureDoc();
    const snap = await ref.get();
    if(!snap.exists){
      const base = (state.products||[]).map((p,idx)=>({ id: uid(), name: p.name, order: idx }));
      await ref.set({ products: base, createdAt: Date.now(), updatedAt: Date.now(), updatedBy: state.account?.id||'system' });
      state.productStructure = base;
      return base;
    }
    const data = snap.data();
    const arr = Array.isArray(data.products) ? data.products : [];
    state.productStructure = sortByOrder(arr);
    return state.productStructure;
  }

  function subscribeGlobalStructure(){
    if(unsubscribeStructure){ try{unsubscribeStructure();}catch(_){} }
    unsubscribeStructure = structureDoc().onSnapshot(snap=>{
      if(!snap.exists) return;
      const data = snap.data();
      const arr = Array.isArray(data.products) ? data.products : [];
      state.productStructure = sortByOrder(arr);
      // Reconciliate local products preserving values
      state.products = mergeStructureWithDaily(state.productStructure, state.products);
      renderProducts();
    }, err=> console.error('Listener estrutura global erro:', err));
  }

  async function saveGlobalStructure(rows){
    // rows: [{id,name,order}]
    await structureDoc().set({ products: rows, updatedAt: Date.now(), updatedBy: state.account?.id||'unknown' }, { merge: true });
    state.productStructure = sortByOrder(rows);
    // Update local state preserving values
    state.products = mergeStructureWithDaily(state.productStructure, state.products);
  }

  async function syncStructureToAllAccounts(targetDate){
    try{
      const accountsSnap = await colAccounts().get();
      const ids = accountsSnap.docs.map(d=>d.id);
      const struct = state.productStructure;
      for(const accId of ids){
        const ref = dailyDoc(targetDate, accId);
        const snap = await ref.get();
        if(!snap.exists) continue;
        const data = snap.data();
        const merged = mergeStructureWithDaily(struct, data.products||[]);
        await ref.set({ products: merged, updatedAt: Date.now() }, { merge: true });
      }
      console.log('Estrutura sincronizada em', ids.length, 'contas');
    }catch(err){
      console.error('Falha ao sincronizar estrutura para todas as contas:', err);
    }
  }

  // ---- Report Generation ----
  function buildReportText({ titleDate, startTime, endTime, products, pipeRunData }){
    const parts = [];
    parts.push(`Entrada de Lead do Dia ${titleDate} de ${timeHuman(startTime)} às ${timeHuman(endTime)}.`);
    parts.push('');
    parts.push('');
    
    // Total de Atendimentos
    parts.push(`Total de Atendimentos: ${pipeRunData.totalAtendimentos}`);
    parts.push('');
    
    // MEGA SALDÃO DE FORROS (buscar nos produtos)
    const megaSaldao = products.find(p => p.name === 'MEGA SALDÃO DE FORROS');
    if (megaSaldao && megaSaldao.value > 0) {
      parts.push(`MEGA SALDÃO DE FORROS: ${megaSaldao.value}`);
      parts.push('');
    }
    
    // Qualificados
    parts.push(`Qualificados: ${pipeRunData.qualificados}`);
    parts.push('');
    parts.push('');
    
    // Produtos/Interesses - usar produtos dinâmicos da configuração
    if (products && products.length > 0) {
      // ordenar conforme estrutura global atual, se houver
      const order = new Map((state.productStructure||[]).map((p,i)=>[p.name,i]));
      const sorted = [...products].sort((a,b)=> (order.get(a.name)??999) - (order.get(b.name)??999));
      sorted.forEach(produto => {
        const valor = produto.value > 0 ? produto.value : '-';
        parts.push(`${produto.name}: ${valor}`);
      });
    } else {
      // Fallback para ordem específica se não houver produtos configurados
      const produtosOrdem = [
        'Placas Drywall',
        'Perfis Drywall', 
        'Glasroc X',
        'Painel wall',
        'Placa Cimentícia',
        'Perfis de Steel Frame',
        'Steel Frame Obras',
        'Quartzolit',
        'Acústica',
        'Piso Vinílico'
      ];
      
      produtosOrdem.forEach(nomeProduto => {
        parts.push(`${nomeProduto}: -`);
      });
    }
    
    parts.push('');
    parts.push('');
    
    // TOTAL STEEL FRAME PRODUTOS (buscar nos produtos)
    const totalSteel = products.find(p => p.name === 'TOTAL STEEL FRAME PRODUTOS');
    const steelValue = totalSteel && totalSteel.value > 0 ? totalSteel.value : '-';
    parts.push(`TOTAL STEEL FRAME PRODUTOS: ${steelValue}`);
    parts.push('');
    parts.push('');
    
    // Leads em tentativas de contato
    parts.push(`Leads em tentativas de contato: ${pipeRunData.tentativasContato}`);
    parts.push('');
    parts.push('');
    
    // CARDS NO MQL - usar "-" se for 0 ou vazio
    const cardsMql = pipeRunData.cardsMql > 0 ? pipeRunData.cardsMql : '-';
    parts.push(`CARDS NO MQL: ${cardsMql}`);
    parts.push('');
    parts.push('');
    
    // Perdidos
    parts.push(`Perdidos: ${pipeRunData.perdidos}`);
    parts.push('');
    
    // Duplicado - usar "-" se for 0
    const duplicados = pipeRunData.duplicados > 0 ? pipeRunData.duplicados : '-';
    parts.push(`Duplicado: ${duplicados}`);
    parts.push('');
    
    // Motivos de perda - usar dados processados do pipeRunData (sem LEAD DUPLICADO)
    if (pipeRunData.motivoPerda && pipeRunData.motivoPerda.trim() !== '') {
      parts.push(pipeRunData.motivoPerda);
    } else if (pipeRunData.n8nData && Array.isArray(pipeRunData.n8nData.motivos_de_perda) && pipeRunData.n8nData.motivos_de_perda.length > 0) {
      pipeRunData.n8nData.motivos_de_perda.forEach(motivo => {
        parts.push(`- ${motivo}`);
      });
    } // caso contrário, não imprimir motivos

    return parts.join('\n');
  }

  // Função para relatórios históricos baseada em totals coletados
  function buildHistoryReportText({ titleDate, startTime, endTime, totals, totalSteel, motivosPerda }){
    const parts = [];
    parts.push(`Entrada de Lead do Dia ${titleDate} de ${timeHuman(startTime)} às ${timeHuman(endTime)}.`);
    parts.push('');
    parts.push('');
    
    // Total de Atendimentos
    const totalAtendimentos = totals['Total de Atendimentos'] || 0;
    parts.push(`Total de Atendimentos: ${totalAtendimentos || '-'}`);
    parts.push('');
    
    // MEGA SALDÃO DE FORROS
    const megaSaldao = totals['MEGA SALDÃO DE FORROS'] || 0;
    if (megaSaldao > 0) {
      parts.push(`MEGA SALDÃO DE FORROS: ${megaSaldao}`);
      parts.push('');
    }
    
    // Qualificados
    const qualificados = totals['Qualificados'] || 0;
    parts.push(`Qualificados: ${qualificados || '-'}`);
    parts.push('');
    parts.push('');
    
    // Produtos/Interesses - ordem específica
    const produtosOrdem = [
      'Placas Drywall',
      'Perfis Drywall', 
      'Glasroc X',
      'Painel wall',
      'Placa Cimentícia',
      'Perfis de Steel Frame',
      'Steel Frame Obras',
      'Quartzolit',
      'Acústica',
      'Piso Vinílico'
    ];
    
    produtosOrdem.forEach(nomeProduto => {
      const valor = totals[nomeProduto] || 0;
      parts.push(`${nomeProduto}: ${valor > 0 ? valor : '-'}`);
    });
    
    parts.push('');
    parts.push('');
    
    // TOTAL STEEL FRAME PRODUTOS
    const totalSteelValue = totals['TOTAL STEEL FRAME PRODUTOS'] || totalSteel || 0;
    parts.push(`TOTAL STEEL FRAME PRODUTOS: ${totalSteelValue > 0 ? totalSteelValue : '-'}`);
    parts.push('');
    parts.push('');
    
    // Leads em tentativas de contato
    const tentativas = totals['Leads em tentativas de contato'] || 0;
    parts.push(`Leads em tentativas de contato: ${tentativas || '-'}`);
    parts.push('');
    parts.push('');
    
    // CARDS NO MQL
    const cardsMql = totals['CARDS NO MQL'] || 0;
    parts.push(`CARDS NO MQL: ${cardsMql > 0 ? cardsMql : '-'}`);
    parts.push('');
    parts.push('');
    
    // Perdidos
    const perdidos = totals['Perdidos'] || 0;
    parts.push(`Perdidos: ${perdidos || '-'}`);
    parts.push('');
    
    // Duplicado
    const duplicados = totals['Duplicado'] || 0;
    parts.push(`Duplicado: ${duplicados > 0 ? duplicados : '-'}`);
    parts.push('');
    
    // Motivos de perda - usar dados salvos ou padrão
    if (motivosPerda && Array.isArray(motivosPerda) && motivosPerda.length > 0) {
      motivosPerda.forEach(motivo => {
        parts.push(`-${motivo}`);
      });
    } else {
      // Fallback para motivos padrão
      parts.push('-Produto que não Trabalhamos');
      parts.push('-Cliente longe da loja mais próxima');
      parts.push('-Cliente informou não ter mais interesse');
      parts.push('-Sem informações para contato');
    }

    return parts.join('\n');
  }

  function collectTotals(dailies){
    // Accumulate values by item name across groups
    const totalsMap = new Map();
    let startTime = null, endTime = null;
    let motivosPerda = [];

    dailies.forEach(d => {
      startTime = startTime || d.startTime;
      endTime = endTime || d.endTime;
      
      // Coletar motivos de perda do pipeRunData salvo
      if (d.pipeRunData && d.pipeRunData.n8nData && d.pipeRunData.n8nData.motivos_de_perda) {
        motivosPerda = motivosPerda.concat(d.pipeRunData.n8nData.motivos_de_perda);
      }
      
      (d.groups||[]).forEach(g => (g.items||[]).forEach(it => {
        const k = it.name.trim();
        totalsMap.set(k, (totalsMap.get(k)||0) + (Number(it.value)||0));
      }));
    });

    // Remover duplicatas dos motivos de perda
    motivosPerda = [...new Set(motivosPerda)];

    const totals = Object.fromEntries(totalsMap.entries());

    // Build product lines: include all items except big summary ones
    const exclude = new Set([
      'Total de Atendimentos','Qualificados','Leads em tentativas de contato','Perdidos','CARDS NO MQL','MEGA SALDÃO DE FORROS','TOTAL STEEL FRAME PRODUTOS'
    ]);
    const lines = [];
    const steelKeys = ['Perfis de Steel Frame','Steel Frame Obras'];
    let totalSteel = 0;

    Object.entries(totals).forEach(([name, val]) => {
      if(exclude.has(name)) return;
      if(name.toLowerCase().includes('steel frame')) totalSteel += val;
      lines.push(`${name}: ${val || '-'}`);
    });

    // Ensure listed keys appear even if 0/-
    const preferredOrder = (state.productStructure && state.productStructure.length)
      ? state.productStructure.map(p=>p.name)
      : ['Placas Drywall','Perfis Drywall','Glasroc X','Painel wall','Placa Cimentícia','Perfis de Steel Frame','Steel Frame Obras','Quartzolit','Acústica','Piso Vinílico'];
    const ordered = [];
    preferredOrder.forEach(k=>{
      const v = totals.hasOwnProperty(k) ? totals[k] : 0;
      ordered.push(`${k}: ${v || '-'}`);
    });
    // Add remaining not in preferred
    lines.sort();
    const rest = lines.filter(l => !preferredOrder.some(pk => l.startsWith(pk+':')));

    const finalLines = ordered.concat(rest);

    return { totals, lines: finalLines, totalSteel, startTime: startTime||state.startTime, endTime: endTime||state.endTime, motivosPerda };
  }

  // Função updateReportPreview removida - não é mais necessária com a nova interface

  function formatBRDate(iso){
    const [y,m,d]=iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function timeHuman(t){
    if(!t) return '';
    const [hh,mm] = t.split(':').map(Number);
    return mm && mm!==0 ? `${hh}h${mm}` : `${hh}h`;
  }

  function valueOrDash(v){
    const n = Number(v||0);
    return n>0 ? String(n) : '-';
  }

  function updateReportPreviewCurrent(){
    // Função mantida para compatibilidade
    // A pré-visualização foi removida da interface
  }

  // ---- Events wiring ----
  loginForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    console.log('Login form submitted');
    const submitBtn = qs('button[type="submit"]', loginForm);
    loginError.classList.add('d-none'); loginError.textContent = '';
    const id = loginIdInput.value.trim();
    if(!id) return;
    
    console.log('Logging in with ID:', id);
    setButtonLoading(submitBtn, true);
    try{
      const acc = await getAccount(id);
      console.log('Account result:', acc);
      if(!acc){ throw new Error('Conta não encontrada'); }
      state.account = acc;
      await afterLogin();
    }catch(err){
      console.error('Login error:', err);
      loginError.textContent = err.message || String(err);
      loginError.classList.remove('d-none');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  signupForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const submitBtn = qs('button[type="submit"]', signupForm);
    loginError.classList.add('d-none'); loginError.textContent = '';
    const id = (signupIdInput.value||'').trim();
    const name = (signupNameInput.value||'').trim();
    if(!id || !name){ loginError.textContent = 'Preencha Nome e ID.'; loginError.classList.remove('d-none'); return; }
    
    setButtonLoading(submitBtn, true);
    try{
      const existing = await getAccount(id);
      if(existing){ throw new Error('ID já em uso. Escolha outro.'); }
      const acc = await ensureAccount(id, name);
      state.account = acc;
      await afterLogin();
    }catch(err){
      loginError.textContent = err.message || String(err);
      loginError.classList.remove('d-none');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  logoutBtn.addEventListener('click', ()=>{
    state.account = null;
    localStorage.removeItem('rpv_account_id');
    show('login');
  });

  dateInput.addEventListener('change', async ()=>{
    state.date = dateInput.value;
    
    // Aplicar horários automáticos baseado no dia da semana
    const workingHours = getWorkingHours(state.date);
    state.startTime = workingHours.start;
    state.endTime = workingHours.end;
    
    // Atualizar os inputs de horário
    startTimeInput.value = state.startTime;
    endTimeInput.value = state.endTime;
    
    await loadOrInitDaily();
  });
  startTimeInput.addEventListener('change', ()=>{ state.startTime = startTimeInput.value; saveDailyDebounced(); updateReportPreviewCurrent(); });
  endTimeInput.addEventListener('change', ()=>{ state.endTime = endTimeInput.value; saveDailyDebounced(); updateReportPreviewCurrent(); });

  // Modificar o botão Gerar Relatório para buscar dados do PipeRun
  generateReportBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Buscar dados do PipeRun antes de gerar o relatório
    setButtonLoading(generateReportBtn, true);
    try {
      await fetchPipeRunData();
      
      // Salvar os dados atualizados no Firebase imediatamente
      await saveDaily();
      
      // Agora mostrar modal de relatório com dados atualizados
      reportModal.show();
    } catch (error) {
      console.error('Erro ao buscar dados do PipeRun:', error);
      // Continuar mesmo com erro - mostrar modal sem dados do PipeRun
      reportModal.show();
    } finally {
      setButtonLoading(generateReportBtn, false);
    }
  });

  // Structure editor
  structureBtn.addEventListener('click', ()=>{
    renderStructureEditor();
    structureModal.show();
  });

  addProductStructBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    const newProduct = { id: uid(), name: 'Novo Produto', order: (state.productStructure?.length||0) };
    if (!state.productStructure) state.productStructure = [];
    state.productStructure.push(newProduct);
    renderStructureEditor();
    showInfo('Novo produto adicionado', 2000);
    
    // Foca no campo do produto recém-criado
    setTimeout(() => {
      const newProductInput = document.querySelector(`[data-id="${newProduct.id}"] .product-name-input`);
      if (newProductInput) {
        newProductInput.focus();
        newProductInput.select();
      }
    }, 100);
  });

  saveStructureBtn.addEventListener('click', async (e)=>{
    e.preventDefault();
    // Coletar produtos da tabela na ordem atual para salvar como estrutura GLOBAL
    const rows = [];
    qsa('.product-row', structureEditor).forEach((row, idx) => {
      const pid = row.dataset.id;
      const pname = qs('.product-name-input', row).value.trim() || 'Produto';
      rows.push({ id: pid, name: pname, order: idx });
    });
    try{
      showLoading('Salvando estrutura global...');
      await saveGlobalStructure(rows);
      // Atualizar o daily atual com a estrutura nova mantendo valores
      await saveDaily();
      // Sincronizar para todas as contas do dia
      await syncStructureToAllAccounts(state.date);
      structureModal.hide();
      showSuccess('Estrutura global salva e sincronizada!', 3000);
    } finally {
      hideLoading();
    }
  });

  // Drag and Drop functions for products reordering
  let draggedRow = null;
  
  function handleDragStart(e) {
    draggedRow = this;
    this.style.opacity = '0.5';
    this.querySelector('.drag-handle').style.cursor = 'grabbing';
  }
  
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Visual feedback
    const rows = Array.from(this.parentNode.children);
    rows.forEach(row => row.classList.remove('drag-over'));
    this.classList.add('drag-over');
  }
  
  function handleDrop(e) {
    e.preventDefault();
    
    if (draggedRow !== this) {
      const tbody = this.parentNode;
      const draggedIndex = Array.from(tbody.children).indexOf(draggedRow);
      const targetIndex = Array.from(tbody.children).indexOf(this);
      
      // Reorder in DOM
      if (draggedIndex < targetIndex) {
        tbody.insertBefore(draggedRow, this.nextSibling);
      } else {
        tbody.insertBefore(draggedRow, this);
      }
      
      // Reorder in state
      const draggedProduct = state.products[draggedIndex];
      state.products.splice(draggedIndex, 1);
      const newTargetIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
      state.products.splice(newTargetIndex, 0, draggedProduct);
      
      // Update position numbers
      updatePositionNumbers();
    }
    
    this.classList.remove('drag-over');
  }
  
  function handleDragEnd(e) {
    this.style.opacity = '';
    this.querySelector('.drag-handle').style.cursor = 'grab';
    
    // Remove all drag-over classes
    const rows = Array.from(this.parentNode.children);
    rows.forEach(row => row.classList.remove('drag-over'));
  }
  
  function updatePositionNumbers() {
    const rows = qsa('.product-row', structureEditor);
    rows.forEach((row, index) => {
      const badge = row.querySelector('.position-number .badge');
      if (badge) {
        badge.textContent = index + 1;
      }
    });
  }

  function renderStructureEditor(){
    structureEditor.innerHTML = '';
    const struct = state.productStructure || [];
    if (!struct || struct.length === 0) {
      structureEditor.innerHTML = `
        <div class="text-center py-4">
          <p class="text-muted">Nenhum produto definido. Clique em "Adicionar Produto" para começar.</p>
        </div>
      `;
      return;
    }
    
    const table = document.createElement('table');
    table.className = 'table table-sm table-hover products-table';
    table.innerHTML = `
      <thead class="table-light">
        <tr>
          <th width="40" class="text-center"><i class="bi bi-arrows-move text-muted"></i></th>
          <th width="50" class="text-center">#</th>
          <th>Nome do Produto</th>
          <th width="120" class="text-center">Valor Atual</th>
          <th width="60" class="text-center">Ações</th>
        </tr>
      </thead>
      <tbody id="products-tbody"></tbody>
    `;
    
  const tbody = table.querySelector('#products-tbody');
  // Mostrar linhas com base na estrutura global, exibindo valor atual do dia se existir
  const valueById = new Map((state.products||[]).map(p=>[p.id, p.value]));
  sortByOrder(struct).forEach((product, index) => {
      const row = document.createElement('tr');
      row.className = 'product-row';
      row.draggable = true;
      row.dataset.id = product.id;
      row.innerHTML = `
        <td class="text-center drag-handle" style="cursor: grab;">
          <i class="bi bi-grip-vertical text-muted"></i>
        </td>
        <td class="text-center position-number">
          <span class="badge bg-light text-dark">${index + 1}</span>
        </td>
        <td>
          <input class="form-control form-control-sm product-name-input" 
                 value="${escapeHtml(product.name)}" 
                 placeholder="Nome do produto"/>
        </td>
        <td class="text-center">
      <small class="text-muted">${valueById.get(product.id) || 0}</small>
        </td>
        <td class="text-center">
          <button class="btn btn-outline-danger btn-sm remove-product" title="Remover produto">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
      
      // Event listener para remoção
      const removeBtn = row.querySelector('.remove-product');
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm(`Tem certeza que deseja remover "${product.name}" da estrutura global?`)) {
          state.productStructure = (state.productStructure||[]).filter(p => p.id !== product.id).map((p, idx)=>({ ...p, order: idx }));
          renderStructureEditor();
        }
      });
      
      // Drag and drop eventos
      row.addEventListener('dragstart', handleDragStart);
      row.addEventListener('dragover', handleDragOver);
      row.addEventListener('drop', handleDrop);
      row.addEventListener('dragend', handleDragEnd);
      
      tbody.appendChild(row);
    });
    
    structureEditor.appendChild(table);
  }

  function renderStructItem(it){
    const row = document.createElement('div');
    row.className = 'sg-item mb-2';
    row.dataset.id = it.id;
    row.innerHTML = `
      <div class="row align-items-center">
        <div class="col-10">
          <input class="form-control si-name" value="${escapeHtml(it.name)}" placeholder="Nome do item"/>
        </div>
        <div class="col-2 text-end">
          <button class="btn btn-outline-danger btn-sm si-remove">
            <i class="bi bi-x"></i>
          </button>
        </div>
      </div>
    `;
    qs('.si-remove', row).addEventListener('click', (e)=>{
      e.preventDefault(); 
      if (confirm('Remover este item?')) {
        row.remove();
      }
    });
    return row;
  }

  // Event listeners removidos - elementos não existem mais na interface
  // lossReasonsTextarea, copyReportBtn foram removidos

  // Final report modal event listeners
  copyFinalReportBtn.addEventListener('click', async ()=>{
    await navigator.clipboard.writeText(finalReportText.value);
    copyFinalReportBtn.innerHTML = '<i class="bi bi-check-circle"></i> Copiado!';
    setTimeout(()=>{
      copyFinalReportBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copiar Texto';
    }, 2000);
  });

  finalReportText.addEventListener('input', ()=>{
    updateWhatsAppLink(finalReportText.value);
  });

  generateReportBtn.addEventListener('click', async ()=>{
    // open modal with account list
    reportDate.value = state.date;
    await listAccounts();
    accountsList.innerHTML = '';
    state.accountsCache.forEach(acc=>{
      const id = `acc_${acc.id}`;
      const row = document.createElement('div');
      row.className = 'check-row';
      row.innerHTML = `
        <input type="checkbox" id="${id}" value="${acc.id}" ${acc.id===state.account.id?'checked':''} />
        <label for="${id}">${acc.name} (#${acc.id})</label>
      `;
      accountsList.appendChild(row);
    });
    // Show modal
    reportModal.show();
  });

  runReportBtn.addEventListener('click', async (e)=>{
    e.preventDefault();
    setButtonLoading(runReportBtn, true);
    
    try {
      const date = reportDate.value || state.date;
      const ids = qsa('input[type="checkbox"]', accountsList).filter(c=>c.checked).map(c=>c.value);
      const sum = sumSelected.checked;

      console.log('Parâmetros do relatório:', { date, ids, sum });

      if (ids.length === 0) {
        showWarning('Selecione pelo menos uma conta para gerar o relatório.');
        return;
      }

      // Se estamos gerando para a conta atual e data atual, usar dados mais recentes
      const isCurrentAccountAndDate = ids.length === 1 && ids[0] === state.account.id && date === state.date;

      const dailies = [];
      if(sum){
        console.log(`🔄 Modo soma ativado. Carregando dados de ${ids.length} conta(s):`, ids);
        for(const id of ids){
          const d = await dailyDoc(date, id).get();
          if(d.exists) {
            const data = d.data();
            // alinhar produtos com a estrutura global
            data.products = mergeStructureWithDaily(state.productStructure, data.products||[]);
            console.log(`✅ Dados carregados para conta ${id}:`, {
              produtos: data.products?.length || 0,
              atendimentos: data.pipeRunData?.totalAtendimentos || 0
            });
            dailies.push(data);
          } else {
            console.log(`⚠️ Sem dados para conta ${id} na data ${date}`);
          }
        }
        console.log(`📊 Total de ${dailies.length} conta(s) com dados encontrada(s)`);
      }else{
        // if not summing, allow a single selected account; fallback to current account
        let targetId = state.account.id;
        if(ids.length === 1){
          targetId = ids[0];
        }else if(ids.length > 1){
          showWarning('Selecione apenas 1 conta ou ative a soma de contas.');
          return;
        }
        
        if(isCurrentAccountAndDate) {
          // Usar dados atuais do state para conta e data atual
          console.log('Usando dados atuais do state para relatório');
          const currentDaily = {
            account: state.account,
            date: state.date,
            startTime: state.startTime,
            endTime: state.endTime,
            products: state.products,
            pipeRunData: state.pipeRunData,
            pipeRunConfig: state.pipeRunConfig
          };
          dailies.push(currentDaily);
        } else {
          // Carregar do Firebase para outras situações
          const d = await dailyDoc(date, targetId).get();
          if(d.exists) {
            const data = d.data();
            data.products = mergeStructureWithDaily(state.productStructure, data.products||[]);
            dailies.push(data);
          }
        }
      }

      if(!dailies.length){
        if (sum) {
          showWarning(`Nenhuma conta selecionada possui dados para ${formatBRDate(date)}. Verifique se as contas têm dados salvos para essa data.`);
        } else {
          showWarning(`Sem dados para a conta selecionada em ${formatBRDate(date)}.`);
        }
        return;
      }

      console.log('Dados usados no relatório:', dailies[0]);

      // Generate report text
      const reportText = generateReportText(dailies, date);
      
      // Salvar relatório no Firebase para histórico
      try {
        if (dailies.length === 1) {
          // Relatório de conta única
          const daily = dailies[0];
          console.log('Salvando relatório de conta única:', daily.account?.id || state.account.id);
          await saveGeneratedReport(date, (daily.account?.id || state.account.id), reportText, {
            startTime: daily.startTime || state.startTime,
            endTime: daily.endTime || state.endTime,
            products: daily.products || state.products,
            pipeRunData: daily.pipeRunData || state.pipeRunData,
            isMultiAccount: false,
            accountsCount: 1
          });
        } else {
          // Relatório somado de múltiplas contas
          const accountIds = dailies.map(d => d.account?.id).filter(Boolean);
          console.log(`Salvando relatório somado de ${dailies.length} contas:`, accountIds);
          
          // Usar o primeiro horário encontrado ou horário atual
          let startTime = dailies[0]?.startTime || state.startTime;
          let endTime = dailies[0]?.endTime || state.endTime;
          
          // Recalcular apenas os produtos (não PipeRun)
          const productTotals = new Map();
          
          dailies.forEach(daily => {
            if (daily.products) {
              daily.products.forEach(product => {
                const current = productTotals.get(product.name) || 0;
                productTotals.set(product.name, current + (product.value || 0));
              });
            }
          });

          const productsArray = Array.from(productTotals.entries()).map(([name, value]) => ({
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            value
          }));

          // Usar dados do PipeRun uma vez só (não somar)
          const pipeRunData = state.pipeRunData || dailies.find(d => d.pipeRunData)?.pipeRunData || {
            totalAtendimentos: 0,
            qualificados: 0,
            perdidos: 0,
            tentativasContato: 0,
            duplicados: 0,
            cardsMql: 0,
            motivoPerda: '- Produto que não trabalhamos'
          };

          await saveGeneratedReport(date, 'MULTI_ACCOUNT', reportText, {
            startTime: startTime,
            endTime: endTime,
            products: productsArray,
            pipeRunData: pipeRunData,
            isMultiAccount: true,
            accountsCount: dailies.length,
            accountIds: accountIds
          });
        }
      } catch (error) {
        console.error('Erro ao salvar relatório:', error);
        showWarning('Relatório gerado mas houve erro ao salvar no histórico.');
      }
      
      // Close report modal and show final modal
      reportModal.hide();
      
      // Show final report modal
      finalReportText.value = reportText;
      updateWhatsAppLink(reportText);
      finalReportModal.show();
      
      if (sum && dailies.length > 1) {
        showSuccess(`Relatório gerado e salvo somando ${dailies.length} contas!`, 4000);
      } else if (dailies.length === 1) {
        showSuccess('Relatório gerado e salvo com sucesso!', 3000);
      } else {
        showSuccess('Relatório gerado com sucesso!', 3000);
      }
      
    } finally {
      setButtonLoading(runReportBtn, false);
    }
  });

  function generateReportText(dailies, date) {
    if (!dailies || !dailies.length) return 'Sem dados disponíveis';

    console.log(`Gerando relatório para ${dailies.length} conta(s)`, dailies);

    if (dailies.length === 1) {
      // Caso simples: uma conta apenas
      const daily = dailies[0];
      
      // Usar dados mais recentes do state se disponíveis, senão usar do documento
      const pipeRunData = state.pipeRunData && state.pipeRunData.totalAtendimentos > 0 
        ? state.pipeRunData 
        : (daily.pipeRunData || state.pipeRunData);

      console.log('Gerando relatório para conta única com pipeRunData:', pipeRunData);

      return buildReportText({
        titleDate: formatBRDate(date),
        startTime: daily.startTime || state.startTime,
        endTime: daily.endTime || state.endTime,
        products: daily.products || state.products,
        pipeRunData: pipeRunData
      });
    } else {
      // Caso múltiplas contas: somar os valores
      console.log('Somando dados de múltiplas contas...');
      
      // Somar apenas produtos de todas as contas
      const productTotals = new Map();
      let startTime = null, endTime = null;
      
      // IMPORTANTE: PipeRun é único por dia, não soma entre contas!
      // Usar dados do PipeRun da primeira conta que tiver ou do state atual
      let pipeRunData = state.pipeRunData || {
        totalAtendimentos: 0,
        qualificados: 0,
        perdidos: 0,
        tentativasContato: 0,
        duplicados: 0,
        cardsMql: 0,
        motivoPerda: '- Produto que não trabalhamos'
      };

      dailies.forEach(daily => {
        // Coletar horários (usar o primeiro encontrado)
        if (!startTime) startTime = daily.startTime;
        if (!endTime) endTime = daily.endTime;
        
        // Somar apenas produtos (não PipeRun!)
        if (daily.products && Array.isArray(daily.products)) {
          daily.products.forEach(product => {
            const current = productTotals.get(product.name) || 0;
            productTotals.set(product.name, current + (product.value || 0));
          });
        }
        
        // Se ainda não temos dados do PipeRun, usar da primeira conta que tiver
        if ((!pipeRunData || pipeRunData.totalAtendimentos === 0) && daily.pipeRunData && daily.pipeRunData.totalAtendimentos > 0) {
          pipeRunData = daily.pipeRunData;
          console.log('Usando dados do PipeRun da conta:', daily.account?.id);
        }
      });

  // Converter produtos totais de volta para array e ordenar por estrutura global
  const entries = Array.from(productTotals.entries());
  const order = new Map((state.productStructure||[]).map((p,i)=>[p.name,i]));
  entries.sort((a,b)=> (order.get(a[0])??999) - (order.get(b[0])??999));
  const productsArray = entries.map(([name, value]) => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name, value }));

      console.log('Produtos somados:', productsArray);
      console.log('PipeRun único (não somado):', pipeRunData);

      return buildReportText({
        titleDate: formatBRDate(date),
        startTime: startTime || state.startTime,
        endTime: endTime || state.endTime,
        products: productsArray,
        pipeRunData: pipeRunData
      });
    }
  }

  function updateWhatsAppLink(text) {
    const encoded = encodeURIComponent(text);
    whatsappFinalLink.href = `https://wa.me/?text=${encoded}`;
  }

  // Função para limpar filtros do histórico
  function clearHistoryFilters() {
    document.getElementById('hist-start').value = '';
    document.getElementById('hist-end').value = '';
    document.getElementById('hist-sum-period').checked = false;
    
    // Limpar resultados
    const historyResults = document.getElementById('history-results');
    historyResults.innerHTML = `
      <div class="text-center py-4 text-muted">
        <i class="bi bi-search fs-1 d-block mb-2"></i>
        <p>Use os filtros acima para buscar relatórios históricos</p>
      </div>
    `;
  }

  // Tornar a função global
  window.clearHistoryFilters = clearHistoryFilters;

  // Função global para copiar texto
  async function copyToClipboard(button, text) {
    try {
      await navigator.clipboard.writeText(text);
      const originalText = button.innerHTML;
      button.innerHTML = '<i class="bi bi-check me-1"></i>Copiado!';
      button.disabled = true;
      showSuccess('Texto copiado para a área de transferência!', 2000);
      setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
      }, 2000);
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
      showError('Erro ao copiar texto. Tente selecionar o texto manualmente.');
    }
  }

  // Tornar a função global
  window.copyToClipboard = copyToClipboard;

  // Função para salvar relatório gerado no Firebase
  async function saveGeneratedReport(date, accountId, reportText, reportData) {
    try {
      const reportDoc = {
        accountId: accountId,
        date: date,
        reportText: reportText,
        generatedAt: new Date().toISOString(),
        reportData: {
          startTime: reportData.startTime,
          endTime: reportData.endTime,
          products: reportData.products,
          pipeRunData: reportData.pipeRunData,
          isMultiAccount: reportData.isMultiAccount || false,
          accountsCount: reportData.accountsCount || 1,
          accountIds: reportData.accountIds || [accountId]
        }
      };

      // Salvar na coleção reports usando apenas a data como documento
      // Isso permite 1 relatório por data que pode ser sobrescrito
      await firebase.firestore()
        .collection('reports')
        .doc(date)
        .set(reportDoc);
        
      if (reportData.isMultiAccount) {
        console.log(`Relatório multi-conta salvo no Firebase para data ${date} (${reportData.accountsCount} contas)`);
      } else {
        console.log(`Relatório salvo no Firebase para data ${date} (conta: ${accountId})`);
      }
    } catch (error) {
      console.error('Erro ao salvar relatório:', error);
      throw error; // Re-throw para que o código chamador possa tratar
    }
  }

  function formatDateBR(isoDate) {
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }

  async function afterLogin(){
    console.log('After login called with account:', state.account);
    localStorage.setItem('rpv_account_id', state.account.id);
    show('app');
    
    // Atualizar dia da semana
    if (currentDayEl) {
      const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const today = new Date();
      currentDayEl.textContent = weekdays[today.getDay()];
      
      // Destacar se for fim de semana
      if (today.getDay() === 0 || today.getDay() === 6) {
        currentDayEl.classList.add('weekend');
      } else {
        currentDayEl.classList.remove('weekend');
      }
    }
    
  // garantir estrutura global e assinar alterações
  await ensureGlobalStructure();
  subscribeGlobalStructure();
  await loadOrInitDaily();
    console.log('Login complete, app should be visible');
  }

  historyBtn.addEventListener('click', async ()=>{
    histStart.value = state.date;
    histEnd.value = state.date;
    historyResults.innerHTML = `
      <div class="text-center py-4 text-muted">
        <i class="bi bi-search fs-1 d-block mb-2"></i>
        <p>Use os filtros acima para buscar relatórios históricos</p>
      </div>
    `;
    historyModal.show();
  });

  runHistoryBtn.addEventListener('click', async (e)=>{
    e.preventDefault();
    const start = histStart.value;
    const end = histEnd.value;
    if(!start || !end){ showWarning('Informe início e fim.'); return; }
    if(start > end){ showWarning('A data inicial é maior que a final.'); return; }

    setButtonLoading(runHistoryBtn, true);
    historyResults.innerHTML = '<div class="text-center"><div class="loading-spinner"></div> Buscando relatórios salvos...</div>';

    try {
      // Buscar relatórios salvos na coleção reports
      const dates = enumerateDates(start, end);
      const savedReports = [];
      
      for(const d of dates){
        try {
          // Buscar relatório salvo desta data
          const reportDoc = await firebase.firestore()
            .collection('reports')
            .doc(d)
            .get();
          
          if (reportDoc.exists) {
            const reportData = reportDoc.data();
            savedReports.push({
              date: d,
              accountId: reportData.accountId,
              reportText: reportData.reportText,
              generatedAt: reportData.generatedAt,
              reportData: reportData.reportData
            });
          }
        } catch (error) {
          console.log(`Sem relatório salvo para ${d}`);
        }
      }

      historyResults.innerHTML = '';
      if(savedReports.length === 0){
        historyResults.innerHTML = '<p class="text-muted">Nenhum relatório salvo encontrado no período selecionado.</p>';
        return;
      }

      // Mostrar relatórios individuais
      savedReports.sort((a,b)=> a.date.localeCompare(b.date));
      savedReports.forEach((report) => {
        const card = document.createElement('div');
        card.className = 'history-report-card';
        
        // Determinar o tipo de relatório
        const isMultiAccount = report.reportData?.isMultiAccount || false;
        const accountsCount = report.reportData?.accountsCount || 1;
        const accountInfo = isMultiAccount 
          ? `${accountsCount} contas somadas` 
          : `Conta: ${report.accountId}`;
        
        card.innerHTML = `
          <div class="history-report-header">
            <h6 class="history-report-title">
              <i class="bi bi-calendar-day me-2"></i>Relatório do dia ${formatBRDate(report.date)}
              ${isMultiAccount ? '<span class="badge bg-info ms-2">Multi-conta</span>' : ''}
            </h6>
            <small class="text-muted">${accountInfo} • Gerado em: ${new Date(report.generatedAt).toLocaleString('pt-BR')}</small>
          </div>
          <div class="history-report-body">
            <textarea class="form-control history-report-textarea" rows="10" readonly>${report.reportText}</textarea>
            <div class="history-report-actions">
              <button class="history-btn-copy" onclick="copyToClipboard(this, \`${report.reportText.replace(/`/g, '\\`')}\`)">
                <i class="bi bi-clipboard me-1"></i>Copiar
              </button>
              <a href="https://wa.me/?text=${encodeURIComponent(report.reportText)}" target="_blank" rel="noopener" class="history-btn-whatsapp">
                <i class="bi bi-whatsapp me-1"></i>WhatsApp
              </a>
            </div>
          </div>
        `;
        historyResults.appendChild(card);
      });
      
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      historyResults.innerHTML = '<p class="text-danger">Erro ao buscar relatórios. Tente novamente.</p>';
    } finally {
      setButtonLoading(runHistoryBtn, false);
    }
  });

  function enumerateDates(startISO, endISO){
    const out = [];
    const start = new Date(startISO+'T00:00:00');
    const end = new Date(endISO+'T00:00:00');
    for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
      const z = new Date(d); z.setMinutes(z.getMinutes()-z.getTimezoneOffset());
      out.push(z.toISOString().slice(0,10));
    }
    return out;
  }

  async function loadOrInitDaily(){
    // set date default to today
    if(!state.date) state.date = todayISO();
    
    // Aplicar horários automáticos baseado no dia da semana se não tiver dados salvos
    const workingHours = getWorkingHours(state.date);
    state.startTime = workingHours.start;
    state.endTime = workingHours.end;
    
    render();
    // attempt load
  const doc = await loadDaily(state.date, state.account.id);
    if(doc){
      // Manter horários salvos se existirem, senão usar automáticos
      state.startTime = doc.startTime || workingHours.start;
      state.endTime = doc.endTime || workingHours.end;
  const loadedProducts = (doc.products && Array.isArray(doc.products) && doc.products.length) ? sanitizeProducts(doc.products) : state.products;
  // alinhar aos produtos da estrutura global preservando valores
  const struct = state.productStructure.length ? state.productStructure : await ensureGlobalStructure();
  state.products = mergeStructureWithDaily(struct, loadedProducts);
      state.pipeRunData = doc.pipeRunData || state.pipeRunData;
      state.pipeRunConfig = { ...state.pipeRunConfig, ...doc.pipeRunConfig };
    }else{
      // create initial doc
  const struct = state.productStructure.length ? state.productStructure : await ensureGlobalStructure();
  state.products = mergeStructureWithDaily(struct, state.products);
  await saveDaily();
    }
    render();
  }

  function sanitizeProducts(products){
    return products.map(p=>({
      id: p.id || uid(),
      name: String(p.name||'Produto'),
      value: Number(p.value)||0
    }));
  }

  // ---- Init ----
  window.addEventListener('DOMContentLoaded', async ()=>{
    console.log('DOM loaded, starting app...');
    
    // Aplicar horários automáticos baseado na data atual
    const workingHours = getWorkingHours(todayISO());
    state.startTime = workingHours.start;
    state.endTime = workingHours.end;
    
    // Inputs defaults
    state.date = todayISO();
    dateInput.value = state.date;
    startTimeInput.value = state.startTime;
    endTimeInput.value = state.endTime;

    // Garantir que modais fechem corretamente
    document.addEventListener('hidden.bs.modal', function (e) {
      // Remove any leftover backdrops
      const backdrops = document.querySelectorAll('.modal-backdrop');
      backdrops.forEach(backdrop => backdrop.remove());
      
      // Ensure body classes are reset
      document.body.classList.remove('modal-open');
      document.body.style.paddingRight = '';
      document.body.style.overflow = '';
    });

    console.log('Checking for saved account...');
    // auto-login by localStorage
    const savedId = localStorage.getItem('rpv_account_id');
    if(savedId){
      console.log('Found saved ID:', savedId);
      try {
        const acc = await getAccount(savedId);
        if(acc){ 
          console.log('Account found, logging in...');
          state.account = acc; 
          await afterLogin(); 
          return; 
        }
      } catch(err) {
        console.error('Error getting saved account:', err);
      }
    }
    console.log('Showing login screen...');
    show('login');
  });

  // ---- Funções de Cadastro ----
  function toggleSignup() {
    const collapse = document.getElementById('signupCollapse');
    const icon = document.querySelector('.signup-icon');
    const isExpanded = collapse.classList.contains('show');
    
    if (isExpanded) {
      collapse.classList.remove('show');
      icon.classList.remove('bi-chevron-up');
      icon.classList.add('bi-chevron-down');
    } else {
      collapse.classList.add('show');
      icon.classList.remove('bi-chevron-down');
      icon.classList.add('bi-chevron-up');
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    console.log('🔄 Iniciando processo de cadastro...');
    
    const nameInput = document.getElementById('signup-name');
    const idInput = document.getElementById('signup-id');
    
    const name = nameInput.value.trim();
    const id = idInput.value.trim();
    
    console.log('📝 Dados do cadastro:', { name, id });
    
    if (!name || !id) {
      showWarning('Por favor, preencha todos os campos');
      return;
    }
    
    // Validar formato do ID
    if (!/^[A-Z0-9]+$/i.test(id)) {
      showWarning('ID deve conter apenas letras e números');
      return;
    }
    
    try {
      console.log('🔍 Verificando se ID já existe...');
      // Verificar se o ID já existe
      const existingAccount = await getAccount(id);
      console.log('📄 Conta existente:', existingAccount);
      
      if (existingAccount) {
        showWarning('Este ID já está em uso. Escolha outro.');
        return;
      }
      
      console.log('💾 Criando nova conta...');
      // Criar nova conta
      await ensureAccount(id, name);
      console.log('✅ Conta criada com sucesso!');
      showSuccess('Conta criada com sucesso! Você pode fazer login agora.');
      
      // Limpar formulário
      nameInput.value = '';
      idInput.value = '';
      
      // Preencher o campo de login com o ID criado
      document.getElementById('login-id').value = id;
      
      // Fechar o accordion
      toggleSignup();
      
    } catch (error) {
      console.error('❌ Erro ao criar conta:', error);
      showError('Erro ao criar conta. Tente novamente.');
    }
  }

  // Tornar as funções globais para serem chamadas do HTML
  window.toggleSignup = toggleSignup;
  window.handleSignup = handleSignup;
})();
