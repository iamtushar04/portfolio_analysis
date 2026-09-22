import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Custom rules
  {
    rules: {
      // Prevent unused variables
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // Allow console during development
      "no-console": [
        "warn",
        {
          allow: ["warn", "error"],
        },
      ],

      // React best practices
      "react-hooks/exhaustive-deps": "warn",

      // Prevent accidental debugger statements
      "no-debugger": "error",

      // Require semicolons
      "semi": [
        "error",
        "always",
      ],

      // Use single quotes
      "quotes": [
        "error",
        "single",
        {
          avoidEscape: true,
        },
      ],
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
]);

export default eslintConfig;