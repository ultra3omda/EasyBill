const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
      timeout: 30000,
      onError: (err, req, res) => {
        console.error('[Proxy] Erreur:', err.message);
      },
    })
  );
};
