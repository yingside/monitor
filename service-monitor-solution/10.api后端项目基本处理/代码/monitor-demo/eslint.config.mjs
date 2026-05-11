import eslint from "@eslint/js";
import globals from "globals";
import tseslint, { parser, plugin } from "typescript-eslint";
import eslintPrettier from "eslint-plugin-prettier";
import eslintPluginVue from "eslint-plugin-vue";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

//前端配置
const frontendConfig = {
  files: ["apps/frontend/monitor/**/*.{ts,tsx,js,jsx,vue}"],
  ignores: ["apps/frontend/monitor/src/components/ui/**/*"],
  extends: [...eslintPluginVue.configs["flat/recommended"]],
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    globals: {
      ...globals.browser
    },
    parserOptions: {
      ecmaFeatures: {
        jsx: true
      }
    },
    parser: tseslint.parser
  },
  plugins: {
    "react-hooks": reactHooks,
    "react-refresh": reactRefresh
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    "react-refresh/only-export-components": [
      "warn",
      {
        allowConstantExport: true
      }
    ]
  }
};

//后端配置
const backendConfig = {
  files: ["apps/backend/**/*.{ts,js}"],
  languageOptions: {
    globals: {
      ...globals.node
    },
    parser: tseslint.parser
  },
  rules: {
    "no-unused-vars": "off",
    "no-undef": "off"
  }
};

const ignores = [
  "dist",
  "node_modules",
  "build",
  "**/*.js",
  "**/*.mjs",
  "**/*.d.ts",
  "apps/frontend/monitor/src/components/ui/**/*"
];
export default tseslint.config(
  // 通用配置
  {
    ignores,
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      prettier: eslintPrettier
    },
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  frontendConfig,
  backendConfig
);
