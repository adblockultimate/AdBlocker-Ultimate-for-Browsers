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

abu.ui = (function (abu) { 

    var browserActionTitle = abu.i18n.getMessage('name');

    var contextMenuCallbackMappings = {
        'context_block_site_ads': function () {
            openAssistant();
        },
        'context_block_site_element': function () {
            openAssistant(true);
        },
        'context_abuse_site': function () {
            abu.tabs.getActive(function (tab) {
                openSiteReportTab(tab.url);
            });
        },
        'context_site_filtering_on': function () {
            abu.tabs.getActive(unWhiteListTab);
        },
        'context_site_filtering_off': function () {
            abu.tabs.getActive(whiteListTab);
        },
        'context_enable_protection': function () {
            changeFilteringDisabled(false);
        },
        'context_disable_protection': function () {
            changeFilteringDisabled(true);
        },
        'context_open_settings': function () {
            openSettingsTab();
        },
        'context_general_settings': function () {
            openSettingsTab('general-settings');
        },
        'context_antibanner': function () {
            openSettingsTab('antibanner');
        },
        'context_whitelist': function () {
            openSettingsTab('whitelist');
        },
        'context_userfilter': function () {
            openSettingsTab('userfilter');
        },
        'context_miscellaneous_settings': function () {
            openSettingsTab('miscellaneous-settings');
        },
        'context_update_antibanner_filters': function () {
            checkFiltersUpdates();
        }
    };

    var nextMenuId = 0;

	var extensionStoreLink = (function () {
        if (abu.utils.browser.isOperaBrowser()) {
            return 'https://addons.opera.com/en/extensions/details/adblock-ultimate';
        } else if (abu.utils.browser.isFirefoxBrowser()) {
			return 'https://addons.mozilla.org/en-US/firefox/addon/adblocker-ultimate';
        } else if (abu.utils.browser.isYaBrowser()) {
            return 'https://addons.opera.com/en/extensions/details/adblock-ultimate';
        } else if (abu.utils.browser.isEdgeChromiumBrowser()) {
            return 'https://microsoftedge.microsoft.com/addons/detail/pciakllldcajllepkbbihkmfkikheffb';
        } else {
            return 'https://chrome.google.com/webstore/detail/adblocker-ultimate/ohahllgiabjaoigichmmfljhkcfikeof';
        }
    })();

    const openShareSocialLink = (network, blockedCount) => {
        const shareURL = "https://adblockultimate.net/";
        let url = '';
        let params = {};
        switch(network) {
            case 'facebook':
                url = 'http://www.facebook.com/share.php';
                params['u'] = shareURL;
                break;
            case 'twitter':
                url =  'https://twitter.com/intent/tweet/';
                params['url'] = shareURL;
                params['via'] = "AdBlockUltimate";
                if(blockedCount > 0) {
                    params['text'] = `I blocked ${blockedCount} ads and trackers thanks to AdBlocker Ultimate.`;
                } else {
                    params['text'] = 'AdBlocker Ultimate - And all annoying ads are OUT!';
                }
                break;
        }
        let querystring = [];
        for (const key in params) {
            querystring.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));
        }
        url = url + "?" + querystring.join("&");
        openTab(url);
    }

    // Assistant

    var assistantOptions = null;

    /**
     * Returns localization map by passed message identifiers
     * @param ids Message identifiers
     */
    function getLocalization(ids) {
        var result = {};
        for (var id in ids) {
            if (ids.hasOwnProperty(id)) {
                var current = ids[id];
                result[current] = abu.i18n.getMessage(current);
            }
        }
        return result;
    }

    function getAssistantOptions() {
        if (assistantOptions !== null) {
            return assistantOptions;
        }
        assistantOptions = {
            cssLink: [
                abu.getURL('lib/content-script/assistant/css/select.css'),
                abu.getURL('lib/content-script/assistant/css/font-awesome.min.css')
            ],
            addRuleCallbackName: 'addUserRule'
        };
        var ids = [
            'assistant_select_element',
            'assistant_select_element_ext',
            'assistant_select_element_cancel',
            'assistant_block_element',
            'assistant_block_element_explain',
            'assistant_slider_explain',
            'assistant_slider_if_hide',
            'assistant_slider_min',
            'assistant_slider_max',
            'assistant_extended_settings',
            'assistant_apply_rule_to_all_sites',
            'assistant_block_by_reference',
            'assistant_block_similar',
            'assistant_block',
            'assistant_another_element',
            'assistant_preview',
            'assistant_preview_header',
            'assistant_preview_header_info',
            'assistant_preview_end',
            'assistant_preview_start'
        ];
        assistantOptions.localization = getLocalization(ids);
        return assistantOptions;
    }

    /**
     * Update icon for tab
     * @param tab Tab
     * @param options Options for icon or badge values
     */
    function updateTabIcon(tab, options) {

        try {
            var icon, badge;

            if (options) {

                icon = options.icon;
                badge = options.badge;

            } else {

                var blocked;
                var disabled;

                var tabInfo = abu.frames.getFrameInfo(tab);
               
			    disabled = tabInfo.applicationFilteringDisabled || tabInfo.urlFilteringDisabled || tabInfo.documentWhiteListed;

				if (!disabled && abu.settings.showPageStatistic()) {
					blocked = tabInfo.totalBlockedTab.toString();
				} else {
					blocked = "0";
				}
				
                badge = abu.utils.workaround.getBlockedCountText(blocked);

                if (disabled) {
                    icon = abu.prefs.ICONS.ICON_GRAY;
                } else {
                    icon = abu.prefs.ICONS.ICON_RED;
                }
            }

            abu.browserAction.setBrowserAction(tab, icon, badge, "#555", browserActionTitle);
        } catch (ex) {
            abu.console.error('Error while updating icon for tab {0}: {1}', tab.tabId, new Error(ex));
        }
    }

    var updateTabIconAsync = abu.utils.concurrent.debounce(function (tab) {
        updateTabIcon(tab);
    }, 250);

    /**
     * Update extension browser action popup window
     * @param tab - active tab
     */
    function updatePopupStats(tab) {
        if(abu.desktop.isAbuDesktopActive()) {
            return;
        }

        var tabInfo = abu.frames.getFrameInfo(tab);

        if (!tabInfo) {
            return;
        }

        const isFirefoxAboutPage = tabInfo.url.startsWith('about:');

        if (isFirefoxAboutPage) {
            return;
        }

        const sending = abu.runtimeImpl.sendMessage({
            type: 'updateTotalBlocked',
            tabInfo: tabInfo,
        });

        // Firefox spams errors, because it tries to send message to a closed popup. We "handle" the error, so it does not take up memory
        if (sending) {
            sending.catch(() => {})
        }
    }

    var updatePopupStatsAsync = abu.utils.concurrent.debounce(function (tab) {
        updatePopupStats(tab);
    }, 250);

    /**
     * Creates context menu item
     * @param title Title id
     * @param options Create options
     */
    function addMenu(title, options) {
        var createProperties = {
            contexts: ["all"],
            title: abu.i18n.getMessage(title)
        };
        if (options) {
            if (options.id) {
                createProperties.id = options.id;
            }
            if (options.parentId) {
                createProperties.parentId = options.parentId;
            }
            if (options.disabled) {
                createProperties.enabled = false;
            }
            if (options.messageArgs) {
                createProperties.title = abu.i18n.getMessage(title, options.messageArgs);
            }
            if (options.contexts) {
                createProperties.contexts = options.contexts;
            }
            if ('checkable' in options) {
                createProperties.checkable = options.checkable;
            }
            if ('checked' in options) {
                createProperties.checked = options.checked;
            }
        }
        var callback;
        if (options && options.action) {
            callback = contextMenuCallbackMappings[options.action];
        } else {
            callback = contextMenuCallbackMappings[title];
        }
        if (typeof callback === 'function') {
            createProperties.onclick = callback;
        }
        abu.contextMenus.create(createProperties);
    }

    function customizeContextMenu(tab) {

        function addSeparator() {
            abu.contextMenus.create({
                type: 'separator'
            });
        }

        function addSettingsSubMenu() {
            nextMenuId += 1;
            var menuId = 'abu-settings-context-menu-' + nextMenuId;
            addMenu('context_open_settings', {id: menuId});
            addMenu('context_general_settings', {parentId: menuId});
            addMenu('context_antibanner', {parentId: menuId});
            addMenu('context_whitelist', {parentId: menuId});
            addMenu('context_userfilter', {parentId: menuId});
            addMenu('context_miscellaneous_settings', {parentId: menuId});
        }

        var tabInfo = abu.frames.getFrameInfo(tab);

        if (tabInfo.applicationFilteringDisabled) {
            addMenu('context_abuse_site');
            addSettingsSubMenu();
            addMenu('context_open_settings');
        } else if (tabInfo.urlFilteringDisabled) {
            addMenu('context_open_settings');
            addMenu('context_update_antibanner_filters');
        } else {
            if (tabInfo.canAddRemoveRule) {
                if (tabInfo.documentWhiteListed) {
                    addMenu('context_site_filtering_on');
                } else {
                    addMenu('context_site_filtering_off');
                }
            }
            addSeparator();

            if (!tabInfo.documentWhiteListed) {
                addMenu('context_block_site_ads');
                //addMenu('context_block_site_element', {contexts: ["image", "video", "audio"]});
            }
            //addMenu('context_open_log');
            //addMenu('context_security_report');
            addSeparator();
            addMenu('context_abuse_site');
           
			addSeparator();
			addMenu('context_open_settings');
			//addSettingsSubMenu();
			addMenu('context_update_antibanner_filters');
			//addMenu('context_disable_protection');
           
        }
    }

    function customizeMobileContextMenu(tab) {

        var tabInfo = abu.frames.getFrameInfo(tab);

        if (tabInfo.applicationFilteringDisabled) {
            addMenu('popup_site_protection_disabled_android', {
                action: 'context_enable_protection',
                checked: true,
                checkable: true
            });
            addMenu('popup_open_log_android', {action: 'context_open_log'});
            addMenu('popup_open_settings', {action: 'context_open_settings'});
        } else if (tabInfo.urlFilteringDisabled) {
            addMenu('context_site_filtering_disabled');
            addMenu('popup_open_log_android', {action: 'context_open_log'});
            addMenu('popup_open_settings', {action: 'context_open_settings'});
            addMenu('context_update_antibanner_filters');
        } else {
            addMenu('popup_site_protection_disabled_android', {
                action: 'context_disable_protection',
                checked: false,
                checkable: true
            });
            if (tabInfo.documentWhiteListed && !tabInfo.userWhiteListed) {
                addMenu('popup_in_white_list_android');
            } else if (tabInfo.canAddRemoveRule) {
                if (tabInfo.documentWhiteListed) {
                    addMenu('popup_site_filtering_state', {
                        action: 'context_site_filtering_on',
                        checkable: true,
                        checked: false
                    });
                } else {
                    addMenu('popup_site_filtering_state', {
                        action: 'context_site_filtering_off',
                        checkable: true,
                        checked: true
                    });
                }
            }

            if (!tabInfo.documentWhiteListed) {
                addMenu('popup_block_site_ads_android', {action: 'context_block_site_ads'});
            }
            addMenu('popup_open_log_android', {action: 'context_open_log'});
            addMenu('popup_security_report_android', {action: 'context_security_report'});
            addMenu('popup_open_settings', {action: 'context_open_settings'});
            addMenu('context_update_antibanner_filters');
        }
    }

    /**
     * Update context menu for tab
     * @param tab Tab
     */
    function updateTabContextMenu(tab) {
        // No context menu on mobile
        if (abu.isAndroid) {
            return;
        }

        abu.contextMenus.removeAll();
        if (abu.settings.showContextMenu()) {
            if (abu.prefs.mobile) {
                customizeMobileContextMenu(tab);
            } else {
                customizeContextMenu(tab);
            }
            if (typeof abu.contextMenus.render === 'function') {
                // In some case we need to manually render context menu
                abu.contextMenus.render();
            }
        }
    }

    function closeAllPages() {
        abu.tabs.forEach(function (tab) {
            if (tab.url.indexOf(abu.getURL('')) >= 0) {
                abu.tabs.remove(tab.tabId);
            }
        });
    }

    function getPageUrl(page) {
        return abu.getURL('pages/' + page);
    }

    function showAlertMessagePopup(title, text) {
        abu.tabs.getActive(function (tab) {
            abu.tabs.sendMessage(tab.tabId, {
                type: 'show-alert-popup',
                title: title,
                text: text
            });
        });

        abu.tabs.getActive(function (tab) {
            abu.tabs.sendMessage(tab.tabId, {type: 'show-alert-popup', title: title, text: text});
        });
    }

    function getFiltersUpdateResultMessage(success, updatedFilters) {
        var title = abu.i18n.getMessage("options_popup_update_title");
        var text = [];
        if (success) {
            if (updatedFilters.length === 0) {
                text.push(abu.i18n.getMessage("options_popup_update_not_found"));
            } else {
                updatedFilters.sort(function (a, b) {
                    return a.displayNumber - b.displayNumber;
                });
                for (var i = 0; i < updatedFilters.length; i++) {
                    var filter = updatedFilters[i];
                    text.push(abu.i18n.getMessage("options_popup_update_updated", [filter.name, filter.version]).replace("$1", filter.name).replace("$2", filter.version));
                }
            }
        } else {
            text.push(abu.i18n.getMessage("options_popup_update_error"));
        }

        return {
            title: title,
            text: text
        };
    }

    function getFiltersEnabledResultMessage(enabledFilters) {
        var title = abu.i18n.getMessage("alert_popup_filter_enabled_title");
        var text = [];
        enabledFilters.sort(function (a, b) {
            return a.displayNumber - b.displayNumber;
        });
        for (var i = 0; i < enabledFilters.length; i++) {
            var filter = enabledFilters[i];
            text.push(abu.i18n.getMessage("alert_popup_filter_enabled_text", [filter.name]).replace("$1", filter.name));
        }
        return {
            title: title,
            text: text
        };
    }

    const updateTabIconAndContextMenu = (tab, reloadFrameData) => {
        if (reloadFrameData) {
            abu.frames.reloadFrameData(tab);
        }
        updateTabIcon(tab);
        updateTabContextMenu(tab);
        updatePopupStats(tab);
    };

    const openExportRulesTab = (whitelist) => {
        openTab(getPageUrl('export.html' + (whitelist ? '#wl' : '')));
    };

    const openSettingsTab = (anchor) => {
        const options = {
            activateSameTab: true,
            inNewWindow: false
        };
        openTab(getPageUrl('options.html') + (anchor ? '#' + anchor : ''), options);
    };

    const openSiteReportTab = (url) => {
        const domain = abu.utils.url.toPunyCode(url);
        if (domain) {
            openTab(`https://adblockultimate.net/report?url=${encodeURIComponent(domain)}&ref=e`);
        }
    };

    const openAfterInstallPage = () => {
        const url = 'https://adblockultimate.net/installed';
		openTab(url);
    };

    const openExtensionStore = () => {
        openTab(extensionStoreLink);
    };

    const rateWeb = () => {
        const url = 'https://adblockultimate.net/rate-extension';
        openTab(url);
    }

    const openUserPromotedPanel = (rank) => {
		const params = {
			'rank': rank,
			'baseUrl': abu.getURL('/pages/shield/'),
		}
		
		abu.tabs.getActive(function (tab){
			abu.tabs.sendMessage(tab.tabId, {
				type: 'initShield', 
				params: params
			});
		});
    };

    var whiteListTab = (tab) => {
        const tabInfo = abu.frames.getFrameInfo(tab);
        abu.whitelist.whiteListUrl(tabInfo.url);
        
        abu.desktop.syncExtToApp();
        
        updateTabIconAndContextMenu(tab, true);
        
        const TIMEOUT_MS = abu.desktop.isAbuDesktopActive() ? 2000 : 200;
    
        setTimeout(() => {
            abu.tabs.reload(tab.tabId);
        }, TIMEOUT_MS);
    };

    var unWhiteListTab = (tab) => {
        const tabInfo = abu.frames.getFrameInfo(tab);
        abu.userrules.unWhiteListFrame(tabInfo);

        updateTabIconAndContextMenu(tab, true);

        abu.desktop.syncExtToApp();

        const TIMEOUT_MS = abu.desktop.isAbuDesktopActive() ? 2000 : 200;

        setTimeout(() => {
            abu.tabs.reload(tab.tabId);
        }, TIMEOUT_MS);
    };

    var changeFilteringDisabled = (disabled) => {
        abu.settings.changeFilteringDisabled(disabled);
        abu.tabs.getActive(function (tab) {
            updateTabIconAndContextMenu(tab, true);
        });
    };

    const checkFiltersUpdates = (filters, showAlert = true) => {
		let successCallback, errorCallback;
		
		if(showAlert) {
			const showPopupEvent = abu.listeners.UPDATE_FILTERS_SHOW_POPUP;
			successCallback = (updatedFilters) => {
                abu.listeners.notifyListeners(showPopupEvent, true, updatedFilters);
            } 
			errorCallback = () => {
                abu.listeners.notifyListeners(showPopupEvent, false);
            }
		} else {
			successCallback = (updatedFilters) => {
                if (updatedFilters && updatedFilters.length > 0) {
                    const updatedFilterStr = updatedFilters.map(f => `Filter ID: ${f.filterId}`).join(', ');
                    abu.console.info(`Filters were auto updated: ${updatedFilterStr}`);
                }
            };
			errorCallback = () => {};
		}
	
        if (filters) {
            abu.filters.checkFiltersUpdates(successCallback, errorCallback, filters);
        } else {
            abu.filters.checkFiltersUpdates(successCallback, errorCallback);
        }
    };

    var openAssistant = function (selectElement) {

        var options = getAssistantOptions();
        options.selectElement = selectElement;

        abu.tabs.getActive(function (tab) {
            abu.tabs.sendMessage(tab.tabId, {
                type: 'initAssistant',
                options: options
            });
        });
    };

    var openTab = function (url, options, callback) {
		const {
            activateSameTab,
            inBackground,
            inNewWindow,
            type
        } = options || {};

        function onTabFound(tab) {
            if (tab.url !== url) {
                abu.tabs.reload(tab.tabId, url);
            }
            if (!inBackground) {
                abu.tabs.activate(tab.tabId);
            }
            if (callback) {
                callback(tab);
            }
        }

        url = abu.utils.strings.contains(url, '://') ? url : abu.getURL(url);
        abu.tabs.getAll(function (tabs) {
            // try to find between opened tabs
            if (activateSameTab) {
                for (let i = 0; i < tabs.length; i += 1) {
                    let tab = tabs[i];
                    if (abu.utils.url.urlEquals(tab.url, url)) {
                        onTabFound(tab);
                        return;
                    }
                }
            }
            abu.tabs.create({
                url: url,
                type: type || 'normal',
                active: !inBackground,
                inNewWindow: inNewWindow,
            }, callback);
        });
    };

    const init = () => {
        //update icon on event received
        abu.listeners.addListener(function (event, tab, reset) {

            if (event !== abu.listeners.UPDATE_TAB_BUTTON_STATE || !tab) {
                return;
            }

            var options;
            if (reset) {
                options = {icon: abu.prefs.ICONS.ICON_GRAY, badge: ''};
            }

            updateTabIcon(tab, options);
        });
    }

    // Update icon on ads blocked
    abu.listeners.addListener(function (event, rule, tab, blocked) {

        if (event !== abu.listeners.ADS_BLOCKED || !tab) {
            return;
        }

        var tabBlocked = abu.frames.updateBlockedAdsCount(tab, blocked);
        if (tabBlocked === null) {
            return;
        }
        updateTabIconAsync(tab);

        abu.tabs.getActive(function (activeTab) {
            if (tab.tabId === activeTab.tabId) {
                updatePopupStatsAsync(activeTab);
            }
        });
    });

    // Update context menu on change user settings
    abu.settings.onUpdated.addListener(function (setting) {
        if (setting === abu.settings.DISABLE_SHOW_CONTEXT_MENU) {
            abu.tabs.getActive(function (tab) {
                updateTabContextMenu(tab);
            });
        }
    });

    // Update tab icon and context menu while loading
    abu.tabs.onUpdated.addListener(function (tab) {
        var tabId = tab.tabId;
        // BrowserAction is set separately for each tab
        updateTabIcon(tab);
        abu.tabs.getActive(function (aTab) {
            if (aTab.tabId !== tabId) {
                return;
            }
            // ContextMenu is set for all tabs, so update it only for current tab
            updateTabContextMenu(aTab);
        });
    });
	
    // Update tab icon and context menu on active tab changed
    abu.tabs.onActivated.addListener(function (tab) {
        updateTabIconAndContextMenu(tab, true);
    });
	
    // Update tab icon and context menu on application initialization
    abu.listeners.addListener(function (event) {
        if (event === abu.listeners.APPLICATION_INITIALIZED) {
            abu.tabs.getActive(updateTabIconAndContextMenu);
        }
    });

    //on filter auto-enabled event
    abu.listeners.addListener(function (event, enabledFilters) {
        if (event === abu.listeners.ENABLE_FILTER_SHOW_POPUP) {
            var result = getFiltersEnabledResultMessage(enabledFilters);
            showAlertMessagePopup(result.title, result.text);
        }
    });
	
	// on filter enabled event
    abu.listeners.addListener((event, data) => {
        switch (event) {
            case abu.listeners.FILTER_ENABLE_DISABLE:
                if (data.enabled) {
                    checkFiltersUpdates([data], false);
                }
                break;
            default:
                break;
        }
    });

    //on filters updated event
    abu.listeners.addListener(function (event, success, updatedFilters) {
        if (event === abu.listeners.UPDATE_FILTERS_SHOW_POPUP) {
            var result = getFiltersUpdateResultMessage(success, updatedFilters);
            showAlertMessagePopup(result.title, result.text);
        }
    });

    //close all page on unload
    abu.unload.when(closeAllPages);

    return {
        init,
        openUserPromotedPanel,
        openExportRulesTab,
        openSettingsTab,
        openSiteReportTab,
        openAfterInstallPage,
        openExtensionStore,
        rateWeb,
        openShareSocialLink,

        updateTabIconAndContextMenu,

        whiteListTab,
        unWhiteListTab,

        changeFilteringDisabled,
        checkFiltersUpdates,
        openAssistant,
        openTab,

        showAlertMessagePopup
    };

})(abu);
