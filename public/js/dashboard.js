/**
 * dashboard.js — Personal dashboard and group overview
 */
requireAuth();

const user = currentUser();
let radarChart  = null;
let trendChart  = null;
let historyData = [];   // populated by loadDashboard, used for trend click-through
let detailAssessmentId = null;

// =============================================
// Init
// =============================================
async function init() {
  setupNav();
  populateDrawer();
  setupDetailModal();
  await loadDashboard();
  await loadHistory();
  if (user.role === 'group_admin' || user.role === 'superadmin') {
    await loadGroupPanel();
  }
}

// =============================================
// Navigation / drawer
// =============================================
function setupNav() {
  document.getElementById('menu-btn').addEventListener('click', openDrawer);
  document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);

  document.getElementById('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });

  document.getElementById('change-password-link').addEventListener('click', (e) => {
    e.preventDefault();
    closeDrawer();
    openPasswordModal();
  });

  // Show admin link for appropriate roles
  if (user.role === 'superadmin' || user.role === 'group_admin') {
    document.getElementById('nav-admin').classList.remove('hidden');
    document.getElementById('bottom-admin').classList.remove('hidden');
  }

  // Password modal
  document.getElementById('pw-cancel-btn').addEventListener('click', closePasswordModal);
  document.getElementById('pw-modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('pw-modal-overlay')) closePasswordModal();
  });
  document.getElementById('pw-save-btn').addEventListener('click', doChangePassword);

  // Profile button
  document.getElementById('profile-btn').addEventListener('click', openDrawer);
}

function openDrawer() {
  document.getElementById('nav-drawer').classList.add('open');
  document.getElementById('nav-drawer').setAttribute('aria-hidden', 'false');
  document.getElementById('drawer-overlay').classList.remove('hidden');
}

function closeDrawer() {
  document.getElementById('nav-drawer').classList.remove('open');
  document.getElementById('nav-drawer').setAttribute('aria-hidden', 'true');
  document.getElementById('drawer-overlay').classList.add('hidden');
}

function populateDrawer() {
  const name = `${user.first_name} ${user.last_name}`;
  const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();

  document.getElementById('drawer-user-name').textContent  = name;
  document.getElementById('drawer-user-email').textContent = user.email;
  document.getElementById('drawer-role').textContent       = roleName(user.role);
  document.getElementById('drawer-avatar').textContent     = initials;
  document.getElementById('user-avatar').textContent       = initials;
}

function roleName(role) {
  return { superadmin: 'Super Admin', group_admin: 'Group Admin', user: 'Member' }[role] || role;
}

function logout() {
  localStorage.removeItem('csa_token');
  localStorage.removeItem('csa_user');
  window.location.href = '/index.html';
}

