/* ============================================================
   DEV: Agentation visual feedback toolbar
   Click elements on the page, leave notes, send them to Claude Code.

   To ENABLE:  open browser console → localStorage.setItem('bn_agentation','true'); location.reload()
               ...or just add ?agentation to the URL
   To DISABLE: localStorage.removeItem('bn_agentation'); location.reload()

   Requires the annotation server:  npx agentation-mcp server --port 4747

   NOTE: `agentation` ships only as a React component (peer deps react/react-dom
   >=18) with no UMD/IIFE build. This site has no build step, so React, ReactDOM
   and the component are pulled from esm.sh at runtime. That is acceptable
   *because this is dev-only* and never loads for visitors — do not let this
   become a reason to take a React dependency in the real page.

   The ?deps= pin matters: without it esm.sh can resolve agentation's peer range
   to a second React copy, and the component silently fails to mount.

   Remove the <script> tag from the page before going live, same as editor.js.
   ============================================================ */

const ENABLED =
  localStorage.getItem('bn_agentation') === 'true' ||
  new URLSearchParams(location.search).has('agentation');

if (ENABLED) {
  const REACT = '18.3.1';
  const AGENTATION = '3.0.2';
  const DEPS = `react@${REACT},react-dom@${REACT}`;

  Promise.all([
    import(`https://esm.sh/react@${REACT}`),
    import(`https://esm.sh/react-dom@${REACT}/client`),
    import(`https://esm.sh/agentation@${AGENTATION}?deps=${DEPS}`),
  ])
    .then(([React, ReactDOMClient, { Agentation }]) => {
      const host = document.createElement('div');
      host.id = 'agentation-root';
      document.body.appendChild(host);

      ReactDOMClient.createRoot(host).render(
        React.createElement(Agentation, {
          // Agent Sync: hands annotations to the MCP server, which exposes
          // them to Claude Code. Without this the toolbar only copies markdown.
          endpoint: 'http://localhost:4747',
          onSessionCreated: (id) => console.log('[agentation] session', id),
        })
      );

      console.log('[agentation] toolbar mounted — bottom-right corner');
    })
    .catch((err) => {
      console.error(
        '[agentation] failed to load. Is the server running?\n' +
          '  npx agentation-mcp server --port 4747',
        err
      );
    });
}
