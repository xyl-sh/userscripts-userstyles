// ==UserScript==
// @name         Cozy.tv Stickers & Multiline
// @description  Enhance Cozy.tv with a better sticker menu and multiline textbox.
// @author       Xyl
// @icon         https://cozy.tv/favicon.ico
// @license      AGPL-3.0-or-later
// @namespace    xyl
// @version      1.0.0
// @run-at       document-start
// @match        https://cozy.tv/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

const BaseUrls = {
	API: "https://api.cozy.tv/cache",
	CDN: "https://prd.foxtrotstream.xyz/a/stk",
};

const Observers = {
	RELOAD: null,
	STICKER: null,
	CHAT: null,
	CONTAINER: null,
	STICKER_INTERSECTION: null,
};

const Templates = {
	MENU: document.createElement("template"),
	USER: document.createElement("template"),
	STICKER: document.createElement("template"),
	SEND: document.createElement("template"),
};

const Elements = {
	HEADER: null,
	CONTENT: null,
};

Templates.MENU.innerHTML = String.raw`
	<div id="csam-header">
		<div class="font-mont">Stickers</div>
		<div id="csam-tab-btns">
			<button data-tab="all" class="bg-gray-500">All</button>
			<button data-tab="saved">Saved</button>
		</div>
	</div>
	<div class="bg-gray-500 scrollbar-pretty" id="csam-menu">
		<input
			id="csam-search"
			class="border-gray-600"
			placeholder="Search sticker tag, ID, or channel name"
		/>
		<div id="csam-tabs">
			<div data-tab="all"></div>
			<div data-tab="saved" class="csam-stk-grid csam-hide"></div>
		</div>
	</div>
`;

Templates.USER.innerHTML = String.raw`
	<div class="csam-user">
		<span class="csam-username"></span>
		<div class="csam-stk-grid"></div>
	</div>
`;

Templates.STICKER.innerHTML = String.raw`
	<div class="csam-stk-container">
		<img loading="lazy"/>
		<button></button>
	</div>
`;

Templates.SEND.innerHTML = String.raw`
<button class="csam-send">
	<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
		<path d="M476.59 227.05l-.16-.07L49.35 49.84A23.56 23.56 0 0027.14 52 24.65 24.65 0 0016 72.59v113.29a24 24 0 0019.52 23.57l232.93 43.07a4 4 0 010 7.86L35.53 303.45A24 24 0 0016 327v113.31A23.57 23.57 0 0026.59 460a23.94 23.94 0 0013.22 4 24.55 24.55 0 009.52-1.93L476.4 285.94l.19-.09a32 32 0 000-58.8z"></path>
	</svg>
</button>
`;

Elements.HEADER = Templates.MENU.content.querySelector("#csam-header");
Elements.CONTENT = Templates.MENU.content.querySelector("#csam-menu");

let stickerDict;
let tagList;
let savedList;
let invalidStickers;
let remainingChecks;
let currentUpdate;
let currentChannel;

function buildObserver(call) {
	return new MutationObserver((mutationList, self) => {
		const s = self;
		cancelAnimationFrame(s.buffer);
		s.buffer = requestAnimationFrame(() => {
			delete s.buffer;
			call(mutationList, s);
		});
	});
}

function changeTab(e) {
	e.preventDefault();
	const t = e.target;
	const selectedTab = t.dataset.tab;
	if (!selectedTab) {
		return;
	}
	Elements.HEADER.querySelectorAll("#csam-tab-btns > *").forEach((btn) =>
		btn.classList.toggle("bg-gray-500", btn === t),
	);
	Elements.CONTENT.querySelectorAll("#csam-tabs > *").forEach((tab) =>
		tab.classList.toggle("csam-hide", tab.dataset.tab !== selectedTab),
	);
}