// =============================================
// Dashboard data
// =============================================
async function loadDashboard() {
  try {
    const data = await api.get('/assessments/dashboard');
    historyData = data.history || [];
    renderSummary(data);
    renderGiftScores(data.latest_scores);
    renderRadarChart(data.latest_scores);
    renderTrendChart(data.history);
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function renderSummary(data) {
  const name = user.first_name;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  document.getElementById('summary-greeting').textContent = `${greeting}, ${name}`;
  document.getElementById('total-assessments').textContent = data.total_assessments;

  if (data.latest) {
    const d = formatDate(data.latest.created_at);
    document.getElementById('last-assessment-date').textContent = d;
  }

  if (data.latest_scores && data.latest_scores.length) {
    const avg = data.latest_scores.reduce((s, r) => s + r.score, 0) / data.latest_scores.length;
    const rounded = avg.toFixed(1);
    document.getElementById('current-score').textContent = rounded;
    const ring = document.getElementById('score-ring');
    ring.style.borderColor = scoreColor(Math.round(avg));
    document.getElementById('summary-subtitle').textContent = `Overall: ${scoreZone(avg)}`;
  }
}

function renderGiftScores(scores) {
  const container = document.getElementById('gift-scores-list');
  if (!scores || !scores.length) return;

  const sorted = [...scores].sort((a, b) => b.score - a.score);

  container.innerHTML = sorted.map(s => `
    <div class="gift-score-row">
      <div class="gift-score-name">${s.short_name}</div>
      <div class="gift-score-bar-track">
        <div class="gift-score-bar-fill"
             style="width:${s.score * 10}%; background:${scoreColor(s.score)}">
        </div>
      </div>
      <div class="gift-score-value" style="color:${scoreColor(s.score)}">${s.score}</div>
    </div>
  `).join('');
}

function renderRadarChart(scores) {
  const canvas = document.getElementById('radar-chart');

  if (!scores || !scores.length) {
    document.getElementById('radar-card').querySelector('.chart-container').classList.add('hidden');
    document.getElementById('radar-no-data').classList.remove('hidden');
    document.getElementById('radar-date').textContent = '';
    return;
  }

  const labels = scores.map(s => s.short_name);
  const values = scores.map(s => s.score);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const avgColor = scoreColor(avg);
  const fillColor = hexToRgba(avgColor, 0.2);

  if (radarChart) radarChart.destroy();

  radarChart = new Chart(canvas, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Spiritual State',
        data: values,
        backgroundColor: fillColor,
        borderColor: avgColor,
        borderWidth: 2,
        pointBackgroundColor: values.map(v => scoreColor(v)),
        pointBorderColor: '#fff',
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2, font: { size: 10 }, color: '#9E9E9E' },
          grid: { color: 'rgba(0,0,0,0.06)' },
          pointLabels: { font: { size: 11, weight: '500' }, color: '#616161' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Score: ${ctx.raw} — ${scoreZone(ctx.raw)}`
          }
        }
      }
    }
  });
}

function renderTrendChart(history) {
  const canvas = document.getElementById('trend-chart');

  if (!history || history.length < 2) {
    document.getElementById('trend-card').querySelector('.chart-container').classList.add('hidden');
    document.getElementById('trend-no-data').classList.remove('hidden');
    return;
  }

  const labels = history.map(h => formatDate(h.created_at));
  const values = history.map(h => parseFloat(h.avg_score));

  if (trendChart) trendChart.destroy();

  trendChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Avg Score',
        data: values,
        borderColor: '#3F51B5',
        backgroundColor: 'rgba(63,81,181,0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: values.map(v => scoreColor(v)),
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2, font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.04)' }
        },
        x: {
          ticks: { font: { size: 10 }, maxRotation: 30 },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Avg: ${ctx.raw} — ${scoreZone(ctx.raw)}`
          }
        }      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const item = historyData[idx];
          if (item) openAssessmentDetail(item.id);
        }
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      }
    }
  });
}

// =============================================
// Group panel
// =============================================
async function loadGroupPanel() {
  const panel = document.getElementById('group-panel');
  panel.classList.remove('hidden');

  try {
    const members = await api.get('/assessments/group-dashboard');
    renderGroupMembers(members);
  } catch (err) {
    panel.innerHTML = '<p class="text-muted">Could not load group data.</p>';
  }
}

function renderGroupMembers(members) {
  if (!members.length) {
    document.getElementById('group-members-list').innerHTML =
      '<p class="text-muted">No group members found.</p>';
    return;
  }

  document.getElementById('group-members-list').innerHTML = members.map(m => {
    const score = m.avg_score ? parseFloat(m.avg_score).toFixed(1) : '—';
    const initials = `${m.first_name[0]}${m.last_name[0]}`.toUpperCase();
    const bg = m.avg_score ? scoreColor(Math.round(m.avg_score)) : '#9E9E9E';
    return `
      <div class="member-row">
        <div class="avatar avatar-md" style="background:${bg}">${initials}</div>
        <div class="member-info">
          <div class="member-name">${m.first_name} ${m.last_name}</div>
          <div class="member-email">${m.assessment_count} assessment${m.assessment_count !== 1 ? 's' : ''}
            · Last: ${formatDate(m.last_assessment)}</div>
        </div>
        <div class="member-score" style="background:${bg}">${score}</div>
      </div>
    `;
  }).join('');
}

