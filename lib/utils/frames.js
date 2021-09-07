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
 * Object that contains info about every browser tab.
 */
abu.frames = (function (abu) {

	'use strict';

	/**
	 * Adds frame to map. This method is called on first document request.
	 * If this is a main frame - saves this info in frame data.
	 *
	 * @param tab       Tab object
	 * @param frameId   Frame ID
	 * @param url       Page URL
	 * @param type      Request content type (UrlFilterRule.contentTypes)
	 * @returns Frame data
	 */
	var recordFrame = function (tab, frameId, url, type) {
		// var frame = abu.tabs.getTabFrame(tab.tabId, frameId);
		// previousUrl never used in abu-ext.
		// var previousUrl = '';
		if (type === abu.RequestTypes.DOCUMENT) {
			abu.tabs.clearTabFrames(tab.tabId);
			abu.tabs.clearTabMetadata(tab.tabId);
			// if (frame) {
			// 	previousUrl = frame.url;
			// }
		}

		abu.tabs.recordTabFrame(tab.tabId, frameId, url, abu.utils.url.getDomainName(url));

		if (type === abu.RequestTypes.DOCUMENT) {
		// 	abu.tabs.updateTabMetadata(tab.tabId, {previousUrl: previousUrl});
			reloadFrameData(tab);
		}
	};

	/**
     * This method reloads frame data and updates previous url if necessary
     * We use it in the webRequest.onCommit event because when website uses service worker
     * main_frame request can not fire in the webRequest events
     * @param tab
     * @param frameId
     * @param url
     * @param type
     */
    const checkAndRecordMainFrame = (tabId, frameId, url, type) => {
        if (type !== abu.RequestTypes.DOCUMENT) {
            return;
        }

		const frame = abu.tabs.getTabFrame(tabId, frameId);
		const tab = {tabId: tabId}

        // If no main_frame in tab, than we consider this as a new page load
        if (!frame) {
            abu.tabs.recordTabFrame(tabId, frameId, url, abu.utils.url.getDomainName(url));
            reloadFrameData(tab);
            return;
        }

        // if frame has different rule, then we consider this as a new page load
        if (frame && frame.url !== url) {
            abu.tabs.clearTabFrames(tabId);
            abu.tabs.clearTabMetadata(tabId);
            abu.tabs.recordTabFrame(tabId, frameId, url, abu.utils.url.getDomainName(url));
            reloadFrameData(tab);
		}
    };

	/**
	 * Gets frame URL
	 *
	 * @param tab       Tab
	 * @param frameId   Frame ID
	 * @returns Frame URL
	 */
	var getFrameUrl = function (tab, frameId) {
		var frame = abu.tabs.getTabFrame(tab.tabId, frameId);
		return frame ? frame.url : null;
	};

	/**
	 * Gets main frame URL
	 *
	 * @param tab	Tab
	 * @returns Frame URL
	 */
	var getMainFrameUrl = function(tab){
		return getFrameUrl(tab, 0);
	};

	/**
	 * Gets frame Domain
	 *
	 * @param tab       Tab
	 * @returns Frame Domain
	 */
	var getFrameDomain = function (tab) {
		var frame = abu.tabs.getTabFrame(tab.tabId, 0);
		return frame ? frame.domainName : null;
	};

	/**
	 * @param tab Tab
	 * @returns true if Tab have white list rule
	 */
	var isTabWhiteListed = function (tab) {
		var frameWhiteListRule = abu.tabs.getTabMetadata(tab.tabId, 'frameWhiteListRule');
        return frameWhiteListRule && frameWhiteListRule.isDocumentWhiteList();
	};

	/**
	 * @param tab Tab
	 * @returns true if Tab have white list rule and white list isn't invert
	 */
	var isTabWhiteListedForSafebrowsing = function (tab) {
		return isTabWhiteListed(tab);
	};

	/**
	 * @param tab Tab
	 * @returns true if protection is paused
	 */
	var isTabProtectionDisabled = function (tab) {
		return abu.tabs.getTabMetadata(tab.tabId, 'applicationFilteringDisabled');
	};


	/**
	 * Gets whitelist rule for the specified tab
	 * @param tab Tab to check
	 * @returns whitelist rule applied to that tab (if any)
	 */
	var getFrameWhiteListRule = function (tab) {
		return abu.tabs.getTabMetadata(tab.tabId, 'frameWhiteListRule');
	};

	/**
	 * Reloads tab data (checks whitelist and filtering status)
	 *
	 * @param tab Tab to reload
	 */
	var reloadFrameData = function (tab) {
		var frame = abu.tabs.getTabFrame(tab.tabId, 0);
		if (frame) {
			var url = frame.url;
			var frameWhiteListRule = abu.whitelist.findWhiteListRule(url);
			if (!frameWhiteListRule) {
				frameWhiteListRule = abu.requestFilter.findWhiteListRule(url, url, abu.RequestTypes.DOCUMENT);
			}
			abu.tabs.updateTabMetadata(tab.tabId, {
				frameWhiteListRule: frameWhiteListRule,
				applicationFilteringDisabled: abu.settings.isFilteringDisabled()
			});
		}
	};

	/**
	 * Attach referrer url to the tab's main frame object.
	 * This referrer is then used on safebrowsing "Access Denied" for proper "Go Back" behavior.
	 *
	 * @param tab Tab
	 * @param referrerUrl Referrer to record
	 */
	var recordFrameReferrerHeader = function (tab, referrerUrl) {
		abu.tabs.updateTabMetadata(tab.tabId, {referrerUrl: referrerUrl});
	};

	/**
	 * Gets main frame data
	 *
	 * @param tab Tab
	 * @returns frame data
	 */
	var getFrameInfo = function (tab) {
		var tabId = tab.tabId;
		var frame = abu.tabs.getTabFrame(tabId);

		var url = tab.url;
		if (!url && frame) {
			url = frame.url;
		}

		const isHttpRequest = abu.utils.url.isHttpRequest(url);
		const urlFilteringDisabled = !isHttpRequest;
		var applicationFilteringDisabled;
		var documentWhiteListed = false;
		var userWhiteListed = false;
		var canAddRemoveRule = false;
		var frameRule;

		if (!urlFilteringDisabled) {

			applicationFilteringDisabled = abu.tabs.getTabMetadata(tabId, 'applicationFilteringDisabled');

			documentWhiteListed = isTabWhiteListed(tab);
			if (documentWhiteListed) {
				var rule = getFrameWhiteListRule(tab);
				userWhiteListed = abu.utils.filters.isWhiteListFilterRule(rule) || abu.utils.filters.isUserFilterRule(rule);
				frameRule = {
					filterId: rule.filterId,
					ruleText: rule.ruleText
				};
			}
			// It means site in exception
			canAddRemoveRule = !(documentWhiteListed && !userWhiteListed);
			
		}

		var totalBlockedTab = userWhiteListed ? 0 : (abu.tabs.getTabMetadata(tabId, 'blocked') || 0);
		var totalBlocked = abu.pageStats.getTotalBlocked();
		const domainName = getFrameDomain(tab);

		return {

			url,
			domainName, 

			applicationFilteringDisabled,
			urlFilteringDisabled,

			documentWhiteListed,
			userWhiteListed,
			isHttpRequest,
			canAddRemoveRule,
			frameRule,

			totalBlockedTab: totalBlockedTab || 0,
			totalBlocked: totalBlocked || 0
		};
	};

	/**
	 * Update count of blocked requests
	 *
	 * @param tab - Tab
	 * @param blocked - count of blocked requests
	 * @returns  updated count of blocked requests
	 */
	var updateBlockedAdsCount = function (tab, blocked) {

		abu.pageStats.updateTotalBlocked(blocked);

		blocked = (abu.tabs.getTabMetadata(tab.tabId, 'blocked') || 0) + blocked;
		abu.tabs.updateTabMetadata(tab.tabId, {blocked: blocked});

		return blocked;
	};

	/**
	 * Reset count of blocked requests for tab or overall stats
	 * @param tab - Tab (optional)
	 */
	var resetBlockedAdsCount = function (tab) {
		if (tab) {
			abu.tabs.updateTabMetadata(tab.tabId, {blocked: 0});
		} else {
			abu.pageStats.resetStats();
		}
	};

	/**
	 * Is tab in incognito mode?
	 * @param tab Tab
	 */
	var isIncognitoTab = function (tab) {
		return abu.tabs.isIncognito(tab.tabId);
	};

	// Records frames on application initialization
	abu.listeners.addListener(function (event) {
		if (event === abu.listeners.APPLICATION_INITIALIZED) {
			abu.tabs.forEach(function (tab) {
				recordFrame(tab, 0, tab.url, abu.RequestTypes.DOCUMENT);
			});
		}
	});

	return {
		recordFrame,
		checkAndRecordMainFrame,
		getFrameUrl,
		getMainFrameUrl,
		getFrameDomain,
		isTabWhiteListed,
		isTabWhiteListedForSafebrowsing,
		isTabProtectionDisabled,
		getFrameWhiteListRule,
		reloadFrameData,
		recordFrameReferrerHeader,
		getFrameInfo,
		updateBlockedAdsCount,
		resetBlockedAdsCount,
		isIncognitoTab
	};

})(abu);