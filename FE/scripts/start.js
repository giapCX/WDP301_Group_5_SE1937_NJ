const webpackDevServerConfigPath = require.resolve(
  'react-scripts/config/webpackDevServer.config'
);
const createDevServerConfig = require(webpackDevServerConfigPath);

require.cache[webpackDevServerConfigPath].exports = (proxy, allowedHost) => {
  const config = createDevServerConfig(proxy, allowedHost || 'localhost');
  config.allowedHosts = ['localhost', '127.0.0.1'];
  return config;
};

process.env.HOST = '127.0.0.1';

require('react-scripts/scripts/start');
