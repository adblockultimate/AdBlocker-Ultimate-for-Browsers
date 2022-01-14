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
 * Creating service that manages our filter rules.
 */
abu.antiBannerService = (function (abu) {

    /**
     * Represents filter metadata
     *
     * @param filterId Filter identifier
     * @constructor
     */
    var ABUFilter = function (filterId) {
        this.filterId = filterId;
        this.groupId = null;
        this.name = null;
        this.description = null;
        this.version = null;
        this.lastUpdateTime = null;
        this.lastCheckTime = null;
        this.enabled = false;
        this.manualDisabled = false;
    };

    // List of filters
    var abuFilters = [];

    // Request filter contains all filter rules
    // This class does the actual filtering (checking URLs, constructing CSS/JS to inject, etc)
    var requestFilter = new abu.RequestFilter();

    // Service is not initialized yet
    var requestFilterInitTime = 0;

    // Application is running flag
    var applicationRunning = false;

    // Application initialized flag (Sets on first call of 'start' method)
    var applicationInitialized = false;

    /**
     * Period for filters update check -- 4 hours
     */
    var UPDATE_FILTERS_PERIOD = 4 * 60 * 60 * 1000;

    /**
     * Delay before doing first filters update check -- 10 seconds
     */
    const UPDATE_FILTERS_DELAY = 10 * 1000;

    const FILTERS_CHANGE_DEBOUNCE_PERIOD = 1000;
    const RELOAD_FILTERS_DEBOUNCE_PERIOD = 1000;

    /**
     * List of events which cause RequestFilter re-creation
     * @type {Array}
     */
    const UPDATE_REQUEST_FILTER_EVENTS = [
		abu.listeners.UPDATE_FILTER_RULES, 
		abu.listeners.FILTER_ENABLE_DISABLE,
		abu.listeners.FILTER_GROUP_ENABLE_DISABLE
	];

    const isUpdateRequestFilterEvent = function (el) {
        return UPDATE_REQUEST_FILTER_EVENTS.indexOf(el.event) >= 0;
    };

    /**
     * List of events which cause saving filter rules to the rules storage
     * @type {Array}
     */
    const SAVE_FILTER_RULES_TO_STORAGE_EVENTS = [abu.listeners.UPDATE_FILTER_RULES, abu.listeners.ADD_RULES, abu.listeners.REMOVE_RULE];

    const isSaveRulesToStorageEvent = function (el) {
        return SAVE_FILTER_RULES_TO_STORAGE_EVENTS.indexOf(el.event) >= 0;
    };

    /**
     * Persist state of content blocker
     */
    var contentBlockerInfo = {
        rulesCount: 0,
        rulesOverLimit: false
    };

    var reloadedRules = false;

    /**
     * AntiBannerService initialize method. Process install, update or simple run.
     * @param options Constructor options
     * @param callback
     */
    function initialize(options, callback) {

        /**
         * This method is called when filter subscriptions have been loaded from remote server.
         * It is used to recreate RequestFilter object.
         */
        var initRequestFilter = function () {
            loadFiltersVersionAndStateInfo();
			loadGroupsStateInfo();
            createRequestFilter(function () {
                addFiltersChangeEventListener();
                callback();
            });
        };

        /**
         * Callback for subscriptions loaded event
         */
        const onSubscriptionLoaded = function (runInfo) {
            // Initialize filters list
            abuFilters = getAllFilters();

            // Subscribe to events which lead to update filters (e.g. switсh to optimized and back to default)
            subscribeToFiltersChangeEvents();

            if (runInfo.isFirstRun) {
                // Add event listener for filters change
                addFiltersChangeEventListener();
                // Run callback
                // Request filter will be initialized during install
                if (typeof options.onInstall === 'function') {
                    options.onInstall(callback);
                } else {
                    callback();
                }
            } else if (runInfo.isUpdate) {
                if (typeof options.onUpdate === 'function') {
                    options.onUpdate(runInfo, callback);
                } 
                // Updating storage schema on extension update (if needed)
                abu.applicationUpdateService.onUpdate(runInfo, initRequestFilter);
            } else {
                // Init RequestFilter object
                initRequestFilter();
            }

            // Schedule filters update job
            scheduleFiltersUpdate(runInfo.isFirstRun);
        };

        /**
         * Init extension common info.
         */
        abu.applicationUpdateService.getRunInfo(function (runInfo) {
            // Load subscription from the storage
            abu.subscriptions.init(onSubscriptionLoaded.bind(null, runInfo));
        });
    }

    /**
     * Initialize application (process install or update) . Create and start request filter
     * @param options
     * @param callback
     */
    var start = function (options, callback) {

        if (applicationRunning === true) {
            callback();
            return;
        }
        applicationRunning = true;

        if (!applicationInitialized) {
            initialize(options, callback);
            applicationInitialized = true;
            return;
        }

        createRequestFilter(callback);
    };

    /**
     * Clear request filter
     */
    var stop = function () {
        applicationRunning = false;
        requestFilter = new abu.RequestFilter();
        abu.listeners.notifyListeners(abu.listeners.REQUEST_FILTER_UPDATED, getRequestFilterInfo());
    };

    /**
     * Checks application has been initialized
     * @returns {boolean}
     */
    var isInitialized = function () {
        return applicationInitialized;
    };

    /**
     * Getter for request filter
     */
    var getRequestFilter = function () {
        return requestFilter;
    };

    /**
     * Loads filter from storage (if in extension package) or from backend
     *
     * @param filterId Filter identifier
     * @param callback Called when operation is finished
     */
    const addAntiBannerFilter = function (filterId, callback) {
        const filter = getFilterById(filterId);
		
        if (filter.installed) {
            callback(true);
            return;
        }
		
		
        const onFilterLoaded = function (success) {
            if (success) {
                filter.installed = true;
                abu.listeners.notifyListeners(abu.listeners.FILTER_ADD_REMOVE, filter);
            }
            callback(success);
        };

        if (filter.loaded) {
            onFilterLoaded(true);
            return;
        }

        const filterMetadata = abu.subscriptions.getFilterMetadata(filterId);
        loadFilterRules(filterMetadata, false, onFilterLoaded);
    };

    /**
     * Reloads filters from backend
     *
     * @param successCallback
     * @param errorCallback
     * @private
     */
    function reloadAntiBannerFilters(successCallback, errorCallback) {
        resetFiltersVersion();
        checkAntiBannerFiltersUpdate(true, successCallback, errorCallback);
    }

    /**
     * Select filters for update. It depends on the time of last update.
     * @param forceUpdate Force update flag.
	 * @param filtersToUpdate Optional array of filters
     * @returns {Array}
     */
    function selectFilterIdsToUpdate(forceUpdate, filtersToUpdate) {
		const filterIds = [];
        const customFilterIds = [];
        const filters = filtersToUpdate || abuFilters;

		const needUpdate = (filter) => {
			if(forceUpdate) return true;
            const { lastCheckTime } = filter;

            if (!lastCheckTime) return true;

            return lastCheckTime + UPDATE_FILTERS_PERIOD <= Date.now();
        };
		
		for (let i = 0; i < filters.length; i += 1) {
            const filter = filters[i];
			if(filter.filterId == abu.utils.filters.USER_FILTER_ID || filter.filterId == abu.utils.filters.WHITE_LIST_FILTER_ID) continue;
           
			if (filter.installed && filter.enabled) {
                if (needUpdate(filter)) {
                    if (filter.isCustomFilter) {
                        customFilterIds.push(filter.filterId);
                    } else {
                        filterIds.push(filter.filterId);
                    }
                }
            }
        }

        return {
            filterIds,
            customFilterIds,
        };
    }

    /**
     * Checks filters updates.
     *
     * @param forceUpdate Normally we respect filter update period. But if this parameter is
     *                    true - we ignore it and check updates for all filters.
     * @param successCallback Called if filters were updated successfully
     * @param errorCallback Called if something gone wrong
	 * @param filters     Optional Array of filters to update
     */
    const checkAntiBannerFiltersUpdate = (forceUpdate, successCallback, errorCallback, filters) => {
		successCallback = successCallback || function () {};	// Empty callback
        errorCallback = errorCallback || function () {};

        // Don't update in background if request filter isn't running
        if (!forceUpdate && !applicationRunning) {
            return;
        }

        abu.console.info("Start checking filters updates");

        // Select filters for update
		const toUpdate = selectFilterIdsToUpdate(forceUpdate, filters);
        const filterIdsToUpdate = toUpdate.filterIds;
        const customFilterIdsToUpdate = toUpdate.customFilterIds;
		
        if (filterIdsToUpdate.length === 0 && customFilterIdsToUpdate.length === 0) {
			abu.console.info("No filters for update found");
            if (successCallback) {
                successCallback([]);
                return;
            }
        }
        abu.console.info("Checking updates for {0} filters", filterIdsToUpdate.length);

        // Load filters with changed version
        const loadFiltersFromBackendCallback = function (filterMetadataList) {
            loadFiltersFromBackend(filterMetadataList, function (success, filterIds) {
                if (success) {
                    var filters = [];
                    for (var i = 0; i < filterIds.length; i++) {
                        var filterId = filterIds[i];
						filters.push(getFilterById(filterId));
                    }
					updateCustomFilters(customFilterIdsToUpdate, (customFilters) => {
                        successCallback(filters.concat(customFilters));
                    });
					
                } else {
                    errorCallback();
                }
            });
        };

        // Method is called after we have got server response
        // Now we check filters version and update filter if needed	
		let attempts = 0;
        const onLoadFilterMetadataList = function (sucess, filterMetadataList) {
            if (sucess) {
                var filterMetadataListToUpdate = [];
                for (var i = 0; i < filterMetadataList.length; i++) {
                    var filterMetadata = filterMetadataList[i];
                    var filter = getFilterById(filterMetadata.filterId);
                    if (filterMetadata.version !== null && abu.utils.browser.isGreaterVersion(filterMetadata.version, filter.version)) {
                        abu.console.info("Updating filter {0} to version {1}", filter.filterId, filterMetadata.version);
                        
                        mergeBackendMetadata(filterMetadata, filter);

                        filterMetadataListToUpdate.push(filterMetadata);
                    } else {
						filter.lastCheckTime = Date.now();
						abu.listeners.notifyListeners(abu.listeners.SUCCESS_DOWNLOAD_FILTER, filter);
					}
                }
                loadFiltersFromBackendCallback(filterMetadataListToUpdate);
            } else {
				if(attempts++ >= 10) {
					errorCallback();
				} else {
					//retry to update filters if error from backend
					setTimeout(() => {
						abu.console.info("Retrying to update filters from backend attempt {0}", attempts);
						loadFiltersMetadataFromBackend(filterIdsToUpdate, onLoadFilterMetadataList);
					}, 60000);	//1 minute
				}
            }
        };
        // Retrieve current filters metadata for update
        loadFiltersMetadataFromBackend(filterIdsToUpdate, onLoadFilterMetadataList);
    };
	
	/**
     * Update filters with custom urls
     *
     * @param customFilterIds
     * @param callback
     */
    function updateCustomFilters(customFilterIds, callback) {
        if (customFilterIds.length === 0) {
            callback([]);
            return;
        }

        const promises = customFilterIds.map(filterId => new Promise((resolve) => {
            const filter = getFilterById(filterId);

            const onUpdate = (updatedFilterId) => {
                if (updatedFilterId) {
                    return resolve(filter);
                }
                return resolve();
            };
            abu.subscriptions.addUpdateCustomFilter(filter.subscriptionUrl, onUpdate);
        }));

        Promise.all(promises).then((filters) => {
            const updatedFilters = filters.filter(f => f);
            if (updatedFilters.length > 0) {
                const filterIdsString = updatedFilters.map(f => f.filterId).join(', ');
                abu.console.info(`Updated custom filters with ids: ${filterIdsString}`);
            }

            callback(updatedFilters);
        });
    }
	
	 /**
     * Updates groups state info
     * Loads state info from the storage and then updates abu.subscription.groups properly
     * @private
     */
    function loadGroupsStateInfo() {
        // Load filters state from the storage
        const groupsStateInfo = abu.filtersState.getGroupsState();

        const groups = abu.subscriptions.getGroups();

        for (let i = 0; i < groups.length; i += 1) {
            const group = groups[i];
            const { groupId } = group;
            const stateInfo = groupsStateInfo[groupId];
            if (stateInfo) {
                group.enabled = stateInfo.enabled;
            }
        }
    }

    /**
     * Creates abu filter object
     * @param filterMetadata Filter metadata
     * @returns {ABUFilter}
     */
    function createFilter(filterMetadata) {
        var filter = new ABUFilter(filterMetadata.filterId);
        filter.groupId = filterMetadata.groupId || 0;
        filter.name = filterMetadata.name || '';
        filter.description = filterMetadata.description || '';
        filter.displayNumber = filterMetadata.displayNumber || 0;
        filter.subscriptionUrl = filterMetadata.subscriptionUrl || '';
        if(filter.lastUpdateTime == undefined) filter.lastUpdateTime = filterMetadata.timeUpdated;
        if(filter.version == undefined) filter.version = filterMetadata.version;
		filter.isCustomFilter = filterMetadata.isCustomFilter;
        return filter;
    }

    /**
     * Returns all filters with their metadata
     * @private
     */
    function getAllFilters() {
		var filters = [];
        var filtersMetadata = abu.subscriptions.getFilters();

        for (var i = 0; i < filtersMetadata.length; i++) {
            var filterMetadata = filtersMetadata[i];
            filters.push(createFilter(filterMetadata));
        }
        // Add synthetic user and whitelist filters
        filters.push(createFilter({filterId: abu.utils.filters.USER_FILTER_ID}));
        filters.push(createFilter({filterId: abu.utils.filters.WHITE_LIST_FILTER_ID}));

        filters.sort(function (f1, f2) {
            return f1.displayNumber - f2.displayNumber;
        });
		
        return filters;
    }

    // replace subscriptionUrl if changed in backend
    function mergeBackendMetadata(filtersMetadata, filter) {
        if(filter.subscriptionUrl == filtersMetadata.subscriptionUrl) {
            return false;
        }
        removeAbuFilter(filter);
        filter.subscriptionUrl = filtersMetadata.subscriptionUrl;
        addAbuFilters(filter);
    }

    /**
     * Updates filters version and state info.
     * Loads this data from the storage and then updates "abuFilters" property of the AntiBannerService instance.
     *
     * @private
     */
    function loadFiltersVersionAndStateInfo() {
        // Load filters metadata from the storage
        const filtersVersionInfo = abu.filtersState.getFiltersVersion();
        const filtersStateInfo = abu.filtersState.getFiltersState();
        const filtersNames = abu.filtersState.getFiltersNames();

        const filters = abuFilters; //abu.subscriptions.getFilters();

        for (let i = 0; i < filters.length; i += 1) {
            const filter = filters[i];
            const { filterId } = filter;
            const versionInfo = filtersVersionInfo[filterId];
            const stateInfo = filtersStateInfo[filterId];
            const name = filtersNames[filterId]

            if (versionInfo) {
                filter.version = versionInfo.version;
                filter.lastCheckTime = versionInfo.lastCheckTime;
                filter.lastUpdateTime = versionInfo.lastUpdateTime;
                if (versionInfo.expires) {
                    filter.expires = versionInfo.expires;
                }
            }
            if (stateInfo) {
                filter.enabled = stateInfo.enabled;
                filter.installed = stateInfo.installed;
                filter.loaded = stateInfo.loaded;
                filter.manualDisabled = stateInfo.manualDisabled || false;
            }
            if (name) {
                filter.name = name;
            }
        }
    }

    /**
     * Called when filters were loaded from the storage
     *
     * @param rulesFilterMap Map for populating rules (filterId -> rules collection)
     * @param callback Called when request filter is initialized
     */
    function onFiltersLoadedFromStorage(rulesFilterMap, callback) {

        var start = new Date().getTime();

        // We create filter rules using chunks of the specified length
        // We are doing this for FF as everything in FF is done on the UI thread
        // Request filter creation is rather slow operation so we should
        // use setTimeout calls to give UI thread some time.
        var async = abu.requestFilter.isReady();
        var asyncStep = 1000;
        abu.console.info('Starting request filter initialization. Async={0}', async);

        // Empty request filter
        var newRequestFilter = new abu.RequestFilter();

        if (requestFilterInitTime === 0) {
            // Setting the time of request filter very first initialization
            requestFilterInitTime = new Date().getTime();
            abu.listeners.notifyListeners(abu.listeners.APPLICATION_INITIALIZED);
        }

        // Supplement object to make sure that we use only unique filter rules
        var uniqueRules = Object.create(null);

        /**
         * Checks rulesFilterMap is empty (no one of filters are enabled)
         * @param rulesFilterMap
         * @returns {boolean}
         */
        function isEmptyRulesFilterMap(rulesFilterMap) {

            var enabledFilterIds = Object.keys(rulesFilterMap);
            if (enabledFilterIds.length === 0) {
                return true;
            }

            // User filter is enabled by default, but it may not contain any rules
            var userFilterId = abu.utils.filters.USER_FILTER_ID;
            if (enabledFilterIds.length === 1 && enabledFilterIds[0] == userFilterId) {
                var userRules = rulesFilterMap[userFilterId];
                if (!userRules || userRules.length === 0) {
                    return true;
                }
            }

            return false;
        }

        /**
         * STEP 3: Called when request filter has been filled with rules.
         * This is the last step of request filter initialization.
         */
        var requestFilterInitialized = function () {

            // Request filter is ready
            requestFilter = newRequestFilter;

            if (callback && typeof callback === "function") {
                callback();
            }

            abu.listeners.notifyListeners(abu.listeners.REQUEST_FILTER_UPDATED, getRequestFilterInfo());
            abu.console.info("Finished request filter initialization in {0} ms. Rules count: {1}", (new Date().getTime() - start), newRequestFilter.rulesCount);
        };

        /**
         * Supplement function for adding rules to the request filter
         *
         * @param filterId Filter identifier
         * @param rulesTexts Array with filter rules
         * @param startIdx Start index of the rules array
         * @param endIdx End index of the rules array
         */
        var addRules = function (filterId, rulesTexts, startIdx, endIdx) {
            if (!rulesTexts) {
                return;
            }

            for (var i = startIdx; i < rulesTexts.length && i < endIdx; i++) {
                var ruleText = rulesTexts[i];
                if (ruleText in uniqueRules) {
                    // Do not allow duplicates
                    continue;
                }
                uniqueRules[ruleText] = true;
                var rule = abu.rules.builder.createRule(ruleText, filterId);

                if (rule !== null) {
					const addToCounter = (filterId != abu.utils.filters.ANTI_CIRCUMVENTION);
                    newRequestFilter.addRule(rule, addToCounter);
                }
            }
        };

        /**
         * Asyncronously adds rules to the request filter.
         */
        var addRulesAsync = function (filterId, rulesTexts, startIdx, stopIdx, prevDfd) {

            var dfd = new abu.utils.Promise();

            prevDfd.then(function () {
                setTimeout(function () {
                    addRules(filterId, rulesTexts, startIdx, stopIdx);
                    dfd.resolve();
                }, 1);
            });

            return dfd;
        };

        /**
         * Asynchronously fills request filter with rules.
         */
        var fillRequestFilterAsync = function () {
            // Async loading starts when we resolve this promise
            var rootDfd = new abu.utils.Promise();
            var prevDfd = null;
            var dfds = [];

            // Go through all filters in the map
            for (var filterId in rulesFilterMap) { 
                // To number
                filterId = filterId - 0;
                if (filterId != abu.utils.filters.USER_FILTER_ID) {
                    var rulesTexts = rulesFilterMap[filterId];

                    for (var i = 0; i < rulesTexts.length; i += asyncStep) {
                        prevDfd = addRulesAsync(filterId, rulesTexts, i, i + asyncStep, prevDfd || rootDfd);
                        dfds.push(prevDfd);
                    }
                }
            }

            // User filter should be the last
            // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/117
            var userRules = rulesFilterMap[abu.utils.filters.USER_FILTER_ID];
            addRulesAsync(abu.utils.filters.USER_FILTER_ID, userRules, 0, userRules.length, prevDfd || rootDfd);

            abu.utils.Promise.all(dfds).then(function () {
                requestFilterInitialized();
            });

            // Start execution
            rootDfd.resolve();
        };

        /**
         * Synchronously fills request filter with rules
         */
        var fillRequestFilterSync = function () {

            // Go through all filters in the map
            for (var filterId in rulesFilterMap) { 

                // To number
                filterId = filterId - 0;
                if (filterId != abu.utils.filters.USER_FILTER_ID) {
                    var rulesTexts = rulesFilterMap[filterId];
                    addRules(filterId, rulesTexts, 0, rulesTexts.length);
                }
            }

            // User filter should be the last
            // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/117
            var userRules = rulesFilterMap[abu.utils.filters.USER_FILTER_ID];
            addRules(abu.utils.filters.USER_FILTER_ID, userRules, 0, userRules.length);
            requestFilterInitialized();
        };

        if (async) {
            fillRequestFilterAsync();
        } else {
            fillRequestFilterSync();
        }
    }

    /**
     * Create new request filter and add distinct rules from the storage.
     *
     * @param callback Called after request filter has been created
     * @private
     */
    function createRequestFilter(callback) {
        if (applicationRunning === false) {
            if (typeof callback === 'function') {
                callback();
            }
            return;
        }

        var start = new Date().getTime();
        abu.console.info('Starting loading filter rules from the storage');

        // Prepare map for filter rules
        // Map key is filter ID
        // Map value is array with filter rules
        var rulesFilterMap = Object.create(null);

        /**
         * STEP 2: Called when all filter rules have been loaded from storage
         */
        var loadAllFilterRulesDone = function () {
            abu.console.info('Finished loading filter rules from the storage in {0} ms', (new Date().getTime() - start));
            onFiltersLoadedFromStorage(rulesFilterMap, callback);
        };

        /**
         * Loads filter rules from storage
         *
         * @param filterId Filter identifier
         * @param rulesFilterMap Map for loading rules
         * @returns {*} Deferred object
         */
        var loadFilterRulesFromStorage = function (filterId, rulesFilterMap) {
            var dfd = new abu.utils.Promise();

            abu.rulesStorage.read(filterId, function (rulesText) {
                if (rulesText) {
                    rulesFilterMap[filterId] = rulesText;
                }
                dfd.resolve();
            });

            return dfd;
        };

        /**
         * STEP 1: load all filters from the storage.
         */
        var loadFilterRules = function () {
            var dfds = [];
            for (var i = 0; i < abuFilters.length; i++) {
                const filter = abuFilters[i];
				const group = abu.subscriptions.getGroup(filter.groupId);
				const groupEnabled = (filter.filterId == abu.utils.filters.ANTI_CIRCUMVENTION) ? true : group.enabled;
                if (filter.enabled && groupEnabled !== false) {
                    dfds.push(loadFilterRulesFromStorage(filter.filterId, rulesFilterMap));
                }
            }
            dfds.push(loadUserRulesToRequestFilter(rulesFilterMap));

            // Load all filters and then recreate request filter
            abu.utils.Promise.all(dfds).then(loadAllFilterRulesDone);
        };

        loadFilterRules();
    }

    /**
     * Adds user rules (got from the storage) to request filter
     *
     * @param rulesFilterMap Map for loading rules
     * @returns {*} Deferred object
     * @private
     */
    function loadUserRulesToRequestFilter(rulesFilterMap) {

        var dfd = new abu.utils.Promise();

        var filterId = abu.utils.filters.USER_FILTER_ID;
        abu.rulesStorage.read(filterId, function (rulesText) {

            abu.userrules.setRules(rulesText || []);

            if (!rulesText) {
                dfd.resolve();
                return;
            }

            rulesFilterMap[filterId] = rulesText;
            dfd.resolve();
        });

        return dfd;
    }

    /**
     * Request Filter info
     */
    var getRequestFilterInfo = function () {
        var rulesCount = 0;
        if (requestFilter) {
            rulesCount = requestFilter.rulesCount;
        }
        return {
            rulesCount: rulesCount
        };
    };

    /**
     * Update content blocker info
     * We save state of content blocker for properly show in options page (converted rules count and over limit flag)
     * @param info Content blocker info
     */
    var updateContentBlockerInfo = function (info) {
        contentBlockerInfo.rulesCount = info.rulesCount;
        contentBlockerInfo.rulesOverLimit = info.rulesOverLimit;
    };

    /**
     * Content Blocker info
     */
    var getContentBlockerInfo = function () {
        return contentBlockerInfo;
    };

    /**
     * Adds event listener for filters changes.
     * If filter is somehow changed this method checks if we should save changes to the storage
     * and if we should recreate RequestFilter.
     *
     * @private
     */
    function addFiltersChangeEventListener() {

        var filterEventsHistory = [];
        var onFilterChangeTimeout = null;
		
		const processEventsHistory = function () {
            const filterEvents = filterEventsHistory.slice(0);
            filterEventsHistory = [];
            onFilterChangeTimeout = null;

            const needCreateRequestFilter = filterEvents.some(isUpdateRequestFilterEvent);

            // Split by filterId
            const eventsByFilter = Object.create(null);
            for (let i = 0; i < filterEvents.length; i += 1) {
                const filterEvent = filterEvents[i];
                // don't add group events
                if (!filterEvent.filter) {
                    continue;
                }
                if (!(filterEvent.filter.filterId in eventsByFilter)) {
                    eventsByFilter[filterEvent.filter.filterId] = [];
                }
                eventsByFilter[filterEvent.filter.filterId].push(filterEvent);
            }

            const dfds = [];
            for (const filterId in eventsByFilter) {
                const needSaveRulesToStorage = eventsByFilter[filterId].some(isSaveRulesToStorageEvent);
                if (!needSaveRulesToStorage) {
                    continue;
                }
                const dfd = processSaveFilterRulesToStorageEvents(filterId, eventsByFilter[filterId]);
                dfds.push(dfd);
            }
			
            if (needCreateRequestFilter) {
                // Rules will be added to request filter lazy, listeners will be notified about REQUEST_FILTER_UPDATED later
                abu.utils.Promise.all(dfds).then(createRequestFilter);
            } else {
                // Rules are already in request filter, notify listeners
                abu.listeners.notifyListeners(abu.listeners.REQUEST_FILTER_UPDATED, getRequestFilterInfo());
            }
        };

        const processFilterEvent = function (event, filter, rules) {
            filterEventsHistory.push({event: event, filter: filter, rules: rules});

            if (onFilterChangeTimeout !== null) {
                clearTimeout(onFilterChangeTimeout);
            }
            onFilterChangeTimeout = setTimeout(processEventsHistory, FILTERS_CHANGE_DEBOUNCE_PERIOD);
        };
		
		const processGroupEvent = function (event, group) {
			filterEventsHistory.push({ event, group });

            if (onFilterChangeTimeout !== null) {
                clearTimeout(onFilterChangeTimeout);
            }

            onFilterChangeTimeout = setTimeout(processEventsHistory, FILTERS_CHANGE_DEBOUNCE_PERIOD);
        };

        abu.listeners.addListener(function (event, filter, rules) {
            switch (event) {
                case abu.listeners.ADD_RULES:
                case abu.listeners.REMOVE_RULE:
                case abu.listeners.UPDATE_FILTER_RULES:
                case abu.listeners.FILTER_ENABLE_DISABLE:
                    processFilterEvent(event, filter, rules);
                    break;
            }
        });
		
		abu.listeners.addListener((event, group) => {
            switch (event) {
                case abu.listeners.FILTER_GROUP_ENABLE_DISABLE:
                    processGroupEvent(event, group);
                    break;
                default:
                    break;
            }
        });
    }

    /**
     * Saves updated filter rules to the storage.
     *
     * @param filterId Filter id
     * @param events Events (what has changed?)
     * @private
     */
    function processSaveFilterRulesToStorageEvents(filterId, events) {

        var dfd = new abu.utils.Promise();

        abu.rulesStorage.read(filterId, function (loadedRulesText) {

            for (var i = 0; i < events.length; i++) {

                if (!loadedRulesText) {
                    loadedRulesText = [];
                }

                var event = events[i];
                var eventType = event.event;
                var eventRules = event.rules;

                switch (eventType) {
                    case abu.listeners.ADD_RULES:
                        loadedRulesText = loadedRulesText.concat(abu.utils.collections.getRulesText(eventRules));
                        abu.console.debug("Add {0} rules to filter {1}", eventRules.length, filterId);
                        break;
                    case abu.listeners.REMOVE_RULE:
                        var actionRule = eventRules[0];
                        abu.utils.collections.removeAll(loadedRulesText, actionRule.ruleText);
                        abu.console.debug("Remove {0} rule from filter {1}", actionRule.ruleText, filterId);
                        break;
                    case abu.listeners.UPDATE_FILTER_RULES:
                        loadedRulesText = abu.utils.collections.getRulesText(eventRules);
                        abu.console.debug("Update filter {0} rules count to {1}", filterId, eventRules.length);
                        break;
                }
            }

            abu.console.debug("Save {0} rules to filter {1}", loadedRulesText.length, filterId);
            abu.rulesStorage.write(filterId, loadedRulesText, dfd.resolve);

        });

        return dfd;
    }

    /**
     * Subscribe to events which lead to filters update.
     * @private
     */
    function subscribeToFiltersChangeEvents() {
        /* abu.settings.onUpdated.addListener(function (setting) {
            if (setting === ) {
                
            }
        }); */
    }
	
	 // Scheduling job
    let scheduleUpdateTimeoutId;
    function scheduleUpdate() {
        if (scheduleUpdateTimeoutId) {
            clearTimeout(scheduleUpdateTimeoutId);
        }

        scheduleUpdateTimeoutId = setTimeout(() => {
            try {
                checkAntiBannerFiltersUpdate();
            } catch (ex) {
                abu.console.error('Error update filters, cause {0}', ex);
            }
            scheduleUpdate();
        }, UPDATE_FILTERS_PERIOD);
    }

    /**
     * Schedules filters update job
     * @isFirstRun
     * @private
     */
    function scheduleFiltersUpdate(isFirstRun) {
		const forceUpdate = isFirstRun;
		setTimeout(checkAntiBannerFiltersUpdate, UPDATE_FILTERS_DELAY, forceUpdate);
        scheduleUpdate();
    }

    /**
     * Gets filter by ID.
     * Throws exception if filter not found.
     *
     * @param filterId Filter identifier
     * @returns {*} Filter got from "abuFilters" property.
     * @private
     */
    function getFilterById(filterId) {
        for (var i = 0; i < abuFilters.length; i++) {
            var ABUFilter = abuFilters[i];
            if (ABUFilter.filterId == filterId) {
                return ABUFilter;
            }
        }
        throw 'Filter with id ' + filterId + ' not found';
    }

    /**
     * Loads filters (ony-by-one) from the remote server
     *
     * @param filterMetadataList List of filter metadata to load
     * @param callback Called when filters have been loaded
     * @private
     */
    function loadFiltersFromBackend(filterMetadataList, callback) {
        var loadedFilters = [];

        var loadNextFilter = function () {
            if (filterMetadataList.length === 0) {
                callback(true, loadedFilters);
            } else {
                var filterMetadata = filterMetadataList.shift();
                loadFilterRules(filterMetadata, true, function (success) {
                    if (!success) {
                        callback(false);
                        return;
                    }
                    loadedFilters.push(filterMetadata.filterId);
                    loadNextFilter();
                });
            }
        };

        loadNextFilter();
    }

    /**
     * Loads filter rules
     *
     * @param filterMetadata Filter metadata
     * @param forceRemote Force download filter rules from remote server (if false try to download local copy of rules if it's possible)
     * @param callback Called when filter rules have been loaded
     * @private
     */
    function loadFilterRules(filterMetadata, forceRemote, callback) {
        var filter = getFilterById(filterMetadata.filterId);

        filter._isDownloading = true;
        abu.listeners.notifyListeners(abu.listeners.START_DOWNLOAD_FILTER, filter);

        var successCallback = function (filterRules) {
            abu.console.info("Retrieved response from server for filter {0}, rules count: {1}", filter.filterId, filterRules.length);
            delete filter._isDownloading;
            filter.version = filterMetadata.version;
            filter.lastUpdateTime = filterMetadata.timeUpdated;
            filter.lastCheckTime = Date.now();
            filter.loaded = true;
            //notify listeners
            abu.listeners.notifyListeners(abu.listeners.SUCCESS_DOWNLOAD_FILTER, filter);
            abu.listeners.notifyListeners(abu.listeners.UPDATE_FILTER_RULES, filter, filterRules);
            callback(true);
        };

        var errorCallback = function (request, cause) {
            abu.console.error("Error retrieved response from server for filter {0}, cause: {1} {2}", filter.filterId, request.statusText, cause || "");
            delete filter._isDownloading;
            abu.listeners.notifyListeners(abu.listeners.ERROR_DOWNLOAD_FILTER, filter);
            callback(false);
        };

        abu.backend.loadFilterRules(filter.filterId, forceRemote, successCallback, errorCallback);
    }

    /**
     * Loads filter versions from remote server
     *
     * @param filterIds Filter identifiers
     * @param callback Callback (called when load is finished)
     * @private
     */
    function loadFiltersMetadataFromBackend(filterIds, callback) {
        if (filterIds.length === 0) {
            callback(true, []);
            return;
        }

        const loadSuccess = function (filterMetadataList) {
            abu.console.debug("Retrieved response from server for {0} filters, result: {1} metadata", filterIds.length, filterMetadataList.length);
            callback(true, filterMetadataList);
        };

        const loadError = function (request, cause) {
            abu.console.error("Error retrieved response from server for filters {0}, cause: {1} {2}", filterIds, request.statusText, cause || "");
            callback(false);
        };

        abu.backend.loadFiltersMetadata(filterIds, loadSuccess, loadError);
    }

    /**
     * Get filter by id
     * @param filterId
     * @returns {*}
     */
    var getAntiBannerFilterById = function (filterId) {
        return getFilterById(filterId);
    };

    /**
     * Get antibanner filters (includes states and versions)
     * @returns {Array}
     */
    const getAntiBannerFilters = function () {
        return abuFilters;
    };
	
	const getFiltersForОptionsPage = function () {
        return abuFilters.filter((f)=>{
			return f.filterId !== abu.utils.filters.ANTI_CIRCUMVENTION &&
				f.filterId != abu.utils.filters.USER_FILTER_ID &&
                f.filterId != abu.utils.filters.WHITE_LIST_FILTER_ID
				f.removed !== true;
		});
    };
		
    /**
     * Returns collection of filters for selected group to display for user
     * @param groupId Group identifier
     * @returns {*|Array} List of filters
     */
    function getFiltersForGroup(groupId) {
        return getFiltersForОptionsPage().filter(function (f) {
            return f.groupId == groupId;
        });
    }

    const addAbuFilters = function (filter) {
        return abuFilters.push(filter);
    };
	
    const removeAbuFilter = function (filter) {
		return abuFilters = abuFilters.filter((f) => {
            return (f.filterId !== filter.filterId);
        });
    };

    /**
     * Get request filter initialization time
     * @returns {number}
     */
    var getRequestFilterInitTime = function () {
        return requestFilterInitTime;
    };

    /**
     * Add rules to filter
     * @param filterId
     * @param rulesText
     * @returns {Array}
     */
    var addFilterRules = function (filterId, rulesText) {
        var rules = [];
        for (var i = 0; i < rulesText.length; i++) {
            var rule = abu.rules.builder.createRule(rulesText[i], filterId);
            if (rule !== null) {
                rules.push(rule);
            }
        }
        var filter = getFilterById(filterId);
        requestFilter.addRules(rules);
        abu.listeners.notifyListeners(abu.listeners.ADD_RULES, filter, rules);
        if (filterId === abu.utils.filters.USER_FILTER_ID) {
            abu.listeners.notifyListeners(abu.listeners.UPDATE_USER_FILTER_RULES, getRequestFilterInfo());
        }
        return rules;
    };

    /**
     * Remove rule from filter
     * @param filterId
     * @param ruleText
     */
    var removeFilterRule = function (filterId, ruleText) {
        var rule = abu.rules.builder.createRule(ruleText, filterId);
        if (rule !== null) {
            var filter = getFilterById(filterId);
            requestFilter.removeRule(rule);
            abu.listeners.notifyListeners(abu.listeners.REMOVE_RULE, filter, [rule]);
        }
        if (filterId === abu.utils.filters.USER_FILTER_ID) {
            abu.listeners.notifyListeners(abu.listeners.UPDATE_USER_FILTER_RULES, getRequestFilterInfo());
        }
    };

    /**
     * Clear filter rules
     * @param filterId
     */
    var clearFilterRules = function (filterId) {
        var filter = getFilterById(filterId);
        abu.listeners.notifyListeners(abu.listeners.UPDATE_FILTER_RULES, filter, []);
        if (filterId === abu.utils.filters.USER_FILTER_ID) {
            abu.listeners.notifyListeners(abu.listeners.UPDATE_USER_FILTER_RULES, getRequestFilterInfo());
        }
    };

    return {
        start,
        stop,
        isInitialized,

        getAntiBannerFilterById,
        getAntiBannerFilters,
        getFiltersForОptionsPage,
        getFiltersForGroup,
        addAntiBannerFilter,
		addAbuFilters,
		removeAbuFilter,
        getRequestFilter,
        getRequestFilterInitTime,

        addFilterRules,
        removeFilterRule,
        clearFilterRules,

        getRequestFilterInfo,
        updateContentBlockerInfo,
        getContentBlockerInfo,

        checkAntiBannerFiltersUpdate
    };

})(abu);

