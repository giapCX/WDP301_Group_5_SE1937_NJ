module.exports = function configureWebpack(environment) {
  process.env.BABEL_ENV = environment;
  process.env.NODE_ENV = environment;
  require('react-scripts/config/env');

  const configPath = require.resolve('react-scripts/config/webpack.config');
  const createConfig = require(configPath);
  const sourceMapLoader = require.resolve('source-map-loader', { paths: [configPath] });

  require.cache[configPath].exports = (mode) => {
    const config = createConfig(mode);
    const sourceMapRule = config.module.rules.find((rule) => rule?.loader === sourceMapLoader);
    if (sourceMapRule) {
      // The published docx-preview map references TypeScript files absent from its npm package.
      sourceMapRule.exclude = [
        ...[].concat(sourceMapRule.exclude || []),
        /[\\/]node_modules[\\/]docx-preview[\\/]/,
      ];
    }
    return config;
  };
};
