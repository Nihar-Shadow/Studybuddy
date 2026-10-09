// ── Admin Routes ─────────────────────────────────
// Taxonomy admin, bulk upload, admin UI

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

const { parse: csvParse }    = require('csv-parse/sync');
// xlsx removed: GHSA-4r6h-8v6p-xvw6 prototype pollution + GHSA-5pgg-2g8v-p4x9 ReDoS, no upstream fix.
// Bulk upload is CSV-only. Teachers can export to .csv from Excel/Google Sheets.
const { spreadsheetUpload }  = require('../middleware/upload');

const {
  getStats,
  approvePending,
  rejectPending,
  removeLearned,
  manuallyAddTopic,
  rebuildLiveTaxonomy
} = require('../agent/dynamicTaxonomy');

// GET full taxonomy stats (learned + pending)
router.get('/admin/taxonomy', (req, res) => {
  res.json(getStats());
});

// POST manually add a topic
// Body: { topic: string, keywords: string[], subject: string }
router.post('/admin/taxonomy', (req, res) => {
  const { topic, keywords, subject } = req.body;
  if (!topic || !Array.isArray(keywords)) {
    return res.status(400).json({ error: 'topic and keywords[] required' });
  }
  const key = manuallyAddTopic(topic, keywords, subject);
  res.json({ success: true, addedKey: key });
});

// GET — download a CSV template teachers can fill in
router.get('/admin/taxonomy/template.csv', (req, res) => {
  const csv = [
    'topic,keywords,subject',
    'Photosynthesis,"photosynthesis, chloroplast, light reaction, calvin cycle",biology',
    'Newton\'s Laws,"newton, force, motion, inertia, f=ma",physics',
    'Quadratic Equations,"quadratic, parabola, discriminant, roots",mathematics',
    'World War II,"ww2, world war 2, allied powers, axis powers",history'
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="taxonomy_template.csv"');
  res.send(csv);
});

// POST — bulk upload CSV file
router.post('/admin/taxonomy/bulk-upload', spreadsheetUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send a CSV file as the "file" field.' });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname.toLowerCase();

  if (!originalName.endsWith('.csv') && !originalName.endsWith('.txt')) {
    fs.unlink(filePath, () => {});
    return res.status(400).json({
      error: 'Only .csv files are accepted. Export your spreadsheet as CSV and try again.'
    });
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    let rows = csvParse(raw, {
      columns: true,          // first row = headers
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });

    // Clean up the temp file
    fs.unlink(filePath, () => {});

    if (!rows.length) {
      return res.status(400).json({ error: 'File is empty or has no data rows.' });
    }

    // Normalise column names (case-insensitive, trim whitespace)
    rows = rows.map(row => {
      const norm = {};
      for (const [k, v] of Object.entries(row)) {
        norm[k.toLowerCase().trim()] = typeof v === 'string' ? v.trim() : String(v);
      }
      return norm;
    });

    // Validate: must have a "topic" column
    if (!rows[0].hasOwnProperty('topic')) {
      return res.status(400).json({
        error: 'Missing "topic" column. The file must have a header row with at least: topic, keywords, subject',
        columns_found: Object.keys(rows[0])
      });
    }

    // Process each row
    const results = { added: [], skipped: [], errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is the header, data starts at row 2

      const topic = (row.topic || '').trim();
      if (!topic) {
        results.skipped.push({ row: rowNum, reason: 'Empty topic name' });
        continue;
      }

      // Parse keywords: comma-separated string → array
      let keywords = [];
      if (row.keywords) {
        keywords = row.keywords.split(',').map(k => k.trim()).filter(Boolean);
      }
      // Auto-generate keywords from topic words if none provided
      if (keywords.length === 0) {
        keywords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      }

      const subject = (row.subject || 'general').trim().toLowerCase();

      try {
        const key = manuallyAddTopic(topic, keywords, subject);
        results.added.push({ row: rowNum, topic, key, keywords_count: keywords.length });
      } catch (err) {
        results.errors.push({ row: rowNum, topic, error: err.message });
      }
    }

    res.json({
      success: true,
      total_rows: rows.length,
      added: results.added.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
      details: results
    });

  } catch (err) {
    // Clean up on error
    fs.unlink(filePath, () => {});
    res.status(500).json({ error: 'Failed to parse file: ' + err.message });
  }
});

// POST approve a pending topic
router.post('/admin/taxonomy/pending/:topic/approve', (req, res) => {
  const ok = approvePending(decodeURIComponent(req.params.topic));
  res.json({ success: ok });
});

// DELETE reject a pending topic
router.delete('/admin/taxonomy/pending/:topic', (req, res) => {
  const ok = rejectPending(decodeURIComponent(req.params.topic));
  res.json({ success: ok });
});

// DELETE remove a learned topic
router.delete('/admin/taxonomy/learned/:topic', (req, res) => {
  const ok = removeLearned(decodeURIComponent(req.params.topic));
  res.json({ success: ok });
});

// POST force rebuild live taxonomy (useful after manual file edits)
router.post('/admin/taxonomy/rebuild', (req, res) => {
  rebuildLiveTaxonomy();
  res.json({ success: true, message: 'Live taxonomy rebuilt' });
});

// Serve admin UI
router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'taxonomy-admin.html'));
});

module.exports = router;
