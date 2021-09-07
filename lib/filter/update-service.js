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
 * Service that manages extension version information and handles
 * extension update. For instance we may need to change storage schema on update.
 */
abu.applicationUpdateService = (function (abu) {

    /**
     * File storage adapter
     * @Deprecated Used now only to upgrade from versions older than v2.3.5
     */
    var FileStorage = {

        LINE_BREAK: '\n',
        FILE_PATH: "filters.ini",

        readFromFile: function (path, callback) {

            var successCallback = function (fs, fileEntry) {

                fileEntry.file(function (file) {

                    var reader = new FileReader();
                    reader.onloadend = function () {

                        if (reader.error) {
                            callback(reader.error);
                        } else {
                            var lines = [];
                            if (reader.result) {
                                lines = reader.result.split(/[\r\n]+/);
                            }
                            callback(null, lines);
                        }
                    };

                    reader.onerror = function (e) {
                        callback(e);
                    };

                    reader.readAsText(file);

                }, callback);
            };

            this._getFile(path, true, successCallback, callback);
        },

        _getFile: function (path, create, successCallback, errorCallback) {

            path = path.replace(/^.*[\/\\]/, "");

            var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
            requestFileSystem(window.PERSISTENT, 1024 * 1024 * 1024, function (fs) {
                fs.root.getFile(path, {create: create}, function (fileEntry) {
                    successCallback(fs, fileEntry);
                }, errorCallback);
            }, errorCallback);
        },

        removeFile: function (path, successCallback, errorCallback) {
            this._getFile(path, false, function (fs, fileEntry) {
                fileEntry.remove(successCallback, errorCallback);
            }, errorCallback);
        }
    };

    /**
     * Helper to execute deferred objects
     *
     * @param methods Methods to execute
     * @returns {Deferred}
     * @private
     */
    function executeMethods(methods) {

        var mainDfd = new abu.utils.Promise();

        var executeNextMethod = function () {
            if (methods.length === 0) {
                mainDfd.resolve();
            } else {
                var method = methods.shift();
                var dfd = method();
                dfd.then(executeNextMethod);
            }
        };

        executeNextMethod();

        return mainDfd;
    }

    /**
     * Updates filters storage - move from files to the storage API.
     *
     * Version 2.3.5
     * @returns {Promise}
     * @private
     */
    function onUpdateChromiumStorage() {

        abu.console.info('Call update to version 2.3.5');

        var dfd = new abu.utils.Promise();

        var filterId = abu.utils.filters.USER_FILTER_ID;
        var filePath = "filterrules_" + filterId + ".txt";

        FileStorage.readFromFile(filePath, function (e, rules) {
            if (e) {
                abu.console.error("Error while reading rules from file {0} cause: {1}", filePath, e);
                return;
            }

            var onTransferCompleted = function () {
                abu.console.info("Rules have been transferred to local storage for filter {0}", filterId);

                FileStorage.removeFile(filePath, function () {
                    abu.console.info("File removed for filter {0}", filterId);
                }, function () {
                    abu.console.error("File remove error for filter {0}", filterId);
                });
            };

            if (rules) {
                abu.console.info('Found rules:' + rules.length);
            }

            abu.rulesStorage.write(filterId, rules, onTransferCompleted);
        });

        dfd.resolve();
        return dfd;
    }

    /**
     * Edge supports unlimitedStorage since Creators update.
     * Previously, we keep filter rules in localStorage, and now we have to migrate this rules to browser.storage.local
     * See https://github.com/AdguardTeam/AdguardBrowserExtension/issues/566
     */
    function onUpdateEdgeRulesStorage() {

        var dfd = new abu.utils.Promise();

        var fixProperty = 'edge-storage-local-fix-build' + abu.utils.browser.EDGE_CREATORS_UPDATE;
        if (abu.localStorage.getItem(fixProperty)) {
            dfd.resolve();
            return dfd;
        }

        abu.console.info('Call update to use storage.local for Edge browser');

        var keys = [];
        for (var key in localStorage) {
            if (localStorage.hasOwnProperty(key) && key.indexOf('filterrules_') === 0) {
                keys.push(key);
            }
        }

        function writeFilterRules() {
            if (keys.length === 0) {
                abu.localStorage.setItem(fixProperty, true);
                dfd.resolve();
            } else {
                var key = keys.shift();
                var lines = [];
                var value = localStorage.getItem(key);
                if (value) {
                    lines = value.split(/[\r\n]+/);
                }
                abu.rulesStorageImpl.write(key, lines, function () {
                    localStorage.removeItem(key);
                    writeFilterRules();
                });
            }
        }

        writeFilterRules();

        return dfd;
    }

    /**
     * Async returns extension run info
     *
     * @param callback Run info callback with passed object {{isFirstRun: boolean, isUpdate: (boolean|*), currentVersion: (Prefs.version|*), prevVersion: *}}
     */
    var getRunInfo = function (callback) {

        var prevVersion = abu.utils.browser.getAppVersion();
        var currentVersion = abu.app.getVersion();
        abu.utils.browser.setAppVersion(currentVersion);

        var isFirstRun = (currentVersion !== prevVersion && !prevVersion);
        var isUpdate = !!(currentVersion !== prevVersion && prevVersion);

        callback({
            isFirstRun: isFirstRun,
            isUpdate: isUpdate,
            currentVersion: currentVersion,
            prevVersion: prevVersion
        });
    };

    /**
     * Handle extension update
     * @param runInfo   Run info
     * @param callback  Called after update was handled
     */
    var onUpdate = function (runInfo, callback) {

        var methods = [];
        if (abu.utils.browser.isGreaterVersion("2.3.5", runInfo.prevVersion) && abu.utils.browser.isChromium()) {
            methods.push(onUpdateChromiumStorage);
        }
        if (abu.utils.browser.isEdgeBrowser() && !abu.utils.browser.isEdgeBeforeCreatorsUpdate()) {
            methods.push(onUpdateEdgeRulesStorage);
        }

        var dfd = executeMethods(methods);
        dfd.then(callback);
    };

    return {
        getRunInfo: getRunInfo,
        onUpdate: onUpdate
    };

})(abu);



