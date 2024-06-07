////////////////////////////////////////////////
////////////////////////////////////////////////
//	WAKE LOCK
////////////////////////////////////////////////
////////////////////////////////////////////////

var noSleep; 
if (NoSleep) { noSleep = new NoSleep(); }
var wakeLockEnabled = false;

/**
 * ENABLES / REQUESTS WAKE LOCK TO KEEP DEVICE AWAKE (I.E. DURING UPLOADS)
 */
function enableWakeLock() {

    if (wakeLockEnabled) { return false; }
    if (!noSleep) { return false; }

    try {
        // WORKAROUND FOR IOS PWA WAKELOCK API BUG.
        // FOR NOW WE'LL ONLY HAVE WAKELOCK IN PHOTOS, OR DOCS PLAYING VIDEO TAKES OVER SPOTIFY ETC
        if (document.visibilityState === 'visible' && location.pathname !== "/docs") {
            noSleep.enable();
            wakeLockEnabled = true;
            breadcrumb('[WAKE LOCK] Requested');
            return true;
        } else {
            breadcrumb('[WAKE LOCK] Will not request, app not visible.');
            return false;
        }
    } catch (error) {
        breadcrumb('[WAKE LOCK] Failed / Rejected');
        return false;
    }

}

/**
 * RELEASES WAKE LOCK TO LET DEVICE SLEEP
 */
function disableWakeLock() {
    
    if (!wakeLockEnabled) { return false; }
    if (!noSleep) { return false; }

    try {
        noSleep.disable();
        wakeLockEnabled = false;
        breadcrumb('[WAKE LOCK] Released');
        return true;
    } catch (error) {
        breadcrumb('[WAKE LOCK] Failed to release / rejected');
        return false;
    }

}
