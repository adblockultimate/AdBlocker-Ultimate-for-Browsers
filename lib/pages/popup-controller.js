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

/* global $, i18n, popupPage */

/**
 * Controller that manages add-on popup window
 */
const PopupController = function() {
    'use strict';
    
    let $statsContainer, $desktopContainer;
    const disabledClass = 'disabled';
    const dNone = 'd-none';
    const statusInactive = 'page-status--inactive';
	
    /**
     * Renders popup using specified model object
     * @param tabInfo
     */
    const render = (tabInfo, options) => {
        $statsContainer = $('#stats_container');
        $desktopContainer = $('#desktop_conteiner');

        renderPopup(tabInfo, options);
        bindActions(tabInfo);
    }

    const addWhiteListDomain = (url) => {
        popupPage.sendMessage({type: 'addWhiteListDomainPopup', url: url});
    }

    const removeWhiteListDomain = (url) => {
        popupPage.sendMessage({type: 'removeWhiteListDomainPopup', url: url});
    }
    
    const openSettingsTab = () => {
        popupPage.sendMessage({type: 'openSettingsTab'});
    }

    const openAssistantInTab = () => {
        popupPage.sendMessage({type: 'openAssistant'});
    }
    
    const formatNumber = (v) => {
        return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    const renderPopup = (tabInfo, options) => {
        if(!options.offetAbuWindows) {
            $('.abu-windows-parent').addClass(dNone);
        }
        if(options.isAbuDesktopActive) {
            showAbuWindowsInfo();
        } else {
            updateTotalBlocked(tabInfo);
        }
        
        if(options.isMobile) {
            $('.ic.ic-enable').removeClass('ic-enable');
            $('body').addClass('mobile');
            $('.open-assistent').remove();
        }

        if(tabInfo.canAddRemoveRule) { 
            renderAdblockStatus(!tabInfo.documentWhiteListed);
        } else {
            toggleUserAction(tabInfo.isHttpRequest);
        }
        
        if(tabInfo.urlFilteringDisabled) {
            $('.tab-url').text(tabInfo.url);
        } else {
            $('.tab-url').text(tabInfo.domainName ? tabInfo.domainName : tabInfo.url);
        }
    }

    const showAbuWindowsInfo = () => {
        $statsContainer.addClass(dNone);
        $desktopContainer.removeClass(dNone);
    }

    const updateTotalBlocked = (tabInfo) => {
        const {totalBlockedTab, totalBlocked} = tabInfo;

        $statsContainer.removeClass(dNone);
        $desktopContainer.addClass(dNone);

        $('.stats-page').text(formatNumber(totalBlockedTab));
        $('.stats-total').text(formatNumber(totalBlocked));
    }


    const toggleUserAction = (isHttpRequest) => {
        const elements = $('.open-assistent, .toggleSwitch');
        $.each(elements, function(){
            $(this).addClass(disabledClass);
        });

        const $pageStatus = $('.page-status');
        let statusKey;
        
        if(!isHttpRequest) { 
            statusKey = 'popup_secure_page';
            $pageStatus.removeClass(statusInactive);
        } else {
            statusKey = 'popup_status_inactive';
            $pageStatus.addClass(statusInactive);
        }
        $pageStatus.html(i18n.getMessage(statusKey));
    }
    
    const renderAdblockStatus = (active) => {
        const blocks = $('.page-status, .container, .content, .open-assistent');

        let statusKey, statusLabel;
        $('.hedgehog').addClass(dNone);
        $("#toggle").prop("checked", active);
        if(active) {
            $('.hedgehog.enabled').removeClass(dNone);
            blocks.removeClass(disabledClass);
            statusKey = 'popup_protection_enabled';
            statusLabel = 'popup_enabled_on_site';
        } else {
            $('.hedgehog.disabled').removeClass(dNone);
            blocks.addClass(disabledClass);
            statusKey = 'popup_protection_disabled';
            statusLabel = 'popup_disabled_on_site';
        }
        $('.page-status').removeClass(statusInactive).html(i18n.getMessage(statusKey));
        $('.checkbox-label').html(i18n.getMessage(statusLabel));
    }

    let actionsBind = false;
    
    const bindActions = (tabInfo) => {

        const parent = $('body');
        
        if (actionsBind === true) {
            return;
        }
        actionsBind = true;

        parent.on('click', '.open-settings', function (e) {
            e.preventDefault();
            openSettingsTab();
            popupPage.closePopup();
        });

        parent.on('click', '.open-assistent', function (e) {
            e.preventDefault();
            if($(this).hasClass(disabledClass)) return false;
            openAssistantInTab();
            popupPage.closePopup();
        });
        
        parent.on('click', '.toggleSwitch', function (e) {
            e.preventDefault();
            if($(this).hasClass(disabledClass)) return false;
            const checkbox = $(this).find('[type="checkbox"]');
            checkbox.prop('checked', !checkbox.is(':checked')).change();
        });

        parent.on('click', '.social', function (){
            popupPage.sendMessage({
                type: 'openShareSocialLink', 
                network: $(this).data('social'), 
                totalBlocked: tabInfo.totalBlocked
            });
        });

        parent.on('click', '.open-url', function(){
            const url = $(this).data('url');
            openLink(url);
        });
        
        parent.on('click', '.openSettings', function (e) {
            e.preventDefault();
            openSettingsTab();
            popupPage.closePopup();
        });

        parent.on('change', '#toggle', function () {
            const isWhiteListed = !$(this).is(':checked');
            
            renderAdblockStatus(!isWhiteListed);

            if (isWhiteListed) {
                addWhiteListDomain(tabInfo.url);
            } else {
                removeWhiteListDomain(tabInfo.url);
            }
        });
    }

    const openLink = (url) => {
        popupPage.sendMessage({type: 'openTab', url: url});
    }

    return {
        render,
        updateTotalBlocked
    }
};

(function () {
    const controller = new PopupController();

    popupPage.sendMessage({type: 'getTabInfoForPopup'}, function (message) {
        $(document).ready(function () {
            const {frameInfo, options} = message;
            controller.render(frameInfo, options);
        });
    });

    popupPage.onMessage.addListener((message) => {
        switch (message.type) {
            case 'updateTotalBlocked': {
                const { tabInfo } = message;
                controller.updateTotalBlocked(tabInfo);
                break;
            }
            default:
                break;
        }
    });
})();
