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

	var tabsLoading = Object.create(null);

	function checkPopupBlockedRule(tabId, requestUrl, referrerUrl, sourceTab) {

		// Tab isn't ready
		if (!requestUrl) {
			return;
		}

		delete tabsLoading[tabId];

		var requestRule = abu.webRequestService.getRuleForRequest(sourceTab, requestUrl, referrerUrl, abu.RequestTypes.POPUP);

		if (abu.webRequestService.isRequestBlockedByRule(requestRule)) {
			//remove popup tab
			abu.tabs.remove(tabId);
			//append log event and fix log event type from POPUP to DOCUMENT
			abu.webRequestService.postProcessRequest(sourceTab, requestUrl, referrerUrl, abu.RequestTypes.DOCUMENT, requestRule);
		}
	}

	abu.webNavigation.onCreatedNavigationTarget.addListener(function (details) {

		var sourceTab = {tabId: details.sourceTabId};

		// webRequest.onBeforeRequest event may hasn't been received yet.
		var referrerUrl = abu.frames.getMainFrameUrl(sourceTab) || details.url;
		if (!abu.utils.url.isHttpRequest(referrerUrl)) {
			return;
		}

		var tabId = details.tabId;
		tabsLoading[tabId] = {
			referrerUrl: referrerUrl,
			sourceTab: sourceTab
		};

		checkPopupBlockedRule(tabId, details.url, referrerUrl, sourceTab);
	});

	abu.tabs.onUpdated.addListener(function (tab) {

		var tabId = tab.tabId;

		if (!(tabId in tabsLoading)) {
			return;
		}

		if (tab.url) {
			var tabInfo = tabsLoading[tabId];
			if (tabInfo) {
				checkPopupBlockedRule(tabId, tab.url, tabInfo.referrerUrl, tabInfo.sourceTab);
			}
		}
	});

})(abu);