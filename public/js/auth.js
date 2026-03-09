/**
 * auth.js — Login page logic
 */

// Already logged in? Go straight to dashboard
if (localStorage.getItem('csa_token')) {
  window.location.href = '/dashboard.html';
}

// ---- Login form submit ----
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn      = document.getElementById('login-btn');
  const errorDiv = document.getElementById('login-error');

  errorDiv.classList.add('hidden');
  btn.disabled    = true;
  btn.textContent = 'Signing in…';

  try {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('csa_token', data.token);
    localStorage.setItem('csa_user',  JSON.stringify(data.user));

    // Route superadmin to admin panel, others to dashboard
    if (data.user.role === 'superadmin') {
      window.location.href = '/admin.html';
    } else {
      window.location.href = '/dashboard.html';
    }
  } catch (err) {
    showAlert('login-error', err.error || 'Login failed. Please try again.');
    btn.disabled    = false;
    btn.textContent = 'Sign In';
  }
});

// ---- Toggle password visibility ----
document.getElementById('toggle-password').addEventListener('click', () => {
  const input = document.getElementById('password');
  const icon  = document.getElementById('toggle-icon');
  if (input.type === 'password') {
    input.type   = 'text';
    icon.textContent = 'visibility_off';
  } else {
    input.type   = 'password';
    icon.textContent = 'visibility';
  }
});
