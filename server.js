'use strict';

const express        = require('express');
const path           = require('path');
const ExcelJS        = require('exceljs');
const session        = require('express-session');
const bcrypt         = require('bcryptjs');
const db             = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'terra-natura-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

app.use(express.static(path.join(__dirname, 'public')));


function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

function requireAuthPage(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.redirect('/login.html');
}


app.get('/login.html', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.session.userId   = user.id;
  req.session.username = user.username;
  req.session.role     = user.role;

  res.json({ message: 'Login successful.', username: user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out.' });
  });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ username: req.session.username, role: req.session.role });
  } else {
    res.status(401).json({ error: 'Not logged in.' });
  }
});

app.get('/',             requireAuthPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/index.html',   requireAuthPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/form.html',    requireAuthPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'form.html')));
app.get('/sample.html',  requireAuthPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'sample.html')));

app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const total     = db.prepare('SELECT COUNT(*) AS count FROM samples').get().count;
    const water     = db.prepare("SELECT COUNT(*) AS count FROM samples WHERE type = 'water'").get().count;
    const soil      = db.prepare("SELECT COUNT(*) AS count FROM samples WHERE type = 'soil'").get().count;
    const air       = db.prepare("SELECT COUNT(*) AS count FROM samples WHERE type = 'air'").get().count;
    const ready     = db.prepare("SELECT COUNT(*) AS count FROM samples WHERE status = 'ready'").get().count;
    const processed = db.prepare("SELECT COUNT(*) AS count FROM samples WHERE status = 'processed'").get().count;

    res.json({ total, water, soil, air, ready, processed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/samples', requireAuth, (req, res) => {
  const { type, status, from, to, location } = req.query;

  let query    = 'SELECT * FROM samples WHERE 1=1';
  const params = [];

  if (type)     { query += ' AND type = ?';                        params.push(type); }
  if (status)   { query += ' AND status = ?';                      params.push(status); }
  if (from)     { query += ' AND datetime >= ?';                   params.push(from); }
  if (to)       { query += ' AND datetime <= ?';                   params.push(to + ' 23:59:59'); }
  if (location) { query += ' AND location LIKE ? COLLATE NOCASE';  params.push('%' + location + '%'); }

  query += ' ORDER BY datetime DESC';

  try {
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/samples/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM samples WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Sample not found' });
  res.json(row);
});

app.post('/api/samples', requireAuth, (req, res) => {
  const { datetime, location, type, employee, results, status } = req.body;

  if (!datetime || !location || !type || !employee) {
    return res.status(400).json({ error: 'Fields datetime, location, type, and employee are required.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO samples (datetime, location, type, employee, results, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(datetime, location, type, employee, results || '', status || 'ready');
    res.status(201).json({ id: info.lastInsertRowid, message: 'Sample added successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/samples/:id', requireAuth, (req, res) => {
  const { datetime, location, type, employee, results, status } = req.body;

  if (!datetime || !location || !type || !employee) {
    return res.status(400).json({ error: 'Fields datetime, location, type, and employee are required.' });
  }

  try {
    const stmt = db.prepare(`
      UPDATE samples
      SET datetime = ?, location = ?, type = ?, employee = ?, results = ?, status = ?
      WHERE id = ?
    `);
    const info = stmt.run(datetime, location, type, employee, results || '', status || 'ready', req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Sample not found.' });
    res.json({ message: 'Sample updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/samples/:id', requireAuth, (req, res) => {
  try {
    const info = db.prepare('DELETE FROM samples WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Sample not found.' });
    res.json({ message: 'Sample deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export', requireAuth, async (req, res) => {
  try {
    const { type, status, from, to, location } = req.query;

    let query    = 'SELECT * FROM samples WHERE 1=1';
    const params = [];

    if (type)     { query += ' AND type = ?';                        params.push(type); }
    if (status)   { query += ' AND status = ?';                      params.push(status); }
    if (from)     { query += ' AND datetime >= ?';                   params.push(from); }
    if (to)       { query += ' AND datetime <= ?';                   params.push(to + ' 23:59:59'); }
    if (location) { query += ' AND location LIKE ? COLLATE NOCASE';  params.push('%' + location + '%'); }

    query += ' ORDER BY datetime DESC';

    const rows = db.prepare(query).all(...params);

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Samples Log');

    worksheet.columns = [
      { header: 'ID',          key: 'id',        width: 6  },
      { header: 'Date & Time', key: 'datetime',  width: 20 },
      { header: 'Location',    key: 'location',  width: 25 },
      { header: 'Type',        key: 'type',      width: 10 },
      { header: 'Employee',    key: 'employee',  width: 20 },
      { header: 'Results',     key: 'results',   width: 35 },
      { header: 'Status',      key: 'status',    width: 12 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FF2D6A4F' }
    };

    rows.forEach(row => worksheet.addRow(row));

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const color = rowNumber % 2 === 0 ? 'FFD8F3DC' : 'FFFFFFFF';
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        });
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=terra_natura_samples.xlsx');
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(` Terra Natura server running at http://localhost:${PORT}`);
});