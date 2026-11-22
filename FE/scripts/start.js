const webpackDevServerConfigPath = require.resolve(
  'react-scripts/config/webpackDevServer.config'
);
const createDevServerConfig = require(webpackDevServerConfigPath);

require.cache[webpackDevServerConfigPath].exports = (proxy, allowedHost) => {
  const config = createDevServerConfig(proxy, allowedHost || 'localhost');
  config.allowedHosts = ['localhost', '127.0.0.1'];
  return config;
};

process.env.HOST = 'localhost';
process.env.PORT = '3000';

require('./configure-webpack')('development');
require('react-scripts/scripts/start');
