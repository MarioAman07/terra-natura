function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className   = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

async function loadSamples() {
  const tbody = document.getElementById('samples-body');
  if (!tbody) return;

  const type   = document.getElementById('filter-type').value;
  const status = document.getElementById('filter-status').value;
  const from   = document.getElementById('filter-from').value;
  const to     = document.getElementById('filter-to').value;

  const params = new URLSearchParams();
  if (type)   params.append('type',   type);
  if (status) params.append('status', status);
  if (from)   params.append('from',   from);
  if (to)     params.append('to',     to);

  try {
    const res  = await fetch('/api/samples?' + params.toString());
    const data = await res.json();

    document.getElementById('count-label').textContent =
      data.length === 0 ? 'No samples found' : `${data.length} sample(s)`;

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="8">
          <div class="empty-state">
            <div class="icon">🔬</div>
            <p>No samples match your filters.<br>Try adjusting the filters or <a href="form.html">add a new sample</a>.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(s => `
      <tr>
        <td data-label="#">${s.id}</td>
        <td data-label="Date & Time">${formatDate(s.datetime)}</td>
        <td data-label="Location">${escHtml(s.location)}</td>
        <td data-label="Type"><span class="badge badge-${s.type}">${typeName(s.type)}</span></td>
        <td data-label="Employee">${escHtml(s.employee)}</td>
        <td data-label="Results">${escHtml(s.results || '—')}</td>
        <td data-label="Status"><span class="badge badge-${s.status}">${s.status}</span></td>
        <td data-label="Actions" class="td-actions">
          <a href="form.html?id=${s.id}" class="btn btn-edit">Edit</a>
          <button class="btn btn-delete" onclick="deleteSample(${s.id})">Delete</button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    showToast('Failed to load samples.', true);
    console.error(err);
  }
}

function resetFilters() {
  document.getElementById('filter-type').value   = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-from').value   = '';
  document.getElementById('filter-to').value     = '';
  loadSamples();
}

async function deleteSample(id) {
  if (!confirm('Are you sure you want to delete this sample?')) return;

  try {
    const res = await fetch('/api/samples/' + id, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) { showToast(data.error, true); return; }
    showToast('Sample deleted.');
    loadSamples(); // refresh table
  } catch (err) {
    showToast('Error deleting sample.', true);
  }
}

async function initForm() {
  const title = document.getElementById('form-title');
  if (!title) return; 

  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  if (id) {
    title.textContent = '✏ Edit Sample #' + id;
    try {
      const res  = await fetch('/api/samples/' + id);
      const data = await res.json();
      if (!res.ok) { showToast('Sample not found.', true); return; }

      document.getElementById('datetime').value = data.datetime;
      document.getElementById('location').value = data.location;
      document.getElementById('type').value     = data.type;
      document.getElementById('employee').value = data.employee;
      document.getElementById('results').value  = data.results || '';
      document.getElementById('status').value   = data.status;
    } catch (err) {
      showToast('Error loading sample.', true);
    }
  } else {
    const now = new Date();
    // Format for datetime-local: "YYYY-MM-DDTHH:MM"
    document.getElementById('datetime').value =
      now.toISOString().slice(0, 16);
  }
}

async function saveSample() {
  const body = {
    datetime: document.getElementById('datetime').value,
    location: document.getElementById('location').value.trim(),
    type:     document.getElementById('type').value,
    employee: document.getElementById('employee').value.trim(),
    results:  document.getElementById('results').value.trim(),
    status:   document.getElementById('status').value,
  };

  if (!body.datetime || !body.location || !body.type || !body.employee) {
    showToast('Please fill in all required fields.', true);
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const id        = urlParams.get('id');
  const url       = id ? '/api/samples/' + id : '/api/samples';
  const method    = id ? 'PUT' : 'POST';

  try {
    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) { showToast(data.error || 'Error saving.', true); return; }

    showToast(id ? 'Sample updated!' : 'Sample added!');
    setTimeout(() => { window.location.href = '/'; }, 1200);

  } catch (err) {
    showToast('Network error. Please try again.', true);
  }
}

function escHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(text)));
  return div.innerHTML;
}

function formatDate(str) {
  if (!str) return '—';
  const [datePart, timePart] = str.split('T');
  if (!datePart) return str;
  const [y, m, d] = datePart.split('-');
  return `${d}.${m}.${y} ${timePart ? timePart.slice(0,5) : ''}`;
}

function typeName(t) {
  return { water: ' Water', soil: ' Soil', air: 'Air' }[t] || t;
}

loadSamples();
initForm();