/**
 *
 * Api for filtering and elements hiding.
 */
abu.requestFilter = (function (abu) {
    'use strict';

    var antiBannerService = abu.antiBannerService;

    function getRequestFilter() {
        return antiBannerService.getRequestFilter();
    }

    /**
     * @returns boolean true when request filter was initialized first time
     */
    var isReady = function () {
        return antiBannerService.getRequestFilterInitTime() > 0;
    };

    /**
     * When browser just started we need some time on request filter initialization.
     * This could be a problem in case when browser has a homepage and it is just started.
     * In this case request filter is not yet initalized so we don't block requests and inject css.
     * To fix this, content script will repeat requests for selectors until request filter is ready
     * and it will also collapse all elements which should have been blocked.
     *
     * @returns boolean true if we should collapse elements with content script
     */
    var shouldCollapseAllElements = function () {
        // We assume that if content script is requesting CSS in first 5 seconds after request filter init,
        // then it is possible, that we've missed some elements and now we should collapse these elements
        var requestFilterInitTime = antiBannerService.getRequestFilterInitTime();
        return (requestFilterInitTime > 0) && (requestFilterInitTime + 5000 > new Date().getTime());
    };

    var getRules = function () {
        return getRequestFilter().getRules();
    };
    var findRuleForRequest = function (requestUrl, documentUrl, requestType, documentWhitelistRule) {
        return getRequestFilter().findRuleForRequest(requestUrl, documentUrl, requestType, documentWhitelistRule);
    };
    var findWhiteListRule = function (requestUrl, referrer, requestType) {
        return getRequestFilter().findWhiteListRule(requestUrl, referrer, requestType);
    };

    var getSelectorsForUrl = function (documentUrl, genericHideFlag) {
        return getRequestFilter().getSelectorsForUrl(documentUrl, genericHideFlag);
    };
    var getInjectedSelectorsForUrl = function (documentUrl, genericHideFlag) {
        return getRequestFilter().getInjectedSelectorsForUrl(documentUrl, genericHideFlag);
    };

    var getScriptsForUrl = function (documentUrl) {
        return getRequestFilter().getScriptsForUrl(documentUrl);
    };

    const getScriptsStringForUrl = function (documentUrl, tab) {
        return getRequestFilter().getScriptsStringForUrl(documentUrl, tab);
    };

    var getCspRules = function (requestUrl, referrer, requestType) {
        return getRequestFilter().findCspRules(requestUrl, referrer, requestType);
    };

    var getRequestFilterInfo = function () {
        return antiBannerService.getRequestFilterInfo();
    };
    var updateContentBlockerInfo = function (info) {
        return antiBannerService.updateContentBlockerInfo(info);
    };
    var getContentBlockerInfo = function () {
        return antiBannerService.getContentBlockerInfo();
    };

    return {
        isReady,
        shouldCollapseAllElements,

        getRules,
        findRuleForRequest,
        findWhiteListRule,

        getSelectorsForUrl,
        getInjectedSelectorsForUrl,
        getScriptsForUrl,
        getScriptsStringForUrl,
        getCspRules,

        getRequestFilterInfo,
        updateContentBlockerInfo,
        getContentBlockerInfo
    };

})(abu);

