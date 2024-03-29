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
 * Request types enumeration
 */
abu.RequestTypes = {

    /**
     * Document that is loaded for a top-level frame
     */
    DOCUMENT: "DOCUMENT",

    /**
     * Document that is loaded for an embedded frame (iframe)
     */
    SUBDOCUMENT: "SUBDOCUMENT",

    SCRIPT: "SCRIPT",
    STYLESHEET: "STYLESHEET",
    OBJECT: "OBJECT",
    IMAGE: "IMAGE",
    XMLHTTPREQUEST: "XMLHTTPREQUEST",
    OBJECT_SUBREQUEST: "OBJECT-SUBREQUEST",
    MEDIA: "MEDIA",
    FONT: "FONT",
    WEBSOCKET: "WEBSOCKET",
    WEBRTC: "WEBRTC",
    OTHER: "OTHER",
    CSP: "CSP",
    PING: 'PING',
};

/**
 * Background tab id in browsers is defined as -1
 */
abu.BACKGROUND_TAB_ID = -1;

/**
 * Utilities namespace
 */
abu.utils = (function () {

    return {
        strings: null, // StringUtils
        collections: null, // CollectionUtils,
        concurrent: null, // ConcurrentUtils,
        channels: null, // EventChannels
        browser: null, // BrowserUtils
        filters: null, // FilterUtils,
        workaround: null, // WorkaroundUtils
        StopWatch: null,
        Promise: null // Deferred,
    };

})();

/**
 * Util class for work with strings
 */
(function (api) {

    if (!String.prototype.endsWith) {
        String.prototype.endsWith = function (suffix) { 
            var index = this.lastIndexOf(suffix);
            return index !== -1 && index === this.length - suffix.length;
        };
    }

    //noinspection UnnecessaryLocalVariableJS
    var StringUtils = {

        isEmpty: function (str) {
            return !str || str.trim().length === 0;
        },

        startWith: function (str, prefix) {
            return str && str.indexOf(prefix) === 0;
        },

        endsWith: function (str, postfix) {
            return str.endsWith(postfix);
        },

        substringAfter: function (str, separator) {
            if (!str) {
                return str;
            }
            var index = str.indexOf(separator);
            return index < 0 ? "" : str.substring(index + separator.length);
        },

        substringBefore: function (str, separator) {
            if (!str || !separator) {
                return str;
            }
            var index = str.indexOf(separator);
            return index < 0 ? str : str.substring(0, index);
        },

        contains: function (str, searchString) {
            return str && str.indexOf(searchString) >= 0;
        },

        containsIgnoreCase: function (str, searchString) {
            return str && searchString && str.toUpperCase().indexOf(searchString.toUpperCase()) >= 0;
        },

        replaceAll: function (str, find, replace) {
            if (!str) {
                return str;
            }
            return str.split(find).join(replace);
        },

        join: function (array, separator, startIndex, endIndex) {
            if (!array) {
                return null;
            }
            if (!startIndex) {
                startIndex = 0;
            }
            if (!endIndex) {
                endIndex = array.length;
            }
            if (startIndex >= endIndex) {
                return "";
            }
            var buf = [];
            for (var i = startIndex; i < endIndex; i++) {
                buf.push(array[i]);
            }
            return buf.join(separator);
        },

        /**
         * Look for any symbol from "chars" array starting at "start" index
         *
         * @param str   String to search
         * @param start Start index (inclusive)
         * @param chars Chars to search for
         * @return int Index of the element found or null
         */
        indexOfAny: function (str, start, chars) {
            if (typeof str === 'string' && str.length <= start) {
                return -1;
            }

            for (var i = start; i < str.length; i++) {
                var c = str.charAt(i);
                if (chars.indexOf(c) > -1) {
                    return i;
                }
            }

            return -1;
        },
        /**
         * Splits string by a delimiter, ignoring escaped delimiters
         * @param str               String to split
         * @param delimiter         Delimiter
         * @param escapeCharacter   Escape character
         * @param preserveAllTokens If true - preserve empty entries.
         */
        splitByDelimiterWithEscapeCharacter(str, delimiter, escapeCharacter, preserveAllTokens) {
            const parts = [];

            if (abu.utils.strings.isEmpty(str)) {
                return parts;
            }

            let sb = [];
            for (let i = 0; i < str.length; i++) {
                const c = str.charAt(i);

                if (c === delimiter) {
                    if (i === 0) { 
                        // Ignore
                    } else if (str.charAt(i - 1) === escapeCharacter) {
                        sb.splice(sb.length - 1, 1);
                        sb.push(c);
                    } else if (preserveAllTokens || sb.length > 0) {
                        const part = sb.join('');
                        parts.push(part);
                        sb = [];
                    }
                } else {
                    sb.push(c);
                }
            }

            if (preserveAllTokens || sb.length > 0) {
                parts.push(sb.join(''));
            }

            return parts;
        }, 

        /**
        * Replace all (/.../g) leading slash (^\/) or (|) trailing slash (\/$) with an empty string. 
        * 
        * @param str String to trim
        */
        trimSlashes: (str) => {
            return str.replace(/^\/|\/$/g, '');
        }
    };

    api.strings = StringUtils;

})(abu.utils);

