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

/* global chrome */

var browser = window.browser || chrome;

(function (abu, browser) {

    'use strict';

    abu.runtime = (function () {

        var onMessage = {
            addListener: function (callback) {
                // https://developer.chrome.com/extensions/runtime#event-onMessage
                abu.runtimeImpl.onMessage.addListener(function (message, sender, sendResponse) {
                    var senderOverride = Object.create(null);
                    if (sender.tab) {
                        senderOverride.tab = abu.tabsImpl.fromChromeTab(sender.tab);
                    }
                    var response = callback(message, senderOverride, sendResponse);
                    var async = response === true;
                    // If async sendResponse will be invoked later
                    if (!async) {
                        sendResponse(response);
                    }
                    // Don't forget return callback result for asynchronous message passing
                    return async;
                });
            }
        };

        return {
			setUninstallURL: browser.runtime.setUninstallURL,
            onMessage: onMessage,
            get lastError() {
                return browser.runtime.lastError;
            }
        };
    })();

    var linkHelper = document.createElement('a');

    /**
     * Fixing request type:
     * https://code.google.com/p/chromium/issues/detail?id=410382
     *
     * @param url Request url
     * @returns String Fixed object type
     */
    function parseRequestTypeFromUrl(url) {
        linkHelper.href = url;
        var path = linkHelper.pathname;
        var requestType = abu.utils.browser.parseContentTypeFromUrlPath(path);
        if (requestType === null) {
            // https://code.google.com/p/chromium/issues/detail?id=410382
            requestType = abu.RequestTypes.OBJECT;
        }
        return requestType;
    }

    function getRequestDetails(details) {

        var tab = {tabId: details.tabId};

        /**
         * FF sends http instead of ws protocol at the http-listeners layer
         * Although this is expected, as the Upgrade request is indeed an HTTP request, we use a chromium based approach in this case.
         */
        if (details.type === 'websocket' && details.url.indexOf('http') === 0) {
            details.url = details.url.replace(/^http(s)?:/, 'ws$1:');
        }

        //https://developer.chrome.com/extensions/webRequest#event-onBeforeRequest
        var requestDetails = {
            requestUrl: details.url,    //request url
            tab: tab                    //request tab
        };

        var frameId = 0;        //id of this frame (only for main_frame and sub_frame types)
        var requestFrameId = 0; //id of frame where request is executed
        var requestType;        //request type

        switch (details.type) {
            case "main_frame":
                frameId = 0;
                requestType = abu.RequestTypes.DOCUMENT;
                break;
            case "sub_frame":
                frameId = details.frameId;
                requestFrameId = details.parentFrameId; //for sub_frame use parentFrameId as id of frame that wraps this frame
                requestType = abu.RequestTypes.SUBDOCUMENT;
                break;
            default:
                requestFrameId = details.frameId;
                requestType = details.type.toUpperCase();
                break;
        }

        //relate request to main_frame
        if (requestFrameId === -1) {
            requestFrameId = 0;
        }

        if (requestType === 'IMAGESET') {
            requestType = abu.RequestTypes.IMAGE;
        }

        if (requestType === abu.RequestTypes.OTHER) {
            requestType = parseRequestTypeFromUrl(details.url);
        }

        if (!(requestType in abu.RequestTypes)) {
            requestType = abu.RequestTypes.OTHER;
        }

        requestDetails.frameId = frameId;
        requestDetails.requestFrameId = requestFrameId;
        requestDetails.requestType = requestType;

        if (details.requestHeaders) {
            requestDetails.requestHeaders = details.requestHeaders;
        }

        if (details.responseHeaders) {
            requestDetails.responseHeaders = details.responseHeaders;
        }

        if (details.tabId === abu.BACKGROUND_TAB_ID) {
            // In case of background request, its details contains referrer url
            // Chrome uses `initiator`
            // FF uses `originUrl
            requestDetails.referrerUrl = details.originUrl || details.initiator;
        }

        return requestDetails;
    }

    var onBeforeRequest = {

        addListener: function (callback, urls) {

            // https://developer.chrome.com/extensions/webRequest#event-onBeforeRequest
            browser.webRequest.onBeforeRequest.addListener(function (details) {

                if (details.tabId === -1) {
                    return;
                }

                var requestDetails = getRequestDetails(details);
                return callback(requestDetails);

            }, urls ? {urls: urls} : {}, ["blocking"]);
        }
    };

    var onHeadersReceived = {

        addListener: function (callback, urls) {

            browser.webRequest.onHeadersReceived.addListener(function (details) {

                if (details.tabId === -1) {
                    return;
                }

                var requestDetails = getRequestDetails(details);
                var result = callback(requestDetails);
                if (result) {
                    return 'responseHeaders' in result ? {responseHeaders: result.responseHeaders} : {};
                }

            }, urls ? {urls: urls} : {}, ["responseHeaders", "blocking"]);
        }
    };

    var onBeforeSendHeaders = {

        addListener: function (callback, urls) {

            browser.webRequest.onBeforeSendHeaders.addListener(function (details) {

                if (details.tabId === -1) {
                    return;
                }

                var requestDetails = getRequestDetails(details);
                var result = callback(requestDetails);
                if (result) {
                    return 'requestHeaders' in result ? {requestHeaders: result.requestHeaders} : {};
                }

            }, urls ? {urls: urls} : {}, ["requestHeaders", "blocking"]);
        }
    };

    const onErrorOccurred = {
        /**
         * Wrapper for webRequest.onErrorOccurred event
         * It prepares requestDetails and passes them to the callback
         * @param callback callback function receives {RequestDetails} and handles event
         * @param {String} urls url match pattern https://developer.chrome.com/extensions/match_patterns
         */
        addListener(callback, urls) {
            browser.webRequest.onErrorOccurred.addListener((details) => {
                if (details.tabId === abu.BACKGROUND_TAB_ID) {
                    return;
                }
                const requestType = details.frameId === 0
                    ? abu.RequestTypes.DOCUMENT
                    : abu.RequestTypes.SUBDOCUMENT;
                callback(details.tabId, details.frameId, details.url, requestType);
            }, urls ? { urls } : {});
        },
    };

    /**
     * Gets URL of a file that belongs to our extension
     */
    abu.getURL = browser.runtime.getURL;

    abu.backgroundPage = {};
    abu.backgroundPage.getWindow = function () {
        return browser.extension.getBackgroundPage();
    };

    abu.app = {

        /**
         * Extension ID
         */
        getId: function () {
            return browser.runtime.id;
        },

        /**
         * Gets extension scheme
         * @returns "chrome-extension" for Chrome," ms-browser-extension" for Edge
         */
        getUrlScheme: function () {
            var url = abu.getURL('test.html');
            var index = url.indexOf('://');
            return url.substring(0, index);
        },

        /**
         * Extension version
         */
        getVersion: function () {
            return browser.runtime.getManifest().version;
        },

        /**
         * Extension UI locale
         */
        getLocale: function () {
            return browser.i18n.getUILanguage();
        }
    };

    abu.webRequest = {
        onBeforeRequest,
        handlerBehaviorChanged: browser.webRequest.handlerBehaviorChanged,
        onCompleted: browser.webRequest.onCompleted,
        onErrorOccurred,
        onHeadersReceived,
        onBeforeSendHeaders,
        webSocketSupported: typeof browser.webRequest.ResourceType !== 'undefined' && browser.webRequest.ResourceType['WEBSOCKET'] === 'websocket'
    };

    var onCreatedNavigationTarget = {

        addListener: function (callback) {

            // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/webNavigation/onCreatedNavigationTarget#Browser_compatibility
            if (typeof browser.webNavigation.onCreatedNavigationTarget === 'undefined') {
                return;
            }

            browser.webNavigation.onCreatedNavigationTarget.addListener(function (details) {

                if (details.tabId === -1) {
                    return;
                }

                callback({
                    tabId: details.tabId,
                    sourceTabId: details.sourceTabId,
                    url: details.url
                });
            });
        }
    };

    var onCommitted = {

        addListener: function (callback) {

            // https://developer.chrome.com/extensions/webNavigation#event-onCommitted
            browser.webNavigation.onCommitted.addListener(function (details) {
                if (details.tabId === abu.BACKGROUND_TAB_ID) {
                    return;
                }
                const requestType = details.frameId === 0
                    ? abu.RequestTypes.DOCUMENT
                    : abu.RequestTypes.SUBDOCUMENT;
                callback(details.tabId, details.frameId, details.url, requestType);
            });
        }
    };

    // https://developer.chrome.com/extensions/webNavigation
    abu.webNavigation = {
        onCreatedNavigationTarget: onCreatedNavigationTarget,
        onCommitted: onCommitted
    };

    const browserActionSupported = typeof browser.browserAction.setIcon !== 'undefined';

    abu.browserAction = {

        setBrowserAction: function (tab, icon, badge, badgeColor, title) {

            if (!browserActionSupported) {
                return;
            }
            
            var tabId = tab.tabId;

            var onIconReady = function () {
                if (browser.runtime.lastError) {
                    return;
                }
                browser.browserAction.setBadgeText({tabId: tabId, text: badge});

                if (browser.runtime.lastError) {
                    return;
                }
                if (badge) {
                    browser.browserAction.setBadgeBackgroundColor({tabId: tabId, color: badgeColor});
                }

                //title setup via manifest.json file
                //chrome.browserAction.setTitle({tabId: tabId, title: title});
            };

            /**
             * Workaround for MS Edge.
             * For some reason Edge changes the inner state of the "icon" object and adds a tabId property inside.
             */
            delete icon.tabId;

            if (browser.runtime.lastError) {
                return;
            }

            browser.browserAction.setIcon({tabId: tabId, path: icon}, onIconReady);
        },
        setPopup: function () {
            // Do nothing. Popup is already installed in manifest file
        },
        resize: function () {
            // Do nothing
        },
        close: function () {
            // Do nothing
        }
    };

    abu.contextMenus = browser.menus || browser.contextMenus;
    abu.isAndroid = !browser.contextMenus;

})(abu, browser);