// =============================================
// Change Password Modal
// =============================================
function openPasswordModal() {
  document.getElementById('cur-pw').value  = '';
  document.getElementById('new-pw').value  = '';
  document.getElementById('conf-pw').value = '';
  hideAlert('pw-error');
  hideAlert('pw-success');
  document.getElementById('pw-modal-overlay').classList.remove('hidden');
}

function closePasswordModal() {
  document.getElementById('pw-modal-overlay').classList.add('hidden');
}

async function doChangePassword() {
  const cur  = document.getElementById('cur-pw').value;
  const nw   = document.getElementById('new-pw').value;
  const conf = document.getElementById('conf-pw').value;
  const btn  = document.getElementById('pw-save-btn');

  hideAlert('pw-error');
  hideAlert('pw-success');

  if (!cur || !nw || !conf) {
    showAlert('pw-error', 'All fields are required.');
    return;
  }
  if (nw.length < 8) {
    showAlert('pw-error', 'New password must be at least 8 characters.');
    return;
  }
  if (nw !== conf) {
    showAlert('pw-error', 'New passwords do not match.');
    return;
  }

  btn.disabled = true;
  try {
    await api.post('/auth/change-password', {
      current_password: cur,
      new_password: nw
    });
    showAlert('pw-success', 'Password changed successfully!', 'success');
    document.getElementById('cur-pw').value  = '';
    document.getElementById('new-pw').value  = '';
    document.getElementById('conf-pw').value = '';
    setTimeout(closePasswordModal, 2000);
  } catch (err) {
    showAlert('pw-error', err.error || 'Failed to change password.');
  } finally {
    btn.disabled = false;
  }
}

// =============================================
// Assessment History List
// =============================================
async function loadHistory() {
  const listEl = document.getElementById('assessment-history-list');
  try {
    const assessments = await api.get('/assessments?limit=20');
    if (!assessments || !assessments.length) {
      listEl.innerHTML = '<p class="text-muted text-center">No assessments yet.</p>';
      return;
    }
    listEl.innerHTML = assessments.map(a => {
      const avg = a.avg_score ? parseFloat(a.avg_score) : null;
      const color = avg ? scoreColor(Math.round(avg)) : '#9E9E9E';
      const zone  = avg ? scoreZone(avg) : '—';
      const hasNotes = a.notes ? ' <span class="history-note-dot" title="Has notes">&#9679;</span>' : '';
      return `
        <div class="history-row" data-assessment-id="${a.id}">
          <div class="history-date-col">
            <div class="history-date">${formatDate(a.created_at)}</div>
            <div class="history-zone" style="color:${color}">${zone}${hasNotes}</div>
          </div>
          <div class="history-bar-col">
            <div class="gift-score-bar-track">
              <div class="gift-score-bar-fill" style="width:${avg ? avg * 10 : 0}%;background:${color}"></div>
            </div>
          </div>
          <div class="history-avg" style="color:${color}">${avg ? avg.toFixed(1) : '—'}</div>
          <span class="material-icons history-chevron">chevron_right</span>
        </div>
      `;
    }).join('');

    // Event delegation — one listener on the container, no inline handlers
    listEl.addEventListener('click', (e) => {
      const row = e.target.closest('.history-row[data-assessment-id]');
      if (row) openAssessmentDetail(parseInt(row.dataset.assessmentId));
    });
  } catch (err) {
    listEl.innerHTML = '<p class="text-muted text-center">Could not load history.</p>';
  }
}

// =============================================
// Assessment Detail Modal
// =============================================
function setupDetailModal() {
  document.getElementById('detail-close-btn').addEventListener('click', closeDetailModal);
  document.getElementById('detail-save-btn').addEventListener('click', saveDetailNotes);
  document.getElementById('detail-modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('detail-modal-overlay')) closeDetailModal();
  });
}

