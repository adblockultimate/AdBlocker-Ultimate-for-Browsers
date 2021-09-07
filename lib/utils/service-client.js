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

abu.backend = (function (abu) {

    'use strict';

    /**
     * Settings
     */
    var settings = {

        // URL for checking filter updates
        get filtersMetadataUrl() {
            return "https://filters.adavoid.org/filters_ext.json";
        },

        // URL to send users feedback
        get feedbackUrl() {
            return "https://adblockultimate.net/feedback-extension";
        },

        // Folder that contains filters metadata and files with rules. 'filters' by default
        get localFiltersFolder() {
            return 'filters';
        },
        // Array of filter identifiers, that have local file with rules. Range from 1 to 8 by default
        get localFilterIds() {
            return [1, 2, 3, 4, 5, 6, 7, 8];
        }
    };

    /**
     * Loading subscriptions map
     */
    var loadingSubscriptions = Object.create(null);



    /**
     * Load filter rules.
     * Parse header and rules.
     * Response format:
     * HEADER
     * rule1
     * rule2
     * ...
     * ruleN
     *
     * @param filterId Filter identifier
     * @param url Url for loading rules
     * @param successCallback Success callback (version, rules)
     * @param errorCallback Error callback (response, errorText)
     * @private
     */
    function doLoadFilterRules(filterId, url, successCallback, errorCallback) {

        var success = function (response) {
            var responseText = response.responseText;
            if (!responseText) {
                errorCallback(response, "filter rules missing");
                return;
            }

            var lines = responseText.split(/[\r\n]+/);

            var rules = [];
            for (var i = 0; i < lines.length; i++) {
                var rule = abu.rules.builder.createRule(lines[i], filterId);
                if (rule !== null) {
                    rules.push(rule);
                }
            }

            successCallback(rules);

        };

        executeRequestAsync(url, "text/plain", success, errorCallback);
    }

    /**
     * Executes async request
     * @param url Url
     * @param contentType Content type
     * @param successCallback success callback
     * @param errorCallback error callback
     */
    function executeRequestAsync(url, contentType, successCallback, errorCallback) {
        var request = new XMLHttpRequest();
        try {
            request.open('GET', url);
            request.setRequestHeader('Content-type', contentType);
            request.setRequestHeader('Pragma', 'no-cache');
            request.overrideMimeType(contentType);
            request.mozBackgroundRequest = true;
            if (successCallback) {
                request.onload = function () {
                    successCallback(request);
                };
            }
            if (errorCallback) {
                var errorCallbackWrapper = function () {
                    errorCallback(request);
                };
                request.onerror = errorCallbackWrapper;
                request.onabort = errorCallbackWrapper;
                request.ontimeout = errorCallbackWrapper;
            }
            request.send(null);
        } catch (ex) {
            if (errorCallback) {
                errorCallback(request, ex);
            }
        }
    }

    /**
     * Safe json parsing
     * @param text
     * @private
     */
    function parseJson(text) {
        try {
            return JSON.parse(text);
        } catch (ex) {
            abu.console.error('Error parse json {0}', ex);
            return null;
        }
    }

    /**
     * URL for downloading AG filter
     *
     * @param filterId Filter identifier
     * @private
     */
    function getUrlForDownloadFilterRules(filterId) {
        const filter = abu.antiBannerService.getAntiBannerFilterById(filterId);
        if(filter.length == 0) return false;
		return filter.subscriptionUrl;
    }

    /**
     * Safe json parsing
     * @param text
     * @private
     */
    function parseJson(text) {
        try {
            return JSON.parse(text);
        } catch (ex) {
            abu.console.error('Error parse json {0}', ex);
            return null;
        }
    }

    /**
     * Load metadata of the specified filters
     *
     * @param filterIds         Filters identifiers
     * @param successCallback   Called on success
     * @param errorCallback     Called on error
     */
    var loadFiltersMetadata = function (filterIds, successCallback, errorCallback) {

        if (!filterIds || filterIds.length === 0) {
            successCallback([]);
            return;
        }

        var success = function (response) {
            if (response && response.responseText) {
                var metadata = parseJson(response.responseText);
                if (!metadata) {
                    errorCallback(response, "invalid response");
                    return;
                }
			
                var filterMetadataList = [];
                for (var i = 0; i < filterIds.length; i++) {
                    var filter = abu.utils.collections.find(metadata.filters, 'filterId', filterIds[i]);
                    if (filter) {
                        filterMetadataList.push(abu.subscriptions.createSubscriptionFilterFromJSON(filter));
                    }
                }
                successCallback(filterMetadataList);
            } else {
                errorCallback(response, "empty response");
            }
        };
	
        executeRequestAsync(settings.filtersMetadataUrl, "application/json", success, errorCallback);
    };

    /**
     * Downloads filter rules by filter ID
     *
     * @param filterId            Filter identifier
     * @param forceRemote         Force download filter rules from remote server
     * @param useOptimizedFilters    Download optimized filters flag
     * @param successCallback    Called on success
     * @param errorCallback        Called on error
     */
    var loadFilterRules = function (filterId, forceRemote, successCallback, errorCallback) {
        var url;
        if (forceRemote || settings.localFilterIds.indexOf(filterId) < 0) {
            url = getUrlForDownloadFilterRules(filterId);
        } else {
            url = abu.getURL(settings.localFiltersFolder + "/filter_" + filterId + ".txt");
        }
        doLoadFilterRules(filterId, url, successCallback, errorCallback);
    };

    /**
     * Downloads filter rules frm url
     *
     * @param url               Subscription url
     * @param successCallback   Called on success
     * @param errorCallback     Called on error
     */
    var loadFilterRulesBySubscriptionUrl = function (url, successCallback, errorCallback) {

        if (url in loadingSubscriptions) {
            return;
        }
        loadingSubscriptions[url] = true;

        var success = function (response) {
            delete loadingSubscriptions[url];

            if (response.status !== 200 && response.status !== 0) {
                errorCallback(response, "wrong status code: " + response.status);
                return;
            }

            const responseText = response.responseText ? response.responseText : response.data;
	
            if (responseText.length === 0) {
                errorCallback(response, "filter rules missing");
                return;
            }

            var lines = responseText.split(/[\r\n]+/);
            if (lines[0].indexOf('[') === 0) {
                //[Adblock Plus 2.0]
                lines.shift();
            }
            successCallback(lines);
        };

        var error = function (request, cause) {
            delete loadingSubscriptions[url];
            errorCallback(request, cause);
        };

        executeRequestAsync(url, "text/plain", success, error);
    };

    /**
     * Loads filter groups metadata
     *
     * @param successCallback   Called on success
     * @param errorCallback     Called on error
     */
    var loadLocalFiltersMetadata = function (successCallback, errorCallback) {

        var success = function (response) {
            if (response && response.responseText) {
                var metadata = parseJson(response.responseText);
                if (!metadata) {
                    errorCallback(response, 'invalid response');
                    return;
                }
                successCallback(metadata);
            } else {
                errorCallback(response, 'empty response');
            }
        };

        var url = abu.getURL(settings.localFiltersFolder + '/filters.json');
        executeRequestAsync(url, 'application/json', success, errorCallback);
    };

    /**
     * Loads script rules from local file
     *
     * @param successCallback   Called on success
     * @param errorCallback     Called on error
     */
    var loadLocalScriptRules = function (successCallback, errorCallback) {
        var success = function (response) {
            if (response && response.responseText) {
                var metadata = parseJson(response.responseText);
                if (!metadata) {
                    errorCallback(response, 'invalid response');
                    return;
                }
                successCallback(metadata);
            } else {
                errorCallback(response, 'empty response');
            }
        };
        var url = abu.getURL(settings.localFiltersFolder + '/local_script_rules.json');
        executeRequestAsync(url, 'application/json', success, errorCallback);
    };

    
    /**
     * Sends feedback from the user to us
     *
     * @param params           string params
     */
    const sendFeedback = function (params) {
        if(!params) return false;

        const request = new XMLHttpRequest();
        request.open('POST', settings.feedbackUrl);
        request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        request.send(params);
    };


    /**
     * Configures backend's URLs
     * @param configuration Configuration object:
     * {
     *  filtersMetadataUrl: '...',
     *  filterRulesUrl: '...',
     *  localFiltersFolder: '...',
     *  localFilterIds: []
     * }
     */
    var configure = function (configuration) {
        var filtersMetadataUrl = configuration.filtersMetadataUrl;
        if (filtersMetadataUrl) {
            Object.defineProperty(settings, 'filtersMetadataUrl', {
                get: function () {
                    return filtersMetadataUrl;
                }
            });
        }
        var filterRulesUrl = configuration.filterRulesUrl;
        if (filterRulesUrl) {
            Object.defineProperty(settings, 'filterRulesUrl', {
                get: function () {
                    return filterRulesUrl;
                }
            });
        }
        var localFiltersFolder = configuration.localFiltersFolder;
        if (localFiltersFolder) {
            Object.defineProperty(settings, 'localFiltersFolder', {
                get: function () {
                    return localFiltersFolder;
                }
            });
        }
        var localFilterIds = configuration.localFilterIds;
        if (localFilterIds) {
            Object.defineProperty(settings, 'localFilterIds', {
                get: function () {
                    return localFilterIds;
                }
            });
        }
    };

    return {
        executeRequestAsync,
        parseJson,

        loadFiltersMetadata,
        loadFilterRules,

        loadFilterRulesBySubscriptionUrl,

        loadLocalFiltersMetadata,
        loadLocalScriptRules,

        sendFeedback,

        configure
    };

})(abu);
