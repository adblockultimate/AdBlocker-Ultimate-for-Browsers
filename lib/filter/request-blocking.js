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

abu.webRequestService = (function (abu) {

    'use strict';

    var onRequestBlockedChannel = abu.utils.channels.newChannel();

   
    /**
     * Prepares CSS and JS which should be injected to the page.
     *
     * @param tab           Tab
     * @param documentUrl   Document URL
     * @param options       Options for select:
     * options = {
     *      filter: ['selectors', 'scripts'] (selection filter) (mandatory)
     *      genericHide: true|false ( select only generic hide css rules) (optional)
     * }
     *
     * @returns {*}         null or object the following properties: "selectors", "scripts", "collapseAllElements"
     */
    var processGetSelectorsAndScripts = function (tab, documentUrl, cssFilterOptions, retrieveScripts) {

        var result = Object.create(null);

        if (!tab) {
            return result;
        }

        if (!abu.requestFilter.isReady()) {
            result.requestFilterReady = false;
            return result;
        }

        if (abu.desktop.isAbuDesktopActive() || abu.frames.isTabProtectionDisabled(tab) || abu.frames.isTabWhiteListed(tab)) {
            //don't process request
            return result;
        }

        // Looking for the whitelist rule
        var whitelistRule = abu.frames.getFrameWhiteListRule(tab);
        if (!whitelistRule) {
            // Check whitelist for current frame
            var mainFrameUrl = abu.frames.getMainFrameUrl(tab);
            whitelistRule = abu.requestFilter.findWhiteListRule(documentUrl, mainFrameUrl, abu.RequestTypes.DOCUMENT);
        }

        let CssFilter = abu.rules.CssFilter;


        // Check what exactly is disabled by this rule
        var elemHideFlag = whitelistRule && whitelistRule.isElemhide();
        var genericHideFlag = whitelistRule && whitelistRule.isGenericHide();

        // content-message-handler calls it in this way
        if (typeof cssFilterOptions === 'undefined' && typeof retrieveScripts === 'undefined') {
            // Build up default flags.
            let canUseInsertCSSAndExecuteScript = true;
            // If tabs.executeScript is unavailable, retrieve JS rules now.
            retrieveScripts = !canUseInsertCSSAndExecuteScript;
            if (!elemHideFlag) {
                cssFilterOptions = CssFilter.RETRIEVE_EXTCSS;
                if (!canUseInsertCSSAndExecuteScript) {
                    cssFilterOptions += CssFilter.RETRIEVE_TRADITIONAL_CSS;
                }
                if (genericHideFlag) {
                    cssFilterOptions += CssFilter.GENERIC_HIDE_APPLIED;
                }
            }
        } else {
            if (!elemHideFlag && genericHideFlag) {
                cssFilterOptions += CssFilter.GENERIC_HIDE_APPLIED;
            }
        }

        var retrieveSelectors = !elemHideFlag && (cssFilterOptions & (CssFilter.RETRIEVE_TRADITIONAL_CSS + CssFilter.RETRIEVE_EXTCSS)) !== 0;

        if (retrieveSelectors) {
            result.collapseAllElements = abu.requestFilter.shouldCollapseAllElements();
            result.selectors = abu.requestFilter.getSelectorsForUrl(documentUrl, cssFilterOptions);
        }

        if (retrieveScripts) {
            var jsInjectFlag = whitelistRule && whitelistRule.isJsInject();
            if (!jsInjectFlag) {
                // JS rules aren't disabled, returning them
                result.scripts = abu.requestFilter.getScriptsStringForUrl(documentUrl, tab);
            }
        }

        return result;
    };

    /**
     * Checks if request that is wrapped in page script should be blocked.
     * We do this because browser API doesn't have full support for intercepting all requests, e.g. WebSocket or WebRTC.
     *
     * @param tab           Tab
     * @param requestUrl    request url
     * @param referrerUrl   referrer url
     * @param requestType   Request type (WEBSOCKET or WEBRTC)
     * @returns {boolean}   true if request is blocked
     */
    var checkPageScriptWrapperRequest = function (tab, requestUrl, referrerUrl, requestType) {

        if (!tab) {
            return false;
        }

        var requestRule = getRuleForRequest(tab, requestUrl, referrerUrl, requestType);

        postProcessRequest(tab, requestUrl, referrerUrl, requestType, requestRule);

        return isRequestBlockedByRule(requestRule);
    };

    /**
     * Checks if request is blocked
     *
     * @param tab           Tab
     * @param requestUrl    request url
     * @param referrerUrl   referrer url
     * @param requestType   one of RequestType
     * @returns {boolean}   true if request is blocked
     */
    var processShouldCollapse = function (tab, requestUrl, referrerUrl, requestType) {

        if (!tab) {
            return false;
        }

        var requestRule = getRuleForRequest(tab, requestUrl, referrerUrl, requestType);
        return isRequestBlockedByRule(requestRule);
    };

    /**
     * Checks if requests are blocked
     *
     * @param tab               Tab
     * @param referrerUrl       referrer url
     * @param collapseRequests  requests array
     * @returns {*}             requests array
     */
    var processShouldCollapseMany = function (tab, referrerUrl, collapseRequests) {
        if (!tab) {
            return collapseRequests;
        }

        for (var i = 0; i < collapseRequests.length; i++) {
            var request = collapseRequests[i];
            var requestRule = getRuleForRequest(tab, request.elementUrl, referrerUrl, request.requestType);
            request.collapse = isRequestBlockedByRule(requestRule);
        }

        return collapseRequests;
    };

    /**
     * Checks if request is blocked by rule
     *
     * @param requestRule
     * @returns {*|boolean}
     */
    var isRequestBlockedByRule = function (requestRule) {
        return requestRule && !requestRule.whiteListRule;
    };

    /**
     * Gets blocked response by rule
     * See https://developer.chrome.com/extensions/webRequest#type-BlockingResponse or https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/webRequest/BlockingResponse for details
     * @param requestRule Request rule or null
     * @returns {*} Blocked response or null
     */
    var getBlockedResponseByRule = function (requestRule) {
        if (isRequestBlockedByRule(requestRule)) {
            if (requestRule.emptyResponse) {
                return {redirectUrl: 'data:,'};
            } else {
                return {cancel: true};
            }
        }
        return null;
    };

    /**
     * Finds rule for request
     *
     * @param tab           Tab
     * @param requestUrl    request url
     * @param referrerUrl   referrer url
     * @param requestType   one of RequestType
     * @returns {*}         rule or null
     */
    var getRuleForRequest = function (tab, requestUrl, referrerUrl, requestType) {
        if (abu.desktop.isAbuDesktopActive() || abu.frames.isTabProtectionDisabled(tab)) {
            //don't process request
            return null;
        }

        let whitelistRule;
        /**
         * Background requests will be whitelisted if their referrer
         * url will match with user whitelist rule
         * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1032
         */
        if (tab.tabId === abu.BACKGROUND_TAB_ID) {
            whitelistRule = abu.whitelist.findWhiteListRule(referrerUrl);
        } else {
            whitelistRule = abu.frames.getFrameWhiteListRule(tab);
        }

        if (whitelistRule && whitelistRule.isDocumentWhiteList()) {
            // Frame is whitelisted by the main frame's $document rule
            // We do nothing more in this case - return the rule.
            return whitelistRule;
        } else if (!whitelistRule) {
            // If whitelist rule is not found for the main frame, we check it for referrer
            whitelistRule = abu.requestFilter.findWhiteListRule(requestUrl, referrerUrl, abu.RequestTypes.DOCUMENT);
        }

        return abu.requestFilter.findRuleForRequest(requestUrl, referrerUrl, requestType, whitelistRule);
    };

    /**
     * Find CSP rules for request
     * @param tab           Tab
     * @param requestUrl    Request URL
     * @param referrerUrl   Referrer URL
     * @param requestType   Request type (DOCUMENT or SUBDOCUMENT)
     * @returns {*}         Collection of rules or null
     */
    var getCspRules = function (tab, requestUrl, referrerUrl, requestType) {

        if (abu.frames.isTabProtectionDisabled(tab) || abu.frames.isTabWhiteListed(tab)) {
            //don't process request
            return null;
        }

        var whitelistRule = abu.requestFilter.findWhiteListRule(requestUrl, referrerUrl, abu.RequestTypes.DOCUMENT);
        if (whitelistRule && whitelistRule.isUrlBlock()) {
            return null;
        }

        return abu.requestFilter.getCspRules(requestUrl, referrerUrl, requestType);
    };

    /**
     * Processes HTTP response.
     * It could do the following:
     * 1. Detect ABU desktop
     *
     * @param tab Tab object
     * @param requestUrl Request URL
     * @param referrerUrl Referrer URL
     * @param requestType Request type
     * @param responseHeaders Response headers
     */
    var processRequestResponse = function (tab, requestUrl, referrerUrl, requestType, responseHeaders) {
       /*  // var requestRule = null;
        // var appendLogEvent = false;

		if (abu.frames.isTabProtectionDisabled(tab)) { 
            // Doing nothing
        } else if (requestType === abu.RequestTypes.DOCUMENT) {
            // requestRule = abu.frames.getFrameWhiteListRule(tab);
            // var domain = abu.frames.getFrameDomain(tab);
            // appendLogEvent = true;
        } */
        if (requestType === abu.RequestTypes.DOCUMENT && !abu.prefs.mobile && abu.utils.browser.isWindowsOs()) {
            // Check headers to detect ABU desktop
            abu.desktop.checkHeaders(tab, responseHeaders);
        }

        return null;
    };

    /**
     * Request post processing, firing events, add log records etc.
     *
     * @param tab           Tab
     * @param requestUrl    request url
     * @param referrerUrl   referrer url
     * @param requestType   one of RequestType
     * @param requestRule   rule
     */
    var postProcessRequest = function (tab, requestUrl, referrerUrl, requestType, requestRule) {

        if (isRequestBlockedByRule(requestRule)) {
            abu.listeners.notifyListenersAsync(abu.listeners.ADS_BLOCKED, requestRule, tab, 1);
            var details = {
                tabId: tab.tabId,
                requestUrl: requestUrl,
                referrerUrl: referrerUrl,
                requestType: requestType
            };
            if (requestRule) {
                details.rule = requestRule.ruleText;
                details.filterId = requestRule.filterId;
            }
            onRequestBlockedChannel.notify(details);
        }
		
    };

    // EXPOSE
    return {
        processGetSelectorsAndScripts,
        checkPageScriptWrapperRequest,
        processShouldCollapse,
        processShouldCollapseMany,
        isRequestBlockedByRule,
        getBlockedResponseByRule,
        getRuleForRequest,
        getCspRules,
        processRequestResponse,
        postProcessRequest,
        onRequestBlocked: onRequestBlockedChannel
    };

})(abu);
