module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  extends: ["standard"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    // Enforce consistent code style
    semi: ["error", "never"],
    quotes: ["error", "single"],
    "comma-dangle": ["error", "never"],
    "space-before-function-paren": ["error", "never"],

    // Security rules
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-script-url": "error",

    // Error prevention
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "no-console": "off", // Allow console in CLI app
    "no-process-exit": "error", // We handle exits properly now

    // Code quality
    "prefer-const": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-arrow-callback": "error",

    // Async/await
    "prefer-promise-reject-errors": "error",
    "no-return-await": "error",
  },
  overrides: [
    {
      files: ["bin/*.js"],
      rules: {
        // CLI files can have different rules
        "no-process-exit": "off",
      },
    },
  ],
};
