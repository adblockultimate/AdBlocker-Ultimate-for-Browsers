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

/* global contentPage, I18nHelper, AbuAssistant, balalaika, AbuSelectorLib, AdguardRulesConstructorLib */

(function () {

    if (window.top !== window || !(document.documentElement instanceof HTMLElement)) {
        return;
    }

    /**
     * `contentPage` may be undefined on the extension startup in FF browser.
     *
     * Different browsers have different strategies of the content scripts injections on extension startup.
     * For example, FF injects content scripts in already opened tabs, but Chrome doesn't do it.
     * In the case of the FF browser, content scripts with the `document_start` option won't injected into opened tabs, so we have to directly check this case.
     */
    if (typeof contentPage === 'undefined') {
        return;
    }

    var abuAssistant;

    //save right-clicked element for assistant
    var clickedEl = null;
    document.addEventListener('mousedown', function (event) {
        if (event.button === 2) {
            clickedEl = event.target;
        }
    });

    contentPage.onMessage.addListener(function (message) {
        switch (message.type) {
            case 'initAssistant':
                var options = message.options;
                var localization = options.localization;
                var addRuleCallbackName = options.addRuleCallbackName;

                var onElementBlocked = function (ruleText, callback) {
                    contentPage.sendMessage({type: addRuleCallbackName, ruleText: ruleText}, callback);
                };

                var translateElement = function (element, msgId) {
                    var message = localization[msgId];
                    I18nHelper.translateElement(element, message);
                };

                if (abuAssistant) {
                    abuAssistant.destroy();
                } else {
                    abuAssistant = new AbuAssistant(balalaika, AbuSelectorLib, AdguardRulesConstructorLib);
                }

                var selectedElement = null;
                if (clickedEl && options.selectElement) {
                    selectedElement = clickedEl;
                }

                abuAssistant.init({
                    cssLink: options.cssLink,
                    onElementBlocked: onElementBlocked,
                    translateElement: translateElement,
                    selectedElement: selectedElement
                });
                break;
            case 'destroyAssistant':
                if (abuAssistant) {
                    abuAssistant.destroy();
                    abuAssistant = null;
                }
                break;
        }
    });

})();

