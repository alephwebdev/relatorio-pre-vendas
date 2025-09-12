(function(){
  // URL do mini hospedado
  const MINI_URL = 'https://relatorio.fastsistemasconstrutivos.com.br/mini/index.html';

  if (window.__rpvMiniInjected) return;
  window.__rpvMiniInjected = true;

  const style = document.createElement('style');
  style.textContent = `
  #rpv-mini-fab { position: fixed; top: 10px; right: 10px; z-index: 2147483647; pointer-events: none; }
    #rpv-mini-card { width: 360px; background: #ffffff; border-radius: 0; box-shadow: none; overflow: hidden; pointer-events: auto; border: 1px solid rgba(0,0,0,.2); }
    #rpv-mini-iframe { width: 100%; border: 0; display: block; height: 460px; }
    #rpv-mini-drag { cursor: move; background: #f5f5f5; border-bottom: 1px solid rgba(0,0,0,.2); height: 8px; }
  `;
  document.documentElement.appendChild(style);

  const root = document.createElement('div');
  root.id = 'rpv-mini-fab';
  const card = document.createElement('div');
  card.id = 'rpv-mini-card';
  // pequeno handle para arrastar
  const drag = document.createElement('div');
  drag.id = 'rpv-mini-drag';
  const iframe = document.createElement('iframe');
  iframe.id = 'rpv-mini-iframe';
  iframe.src = MINI_URL;

  card.appendChild(drag);
  card.appendChild(iframe);
  root.appendChild(card);
  document.documentElement.appendChild(root);

  // auto-resize via postMessage
  window.addEventListener('message', (e) => {
    try {
      const data = e.data || {};
      if (data && data.type === 'rpv-mini-resize' && typeof data.height === 'number') {
        // Ajuste a altura exatamente ao conteúdo, mas nunca maior que o viewport menos margens
        const maxViewport = Math.max(120, (window.innerHeight || 800) - 24);
        const h = Math.max(80, Math.min(maxViewport, data.height));
        iframe.style.height = h + 'px';
      }
    } catch (_) {}
  }, false);

  // Drag logic
  (function enableDrag(){
    let startX = 0, startY = 0, startTop = 0, startRight = 0;
    function onDown(ev){
      ev.preventDefault();
      const rect = root.getBoundingClientRect();
      startX = ev.clientX;
      startY = ev.clientY;
      // armazenar distâncias relativas à viewport
      startTop = rect.top;
      startRight = window.innerWidth - rect.right;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
    function onMove(ev){
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const newTop = Math.max(4, startTop + dy);
      const newRight = Math.max(4, startRight - dx);
      root.style.top = newTop + 'px';
      root.style.right = newRight + 'px';
    }
    function onUp(){
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    drag.addEventListener('mousedown', onDown);
  })();
})();
