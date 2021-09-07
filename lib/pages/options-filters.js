const ABUFilters = function (params) {
    'use strict';
	
	const pageController = params.pageController;

    const loadedFiltersObj = {
        filters: [],
        categories: [],
        filtersById: {},
        categoriesById: {},
        lastUpdateTime: 0,
        CUSTOM_FILTERS_GROUP_ID: 0,
		
        initLoadedFilters(filters, categories) {
            this.filters = filters;
            this.categories = categories;
            for (let i = 0; i < this.categories.length; i++) {
                this.categoriesById[this.categories[i].groupId] = this.categories[i];
            }
	
            let lastUpdateTime = this.lastUpdateTime || 0;
            for (let i = 0; i < this.filters.length; i++) {
                let filter = this.filters[i];
                this.filtersById[filter.filterId] = filter;
				let timeUpdated = filter. lastUpdateTime || filter.timeUpdated
                if (timeUpdated > lastUpdateTime) {
                    lastUpdateTime = timeUpdated;
                }
            }
            this.lastUpdateTime = lastUpdateTime;
        },
		
		addFilter(filter) {
			this.filters.push(filter);
			this.categoriesById[filter.groupId].filters.push(filter);
			this.filtersById[filter.filterId] = filter;
		},
		
		removeFilter(filterId) {
			const filter = this.filtersById[filterId];
			delete this.filtersById[filterId];
			this.categoriesById[filter.groupId].filters = this.categoriesById[filter.groupId].filters.filter((f) => {
				return (f.filterId !== filterId);
			});

			this.filters = this.filters.filter((f) => {
				return (f.filterId !== filterId);
			});
		},
		
        isEnabled(filterId) {
            const filter = this.filtersById[filterId];
            return filter && filter.enabled;
        },

        updateCategoryEnabled(category, enabled) {
            const categoryInfo = this.categoriesById[category.groupId];
            if (categoryInfo) {
                categoryInfo.enabled = enabled;
            } else {
                this.categories.push(category);
                this.categoriesById[category.groupId] = category;
            }
        },

        updateEnabled(filter, enabled) {
            const filterInfo = this.filtersById[filter.filterId];
            if (filterInfo) {
                filterInfo.enabled = enabled;
            } else {
                this.filters.push(filter);
                this.filtersById[filter.filterId] = filter;
            }
        },
    };
	
	const toggleGlobalLoader = function (forceStop) {
		const el = $('#updateAbuFIlters').find('svg');
		if(forceStop || el.hasClass('active')) {
			el.removeClass('active');
		} else {
			el.addClass('active');
		}
	}

    renderFilterRulesInfo(params.rulesInfo);

    function getFiltersByGroupId(groupId, filters) {
        return filters.filter(f => f.groupId === groupId);
    }

    function getCategoryElement(groupId) {
        return $(`#group-${groupId}`);
    }

    function generateFiltersNamesDescription(filters) {
        const namesDisplayCount = 3;
        const enabledFiltersNames = filters
            .filter(filter => filter.enabled)
            .map(filter => (filter.name && filter.name.length > 0 ? filter.name : filter.subscriptionUrl));

        let enabledFiltersNamesString;
        const { length } = enabledFiltersNames;
		
		if(length == 0) return i18n.getMessage('options_no_filters_enabled');
		
        if (length > namesDisplayCount) {
            const displayNamesString = enabledFiltersNames.slice(0, namesDisplayCount).join(', ');
            enabledFiltersNamesString = i18n.getMessage('options_filters_enabled_and_more',[displayNamesString, (length - namesDisplayCount).toString()]);
        } else if (length > 1) {
            const lastName = enabledFiltersNames.slice(length - 1)[0];
            const firstNames = enabledFiltersNames.slice(0, length - 1);
            enabledFiltersNamesString = firstNames + ', ' + lastName;
        } else if (length === 1) {
            enabledFiltersNamesString = enabledFiltersNames[0];
        }
        enabledFiltersNamesString = `${i18n.getMessage('options_filters_enabled')} ${enabledFiltersNamesString}` 
        return enabledFiltersNamesString;
    }

    function updateCategoryFiltersInfo(groupId) {
        const groupFilters = getFiltersByGroupId(groupId, loadedFiltersObj.filters);
		const filtersNamesDescription = generateFiltersNamesDescription(groupFilters);
		const element = getCategoryElement(groupId);
		element.find('.desc').html(filtersNamesDescription);
    }

    function getFilterCategoryTpl(category) {
        return htmlToElement(`
                <tr id="group-${category.groupId}" class="row-filter" data-href="#abu-filters-${category.groupId}">
					<td class="column1">
						<div class="filter-group-icon group-${category.groupId}"></div>
					</td>
					<td class="column2">
						${category.groupName}
						
						<p class="desc"></p>
					</td>
					<td class="column3">
						<div class="loader">
							<svg height="18pt" viewBox="0 -24 495.6011 495" width="18pt" xmlns="http://www.w3.org/2000/svg"> <path d="m326.308594 7.046875c-137.425782-34.0625-266.496094 65.3125-277.871094 197.855469l31.871094 2.753906c9.023437-104.898438 104.046875-185.570312 211.296875-174.304688 95.871093 10.0625 171.199219 92.945313 172 189.328126.878906 106.609374-85.585938 193.617187-192 193.617187-4.929688 0-9.875-.195313-14.785157-.5625-8.207031-.621094-15.648437 4.769531-16.878906 12.914063l-.195312 1.277343c-1.34375 8.816407 5.089844 16.976563 13.984375 17.683594 5.9375.445313 11.921875.6875 17.875.6875 134.335937 0 241.421875-118.867187 221.628906-256.945313-12.734375-88.878906-79.773437-162.703124-166.925781-184.304687zm0 0" fill="#66bb6a" /> <g fill="#43a047"> <path d="m93.011719 359.496094c6.878906 9.085937 14.542969 17.757812 22.800781 25.742187l22.289062-22.976562c-7.074218-6.878907-13.664062-14.300781-19.585937-22.09375zm0 0" /> <path d="m156.757812 416.648438c9.886719 5.886718 20.253907 11.039062 30.796876 15.328124l12.035156-29.664062c-9.042969-3.664062-17.9375-8.097656-26.449219-13.167969zm0 0" /> <path d="m86.195312 274.3125-30.910156 8.320312c2.992188 11.070313 6.847656 22 11.503906 32.480469l29.246094-13.011719c-3.984375-8.957031-7.296875-18.300781-9.839844-27.789062zm0 0" /> </g> <path d="m62.164062 246.917969-57.472656-57.453125c-6.253906-6.242188-6.253906-16.386719 0-22.625 6.242188-6.242188 16.367188-6.242188 22.625 0l34.847656 34.832031 34.832032-34.832031c6.238281-6.242188 16.382812-6.242188 22.625 0 6.238281 6.238281 6.238281 16.382812 0 22.625zm0 0" fill="#81c784" /> </svg>
						</div>
						<label class="switch" tabindex="0">
							<input type="checkbox" name="group_id" value="${category.groupId}" ${(category.enabled !== false) ? 'checked="checked"' : ''}>
							<span class="slider round"></span>
						</label>
					</td>
                </tr>`);
    }

    function getFilterTemplate(filter, enabled, showDeleteButton) {
		
		const renderDelBtn = () => {
			return showDeleteButton ? `<a href="#" data-filter_id="${filter.filterId}" title="" class="remove-custom-filter"><i class="fa fa-trash"></i></a>` : '';
		}
		
        const renderUpdatedTime = (updateTime) => {
			const timeUpdatedText = convertDateToLocaleString(filter.timeUpdated || filter.lastUpdateTime);
            return (updateTime && timeUpdatedText !== '') ? `<span class="update">${i18n.getMessage('options_filters_updated')}: ${timeUpdatedText}</span>` : '';
        };
		
		const renderVersionTxt = (version) => {
			return version ? `${i18n.getMessage('version')}: ${version}` : '';
		}
		
		const renderHomePageLink = (filter) => {
			if(filter.homepage == undefined && filter.subscriptionUrl == undefined) return '';
			
			return `<a class="filter-link" target="_blank" href="${filter.homepage || filter.subscriptionUrl}">
						<svg width="12pt" height="12pt" version="1.1" id="Layer_01" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" style="enable-background:new 0 0 512 512;" xml:space="preserve"> <path d="M488.727,0H302.545c-12.853,0-23.273,10.42-23.273,23.273c0,12.853,10.42,23.273,23.273,23.273h129.997L192.999,286.09 c-9.087,9.087-9.087,23.823,0,32.912c4.543,4.543,10.499,6.816,16.455,6.816c5.956,0,11.913-2.273,16.455-6.817L465.455,79.458 v129.997c0,12.853,10.42,23.273,23.273,23.273c12.853,0,23.273-10.42,23.273-23.273V23.273C512,10.42,501.58,0,488.727,0z"></path> <path d="M395.636,232.727c-12.853,0-23.273,10.42-23.273,23.273v209.455H46.545V139.636H256c12.853,0,23.273-10.42,23.273-23.273 S268.853,93.091,256,93.091H23.273C10.42,93.091,0,103.511,0,116.364v372.364C0,501.58,10.42,512,23.273,512h372.364 c12.853,0,23.273-10.42,23.273-23.273V256C418.909,243.147,408.489,232.727,395.636,232.727z"></path> </svg>
					</a>`
		}
		
        return `<tr id="filter${filter.filterId}" class="filter-row filter-${(filter.enabled === false) ? 'disabled' : 'enabled'}">
					<td class="column2">
						<span class="filter-name">
							${filter.name && filter.name.length > 0 ? filter.name : filter.subscriptionUrl}
						</span>
						${renderHomePageLink(filter)}
						${renderDelBtn()}
						<p class="desc">${filter.description}</p>
						<p class="desc extra">
							<span class="version-txt">${renderVersionTxt(filter.version)}</span>
							${renderUpdatedTime(filter)}
						</p>						
					</td>
					<td class="column3">
						<div class="loader">
							<svg height="18pt" viewBox="0 -24 495.6011 495" width="18pt" xmlns="http://www.w3.org/2000/svg"> <path d="m326.308594 7.046875c-137.425782-34.0625-266.496094 65.3125-277.871094 197.855469l31.871094 2.753906c9.023437-104.898438 104.046875-185.570312 211.296875-174.304688 95.871093 10.0625 171.199219 92.945313 172 189.328126.878906 106.609374-85.585938 193.617187-192 193.617187-4.929688 0-9.875-.195313-14.785157-.5625-8.207031-.621094-15.648437 4.769531-16.878906 12.914063l-.195312 1.277343c-1.34375 8.816407 5.089844 16.976563 13.984375 17.683594 5.9375.445313 11.921875.6875 17.875.6875 134.335937 0 241.421875-118.867187 221.628906-256.945313-12.734375-88.878906-79.773437-162.703124-166.925781-184.304687zm0 0" fill="#66bb6a" /> <g fill="#43a047"> <path d="m93.011719 359.496094c6.878906 9.085937 14.542969 17.757812 22.800781 25.742187l22.289062-22.976562c-7.074218-6.878907-13.664062-14.300781-19.585937-22.09375zm0 0" /> <path d="m156.757812 416.648438c9.886719 5.886718 20.253907 11.039062 30.796876 15.328124l12.035156-29.664062c-9.042969-3.664062-17.9375-8.097656-26.449219-13.167969zm0 0" /> <path d="m86.195312 274.3125-30.910156 8.320312c2.992188 11.070313 6.847656 22 11.503906 32.480469l29.246094-13.011719c-3.984375-8.957031-7.296875-18.300781-9.839844-27.789062zm0 0" /> </g> <path d="m62.164062 246.917969-57.472656-57.453125c-6.253906-6.242188-6.253906-16.386719 0-22.625 6.242188-6.242188 16.367188-6.242188 22.625 0l34.847656 34.832031 34.832032-34.832031c6.238281-6.242188 16.382812-6.242188 22.625 0 6.238281 6.238281 6.238281 16.382812 0 22.625zm0 0" fill="#81c784" /> </svg>
						</div>
						<label class="switch">
							<input type="checkbox" name="filter_id" value="${filter.filterId}" ${enabled ? 'checked="checked"' : ''}>
							<span class="slider round"></span>
						</label>							
					</td>
                </tr>`;
    }
	
	const renderFilterCategory = (category) => {
        let categoryContainer = $(`#group_${category.groupId}_filters`);
        let categoryElement = $(`#group_${category.groupId}`);

        categoryElement = getFilterCategoryTpl(category);
        $('.filters-categories-container tbody').append(categoryElement);
        updateCategoryFiltersInfo(category.groupId);

        categoryContainer = getFiltersContentElement(category);
        $('#abu-filters').append(categoryContainer);
    }
	
	const customFilterModalSelector = '#customFilterModal';
	const addCustomFilterBtnSelector = '.addCustomFilterBtn';
	const noFilterContainerSelector = '.no-filters-container';
	
	const renderCustomFilterHtml = (hasFilters) => {
		return `<div class="text-center px-md-5 mx-md-5 dark-grey-text no-filters-container ${hasFilters ? 'd-none' : ''}">
					<div class="row mb-5">
						<div class="col-md-4 mx-auto">
							<div class="view mb-4 pb-2">
								<svg version="1.1" id="Capa_22" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" style="enable-background:new 0 0 512 512;" xml:space="preserve"> <g> <g> <path d="M451.449,168.599C447.967,162.061,441.204,158,433.797,158h-56.81c-4.743-26.675-28.087-47-56.104-47 c-28.017,0-51.361,20.325-56.104,47h-57.555c4.514-6.908,7.15-15.15,7.15-24c0-24.262-19.738-44-44-44c-24.262,0-44,19.738-44,44 c0,8.85,2.636,17.092,7.15,24H86.598c-7.407,0-14.17,4.061-17.652,10.599c-3.481,6.537-3.077,14.416,1.056,20.562l134.196,199.556 V502c0,3.372,1.699,6.517,4.52,8.364c1.653,1.083,3.562,1.636,5.481,1.636c1.354,0,2.713-0.275,3.992-0.832l92-40.063 c3.648-1.589,6.007-5.189,6.007-9.168v-73.221L450.393,189.16C454.526,183.015,454.931,175.136,451.449,168.599z M320.883,131 c16.937,0,31.241,11.443,35.616,27h-71.231C289.642,142.443,303.947,131,320.883,131z M170.375,110c13.233,0,24,10.767,24,24 c0,13.233-10.767,24-24,24c-13.233,0-24-10.767-24-24C146.375,120.767,157.142,110,170.375,110z M297.899,380.086 c-1.109,1.649-1.702,3.592-1.702,5.58v69.719l-72,31.353v-91.072h36.127c5.523,0,10-4.477,10-10s-4.477-10-10-10h-40.801 L118.88,226h202.003c5.523,0,10-4.477,10-10s-4.477-10-10-10H105.431l-18.829-28h347.194L297.899,380.086z"></path> </g> </g> <g> <g> <path d="M294.324,0c-24.262,0-44,19.738-44,44s19.739,44,44,44c24.262,0,44-19.738,44-44S318.586,0,294.324,0z M294.324,68c-13.233,0-24-10.767-24-24c0-13.233,10.767-24,24-24c13.233,0,24,10.767,24,24S307.557,68,294.324,68z"></path> </g> </g> <g> <g> <path d="M401.197,48.333c-5.523,0-10,4.477-10,10v56.834c0,5.524,4.477,10.001,10,10.001s10-4.477,10-10V58.333C411.197,52.81,406.72,48.333,401.197,48.333z"></path> </g> </g> <g> <g> <path d="M408.267,18.43c-1.86-1.86-4.44-2.93-7.07-2.93s-5.21,1.07-7.07,2.93s-2.93,4.44-2.93,7.07s1.07,5.21,2.93,7.07s4.44,2.93,7.07,2.93s5.21-1.07,7.07-2.93c1.86-1.86,2.93-4.44,2.93-7.07S410.127,20.29,408.267,18.43z"></path> </g> </g> <g> <g> <path d="M204.375,12.755c-5.523,0-10,4.477-10,10v41c0,5.523,4.477,10,10,10s10-4.477,10-10v-41C214.375,17.232,209.898,12.755,204.375,12.755z"></path> </g> </g> <g> <g> <path d="M68.197,0c-5.523,0-10,4.477-10,10v65.168c0,5.523,4.477,10,10,10s10-4.477,10-10V10C78.197,4.477,73.72,0,68.197,0z"></path> </g> </g> <g> <g> <path d="M75.267,105.6c-1.86-1.87-4.44-2.93-7.07-2.93s-5.21,1.06-7.07,2.93c-1.86,1.86-2.93,4.43-2.93,7.07c0,2.63,1.07,5.21,2.93,7.07s4.44,2.93,7.07,2.93s5.21-1.07,7.07-2.93c1.86-1.86,2.93-4.44,2.93-7.07C78.197,110.03,77.127,107.46,75.267,105.6z"></path> </g> </g> <g> <g> <path d="M372.417,208.93c-1.86-1.86-4.44-2.93-7.07-2.93c-2.64,0-5.22,1.07-7.07,2.93c-1.87,1.86-2.93,4.44-2.93,7.07s1.06,5.21,2.93,7.07c1.86,1.86,4.43,2.93,7.07,2.93c2.63,0,5.2-1.07,7.07-2.93c1.86-1.86,2.93-4.44,2.93-7.07S374.277,210.79,372.417,208.93z"></path> </g> </g> </svg>
							</div>
						</div>
					</div>
					<p class="text-center mx-auto mb-4 pb-2">${i18n.getMessage('options_no_custom_filters')}</p>
				</div>
				<button type="button" class="btn light-blue accent-4 addCustomFilterBtn" data-toggle="modal" data-target="${customFilterModalSelector}">${i18n.getMessage('options_add_custom_filter')}</button>`;
	}

    const getFiltersContentElement = (category) => {
        const { filters } = category;
        const isCustomFilters = category.groupId === 0;

        return htmlToElement(`
			<div id="abu-filters-${category.groupId}" class="abu-parent d-none ${isCustomFilters ? 'custom' : ''}">
				<div class="bread">
					<a href="#" class="filter-back">
						<svg version="1.1" id="Capa_01" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 443.52 443.52" style="enable-background:new 0 0 443.52 443.52;" xml:space="preserve"> <path d="M143.492,221.863L336.226,29.129c6.663-6.664,6.663-17.468,0-24.132c-6.665-6.662-17.468-6.662-24.132,0l-204.8,204.8 c-6.662,6.664-6.662,17.468,0,24.132l204.8,204.8c6.78,6.548,17.584,6.36,24.132-0.42c6.387-6.614,6.387-17.099,0-23.712 L143.492,221.863z"></path> </svg>
						${category.groupName}
					</a>
				</div>
				<table class="filters-table">
					<tbody>
					</tbody>
				</table>
				${isCustomFilters ? renderCustomFilterHtml((filters.length > 0)) : ''}
            </div>`);
    }
	
	const bindControls = () => {
		$(document).on('change','[name="filter_id"]',function(){
			toggleGlobalLoader();
			const tr = $(this).parents('tr:first');
			const filterId = this.value - 0;
			if ($(this).is(':checked')) {
				tr.removeClass('filter-disabled').addClass('filter-enabled');
				contentPage.sendMessage({type: 'addAndEnableFilter', filterId: filterId});
			} else {
				tr.removeClass('filter-enabled').addClass('filter-disabled');
				contentPage.sendMessage({type: 'disableAntiBannerFilter', filterId: filterId});
			}
		});
		
		$(document).on('change','[name="group_id"]',function(){
			toggleGlobalLoader();
			const groupId = $(this).val() - 0;
			if ($(this).is(':checked')) {
				contentPage.sendMessage({ type: 'enableFiltersGroup', groupId });
			} else {
				contentPage.sendMessage({ type: 'disableFiltersGroup', groupId });
			}
		});
		
		$(document).on('click','.row-filter .column1, .row-filter .column2',function(e){
			let href = $(this).parent().data('href');
			if(!href || href.length == 0) return false;
			$('#abu-filters-main').addClass('d-none');
			$(href).removeClass('d-none');
		});
		
		$(document).on('click','.filter-back', function(){
			clearSearch();
			$(this).parent().parent().addClass('d-none');
			$('#abu-filters-main').removeClass('d-none');
			return false;
		});

		$('#updateAbuFIlters').on('click', updateAntiBannerFilters);
		
		bindCustomFilterModalEvents();
    }

    const renderFiltersList = (target, filters) => {
		target.html('<tbody></tbody>');
        filters.forEach((filter) => {
			if(filter.filterId == AntiBannerFiltersId.ANTI_CIRCUMVENTION) return;	//ANTI_CIRCUMVENTION in settings tab
            const isEnabled = loadedFiltersObj.isEnabled(filter.filterId);
            const isCustom = filter.groupId === AntiBannerFiltersId.USER_FILTER_ID;
            const filterHtml = getFilterTemplate(filter, isEnabled, isCustom);
            target.append(htmlToElement(filterHtml));
        });
    };

    const renderFiltersInCategory = (groupId, filters) => {
		const el = $(`#abu-filters-${groupId} .filters-table`);
        if (el.length == 0) return;
		el.html('');
        renderFiltersList(el, filters);
    };
	
	const toggleFiltersByStatus = (status) => {
		$('.filter-row').addClass('d-none').removeClass('no-border');
		switch(status) {
			case 'all':
				$('.filter-row').removeClass('d-none');
				break;
			case '1':
				$('.filter-row.filter-enabled').removeClass('d-none');
				break;
			case '0':
				$('.filter-row.filter-disabled').removeClass('d-none');
				break;
		}
		$('.filter-row:visible:last').addClass('no-border');
	}
	
	const toggleFiltersByKeyword = (q) => {
		q = q.toLowerCase().trim();
		let parentContainer = $('.abu-parent:visible');
		const hideClass = 'no-keyword-found';
		if(q == '') {
			$(addCustomFilterBtnSelector).removeClass('d-none');
			if(parentContainer.length > 1) {
				$('#abu-filters-main').removeClass('d-none');
				$('.abu-parent').addClass('d-none');
			}
			$(`.${hideClass}`).removeClass(hideClass);
			return;
		} else {
			$(addCustomFilterBtnSelector).addClass('d-none');
			$(noFilterContainerSelector).addClass(hideClass);
		}
		if(parentContainer.length == 0) {	//global search
			parentContainer = $('#abu-filters');
			$('#abu-filters-main').addClass(hideClass);
			$('.abu-parent').removeClass('d-none');
			$('.bread').addClass(hideClass);
		} 
		parentContainer.find('.filter-row').addClass(hideClass);
		$.each(parentContainer.find('.filter-row'), function() {
			if($(this).find('.filter-name').text().trim().toLowerCase().search(q) > -1) {
				$(this).removeClass(hideClass);
			}
		});
		$('.filter-row:visible:last').addClass('no-border');
	}
	
    const initSearch = () => {
		const searchEl = $('.searchInput')
		const statusEl = $('.filterStatus');
		
        statusEl.on('change', function() {
            toggleFiltersByStatus($(this).val());
        });

        searchEl.on('input', pageController._debounce(() => {
           toggleFiltersByKeyword(searchEl.val());
        }, 250));

        $('.clearFilter').on('click', () => {
            statusEl.val('all').change();
			searchEl.val('');
			toggleFiltersByKeyword('');
        });
    };
	
	const clearSearch = () => {
		$('.clearFilter').trigger('click');
	}

    function renderOptionsPage() {
        const settingsBody = $('#abu-filters .filters-categories-container');
      
        contentPage.sendMessage({ type: 'getFiltersMetadata' }, (response) => {
            loadedFiltersObj.initLoadedFilters(response.filters, response.categories);
            setLastUpdatedTimeText(loadedFiltersObj.lastUpdateTime);

            const { categories, filters } = loadedFiltersObj;

            categories.forEach((category) => {
                renderFilterCategory(category);
                renderFiltersInCategory(category.groupId, category.filters);
            });
			
			initSearch();
            
			bindControls();
        });
		
    }
	
    function updateAntiBannerFilters(e) {
        e.preventDefault();
		toggleGlobalLoader();
        contentPage.sendMessage({ type: 'checkAntiBannerFiltersUpdate' }, () => {
			toggleGlobalLoader();
        });
    }
	
	function closeModal() {
		$(customFilterModalSelector).modal('hide');
	}
		
	function bindCustomFilterModalEvents() {
		$('.customFilterForm').on('submit', function() {
			const input = $(this).find('.filter-url');
			const url = input.val().trim();
			if(url == '') {
				input.focus();
				return false;
			}
			toggleGlobalLoader();

			contentPage.sendMessage({ type: 'subscribeToCustomFilter', url: url }, (result) => {
				const { filter, error } = result;
				if (error) {
					toggleGlobalLoader();
					pageController.showError(error);
				} else {
					$(noFilterContainerSelector).addClass('d-none');
					input.val('');
					closeModal();
					loadedFiltersObj.addFilter(filter);
					renderFiltersInCategory(loadedFiltersObj.CUSTOM_FILTERS_GROUP_ID, loadedFiltersObj.categoriesById[loadedFiltersObj.CUSTOM_FILTERS_GROUP_ID].filters);
				}
			});
			return false;
		});
		
		$(document).on('click','.remove-custom-filter',function(e){
			e.preventDefault();
			if (!confirm(i18n.getMessage('options_confirm_filter_delete'))) {
				return;
			}
			toggleGlobalLoader();
			contentPage.sendMessage({
				type: 'removeAntiBannerFilter', 
				filterId: $(this).data('filter_id') 
			});
			if($(this).parents('table:first').find('tr').length == 1) $(noFilterContainerSelector).removeClass('d-none');
			$(this).parents('tr:first').remove();
			loadedFiltersObj.removeFilter($(this).data('filter_id'));
			return false;
		});
		
		$(customFilterModalSelector).on('shown.bs.modal', function () {
			$(this).find('input').focus();
		});
	}

    const convertDateToLocaleString = function(date) {
        if (date) {
            const lastUpdateTime = moment(date);
            lastUpdateTime.locale(environmentOptions.Prefs.locale);
            return lastUpdateTime.format('Do MMMM, H:mm');
        }
        return '';
    };

    const setLastUpdatedTimeText = function(lastUpdateTime) {
        if (lastUpdateTime && lastUpdateTime >= loadedFiltersObj.lastUpdateTime) {
            loadedFiltersObj.lastUpdateTime = lastUpdateTime;
            $('#f_time').text(convertDateToLocaleString(lastUpdateTime));
        }
    }

    function renderFilterRulesInfo(info) {
		toggleGlobalLoader(true);
		const count = new Intl.NumberFormat().format(info.rulesCount);
        const message = i18n.getMessage("options_antibanner_info", [count]);
        $('.settings-page-title-info').text(message);
    }

    function updateFilterMetadata(filter) {
        const filterEl = $(`#filter${filter.filterId}`);
		filterEl.find('.loader').removeClass('active');
		$(filterEl).find('.version-txt').text(`${i18n.getMessage('version')}: ${filter.version}`);
		const localeDateString = convertDateToLocaleString(filter.lastUpdateTime || filter.timeUpdated);
		$(filterEl).find('.update').text(`${i18n.getMessage('options_filters_updated')}: ${localeDateString}`);
		$(filterEl).find('[type="checkbox"]').prop('checked',filter.enabled);
    }

    function onFilterStateChanged(filter) {
        loadedFiltersObj.updateEnabled(filter, filter.enabled);
        updateCategoryFiltersInfo(filter.groupId);
        updateFilterMetadata(filter);
    }

    function onCategoryStateChanged(category) {
        loadedFiltersObj.updateCategoryEnabled(category, category.enabled);
        updateCategoryFiltersInfo(category.groupId);
    }

    function onFilterDownloadStarted(filter) {
		$(`#filter${filter.filterId}`).find('.loader').addClass('active');
    }

    function onFilterDownloadFinished(filter) {
        updateFilterMetadata(filter);
        setLastUpdatedTimeText(filter.lastUpdateTime);
    }

    return {
        render: renderOptionsPage,
        renderFilterRulesInfo,
        onFilterStateChanged,
        onCategoryStateChanged,
        onFilterDownloadStarted,
        onFilterDownloadFinished
    };
};
