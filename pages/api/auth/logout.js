module.exports = (req, res) => {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/');
  res.writeHead(302, { Location: '/' });
  res.end();
};
