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
 * Service that loads and parses filters metadata from backend server.
 * For now we just store filters metadata in an JSON file within the extension.
 * In future we'll add an opportunity to update metadata along with filter rules update.
 */
abu.subscriptions = (function (abu) {

    'use strict';

    const CUSTOM_FILTERS_GROUP_ID = 0;

    var groups = [];
    var filters = [];

    /**
     * @param timeUpdatedString String in format 'yyyy-MM-dd'T'HH:mm:ssZ'
     * @returns timestamp from date string
     */
    function parseTimeUpdated(timeUpdatedString) {
		if (Number.isInteger(timeUpdatedString)) {
            return new Date(timeUpdatedString);
        }

        // https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Date/parse
        var timeUpdated = Date.parse(timeUpdatedString);
        if (isNaN(timeUpdated)) {
            // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/478
            timeUpdated = Date.parse(timeUpdatedString.replace(/\+(\d{2})(\d{2})$/, "+$1:$2"));
        }
        if (isNaN(timeUpdated)) {
            timeUpdated = new Date().getTime();
        }
        return timeUpdated;
    }

    /**
     * Group metadata
     */
    var SubscriptionGroup = function (groupId, groupName, displayNumber) {
        this.groupId = groupId;
        this.groupName = groupName;
        this.displayNumber = displayNumber;
    };

    /**
     * Filter metadata
     */
    var SubscriptionFilter = function (filterId, groupId, name, description, homepage, version, timeUpdated, displayNumber, languages, expires, subscriptionUrl, enabled, installed) {
        this.filterId = filterId;
        this.groupId = groupId;
        this.name = name;
        this.description = description;
        this.homepage = homepage;
        this.version = version;
        this.timeUpdated = timeUpdated;
        this.displayNumber = displayNumber;
        this.languages = languages;
        this.expires = expires;
        this.subscriptionUrl = subscriptionUrl;
		this.enabled = enabled;
		this.installed = installed;
		this.isCustomFilter = (filterId >= CUSTOM_FILTERS_START_ID);
    };

    /**
     * Create group from object
     * @param group Object
     * @returns {SubscriptionGroup}
     */
    function createSubscriptionGroupFromJSON(group) {
        var groupId = group.groupId - 0;
        var defaultGroupName = abu.i18n.getMessage(`filter_group_${group.groupUid}`);
        var displayNumber = group.displayNumber - 0;

        return new SubscriptionGroup(groupId, defaultGroupName, displayNumber);
    }

    /**
     * Create filter from object
     * @param filter Object
     */
    const createSubscriptionFilterFromJSON = function (filter) {

        const filterId = filter.filterId - 0;
        const groupId = filter.groupId - 0;
        const name = abu.i18n.getMessage(`filter_name_${filter.filterUid}`);
        const description = abu.i18n.getMessage(`filter_description_${filter.filterUid}`);
        const homepage = filter.homepage;
        const version = filter.version;
        const timeUpdated = parseTimeUpdated(filter.timeUpdated);
        const expires = filter.expires - 0;
        const subscriptionUrl = filter.subscriptionUrl;
        const languages = filter.languages;
        const displayNumber = filter.displayNumber - 0;
		const enabled = (filter.enabled === true);

        return new SubscriptionFilter(filterId, groupId, name, description, homepage, version, timeUpdated, displayNumber, languages, expires, subscriptionUrl, enabled);
    };

	const parseExpiresStr = (str) => {
        const regexp = /(\d+)\s+(day|hour)/;

        const parseRes = str.match(regexp);

        if (!parseRes) {
            const parsed = Number.parseInt(str, 10);
            return Number.isNaN(parsed) ? 0 : parsed;
        }

        const [, num, period] = parseRes;

        let multiplier = 1;
        switch (period) {
            case 'day': {
                multiplier = 24 * 60 * 60;
                break;
            }
            case 'hour': {
                multiplier = 60 * 60;
                break;
            }
            default: {
                break;
            }
        }

        return num * multiplier;
    };


	 /**
     * Parses filter metadata from rules header
     *
     * @param rules
     * @returns object
     */
    const parseFilterDataFromHeader = (rules) => {
        const parseTag = (tagName) => {
            let result = '';

            // Look up no more than 50 first lines
            const maxLines = Math.min(50, rules.length);
            for (let i = 0; i < maxLines; i += 1) {
                const rule = rules[i];
                const search = `! ${tagName}: `;
                const indexOfSearch = rule.indexOf(search);
                if (indexOfSearch >= 0) {
                    result = rule.substring(indexOfSearch + search.length);
                }
            }

            if (tagName === 'Expires') {
                result = parseExpiresStr(result);
            }

            return result;
        };

        return {
            name: parseTag('Title'),
            description: parseTag('Description'),
            homepage: parseTag('Homepage'),
            version: parseTag('Version'),
            expires: parseTag('Expires'),
            timeUpdated: parseTag('TimeUpdated'),
        };
    };

	const CUSTOM_FILTERS_START_ID = 1000;

    const addFilterId = () => {
        let max = 0;
        filters.forEach((f) => {
            if (f.filterId > max) {
                max = f.filterId;
            }
        });

        return max >= CUSTOM_FILTERS_START_ID ? max + 1 : CUSTOM_FILTERS_START_ID;
    };

	const CUSTOM_FILTERS_JSON_KEY = 'custom_filters';

    /**
     * Loads custom filters from storage
     *
     * @returns {Array}
     */
    const loadCustomFilters = () => {
        const customFilters = abu.localStorage.getItem(CUSTOM_FILTERS_JSON_KEY);
        return customFilters ? JSON.parse(customFilters) : [];
    };

    /**
     * Saves custom filter to storage or updates it if filter with same id was found
     *
     * @param filter
     */
    const saveCustomFilterInStorage = (filter) => {
        const customFilters = loadCustomFilters();
        // check if filter exists
        let found = false;
        const updatedCustomFilters = customFilters.map((f) => {
            if (f.filterId === filter.filterId) {
                found = true;
                return filter;
            }
            return f;
        });
        if (!found) {
            updatedCustomFilters.push(filter);
        }
        abu.localStorage.setItem(CUSTOM_FILTERS_JSON_KEY, JSON.stringify(updatedCustomFilters));
    };

    /**
     * Remove custom filter data from storage
     *
     * @param filter
     */
    const removeCustomFilter = (filter) => {
		if (filter) {
            filters = filters.filter(f => f.filterId !== filter.filterId);
        }

        const customFilters = loadCustomFilters();
        const updatedCustomFilters = customFilters.filter((f) => {
            return (f.filterId !== filter.filterId);
        });

        abu.localStorage.setItem(CUSTOM_FILTERS_JSON_KEY, JSON.stringify(updatedCustomFilters));
    };

	/**
     * Compares filter version or filter checksum
     * @param newVersion
     * @param newChecksum
     * @param oldFilter
     * @returns {*}
     */
    function didFilterUpdate(newVersion, newChecksum, oldFilter) {
        if (newVersion) {
            return !abu.utils.browser.isGreaterOrEqualsVersion(oldFilter.version, newVersion);
        }
        if (!oldFilter.checksum) {
            return true;
        }
        return newChecksum !== oldFilter.checksum;
    }

    /**
     * Count md5 checksum for the filter content
     * @param {Array<String>} rules
     * @returns {String} checksum string
     */
    const getChecksum = (rules) => {
        const rulesText = rules.join('\n');
        return CryptoJS.MD5(rulesText).toString();
    };


	 /**
     * Updates filter checksum and version in the storage and internal structures
     * @param filter
     * @param {object} info
     */
    const updateCustomFilterInfo = (filter, info) => {
        const {
            checksum,
            version,
            timeUpdated,
            lastCheckTime,
            expires,
        } = info;
        // set last checksum and version
        filter.checksum = checksum || filter.checksum;
        filter.version = version || filter.version;
        filter.timeUpdated = timeUpdated || filter.timeUpdated;
        filter.lastCheckTime = lastCheckTime || filter.lastCheckTime;
        filter.expires = expires || filter.expires;

        filters = filters.map((f) => {
            if (f.filterId === filter.filterId) {
                f.version = version || f.version;
                f.checksum = checksum || f.checksum;
                f.timeUpdated = timeUpdated || f.timeUpdated;
                f.lastCheckTime = lastCheckTime || filter.lastCheckTime;
                f.expires = expires || filter.expires;
                return f;
            }
            return f;
        });
        saveCustomFilterInStorage(filter);
    };

    /**
     * Load groups and filters metadata
     *
     * @param successCallback
     * @param errorCallback
     * @private
     */
    function loadMetadata(successCallback, errorCallback) {

        abu.backend.loadLocalFiltersMetadata(function (metadata) {
            groups = [];
            filters = [];

            for (let i = 0; i < metadata.groups.length; i++) {
                groups.push(createSubscriptionGroupFromJSON(metadata.groups[i]));
            }

            for (let j = 0; j < metadata.filters.length; j++) {
                filters.push(createSubscriptionFilterFromJSON(metadata.filters[j]));
            }

			const customFilters = loadCustomFilters();

			customFilters.forEach((f) => {
				if(customFilters.removed === true) return;
				const customFilter = createSubscriptionFilterFromJSON(f);
				filters.push(customFilter);
			});

            abu.console.info('Filters metadata loaded');
            successCallback();

        }, errorCallback);
    }

    /**
     * Loads script rules from local file
     * @returns {exports.Promise}
     * @private
     */
    function loadLocalScriptRules(successCallback, errorCallback) {
        var localScriptRulesService = abu.rules.LocalScriptRulesService;

        if (typeof localScriptRulesService !== 'undefined') {
            abu.backend.loadLocalScriptRules(function (json) {
                localScriptRulesService.setLocalScriptRules(json);
                successCallback();
            }, errorCallback);
        } else {
            // LocalScriptRulesService may be undefined, in this case don't load local script rules
            successCallback();
        }
    }

    /**
     * Initialize subscription service, loading local filters metadata
     *
     * @param callback Called on operation success
     */
    var init = function (callback) {

        var errorCallback = function (request, cause) {
            abu.console.error('Error loading metadata, cause: {0} {1}', request.statusText, cause);
        };

        loadMetadata(function () {
            loadLocalScriptRules(callback, errorCallback);
        }, errorCallback);
    };

    /**
     * @returns Array of Filters metadata
     */
    var getFilters = function () {
        return filters;
    };

    /**
     * Gets filter metadata by filter identifier
     */
    var getFilterMetadata = function (filterId) {
        return filters.filter(function (f) {
            return f.filterId == filterId;
        })[0];
    };

    /**
     * @returns Array of Groups metadata
     */
    var getGroups = function () {
        return groups;
    };

	  /**
     * @returns Group metadata by given groupId
     */
	var getGroup = function (groupId) {
		return groups.filter(function (g) {
            return g.groupId == groupId;
        })[0];
	}

    /**
     * Gets list of filters for the specified languages
     *
     * @param lang Language to check
     * @returns List of filters identifiers
     */
    var getFilterIdsForLanguage = function (lang) {
        if (!lang) {
            return [];
        }
        lang = lang.substring(0, 2).toLowerCase();
        var filterIds = [];
        for (var i = 0; i < filters.length; i++) {
            var filter = filters[i];
            var languages = filter.languages;
            if (languages && languages.indexOf(lang) >= 0) {
                filterIds.push(filter.filterId);
            }
        }
        return filterIds;
    };


	/**
     * Adds or updates custom filter
     *
     * @param url subscriptionUrl
     * @param options
     * @param callback
     */
    const addUpdateCustomFilter = function (subscriptionUrl, callback) {

        abu.backend.loadFilterRulesBySubscriptionUrl(subscriptionUrl, (rules) => {
            const parsedData = parseFilterDataFromHeader(rules);

            let { timeUpdated } = parsedData;
            const {
				name,
                description,
                homepage,
                version,
                expires,
            } = parsedData;


            timeUpdated = timeUpdated || new Date().toISOString();
            const groupId = CUSTOM_FILTERS_GROUP_ID;
            const languages = [];
            const displayNumber = 0;
            const tags = [0];

            let checksum;
            if (!version) {
                checksum = getChecksum(rules);
            }

            // Check if filter from this url was added before
            let filter = filters.find(f => f.subscriptionUrl === subscriptionUrl);

            let updateFilter = true;
            if (filter) {
				if (!didFilterUpdate(version, checksum, filter)) {
                    callback();
                    updateCustomFilterInfo(filter, { lastCheckTime: Date.now() });
                    return;
                }
            } else {
                filter = new SubscriptionFilter(
                    addFilterId(),
                    groupId,
                    name,
                    description,
                    homepage,
                    version,
                    timeUpdated,
                    displayNumber,
                    languages,
                    expires,
                    subscriptionUrl,
					true
                );

                // filter.enabled = true;
                filters.push(filter);

                // Save filter in separate storage
                saveCustomFilterInStorage(filter);
                updateFilter = false;
            }

            if (updateFilter) {
                updateCustomFilterInfo(filter, {
                    version,
                    checksum,
                    timeUpdated,
                    expires,
                });
            }

			abu.listeners.notifyListeners(abu.listeners.SUCCESS_DOWNLOAD_FILTER, filter);
            abu.listeners.notifyListeners(abu.listeners.UPDATE_FILTER_RULES, filter, rules);

            updateCustomFilterInfo(filter, { lastCheckTime: Date.now() });

            callback(filter);
        }, (cause) => {
            abu.console.error(`Error download filter by url ${subscriptionUrl}, cause: ${cause || ''}`);
            callback();
        });
    };

    return {
        init,
        getFilterIdsForLanguage,
        getGroups,
        getGroup,
        getFilters,
        getFilterMetadata,
        createSubscriptionFilterFromJSON,
		addUpdateCustomFilter,
		removeCustomFilter,
		CUSTOM_FILTERS_GROUP_ID
    };

})(abu);

