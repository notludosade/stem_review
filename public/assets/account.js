// Sign-in state for every page, loaded synchronously by pages/_document.tsx
// before any page script. Everything on STEM+ is open to guests; saving
// progress needs an account, so save points call canSave() at the moment
// of saving and show a sign-in note instead when it returns false.
(function () {
  if (window.STEMPlusAccount) return;
  var account = { me: undefined };
  account.ready = fetch('/api/me', { credentials: 'same-origin' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .catch(function () { return null; })
    .then(function (me) { account.me = me || null; return account.me; });
  account.signedIn = function () { return !!account.me; };
  account.canSave = account.signedIn;
  account.signInHref = function () {
    return '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
  };
  // One note per page, placed after the page's first nav-links row.
  account.noteIfGuest = function (text) {
    account.ready.then(function (me) {
      if (me || document.querySelector('[data-guest-note]')) return;
      var page = document.querySelector('.page');
      if (!page) return;
      var note = document.createElement('p');
      note.className = 'signin-prompt';
      note.setAttribute('data-guest-note', '');
      note.innerHTML = text + ' <a href="' + account.signInHref() + '">Sign in</a> to keep it.';
      var anchor = page.querySelector('.nav-links');
      if (anchor) anchor.insertAdjacentElement('afterend', note);
      else page.insertBefore(note, page.firstChild);
    });
  };
  window.STEMPlusAccount = account;
}());
