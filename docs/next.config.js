// eslint-disable-next-line @typescript-eslint/no-require-imports
const withNextra = require("nextra")({
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.jsx",
});

module.exports = withNextra({
  output: "export",
  basePath: process.env.NODE_ENV === "production" ? "/clicklens" : "",
  images: {
    unoptimized: true,
  },
});
