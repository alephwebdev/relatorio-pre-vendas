(function(){
  // ---- Minimal state management ----
  const state = {
    account: null, // { id, name }
    date: todayISO(),
    startTime: '08:00',
    endTime: '18:00',
    groups: [
      // Default groups and items (can be edited/removed)
      {
        id: uid(),
        name: 'Geral',
        items: [
          { id: uid(), name: 'Total de Atendimentos', value: 0 },
          { id: uid(), name: 'Qualificados', value: 0 },
          { id: uid(), name: 'Leads em tentativas de contato', value: 0 },
          { id: uid(), name: 'Perdidos', value: 0 },
          { id: uid(), name: 'Duplicado', value: 0 },
          { id: uid(), name: 'CARDS NO MQL', value: 0 }
        ]
      },
      {
        id: uid(),
        name: 'Produtos / Interesses',
        items: [
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
        ]
      }
    ],
    lossReasons: [
      '- Produto que não Trabalhamos',
      '- Cliente longe da loja mais próxima',
      '- Cliente informou não ter mais interesse',
      '- Sem informações para contato'
    ],
    accountsCache: [] // fetched list for report selection
  };

  // ---- Firebase Init ----
  const cfg = window.FIREBASE_CONFIG || {};
  let app, db;
  try{
    if(!window.firebase) throw new Error('SDK do Firebase não carregou. Verifique sua conexão.');
    if(!cfg || !cfg.projectId) throw new Error('Configuração do Firebase ausente. Crie firebase-config.js baseado em firebase-config.sample.js');
    app = firebase.initializeApp(cfg);
    db = firebase.firestore();
  }catch(err){
    console.error(err);
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
  const dateInput = qs('#date');
  const startTimeInput = qs('#start-time');
  const endTimeInput = qs('#end-time');
  const addGroupBtn = qs('#add-group-btn');
  const generateReportBtn = qs('#generate-report-btn');
  const historyBtn = qs('#history-btn');
  const saveIndicator = qs('#save-indicator');
  const groupsWrapper = qs('#groups-wrapper');
  const groupsColLeft = qs('#groups-col-left');
  const groupsColRight = qs('#groups-col-right');
  const lossReasonsTextarea = qs('#loss-reasons');
  const reportOutput = qs('#report-output');
  const copyReportBtn = qs('#copy-report-btn');
  const whatsappLink = qs('#whatsapp-link');
  const logoutBtn = qs('#logout-btn');

  const reportModal = qs('#report-modal');
  const reportDate = qs('#report-date');
  const sumSelected = qs('#sum-selected');
  const accountsList = qs('#accounts-list');
  const runReportBtn = qs('#run-report-btn');

  const historyModal = qs('#history-modal');
  const histStart = qs('#hist-start');
  const histEnd = qs('#hist-end');
  const histSumPeriod = qs('#hist-sum-period');
  const accountsListHistory = qs('#accounts-list-history');
  const runHistoryBtn = qs('#run-history-btn');
  const historyResults = qs('#history-results');

  const structureBtn = qs('#structure-btn');
  const structureModal = qs('#structure-modal');
  const structureEditor = qs('#structure-editor');
  const addGroupStructBtn = qs('#add-group-struct');
  const saveStructureBtn = qs('#save-structure-btn');

  const finalReportModal = qs('#final-report-modal');
  const finalReportText = qs('#final-report-text');
  const copyFinalReportBtn = qs('#copy-final-report-btn');
  const whatsappFinalLink = qs('#whatsapp-final-link');

  // ---- Helpers ----
  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }
  function uid(){ return Math.random().toString(36).slice(2,9); }
  function todayISO(){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
  function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }

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
    lossReasonsTextarea.value = state.lossReasons.join('\n');

    groupsColLeft.innerHTML = '';
    groupsColRight.innerHTML = '';
    // Try to place 'Geral' on left and 'Produtos / Interesses' on right
    const leftFirst = state.groups.find(g => g.name.toLowerCase().includes('geral'));
    const rightFirst = state.groups.find(g => g.name.toLowerCase().includes('produtos') || g.name.toLowerCase().includes('interesse'));
    const placed = new Set();
    if(leftFirst){ groupsColLeft.appendChild(renderGroup(leftFirst)); placed.add(leftFirst.id); }
    if(rightFirst && rightFirst.id !== leftFirst?.id){ groupsColRight.appendChild(renderGroup(rightFirst)); placed.add(rightFirst.id); }
    // Add remaining, balancing by count
    state.groups.forEach(g => {
      if(placed.has(g.id)) return;
      const leftCount = groupsColLeft.childElementCount;
      const rightCount = groupsColRight.childElementCount;
      (leftCount <= rightCount ? groupsColLeft : groupsColRight).appendChild(renderGroup(g));
    });

    accountNameEl.textContent = state.account?.name || '';
    accountIdEl.textContent = state.account ? `(#${state.account.id})` : '';
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
    });
    qs('.decr', row).addEventListener('click', (e)=>{
      e.preventDefault();
      const next = Math.max(0, Number(valueInput.value||0) - 1);
      item.value = next; valueInput.value = String(next);
      saveDailyDebounced(); updateReportPreviewCurrent();
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
      groups: state.groups,
      lossReasons: state.lossReasons,
      updatedAt: Date.now()
    };
    await dailyDoc(state.date, state.account.id).set(payload, { merge: true });
    setSaving(false);
  }

  const saveDailyDebounced = debounce(saveDaily, 500);

  async function listAccounts(){
    const snap = await colAccounts().get();
    state.accountsCache = snap.docs.map(d=>d.data());
  }

  // ---- Report Generation ----
  function buildReportText({ titleDate, startTime, endTime, totals, lines, lossReasons, totalSteel }){
    const parts = [];
    parts.push(`Entrada de Lead do Dia ${titleDate} de ${timeHuman(startTime)} às ${timeHuman(endTime)}.`);
    parts.push('');
    if(typeof totals['Total de Atendimentos'] === 'number'){
      parts.push(`Total de Atendimentos: ${totals['Total de Atendimentos']}`);
      parts.push('');
    }
    if(typeof totals['MEGA SALDÃO DE FORROS'] === 'number'){
      parts.push(`MEGA SALDÃO DE FORROS: ${valueOrDash(totals['MEGA SALDÃO DE FORROS'])}`);
      parts.push('');
    }
    if(typeof totals['Qualificados'] === 'number'){
      parts.push(`Qualificados: ${totals['Qualificados']}`);
      parts.push('');
    }

    // Product lines
    lines.forEach(l=>parts.push(l));
    parts.push('');

    if(typeof totalSteel === 'number'){
      parts.push(`TOTAL STEEL FRAME PRODUTOS: ${totalSteel}`);
      parts.push('');
    }

    if(typeof totals['Leads em tentativas de contato'] === 'number'){
      parts.push(`Leads em tentativas de contato: ${totals['Leads em tentativas de contato']}`);
      parts.push('');
    }

    if(typeof totals['CARDS NO MQL'] === 'number'){
      parts.push('');
      parts.push(`CARDS NO MQL: ${valueOrDash(totals['CARDS NO MQL'])}`);
      parts.push('');
    }

    if(typeof totals['Perdidos'] === 'number'){
      parts.push('');
      parts.push(`Perdidos: ${totals['Perdidos']}`);
      parts.push('');
    }

    if(typeof totals['Duplicado'] === 'number'){
      parts.push(`Duplicado: ${valueOrDash(totals['Duplicado'])}`);
      parts.push('');
    }

    if(lossReasons && lossReasons.length){
      lossReasons.forEach(r=>parts.push(r));
    }

    return parts.join('\n');
  }

  function collectTotals(dailies){
    // Accumulate values by item name across groups
    const totalsMap = new Map();
    let startTime = null, endTime = null; // Use from current user selection if mixed

    dailies.forEach(d => {
      startTime = startTime || d.startTime;
      endTime = endTime || d.endTime;
      (d.groups||[]).forEach(g => (g.items||[]).forEach(it => {
        const k = it.name.trim();
        totalsMap.set(k, (totalsMap.get(k)||0) + (Number(it.value)||0));
      }));
    });

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
    const preferredOrder = [
      'Placas Drywall','Perfis Drywall','Glasroc X','Painel wall','Placa Cimentícia','Perfis de Steel Frame','Steel Frame Obras','Quartzolit','Acústica','Piso Vinílico'
    ];
    const ordered = [];
    preferredOrder.forEach(k=>{
      const v = totals.hasOwnProperty(k) ? totals[k] : 0;
      ordered.push(`${k}: ${v || '-'}`);
    });
    // Add remaining not in preferred
    lines.sort();
    const rest = lines.filter(l => !preferredOrder.some(pk => l.startsWith(pk+':')));

    const finalLines = ordered.concat(rest);

    return { totals, lines: finalLines, totalSteel, startTime: startTime||state.startTime, endTime: endTime||state.endTime };
  }

  function updateReportPreview(fromDailies, dateISO){
    const { totals, lines, totalSteel, startTime, endTime } = collectTotals(fromDailies);
    const text = buildReportText({
      titleDate: formatBRDate(dateISO || state.date),
      startTime,
      endTime,
      totals,
      lines,
      lossReasons: state.lossReasons,
      totalSteel
    });
    reportOutput.value = text;
    whatsappLink.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

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
    const doc = {
      startTime: state.startTime,
      endTime: state.endTime,
      groups: state.groups
    };
    updateReportPreview([doc]);
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
    await loadOrInitDaily();
  });
  startTimeInput.addEventListener('change', ()=>{ state.startTime = startTimeInput.value; saveDailyDebounced(); updateReportPreviewCurrent(); });
  endTimeInput.addEventListener('change', ()=>{ state.endTime = endTimeInput.value; saveDailyDebounced(); updateReportPreviewCurrent(); });

  addGroupBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    state.groups.push({ id: uid(), name: 'Novo Grupo', items: [] });
    render();
    saveDailyDebounced();
    updateReportPreviewCurrent();
  });

  // Structure editor
  structureBtn.addEventListener('click', ()=>{
    renderStructureEditor();
    // Bootstrap modal
    new bootstrap.Modal(structureModal).show();
  });

  addGroupStructBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    state.groups.push({ id: uid(), name: 'Novo Grupo', items: [] });
    renderStructureEditor();
  });

  saveStructureBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    // collect from editor DOM
    const groups = [];
    qsa('.struct-group', structureEditor).forEach(gEl=>{
      const gid = gEl.dataset.id;
      const gname = qs('.sg-name', gEl).value || 'Grupo';
      const items = [];
      qsa('.sg-item', gEl).forEach(iEl=>{
        const iid = iEl.dataset.id;
        const iname = qs('.si-name', iEl).value || 'Item';
        items.push({ id: iid, name: iname, value: 0 });
      });
      groups.push({ id: gid, name: gname, items });
    });
    state.groups = groups;
    render();
    updateReportPreviewCurrent();
    saveDailyDebounced();
    // Close Bootstrap modal
    bootstrap.Modal.getInstance(structureModal).hide();
  });

  function renderStructureEditor(){
    structureEditor.innerHTML = '';
    state.groups.forEach(g=>{
      const gCard = document.createElement('div');
      gCard.className = 'card struct-group';
      gCard.dataset.id = g.id;
      gCard.innerHTML = `
        <div class="grid grid-2">
          <div>
            <label>Nome do Grupo</label>
            <input class="sg-name" value="${escapeHtml(g.name)}" />
          </div>
          <div style="display:flex;align-items:flex-end;gap:8px;justify-content:flex-end">
            <button class="secondary sg-add-item">+ Item</button>
            <button class="ghost sg-remove">Excluir Grupo</button>
          </div>
        </div>
        <div class="sg-items"></div>
      `;
      const itemsEl = qs('.sg-items', gCard);
      g.items.forEach(it=> itemsEl.appendChild(renderStructItem(it)));
      qs('.sg-add-item', gCard).addEventListener('click', (e)=>{
        e.preventDefault();
        const it = { id: uid(), name: 'Novo Item' };
        g.items.push({ ...it, value: 0 });
        itemsEl.appendChild(renderStructItem(it));
      });
      qs('.sg-remove', gCard).addEventListener('click', (e)=>{
        e.preventDefault();
        state.groups = state.groups.filter(x=>x.id!==g.id);
        renderStructureEditor();
      });
      structureEditor.appendChild(gCard);
    });
  }

  function renderStructItem(it){
    const row = document.createElement('div');
    row.className = 'sg-item';
    row.dataset.id = it.id;
    row.innerHTML = `
      <div class="item" style="grid-template-columns:1fr auto;gap:6px">
        <input class="si-name" value="${escapeHtml(it.name)}" />
        <button class="ghost si-remove">Remover</button>
      </div>
    `;
    qs('.si-remove', row).addEventListener('click', (e)=>{
      e.preventDefault(); row.remove();
    });
    return row;
  }

  lossReasonsTextarea.addEventListener('input', ()=>{
    state.lossReasons = lossReasonsTextarea.value.split(/\r?\n/).filter(Boolean);
    saveDailyDebounced();
  });

  copyReportBtn.addEventListener('click', async ()=>{
    await navigator.clipboard.writeText(reportOutput.value);
    copyReportBtn.textContent = 'Copiado';
    setTimeout(()=>copyReportBtn.textContent='Copiar',1200);
  });

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
    // Bootstrap modal
    new bootstrap.Modal(reportModal).show();
  });

  runReportBtn.addEventListener('click', async (e)=>{
    e.preventDefault();
    setButtonLoading(runReportBtn, true);
    
    try {
      const date = reportDate.value || state.date;
      const ids = qsa('input[type="checkbox"]', accountsList).filter(c=>c.checked).map(c=>c.value);
      const sum = sumSelected.checked;

      const dailies = [];
      if(sum){
        for(const id of ids){
          const d = await dailyDoc(date, id).get();
          if(d.exists) dailies.push(d.data());
        }
      }else{
        // if not summing, allow a single selected account; fallback to current account
        let targetId = state.account.id;
        if(ids.length === 1){
          targetId = ids[0];
        }else if(ids.length > 1){
          alert('Selecione apenas 1 conta ou ative a soma de contas.');
          return;
        }
        const d = await dailyDoc(date, targetId).get();
        if(d.exists) dailies.push(d.data());
      }

      if(!dailies.length){
        alert('Sem dados para a seleção.');
        return;
      }

      // Generate report text
      const reportText = generateReportText(dailies, date);
      
      // Close report modal and show final modal
      bootstrap.Modal.getInstance(reportModal).hide();
      
      // Show final report modal
      finalReportText.value = reportText;
      updateWhatsAppLink(reportText);
      new bootstrap.Modal(finalReportModal).show();
      
    } finally {
      setButtonLoading(runReportBtn, false);
    }
  });

  function generateReportText(dailies, date) {
    const totals = {};
    for(const daily of dailies){
      for(const group of daily.groups || []){
        for(const item of group.items || []){
          totals[item.name] = (totals[item.name] || 0) + (item.value || 0);
        }
      }
    }

    const dt = date || state.date;
    const parts = [
      `*RELATÓRIO PRÉ-VENDAS - ${formatDateBR(dt)}*`,
      `*Período:* ${dailies[0]?.startTime || '08:00'} às ${dailies[0]?.endTime || '18:00'}h`,
      ''
    ];

    // Geral section
    const geralItems = ['Total de Atendimentos','Qualificados','Leads em tentativas de contato','Perdidos','Duplicado'];
    geralItems.forEach(itemName => {
      if(typeof totals[itemName] === 'number'){
        parts.push(`*${itemName}:* ${valueOrDash(totals[itemName])}`);
      }
    });

    if(typeof totals['CARDS NO MQL'] === 'number'){
      parts.push('');
      parts.push(`*CARDS NO MQL:* ${valueOrDash(totals['CARDS NO MQL'])}`);
    }

    parts.push('');
    parts.push('*PRODUTOS/INTERESSES:*');

    // Products section with specific order
    const productItems = [
      'Placas Drywall','Perfis Drywall','Glasroc X','Painel wall','Placa Cimentícia',
      'Perfis de Steel Frame','Steel Frame Obras','Quartzolit','Acústica','Piso Vinílico',
      'MEGA SALDÃO DE FORROS','TOTAL STEEL FRAME PRODUTOS'
    ];
    
    productItems.forEach(itemName => {
      if(typeof totals[itemName] === 'number'){
        parts.push(`*${itemName}:* ${valueOrDash(totals[itemName])}`);
      }
    });

    // Add loss reasons
    parts.push('');
    parts.push('*MOTIVOS DE PERDA:*');
    const lossReasons = state.lossReasons.join('\n').split('\n').filter(r=>r.trim());
    lossReasons.forEach(reason => {
      if(reason.trim()) parts.push(reason.trim());
    });

    return parts.join('\n');
  }

  function updateWhatsAppLink(text) {
    const encoded = encodeURIComponent(text);
    whatsappFinalLink.href = `https://wa.me/?text=${encoded}`;
  }

  function formatDateBR(isoDate) {
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }

  async function afterLogin(){
    console.log('After login called with account:', state.account);
    localStorage.setItem('rpv_account_id', state.account.id);
    show('app');
    await loadOrInitDaily();
    console.log('Login complete, app should be visible');
  }

  historyBtn.addEventListener('click', async ()=>{
    histStart.value = state.date;
    histEnd.value = state.date;
    await listAccounts();
    accountsListHistory.innerHTML = '';
    state.accountsCache.forEach(acc=>{
      const id = `hacc_${acc.id}`;
      const row = document.createElement('div');
      row.className = 'check-row';
      row.innerHTML = `
        <input type="checkbox" id="${id}" value="${acc.id}" ${acc.id===state.account.id?'checked':''} />
        <label for="${id}">${acc.name} (#${acc.id})</label>
      `;
      accountsListHistory.appendChild(row);
    });
    historyResults.innerHTML = '';
    // Bootstrap modal
    new bootstrap.Modal(historyModal).show();
  });

  runHistoryBtn.addEventListener('click', async (e)=>{
    e.preventDefault();
    const start = histStart.value;
    const end = histEnd.value;
    if(!start || !end){ alert('Informe início e fim.'); return; }
    if(start > end){ alert('A data inicial é maior que a final.'); return; }

    const ids = qsa('input[type="checkbox"]', accountsListHistory).filter(c=>c.checked).map(c=>c.value);
    if(ids.length===0){ alert('Selecione pelo menos uma conta.'); return; }

    setButtonLoading(runHistoryBtn, true);
    historyResults.innerHTML = '<div class="text-center"><div class="loading-spinner"></div> Buscando relatórios...</div>';

    try {
      // Query Firestore by date range: we have /daily/{date}/entries/{id}
      // We'll iterate dates between start and end due to collection group limitation here.
      const dates = enumerateDates(start, end);
      const dayReports = [];
      for(const d of dates){
        const dailyEntries = [];
        for(const id of ids){
          const docSnap = await dailyDoc(d, id).get();
          if(docSnap.exists) dailyEntries.push(docSnap.data());
        }
        if(dailyEntries.length){
          dayReports.push({ date: d, dailies: dailyEntries });
        }
      }

      historyResults.innerHTML = '';
      if(dayReports.length===0){
        historyResults.innerHTML = '<p class="text-muted">Sem dados no período selecionado.</p>';
        return;
      }

      if(histSumPeriod.checked){
      // Sum across all days
      const all = dayReports.flatMap(r=>r.dailies);
      const { totals, lines, totalSteel, startTime, endTime } = collectTotals(all);
      const text = buildReportText({
        titleDate: `${formatBRDate(start)} a ${formatBRDate(end)}`,
        startTime, endTime, totals, lines, lossReasons: state.lossReasons, totalSteel
      });
      const ta = document.createElement('textarea');
      ta.rows = 12; ta.style.width='100%'; ta.value = text;
      const link = document.createElement('a');
      link.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
      link.target = '_blank'; link.rel = 'noopener'; link.className='primary'; link.textContent = 'Abrir no WhatsApp';
      const copyBtn = document.createElement('button'); copyBtn.textContent='Copiar'; copyBtn.className='secondary';
      copyBtn.addEventListener('click', async ()=>{ await navigator.clipboard.writeText(text); copyBtn.textContent='Copiado'; setTimeout(()=>copyBtn.textContent='Copiar',1000); });
      const actions = document.createElement('div'); actions.className='actions'; actions.append(copyBtn, link);
      historyResults.append(ta, actions);
    }else{
      // Show per day blocks
      dayReports.sort((a,b)=> a.date.localeCompare(b.date));
      dayReports.forEach(({date, dailies})=>{
        const { totals, lines, totalSteel, startTime, endTime } = collectTotals(dailies);
        const text = buildReportText({
          titleDate: formatBRDate(date),
          startTime, endTime, totals, lines, lossReasons: state.lossReasons, totalSteel
        });
        const card = document.createElement('div'); card.className='card';
        const h = document.createElement('h4'); h.textContent = `Relatório ${formatBRDate(date)}`;
        const ta = document.createElement('textarea'); ta.rows=10; ta.style.width='100%'; ta.value = text;
        const link = document.createElement('a'); link.href = `https://wa.me/?text=${encodeURIComponent(text)}`; link.target='_blank'; link.rel='noopener'; link.className='primary'; link.textContent='WhatsApp';
        const copyBtn = document.createElement('button'); copyBtn.textContent='Copiar'; copyBtn.className='secondary';
        copyBtn.addEventListener('click', async ()=>{ await navigator.clipboard.writeText(text); copyBtn.textContent='Copiado'; setTimeout(()=>copyBtn.textContent='Copiar',1000); });
        const actions = document.createElement('div'); actions.className='actions'; actions.append(copyBtn, link);
        card.append(h, ta, actions);
        historyResults.append(card);
      });
    }
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
    render();
    // attempt load
    const doc = await loadDaily(state.date, state.account.id);
    if(doc){
      state.startTime = doc.startTime || state.startTime;
      state.endTime = doc.endTime || state.endTime;
      state.groups = (doc.groups && Array.isArray(doc.groups) && doc.groups.length) ? sanitizeGroups(doc.groups) : state.groups;
      state.lossReasons = Array.isArray(doc.lossReasons) ? doc.lossReasons : state.lossReasons;
    }else{
      // create initial doc
      await saveDaily();
    }
    render();
    updateReportPreview([await dailyDoc(state.date, state.account.id).get().then(s=>s.data())]);
  }

  function sanitizeGroups(groups){
    return groups.map(g=>({
      id: g.id || uid(),
      name: String(g.name||'Grupo'),
      items: (g.items||[]).map(it=>({ id: it.id || uid(), name: String(it.name||'Item'), value: Number(it.value)||0 }))
    }));
  }

  // ---- Init ----
  window.addEventListener('DOMContentLoaded', async ()=>{
    console.log('DOM loaded, starting app...');
    // Inputs defaults
    state.date = todayISO();
    dateInput.value = state.date;

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
})();
