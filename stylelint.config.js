/** @type {import('stylelint').Config} */
export default {
	plugins: ["stylelint-less"],
	extends: [
		"stylelint-config-standard",
		"stylelint-config-clean-order",
		"stylelint-config-standard-less",
	],
};
