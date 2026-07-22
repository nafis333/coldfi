const BACKEND_URL = 'https://coldfi.onrender.com';

module.exports = async function handler(req, res) {
  const path = req.url;
  const targetUrl = `${BACKEND_URL}${path}`;

  const headers = { 'Content-Type': 'application/json' };
  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization;
  }

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const data = await response.text();

    res.status(response.status);
    for (const [key, value] of response.headers) {
      const lower = key.toLowerCase();
      if (
        !['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(lower)
      ) {
        res.setHeader(key, value);
      }
    }
    res.send(data);
  } catch (err) {
    res.status(502).json({ error: 'Bad Gateway', message: 'Failed to reach backend' });
  }
};
