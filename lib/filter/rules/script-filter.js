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
     * Filter that manages JS injection rules.
     */
    const ScriptFilter = function (rules) {
        this.scriptRules = [];
        this.exceptionsRules = [];

        if (rules) {
            for (let i = 0; i < rules.length; i++) {
                this.addRule(rules[i]);
            }
        }
    };

    ScriptFilter.prototype = {

        /**
         * Adds JS injection rule
         *
         * @param rule Rule object
         */
        addRule(rule) {
            if (rule.whiteListRule) {
                this.exceptionsRules.push(rule);
                this._applyExceptionRuleToFilter(rule);
                return;
            }

            this._applyExceptionRulesToRule(rule);
            this.scriptRules.push(rule);
        },

        /**
         * Removes JS injection rule
         *
         * @param rule Rule object
         */
        removeRule(rule) {
            abu.utils.collections.removeRule(this.scriptRules, rule);
            abu.utils.collections.removeRule(this.exceptionsRules, rule);
            this._rollbackExceptionRule(rule);
        },

        /**
         * Removes all rules from this filter
         */
        clearRules() {
            this.scriptRules = [];
            this.exceptionsRules = [];
        },

        /**
         * Returns the array of loaded rules
         */
        getRules() {
            return this.scriptRules.concat(this.exceptionsRules);
        },

        /**
         * Builds script for the specified domain to be injected
         *
         * @param domainName Domain name
         * @param {Object} debugConfig
         * @returns {{scriptSource: string, rule: string}[]} List of scripts to be applied
         * and scriptSource
         */
        buildScript(domainName, debugConfig) {
            const scripts = [];
            for (let i = 0; i < this.scriptRules.length; i += 1) {
                const rule = this.scriptRules[i];
                if (rule.isPermitted(domainName)) {
                    const script = rule.getScript(debugConfig);
                    if (script) {
                        scripts.push({
                            scriptSource: rule.scriptSource,
                            script,
                            rule,
                        });
                    }
                }
            }
            return scripts;
        },

        /**
         * Rolls back exception rule:
         *
         * @param exceptionRule Exception rule
         * @private
         */
        _rollbackExceptionRule(exceptionRule) {
            if (!exceptionRule.whiteListRule) {
                return;
            }

            for (let i = 0; i < this.scriptRules.length; i++) {
                const scriptRule = this.scriptRules[i];
                if (scriptRule.getRuleContent() === exceptionRule.getRuleContent()) {
                    scriptRule.removeRestrictedDomains(exceptionRule.getPermittedDomains());
                }
            }
        },

        /**
         * Applies exception rule:
         *
         * @param exceptionRule Exception rule
         * @private
         */
        _applyExceptionRuleToFilter(exceptionRule) {
            for (let i = 0; i < this.scriptRules.length; i++) {
                this._removeExceptionDomains(this.scriptRules[i], exceptionRule);
            }
        },

        /**
         * Applies exception rules:
         *
         * @param scriptRule JS injection rule
         * @private
         */
        _applyExceptionRulesToRule(scriptRule) {
            for (let i = 0; i < this.exceptionsRules.length; i++) {
                this._removeExceptionDomains(scriptRule, this.exceptionsRules[i]);
            }
        },

        _removeExceptionDomains(scriptRule, exceptionRule) {
            if (scriptRule.getRuleContent() !== exceptionRule.getRuleContent()) {
                return;
            }

            scriptRule.addRestrictedDomains(exceptionRule.getPermittedDomains());
        },
    };

    api.ScriptFilter = ScriptFilter;
})(abu, abu.rules);
