// Local killswitch: replaces partner's api2 ks.js.
// Bot/DevTools-spoof detection only — no remote kill, no whitepage redirect dependency.
(function() {
  var SITE_KEY = "local_bonustiktok";
  var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  var isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  var isSpoof = !isTouch && isMobileUA; // mobile UA on desktop without touch = inspecting cloaked page
  window.__ks_site_key = SITE_KEY;
  window.__ks_spoof = isSpoof;
  if (isSpoof) {
    // silent: do not block navigation, just flag (page JS may decide)
    console.warn('[ks] environment mismatch');
  }
})();