function toggleSave(e) {
	e.preventDefault();
	const t = e.target.parentNode;
	const stk = t.dataset.sticker;
	const selector = `.csam-stk-container[data-sticker="${stk}"]`;
	if (t.classList.toggle("csam-saved")) {
		if (!savedList.includes(stk)) {
			savedList.push(stk);
		}

		document
			.querySelectorAll(selector)
			.forEach((s) => s.classList.add("csam-saved"));

		Elements.CONTENT.querySelectorAll(selector).forEach((s) =>
			s.classList.add("csam-saved"),
		);

		const clone = t.cloneNode(true);
		clone.querySelector("button").addEventListener("click", toggleSave);
		Elements.CONTENT.querySelector(
			"#csam-tabs > [data-tab='saved']",
		).appendChild(clone);
	} else {
		if (savedList.includes(stk)) {
			const idx = savedList.indexOf(stk);
			savedList.splice(idx, 1);
		}

		document
			.querySelectorAll(selector)
			.forEach((s) => s.classList.remove("csam-saved"));

		Elements.CONTENT.querySelectorAll(selector).forEach((s) =>
			s.closest("#csam-tabs > [data-tab='saved']")
				? s.remove()
				: s.classList.remove("csam-saved"),
		);
	}
	GM_setValue("savedStickers", savedList);
}

function insertSticker(e) {
	const t = e.target;
	if (!(t.closest("#csam-menu") || e.detail % 2 === 0)) {
		return;
	}
	e.preventDefault();
	const textbox = t
		.closest(".relative.h-full")
		.querySelector("div[contenteditable]");

	const selection = window.getSelection();
	const newNode = t.cloneNode(true);
	newNode.dataset.sticker = t.parentNode.dataset.sticker;

	if (
		selection &&
		selection.anchorNode &&
		[selection.anchorNode.parentElement, selection.anchorNode].includes(textbox)
	) {
		const range = selection.getRangeAt(0);
		range.deleteContents();
		range.insertNode(newNode);
		range.setStartAfter(newNode);
		range.setEndAfter(newNode);
		selection.removeAllRanges();
		selection.addRange(range);
	} else {
		textbox.append(newNode);
	}
}

function sendMessage(e) {
	const t = e.target.closest(".csam-send");
	const p = t.parentElement;
	const chatbox = p.querySelector("[contenteditable]");
	if (!chatbox) {
		return;
	}

	chatbox.dispatchEvent(
		new KeyboardEvent("keypress", {
			key: "Enter",
			code: "Enter",
			keyCode: 13,
			bubbles: true,
		}),
	);
}

function onStickerClick(e) {
	const t = e.target;
	if (t.matches(".csam-stk-container button")) {
		toggleSave(e);
	} else if (t.matches(".csam-stk-container img")) {
		insertSticker(e);
	} else if (t.closest(".csam-send")) {
		sendMessage(e);
	}
}

function onStickerError(e) {
	const t = e.target.parentNode;
	const parent = t.parentNode;
	if (
		!parent ||
		parent.classList.contains("chat-message") ||
		!t.classList.contains("csam-stk-container") ||
		!e.target.src
	) {
		return;
	}

	if (!invalidStickers.includes(t.dataset.sticker)) {
		invalidStickers.push(t.dataset.sticker);
	}

	t.remove();

	GM_setValue("invalidStickers", invalidStickers);
}

function buildSticker(stk, lazy = true) {
	const stickerTemplate = Templates.STICKER.cloneNode(true);
	const stickerElement = stickerTemplate.content.children[0];
	const img = stickerElement.querySelector("img");

	stickerElement.dataset.sticker = stk;
	stickerElement.title = stk;
	if (!lazy) {
		img.src = `${BaseUrls.CDN}/${stk}.webp`;
	}
	if (tagList && tagList[stk]) {
		stickerElement.dataset.tags = tagList[stk].join(" ");
	}

	if (savedList.includes(stk)) {
		stickerElement.classList.add("csam-saved");
	}

	if (lazy) {
		Observers.STICKER_INTERSECTION.observe(img);
	}

	return stickerElement;
}

function generateSaved() {
	savedList = GM_getValue("savedStickers", []);

	const savedElement = Elements.CONTENT.querySelector(
		"#csam-tabs > [data-tab='saved']",
	);
	const stickers = savedList.map((e) => buildSticker(e));
	savedElement.replaceChildren(...stickers);
}

