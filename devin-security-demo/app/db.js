const crypto = require('crypto');

const users = [
  { id: 1, username: 'alice', password: 'alice123', role: 'admin', prefs: {} },
  { id: 2, username: 'bob', password: 'bob123', role: 'member', prefs: {} },
  { id: 3, username: 'mallory', password: 'mallory123', role: 'member', prefs: {} }
];

const notes = [
  { id: 1, ownerId: 1, title: 'Q3 board update', body: 'Revenue numbers, do not share.', shareToken: crypto.randomBytes(8).toString('hex') },
  { id: 2, ownerId: 2, title: 'Groceries', body: 'Milk, eggs, coffee.', shareToken: crypto.randomBytes(8).toString('hex') },
  { id: 3, ownerId: 1, title: 'Vendor contracts', body: 'Renewal terms for 2026.', shareToken: crypto.randomBytes(8).toString('hex') }
];

module.exports = {
  users,
  notes,
  findUser: (username) => users.find((u) => u.username === username),
  findUserById: (id) => users.find((u) => u.id === Number(id)),
  findNote: (id) => notes.find((n) => n.id === Number(id)),
  findNoteByToken: (token) => notes.find((n) => n.shareToken === token),
  notesFor: (userId) => notes.filter((n) => n.ownerId === userId)
};
