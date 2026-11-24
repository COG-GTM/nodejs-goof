module.exports = {
  port: process.env.PORT || 3000,
  sessionSecret: 'acme-notes-dev-secret-2019',
  uploadsDir: require('path').join(__dirname, 'uploads')
};
