const DISCONNECT_TIMEOUT_MS = 1000 * 60 * 4; // 4 minutes
const PORT_NAME = 'keepAlive';

/**
 * Code which is injected into the page as content-script to keep the connection alive.
 */
const code = `
(() => {
    // used to avoid multiple connections from the same tab
    if (window.keepAlive) {
        return;
    }
    function connect() {
        browser.runtime.connect({ name: '${PORT_NAME}' })
            .onDisconnect
            .addListener(() => {
                connect();
            });
    }
    connect();
    window.keepAlive = true;
})();
`;

/**
 * Executes a script on one of the open tabs.
 *
 * @param tabs - Tabs to execute a script on or null by default.
 */
async function executeScriptOnTab(tabs) {
  tabs = tabs || (await browser.tabs.query({ url: '*://*/*' }));

  for (const tab of tabs) {
    if (tab.tabId) {
      try {
        await browser.tabs.executeScript(tab.tabId, { code });
        return;
      } catch (e) {
        if (e != 'Error: Missing host permission for the tab') {
          console.log(e);
        }
      }
    }
  }
}

/**
 * Main entry point.
 */
abu.keepAlive = () => {
  if (!abu.utils.browser.isFirefoxBrowser()) {
    return;
  }

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_NAME) {
      return;
    }

    port.onDisconnect.addListener(() => executeScriptOnTab());
  });

  abu.tabs.onUpdated.addListener((tab) => {
    if (tab.url && abu.utils.url.isHttpRequest(tab.url)) {
      executeScriptOnTab([tab]);
    }
  })

  executeScriptOnTab();
};
