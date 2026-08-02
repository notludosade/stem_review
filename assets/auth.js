(async function () {
  const slot = document.querySelector('.auth-slot');
  if (!slot) return;

  function renderSignIn() {
    slot.innerHTML = '';
    if (new URLSearchParams(location.search).has('auth_error')) {
      const errorSpan = document.createElement('span');
      errorSpan.textContent = 'Sign-in failed — try again. ';
      slot.appendChild(errorSpan);
    }
    const signInLink = document.createElement('a');
    signInLink.href = '/api/auth/google';
    signInLink.textContent = 'Sign in with Google';
    slot.appendChild(signInLink);
  }

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
      renderSignIn();
    }
  } catch (err) {
    renderSignIn();
  }
})();
