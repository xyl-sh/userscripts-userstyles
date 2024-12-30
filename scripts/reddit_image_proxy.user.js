// ==UserScript==
// @name         Reddit Image Proxy
// @description  Redirect Reddit image viewer to a proxy.
// @author       Xyl
// @icon         https://www.reddit.com/favicon.ico
// @license      AGPL-3.0-or-later
// @namespace    xyl
// @version      1.0.0
// @run-at       document-start
// @match        https://*.reddit.com/media?*
// ==/UserScript==

const proxy = new URL("https://rip.xyl.sh");

function replaceContent() {
	window.stop();

	const searchParams = new URLSearchParams(window.location.search);
	const urlParam = searchParams.get("url");

	const imageUrl = new URL(urlParam);
	window.location.replace(`${proxy.origin}${imageUrl.pathname}`);
}

if (window.location.pathname === "/media") {
	replaceContent();
}