/**
 * Util class for work with collections
 */
(function (api) {

    //noinspection UnnecessaryLocalVariableJS
    var CollectionUtils = {

        remove: function (collection, element) {
            if (!element || !collection) {
                return;
            }
            var index = collection.indexOf(element);
            if (index >= 0) {
                collection.splice(index, 1);
            }
        },

        removeAll: function (collection, element) {
            if (!element || !collection) {
                return;
            }
            for (var i = collection.length - 1; i >= 0; i--) {
                if (collection[i] == element) {
                    collection.splice(i, 1);
                }
            }
        },

        removeRule: function (collection, rule) {
            if (!rule || !collection) {
                return;
            }
            for (var i = collection.length - 1; i >= 0; i--) {
                if (rule.ruleText === collection[i].ruleText) {
                    collection.splice(i, 1);
                }
            }
        },

        removeDuplicates: function (arr) {
            if (!arr || arr.length == 1) {
                return arr;
            }
            return arr.filter(function (elem, pos) {
                return arr.indexOf(elem) == pos;
            });
        },

        getRulesText: function (collection) {
            var text = [];
            if (!collection) {
                return text;
            }
            for (var i = 0; i < collection.length; i++) {
                text.push(collection[i].ruleText);
            }
            return text;
        },

        /**
         * Find element in array by property
         * @param array
         * @param property
         * @param value
         * @returns {*}
         */
        find: function (array, property, value) {
            if (typeof array.find === 'function') {
                return array.find(function (a) {
                    return a[property] === value;
                });
            }
            for (var i = 0; i < array.length; i++) {
                var elem = array[i];
                if (elem[property] === value) {
                    return elem;
                }
            }
            return null;
        },

        /**
         * Checks if specified object is array
         * We don't use instanceof because it is too slow: http://jsperf.com/instanceof-performance/2
         * @param obj Object
         */
        isArray: Array.isArray || function (obj) {
            return '' + obj === '[object Array]';
        }
    };

    api.collections = CollectionUtils;

})(abu.utils);

/**
 * Util class for support timeout, retry operations, debounce
 */
