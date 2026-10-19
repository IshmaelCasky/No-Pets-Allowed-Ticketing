import { defineConfig } from "eslint/config";

import { baseConfig } from "@npa/eslint-config/base";
import { reactConfig } from "@npa/eslint-config/react";

export default defineConfig(
  {
    ignores: [".expo/**", "expo-plugins/**"],
  },
  baseConfig,
  reactConfig,
);
