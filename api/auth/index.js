export default function handler(req, res) {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
  const redirectUri = `${process.env.SITE_URL || 'https://aymane-portofolio.vercel.app'}/api/auth/callback`;
  const scope = 'repo,user';

  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;

  res.redirect(301, authUrl);
}
