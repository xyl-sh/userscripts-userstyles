// ==UserScript==
// @name         Cozy.tv Rumble Embed
// @description  Embeds the Rumble video player and chat on Cozy.tv.
// @author       Xyl
// @icon         https://cozy.tv/favicon.ico
// @license      AGPL-3.0-or-later
// @namespace    xyl
// @version      1.0.0
// @run-at       document-start
// @match        https://cozy.tv/*
// @match        https://rumble.com/chat/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

const BaseUrls = {
	CHAT: "https://rumble.com/chat/popup",
	EMBED: "https://rumble.com/embed",
};

const Observers = {
	RELOAD: null,
	READY: null,
	CHAT: null,
	VIDEO: null,
};

const ChannelDict = {
	acumia: "user/AnthonyCumia",
	alexjones: "Infowars",
	augie: "AugieRFC",
	beardson: "BeardsonBeardly",
	bookcat: "Hamiltonianist",
	brysongray: "user/RealBrysonGray",
	chieftrumpster: "ChiefTrumpster",
	crosstalknews: "user/CrossTalkNews",
	daltonclodfelter: "DaltonClodfelter",
	dawson: "user/RyanDawson",
	emichaeljones: "EMichaelJones",
	hw: "HarrisWalker",
	infrared: "infrared",
	jacksonhinkle: "user/jacksonhinkle",
	jimbozoomer: "Jimbozoomer",
	jlp: "JesseLeePeterson",
	joeldavis: "joeldavis",
	keithwoods: "keithwoods",
	loomer: "LauraLoomer",
	lporiginalg: "LPoriginalG",
	nick: "nickjfuentes",
	patdixon: "PatDixon",
	paultown: "PaulTown",
	politicallyprovoked: "user/PoliticallyProvoked1",
	stewpeters: "stewpeters",
	stone: "RogerStone",
	tenryo: "user/Tenryo",
	thedickshow: "dickmasterson",
	timothyjgordon: "TimothyGordon",
	tylerrussell: "TylerRussell",
	vince: "RealVincentJames",
	waynedupreeshow: "WayneDupreeShow",
	wendell: "BookClubAnalysis",
	wurzelroot: "Wurzelroot",
};

const Templates = {
	CHAT_HEADER: document.createElement("template"),
	IFRAME: document.createElement("template"),
};

Templates.CHAT_HEADER.innerHTML = String.raw`
	<div class="cre-chat-switcher nav-shadow border-b border-gray-600">
		<button data-chat="cozy" class="font-bar font-bold" style="border-color: #0070fa">Cozy.tv</button>
		<button data-chat="rumble" class="font-bar font-bold" style="border-color: #85c742">Rumble</button>
	</div>
`;

Templates.IFRAME.innerHTML = String.raw`
	<iframe class="cre-iframe" allowfullscreen="true" frameborder="0"></iframe>
`;

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

function onChatClick(e) {
	const t = e.target;
	if (!t.matches("button[data-chat]")) {
		return;
	}

	[...t.parentElement.children].forEach((b) =>
		b.classList.toggle("cre-active", b === t),
	);

	t.parentElement.parentElement
		.querySelectorAll(".cre-chat-switcher ~ [data-chat]")
		.forEach((c) =>
			c.classList.toggle("cre-hide", c.dataset.chat !== t.dataset.chat),
		);
}

function cleanUpEmbeds() {
	document.querySelectorAll(".cre-hide").forEach((e) => {
		e.classList.remove("cre-hide");
	});

	document
		.querySelectorAll(".cre-video, .cre-chat, .cre-chat-switcher")
		.forEach((e) => e.remove());
}

