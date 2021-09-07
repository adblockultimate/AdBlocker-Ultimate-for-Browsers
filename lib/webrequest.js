/**
 * This file is part of AdBlocker Ultimate Browser Extension
 *
 * AdBlocker Ultimate Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * AdBlocker Ultimate Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with AdBlocker Ultimate Browser Extension.  If not, see <http://www.gnu.org/licenses/>.
 */

(function (abu) {

    'use strict';

    var CSP_HEADER_NAME = 'Content-Security-Policy';
    
    /**
     * In the case of the tabs.insertCSS API support we're trying to collapse a blocked element from the background page.
     * In order to do it we need to have a mapping requestType<->tagNames.
     */
    const REQUEST_TYPE_COLLAPSE_TAG_NAMES = {
        [abu.RequestTypes.SUBDOCUMENT]: ['frame', 'iframe'],
        [abu.RequestTypes.IMAGE]: ['img'],
    };

    /**
     * Retrieve referrer url from request details.
     * Extract referrer by priority:
     * 1. referrerUrl in requestDetails
     * 2. url of frame where request was created
     * 3. url of main frame
     *
     * @param requestDetails
     * @returns {*|Frame}
     */
    function getReferrerUrl(requestDetails) {
        return requestDetails.referrerUrl ||
            abu.frames.getFrameUrl(requestDetails.tab, requestDetails.requestFrameId) ||
            abu.frames.getMainFrameUrl(requestDetails.tab);
    }

    /**
     * Process request
     *
     * @param requestDetails
     * @returns {boolean} False if request must be blocked
     */
    function onBeforeRequest(requestDetails) {
        const { 
            tab, 
            requestUrl, 
            requestType,
            frameId,
            requestFrameId = 0,
        } = requestDetails

        const { tabId } = tab;

        if (requestType === abu.RequestTypes.DOCUMENT || requestType === abu.RequestTypes.SUBDOCUMENT) {
            abu.frames.recordFrame(tab, frameId, requestUrl, requestType);
        }
        
        abu.desktop.checkForAbuPixel(requestUrl);

        if (requestType === abu.RequestTypes.DOCUMENT) {
            // Reset tab button state
            abu.listeners.notifyListeners(abu.listeners.UPDATE_TAB_BUTTON_STATE, tab, true);
            return;
        }

        if (!abu.utils.url.isHttpOrWsRequest(requestUrl)) {
            return;
        }

        var referrerUrl = getReferrerUrl(requestDetails);

        var requestRule = abu.webRequestService.getRuleForRequest(tab, requestUrl, referrerUrl, requestType);
        abu.webRequestService.postProcessRequest(tab, requestUrl, referrerUrl, requestType, requestRule);

        const response =  abu.webRequestService.getBlockedResponseByRule(requestRule);

        if (requestRule
            && !requestRule.whiteListRule
            && requestRule.isBlockPopups()
            && requestType === abu.RequestTypes.DOCUMENT) {
            const isNewTab = abu.tabs.isNewPopupTab(tabId);
            if (isNewTab) {
                abu.tabs.remove(tabId);
                return { cancel: true };
            }
        }

        if (response && response.documentBlockedPage) {
            // Here we do not use redirectUrl because it is not working in firefox without specifying it
            // as the web_accessible_resources.
            
            const incognitoTab = abu.frames.isIncognitoTab({ tabId });
            // Chromium browsers do not allow to show extension pages in incognito mode
            // Firefox allows, but on private pages do not work browser.runtime.getBackgroundPage()

            const url = response.documentBlockedPage;

            if (incognitoTab) {
                // Closing tab before opening a new one may lead to browser crash (Chromium)
                abu.ui.openTab(url, {}, () => {
                    abu.tabs.remove(tabId);
                });
            } else {
                abu.tabs.updateUrl(tabId, url);
            }

            return { cancel: true };
        }

        if (response && response.cancel) {
            collapseElement(tabId, requestFrameId, requestUrl, referrerUrl, requestType);
        }

        return response;
    }

    
    /**
     * Tries to collapse a blocked element using tabs.insertCSS.
     *
     * This method of collapsing has numerous advantages over the traditional one.
     * First of all, it prevents blocked elements flickering as it occurs earlier.
     * Second, it is harder to detect as there's no custom <style> node required.
     *
     * However, we're still keeping the old approach intact - we have not enough information
     * here to properly collapse elements that use relative URLs (<img src='../path_to_element'>).
     *
     * @param {number} tabId Tab id
     * @param {number} requestFrameId Id of a frame request was sent from
     * @param {string} requestUrl Request URL
     * @param {string} referrerUrl Referrer URL
     * @param {string} requestType A member of abu.RequestTypes
     */
    function collapseElement(tabId, requestFrameId, requestUrl, referrerUrl, requestType) {
        const tagNames = REQUEST_TYPE_COLLAPSE_TAG_NAMES[requestType];
        
        if (!tagNames) {
            // Collapsing is not supported for this request type
            return;
        }

        // Collapsing is not supported for the requests which happen out of the tabs, e.g. other extensions
        if (tabId === -1) {
            return;
        }

        // Strip the protocol and host name (for first-party requests) from the selector
        const thirdParty = abu.utils.url.isThirdPartyRequest(requestUrl, referrerUrl);
        let srcUrlStartIndex = requestUrl.indexOf('//');
        if (!thirdParty) {
            srcUrlStartIndex = requestUrl.indexOf('/', srcUrlStartIndex + 2);
        }
        const srcUrl = requestUrl.substring(srcUrlStartIndex);

        const collapseStyle = '{ display: none!important; visibility: hidden!important; height: 0px!important; min-height: 0px!important; }';
        let css = '';
        let iTagNames = tagNames.length;

        while (iTagNames--) {
            css += `${tagNames[iTagNames]}[src$="${srcUrl}"] ${collapseStyle}\n`;
        }

        abu.tabs.insertCssCode(tabId, requestFrameId, css);
    }

    /**
     * Called before request is sent to the remote endpoint.
     * This method is used to modify request in case of working in integration mode
     * and also to record referrer header in frame data.
     *
     * @param requestDetails Request details
     * @returns {*} headers to send
     */
    function onBeforeSendHeaders(requestDetails) {

        var tab = requestDetails.tab;
        var headers = requestDetails.requestHeaders;

        if (requestDetails.requestType === abu.RequestTypes.DOCUMENT) {
            // Save ref header
            var refHeader = abu.utils.browser.findHeaderByName(headers, 'Referer');
            if (refHeader) {
                abu.frames.recordFrameReferrerHeader(tab, refHeader.value);
            }
        }

        return {};
    }

    /**
     * On headers received callback function.
     * and check if websocket connections should be blocked.
     *
     * @param requestDetails Request details
     * @returns {{responseHeaders: *}} Headers to send
     */
    function onHeadersReceived(requestDetails) {
        var tab = requestDetails.tab;
        var requestUrl = requestDetails.requestUrl;
        var responseHeaders = requestDetails.responseHeaders;
        var requestType = requestDetails.requestType;
        var referrerUrl = getReferrerUrl(requestDetails);

        abu.webRequestService.processRequestResponse(tab, requestUrl, referrerUrl, requestType, responseHeaders);

        if (requestType === abu.RequestTypes.DOCUMENT || requestType === abu.RequestTypes.SUBDOCUMENT) {
            return modifyCSPHeader(requestDetails);
        }
    }

    /**
     * Modify CSP header to block WebSocket, prohibit data: and blob: frames and WebWorkers
     * @param requestDetails
     * @returns {{responseHeaders: *}}
     */
    function modifyCSPHeader(requestDetails) {

        // Please note, that we do not modify response headers in Edge before Creators update:
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/401
        // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8796739/
        if (abu.utils.browser.isEdgeBeforeCreatorsUpdate()) {
            return;
        }

        var tab = requestDetails.tab;
        var requestUrl = requestDetails.requestUrl;
        var responseHeaders = requestDetails.responseHeaders || [];
        var requestType = requestDetails.requestType;
        var frameUrl = abu.frames.getFrameUrl(tab, requestDetails.frameId);

        var cspHeaders = [];


        /**
         * Retrieve $CSP rules specific for the request
         * https://github.com/adguardteam/adguardbrowserextension/issues/685
         */
        var cspRules = abu.webRequestService.getCspRules(tab, requestUrl, frameUrl, requestType);
        if (cspRules) {
            for (var i = 0; i < cspRules.length; i++) {
                var rule = cspRules[i];
                // Don't forget: getCspRules returns all $csp rules, we must directly check that the rule is blocking.
                if (abu.webRequestService.isRequestBlockedByRule(rule)) {
                    cspHeaders.push({
                        name: CSP_HEADER_NAME,
                        value: rule.cspDirective
                    });
                }
            }
        }

        /**
         * Websocket connection is blocked by connect-src directive
         * https://www.w3.org/TR/CSP2/#directive-connect-src
         *
         * Web Workers is blocked by child-src directive
         * https://www.w3.org/TR/CSP2/#directive-child-src
         * https://www.w3.org/TR/CSP3/#directive-worker-src
         * We have to use child-src as fallback for worker-src, because it isn't supported
         * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/worker-src#Browser_compatibility
         *
         * We also need the frame-src restriction since CSPs are not inherited from the parent for documents with data: and blob: URLs
         * https://bugs.chromium.org/p/chromium/issues/detail?id=513860
         */
        if (cspHeaders.length > 0) {
            responseHeaders = responseHeaders.concat(cspHeaders);
            return {
                responseHeaders: responseHeaders,
                modifiedHeaders: cspHeaders
            };
        }
    }

    /**
     * Add listeners described above.
     */
    abu.webRequest.onBeforeRequest.addListener(onBeforeRequest, ["<all_urls>"]);
    abu.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, ["<all_urls>"]);
    abu.webRequest.onHeadersReceived.addListener(onHeadersReceived, ["<all_urls>"]);

    /**
     * If page uses service worker then it can do not fire main DOCUMENT request, that's why we check
     * frame data before scripts are injected
     * This listener should be added before any other listener of onCommitted event
     * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1459
     * @param details
     */
    const onCommittedCheckFrameUrl = (tabId, frameId, requestUrl, requestType) => {
        if (requestType !== abu.RequestTypes.DOCUMENT || tabId === abu.BACKGROUND_TAB_ID) {
            return;
        }

        abu.frames.checkAndRecordMainFrame(tabId, frameId, requestUrl, requestType);
    };

    abu.webNavigation.onCommitted.addListener(onCommittedCheckFrameUrl);

    var handlerBehaviorTimeout = null;
    abu.listeners.addListener(function (event) {
        switch (event) {
            case abu.listeners.ADD_RULES:
            case abu.listeners.REMOVE_RULE:
            case abu.listeners.UPDATE_FILTER_RULES:
            case abu.listeners.UPDATE_WHITELIST_FILTER_RULES:
            case abu.listeners.FILTER_ENABLE_DISABLE:
                if (handlerBehaviorTimeout !== null) {
                    clearTimeout(handlerBehaviorTimeout);
                }
                handlerBehaviorTimeout = setTimeout(function () {
                    handlerBehaviorTimeout = null;
                    abu.webRequest.handlerBehaviorChanged();
                }, 3000);
        }
    });

    /**
     * When frame is committed we send to it js rules
     * We do this because we need to apply js rules as soon as possible
     */
    (function (abu) {
        const injections = {
            /**
             * Saves css, js and ready flag in injection object
             * @param tabId
             * @param frameId
             * @param {Injection} injection
             */
            set(tabId, frameId, injection) {
                if (frameId === 0) {
                    delete this[tabId];
                }
                if (!this[tabId]) {
                    this[tabId] = {};
                }
                this[tabId][frameId] = injection;
            },

            get(tabId, frameId) {
                if (this[tabId]) {
                    return this[tabId][frameId];
                }
                return undefined;
            },

            /**
             * Removes injection corresponding to tabId and frameId
             * @param {Number} tabId
             * @param {Number} frameId
             */
            removeTabFrameInjection(tabId, frameId) {
                if (this[tabId]) {
                    delete this[tabId][frameId];
                    if (Object.keys(this[tabId]).length === 0) {
                        delete this[tabId];
                    }
                }
            },

            /**
             * Removes all injections corresponding to tabId
             * @param {Number} tabId
             */
            removeTabInjection(tabId) {
                delete this[tabId];
            },
        };
        /**
         * Taken from
         * {@link https://github.com/seanl-adg/InlineResourceLiteral/blob/master/index.js#L136}
         * {@link https://github.com/joliss/js-string-escape/blob/master/index.js}
         */
        const reJsEscape = /["'\\\n\r\u2028\u2029]/g;
        function escapeJs(match) {
            switch (match) {
                case '"':
                case "'":
                case '\\':
                    return `\\${match}`;
                case '\n':
                    return '\\n\\\n'; // Line continuation character for ease
                // of reading inlined resource.
                case '\r':
                    return '';        // Carriage returns won't have
                // any semantic meaning in JS
                case '\u2028':
                    return '\\u2028';
                case '\u2029':
                    return '\\u2029';
            }
        }

        /**
         * We use changing variable name because global properties
         * can be modified across isolated worlds of extension content page and tab page
         * https://bugs.chromium.org/p/project-zero/issues/detail?id=1225&desc=6
         */
        const variableName = `scriptExecuted${Date.now()}`;

        function buildScriptText(scriptText) {
            if (!scriptText) {
                return null;
            }
            /**
             * Executes scripts in a scope of the page.
             * In order to prevent multiple script execution checks if script was already executed
             * Sometimes in Firefox when content-filtering is applied to the page race condition happens.
             * This causes an issue when the page doesn't have its document.head or document.documentElement at the moment of
             * injection. So script waits for them. But if a quantity of frame-requests reaches FRAME_REQUESTS_LIMIT then
             * script stops waiting with the error.
             * Description of the issue: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1004
             */
            const injectedScript = `(function() {\
                if (window.${variableName}) {\
                    return;\
                }\
                var script = document.createElement("script");\
                script.setAttribute("type", "text/javascript");\
                script.textContent = "${scriptText.replace(reJsEscape, escapeJs)}";\
                var FRAME_REQUESTS_LIMIT = 500;\
                var frameRequests = 0;\
                function waitParent () {\
                    frameRequests += 1;\
                    var parent = document.head || document.documentElement;\
                    if (parent) {\
                        try {\
                            parent.appendChild(script);\
                            parent.removeChild(script);\
                        } catch (e) {\
                        } finally {\
                            window.${variableName} = true;\
                            return true;\
                        }\
                    }\
                    if(frameRequests < FRAME_REQUESTS_LIMIT) {\
                        requestAnimationFrame(waitParent);\
                    } 
                }\
                waitParent();\
            })()`;

            return injectedScript;
        }

        /**
         * @param {SelectorsData} selectorsData Selectors data
         * @returns {string} CSS to be supplied to insertCSS or null if selectors data is empty
         */
        function buildCssText(selectorsData) {
            if (!selectorsData || !selectorsData.css) {
                return null;
            }
            return selectorsData.css.join('\n');
        }

        /**
         * Checks requestType, tabId and event
         * We don't inject CSS or JS if request wasn't related to tab, or if request type
         * is not equal to DOCUMENT or SUBDOCUMENT.
         * @param {String} requestType
         * @param {Number} tabId
         * @returns {Boolean}
         */
        function shouldSkipInjection(requestType, tabId) {
            if (tabId === abu.BACKGROUND_TAB_ID) {
                return true;
            }
            if (requestType !== abu.RequestTypes.DOCUMENT && requestType !== abu.RequestTypes.SUBDOCUMENT) {
                return true;
            }
            return false;
        }

         /**
         * Prepares injection content (scripts and css) for a given frame.
         * @param {RequestDetails} details
         */
        function prepareInjection(tabId, frameId, url, requestType) {
            if (shouldSkipInjection(requestType, tabId)) {
                return;
            }
            const result = abu.webRequestService.processGetSelectorsAndScripts(
                { tabId },
                url,
                abu.rules.CssFilter.RETRIEVE_TRADITIONAL_CSS,
                true
            );

            if (result.requestFilterReady === false) {
                injections.set(tabId, frameId, {
                    ready: false,
                });
            } else {
                injections.set(tabId, frameId, {
                    ready: true,
                        jsScriptText: buildScriptText(result.scripts),
                        cssText: buildCssText(result.selectors),
                    url,
                });
            }
        }

        /**
         * Injects necessary CSS and scripts into the web page.
         * @param {RequestDetails} details Details about the navigation event
         */
        function tryInject(tabId, frameId, url, requestType) {
            
            if (shouldSkipInjection(requestType, tabId)) {
                return;
            }

            const injection = injections.get(tabId, frameId);

            if (injection && !injection.ready) {
                /**
                 * If injection is not ready yet, we call prepareScripts and tryInject functions again
                 * setTimeout callback lambda function accepts onCommitted details
                 */
                setTimeout((tabId, frameId, url, requestType) => {
                    prepareInjection(tabId, frameId, url, requestType);
                    tryInject(tabId, frameId, url, requestType);
                }, 100, tabId, frameId, url, requestType);
                injections.removeTabFrameInjection(tabId, frameId);
                return;
            }

            /**
             * webRequest api doesn't see requests served from service worker like they are served from the cache
             * https://bugs.chromium.org/p/chromium/issues/detail?id=766433
             * that's why we can't prepare injections when webRequest events fire
             * also we should check if injection url is correct
             * so we try to prepare this injection in the onCommit event again
             */
            if (requestType === abu.RequestTypes.DOCUMENT
                && (!injection || injection.url !== url)) {
                prepareInjection(tabId, frameId, url, requestType);
                tryInject(tabId, frameId, url, requestType);
                return;
            }

            /**
             * Sometimes it can happen that onCommitted event fires earlier than onHeadersReceived
             * for example onCommitted event for iframes in Firefox
             */
            if (!injection) {
                return;
            }

            if (injection.jsScriptText) {
                abu.tabs.executeScriptCode(tabId, frameId, injection.jsScriptText);
            }
            if (injection.cssText) {
                abu.tabs.insertCssCode(tabId, frameId, injection.cssText);
            }

            injections.removeTabFrameInjection(tabId, frameId);
        }

        /**
         * Removes injection if onErrorOccured event fires for corresponding tabId and frameId
         * @param {RequestDetails} details
         */
        function removeInjection(tabId, frameId, url, requestType) {
            if (shouldSkipInjection(requestType, tabId)) {
                return;
            }
            injections.removeTabFrameInjection(tabId, frameId);
        }
        
        /**
         * https://developer.chrome.com/extensions/webRequest
         * https://developer.chrome.com/extensions/webNavigation
         */
        abu.webRequest.onHeadersReceived.addListener(prepareInjection, ['<all_urls>']);
        abu.webNavigation.onCommitted.addListener(tryInject);
         // Remove injections when tab is closed or error occured
        abu.tabs.onRemoved.addListener(injections.removeTabInjection);
        abu.webRequest.onErrorOccurred.addListener(removeInjection, ['<all_urls>']);
    })(abu);

})(abu);
