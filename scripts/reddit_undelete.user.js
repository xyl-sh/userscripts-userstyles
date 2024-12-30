// ==UserScript==
// @name         Reddit Undelete
// @description  Adds undelete button to posts and comments on old Reddit.
// @author       Xyl
// @icon         https://www.reddit.com/favicon.ico
// @license      AGPL-3.0-or-later
// @namespace    xyl
// @version      1.0.0
// @run-at       document-body
// @match        https://*.reddit.com/r/*/comments/*
// ==/UserScript==

const UNDELETE_DOMAIN = "undelete.pullpush.io";
const PROCESSED_CLASS = "undelete-processed";

const undeleteButton = document.createElement("template");
undeleteButton.innerHTML = String.raw`
	<li class="undelete-button">
		<a target="_blank">undelete</a>
	</li>
`;

function processItem(i) {
	const buttonList = i.querySelector(".flat-list.buttons");
	const permalink = buttonList.querySelector(".first a");

	const undeleteUrl = new URL(permalink.href);
	undeleteUrl.hostname = UNDELETE_DOMAIN;

	const newButton = undeleteButton.cloneNode(true).content;
	newButton.querySelector("a").href = undeleteUrl;
	buttonList.appendChild(newButton);
	i.classList.add(PROCESSED_CLASS);
}

function undelete() {
	const items = document.querySelectorAll(
		`.thing[data-permalink]:not(.${PROCESSED_CLASS})`,
	);
	items.forEach(processItem);
}

new MutationObserver((_mutationList, self) => {
	const s = self;
	cancelAnimationFrame(s.buffer);
	s.buffer = requestAnimationFrame(() => {
		delete s.buffer;
		undelete();
	});
}).observe(document.body, {
	childList: true,
	subtree: true,
});

undelete();