function insertVideo(videoId, channel, observer = null) {
	if (currentChannel !== channel || observer !== Observers.VIDEO) {
		if (observer) {
			observer.disconnect();
		}

		return;
	}

	const currentEmbed = document.querySelector(
		`iframe[src^="${BaseUrls.EMBED}"]`,
	);
	if (currentEmbed) {
		if (videoId === currentEmbed.dataset.id) {
			return;
		}
		currentEmbed.remove();
	}

	const video = document.querySelector(".notbody .video-js");
	const profile = document.querySelector("#profile");

	if (!video && !profile) {
		if (!observer) {
			Observers.VIDEO = buildObserver((_m, self) =>
				insertVideo(videoId, channel, self),
			);

			Observers.VIDEO.observe(document.documentElement, {
				childList: true,
				subtree: true,
			});
		}

		return;
	}

	if (observer) {
		observer.disconnect();
	}

	document.querySelectorAll("#app video").forEach((e) => e.pause());

	const baseNode = video
		? video.parentElement.parentElement.parentElement
		: profile.querySelector("[style*='background-image']");

	const iframe = Templates.IFRAME.cloneNode(true).content.children[0];
	iframe.src = `${BaseUrls.EMBED}/${videoId}`;
	iframe.classList.add("cre-video");
	iframe.dataset.id = videoId;
	baseNode.append(iframe);

	if (document.querySelector("#app").childElementCount === 1) {
		return;
	}

	const chatButton = document.querySelector(".sticky ul li:last-child");
	if (chatButton) {
		chatButton.click();
	}
}

function insertChat(chatId, channel, observer = null) {
	if (currentChannel !== channel || observer !== Observers.CHAT) {
		if (observer) {
			observer.disconnect();
		}

		return;
	}

	const currentEmbed = document.querySelector(
		`iframe[src^="${BaseUrls.CHAT}"]`,
	);
	if (currentEmbed) {
		if (chatId === currentEmbed.dataset.id) {
			return;
		}
		currentEmbed.remove();
	}

	const chat = document.querySelector(
		".flex-shrink-0.h-full.border-l.border-gray-600",
	);

	if (!chat) {
		if (!observer) {
			Observers.CHAT = buildObserver((_m, self) =>
				insertChat(chatId, channel, self),
			);

			Observers.CHAT.observe(document.documentElement, {
				childList: true,
				subtree: true,
			});
		}

		return;
	}

	if (observer) {
		observer.disconnect();
	}

	chat.firstChild.dataset.chat = "cozy";
	const headers = Templates.CHAT_HEADER.cloneNode(true).content.children[0];
	headers.addEventListener("click", onChatClick);
	chat.prepend(headers);

	const iframe = Templates.IFRAME.cloneNode(true).content.children[0];
	iframe.src = `${BaseUrls.CHAT}/${chatId}`;
	iframe.classList.add("cre-chat");
	iframe.dataset.chat = "rumble";
	iframe.dataset.id = chatId;
	chat.append(iframe);

	headers.querySelector("button[data-chat='cozy']").click();
}

function onRumbleVideoResponse(r, channel) {
	if (currentChannel !== channel) {
		return;
	}

	const template = document.createElement("template");
	template.innerHTML = r.response;
	const rumbleChat = template.content.querySelector(".chat--container");
	const link = template.content.querySelector("link[href*='embed']");
	if (!link || !rumbleChat) {
		return;
	}
	const videoId = link.href.match(/(?<=embed%2F)[a-zA-Z\d]*/g)[0];
	const chatId = template.content
		.querySelector("[data-video-id]")
		.getAttribute("data-video-id");

	insertVideo(videoId, channel);
	insertChat(chatId, channel);
}

function onRumbleChannelResponse(data, channel) {
	if (currentChannel !== channel) {
		return;
	}

	const template = document.createElement("template");
	template.innerHTML = data.response;
	const link = template.content.querySelector(
		".videostream:not(:has(videostream__time)) a",
	);

	if (!link) {
		return;
	}

	GM_xmlhttpRequest({
		method: "GET",
		url: `https://rumble.com${link.href}`,
		responseType: "text",
		onload: (r) => onRumbleVideoResponse(r, channel),
	});
}

