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
 * Extension initialize logic. Called from start.js
 */
abu.initialize = function (initCallback) {
	initCallback = initCallback || function() {}

    function onLocalStorageLoaded() {
        abu.console.info('Starting ABU... Version: {0}. Id: {1}', abu.app.getVersion(), abu.app.getId());

        // Initialize popup button
        abu.browserAction.setPopup({
            popup: abu.getURL('pages/popup.html')
        });

        abu.whitelist.init();
        abu.ui.init();

        /**
         * Start application
         */
        abu.filters.start({
            onInstall: function (callback) {
                // Process installation
                // Retrieve filters and install them
                abu.filters.offerFilters(function (filterIds) {
                    abu.filters.addAndEnableFilters(filterIds, callback);
                });
            },
            onUpdate: function (runInfo, callback) {
                if (abu.utils.browser.isGreaterVersion("3.000", runInfo.prevVersion) ) {
                    abu.filters.offerFilters(function (filterIds) {
                        abu.filters.addAndEnableFilters(filterIds, callback);
                    });
                }
            }
        }, function () {
			
			initCallback();
        });
    }

    abu.localStorage.init(onLocalStorageLoaded);
};