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
/* global $, contentPage, i18n, moment */
var PageController = function () {
};

PageController.prototype = {    
    listenerId: false,
    timeoutId: null,
	
    init: function () {
        this._bindEvents();
        this._render();
    },

    _bindEvents: function () {
		this.showPageStatisticCheckbox = $("#showPageStatisticCheckbox");
		this.autodetectFiltersCheckbox = $("#autodetectFiltersCheckbox");
		this.antiCircumvationCheckbox = $("#antiCircumvationCheckbox");
		
		this.showPageStatisticCheckbox.on('change', this.showPageStatisticsChange);
		this.autodetectFiltersCheckbox.on('change', this.autodetectFiltersChange);
		this.antiCircumvationCheckbox.on('change', this.antiCircumvationChange);
		
		$('.openExtensionStore').on('click', function(e){
            e.preventDefault();
            contentPage.sendMessage({ type: 'openExtensionStore' });
			return false;
        });
		
		new CBPFWTabs($('.tabs')[0]);
    },

    _render: function () {
        var showPageStats = !userSettings.values[userSettings.names.DISABLE_SHOW_PAGE_STATS];
        var autodetectFilters = !userSettings.values[userSettings.names.DISABLE_DETECT_FILTERS];
        var antiCircumvation = !userSettings.values[userSettings.names.DISABLE_ANTI_CIRCUMVENTION];
		
        this.customRules = new CustomRules({pageController: this});
		
        this.customRules.updateCustomRules();
		
		this.whiteListRules = new WhiteListRules({pageController: this});
        this.whiteListRules.updateWhiteListDomains();
		
		this.antiBannerFilters = new ABUFilters({ rulesInfo: requestFilterInfo, pageController: this });
        this.antiBannerFilters.render();

        this._renderShowPageStatistics(showPageStats);
        this._renderAutodetectFilters(autodetectFilters);
		
        this._renderAntiCircumvation(antiCircumvation);
        $('.versionNumberContainer').text(environmentOptions.appVersion);
    },
	
	showError: function(text) {
		$('.global-alert').removeClass('alert-success').addClass('alert-danger');
		this._showAlert(text);
	},
	
	showSucc: function(text) {
		$('.global-alert').addClass('alert-success').removeClass('alert-danger');
		this._showAlert(text);
	},
	
	_showAlert: function(text) {
		let global_alert = $('.global-alert');
		global_alert.text(text);
		global_alert.fadeIn();
		setTimeout(() => {
			global_alert.fadeOut();
		}, 5000);
	},

    showPageStatisticsChange: function () {
        contentPage.sendMessage({
            type: 'changeUserSetting',
            key: userSettings.names.DISABLE_SHOW_PAGE_STATS,
            value: !this.checked
        });
    },

    autodetectFiltersChange: function () {
        contentPage.sendMessage({
            type: 'changeUserSetting',
            key: userSettings.names.DISABLE_DETECT_FILTERS,
            value: !this.checked
        });
    },

    antiCircumvationChange: function () {
        contentPage.sendMessage({
            type: 'changeUserSetting',
            key: userSettings.names.DISABLE_ANTI_CIRCUMVENTION,
            value: !this.checked
        });
		if(this.checked) {
			contentPage.sendMessage({type: 'addAndEnableFilter', filterId: AntiBannerFiltersId.ANTI_CIRCUMVENTION});
		} else {			
			contentPage.sendMessage({type: 'disableAntiBannerFilter', filterId: AntiBannerFiltersId.ANTI_CIRCUMVENTION});
		}
    },

    _renderShowPageStatistics: function (showPageStatistic) {
        this.showPageStatisticCheckbox.updateCheckbox(showPageStatistic);
    },

    _renderAutodetectFilters: function (autodectedFilters) {
        this.autodetectFiltersCheckbox.updateCheckbox(autodectedFilters);
    },
	
    _renderAntiCircumvation: function (antiCircumvation) {
        this.antiCircumvationCheckbox.updateCheckbox(antiCircumvation);
    },
    
    _debounce: function (func, wait) {
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


var userSettings;
var enabledFilters;
var environmentOptions;
var AntiBannerFiltersId;
var EventNotifierTypes;
var requestFilterInfo;
var contentBlockerInfo;

contentPage.sendMessage({type: 'initializeFrameScript'}, function (response) {
    if(response == undefined) return;

    userSettings = response.userSettings;
    enabledFilters = response.enabledFilters;
    environmentOptions = response.environmentOptions;
    requestFilterInfo = response.requestFilterInfo;
    contentBlockerInfo = response.contentBlockerInfo;

    AntiBannerFiltersId = response.constants.AntiBannerFiltersId;
    EventNotifierTypes = response.constants.EventNotifierTypes;

    $(document).ready(function () {

        var controller = new PageController();
        controller.init();

        var events = [
			EventNotifierTypes.FILTER_GROUP_ENABLE_DISABLE,
            EventNotifierTypes.FILTER_ENABLE_DISABLE,
            EventNotifierTypes.ADD_FILTER,
            EventNotifierTypes.REMOVE_FILTER,
            EventNotifierTypes.START_DOWNLOAD_FILTER,
            EventNotifierTypes.SUCCESS_DOWNLOAD_FILTER,
            EventNotifierTypes.ERROR_DOWNLOAD_FILTER,
            EventNotifierTypes.UPDATE_USER_FILTER_RULES,
            EventNotifierTypes.UPDATE_WHITELIST_FILTER_RULES,
            EventNotifierTypes.CONTENT_BLOCKER_UPDATED,
            EventNotifierTypes.REQUEST_FILTER_UPDATED
        ];

        function eventListener(event, filter) {
            switch (event) {
				case EventNotifierTypes.FILTER_GROUP_ENABLE_DISABLE:
                    controller.antiBannerFilters.onCategoryStateChanged(filter);
                    break;
                case EventNotifierTypes.FILTER_ENABLE_DISABLE:
                    if(filter.filterId != AntiBannerFiltersId.ANTI_CIRCUMVENTION){ 
						controller.antiBannerFilters.onFilterStateChanged(filter);
					}
                    break;
                case EventNotifierTypes.ADD_FILTER:
                case EventNotifierTypes.REMOVE_FILTER:
					controller.antiBannerFilters.render();
                    break;
                case EventNotifierTypes.START_DOWNLOAD_FILTER:
                    controller.antiBannerFilters.onFilterDownloadStarted(filter);
                    break;
                case EventNotifierTypes.SUCCESS_DOWNLOAD_FILTER:
                case EventNotifierTypes.ERROR_DOWNLOAD_FILTER:
					controller.antiBannerFilters.onFilterDownloadFinished(filter);
                    break;
                case EventNotifierTypes.UPDATE_USER_FILTER_RULES:
					controller.customRules.updateCustomRules();
					controller.antiBannerFilters.renderFilterRulesInfo(filter);
                    break;
                case EventNotifierTypes.UPDATE_WHITELIST_FILTER_RULES:
					controller.whiteListRules.updateWhiteListDomains();
                    break;
                case EventNotifierTypes.REQUEST_FILTER_UPDATED:
                    // Don't react on this event. If ContentBlockerEnabled CONTENT_BLOCKER_UPDATED event will be received.
                    if (environmentOptions.isContentBlockerEnabled) {
                        break;
                    }
                    controller.antiBannerFilters.renderFilterRulesInfo(filter);
                    break;
                case EventNotifierTypes.CONTENT_BLOCKER_UPDATED:
                    controller.antiBannerFilters.renderFilterRulesInfo(filter);
                    break;
            }
        }

        var listenerId;

        contentPage.sendMessage({type: 'addEventListener', events: events}, function (response) {
            listenerId = response.listenerId;
        });
        contentPage.onMessage.addListener(function (message) {
            if (message.type == 'notifyListeners') {
                eventListener.apply(this, message.args);
            }
        });

        var onUnload = function () {
            if (listenerId) {
                contentPage.sendMessage({type: 'removeListener', listenerId: listenerId});
                listenerId = null;
            }
        };

        //unload event
        $(window).on('beforeunload', onUnload);
        $(window).on('unload', onUnload);
		
		
        const yearElems = document.querySelectorAll('.js-current-year');

        yearElems.forEach((elem) => {
            elem.innerText = new Date().getFullYear();;
        });

    });
});

