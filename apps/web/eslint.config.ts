import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@npa/eslint-config/base";
import { nextjsConfig } from "@npa/eslint-config/nextjs";
import { reactConfig } from "@npa/eslint-config/react";

export default defineConfig(
  {
    ignores: [".next/**"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
);
