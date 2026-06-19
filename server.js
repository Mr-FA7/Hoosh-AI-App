// Production server for Firebase App Hosting
// Serves the Vite build output (dist/) as a static SPA

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const DIST = path.join(__dirname, 'dist');

// Serve static files
app.use(express.static(DIST, {
  maxAge: '1y',
  etag: true,
}));

// SPA fallback — all routes → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Hoosh AI App running on port ${PORT}`);
});
