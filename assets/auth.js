(async function () {
  const slot = document.querySelector('.auth-slot');
  if (!slot) return;

  function renderSignIn() {
    slot.innerHTML = '';
    const signInLink = document.createElement('a');
    signInLink.href = '/login.html';
    signInLink.textContent = 'Sign in';
    slot.appendChild(signInLink);
  }

  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const user = await res.json();
      slot.innerHTML = '';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = user.name || user.email;
      const logoutLink = document.createElement('a');
      logoutLink.href = '/api/auth/logout';
      logoutLink.textContent = 'Sign out';
      slot.appendChild(nameSpan);
      slot.appendChild(document.createTextNode(' · '));
      slot.appendChild(logoutLink);
    } else {
      renderSignIn();
    }
  } catch (err) {
    renderSignIn();
  }
})();