(function (api) {

    //noinspection UnnecessaryLocalVariableJS
    var ConcurrentUtils = {

        runAsync: function (callback, context) {
            var params = Array.prototype.slice.call(arguments, 2);
            setTimeout(function () {
                callback.apply(context, params);
            }, 0);
        },

        retryUntil: function (predicate, main, details) {

            if (typeof details !== 'object') {
                details = {};
            }

            var now = 0;
            var next = details.next || 200;
            var until = details.until || 2000;

            var check = function () {
                if (predicate() === true || now >= until) {
                    main();
                    return;
                }
                now += next;
                setTimeout(check, next);
            };

            setTimeout(check, 1);
        },

        debounce: function (func, wait) {
            var timeout;
            return function () {
                var context = this, args = arguments;
                var later = function () {
                    timeout = null;
                    func.apply(context, args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    };

    api.concurrent = ConcurrentUtils;

})(abu.utils);

/**
 * Util class for detect filter type. Includes various filter identifiers
 */
(function (api) {

    var AntiBannerFiltersId = {
		USER_FILTER_ID: 0,
		ABU_FILTER: 1,
		ANTI_CIRCUMVENTION: 2,
		ABU_PRIVACY: 4,
		FANBOY_SOCIAL: 5,
		ABU_SECURITY: 6,
		NO_COIN: 8,
		WHITE_LIST_FILTER_ID: 100,
    };

    var FilterUtils = {

        isUserFilterRule: function (rule) {
            return rule.filterId == AntiBannerFiltersId.USER_FILTER_ID;
        },

        isWhiteListFilterRule: function (rule) {
            return rule.filterId == AntiBannerFiltersId.WHITE_LIST_FILTER_ID;
        }
    };

    // Make accessible only constants without functions. They will be passed to content-page
    FilterUtils.ids = AntiBannerFiltersId;

    // Copy filter ids to api
    for (var key in AntiBannerFiltersId) {
        if (AntiBannerFiltersId.hasOwnProperty(key)) {
            FilterUtils[key] = AntiBannerFiltersId[key];
        }
    }
    api.filters = FilterUtils;

})(abu.utils);

/**
 * Simple time measurement utils
 */
(function (api) {

    var StopWatch = function (name) {
        this.name = name;
    };

    StopWatch.prototype = {

        start: function () {
            this.startTime = Date.now();
        },

        stop: function () {
            this.stopTime = Date.now();
        },

        print: function () {
            var elapsed = this.stopTime - this.startTime;
            console.log(this.name + "[elapsed: " + elapsed + " ms]");
        }
    };

    api.StopWatch = StopWatch;

})(abu.utils);

/**
 * Simple publish-subscribe implementation
 */
(function (api) {

    //noinspection UnnecessaryLocalVariableJS
    var EventChannels = (function () {

        'use strict';

        var EventChannel = function () {

            var listeners = null;
            var listenerCallback = null;

            var addListener = function (callback) {
                if (typeof callback !== 'function') {
                    throw new Error('Illegal callback');
                }
                if (listeners !== null) {
                    listeners.push(callback);
                    return;
                }
                if (listenerCallback !== null) {
                    listeners = [];
                    listeners.push(listenerCallback);
                    listeners.push(callback);
                    listenerCallback = null;
                } else {
                    listenerCallback = callback;
                }
            };

            var removeListener = function (callback) {
                if (listenerCallback !== null) {
                    listenerCallback = null;
                } else {
                    var index = listeners.indexOf(callback);
                    if (index >= 0) {
                        listeners.splice(index, 1);
                    }
                }
            };

            var notify = function () {
                if (listenerCallback !== null) {
                    return listenerCallback.apply(listenerCallback, arguments);
                }
                if (listeners !== null) {
                    for (var i = 0; i < listeners.length; i++) {
                        var listener = listeners[i];
                        listener.apply(listener, arguments);
                    }
                }
            };

            var notifyInReverseOrder = function () {
                if (listenerCallback !== null) {
                    return listenerCallback.apply(listenerCallback, arguments);
                }
                if (listeners !== null) {
                    for (var i = listeners.length - 1; i >= 0; i--) {
                        var listener = listeners[i];
                        listener.apply(listener, arguments);
                    }
                }
            };

            return {
                addListener: addListener,
                removeListener: removeListener,
                notify: notify,
                notifyInReverseOrder: notifyInReverseOrder
            };
        };

        var namedChannels = Object.create(null);

        var newChannel = function () {
            return new EventChannel();
        };

        var newNamedChannel = function (name) {
            var channel = newChannel();
            namedChannels[name] = channel;
            return channel;
        };

        var getNamedChannel = function (name) {
            return namedChannels[name];
        };

        return {
            newChannel: newChannel,
            newNamedChannel: newNamedChannel,
            getNamedChannel: getNamedChannel
        };
    })();

    api.channels = EventChannels;

})(abu.utils);

/**
 * Promises wrapper
 */
(function (api, global) {

    'use strict';

    var defer = global.Deferred;
    var deferAll = function (arr) {
        return global.Deferred.when.apply(global.Deferred, arr);
    };

    var Promise = function () {

        var deferred = defer();
        var promise;
        if (typeof deferred.promise === 'function') {
            promise = deferred.promise();
        } else {
            promise = deferred.promise;
        }

        var resolve = function (arg) {
            deferred.resolve(arg);
        };

        var reject = function (arg) {
            deferred.reject(arg);
        };

        var then = function (onSuccess, onReject) {
            promise.then(onSuccess, onReject);
        };

        return {
            promise: promise,
            resolve: resolve,
            reject: reject,
            then: then
        };
    };

    Promise.all = function (promises) {
        var defers = [];
        for (var i = 0; i < promises.length; i++) {
            defers.push(promises[i].promise);
        }
        return deferAll(defers);
    };

    api.Promise = Promise;

})(abu.utils, window);

/**
 * We collect here all workarounds and ugly hacks:)
 */
(function (api) {

    //noinspection UnnecessaryLocalVariableJS
    var WorkaroundUtils = {

        /**
         * Converts blocked counter to the badge text.
         * Workaround for FF - make 99 max.
         *
         * @param blocked Blocked requests count
         */
        getBlockedCountText: function (blocked) {
            var blockedText = blocked == "0" ? "" : blocked;
            if (blocked - 0 > 99) {
                blockedText = '\u221E';
            }

            return blockedText;
        }
    };

    api.workaround = WorkaroundUtils;

})(abu.utils);

/**
 * Unload handler. When extension is unload then 'fireUnload' is invoked.
 * You can add own handler with method 'when'
 * @type {{when, fireUnload}}
 */
abu.unload = (function (abu) {

    'use strict';

    var unloadChannel = abu.utils.channels.newChannel();

    var when = function (callback) {
        if (typeof callback !== 'function') {
            return;
        }
        unloadChannel.addListener(function () {
            try {
                callback();
            } catch (ex) {
                console.error('Error while invoke unload method');
                console.error(ex);
            }
        });
    };

    var fireUnload = function (reason) {
        console.info('Unload is fired: ' + reason);
        unloadChannel.notifyInReverseOrder(reason);
    };

    return {
        when: when,
        fireUnload: fireUnload
    };

})(abu);

/**
 * Utility class for saving and retrieving some item by key;
 * It's bounded with some capacity.
 * Details are stored in some ring buffer. For each key corresponding item are retrieved in LIFO order.
 */
abu.utils.RingBuffer = function (size) { 

    if (typeof Map === 'undefined') {
        throw new Error('Unable to create RingBuffer');
    }

    /**
     * itemKeyToIndex: Map (key => indexes)
     * indexes = Array of [index];
     * index = position of item in ringBuffer
     */
    /* global Map */
    var itemKeyToIndex = new Map();
    var itemWritePointer = 0; // Current write position

    /**
     * ringBuffer: Array [0:item][1:item]...[size-1:item]
     */
    var ringBuffer = new Array(size);

    var i = ringBuffer.length;
    while (i--) {
        ringBuffer[i] = {processedKey: null}; // 'if not null' means this item hasn't been processed yet.
    }

    /**
     * Put new value to buffer
     * 1. Associates item with next index from ringBuffer.
     * 2. If index has been already in use and item hasn't been processed yet, then removes it from indexes array in itemKeyToIndex
     * 3. Push this index to indexes array in itemKeyToIndex at first position
     * @param key Key
     * @param value Object
     */
    var put = function (key, value) {

        var index = itemWritePointer;
        itemWritePointer = (index + 1) % size;

        var item = ringBuffer[index];
        var indexes;

        // Cleanup unprocessed item
        if (item.processedKey !== null) {
            indexes = itemKeyToIndex.get(item.processedKey);
            if (indexes.length === 1) {
                // It's last item with this key
                itemKeyToIndex.delete(item.processedKey);
            } else {
                var pos = indexes.indexOf(index);
                if (pos >= 0) {
                    indexes.splice(pos, 1);
                }
            }
            ringBuffer[index] = item = null;
        }
        indexes = itemKeyToIndex.get(key);
        if (indexes === undefined) {
            // It's first item with this key
            itemKeyToIndex.set(key, [index]);
        } else {
            // Push item index at first position
            indexes.unshift(index);
        }

        ringBuffer[index] = value;
        value.processedKey = key;
    };

    /**
     * Finds item by key
     * 1. Get indexes from itemKeyToIndex by key.
     * 2. Gets first index from indexes, then gets item from ringBuffer by this index
     * @param key Key for searching
     */
    var pop = function (key) {
        var indexes = itemKeyToIndex.get(key);
        if (indexes === undefined) {
            return null;
        }
        var index = indexes.shift();
        if (indexes.length === 0) {
            itemKeyToIndex.delete(key);
        }
        var item = ringBuffer[index];
        // Mark as processed
        item.processedKey = null;
        return item;
    };

    var clear = function () {
        itemKeyToIndex = new Map();
        itemWritePointer = 0;
        var i = ringBuffer.length;
        while (i--) {
            ringBuffer[i] = {processedKey: null};
        }
    };

    return {
        put: put,
        pop: pop,
        clear: clear
    };

};
