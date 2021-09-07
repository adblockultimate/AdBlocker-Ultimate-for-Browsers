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

/**
 *  Initialize Content => BackgroundPage messaging
 */
(function (abu) {

    'use strict';

    /**
     * Contains event listeners from content pages
     */
    var eventListeners = Object.create(null);

    /**
     * Adds event listener from content page
     * @param message
     * @param sender
     */
    function processAddEventListener(message, sender) {
        var listenerId = abu.listeners.addSpecifiedListener(message.events, function () {
            var sender = eventListeners[listenerId];
            if (sender) {
                abu.tabs.sendMessage(sender.tab.tabId, {
                    type: 'notifyListeners',
                    args: Array.prototype.slice.call(arguments)
                });
            }
        });
        eventListeners[listenerId] = sender;
        return {listenerId: listenerId};
    }

    /**
     * Constructs objects that uses on extension pages, like: options.html
     */
    function processInitializeFrameScriptRequest() {

        var enabledFilters = Object.create(null);

        var AntiBannerFiltersId = abu.utils.filters.ids;
		
        for (var key in AntiBannerFiltersId) {
            if (AntiBannerFiltersId.hasOwnProperty(key)) {
                var filterId = AntiBannerFiltersId[key];
                var enabled = abu.filters.isFilterEnabled(filterId);
                if (enabled) {
                    enabledFilters[filterId] = true;
                }
            }
        }

        return {
            userSettings: abu.settings.getAllSettings(),
            enabledFilters: enabledFilters,
            filtersMetadata: abu.subscriptions.getFilters(),
            requestFilterInfo: abu.requestFilter.getRequestFilterInfo(),
            contentBlockerInfo: abu.requestFilter.getContentBlockerInfo(),
            environmentOptions: {
                isMacOs: abu.utils.browser.isMacOs(),
                Prefs: {
                    locale: abu.app.getLocale(),
                    mobile: abu.prefs.mobile || false
                },
				appVersion: abu.app.getVersion()
            },
            constants: {
                AntiBannerFiltersId: abu.utils.filters.ids,
                EventNotifierTypes: abu.listeners.events
            }
        };
    }


    /**
     * Constructs filters metadata for options.html page
     */
    function processGetFiltersMetadata() {
        var groupsMeta = abu.subscriptions.getGroups();
		groupsMeta.sort(function(g1, g2){
			return g1.displayNumber - g2.displayNumber;
		});

		const filters = abu.antiBannerService.getFiltersForОptionsPage();
        var categories = [];
        for (let i = 0; i < groupsMeta.length; i += 1) {
            let category = groupsMeta[i];
            category.filters = abu.antiBannerService.getFiltersForGroup(category.groupId);
			for (let j = 0; j < category.filters.length; j++) {
				let filterId = category.filters[j].filterId;
				let installed = abu.filters.isFilterInstalled(filterId);
				if(installed) category.filters[j].installed = true;
				category.filters[j].enabled = abu.filters.isFilterEnabled(filterId);
			}
			
			// Orders filters by groupId, displayNumber, name
			category.filters.sort((f1, f2) => {
				let result = 0;
				try {
					if (f1.groupId !== f2.groupId) {
						result = f1.groupId - f2.groupId;
					} else if (f1.displayNumber !== f2.displayNumber) {
						result = f1.displayNumber - f2.displayNumber;
					} else {
						result = f1.name.toLowerCase() > f2.name.toLowerCase() ? 1 : -1;
					}
				} catch (e) {
					console.log(e);
				}
				return result;
			});
			
            categories.push(category);
        }
		
        return {
            categories: categories,
            filters: filters
        };
    }

    /**
     * Searches for whitelisted domains.
     *
     * @param offset Offset
     * @param limit Limit
     * @param text Search string
     * @returns {Array} Domains found
     */
    function searchWhiteListDomains(offset, limit, text) {
        var domains = abu.whitelist.getWhiteListDomains();
        var result = [];
        for (var i = 0; i < domains.length; i++) {
            var domain = domains[i];
            if (!text || abu.utils.strings.containsIgnoreCase(domain, text)) {
                result.push(domain);
            }
        }
        return limit ? result.slice(offset, offset + limit) : result;
    }

    /**
     * Searches for user rules.
     *
     * @param offset Offset
     * @param limit Limit
     * @param text Search string
     * @returns {Array} Rules found
     */
    function searchUserRules(offset, limit, text) {
        var userRules = abu.userrules.getRules();
        var result = [];
        for (var i = 0; i < userRules.length; i++) {
            var ruleText = userRules[i];
            if (!text || abu.utils.strings.containsIgnoreCase(ruleText, text)) {
                result.push(ruleText);
            }
        }
        return limit ? result.slice(offset, offset + limit) : result;
    }


    /**
     * Main function for processing messages from content-scripts
     *
     * @param message
     * @param sender
     * @param callback
     * @returns {*}
     */
    function handleMessage(message, sender, callback) {
        switch (message.type) {
            case 'updateUserRated':
                abu.pageStats.updateUserRated(message.val);
                break;
            case 'showBadgeAgain':
                abu.pageStats.setShowBadgeAgain(message.val);
                break;
            case 'sendFeedback':
                abu.backend.sendFeedback(message.params);
                break;
            case 'getUserRank':
                callback(abu.pageStats.getUserRank());
                break;
            case 'showPageStatistic':
                callback(abu.settings.showPageStatistic());
                break;
            case 'changeShowPageStatistic':
                abu.settings.changeShowPageStatistic(message.show);
                break;
            case 'unWhiteListFrame':
                abu.userrules.unWhiteListFrame(message.frameInfo);
                break;
            case 'addEventListener':
                return processAddEventListener(message, sender);
            case 'removeListener':
                var listenerId = message.listenerId;
                abu.listeners.removeListener(listenerId);
                delete eventListeners[listenerId];
                break;
            case 'initializeFrameScript':
                return processInitializeFrameScriptRequest();
            case 'changeUserSetting':
                abu.settings.setProperty(message.key, message.value);
                break;
            case 'checkRequestFilterReady':
                return {ready: abu.requestFilter.isReady()};
            case 'addAndEnableFilter':
                abu.filters.addAndEnableFilters([message.filterId]);
                break;
            case 'disableAntiBannerFilter':
				abu.filters.disableFilter(message.filterId, true);
                break;
			case 'removeAntiBannerFilter':
				abu.filters.removeFilter(message.filterId);
				break;
			case 'enableFiltersGroup':
                abu.filters.enableFiltersGroup(message.groupId);
                break;
			case 'disableFiltersGroup':
                abu.filters.disableFiltersGroup(message.groupId);
                break;
            case 'getWhiteListDomains':
                var whiteListDomains = searchWhiteListDomains(message.offset, message.limit, message.text);
                return {rules: whiteListDomains};
            case 'getUserFilters':
                var rules = searchUserRules(message.offset, message.limit, message.text);
                return {rules: rules};
            case 'checkAntiBannerFiltersUpdate':
                abu.ui.checkFiltersUpdates();
                break;
			case 'subscribeToCustomFilter':
                abu.filters.loadCustomFilter(message.url, (filter) => {
                    abu.filters.addAndEnableFilters([filter.filterId], () => {
                        callback({filter: filter});
                    });
                }, (error) => {
                    callback({error: error});
                });
                return true;
            case 'clearUserFilter':
                abu.userrules.clearRules();
                break;
            case 'clearWhiteListFilter':
                abu.whitelist.clearWhiteList();
				abu.desktop.syncExtToApp();
                break;
            case 'addWhiteListDomains':
                abu.whitelist.addToWhiteListArray(message.domains);
				abu.desktop.syncExtToApp();
                break;
            case 'clearAndAddWhiteListDomains':
				abu.whitelist.clearWhiteList();
                abu.whitelist.addToWhiteListArray(message.rules);
				abu.desktop.syncExtToApp();
                break;
            case 'removeWhiteListDomain':
                abu.whitelist.removeFromWhiteList(message.text);
				abu.desktop.syncExtToApp();
                break;
            case 'addUserFilterRules':
                abu.userrules.addRules(message.rules);
				abu.desktop.syncExtToApp();
                break;
			case 'clearAndAddUserFilterRules':
				abu.userrules.clearRules();
                if(message.rules.length > 0) {
					abu.userrules.addRules(message.rules);
				}
				abu.desktop.syncExtToApp();
                callback({});
                break;
            case 'getFiltersMetadata':
                return processGetFiltersMetadata();
            case 'openExtensionStore':
                abu.ui.openExtensionStore();
                break;
            case 'rateWeb':
                abu.ui.rateWeb();
                break;
            case 'openShareSocialLink':
                abu.ui.openShareSocialLink(message.network, message.totalBlocked);
                break;
            case 'openExportRulesTab':
                abu.ui.openExportRulesTab(message.whitelist);
                break;
            case 'openTab':
                abu.ui.openTab(message.url, message.options);
                break;
            case 'resetBlockedAdsCount':
                abu.frames.resetBlockedAdsCount();
                break;
            case 'getSelectorsAndScripts':
                let urlForSelectors;
                if (!abu.utils.url.isHttpOrWsRequest(message.documentUrl) && sender.frameId !== 0) {
                    urlForSelectors = sender.tab.url;
                } else {
                    urlForSelectors = message.documentUrl;
                }
                return abu.webRequestService.processGetSelectorsAndScripts(sender.tab, urlForSelectors) || {};
            case 'checkPageScriptWrapperRequest':
                var block = abu.webRequestService.checkPageScriptWrapperRequest(sender.tab, message.elementUrl, message.documentUrl, message.requestType);
                return {block: block, requestId: message.requestId};
            case 'processShouldCollapse':
                var collapse = abu.webRequestService.processShouldCollapse(sender.tab, message.elementUrl, message.documentUrl, message.requestType);
                return {collapse: collapse, requestId: message.requestId};
            case 'processShouldCollapseMany':
                var requests = abu.webRequestService.processShouldCollapseMany(sender.tab, message.documentUrl, message.requests);
                return {requests: requests};
            case 'addUserRule':
                abu.userrules.addRules([message.ruleText]);
                abu.desktop.syncExtToApp();
                break;
            case 'removeUserRule':
                abu.userrules.removeRule(message.ruleText);
                abu.desktop.syncExtToApp();
                break;
            case 'reloadTabById':
                abu.tabs.reload(message.tabId);
                break;
            case 'getTabFrameInfoById':
                if (message.tabId) {
                    var frameInfo = abu.frames.getFrameInfo({tabId: message.tabId});
                    return {frameInfo: frameInfo};
                } else {
                    abu.tabs.getActive(function (tab) {
                        var frameInfo = abu.frames.getFrameInfo(tab);
                        callback({frameInfo: frameInfo});
                    });
                    return true; // Async
                }
                break;
            // Popup methods
            case 'addWhiteListDomainPopup':
                abu.tabs.getActive(function (tab) {
                    abu.ui.whiteListTab(tab);
                });
                break;
            case 'removeWhiteListDomainPopup':
                abu.tabs.getActive(function (tab) {
                    abu.ui.unWhiteListTab(tab);
                });
                break;
            case 'changeFilteringDisabled':
                abu.ui.changeFilteringDisabled(message.disabled);
                break;
            case 'openSiteReportTab':
                abu.ui.openSiteReportTab(message.url);
                break;
            case 'openSettingsTab':
                abu.ui.openSettingsTab();
                break;
            case 'openAssistant':
                abu.ui.openAssistant();
                break;
            case 'getTabInfoForPopup':
                abu.tabs.getActive(function (tab) {
                    const frameInfo = abu.frames.getFrameInfo(tab);
                    callback({
                        frameInfo: frameInfo,
                        options: {
                            isMobile: abu.prefs.mobile || false,
                            offetAbuWindows: (abu.utils.browser.isWindowsOs() && !abu.settings.isAbuDesktopInstlled()),
                            isAbuDesktopActive: abu.desktop.isAbuDesktopActive()
                        }
                    });
                });
                return true; // Async
            case 'resizePanelPopup':
                abu.browserAction.resize(message.width, message.height);
                break;
            case 'closePanelPopup':
                abu.browserAction.close();
                break;
            default:
                // Unhandled message
                return true;
        }
    }

    // Add event listener from content-script messages
    abu.runtime.onMessage.addListener(handleMessage);

    /**
     * There is no messaging in Safari popover context,
     * so we have to expose this method to keep the message-like style that is used in other browsers for communication between popup and background page.
     */
    abu.runtime.onMessageHandler = handleMessage;

})(abu);

