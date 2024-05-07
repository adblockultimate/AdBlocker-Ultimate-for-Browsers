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

/* global browser */

/**
 * Extension start entry point.
 * In this particular case, we have to process migration from bootstrapped add-on to WebExtension.
 */
(function (abu) {

  'use strict';

	abu.keepAlive();

	let started = false;

	browser.runtime.onInstalled.addListener(function (details) {
		const now = Date.now();
		const params = new URLSearchParams({
			version: abu.app.getVersion(),
			browser: abu.prefs.browser
		});

		if (details?.reason == "install") {
			started = true;
			abu.runtime.setUninstallURL(`https://adblockultimate.net/uninstall?${params.toString()}`, () => {
				if (abu.runtime.lastError) {
					abu.console.error(abu.runtime.lastError);
					return;
				}
			});

			abu.ui.openAfterInstallPage();
			abu.initialize(() => abu.localStorage.setItem('last-update', now));
		}

		else if (details?.reason == "update") {
			const lastUpdated = abu.localStorage.getItem('last-update') || 0;
			const daysInMs = 90 * 24 * 60 * 60 * 1000;

			if ((now - lastUpdated) > daysInMs) {
				abu.ui.openTab(`https://adblockultimate.net/updated?${params.toString()}`);
				abu.localStorage.setItem('last-update', now);
			}
		}
	});

	abu.localStorage.init(function () {
		if(!started) abu.initialize();
	});

})(abu);