function applyStickerHTML() {
	const menu = document.querySelector(
		".absolute.z-40.bottom-0:has(.hidden), #stickers .flex.p-2",
	);
	if (!menu || document.querySelector("#csam-menu")) return;
	if (menu.parentNode.parentNode.parentNode.classList.contains("absolute")) {
		document
			.querySelector(".relative.flex-grow.h-0")
			.insertAdjacentElement("afterend", menu.parentNode.parentNode);
	}
	Elements.HEADER.querySelector("#csam-tab-btns > *").click();
	Elements.CONTENT.querySelectorAll("#csam-tabs").forEach((e) => {
		const tab = e;
		tab.scrollTop = 0;
	});
	menu.replaceChildren(Elements.HEADER, Elements.CONTENT);
}

function sortUsers() {
	const userList = Elements.CONTENT.querySelector(
		"#csam-tabs > [data-tab='all']",
	);
	const sorted = [...userList.children].sort((a, b) => {
		const aIsCurrent = currentChannel === a.dataset.channel;
		const bIsCurrent = currentChannel === b.dataset.channel;
		if (aIsCurrent !== bIsCurrent) return bIsCurrent ? 1 : -1;

		return +b.dataset.followers - +a.dataset.followers;
	});
	if (sorted.every((e, i) => e === userList.children[i])) {
		return;
	}
	userList.replaceChildren(...sorted);
}

function createStickers(data, dataChanged) {
	const stickers = [data.avatar, data.card, ...data.stickers].filter((s) => s);
	if (!stickers.length) return;

	const userList = Elements.CONTENT.querySelector(
		"#csam-tabs > [data-tab='all']",
	);

	let userElement = Elements.CONTENT.querySelector(
		`[data-channel=${data.displayName.toLowerCase()}]`,
	);
	if (!userElement) {
		const userTemplate = Templates.USER.cloneNode(true);
		[userElement] = userTemplate.content.children;
		userElement.dataset.channel = data.displayName.toLowerCase();
		userElement.querySelector(".csam-username").innerText = data.displayName;
		userElement.dataset.followers = data.followerCount;
		userList.appendChild(userElement);
	} else if (!dataChanged) {
		sortUsers();
		return;
	}

	const stickerArray = stickers.map((s) => buildSticker(s));
	userElement.querySelector(".csam-stk-grid").replaceChildren(...stickerArray);
}

function getDeletedStickers() {
	const allStickers = Object.values(stickerDict).flatMap((v) => v.stickers);

	const highestSticker = allStickers.reduce((a, b) =>
		a.padStart(b.length, "0") >= b.padStart(a.length, "0") ? a : b,
	);

	invalidStickers = GM_getValue("invalidStickers", []);
	const results = [];
	let current = 0;
	while (current <= parseInt(highestSticker, 32)) {
		const currentStr = current.toString(32);
		if (
			!invalidStickers.includes(currentStr) &&
			!allStickers.includes(currentStr)
		) {
			results.push(currentStr);
		}
		current += 1;
	}

	createStickers({
		displayName: "Deleted",
		stickers: results,
		avatar: null,
		card: null,
		followerCount: -1,
	});
}

async function getUserStickers(name, isCurrent = false, errorCount = 0) {
	const stickersResponse = await fetch(
		`${BaseUrls.API}/${name}/channelStickers`,
	);
	const currentStickers = stickerDict[name].stickers || [];

	if (stickersResponse.ok) {
		const stickersJson = await stickersResponse.json();
		const stickers = stickersJson.stickers || [];

		stickerDict[name] = {
			...stickerDict[name],
			stickers: stickers.flatMap((s) => Object.values(s)),
		};
	} else {
		if (errorCount < 3) {
			setTimeout(
				() => getUserStickers(name, isCurrent, errorCount + 1),
				(errorCount + 1) * 1000,
			);
			return;
		}

		if (!stickerDict[name].stickers) {
			stickerDict[name].stickers = [];
		}
	}

	const newStickers = stickerDict[name].stickers || [];
	const dataChanged =
		currentStickers.length !== newStickers.length ||
		!newStickers.every((s, i) => s === currentStickers[i]);

	GM_setValue("stickerCache", stickerDict);
	createStickers(stickerDict[name], dataChanged);

	sortUsers();

	if (isCurrent) {
		return;
	}

	remainingChecks -= 1;
	if (remainingChecks) return;

	getDeletedStickers();
}

