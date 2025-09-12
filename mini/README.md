Mini overlay + Chrome extension

Conteúdo:
- mini/index.html: versão compacta do app para rodar embutida em um iframe.
- mini/extension: extensão do Chrome que injeta um painel flutuante com um iframe carregando mini/index.html a partir do seu site.

Como usar a extensão:
1) Ajuste no arquivo extension/panel.js a URL base do seu site público (onde mini/index.html estará hospedado). Ex.: https://relatorio.fastsistemasconstrutivos.com.br/mini/index.html
2) No Chrome, abra chrome://extensions, habilite Modo do desenvolvedor, clique em "Carregar sem compactação" e selecione a pasta mini/extension.
3) Acesse qualquer página: o painel aparecerá fixo no topo, você pode recolher/expandir.

Observações:
- A mini usa os mesmos arquivos main.js, styles.css, firebase-config.js e n8n-config.js do projeto raiz para manter o mesmo visual e comportamento.
- Se quiser isolar estilos, adicione CSS extra em mini/index.html ou dentro do iframe.
