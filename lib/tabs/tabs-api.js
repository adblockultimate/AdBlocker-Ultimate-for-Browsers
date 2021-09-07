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

    abu.windows = (function (windowsImpl) {

        var AdguardWin = { 
            windowId: 1,
            type: 'normal' // 'popup'
        };

        function noOpFunc() {
        }

        var adguardWindows = Object.create(null); // windowId => AdguardWin

        windowsImpl.forEachNative(function (nativeWin, adguardWin) {
            adguardWindows[adguardWin.windowId] = adguardWin;
        });

        var onCreatedChannel = abu.utils.channels.newChannel();
        var onRemovedChannel = abu.utils.channels.newChannel();

        windowsImpl.onCreated.addListener(function (adguardWin) {
            adguardWindows[adguardWin.windowId] = adguardWin;
            onCreatedChannel.notify(adguardWin);
        });

        windowsImpl.onRemoved.addListener(function (windowId) {
            var adguardWin = adguardWindows[windowId];
            if (adguardWin) {
                onRemovedChannel.notify(adguardWin);
                delete adguardWindows[windowId];
            }
        });

        var create = function (createData, callback) {
            windowsImpl.create(createData, callback || noOpFunc);
        };

        var getLastFocused = function (callback) {
            windowsImpl.getLastFocused(function (windowId) {
                var metadata = adguardWindows[windowId];
                if (metadata) {
                    callback(metadata[0]);
                }
            });
        };

        return {

            onCreated: onCreatedChannel,    // callback(adguardWin)
            onRemoved: onRemovedChannel,    // callback(adguardWin)

            create: create,
            getLastFocused: getLastFocused // callback (adguardWin)
        };

    })(abu.windowsImpl);

    abu.tabs = (function (tabsImpl) {

        function noOpFunc() {
        }

        var tabs = Object.create(null);

        /**
         * Saves tab to collection and notify listeners
         * @param aTab
         */
        function onTabCreated(aTab) {
            var tab = tabs[aTab.tabId];
            if (tab) {
                // Tab has been already synchronized
                return;
            }
            tabs[aTab.tabId] = aTab;
            onCreatedChannel.notify(aTab);
        }

        // Synchronize opened tabs
        tabsImpl.getAll(function (aTabs) {
            for (var i = 0; i < aTabs.length; i++) {
                var aTab = aTabs[i];
                tabs[aTab.tabId] = aTab;
            }
        });

        tabsImpl.onCreated.addListener(onTabCreated);

        tabsImpl.onRemoved.addListener(function (tabId) {
            var tab = tabs[tabId];
            if (tab) {
                onRemovedChannel.notify(tab);
                delete tabs[tabId];
            }
        });

        tabsImpl.onUpdated.addListener(function (aTab) {
            var tab = tabs[aTab.tabId];
            if (tab) {
                tab.url = aTab.url;
                tab.title = aTab.title;
                tab.status = aTab.status;
                onUpdatedChannel.notify(tab);
            }
        });

        tabsImpl.onActivated.addListener(function (tabId) {
            var tab = tabs[tabId];
            if (tab) {
                onActivatedChannel.notify(tab);
            }
        });

        // Fired when a tab is created. Note that the tab's URL may not be set at the time this event fired, but you can listen to onUpdated events to be notified when a URL is set.

        const onCreatedChannel = abu.utils.channels.newChannel();

        // Fired when a tab is closed.
        const onRemovedChannel = abu.utils.channels.newChannel();

        // Fired when a tab is updated.
        const onUpdatedChannel = abu.utils.channels.newChannel();

        // Fires when the active tab in a window changes.
        const onActivatedChannel = abu.utils.channels.newChannel();

        // --------- Actions ---------

        // Creates a new tab.
        var create = function (details, callback) {
            tabsImpl.create(details, callback || noOpFunc);
        };

        // Closes tab.
        var remove = function (tabId, callback) {
            tabsImpl.remove(tabId, callback || noOpFunc);
        };

        // Activates tab (Also makes tab's window in focus).
        var activate = function (tabId, callback) {
            tabsImpl.activate(tabId, callback || noOpFunc);
        };

        // Reloads tab.
        var reload = function (tabId, url) {
            tabsImpl.reload(tabId, url);
        };

        // Sends message to tab
        var sendMessage = function (tabId, message, responseCallback, options) {
            tabsImpl.sendMessage(tabId, message, responseCallback, options);
        };

        // Gets all opened tabs
        var getAll = function (callback) {
            tabsImpl.getAll(function (aTabs) {
                var result = [];
                for (var i = 0; i < aTabs.length; i++) {
                    var aTab = aTabs[i];
                    var tab = tabs[aTab.tabId];
                    if (!tab) {
                        // Synchronize state
                        tabs[aTab.tabId] = tab = aTab;
                    }
                    result.push(tab);
                }
                callback(result);
            });
        };

        var forEach = function (callback) {
            tabsImpl.getAll(function (aTabs) {
                for (var i = 0; i < aTabs.length; i++) {
                    var aTab = aTabs[i];
                    var tab = tabs[aTab.tabId];
                    if (!tab) {
                        // Synchronize state
                        tabs[aTab.tabId] = tab = aTab;
                    }
                    callback(tab);
                }
            });
        };

        // Gets active tab
        var getActive = function (callback) {
            tabsImpl.getActive(function (tabId) {
                var tab = tabs[tabId];
                if (tab) {
                    callback(tab);
                } else {
                    // Tab not found in the local state, but we are sure that this tab exists. Sync...
                    // TODO[Edge]: Relates to Edge Bug https://github.com/AdguardTeam/AdguardBrowserExtension/issues/481
                    tabsImpl.get(tabId, function (tab) {
                        onTabCreated(tab);
                        callback(tab);
                    });
                }
            });
        };

        var isIncognito = function (tabId) {
            var tab = tabs[tabId];
            return tab && tab.incognito === true;
        };

        // Records tab's frame
        const recordTabFrame = function (tabId, frameId, url, domainName) {
            var tab = tabs[tabId];
            if (!tab && frameId === 0) {
                // Sync tab for that 'onCreated' event was missed.
                // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/481
                tab = {
                    tabId: tabId,
                    url: url,
                    status: 'loading'
                };
                onTabCreated(tab);
            }
            if (tab) {
                if (!tab.frames) {
                    tab.frames = Object.create(null);
                }
                tab.frames[frameId] = {
                    url: url,
                    domainName: domainName
                };
            }
        };

        const clearTabFrames = function (tabId) {
            var tab = tabs[tabId];
            if (tab) {
                tab.frames = null;
            }
        };

        // Gets tab's frame by id
        const getTabFrame = function (tabId, frameId) {
            var tab = tabs[tabId];
            if (tab && tab.frames) {
                return tab.frames[frameId || 0];
            }
            return null;
        };

        /**
         * Checks if the tab is new tab for popup or not
         * May be false positive for FF at least because new tab url in FF is "about:blank" too
         * @param tabId
         * @returns {boolean}
         */
        const isNewPopupTab = (tabId) => {
            const tab = tabs[tabId];
            if (!tab) {
                return false;
            }
            return !!(tab.url === '' || tab.url === 'about:blank');
        };

        // Update tab metadata
        var updateTabMetadata = function (tabId, values) {
            var tab = tabs[tabId];
            if (tab) {
                if (!tab.metadata) {
                    tab.metadata = Object.create(null);
                }
                for (var key in values) {
                    if (values.hasOwnProperty && values.hasOwnProperty(key)) {
                        tab.metadata[key] = values[key];
                    }
                }
            }
        };

        // Gets tab metadata
        var getTabMetadata = function (tabId, key) {
            var tab = tabs[tabId];
            if (tab && tab.metadata) {
                return tab.metadata[key];
            }
            return null;
        };

        var clearTabMetadata = function (tabId) {
            var tab = tabs[tabId];
            if (tab) {
                tab.metadata = null;
            }
        };

        // Injecting resources to tabs
        const { insertCssCode } = tabsImpl;
        const { executeScriptCode } = tabsImpl;
        const { executeScriptFile } = tabsImpl;

        return {

            // Events
            onCreated: onCreatedChannel,
            onRemoved: onRemovedChannel,
            onUpdated: onUpdatedChannel,
            onActivated: onActivatedChannel,

            // Actions
            create,
            remove,
            activate,
            reload,
            sendMessage,
            getAll,
            forEach,
            getActive,
            isIncognito,

            // Frames
            recordTabFrame,
            clearTabFrames,
            getTabFrame,
            isNewPopupTab,

            // Other
            updateTabMetadata,
            getTabMetadata,
            clearTabMetadata,

            insertCssCode,
            executeScriptCode,
            executeScriptFile,
        };

    })(abu.tabsImpl);

})(abu);