function getCurrentUserStickers() {
	clearTimeout(currentUpdate);

	if (!stickerDict) {
		return;
	}

	const data = stickerDict[currentChannel];

	if (!data) {
		return;
	}

	getUserStickers(currentChannel, true);

	currentUpdate = setTimeout(getCurrentUserStickers, 90000);
}

async function getStickers(errorCount = 0) {
	generateSaved();
	const stickerCache = GM_getValue("stickerCache", {});
	const homepageResponse = await fetch(`${BaseUrls.API}/homepage`);

	if (homepageResponse.ok) {
		const homepage = await homepageResponse.json();

		stickerDict = Object.fromEntries(
			homepage.users.map((user) => {
				const data = {
					...stickerCache[user.name],
					displayName: user.displayName,
					followerCount: user.followerCount,
					avatar: null,
					card: null,
				};
				if (user.avatarUrl) {
					data.avatar = `../av/${user.avatarUrl.split("/").pop().split(".")[0]}`;
				}
				if (user.cardUrl) {
					data.card = `../pcrds/${user.cardUrl.split("/").pop().split(".")[0]}`;
				}
				return [user.name, data];
			}),
		);
	} else {
		if (errorCount < 3) {
			setTimeout(() => getStickers(errorCount + 1), (errorCount + 1) * 1000);
			return;
		}

		stickerDict = stickerCache;
	}

	GM_setValue("stickerCache", stickerDict);

	const users = Object.keys(stickerDict).filter((u) => u !== currentChannel);

	remainingChecks = users.length;
	users
		.sort((a, b) => b.followerCount - a.followerCount)
		.forEach((u) => getUserStickers(u, false));
}

async function getTags() {
	tagList = GM_getValue("tagCache", {});
	const tagsResponse = await fetch(
		"https://raw.githubusercontent.com/KANYEcode/stickers/main/tags.csv",
	);

	if (tagsResponse.ok) {
		const tagsCsv = await tagsResponse.text();
		const tagEntries = tagsCsv.split(/[\r\n]+/);
		tagList = Object.fromEntries(
			tagEntries.slice(1).map((e) => {
				const sections = e.split(",");
				const tags = sections.slice(3).filter((n) => n) || [];
				return [sections[1], tags];
			}),
		);
		GM_setValue("tagCache", tagList);
	}

	Elements.CONTENT.querySelectorAll(".csam-stk-container").forEach((e) => {
		e.dataset.tags = tagList[e.dataset.sticker].join(" ");
	});
}

function onStickerIntersection(stickers) {
	stickers.forEach((e) => {
		const t = e.target;
		if (e.isIntersecting) {
			t.src = `${BaseUrls.CDN}/${t.parentNode.dataset.sticker}.webp`;
		} else {
			t.removeAttribute("src");
		}
	});
}

function onChatInput(e) {
	const t = e.target;

	t.querySelectorAll("br").forEach((b) => b.remove());
	const textNodes = [...t.childNodes].filter(
		(n) => n.nodeType === Node.TEXT_NODE && n.textContent.includes("\u200B"),
	);

	if (!textNodes.length) {
		return;
	}

	const selection = window.getSelection();
	const range = selection.getRangeAt(0);
	const cursorOffset = range.startOffset;
	const cursorNode = range.startContainer;
	const beforeCursor = cursorNode.textContent.slice(0, cursorOffset);
	const zwsBeforeCursor = (beforeCursor.match(/\u200B/g) || []).length;

	textNodes.forEach((node) => {
		const n = node;
		if (n.parentElement.lastChild !== n) {
			n.textContent = n.textContent.replace("\u200B", "");
		} else {
			n.textContent = n.textContent.replace(/(?!^\u200B$|\n)\u200B/gm, "");
		}
	});

	const newRange = document.createRange();
	newRange.setStart(cursorNode, cursorOffset - zwsBeforeCursor);
	newRange.collapse(true);

	selection.removeAllRanges();
	selection.addRange(newRange);
}

