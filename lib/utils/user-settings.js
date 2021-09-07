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
 * Object that manages user settings.
 * @constructor
 */
abu.settings = (function (abu) {

    'use strict';

    var settings = {
        DISABLE_ANTI_CIRCUMVENTION: 'anti-circumvention-filter-disabled',
        DISABLE_DETECT_FILTERS: 'detect-filters-disabled',
        DISABLE_SHOW_PAGE_STATS: 'disable-show-page-statistic',
        DISABLE_FILTERING: 'abu-disabled',
        DISABLE_SHOW_CONTEXT_MENU: 'context-menu-disabled',
        ABU_DESKTOP_INSTALLED: 'abu-desktop-installed'
    };

    var properties = Object.create(null);
    var propertyUpdateChannel = abu.utils.channels.newChannel();

    /**
     * Lazy default properties
     */
    var defaultProperties = {
        get defaults() {
            return abu.lazyGet(this, 'defaults', function () {
                // Initialize default properties
                var defaults = Object.create(null);
                for (var name in settings) {
                    if (settings.hasOwnProperty(name)) {
                        defaults[settings[name]] = false;
                    }
                }
               
                defaults[settings.DISABLE_DETECT_FILTERS] = false;
                defaults[settings.DISABLE_ANTI_CIRCUMVENTION] = false;

                return defaults;
            });
        }
    };

    var getProperty = function (propertyName) {

        if (propertyName in properties) {
            return properties[propertyName];
        }
		
		/**
         * Don't cache values if LS not inited
         */
		if (!abu.localStorage.isInitialized()) {
            return defaultProperties.defaults[propertyName];
        }

        var propertyValue = null;

        if (abu.localStorage.hasItem(propertyName)) {
            try {
                propertyValue = JSON.parse(abu.localStorage.getItem(propertyName));
            } catch (ex) {
                abu.console.error('Error get property {0}, cause: {1}', propertyName, ex);
            }
        } else if (propertyName in defaultProperties.defaults) {
            propertyValue = defaultProperties.defaults[propertyName];
        }

        properties[propertyName] = propertyValue;

        return propertyValue;
    };

    var setProperty = function (propertyName, propertyValue) {
        abu.localStorage.setItem(propertyName, propertyValue);
        properties[propertyName] = propertyValue;
        propertyUpdateChannel.notify(propertyName, propertyValue);
    };

    var getAllSettings = function () {

        var result = {
            names: Object.create(null),
            values: Object.create(null)
        };

        for (var key in settings) {
            if (settings.hasOwnProperty(key)) {
                var setting = settings[key];
                result.names[key] = setting;
                result.values[setting] = getProperty(setting);
            }
        }

        return result;
    };

    /**
     * True if filtering is disabled globally.
     *
     * @returns {boolean} true if disabled
     */
    var isFilteringDisabled = function () {
        return getProperty(settings.DISABLE_FILTERING);
    };

    var changeFilteringDisabled = function (disabled) {
        setProperty(settings.DISABLE_FILTERING, disabled);
    };

    var isAutodetectFilters = function () {
        return !getProperty(settings.DISABLE_DETECT_FILTERS);
    };

    var changeAutodetectFilters = function (enabled) {
        setProperty(settings.DISABLE_DETECT_FILTERS, !enabled);
    };

    var showPageStatistic = function () {
        return !getProperty(settings.DISABLE_SHOW_PAGE_STATS);
    };

    var changeShowPageStatistic = function (enabled) {
        setProperty(settings.DISABLE_SHOW_PAGE_STATS, !enabled);
    };

    var showContextMenu = function () {
        return !getProperty(settings.DISABLE_SHOW_CONTEXT_MENU);
    };

    var changeShowContextMenu = function (enabled) {
        setProperty(settings.DISABLE_SHOW_CONTEXT_MENU, !enabled);
    };

    const changeAbuDesktopInstalled = (enabled) => {
        setProperty(settings.ABU_DESKTOP_INSTALLED, enabled);
    }

    const isAbuDesktopInstlled = () => {
        return getProperty(settings.ABU_DESKTOP_INSTALLED);
    }

    var api = {};

    // Expose settings to api
    for (var key in settings) {
        if (settings.hasOwnProperty(key)) {
            api[key] = settings[key];
        }
    }

    api.getProperty = getProperty;
    api.setProperty = setProperty;
    api.getAllSettings = getAllSettings;

    api.onUpdated = propertyUpdateChannel;

    api.isFilteringDisabled = isFilteringDisabled;
    api.changeFilteringDisabled = changeFilteringDisabled;
    api.isAutodetectFilters = isAutodetectFilters;
    api.changeAutodetectFilters = changeAutodetectFilters;
    api.showPageStatistic = showPageStatistic;
    api.changeShowPageStatistic = changeShowPageStatistic;
    api.showContextMenu = showContextMenu;
    api.changeShowContextMenu = changeShowContextMenu;
    api.changeAbuDesktopInstalled = changeAbuDesktopInstalled ;
    api.isAbuDesktopInstlled = isAbuDesktopInstlled;

    return api;

})(abu);
