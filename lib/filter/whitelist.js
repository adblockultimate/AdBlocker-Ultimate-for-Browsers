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

abu.whitelist = (function (abu) {

    var WHITE_LIST_DOMAINS_LS_PROP = 'white-list-domains';
    var whiteListFilter = new abu.rules.UrlFilter();

    /**
     * Whitelist filter may not have been initialized yet
     * @returns {*|UrlFilter}
     */
    function getWhiteListFilter() {
        // Request domains property for filter initialization
        whiteListDomainsHolder.domains; 
        return whiteListFilter;
    }

    /**
     * Read domains and initialize filters lazy
     */
    var whiteListDomainsHolder = {
        get domains() {
            return abu.lazyGet(whiteListDomainsHolder, 'domains', function () {
                whiteListFilter = new abu.rules.UrlFilter();
                // Reading from local storage
                var domains = getDomainsFromLocalStorage(WHITE_LIST_DOMAINS_LS_PROP);
                for (var i = 0; i < domains.length; i++) {
                    let domain = domains[i];
                    
                    var rule = createWhiteListRule(domain);
                    if (rule) {
                        whiteListFilter.addRule(rule);
                    }

                    if(abu.utils.strings.startWith(domain, "www.")) {
                        domain = abu.utils.url.getCroppedDomainName(domain);
                    } else {
                        domain = `www.${domain}`;
                    }
                    rule = createWhiteListRule(domain);
                    whiteListFilter.addRule(rule);
                }
                return domains;
            });
        },
        add: function (domain) {
            if (this.domains.indexOf(domain) < 0) {
                this.domains.push(domain);
            }
        }
    };

    /**
     * Create whitelist rule from input text
     * @param domain Domain
     * @returns {*}
     * @private
     */
    function createWhiteListRule(domain) {
        domain = domain.trim();
        if (abu.utils.strings.isEmpty(domain)) {
            return null;
        }
        return abu.rules.builder.createRule("@@//" + domain + "$document", abu.utils.filters.WHITE_LIST_FILTER_ID);
    }

    /**
     * Adds domain to array of whitelist domains
     * @param domain
     */
    function addDomainToWhiteList(domain) {
        if (!domain) {
            return;
        }
		whiteListDomainsHolder.add(domain);
    }

    /**
     * Remove domain form whitelist domains
     * @param domain
     */
    function removeDomainFromWhiteList(domain) {
        if (!domain) {
            return;
        }
		abu.utils.collections.removeAll(whiteListDomainsHolder.domains, domain);
    }

    /**
     * Save domains to local storage
     */
    function saveDomainsToLocalStorage() {
        abu.localStorage.setItem(WHITE_LIST_DOMAINS_LS_PROP, JSON.stringify(whiteListDomainsHolder.domains));
    }

    /**
     * Retrieve domains from local storage
     * @param prop
     * @returns {Array}
     */
    function getDomainsFromLocalStorage(prop) {
        var domains = [];
        try {
            var json = abu.localStorage.getItem(prop);
            if (json) {
                domains = JSON.parse(json);
            }
        } catch (ex) {
            abu.console.error("Error retrieve whitelist domains {0}, cause {1}", prop, ex);
        }
        return domains;
    }

    /**
     * Adds domain to whitelist
     * @param domain
     */
    function addToWhiteList(domain, saveToLS) {
        domain = domain.trim();
        domain = abu.utils.strings.trimSlashes(domain);
        
        if(abu.utils.strings.isEmpty(domain)) return false;

        if(abu.utils.url.isHttpRequest(domain)) {
            domain = abu.utils.url.trimHttp(domain);
        }
        
        if(saveToLS === undefined) saveToLS = true;

        let rule = createWhiteListRule(domain);
        if (rule) {
            getWhiteListFilter().addRule(rule);
            if(abu.utils.strings.startWith(domain, "www.")) {
                domain = abu.utils.url.getCroppedDomainName(domain);
            } else {
                const domainWithWww = `www.${domain}`;
                rule = createWhiteListRule(domainWithWww);
                getWhiteListFilter().addRule(rule);
            }
            addDomainToWhiteList(domain);
            if(saveToLS) saveDomainsToLocalStorage();
        }
    }

    /**
     * Search for whitelist rule by url.
     */
    var findWhiteListRule = function (url) {
        if (!url) {
            return null;
        }
        const domain = abu.utils.url.getHost(url);
		return getWhiteListFilter().isFiltered(url, domain, abu.RequestTypes.DOCUMENT, false);
    };

    /**
     * Stop filtration for url
     * @param url
     */
    var whiteListUrl = function (url) {
        let domain = abu.utils.url.getHost(url);
		addToWhiteList(domain);
        abu.listeners.notifyListeners(abu.listeners.UPDATE_WHITELIST_FILTER_RULES);
    };

    /**
     * Start (or stop in case of inverted mode) filtration for url
     * @param url
     */
    var unWhiteListUrl = function (url) {
        const domain = abu.utils.url.getHost(url);
		removeFromWhiteList(domain);
        abu.listeners.notifyListeners(abu.listeners.UPDATE_WHITELIST_FILTER_RULES);
    };

    /**
     * Add domains to whitelist
     * @param domains
     */
    var addToWhiteListArray = function (domains) {
        if (!domains) {
            return;
        }
        var rules = [];
        for (var i = 0; i < domains.length; i++) {
            const domain = domains[i];
            addToWhiteList(domain, false);
        }
        saveDomainsToLocalStorage();
        abu.listeners.notifyListeners(abu.listeners.UPDATE_WHITELIST_FILTER_RULES);
    };

    /**
     * Remove domain from whitelist
     * @param domain
     */
    var removeFromWhiteList = function (domain) {
        let rule = createWhiteListRule(domain);
        if (rule) {
            getWhiteListFilter().removeRule(rule);
        }

        if(abu.utils.strings.startWith(domain, "www.")) {
            domain = abu.utils.url.getCroppedDomainName(domain);
            
            const domainNonWww = domain.replace("www.","");
            rule = createWhiteListRule(domainNonWww);
            if (rule) {
                getWhiteListFilter().removeRule(rule);
            }
        } else {
            const domainWww = `www.${domain}`;
            rule = createWhiteListRule(domainWww);
            if (rule) {
                getWhiteListFilter().removeRule(rule);
            }
        }
        
        removeDomainFromWhiteList(domain);
        saveDomainsToLocalStorage();
        abu.listeners.notifyListeners(abu.listeners.UPDATE_WHITELIST_FILTER_RULES);
    };

    /**
     * Clear whitelist
     */
    var clearWhiteList = function () {
		abu.localStorage.removeItem(WHITE_LIST_DOMAINS_LS_PROP);
        abu.lazyGetClear(whiteListDomainsHolder, 'domains');
        whiteListFilter = new abu.rules.UrlFilter();
        // abu.listeners.notifyListeners(abu.listeners.UPDATE_WHITELIST_FILTER_RULES);
    };

    /**
     * Returns the array of whitelist domains
     */
    var getWhiteListDomains = function () {
		return whiteListDomainsHolder.domains;
    };
    
    /**
     * Returns the array of loaded rules
     */
    var getRules = function () {
        return getWhiteListFilter().getRules();
    };
    
    /**
     * Initializes whitelist filter
     */
    var init = function () {
        abu.lazyGetClear(whiteListDomainsHolder, 'domains');
    };

    return {

        init: init,
        getRules: getRules,
        getWhiteListDomains: getWhiteListDomains,

        findWhiteListRule: findWhiteListRule,

        whiteListUrl: whiteListUrl,
        unWhiteListUrl: unWhiteListUrl,

        addToWhiteList: addToWhiteList,
        addToWhiteListArray: addToWhiteListArray,

        removeFromWhiteList: removeFromWhiteList,
        clearWhiteList: clearWhiteList
    };

})(abu);

