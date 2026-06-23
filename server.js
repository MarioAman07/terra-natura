const express = require('express');
const path    = require('path');
const ExcelJS = require('exceljs');
const db      = require('./database');

const app  = express();
const PORT = 3000;

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/samples', (req, res) => {
  const { type, status, from, to } = req.query;

  let query  = 'SELECT * FROM samples WHERE 1=1';
  const params = [];

  if (type)   { query += ' AND type = ?';              params.push(type); }
  if (status) { query += ' AND status = ?';            params.push(status); }
  if (from)   { query += ' AND datetime >= ?';         params.push(from); }
  if (to)     { query += ' AND datetime <= ?';         params.push(to + ' 23:59:59'); }

  query += ' ORDER BY datetime DESC';

  try {
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/samples/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM samples WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Sample not found' });
  res.json(row);
});

app.post('/api/samples', (req, res) => {
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

app.put('/api/samples/:id', (req, res) => {
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

app.delete('/api/samples/:id', (req, res) => {
  try {
    const info = db.prepare('DELETE FROM samples WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Sample not found.' });
    res.json({ message: 'Sample deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export', async (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM samples ORDER BY datetime DESC').all();

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Samples Log');

    // Define columns
    worksheet.columns = [
      { header: 'ID',          key: 'id',        width: 6 },
      { header: 'Date & Time', key: 'datetime',   width: 20 },
      { header: 'Location',    key: 'location',   width: 25 },
      { header: 'Type',        key: 'type',       width: 10 },
      { header: 'Employee',    key: 'employee',   width: 20 },
      { header: 'Results',     key: 'results',    width: 35 },
      { header: 'Status',      key: 'status',     width: 12 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FF2D6A4F' }  // dark green
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