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

/* global safari */

/**
 * Extension global preferences.
 * (!) Firefox has it's own implementation
 */
abu.prefs = (function (abu) {

    var Prefs = {

        get mobile() {
            return abu.lazyGet(Prefs, 'mobile', () => navigator.userAgent.indexOf('Android') >= 0);
        },

        platform: 'chromium',

        get browser() {
            return abu.lazyGet(Prefs, 'browser', function () {
                var browser;
                var userAgent = navigator.userAgent;
                if (userAgent.toLowerCase().indexOf("yabrowser") >= 0) {
                    browser = "YaBrowser";
                } else if (userAgent.toLowerCase().indexOf("edge") >= 0) {
                    browser = "Edge";
                } else if (userAgent.indexOf('Edg') >= 0) {
                    browser = 'EdgeChromium';
                } else if (userAgent.toLowerCase().indexOf("opera") >= 0 || userAgent.toLowerCase().indexOf("opr") >= 0) {
                    browser = "Opera";
                } else if (userAgent.indexOf("Safari") >= 0 && userAgent.indexOf('Chrome') < 0) {
                    browser = "Safari";
                } else if (userAgent.indexOf("Firefox") >= 0) {
                    browser = "Firefox";
                } else {
                    browser = "Chrome";
                }
                return browser;
            });
        },

        get chromeVersion() {
            return abu.lazyGet(Prefs, 'chromeVersion', function () {
                if (this.browser == "Chrome") {
                    var i = navigator.userAgent.indexOf("Chrome/");
                    if (i < 0) {
                        return null;
                    }
                    return parseInt(navigator.userAgent.substring(i + 7));
                }
            });
        },

        /**
         * https://msdn.microsoft.com/ru-ru/library/hh869301(v=vs.85).aspx
         * @returns {*}
         */
        get edgeVersion() {
            return abu.lazyGet(Prefs, 'edgeVersion', function () {
                if (this.browser === 'Edge') {
                    var userAgent = navigator.userAgent;
                    var i = userAgent.indexOf('Edge/');
                    if (i < 0) {
                        return {
                            rev: 0,
                            build: 0
                        };
                    }
                    var version = userAgent.substring(i + 'Edge/'.length);
                    var parts = version.split('.');
                    return {
                        rev: parseInt(parts[0]),
                        build: parseInt(parts[1])
                    };
                }
            });
        },

        get ICONS() {
            return abu.lazyGet(Prefs, 'ICONS', function () {
                return {
                    ICON_RED: {
                        '19': abu.getURL('icons/19.png'),
                        '38': abu.getURL('icons/38.png')
                    },
                    ICON_GRAY: {
                        '19': abu.getURL('icons/gray-19.png'),
                        '38': abu.getURL('icons/gray-38.png')
                    }
                };
            });
        }
    };

    return Prefs;

})(abu);
