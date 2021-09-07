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

/* global $, contentPage */

const showSaveFunc = (function () {
    let showSave;
    const DownloadAttributeSupport = 'download' in document.createElement('a');

    const Blob = window.Blob || window.WebKitBlob || window.MozBlob;
    const URL = window.URL || window.webkitURL || window.mozURL;

    navigator.saveBlob = navigator.saveBlob || navigator.mozSaveBlob || navigator.webkitSaveBlob || navigator.msSaveBlob;
    window.saveAs = window.saveAs || window.webkitSaveAs || window.mozSaveAs || window.msSaveAs;

	if (Blob && navigator.saveBlob) {
        showSave = function (data, name, mimetype) {
            const blob = new Blob([data], { type: mimetype });
            if (window.saveAs) {
                window.saveAs(blob, name);
            } else {
                navigator.saveBlob(blob, name);
            }
        };
    } else if (Blob && URL) {
        showSave = function (data, name, mimetype) {
            let url;
            const blob = new Blob([data], { type: mimetype });
            if (DownloadAttributeSupport) {
                url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', name || 'Download.bin');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                url = URL.createObjectURL(blob);
                window.open(url, '_blank', '');
            }
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 250);
        };
    }
    return showSave;
})();


$(document).ready(function () {

    var callback = function (response) {

        var rules = response.rules;

        if (!rules || rules.length === 0) {
            return;
        }

        var el = $('<pre/>');
        var rulesText = rules ? rules.join('\r\n') : '';
        el.text(rulesText);
        $("body").append(el);


        var filename = whitelist ? 'whitelist.txt' : 'rules.txt';
        if (showSaveFunc) {
            showSaveFunc(rulesText, filename, 'text/plain;charset=utf-8');
        }
    };

    var whitelist = document.location.hash == '#wl';
    var messageType;
    if (whitelist) {
        messageType = 'getWhiteListDomains';
    } else {
        messageType = 'getUserFilters';
    }

    contentPage.sendMessage({type: messageType}, callback);
});