function closeDetailModal() {
  document.getElementById('detail-modal-overlay').classList.add('hidden');
  detailAssessmentId = null;
}

async function openAssessmentDetail(id) {
  detailAssessmentId = id;
  const bodyEl = document.getElementById('detail-modal-body');
  bodyEl.innerHTML = '<div class="loading-center" style="padding:24px"><div class="spinner"></div></div>';
  document.getElementById('detail-save-status').classList.add('hidden');
  document.getElementById('detail-modal-overlay').classList.remove('hidden');

  try {
    const data = await api.get(`/assessments/${id}`);
    const avg = data.responses && data.responses.length
      ? data.responses.reduce((s, r) => s + r.score, 0) / data.responses.length
      : null;
    const color = avg ? scoreColor(Math.round(avg)) : '#9E9E9E';

    document.getElementById('detail-modal-title').textContent = formatDate(data.created_at);

    bodyEl.innerHTML = `
      <div class="detail-header-row">
        <div class="detail-avg-wrap">
          <div class="detail-avg-badge" style="background:${color}">${avg ? avg.toFixed(1) : '—'}</div>
          <div class="detail-avg-zone" style="color:${color}">${avg ? scoreZone(avg) : ''}</div>
        </div>
      </div>

      <div class="form-field">
        <label class="form-label">
          <span class="material-icons" style="font-size:15px;vertical-align:middle;margin-right:3px;">notes</span>
          Overall Notes
        </label>
        <textarea id="detail-overall-notes" class="form-input form-textarea" rows="2"
                  maxlength="1000" placeholder="Overall thoughts for this assessment…">${escHtml(data.notes || '')}</textarea>
      </div>

      <div class="detail-section-label">Gift Journal</div>

      ${(data.responses || []).map(r => `
        <div class="detail-response-row">
          <div class="detail-response-header">
            <span class="detail-response-name">${escHtml(r.name)}</span>
            <div class="detail-score-badge" style="background:${scoreColor(r.score)}">${r.score}</div>
          </div>
          <div class="gift-score-bar-track" style="margin:4px 0 6px;">
            <div class="gift-score-bar-fill" style="width:${r.score * 10}%;background:${scoreColor(r.score)}"></div>
          </div>
          <div style="font-size:.78rem;color:${scoreColor(r.score)};margin-bottom:6px;">${scoreZone(r.score)}</div>
          <textarea class="form-input form-textarea detail-note-ta"
                    id="detail-note-${r.gift_category_id}"
                    rows="2" maxlength="500"
                    placeholder="Journal note for ${escHtml(r.name)}…">${escHtml(r.note || '')}</textarea>
        </div>
      `).join('')}
    `;
  } catch (err) {
    bodyEl.innerHTML = '<p class="text-muted text-center">Could not load assessment.</p>';
  }
}

async function saveDetailNotes() {
  const id  = detailAssessmentId;
  if (!id) return;

  const notes = (document.getElementById('detail-overall-notes')?.value || '').trim() || null;
  const responseNotes = Array.from(document.querySelectorAll('.detail-note-ta')).map(el => ({
    gift_category_id: parseInt(el.id.replace('detail-note-', '')),
    note: el.value.trim() || null
  }));

  const btn    = document.getElementById('detail-save-btn');
  const status = document.getElementById('detail-save-status');
  btn.disabled = true;

  try {
    await api.patch(`/assessments/${id}/notes`, { notes, response_notes: responseNotes });
    status.textContent = '✓ Saved';
    status.className   = 'detail-save-status detail-save-ok';
    status.classList.remove('hidden');
    setTimeout(() => status.classList.add('hidden'), 2500);
    // Refresh history list so note-dot updates
    await loadHistory();
  } catch (err) {
    status.textContent = 'Save failed';
    status.className   = 'detail-save-status detail-save-err';
    status.classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================
// Start
// =============================================
init();