function onChatKeyDown(e) {
	const t = e.target;
	if (
		e.key === "Enter" &&
		(e.shiftKey || t.parentElement.querySelector(".csam-send"))
	) {
		e.preventDefault();

		const selection = window.getSelection();
		const range = selection.getRangeAt(0);

		const isAtEnd =
			range.endContainer.parentNode.lastChild === range.endContainer &&
			range.endOffset === range.endContainer.length;

		const restoreNewline =
			range.startContainer !== range.endContainer &&
			range.endContainer.textContent.startsWith("\n");

		const textNode = document.createTextNode(isAtEnd ? "\n\u200B" : "\n");

		range.deleteContents();
		range.insertNode(textNode);
		if (restoreNewline && !range.endContainer.textContent.startsWith("\n")) {
			range.endContainer.textContent = `\n${range.endContainer.textContent}`;
		}

		range.setStart(textNode, textNode.textContent.length);
		range.setEnd(textNode, textNode.textContent.length);

		selection.removeAllRanges();
		selection.addRange(range);
	} else if (["ArrowUp", "ArrowDown"].includes(e.key)) {
		e.preventDefault = () => {};
	}

	const childNodes = [...t.childNodes];
	childNodes.forEach((n, i) => {
		if (
			n.nodeType === Node.TEXT_NODE &&
			(!n.textContent ||
				n.textContent === "\u200B" ||
				(n.textContent === "\n" && i === childNodes.length))
		) {
			n.remove();
		}
	});
}

function onChatMessage() {
	document.querySelectorAll(".chat_sticker").forEach((s) => {
		const id = s.style.backgroundImage
			.match(/(?<=\/).*(?=\.webp)/)[0]
			.split("/stk/")
			.pop();
		s.replaceWith(buildSticker(id, false));
	});
}

function onChatReady(chat) {
	document
		.querySelectorAll(
			".notbody, .notbody .flex, #app > div:not(:has(> .pointer-events-none)), .sticky + .flex-grow > .h-full",
		)
		.forEach((e) => {
			Observers.RELOAD.observe(e, {
				childList: true,
			});
		});

	Observers.STICKER.disconnect();

	chat.parentElement.parentElement.addEventListener("click", onStickerClick);
	chat.parentElement.parentElement.addEventListener(
		"error",
		onStickerError,
		true,
	);

	document.querySelectorAll("div[contenteditable]").forEach((e) => {
		e.addEventListener("input", onChatInput);
		e.addEventListener("keydown", onChatKeyDown);

		const parent = e.parentElement;

		if (
			document.querySelector("#app").childElementCount > 1 &&
			!parent.querySelector(".csam-send")
		) {
			const sendButton = Templates.SEND.cloneNode(true).content.children[0];
			parent
				.querySelector("button")
				.classList.forEach((c) => sendButton.classList.add(c));
			parent.append(sendButton);
		}

		Observers.STICKER.observe(e.parentNode.parentNode, {
			childList: true,
		});
	});

	const stickerElem = document.querySelector("#stickers");
	if (stickerElem) {
		Observers.STICKER.observe(stickerElem, { childList: true });
	}

	Observers.CHAT.disconnect();
	Observers.CHAT.observe(chat, { childList: true });

	getCurrentUserStickers();
	sortUsers();
}

function onContainerUpdate(_mutationList, self) {
	if (self !== Observers.CONTAINER) {
		self.disconnect();
		return;
	}

	const chat = document.querySelector(".overflow-x-hidden.h-full");

	if (!chat) return;

	self.disconnect();
	onChatReady(chat);
}

function waitForChat() {
	Observers.RELOAD.disconnect();
	currentChannel = window.location.pathname.split("/")[1].toLowerCase();

	Observers.CONTAINER.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});
}

function checkStickerMatch(s, v) {
	if (s.dataset.sticker.includes(v.replace("id:", ""))) {
		return true;
	}

	if (v.startsWith("id:")) {
		return false;
	}

	const username = s.closest(".csam-user");
	if (username && username.dataset.channel.toLowerCase().includes(v)) {
		return true;
	}

	const { tags } = s.dataset;

	if (tags) {
		return tags.includes(v);
	}

	return false;
}

Observers.CHAT = buildObserver(onChatMessage);
Observers.STICKER = buildObserver(applyStickerHTML);
Observers.RELOAD = buildObserver(waitForChat);
Observers.CONTAINER = buildObserver(onContainerUpdate);
Observers.STICKER_INTERSECTION = new IntersectionObserver(
	onStickerIntersection,
	{
		root: Elements.CONTENT,
		rootMargin: "120px",
		threshold: 0.1,
	},
);

