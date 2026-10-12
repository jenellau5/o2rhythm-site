/* Anonymous counting for o2rhythm.com: one count per page visit, and one when someone taps into the app.
   No cookies, nothing stored, nothing about who you are. Only totals per page. */
(function () {
  if (location.hostname !== 'o2rhythm.com') return;
  var url = 'https://app.o2rhythm.com/api/track';
  var path = location.pathname.replace(/index\.html$/, '');
  if (path.charAt(path.length - 1) !== '/') path += '/';

  function count(type) {
    var body = JSON.stringify({ type: type, path: path });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, body)) return;
      fetch(url, { method: 'POST', body: body, keepalive: true, mode: 'no-cors' });
    } catch (e) {}
  }

  count('page');
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href^="https://app.o2rhythm.com"]');
    if (link) count('toapp');
  });
})();
