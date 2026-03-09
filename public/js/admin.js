/**
 * admin.js — Super Admin panel (groups + users management)
 * Accessible to superadmin only.
 */
requireRole('superadmin', 'group_admin');

const user   = currentUser();
let allUsers  = [];
let allGroups = [];
let activeTab = 'groups';

// =============================================
// Init
// =============================================
async function init() {
  setupTabs();
  setupModals();
  setupLogout();
  await Promise.all([loadGroups(), loadUsers()]);
}

// =============================================
// Tabs
// =============================================
function setupTabs() {
  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(`panel-${activeTab}`).classList.remove('hidden');
    });
  });
}

// =============================================
// Logout
// =============================================
function setupLogout() {
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('csa_token');
    localStorage.removeItem('csa_user');
    window.location.href = '/index.html';
  });
}

// =============================================
// GROUPS
// =============================================
async function loadGroups() {
  document.getElementById('groups-loading').style.display = 'flex';
  document.getElementById('groups-list').classList.add('hidden');
  document.getElementById('groups-empty').classList.add('hidden');

  try {
    allGroups = await api.get('/groups');
    renderGroups(allGroups);
  } catch (err) {
    console.error('Load groups error:', err);
  } finally {
    document.getElementById('groups-loading').style.display = 'none';
  }
}

function renderGroups(groups) {
  const list = document.getElementById('groups-list');
  document.getElementById('groups-count').textContent = groups.length;

  if (!groups.length) {
    document.getElementById('groups-empty').classList.remove('hidden');
    list.classList.add('hidden');
    return;
  }

  list.innerHTML = groups.map(g => `
    <div class="admin-card" onclick="openEditGroup(${g.id})">
      <div class="avatar avatar-md" style="background:#3F51B5">
        ${g.name[0].toUpperCase()}
      </div>
      <div class="admin-card-body">
        <div class="admin-card-title">${escHtml(g.name)}</div>
        <div class="admin-card-sub">
          ${g.member_count || 0} member${g.member_count !== 1 ? 's' : ''}
          ${g.description ? ' · ' + escHtml(g.description) : ''}
        </div>
      </div>
      <span class="badge badge-group">${g.member_count || 0}</span>
    </div>
  `).join('');

  list.classList.remove('hidden');
}

// Add group button
document.getElementById('add-group-btn').addEventListener('click', () => openNewGroup());

function openNewGroup() {
  document.getElementById('group-modal-title').textContent = 'New Group';
  document.getElementById('group-name').value = '';
  document.getElementById('group-desc').value = '';
  document.getElementById('group-edit-id').value = '';
  document.getElementById('group-delete-btn').classList.add('hidden');
  hideAlert('group-form-error');
  document.getElementById('group-modal-overlay').classList.remove('hidden');
}

function openEditGroup(id) {
  const g = allGroups.find(x => x.id === id);
  if (!g) return;
  document.getElementById('group-modal-title').textContent = 'Edit Group';
  document.getElementById('group-name').value  = g.name;
  document.getElementById('group-desc').value  = g.description || '';
  document.getElementById('group-edit-id').value = g.id;
  document.getElementById('group-delete-btn').classList.remove('hidden');
  hideAlert('group-form-error');
  document.getElementById('group-modal-overlay').classList.remove('hidden');
}

async function saveGroup() {
  const name = document.getElementById('group-name').value.trim();
  const desc = document.getElementById('group-desc').value.trim();
  const id   = document.getElementById('group-edit-id').value;

  hideAlert('group-form-error');

  if (!name) {
    showAlert('group-form-error', 'Group name is required.');
    return;
  }

  const btn = document.getElementById('group-save-btn');
  btn.disabled = true;

  try {
    if (id) {
      await api.put(`/groups/${id}`, { name, description: desc || null });
    } else {
      await api.post('/groups', { name, description: desc || null });
    }
    closeGroupModal();
    await loadGroups();
  } catch (err) {
    showAlert('group-form-error', err.error || 'Failed to save group.');
  } finally {
    btn.disabled = false;
  }
}

