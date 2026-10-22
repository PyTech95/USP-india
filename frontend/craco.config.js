// craco.config.js — portable version, no platform-specific plugins
const path = require("path");
require("dotenv").config();

// webpack-dev-server v5 compatibility shim
function makeDevServerV5Compatible(devServerConfig) {
  const {
    https,
    onAfterSetupMiddleware,
    onBeforeSetupMiddleware,
    onListening,
    setupMiddlewares,
    ...compatibleConfig
  } = devServerConfig;

  compatibleConfig.server =
    typeof https === "object"
      ? { type: "https", options: https }
      : https
        ? "https"
        : "http";
  compatibleConfig.headers = {
    ...compatibleConfig.headers,
    "Cross-Origin-Resource-Policy": "same-origin",
  };

  if (onBeforeSetupMiddleware || setupMiddlewares) {
    compatibleConfig.setupMiddlewares = (middlewares, devServer) => {
      if (onBeforeSetupMiddleware) {
        onBeforeSetupMiddleware(devServer);
      }
      return setupMiddlewares
        ? setupMiddlewares(middlewares, devServer)
        : middlewares;
    };
  }

  compatibleConfig.onListening = (devServer) => {
    devServer.close ??= (callback) => devServer.stopCallback(callback);
    if (onListening) onListening(devServer);
    if (onAfterSetupMiddleware) onAfterSetupMiddleware(devServer);
  };

  return compatibleConfig;
}

module.exports = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    configure: (webpackConfig) => {
      // The CSS minifier must not rewrite calc() expressions that use CSS variables
      // (e.g. calc(108px * var(--dz, 1)) — the page-width scale of the desktop design).
      try {
        const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
        const min = webpackConfig.optimization && webpackConfig.optimization.minimizer;
        if (Array.isArray(min)) {
          webpackConfig.optimization.minimizer = min.map((plugin) =>
            plugin instanceof CssMinimizerPlugin
              ? new CssMinimizerPlugin({ minimizerOptions: { preset: ["default", { calc: false }] } })
              : plugin
          );
        }
      } catch (e) {
        // minifier not installed (dev server): nothing to adjust
      }
      webpackConfig.watchOptions = {
        ...webpackConfig.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/build/**",
          "**/dist/**",
          "**/coverage/**",
          `${path.resolve(__dirname, "public")}/**`,
        ],
      };
      return webpackConfig;
    },
  },
  devServer: (devServerConfig) => makeDevServerV5Compatible(devServerConfig),
};