function getRumbleVideo(channel) {
	const rumble = ChannelDict[channel];
	if (!rumble) {
		return;
	}

	GM_xmlhttpRequest({
		method: "GET",
		url: `https://rumble.com/${rumble}/livestreams?date=today`,
		responseType: "text",
		onload: (r) => onRumbleChannelResponse(r, channel),
	});

	setTimeout(getRumbleVideo, 15000);
}

function waitForReady() {
	const closeButton = document.querySelector("svg[height='86']");
	if (closeButton && document.querySelector(".cre-video")) {
		closeButton.dispatchEvent(
			new MouseEvent("click", {
				bubbles: true,
			}),
		);
	}
	if (!document.querySelector(".overflow-x-hidden.h-full")) {
		return;
	}

	Observers.READY.disconnect();

	document
		.querySelectorAll(
			".notbody, .notbody .flex, #app > div:not(:has(> .pointer-events-none)), .sticky + .flex-grow > .h-full",
		)
		.forEach((e) => {
			Observers.RELOAD.observe(e, {
				childList: true,
			});
		});

	const profile = document.querySelector(".text-sm[style^='border-top'] a");
	if (profile) {
		Observers.RELOAD.observe(profile, {
			childList: true,
			attributes: true,
		});
	}
}

function waitForChat() {
	Observers.RELOAD.disconnect();

	Observers.READY.disconnect();
	Observers.READY.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});

	const newChannel = window.location.pathname.split("/")[1].toLowerCase();
	if (newChannel === currentChannel) {
		return;
	}

	cleanUpEmbeds();
	currentChannel = newChannel;
	getRumbleVideo(newChannel);
}

Observers.RELOAD = buildObserver(waitForChat);
Observers.READY = buildObserver(waitForReady);

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

const cozyCss = String.raw`
	<style>
		.cre-chat-switcher {
			display: flex;
			flex-shrink: 0;
			align-items: center;
			height: 36px;
		}

		.cre-chat-switcher button {
			width: 100%;
			height: 100%;
			text-align: center;
		}

		div:has(~ iframe:not([data-chat])) {
			display: none !important;
		}

		iframe {
			width: 100%;
			height: 100%;
		}

		.flex-shrink-0.h-full.border-l.border-gray-600 [data-chat] {
			height: 100%;
		}

		.flex-shrink-0.h-full.border-l.border-gray-600 {
			display: flex;
			flex-direction: column;
		}

		.cre-hide {
			display: none;
		}

		.cre-chat-switcher:has(.cre-active[data-chat="rumble"]) {
			background: black;
		}

		@media (prefers-color-scheme: light) {
			.cre-chat-switcher:has(.cre-active[data-chat="rumble"]) {
				color: black;
				background: white;
			}
		}

		button[data-chat] {
			border-width: 0;
		}

		button[data-chat].cre-active {
			border-bottom-width: 2px
		}

		button[data-chat="rumble"] {
			border-color: #85c742;
		}

		#profile > div:has(iframe) {
			height: unset;
			min-height: 200px;
			max-height: calc(-200px + 100vh)
		}

		#profile > div:has(iframe)::before {
			content: "";
			padding-bottom: 56.25%;
		}

		#app:has(.cre-video) .sticky-player {
			display: none;
		}

		#scroll-container > #profile:has(.cre-video) {
			overflow-y: unset;
		}

		.sticky + .flex-grow {
			min-height: unset !important;
		}

		.sticky + .flex-grow > .h-full > .relative {
			position: unset !important;
			padding-top: unset;
		}
	</style>
`;

const rumbleCss = String.raw`
	<style>
		#premium-popup__container--aria,
		.chat--signin-container {
			display: none;
		}

		section.chat {
			border-left: 0px !important;
		}
	</style>
`;

const isCozy = window.location.host === "cozy.tv";
if (isCozy) {
	waitForChat();
}

document.head.insertAdjacentHTML("beforeend", isCozy ? cozyCss : rumbleCss);
