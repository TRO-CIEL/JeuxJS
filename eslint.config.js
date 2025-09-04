// eslint.config.cjs
const globals = require("globals");
const pluginJS = require("@eslint/js");

module.exports = [
    {
        languageOptions: {
            globals: globals.browser,
        },
        rules: {
            "indent": ["warn", 4],
            "linebreak-style": ["error", "windows"],
            "quotes": ["error", "single"],
            "semi": ["error", "always"]
        },
    },
    pluginJS.configs.recommended,
];