Elements.HEADER.querySelector("#csam-tab-btns").addEventListener(
	"click",
	changeTab,
);

Elements.CONTENT.querySelector("#csam-search").addEventListener(
	"input",
	(e) => {
		const t = e.target;
		const val = t.value.toLowerCase();
		t.parentNode
			.querySelectorAll(".csam-stk-container")
			.forEach((s) =>
				s.classList.toggle("csam-hide", !checkStickerMatch(s, val)),
			);
		t.parentNode
			.querySelectorAll(".csam-user")
			.forEach((s) =>
				s.classList.toggle(
					"csam-hide",
					!s.querySelector(".csam-stk-container:not(.csam-hide"),
				),
			);
	},
);

document.addEventListener("click", (e) => {
	if (e.target.closest("a")) {
		waitForChat();
	}
});

window.addEventListener("popstate", () => {
	if (window.location.pathname !== "/") {
		waitForChat();
	}
});

document.head.insertAdjacentHTML(
	"beforeend",
	String.raw`
		<style>
			[contenteditable="true"] img {
				width: unset !important;
				max-width: 24px;
				height: unset !important;
				max-height: 24px;
				display: flex
			}

			#csam-header {
				display: flex;
				flex-direction: column;
				gap: .5rem;
			}

			#csam-tab-btns {
				display: flex;
				gap: .5rem;
			}

			.csam-stk-container button {
				position: absolute;
				top: 0;
				right: 0;
				display: none;
				line-height: 0.75rem;
				color: gold;
				text-align: right;
			}

			.csam-stk-container:hover button {
				display: block;
			}

			.csam-stk-container button::after {
				content: "☆";
			}

			.csam-stk-container.csam-saved button::after {
				content: "★";
			}

			#csam-menu {
				overflow-y: overlay;
				height: 100%;
				padding: .5rem;
			}

			#csam-menu,
			#csam-tabs>[data-tab='all'] {
				display: flex;
				flex-direction: column;
				gap: .5rem;
			}

			#csam-search {
				width: 100%;
				padding: .25rem .5rem;
				font-size: 14px;
				border-width: 2px;
				border-radius: .25rem;
				outline: 2px solid transparent;
				outline-offset: 2px;
			}

			.csam-user {
				display: flex;
				flex-direction: column;
				gap: .5rem;
			}

			.csam-stk-grid {
				display: grid;
				grid-template-columns: repeat(5, minmax(0, 1fr));
				gap: .5rem;
				place-items: center center;
			}

			.csam-stk-container {
				position: relative;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 28px;
				height: 28px;
				vertical-align: top;
			}

			.csam-stk-container img {
				cursor: pointer;
				user-select: none;
				display: inline-block;
				max-width: 100%;
				max-height: 100%;
			}

			.chat_sticker_large .csam-stk-container,
			#csam-menu .csam-stk-container {
				width: 56px;
				height: 56px;
			}

			.csam-hide {
				display: none !important;
			}

			.relative.flex-nowrap,
			.relative.flex-nowrap div:has(> [contenteditable]) {
				height: auto !important;
			}

			.relative.flex-nowrap .absolute {
				padding-left: .5rem;
			}

			.relative.flex-nowrap [contenteditable] {
				overflow: scroll;
				max-height: 300px;
				margin: .5rem 0;
				padding: 0;
				white-space: pre-line;
			}

			.relative.flex-nowrap div:has(> [contenteditable]) {
				align-items: end;
				border-radius: .25rem;
			}

			.relative.flex-nowrap div:has(> [contenteditable]):has(> .csam-send) {
				padding-right: .125rem;
			}

			.relative.flex-nowrap div:has(> [contenteditable]) button {
				margin-bottom: 4px;
			}

			#csam-tab-btns button {
				padding: .25rem .5rem;
				font-weight: 500;
				border-radius: .125rem .125rem 0 0;
			}

			div:has(> #csam-menu) {
				position: unset;
				margin-bottom: .5rem;
			}
		</style>
	`,
);

waitForChat();
getStickers();
getTags();