/**
 * Helper class for working with filters metadata storage (local storage)
 */
abu.filtersState = (function (abu) {
    const FILTERS_STATE_PROP = 'filters-state';
    const FILTERS_VERSION_PROP = 'filters-version';
    const GROUPS_STATE_PROP = 'groups-state';

    /**
     * Gets filter version from the local storage
     * @returns {*}
     */
    const getFiltersVersion = function () {
        let filters = Object.create(null);
        try {
            const json = abu.localStorage.getItem(FILTERS_VERSION_PROP);
            if (json) {
                filters = JSON.parse(json);
            }
        } catch (ex) {
            abu.console.error("Error retrieve filters version info, cause {0}", ex);
        }
        return filters;
    };

    /**
     * Gets filters state from the local storage
     * @returns {*}
     */
    const getFiltersState = function () {
        let filters = Object.create(null);
        try {
            const json = abu.localStorage.getItem(FILTERS_STATE_PROP);
            if (json) {
                filters = JSON.parse(json);
            }
        } catch (ex) {
            abu.console.error("Error retrieve filters state info, cause {0}", ex);
        }
        return filters;
    };

    /**
     * Gets filters state from the local storage
     * @returns {*}
     */
    const getFiltersNames = function () {
        let filters = [];
        try {
            const json = abu.localStorage.getItem('custom_filters');

            if (json) {
                const customFilters = JSON.parse(json) || [];
                customFilters.forEach((filter) => filters[filter.filterId] = filter.name);
            }
        } catch (ex) {
            abu.console.error("Error retrieve filters state info, cause {0}", ex);
        }
        return filters;
    };

    /**
     * Updates filter version in the local storage
     *
     * @param filter Filter version metadata
     */
    const updateFilterVersion = function (filter) {
        const filters = getFiltersVersion();
        filters[filter.filterId] = {
            version: filter.version,
            lastCheckTime: filter.lastCheckTime,
            lastUpdateTime: filter.lastUpdateTime
        };
        abu.localStorage.setItem(FILTERS_VERSION_PROP, JSON.stringify(filters));
    };

    /**
     * Updates filter state in the local storage
     *
     * @param filter Filter state object
     */
    const updateFilterState = function (filter) {
        const filters = getFiltersState();
        filters[filter.filterId] = {
            loaded: filter.loaded,
            enabled: filter.enabled,
            installed: filter.installed,
            manualDisabled: filter.manualDisabled
        };
        abu.localStorage.setItem(FILTERS_STATE_PROP, JSON.stringify(filters));
    };
	
	
	/**
     * Gets groups state from the local storage
     * @returns {any}
     */
    const getGroupsState = function () {
        let groups = Object.create(null);
        try {
            const json = abu.localStorage.getItem(GROUPS_STATE_PROP);
            if (json) {
                groups = JSON.parse(json);
            }
        } catch (e) {
            abu.console.error('Error retrieve groups state info, cause {0}', e);
        }
        return groups;
    };	
	
	/**
     * Updates group enable state in the local storage
     *
     * @param group - SubscriptionGroup object
     */
    const updateGroupState = function (group) {
        const groups = getGroupsState();
        groups[group.groupId] = {
            enabled: group.enabled,
        };
        abu.localStorage.setItem(GROUPS_STATE_PROP, JSON.stringify(groups));
    };
	
    // Add event listener to persist filter metadata to local storage
    abu.listeners.addListener(function (event, data) {
        switch (event) {
            case abu.listeners.SUCCESS_DOWNLOAD_FILTER:
                updateFilterState(data);
                updateFilterVersion(data);
                break;
            case abu.listeners.FILTER_ADD_REMOVE:
            case abu.listeners.FILTER_ENABLE_DISABLE:
                updateFilterState(data);
                break;
			case abu.listeners.FILTER_GROUP_ENABLE_DISABLE:
                updateGroupState(data);
                break;
            default:
                break;
        }
    });

    return {
        getFiltersVersion: getFiltersVersion,
        getFiltersState: getFiltersState,
        getGroupsState: getGroupsState,
        updateGroupState: updateGroupState,
        // These methods are used only for migrate from old versions
        updateFilterVersion: updateFilterVersion,
        updateFilterState: updateFilterState,
        getFiltersNames
    };

})(abu);

