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

(function (abu, api) {

    'use strict';

    /**
     * Method that parses rule text and creates object of a suitable class.
     *
     * @param ruleText Rule text
     * @param filterId Filter identifier
     * @returns Filter rule object. Either UrlFilterRule or CssFilterRule or ScriptFilterRule or ScriptletRule.
     */
    var _createRule = function (ruleText, filterId) {
        ruleText = ruleText ? ruleText.trim() : null;
        if (!ruleText) {
            return null;
        }
        var rule = null;
        try {

            var StringUtils = abu.utils.strings;

            if (StringUtils.startWith(ruleText, api.FilterRule.COMMENT) || ruleText.includes('##^') ) { // comment or uBO HTML filters
                return null;
            }

            if (StringUtils.startWith(ruleText, api.FilterRule.MASK_WHITE_LIST)) {
                return new api.UrlFilterRule(ruleText, filterId);
            }

            if (api.FilterRule.findRuleMarker(ruleText, api.CssFilterRule.RULE_MARKERS, api.CssFilterRule.RULE_MARKER_FIRST_CHAR)) {
                return new api.CssFilterRule(ruleText, filterId);
            }
            
            if (api.FilterRule.findRuleMarker(ruleText, api.ScriptFilterRule.RULE_MARKERS, api.ScriptFilterRule.RULE_MARKER_FIRST_CHAR)) {
                if (api.ScriptletRule.isAdguardScriptletRule(ruleText)) {
                    return new api.ScriptletRule(ruleText, filterId);
                }

                return new api.ScriptFilterRule(ruleText, filterId);
            }

            return new api.UrlFilterRule(ruleText, filterId);
        } catch (ex) {            
            abu.console.warn("Cannot create rule from filter {0}: {1}, cause {2}", filterId, ruleText, ex);
        }
        return rule;
    };

    /**
     * Convert rules to ABU syntax and create rule
     *
     * @param {string} ruleText Rule text
     * @param {number} filterId Filter identifier
     * @param {boolean} isTrustedFilter - custom filter can be trusted and untrusted,
     * default is true
     * @returns Filter rule object. Either UrlFilterRule or CssFilterRule or ScriptFilterRule.
     */
    const createRule = (ruleText, filterId) => {
        let conversionResult;
        try {
            conversionResult = api.ruleConverter.convertRule(ruleText);
        } catch (ex) {
            abu.console.debug('Cannot convert rule from filter {0}: {1}, cause {2}', filterId || 0, ruleText, ex);
        }
        if (!conversionResult) {
            return null;
        }
        if (Array.isArray(conversionResult)) {
            const rules = conversionResult
                .map(rt => _createRule(rt, filterId))
                .filter(rule => rule !== null);
            // composite rule shouldn't be with without rules inside it
            if (rules.length === 0) {
                return null;
            }
            return new api.CompositeRule(ruleText, rules);
        }
        const rule = _createRule(conversionResult, filterId);
        if (rule && conversionResult !== ruleText) {
            rule.ruleText = ruleText;
            rule.convertedRuleText = conversionResult;
        }
        return rule;
    };

    api.builder = {
        createRule
    };

})(abu, abu.rules);
