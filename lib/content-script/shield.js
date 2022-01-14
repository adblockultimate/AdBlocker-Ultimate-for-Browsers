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

var MainUtils = { 
    isShadowRootSupported: function() {
        var safari = /^((?!chrome|android).)*safari/i;
        return typeof(document.documentElement.attachShadow) !== 'undefined' && !safari.test(navigator.userAgent);
    },
    createElement: function(markup, id) {
        var doc = document.implementation.createHTMLDocument('');
        if (markup && markup[0] !== '<') {
            markup = '<' + markup + ' ' + ((typeof(id) != 'undefined') ? 'id="' + id + '"' : '') + '></' + markup + '>';
        }
        $(doc.body).html(markup);
        return doc.body.firstChild;
    },
	createShadowRootElement: function (iframeAnc) {
        var shadowiframeAnchor = iframeAnc.attachShadow({
			mode: 'closed'
        });
        return shadowiframeAnchor;
	}
};


var Shield = function (params) {
	const { rank, baseUrl } = params;
	const shieldSelectorId = 'abuBadge';

	const renderSocialLinks = (blockedAds) => {
		return `<div class="social-container">
				<a href="#" data-social="facebook" data-total-ads="${blockedAds}" title="${i18n.getMessage('popup_share_on_fb')}" class="social">
					<i class="fa fa-facebook fa-2x"></i>
				</a>
				<a href="#" data-social="twitter"  data-total-ads="${blockedAds}" title="${i18n.getMessage('popup_share_on_twitter')}" class="social">
					<i class="fab fa fa-twitter fa-2x"></i>
				</a>
			</div>`;
	}
	
	const getTemplate = () => {
		let blockedAds = 0;
		switch (rank) {
			case 1:
				blockedAds = 1000;
				return `<div class="overlay-container">
							<section>
								<article>
									<div class="pure-steps">
										<input type="radio" name="steps" class="pure-steps_radio" id="step-0" checked="checked">
										<input type="radio" name="steps" class="pure-steps_radio" id="step-1">
										<input type="radio" name="steps" class="pure-steps_radio" id="step-2">
										<div class="pure-steps_group">
											<a class="close-btn" href="#"><i class="fa fa-times"></i></a>
											<ol>
												<li class="pure-steps_group-step">
													<header>
														<img class="logo" src="${baseUrl}images/logo.png">
														<h1>${i18n.getMessage('shield_congrats')}</h1>
														<h1 class="number">${blockedAds}</h1>
														<p class="ads-bl">${i18n.getMessage('shield_blocked_ads')}</p>
														<img class="icon-1" src="${baseUrl}images/rate.png">
														<h2>${i18n.getMessage('shield_do_you_like_abu')}</h2>
													</header>
												</li>
												<li class="pure-steps_group-step">
													<img class="star" src="${baseUrl}images/star.png">
													<fieldset>
														<legend class="pure-steps_group-step_legend">
															<p class="rate-desc">${i18n.getMessage('shield_rate_txt')}</p>
															<button type="button" class="submit rate-us">${i18n.getMessage('shield_rate_us')}</button>
															<a href="" class="no-thanks">${i18n.getMessage('shield_no_thanks')}</a>
														</legend>
													</fieldset>
												</li>
												<li class="pure-steps_group-step">
													<div class="feedback feedback-container">
														<h1 class="title-feedback">${i18n.getMessage('shield_tell_how_to_improve')}</h1>
														<form class="feedback-form">
															<textarea name="msg" placeholder="${i18n.getMessage('shield_message')}"></textarea>
															<input type="email" name="email" placeholder="${i18n.getMessage('shield_email')}" />
															<button type="submit" class="submit">${i18n.getMessage('shield_send_feedback')}</button>
														</form>
													</div>
													<div class="thank-you-container d-none">
														<h1 class="title-thank-you">${i18n.getMessage('shield_thank_you')}</h1>
													</div>
												</li>
											</ol>
											<ol class="pure-steps_group-triggers">
												<li class="pure-steps_group-triggers_item">
													<label for="step-0"></label>
												</li>
												<li class="pure-steps_group-triggers_item ">
													<label class="yes-btn" for="step-1">${i18n.getMessage('yes')}</label>
													<label class="no-btn" for="step-2">${i18n.getMessage('no')}</label>
												</li>
											</ol>
										</div>
										<br>
									</div>
								</article>
							</section>
						</div>`;
			case 2:
				blockedAds = 10000;
				return `<div class="container container-2" id="container">
					<a class="close-btn" href="#">
						<i class="fa fa-times"></i>
					</a>
					<div class="overlay-container-2">
						<div class="overlay">
						   <div class="overlay-panel overlay-right">
							  <h1>${i18n.getMessage('shield_congrats')}</h1>
							  <img class="icon" src="${baseUrl}images/flag.png"/>
							  <h1 class="number">10 000</h1>
							  <p class="ads-bl">${i18n.getMessage('shield_blocked_ads')}</p>
							  ${renderSocialLinks(blockedAds)}
						   </div>
						</div>
					 </div>
					 <div class="form-container log-in-container">
						<div class="form">
						   <h1>${i18n.getMessage('block_even_more_ads')}</h1>
						   <img class="win-icon" src="${baseUrl}images/win.png"/>
						   <span class="win-desc">${i18n.getMessage('badge_windows_ifno')}</span>
						   <button class="link" data-url="https://download.adblockultimate.net/AdBlockerInstaller.exe">${i18n.getMessage('badge_download_now')}</button>
						   <a href="#" data-url="https://adblockultimate.net/windows" class="more link">${i18n.getMessage('badge_learn_more')}</a>
						   <div class="check">
							  <input type="checkbox" id="show_checkbox" />
							  <label for="show_checkbox"> ${i18n.getMessage('shield_dont_show_again')}</label>
						   </div>
						</div>
					</div>
				</div>`
		}
	}
	
	const getWindowSize = () => {
		switch(rank) {
			case 1:
				return {
					width: 265,
					height: 416
				};
			case 2:
				return {
					width: 600,
					height: 420
				};
		}
	}
		
	const createIframe = (callback) => {
		
		const existIframe = findISheildElement();
		if(existIframe.length > 0) return;
		
		const {width, height} = getWindowSize();

		const offset = 20;
						
		const cssStyle = {
			id: shieldSelectorId,
			width: width,
			height: height,
			position: 'fixed',
			right: offset,
			top: offset,
			display: 'none',
			'z-index': 99999999999,
			'border-radius': ".8em",
			'box-shadow': '0 1.7em 5.5em -.94em rgba(0, 0, 0, .3),0 2em 3em .5em rgba(0, 0, 0, .1),0 1.8em 2em -1.5em rgba(0, 0, 0, .2)'
		};
		
		const iframe = $('<iframe />').attr({
			frameBorder: 0,
			allowTransparency: 'false'
		}).css(cssStyle);	

		// Wait for iframe load and then apply styles
		$(iframe).on('load', () => {
			loadIframeContent(iframe[0], (iframe) => {
				bindEvents(iframe);
				setTimeout(() => {
					$(iframe).fadeIn(200);
				}, 2000);
			});
		});
		
		if (MainUtils.isShadowRootSupported()) { 
			iframeAnchor = MainUtils.createElement('div',shieldSelectorId);
			MainUtils.createShadowRootElement(iframeAnchor).appendChild(iframe[0]);
        } else {
			iframeAnchor = iframe[0];
        }
    
        document.documentElement.appendChild(iframeAnchor);
	};
	
	const loadIframeContent = (iframe, callback) => {
		// Chrome doesn't inject scripts in empty iframe
		try {
			var doc = iframe.contentDocument;
			doc.open();
			doc.write("<html><head></head><body></body></html>");
			doc.close();
		} catch (ex) {
			// Ignore (does not work in FF)
		}

		var head = iframe.contentDocument.getElementsByTagName('head')[0];
		
		//TODO: local fonts
		const cssLinks = [
			`${baseUrl}main.css`
		];
		
		for(i = 0; i < cssLinks.length; i++){
			var link = document.createElement("link");
			link.type = "text/css";
			link.rel = "stylesheet";
			link.href = cssLinks[i];
			head.appendChild(link);
		}
		
		$(iframe.contentDocument.body).html(getTemplate());
		
		callback(iframe);
	};
	
	const closeIframe = () => {
		findISheildElement().fadeOut(200, () => {
			$(this).remove();
		});
	}
	
	const findISheildElement = () => {
		return $('#' + shieldSelectorId);
	}

	const bindEvents = (iframe) => {
		const iframeBody = $(iframe.contentDocument.body);
		
		iframeBody.on('click', '.close-btn, .no-thanks', function(e){
			e.preventDefault();
			closeIframe();
		});

		iframeBody.on('click', '.social', function(e){
			e.preventDefault();
			contentPage.sendMessage({
                type: 'openShareSocialLink', 
                network: $(this).data('social'), 
                totalBlocked: $(this).data('total-ads'), 
            });
			closeIframe();
		});
		
		iframeBody.on('click', '.rate-us', function(e){
			e.preventDefault();
			contentPage.sendMessage({type: 'rateWeb'});
			closeIframe();
		});
		
		iframeBody.on('click', '.link', (e) => {
			const url = $(e.currentTarget).data('url') || $(e.target).data('url');
			contentPage.sendMessage({type: 'openTab', 'url': url});
			closeIframe();
		});
		
		iframeBody.on('change', '#show_checkbox', function(e){
    		val = $(this).is(':checked') ? 1 : 2;
    		contentPage.sendMessage({type: 'showBadgeAgain', 'val':val}); 
  		});
		
		iframeBody.on('submit', '.feedback-form', function(e){
			e.preventDefault();
			
			const $form = $(this);
			
			const $feedback = $form.find('[name="msg"]');
			if(!$feedback.val().trim()) {
				$feedback.focus();
				return false;
			}

			const $submit = $form.find('[type="submit"]');
			$submit.prop('disabled', true);
			$submit.text(i18n.getMessage('shield_sending'));

			contentPage.sendMessage({type: 'sendFeedback', 'params': $form.serialize()}); 

			iframeBody.find('.feedback-container').hide();
			iframeBody.find('.thank-you-container').fadeIn();
			setTimeout(() => {
				closeIframe();
			}, 3000);

			return false;
		});
		
		$(document).on('click',() => {
			closeIframe();
		});
	};
	
	return {
		createIframe
	}
};

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
	
	contentPage.onMessage.addListener(function (message) {
        switch (message.type) {
            case 'initShield':
				const shield = new Shield(message.params);
            	shield.createIframe();
				break;
		}
	});
})();
