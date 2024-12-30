// ==UserScript==
// @name         Reddit Redesign Optout
// @description  Default to old Reddit through the redesign_optout cookie.
// @author       Xyl
// @icon         https://www.reddit.com/favicon.ico
// @license      AGPL-3.0-or-later
// @namespace    xyl
// @version      1.0.0
// @run-at       document-start
// @match        https://*.reddit.com/*
// ==/UserScript==

const Cookies = Object.freeze({
	REDESIGN: "redesign_optout",
	DISABLE: "disable_optout",
});

const Domains = Object.freeze({
	ALLOWED_NEW: ["www", "chat", "new", "sh"],
	ALLOWED_OLD: ["www", "chat", "old"],
	COOKIE: ".reddit.com",
	WWW: "www.reddit.com",
});

function hasCookie(name, value = "true") {
	return document.cookie
		.split("; ")
		.filter((c) =>
			value ? c === `${name}=${value}` : c.split("=")[0] === name,
		).length;
}

function setCookie(name, value) {
	const expiry = value ? "expires=Fri, 31 Dec 9999 23:59:59 GMT" : "max-age=0";
	document.cookie = `${name}=${value}; ${expiry}; path=/; domain=${Domains.COOKIE}`;
}

function redirectToWWW(allowedDomains) {
	const subdomain = window.location.host.split(".")[0];
	if (!allowedDomains.includes(subdomain)) {
		window.location = `${window.location.protocol}//${Domains.WWW}${window.location.pathname}`;
		return true;
	}
	return false;
}

window.enableOldRedditCookie = () => {
	const shouldReload = !hasCookie(Cookies.REDESIGN);
	setCookie(Cookies.DISABLE, null);
	setCookie(Cookies.REDESIGN, true);

	if (redirectToWWW(Domains.ALLOWED_NEW)) return;
	if (shouldReload) window.location.reload();
};

window.disableOldRedditCookie = () => {
	const shouldReload = hasCookie(Cookies.REDESIGN);
	setCookie(Cookies.REDESIGN, null);
	setCookie(Cookies.DISABLE, true);

	if (redirectToWWW(Domains.ALLOWED_OLD)) return;
	if (shouldReload) window.location.reload();
};

if (hasCookie(Cookies.DISABLE)) {
	window.disableOldRedditCookie();
} else {
	window.enableOldRedditCookie();
}
