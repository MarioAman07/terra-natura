function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className   = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => { toast.className = 'toast'; }, 3000);
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
  return `${d}.${m}.${y} ${timePart ? timePart.slice(0, 5) : ''}`;
}

function typeName(t) {
  return { water: ' Water', soil: ' Soil', air: ' Air' }[t] || t;
}

async function doLogout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

async function loadCurrentUser() {
  const pill = document.getElementById('nav-username');
  if (!pill) return;
  try {
    const res  = await fetch('/api/me');
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    const data = await res.json();
    pill.textContent = data.username;
  } catch (_) {  }
}

async function loadStats() {
  const els = {
    total: document.getElementById('stat-total'),
    water: document.getElementById('stat-water'),
    soil:  document.getElementById('stat-soil'),
    air:   document.getElementById('stat-air'),
  };
  if (!els.total) return;

  try {
    const res  = await fetch('/api/stats');
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    const data = await res.json();

    els.total.textContent = data.total;
    els.water.textContent = data.water;
    els.soil.textContent  = data.soil;
    els.air.textContent   = data.air;
  } catch (_) {
    Object.values(els).forEach(el => { if (el) el.textContent = '?'; });
  }
}

function getFilterParams() {
  const type     = document.getElementById('filter-type')?.value     || '';
  const status   = document.getElementById('filter-status')?.value   || '';
  const from     = document.getElementById('filter-from')?.value     || '';
  const to       = document.getElementById('filter-to')?.value       || '';
  const location = document.getElementById('filter-location')?.value?.trim() || '';

  const params = new URLSearchParams();
  if (type)     params.append('type',     type);
  if (status)   params.append('status',   status);
  if (from)     params.append('from',     from);
  if (to)       params.append('to',       to);
  if (location) params.append('location', location);
  return params;
}

async function loadSamples() {
  const tbody = document.getElementById('samples-body');
  if (!tbody) return;

  try {
    const params = getFilterParams();
    const res    = await fetch('/api/samples?' + params.toString());
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    const data   = await res.json();

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
          <a href="sample.html?id=${s.id}" class="btn btn-edit" style="background:var(--green-pale)"> View</a>
          <a href="form.html?id=${s.id}"   class="btn btn-edit"> Edit</a>
          <button class="btn btn-delete"   onclick="openDeleteModal(${s.id}, '${escHtml(s.location)}')"> Delete</button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    showToast('Failed to load samples.', true);
    console.error(err);
  }
}

function resetFilters() {
  const ids = ['filter-type', 'filter-status', 'filter-from', 'filter-to', 'filter-location'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  loadSamples();
}

let _pendingDeleteId = null;

function openDeleteModal(id, locationName) {
  _pendingDeleteId = id;
  const msg = document.getElementById('modal-message');
  if (msg) msg.textContent = `Sample #${id} at "${locationName}" will be permanently removed.`;
  document.getElementById('delete-modal')?.classList.add('open');
}

function closeDeleteModal() {
  _pendingDeleteId = null;
  document.getElementById('delete-modal')?.classList.remove('open');
}

function closeModal(event) {
  if (event.target.id === 'delete-modal') closeDeleteModal();
}

async function confirmDelete() {
  if (!_pendingDeleteId) return;
  const id = _pendingDeleteId;
  closeDeleteModal();

  try {
    const res  = await fetch('/api/samples/' + id, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { showToast(data.error, true); return; }
    showToast('Sample deleted.');
    loadSamples();
    loadStats();
  } catch (err) {
    showToast('Error deleting sample.', true);
  }
}

function exportFiltered() {
  const params = getFilterParams();
  window.location.href = '/api/export?' + params.toString();
}

async function initForm() {
  const title = document.getElementById('form-title');
  if (!title) return;

  const me = await fetch('/api/me');
  if (me.status === 401) { window.location.href = '/login.html'; return; }

  const urlParams = new URLSearchParams(window.location.search);
  const id        = urlParams.get('id');

  if (id) {
    title.textContent = ' Edit Sample #' + id;
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
    document.getElementById('datetime').value = now.toISOString().slice(0, 16);
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

loadCurrentUser();
loadStats();
loadSamples();
initForm();