async function deleteGroup() {
  const id = document.getElementById('group-edit-id').value;
  if (!id) return;
  if (!confirm('Delete this group? Users will be unassigned but not deleted.')) return;

  try {
    await api.delete(`/groups/${id}`);
    closeGroupModal();
    await loadGroups();
    await loadUsers(); // refresh since group assignments changed
  } catch (err) {
    showAlert('group-form-error', err.error || 'Failed to delete group.');
  }
}

function closeGroupModal() {
  document.getElementById('group-modal-overlay').classList.add('hidden');
}

// =============================================
// USERS
// =============================================
async function loadUsers() {
  document.getElementById('users-list').innerHTML = '';
  document.getElementById('users-loading').classList.remove('hidden');
  document.getElementById('users-empty').classList.add('hidden');

  try {
    allUsers = await api.get('/users');
    renderUsers(allUsers);
  } catch (err) {
    console.error('Load users error:', err);
  } finally {
    document.getElementById('users-loading').classList.add('hidden');
  }
}

function renderUsers(users) {
  const list = document.getElementById('users-list');
  document.getElementById('users-count').textContent = users.length;

  if (!users.length) {
    document.getElementById('users-empty').classList.remove('hidden');
    return;
  }

  list.innerHTML = users.map(u => {
    const initials = `${u.first_name[0]}${u.last_name[0]}`.toUpperCase();
    const bgColor  = u.is_active ? roleColor(u.role) : '#9E9E9E';
    return `
      <div class="admin-card" onclick="openEditUser(${u.id})">
        <div class="avatar avatar-md" style="background:${bgColor}">${initials}</div>
        <div class="admin-card-body">
          <div class="admin-card-title">${escHtml(u.first_name)} ${escHtml(u.last_name)}</div>
          <div class="admin-card-sub">
            ${escHtml(u.email)}
            ${u.group_name ? ' · ' + escHtml(u.group_name) : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
          <span class="badge badge-${u.role}">${roleName(u.role)}</span>
          ${!u.is_active ? '<span class="badge badge-inactive">Inactive</span>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Filter / search
const searchInput  = document.getElementById('user-search');
const roleFilter   = document.getElementById('role-filter');

function filterUsers() {
  const q    = searchInput.value.toLowerCase();
  const role = roleFilter.value;
  const filtered = allUsers.filter(u => {
    const matchSearch = !q ||
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q);
    const matchRole = !role || u.role === role;
    return matchSearch && matchRole;
  });
  renderUsers(filtered);
}

searchInput.addEventListener('input', filterUsers);
roleFilter.addEventListener('change', filterUsers);

// Add user button
document.getElementById('add-user-btn').addEventListener('click', () => openNewUser());

function openNewUser() {
  document.getElementById('user-modal-title').textContent = 'New User';
  document.getElementById('user-first').value    = '';
  document.getElementById('user-last').value     = '';
  document.getElementById('user-email').value    = '';
  document.getElementById('user-password').value = '';
  document.getElementById('user-role').value     = 'user';
  document.getElementById('user-group').value    = '';
  document.getElementById('user-active').checked = true;
  document.getElementById('user-edit-id').value  = '';
  document.getElementById('user-password-field').classList.remove('hidden');
  document.getElementById('user-active-field').classList.add('hidden');
  document.getElementById('user-deactivate-btn').classList.add('hidden');
  document.getElementById('user-email').disabled = false;
  hideAlert('user-form-error');
  populateGroupSelector();
  document.getElementById('user-modal-overlay').classList.remove('hidden');
}

function openEditUser(id) {
  const u = allUsers.find(x => x.id === id);
  if (!u) return;
  document.getElementById('user-modal-title').textContent = 'Edit User';
  document.getElementById('user-first').value    = u.first_name;
  document.getElementById('user-last').value     = u.last_name;
  document.getElementById('user-email').value    = u.email;
  document.getElementById('user-password').value = '';
  document.getElementById('user-role').value     = u.role;
  document.getElementById('user-active').checked = u.is_active;
  document.getElementById('user-edit-id').value  = u.id;
  document.getElementById('user-password-field').classList.add('hidden');
  document.getElementById('user-active-field').classList.remove('hidden');
  document.getElementById('user-email').disabled = true;
  document.getElementById('user-deactivate-btn').classList.toggle('hidden', !u.is_active);
  hideAlert('user-form-error');
  populateGroupSelector(u.group_id);
  document.getElementById('user-modal-overlay').classList.remove('hidden');
}

function populateGroupSelector(selectedId = null) {
  const sel = document.getElementById('user-group');
  sel.innerHTML = '<option value="">— No Group —</option>';
  allGroups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    if (selectedId && g.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

async function saveUser() {
  const id       = document.getElementById('user-edit-id').value;
  const first    = document.getElementById('user-first').value.trim();
  const last     = document.getElementById('user-last').value.trim();
  const email    = document.getElementById('user-email').value.trim();
  const password = document.getElementById('user-password').value;
  const role     = document.getElementById('user-role').value;
  const groupId  = document.getElementById('user-group').value || null;
  const isActive = document.getElementById('user-active').checked;

  hideAlert('user-form-error');

  if (!first || !last) { showAlert('user-form-error', 'First and last name required.'); return; }
  if (!id && (!email || !password)) { showAlert('user-form-error', 'Email and password required.'); return; }
  if (!id && password.length < 8) { showAlert('user-form-error', 'Password must be at least 8 characters.'); return; }

  const btn = document.getElementById('user-save-btn');
  btn.disabled = true;

  try {
    if (id) {
      // Edit: only send fields that can change
      await api.put(`/users/${id}`, {
        first_name: first,
        last_name: last,
        role,
        group_id: groupId ? parseInt(groupId) : null,
        is_active: isActive
      });
    } else {
      await api.post('/users', {
        email,
        password,
        first_name: first,
        last_name: last,
        role,
        group_id: groupId ? parseInt(groupId) : null
      });
    }
    closeUserModal();
    await loadUsers();
  } catch (err) {
    showAlert('user-form-error', err.error || 'Failed to save user.');
  } finally {
    btn.disabled = false;
  }
}

async function deactivateUser() {
  const id = document.getElementById('user-edit-id').value;
  if (!id) return;
  if (!confirm('Deactivate this user? They will no longer be able to log in.')) return;

  try {
    await api.delete(`/users/${id}`);
    closeUserModal();
    await loadUsers();
  } catch (err) {
    showAlert('user-form-error', err.error || 'Failed to deactivate user.');
  }
}

function closeUserModal() {
  document.getElementById('user-modal-overlay').classList.add('hidden');
}

// =============================================
// Modal wiring
// =============================================
function setupModals() {
  // Group modal
  document.getElementById('group-save-btn').addEventListener('click', saveGroup);
  document.getElementById('group-cancel-btn').addEventListener('click', closeGroupModal);
  document.getElementById('group-delete-btn').addEventListener('click', deleteGroup);
  document.getElementById('group-modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('group-modal-overlay')) closeGroupModal();
  });

  // User modal
  document.getElementById('user-save-btn').addEventListener('click', saveUser);
  document.getElementById('user-cancel-btn').addEventListener('click', closeUserModal);
  document.getElementById('user-deactivate-btn').addEventListener('click', deactivateUser);
  document.getElementById('user-modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('user-modal-overlay')) closeUserModal();
  });
}

// =============================================
// Helpers
// =============================================
function roleName(role) {
  return { superadmin: 'Super Admin', group_admin: 'Group Admin', user: 'Member' }[role] || role;
}

function roleColor(role) {
  return { superadmin: '#512DA8', group_admin: '#1565C0', user: '#3F51B5' }[role] || '#9E9E9E';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================
// Start
// =============================================
init();
