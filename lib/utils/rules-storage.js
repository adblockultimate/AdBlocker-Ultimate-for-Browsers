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

/* global browser */

/**
 * Filter rules storage implementation
 */
abu.rulesStorageImpl = (function () {

    /**
     * Checks runtime.lastError and calls "callback" if so.
     *
     * @returns true if operation caused error
     */
    var checkLastError = function (callback) {
        if (browser.runtime.lastError) {
            callback(browser.runtime.lastError);
            return true;
        }

        return false;
    };

    var read = function (path, callback) {
        try {
            browser.storage.local.get(path, function (results) {
                if (!checkLastError(callback)) {
                    var lines = [];

                    if (results && results[path] instanceof Array) {
                        lines = results[path];
                    }

                    callback(null, lines);
                }
            });
        } catch (ex) {
            callback(ex);
        }
    };

    var write = function (path, data, callback) {
        var item = {};
        item[path] = data;
        try {
            browser.storage.local.set(item, function () {
                if (!checkLastError(callback)) {
                    callback();
                }
            });
        } catch (ex) {
            callback(ex);
        }
    };

    var remove = function (path, successCallback) {
        browser.storage.local.remove(path, successCallback);
    };

    return {
        read: read,
        write: write,
        remove: remove
    };

})();