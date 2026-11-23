const express = require('express');
const config = require('./config');

const app = express();
app.use(express.json());

app.use('/api/session', require('./routes/session'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/files', require('./routes/files'));
app.use('/api/users', require('./routes/users'));
app.use('/share', require('./routes/share'));

app.get('/healthz', (req, res) => res.json({ ok: true }));

if (require.main === module) {
  app.listen(config.port, () => console.log(`acme-notes listening on :${config.port}`));
}

module.exports = app;
