// Production server for Firebase App Hosting
// Serves the Vite build output (dist/) as a static SPA

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const DIST = path.join(__dirname, 'dist');

app.use(express.static(DIST, {
  maxAge: '1y',
  etag: true,
}));

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Hoosh AI App running on http://${HOST}:${PORT}`);
});
