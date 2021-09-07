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
var AbuAssistant = function ($, AbuSelectorLib, AdguardRulesConstructorLib) { 

	/**
	 * Contains assistant settings (style, callbacks)
	 */
	var settings = {
		cssLink: null,
		onElementBlocked: null, // Called when element is blocked,
		translateElement: null // Called when element needs to be translated
	};

	// Iframe identifier
	var iframeId = 'abu-assistant-dialog';

	// Current preview style element
	var previewStyle = null;

	/**
	 * Contains selected element and info about it
	 */
	var selected = {
		element: null,
		elementInfo: null
	};

	var constants = {
		iframe: {//maximum values for all browsers was leaved for compatibility
			baseWidth: 668,
			extendDetailedSettingsHeight: 503,
			detailedMenuHeight: 360,
			selectorMenuHeight: 213,
			topOffset: 25,
			'z-index': 99999999999
		}
	};

	var ignoreClassName = AbuSelectorLib.ignoreClassName();

	var utils = {

		debounce: function (func, wait) {
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
		},

		getAllChildren: function (element) {
			var childArray = [];
			var child = element;
			while ((child = utils.getChildren(child))) {
				childArray.push(child);
			}
			return childArray;
		},

		getChildren: function (element) {

			var count = 0;
			var child;

			var children = element.childNodes;
			if (children) {
				var i;
				for (i = 0; i < children.length; i++) {
					if (children[i].nodeType == 1) {
						child = children[i];
						count++;
					}
				}
			}
			return count == 1 ? child : null;
		},

		getParentsLevel: function (element) {
			var parent = element;
			var parentArr = [];
			while ((parent = parent.parentNode) && utils.getNodeName(parent) != "BODY") {
				parentArr.push(parent);
			}
			return parentArr;
		},

		getNodeName: function (element) {
			return element && element.nodeName ? element.nodeName.toUpperCase() : "";
		}
	};

	/**
	 * Makes iframe draggable
	 *
	 * @param iframe
	 */
	var makeDraggable = function (iframe) {

		var iframeJ = findIframe();
		var dragHandle = findInIframe('#drag-handle');
		var $iframeDocument = $(iframe.contentDocument);

		var offset = Object.create(null);

		/**
		 * Generalized function to get position of an event (like mousedown, mousemove, etc)
		 *
		 * @param e
		 * @returns {{x: (Number|number), y: (Number|number)}}
		 */
		var getEventPosition = function (e) {
			if (!e) {
				e = window.event;
			}
			return {
				x: e.screenX,
				y: e.screenY
			};
		};

		/**
		 * Function that does actual "dragging"
		 *
		 * @param x
		 * @param y
		 */
		var drag = function (x, y) {
			var newPositionX = x;
			var newPositionY = y;
			// Don't drag it off the top or left of the screen?
			if (newPositionX < 0) {
				newPositionX = 0;
			}
			if (newPositionY < 0) {
				newPositionY = 0;
			}

			iframeJ.get(0).style.setProperty('left', newPositionX + 'px', 'important');
			iframeJ.get(0).style.setProperty('top', newPositionY + 'px', 'important');
		};

		var cancelIFrameSelection = function (e) {
			e.preventDefault();
			e.stopPropagation();
		};

		var onMouseMove = function (e) {
			var eventPosition = getEventPosition(e);
			drag(eventPosition.x + offset.x, eventPosition.y + offset.y);
		};

		var onMouseDown = function (e) {

			var eventPosition = getEventPosition(e);
			var dragHandleEl = dragHandle.get(0);
			var rect = iframeJ.get(0).getBoundingClientRect();

			offset.x = rect.left + dragHandleEl.offsetLeft - eventPosition.x;
			offset.y = rect.top + dragHandleEl.offsetTop - eventPosition.y;

			$iframeDocument.on('mousemove', onMouseMove);
			$iframeDocument.on('selectstart', cancelIFrameSelection);
		};

		var onMouseUp = function () {
			$iframeDocument.off('mousemove', onMouseMove);
			$iframeDocument.off('selectstart', cancelIFrameSelection);
		};

		dragHandle.on('mousedown', onMouseDown);
		$iframeDocument.on('mouseup', onMouseUp);
	};

	var getViewport = function () {
		return {
			width: window.innerWidth,
			height: window.innerHeight
		};
	};

	var getPositionsForIframe = function (offset, viewPort, height, width) {
		return {
			left: viewPort.width - width - offset,
			top: offset
		};
	};

	var createIframe = function (width, height, callback) {

		var viewPort = getViewport();
		var positions = getPositionsForIframe(constants.iframe.topOffset, viewPort, height, width);

		var iframe = document.createElement('iframe');
		iframe.setAttribute('id', iframeId);
		iframe.setAttribute('class', ignoreClassName);
		iframe.setAttribute('frameBorder', '0');
		iframe.setAttribute('allowTransparency', 'true');

		iframe.style.setProperty('width', width + 'px', "important");
		iframe.style.setProperty('height', height + 'px', "important");
		iframe.style.setProperty('position', 'fixed', "important");
		iframe.style.setProperty('left', positions.left + 'px', "important");
		iframe.style.setProperty('top', positions.top + 'px', "important");

		// Wait for iframe load and then apply styles
		$(iframe).on('load', function () {
			loadDefaultScriptsAndStyles(iframe);
			callback(iframe);
		});
		document.body.appendChild(iframe);
	};

	var loadDefaultScriptsAndStyles = function (iframe) {

		// Chrome doesn't inject scripts in empty iframe
		try {
			var doc = iframe.contentDocument;
			doc.open();
			doc.write("<html><head></head></html>");
			doc.close();
		} catch (ex) {
			// Ignore (does not work in FF)
		}

		var head = iframe.contentDocument.getElementsByTagName('head')[0];

		for(i = 0; i < settings.cssLink.length; i++){
			var link = document.createElement("link");
			link.type = "text/css";
			link.rel = "stylesheet";
			link.href = settings.cssLink[i];
			head.appendChild(link);
		}
	};

	var findIframe = function () {
		return $('#' + iframeId);
	};

	var findInIframe = function (selector) {
		return $(findIframe().get(0).contentDocument.querySelectorAll(selector));
	};

	/**
	 * Shows dialog window (create iframe dynamically)
	 *
	 * @param content
	 * @param width
	 * @param height
	 * @param callback
	 */
	var showDialog = function (content, width, height, callback) {

		var appendContent = function (iframe) {
			appendContentToIframe(iframe, content);
			localizeMenu();
			makeDraggable(iframe);
			checkPosition();
			callback(iframe);
		};

		var existIframe = findIframe();
		if (existIframe.length > 0) {
			var iframe = existIframe.get(0);
			changeCurrentIframe(width, height, iframe);
			appendContent(iframe);
			return;
		}

		createIframe(width, height, appendContent);
	};

	var changeCurrentIframe = function (width, height, iframe) {
        iframe.style.setProperty('width', width + 'px', "important");
        iframe.style.setProperty('height', height + 'px', "important");
	};

	var appendContentToIframe = function (iframe, content) {
		var body = iframe.contentDocument.body;
		while (body.lastChild) {
			body.removeChild(body.lastChild);
		}
		body.appendChild(content.get(0));
	};

	var bindClicks = function (iframe, events) {
		for (var event in events) {
			if (events.hasOwnProperty(event)) {
				$(iframe.contentDocument.querySelectorAll(event)).on('click', events[event]);
			}
		}
	};

	var onCancelSelectClicked = function (e) {
		e.preventDefault();
		showSelectorMenu(function () {
			removePreview();
			startSelector();
		});
	};

	var onCancelSelectModeClicked = function (e) {
		e.preventDefault();
		removePreview();
		cancelSelectMode();
		closeAssistant();
	};

	/**
	 * Cancels select mode, removes all elements using for selecting
	 */
	var cancelSelectMode = function () {
		AbuSelectorLib.close();
	};

	var onElementSelected = function (element) {
		selected.element = element;
		selected.elementInfo = AdguardRulesConstructorLib.getElementInfo(element);
		showHidingRuleWindow(element, selected.elementInfo.haveUrlBlockParameter, selected.elementInfo.haveClassAttribute);
	};

	var closeAssistant = function () {
		cancelSelectMode();
		findIframe().remove();
	};

	/**
	 * Starts AdguardSelector work
	 */
	var startSelector = function () {
		// Initializing AdguardSelector with default configuration
		//AbuSelectorLib.reset();
		AbuSelectorLib.init(onElementSelected);
	};

	var setFilterRuleInputText = function (ruleText) {
		findInIframe('#filter-rule').get(0).value = ruleText;
	};

	var localizeMenu = function () {
		var elements = findInIframe("[i18n]");
		for (var i = 0; i < elements.length; i++) {
			var msgId = elements[i].getAttribute("i18n");
			settings.translateElement(elements[i], msgId);
		}
	};

	var createAdguardDetailedMenu = function () {
		return $('<div class="ultimate-container"><div class="header"><div class="ultimate-close">X</div><div id="drag-handle"><div class="header-h" i18n="assistant_block_element"></div><div class="head txt"><span i18n="assistant_block_element_explain"></span></div></div></div><div id="adv-settings" class="ultimate-form-block"><div class="clearfix" id="one-domain-p"><input id="oneDomainRadio" type="checkbox"><label for="oneDomainRadio" class="box"></label><span class="checkbox-label" i18n="assistant_apply_rule_to_all_sites"></span></div><div class="clearfix" id="block-by-url-p"><input id="blockByUrl" type="checkbox"><label for="blockByUrl" class="box"></label><span class="checkbox-label" i18n="assistant_block_by_reference"></span></div><div class="clearfix" id="block-similar-p"><input id="blockSimilar" type="checkbox"><label for="blockSimilar" class="box"></label><span class="checkbox-label" i18n="assistant_block_similar"></span></div><p><input id="filter-rule" type="type"></p></div><div class="ultimate-foot clearfix2r"><a id="ultimate-accept" class="btn btn-blue"><span i18n="assistant_block"></span></a><a id="ultimate-cancel" class="btn btn-gray f-right"><span i18n="assistant_another_element"></span></a><a id="ultimate-preview" class="btn btn-gray f-right"><span i18n="assistant_preview"></span></a></div></div>');
	};

	var createAdguardSelectorMenu = function () {
		return $('<div class="ultimate-container ultimate-adblock"><div class="header"><div id="close-button" class="ultimate-close">X</div><div id="drag-handle"><div class="header-h" i18n="assistant_select_element"></div><div class="head txt"><span i18n="assistant_select_element_ext"></span>&nbsp;<span><a id="cancel-select-mode" href="#" i18n="assistant_select_element_cancel"></a></span></div></div></div></div>');
	};

	var showDetailedMenu = function (callback) {
		var content = createAdguardDetailedMenu();
		showDialog(content, constants.iframe.baseWidth, constants.iframe.detailedMenuHeight, function (iframe) {
			bindClicks(iframe, {
				'.ultimate-close': onCancelSelectModeClicked,
				'.adg-close': onCancelSelectModeClicked,
				'#adv-settings': onScopeChange,
				'#ultimate-cancel': onCancelSelectClicked,
				'#ultimate-preview': toggleRulePreview,
				'#ultimate-accept': onRuleAccept,
				'#ExtendedSettingsText': onExtendDetailedSettings
			});
			callback();
		});
	};

	/**
	 * Shows abu selector menu
	 */
	var showSelectorMenu = function (callback) {
		var content = createAdguardSelectorMenu();
		showDialog(content, constants.iframe.baseWidth, constants.iframe.selectorMenuHeight, function (iframe) {
			bindClicks(iframe, {
				'#cancel-select-mode': onCancelSelectModeClicked,
				'#close-button': onCancelSelectModeClicked
			});
			callback();
		});
	};

	var showHidingRuleWindow = function (element, urlBlock, blockSimilar) {
		showDetailedMenu(function () {
			//createSlider(element);
			AbuSelectorLib.selectElement(element);
			onScopeChange();
			handleShowBlockSettings(urlBlock, blockSimilar);
		});
	};

	var resizeIframe = function (width, height) {
		var iframe = findIframe().get(0);

		if (height) {
            iframe.style.setProperty('height', height + 'px', "important");
		}

		if (width) {
            iframe.style.setProperty('width', width + 'px', "important");
		}

		checkPosition();
	};

	var checkPosition = function () {
		var winHeight = window.innerHeight;
		var bottom = document.body.scrollTop + winHeight;

		var iframe = findIframe().get(0);
		var offsetTop = iframe.getBoundingClientRect().top + document.body.scrollTop;
		var height = iframe.offsetHeight;
		if (offsetTop + height > bottom) {
			var top = winHeight - height - constants.iframe.topOffset;
			if (top < 0) {
				top = constants.iframe.topOffset;
			}
            iframe.style.setProperty('top', top + 'px', "important");
		}
	};

	var onExtendDetailedSettings = function () {
		var hidden = !(findInIframe('#adv-settings').hasClass("open"));
		if (hidden) {
			resizeIframe(null, constants.iframe.extendDetailedSettingsHeight);
			findInIframe('#adv-settings').addClass('open');
			findInIframe('#adg-show-adv-settings').addClass('active');
		} else {
			resizeIframe(null, constants.iframe.detailedMenuHeight);
			findInIframe('#adv-settings').removeClass('open');
			findInIframe('#adg-show-adv-settings').removeClass('active');
		}
	};

	var createSlider = function (element) {
		var parents = utils.getParentsLevel(element);
		var children = utils.getAllChildren(element);
		var value = Math.abs(parents.length + 1);
		var max = parents.length + children.length + 1;
		var min = 1;
		var options = {value: value, min: min, max: max};

		if (min == max) {
			//hide slider
			findInIframe('#slider').hide();

			var el = findInIframe('.element-rule_text').get(0);
			el.removeAttribute('i18n');
			settings.translateElement(el, 'assistant_slider_if_hide');

			return;
		}

		options.onSliderMove = function (delta) {
			var elem;
			if (delta > 0) {
				elem = parents[delta - 1];
			}
			if (delta === 0) {
				elem = element;
			}
			if (delta < 0) {
				elem = children[Math.abs(delta + 1)];
			}
			onSliderMove(elem);
		};
	};

	var handleShowBlockSettings = function (showBlockByUrl, showBlockSimilar) {
		if (showBlockByUrl) {
			findInIframe('#block-by-url-p').show();
		} else {
			findInIframe('#blockByUrl').removeAttr('checked');
			findInIframe('#block-by-url-p').hide();
		}
		if (showBlockSimilar) {
			findInIframe('#block-similar-p').show();
		} else {
			findInIframe('#blockSimilar').removeAttr('checked');
			findInIframe('#block-similar-p').hide();
		}
	};

	var onSliderMove = function (element) {
		removePreview();

		selected.element = element;
		selected.elementInfo = AdguardRulesConstructorLib.getElementInfo(element);
		AbuSelectorLib.selectElement(element);

		makeDefaultCheckboxesForDetailedMenu();
		onScopeChange();
		handleShowBlockSettings(selected.elementInfo.haveUrlBlockParameter, selected.elementInfo.haveClassAttribute);
	};

	var makeDefaultCheckboxesForDetailedMenu = function () {
		findInIframe('#blockByUrl').attr('checked', false);
		findInIframe('#blockSimilar').attr('checked', false);
		findInIframe('#oneDomainRadio').attr('checked', false);
		findInIframe('#block-by-url-p >div >span').removeClass('active');
		findInIframe('#block-similar-p >div >span').removeClass('active');
		findInIframe('#one-domain-p >div >span').removeClass('active');
	}
/*
	var toggleRulePreview = function (e) {
		if (e) {
			e.preventDefault();
		}
		if (settings.lastPreview) {
			removePreview();
			findInIframe('#ultimate-preview > span').text(getMessage("assistant_preview_start"));
			self.selector.showBorders();
			findInIframe('#slider').show();
			findInIframe('.adg-slide-text').show();
			findInIframe('#ExtendedSettingsText').show();
			return;
		}
		hideElement();
		findInIframe('#ultimate-preview >span').text(getMessage("assistant_preview_end"));
		findInIframe('#slider').hide();
		findInIframe('.adg-slide-text').hide();
		findInIframe('#ExtendedSettingsText').hide();
		findInIframe('#adv-settings').hide();
	};
*/
	var toggleRulePreview = function (e) {

		if (e) {
			e.preventDefault();
		}

		if (previewStyle) {
			// On finish preview and come back to selected
			removePreview();
			/*
			settings.translateElement(findInIframe('#head_title').get(0), "assistant_block_element");
			settings.translateElement(findInIframe('#head_text').get(0), "assistant_block_element_explain");
			*/
			settings.translateElement(findInIframe('#ultimate-preview > span').get(0), "assistant_preview_start");
			findInIframe('#slider').show();
			findInIframe('.adg-slide-text').show();
			findInIframe('#ExtendedSettingsText').show();
			findInIframe('#adv-settings').show();

			AbuSelectorLib.selectElement(selected.element);

			findInIframe('.content').show();

			return;
		}

		hideElement();
/*
		settings.translateElement(findInIframe('#head_title').get(0), "assistant_preview_header");
		settings.translateElement(findInIframe('#head_text').get(0), "assistant_preview_header_info");
		*/
		settings.translateElement(findInIframe('#ultimate-preview > span').get(0), "assistant_preview_end");
		findInIframe('#slider').hide();
		findInIframe('.adg-slide-text').hide();
		findInIframe('#ExtendedSettingsText').hide();
		findInIframe('#adv-settings').hide();

		findInIframe('.content').hide();
	};

	var hideElement = function () {
		AbuSelectorLib.reset();

		var ruleText = findInIframe('#filter-rule').get(0).value;
		var selector = AdguardRulesConstructorLib.constructRuleCssSelector(ruleText);
		if (!selector) {
			return;
		}

		var style = document.createElement("style");
		style.setAttribute("type", "text/css");
		previewStyle = style;

		var head = document.getElementsByTagName('head')[0];
		if (head) {
			style.appendChild(document.createTextNode(selector + " {display: none !important;}"));
			head.appendChild(style);
		}
	};

	var removePreview = function () {

		if (!previewStyle) {
			return;
		}

		var head = document.getElementsByTagName("head")[0];
		if (head) {
			head.removeChild(previewStyle);
		}

		previewStyle = null;
	};

	var onScopeChange = function () {
		var isBlockByUrl = findInIframe('#blockByUrl').is(':checked');//findInIframe('#block-by-url-checkbox').get(0).checked;
		var isBlockSimilar = findInIframe('#blockSimilar').is(':checked');//findInIframe("#block-similar-checkbox").get(0).checked;
		var isBlockOneDomain = findInIframe("#oneDomainRadio").is(':checked');//findInIframe("#one-domain-checkbox").get(0).checked;
	
		handleShowBlockSettings(selected.elementInfo.haveUrlBlockParameter && !isBlockSimilar, selected.elementInfo.haveClassAttribute && !isBlockByUrl);

		var options = {
			urlMask: selected.elementInfo.urlBlockAttributeValue,
			isBlockOneDomain: isBlockOneDomain,
			ruleType: isBlockByUrl ? 'URL' : 'CSS',
			cssSelectorType: isBlockSimilar ? 'SIMILAR' : 'STRICT_FULL',
			url: document.location
		};
		var ruleText = AdguardRulesConstructorLib.constructRuleText(selected.element, options);
		setFilterRuleInputText(ruleText);
	};

	var onRuleAccept = function () {

		removePreview();
		toggleRulePreview();
		previewStyle = null;

		var ruleText = findInIframe('#filter-rule').get(0).value;
		settings.onElementBlocked(ruleText, closeAssistant);
	};

	var reselectElement = utils.debounce(function () {
		if (selected.element && !previewStyle) {
			AbuSelectorLib.selectElement(selected.element);
		}
	}, 50);
	$(window).on('resize', reselectElement);
	$(window).on('scroll', reselectElement);

	this.init = function (options) {

		settings.cssLink = options.cssLink;
		settings.onElementBlocked = options.onElementBlocked;
		settings.translateElement = options.translateElement;

		showSelectorMenu(function () {
			removePreview();
			startSelector();
			// Choose element for assistant
			if (options.selectedElement) {
				$(options.selectedElement).trigger('click');
			}
		});
	};

	this.destroy = function () {
		removePreview();
		cancelSelectMode();
		closeAssistant();
		$(window).off('resize', reselectElement);
		$(window).off('scroll', reselectElement);
	};
};
