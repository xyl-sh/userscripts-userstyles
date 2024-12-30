import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginUserscripts from "eslint-plugin-userscripts";
import globals from "globals";
import { FlatCompat } from "@eslint/eslintrc";

/** @type { import("eslint").Linter.Config[] } */
export default [
	...new FlatCompat().extends("eslint-config-airbnb"),
	{
		files: ["**/*.user.js"],
		plugins: {
			userscripts: {
				rules: eslintPluginUserscripts.rules,
			},
		},
		rules: {
			...eslintPluginUserscripts.configs.recommended.rules,
			strict: [1, "safe"],
		},
		settings: {
			userscriptVersions: {
				violentmonkey: "*",
			},
		},
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.greasemonkey,
			},
		},
	},
	eslintConfigPrettier,
];
