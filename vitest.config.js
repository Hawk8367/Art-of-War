const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    include: ["tests/unit/**/*.test.js"],
    environment: "node",
    globals: true,
    reporters: ["default"],
    coverage: {
      enabled: false,
    },
  },
});