/**
 * Class for manage filters state (enable, disable, add, remove, check updates)
 * Also includes method for initializing
 */
abu.filters = (function (abu) {

    'use strict';

    var antiBannerService = abu.antiBannerService;

    var start = function (options, callback) {
        antiBannerService.start(options, callback);
    };

    var stop = function (callback) {
        antiBannerService.stop();
        callback();
    };

    /**
     * Checks application has been initialized
     * @returns {boolean}
     */
    var isInitialized = function () {
        return antiBannerService.isInitialized();
    };

    /**
     * Offer filters on extension install, select default filters and filters by locale and country
     * @param callback
     */
    var offerFilters = function (callback) {

        // These filters are enabled by default
        var filterIds = [
			abu.utils.filters.ABU_FILTER, 
			abu.utils.filters.ANTI_CIRCUMVENTION, 
			abu.utils.filters.ABU_SECURITY, 
			abu.utils.filters.ABU_PRIVACY, 
			abu.utils.filters.SPAM_404, 
			abu.utils.filters.NO_COIN,
		];

       // Get language-specific filters by user locale
        var localeFilterIds = abu.subscriptions.getFilterIdsForLanguage(abu.app.getLocale());
        filterIds = filterIds.concat(localeFilterIds);

        // Get language-specific filters by navigator languages
        // Get the 2 most commonly used languages
        var languages = abu.utils.browser.getNavigatorLanguages(2);
        for (var i = 0; i < languages.length; i++) {
            localeFilterIds = abu.subscriptions.getFilterIdsForLanguage(languages[i]);
            filterIds = filterIds.concat(localeFilterIds);
        } 
        callback(filterIds);
    };

    /**
     * List of enabled filters.
     * User filter and whitelist filter are always enabled so they are excluded.
     *
     * @returns {Array} List of enabled filters
     */
    var getEnabledFilters = function () {
        return antiBannerService.getAntiBannerFilters().filter(function (f) {
            return f.installed && f.enabled &&
                f.filterId != abu.utils.filters.USER_FILTER_ID &&
                f.filterId != abu.utils.filters.WHITE_LIST_FILTER_ID;
        });
    };

    /**
     * Checks if specified filter is enabled
     *
     * @param filterId Filter identifier
     * @returns {*} true if enabled
     */
    var isFilterEnabled = function (filterId) {
        return antiBannerService.getAntiBannerFilterById(filterId).enabled;
    };

    /**
     * Checks if specified filter is installed (downloaded)
     *
     * @param filterId Filter id
     * @returns {*} true if installed
     */
    var isFilterInstalled = function (filterId) {
        return antiBannerService.getAntiBannerFilterById(filterId).installed || false;
    };

    /**
     * Force checks updates for filters if specified or all filters
     *
     * @param successCallback
     * @param errorCallback
     * @param {Object[]} [filters] optional list of filters
     */
    const checkFiltersUpdates = (successCallback, errorCallback, filters) => {
        if (filters) {
            antiBannerService.checkAntiBannerFiltersUpdate(
				true,
				successCallback,
				errorCallback,
				filters
			);
        } else {
            antiBannerService.checkAntiBannerFiltersUpdate(true, successCallback, errorCallback);
        }
    };

    /**
     * Enable filter
     *
     * @param filterId Filter identifier
     * @returns {boolean} true if filter was enabled successfully
     */
    var enableFilter = function (filterId) {

        var filter = antiBannerService.getAntiBannerFilterById(filterId);
        if (filter.enabled || !filter.installed) {
            return false;
        }

        filter.enabled = true;
        abu.listeners.notifyListeners(abu.listeners.FILTER_ENABLE_DISABLE, filter);
        return true;
    };

    /**
     * Successively add filters from filterIds and then enable successfully added filters
     * @param filterIds Filter identifiers
     * @param callback We pass list of enabled filter identifiers to the callback
     * @param checkManualDisalbed do not enable filters if manually disabled
     */
    const addAndEnableFilters = function (filterIds, callback, checkManualDisalbed) {
        callback = callback || function () {
			// Empty callback
		};

        const enabledFilters = [];

        if (!filterIds || filterIds.length === 0) {
            callback(enabledFilters);
            return;
        }

        filterIds = abu.utils.collections.removeDuplicates(filterIds.slice(0)); // Copy array to prevent parameter mutation

        const loadNextFilter = function () {
            if (filterIds.length === 0) {
                callback(enabledFilters);
            } else {
                const filterId = filterIds.shift();
                const filter = antiBannerService.getAntiBannerFilterById(filterId);

                if(checkManualDisalbed === true && !filter.enabled && filter.manualDisabled) {
                    loadNextFilter();
                    return;
                }
                
                antiBannerService.addAntiBannerFilter(filterId, function (success) {
                    if (success) {
                        const changed = enableFilter(filterId);
                        if (changed) {
                            enabledFilters.push(filter);
                        }
                    }
                    loadNextFilter();
                });
            }
        };

        loadNextFilter();
    };
	
	 /**
     * If group doesn't have enabled property we consider that group is enabled for the first time
     * On first group enable we add and enable recommended filters by groupId
     * On the next calls we just enable group
     * @param {number} groupId
     */
    var enableFiltersGroup = function (groupId) {
        const group = abu.subscriptions.getGroup(groupId);
        if (!group || group.enabled) {
            return;
        }
        group.enabled = true;
        abu.listeners.notifyListeners(abu.listeners.FILTER_GROUP_ENABLE_DISABLE, group);
    };
    /**
     * Disables group
     * @param {number} groupId
     */
    const disableFiltersGroup = function (groupId) {
		const group = abu.subscriptions.getGroup(groupId);
        if (!group || group.enabled === false) {
            return;
        }
        group.enabled = false;
        abu.listeners.notifyListeners(abu.listeners.FILTER_GROUP_ENABLE_DISABLE, group);
    };

    /**
     * Disables filter by id
     *
     * @param filterId Filter identifier
     * @param manualDisabled is manual disabled from options UI
     * @returns {boolean} true if filter was disabled successfully
     */
    var disableFilter = function (filterId, manualDisabled) {
        var filter = antiBannerService.getAntiBannerFilterById(filterId);
        if (!filter.enabled || !filter.installed) {
            return false;
        }
        filter.enabled = false;
        if(manualDisabled === true) {
            filter.manualDisabled = true;
        }

        abu.listeners.notifyListeners(abu.listeners.FILTER_ENABLE_DISABLE, filter);
        return true;
    };

    /**
     * Removes filter
     *
     * @param filterId Filter identifier
     * @returns {boolean} true if filter was removed successfully
     */
    var removeFilter = function (filterId) {
        var filter = antiBannerService.getAntiBannerFilterById(filterId);
	
		if (!filter || filter.removed) {
            return;
        }
        abu.console.debug("Remove filter {0}", filter.filterId);
		if(filter.groupId == abu.subscriptions.CUSTOM_FILTERS_GROUP_ID){
			abu.subscriptions.removeCustomFilter(filter);
		}
        filter.enabled = false;
        filter.installed = false;
		filter.removed = true;
        abu.listeners.notifyListeners(abu.listeners.FILTER_ENABLE_DISABLE, filter);
        abu.listeners.notifyListeners(abu.listeners.FILTER_ADD_REMOVE, filter);
		abu.antiBannerService.removeAbuFilter(filter);
        return true;
    };
	
	 /**
     * Loads filter rules from url, then tries to parse header to filter metadata
     * and adds filter object to subscriptions from it.
     * These custom filters will have special attribute customUrl, from there it could be downloaded and updated.
     *
     * @param url custom url, there rules are
     * @param options object containing title of custom filter
     * @param successCallback
     * @param errorCallback
     */
    const loadCustomFilter = function (url, successCallback, errorCallback) {
        abu.console.info('Downloading custom filter from {0}', url);

        if (!url) {
            errorCallback(abu.i18n.getMessage('options_custom_filter_empty_url'));
            return;
        }
		
		const filter = findFilterMetadataBySubscriptionUrl(url);
		if (filter) {
			errorCallback(abu.i18n.getMessage('options_custom_filter_already_add'));
			return;
		}
	
        abu.subscriptions.addUpdateCustomFilter(url, (filter) => {
            if (filter) {
                abu.console.info('Custom filter downloaded');
				abu.antiBannerService.addAbuFilters(filter);
                successCallback(filter);
            } else {
                errorCallback(abu.i18n.getMessage('options_custom_filter_error'));
            }
        });
    };
	
    /**
     * Returns filter metadata by subscription url
     * @param subscriptionUrl - subscription url
     * @returns {*|T}
     */
    const findFilterMetadataBySubscriptionUrl = function (subscriptionUrl) {
        return abu.subscriptions.getFilters().filter(function (f) {
            return f.subscriptionUrl === subscriptionUrl;
        })[0];
    };

    /**
     * Load rules to user filter by subscription url
     * @param subscriptionUrl
     * @param loadCallback
     */
    var processAbpSubscriptionUrl = function (subscriptionUrl, loadCallback) {
        var filterMetadata = findFilterMetadataBySubscriptionUrl(subscriptionUrl);

        if (filterMetadata) {

            var filter = antiBannerService.getAntiBannerFilterById(filterMetadata.filterId);
            addAndEnableFilters([filter.filterId]);

        } else {
            // Load filter rules
            abu.backend.loadFilterRulesBySubscriptionUrl(subscriptionUrl, function (rulesText) {
                var rules = abu.userrules.addRules(rulesText);
                loadCallback(rules.length);
            }, function (request, cause) {
                abu.console.error("Error download subscription by url {0}, cause: {1} {2}", subscriptionUrl, request.statusText, cause || "");
            });
        }
    };

    return {
        start: start,
        stop: stop,
        isInitialized,

        offerFilters,

        getEnabledFilters,
        
		isFilterEnabled,
        isFilterInstalled,

        checkFiltersUpdates,

        addAndEnableFilters,
        disableFilter,
        removeFilter,
        loadCustomFilter,
		
		enableFiltersGroup,
		disableFiltersGroup,

        findFilterMetadataBySubscriptionUrl,
        processAbpSubscriptionUrl
    };

})(abu);
