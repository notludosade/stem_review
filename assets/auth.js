(async function () {
  const slot = document.querySelector('.auth-slot');
  if (!slot) return;

  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const user = await res.json();
      slot.innerHTML = `<span>${user.name}</span> · <a href="/api/auth/logout">Sign out</a>`;
    } else {
      slot.innerHTML = '<a href="/api/auth/google">Sign in with Google</a>';
    }
  } catch (err) {
    slot.innerHTML = '<a href="/api/auth/google">Sign in with Google</a>';
  }
})();
