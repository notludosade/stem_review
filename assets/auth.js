(async function () {
  const slot = document.querySelector('.auth-slot');
  if (!slot) return;

  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const user = await res.json();
      slot.innerHTML = '';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = user.name;
      const logoutLink = document.createElement('a');
      logoutLink.href = '/api/auth/logout';
      logoutLink.textContent = 'Sign out';
      slot.appendChild(nameSpan);
      slot.appendChild(document.createTextNode(' · '));
      slot.appendChild(logoutLink);
    } else {
      slot.innerHTML = '<a href="/api/auth/google">Sign in with Google</a>';
    }
  } catch (err) {
    slot.innerHTML = '<a href="/api/auth/google">Sign in with Google</a>';
  }
})();
