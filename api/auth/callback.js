export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing code parameter');
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.OAUTH_GITHUB_CLIENT_ID,
        client_secret: process.env.OAUTH_GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error_description });
    }

    // Only our own site may receive the token; any other opener would get repo access
    const siteOrigin = new URL(process.env.SITE_URL || 'https://aymane-portofolio-eta.vercel.app').origin;
    const message = 'authorization:github:success:' + JSON.stringify({ token: data.access_token, provider: 'github' });
    // Escape "<" so the values can't close the script tag
    const js = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

    // Send the token back to Decap CMS via postMessage
    const html = `
<!doctype html>
<html>
<head><title>Authenticating...</title></head>
<body>
<script>
(function() {
  var allowedOrigin = ${js(siteOrigin)};
  function receiveMessage(e) {
    if (e.origin !== allowedOrigin) return;
    window.opener.postMessage(${js(message)}, allowedOrigin);
    window.close();
  }
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send('Authentication failed');
  }
}
