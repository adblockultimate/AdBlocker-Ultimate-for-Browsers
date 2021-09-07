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
 * Global stats
 */
abu.pageStats = (function (abu) {

    'use strict';

    var pageStatisticProperty = "page-statistic";

    var userRankProperty        = "user-rank";
    var userRatedProperty       = "user-rated";
    var userShowBadgeAgain      = "user-show-badge";

    const userRanks = [
		{rank: 0, rankAt: 0},
		{rank: 1, rankAt: 1000},	 
		{rank: 2, rankAt: 10000}
	];

    var pageStatsHolder = {
        /**
         * Getter for total page stats (gets it from local storage)
         *
         * @returns {*}
         * @private
         */
        get stats() {
            return abu.lazyGet(pageStatsHolder, 'stats', function () {
                var stats;
                try {
                    var json = abu.localStorage.getItem(pageStatisticProperty);
                    if (json) {
                        stats = JSON.parse(json);
                    }
                } catch (ex) {
                    abu.console.error('Error retrieve page statistic from storage, cause {0}', ex);
                }
                return stats || Object.create(null);
            });
        },

        save: function () {
            if (this.saveTimeoutId) {
                clearTimeout(this.saveTimeoutId);
            }
            this.saveTimeoutId = setTimeout(function () {
                abu.localStorage.setItem(pageStatisticProperty, JSON.stringify(this.stats));
            }.bind(this), 1000);
        },

        clear: function () {
            abu.localStorage.removeItem(pageStatisticProperty);
            abu.lazyGetClear(pageStatsHolder, 'stats');
        }
    };

    var setShowBadgeAgain = function(val){
      abu.localStorage.setItem(userShowBadgeAgain, !val);
    };

    const getShowBadgeAgain = () => {
		let showBadge = abu.localStorage.getItem(userShowBadgeAgain);
		if(showBadge !== 0){
			showBadge = 1;
		}
		return showBadge;
    };

    const updateUserRank = (rank) => {
        setTimeout(function(){ 
            abu.localStorage.setItem(userRankProperty, rank);
        }, 1000);
        // if(getShowBadgeAgain() === 0) return;
        if(rank == 2 && (!abu.utils.browser.isWindowsOs() || abu.settings.isAbuDesktopInstlled())) {    //do not offer abu desktop of not windows OS or already installed
            return;
        }
		abu.ui.openUserPromotedPanel(rank);
    };
	
    const getUserRank = () => {
        return abu.localStorage.getItem(userRankProperty) || 0;
    };
	
    var didUserRate = function(){
		return abu.localStorage.getItem(userRatedProperty) || 0;
    };
	
    var updateUserRated = function(rated){
		abu.localStorage.setItem(userRatedProperty, rated);
    };

    /**
     * Total count of blocked requests
     *
     * @returns Count of blocked requests
     */
    var getTotalBlocked = function () {
        var stats = pageStatsHolder.stats;
        if (!stats) {
            return 0;
        }
        return stats.totalBlocked || 0;
    };

    /**
     * Updates total count of blocked requests
     *
     * @param blocked Count of blocked requests
     */
    const updateTotalBlocked = (blocked) => {
        const { stats } = pageStatsHolder;
        const currentRank = getUserRank();
	
        stats.totalBlocked = (stats.totalBlocked || 0) + blocked;
        
        pageStatsHolder.save();

        if(!abu.prefs.mobile) {   //do not show badges on mobile
            
            let newRank = 0;
            for(let i = currentRank; i < userRanks.length; i++){
                newRank = i;
                if(stats.totalBlocked < userRanks[i]['rankAt']){
                    newRank--;
                    break;
                }
            }
            if(newRank > currentRank) { 
                updateUserRank(currentRank + 1);
            }
		}
		
    };

    /**
     * Resets tab stats
     */
    var resetStats = function () {
        pageStatsHolder.clear();
    };

    return {
        setShowBadgeAgain,
        getShowBadgeAgain,
        updateUserRank,
        getUserRank,
        didUserRate,
        updateUserRated,
        resetStats,
        updateTotalBlocked,
        getTotalBlocked
    };

})(abu);