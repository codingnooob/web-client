////////////////////////////////////////////////
////////////////  SENTRY  SETUP  ////////////////
////////////////////////////////////////////////

var env;
if (!location.origin.includes("crypt.ee"))          { env = "unknown"; }
if (location.origin.includes("crypt.ee"))           { env = "prod";    }
if (location.origin.includes("beta"))               { env = "beta";    }
if (location.origin.includes("alfa"))               { env = "alfa";    }
if (location.origin.includes("localhost"))          { env = "local";   }

try {
    var sentryConfig = {
        dsn: "https://bbfa9a3a54234070bc0899a821e613b8@o69744.ingest.sentry.io/149319",
        tunnel : "/api/errors",
        tracesSampleRate: 1.0,
        maxBreadcrumbs: 500,
        environment: "v3-" + env,
        ignoreErrors: [
            'KaTeX parse error', '[Parchment]',
            "'setEnd' on 'Range'", "'setStart' on 'Range'", "MetaMask",
            "lastpass", "u.position is not a function",
            "this.emitter is undefined", "can't access dead object",
            "Cannot read property 'mutations' of undefined", "NS_ERROR_FAILURE",
            "formats/code", "ui/color-picker", "lib/showdown", "blots/cursor", "lib/tribute", "core/selection"
        ],
        denyUrls: [
            // Chrome extensions
            /extensions\//i,
            /^chrome:\/\//i,
        ],
        beforeBreadcrumb(breadcrumb, hint) {
            return cleanBreadcrumbs(breadcrumb, hint);
        },
        integrations: [
            Sentry.metrics.metricsAggregatorIntegration(),
        ]
    };

    // this will be replaced in build
    if (env !== "local") { sentryConfig.release = "cryptee-v3-" + "local-dev-ver"; }
    Sentry.init(sentryConfig);
} catch (e) {
    console.error("Error initializing Sentry.", e);
}


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 TEST SESSIONSTORAGE & LOCALSTORAGE
////////////////////////////////////////////////
////////////////////////////////////////////////
$(document).on("ready", function () {
    
    try {
        // CURRENTLY, HOUSEKEEPING.JS IS THE FIRST POINT OF ENTRY.
        // SO TEST FOR THE SESSION STORAGE & LOCALSTORAGE HERE, AND SET THE SENTRY TAG HERE.

        sessionStorage.setItem("sessionStorageTest", "test");
        sessionStorage.removeItem("sessionStorageTest");

        setSentryTag("sessionStorage", "enabled");
    
    } catch (e) {

        setSentryTag("sessionStorage", "disabled");

        // if not on signin / signup / help, redirect to signin to show sessionStorage error.
        if ( location.pathname !== "/login" && location.pathname !== "/signup" && location.pathname !== "/help" ) {
            location.href = "/login";
        } else {
            var sessionStorageErrorMessage = "Seems like your browser's private browsing mode or an ad-blocker is blocking sessionStorage, a temporary storage mechanism Cryptee needs to function. Please try loading this page again after disabling your ad-blockers / private browsing mode, or visit our helpdesk for more info.";
            showPopup("popup-login", sessionStorageErrorMessage, "error");
            showPopup("popup-signup", sessionStorageErrorMessage, "error");
        }

    }

    try {
        // CURRENTLY, HOUSEKEEPING.JS IS THE FIRST POINT OF ENTRY.
        // SO TEST FOR indexedDB & UUID Generation HERE, AND SET THE SENTRY TAG HERE.
        console.log("[IDB] Testing");
        var now = (new Date()).getTime();
        var testID = newUUID(8);
        var idbTest = new Dexie("idbTest-" + now);
        idbTest.version(now).stores({ test: 'id' });
        idbTest.test.put({ id : testID }).then(()=>{
            idbTest.test.get(testID).then((testIO)=>{
                if (testIO.id !== testID) { 
                    indexedDBBlocked(true, idbTest);
                } else {
                    indexedDBBlocked(false, idbTest);
                }
            }).catch((e)=>{
                indexedDBBlocked(true, idbTest);
            });  
        }).catch((e)=>{
            indexedDBBlocked(true, idbTest);
        });

    } catch (error) {
        indexedDBBlocked(true);
    }

});

function indexedDBBlocked(isIDBBlocked, idbDB) {
    if (!isIDBBlocked) {
        console.log("[IDB] Available");
        setSentryTag("indexedDB", "available");
    } else {
        console.error("[IDB] Blocked");
        setSentryTag("indexedDB", "blocked");
        var idbBlockedErrorMessage = "Seems like your browser's private browsing mode or an ad-blocker is blocking indexedDB, which is a local storage mechanism Cryptee requires to function. Please try loading this page again after disabling your ad-blockers / private browsing mode, or visit our helpdesk for more info.";
        showPopup("popup-login", idbBlockedErrorMessage, "error");
        showPopup("popup-signup", idbBlockedErrorMessage, "error");

        if (location.pathname === "/login") {
            $(".wrapper").remove();
            $(".bottom").remove();
        } 
        
        else if (location.pathname === "/signup") {
            $("#step1").remove();
        }

        else {
            createPopup("Seems like your browser's private browsing mode or an ad-blocker is blocking indexedDB, which is a local storage mechanism Cryptee requires to function. Please try loading this page again after disabling your ad-blockers / private browsing mode, or visit our helpdesk for more info.", "error");
        }
    }

    if (idbDB) { idbDB.delete(); }
}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	CLEAN BREADCRUMBS
////////////////////////////////////////////////
////////////////////////////////////////////////

// This cleans all breadcrumbs to remove unnecessary stuff
// i.e. button labels/names, ui images' alt attributes etc.

function cleanBreadcrumbs(breadcrumb, hint) {
    var category = breadcrumb.category || "";
    
    if (category.startsWith("ui")) {
        
        // clear name attributes
        breadcrumb.message = breadcrumb.message.replace(/name=\s*(.*?)\s*"]/gi, "name='...']");
        
        // clear alt attributes
        breadcrumb.message = breadcrumb.message.replace(/alt=\s*(.*?)\s*"]/gi, "alt='...']");

    }
    
    return breadcrumb;
}


///////////////////////////////////////////
//////////////// REPORT BUGS /////////////
///////////////////////////////////////////

// USING CUSTOM BUGREPORTING AT /BUGREPORT NOW

function handleOfflineError(error) {
    if (error) {
        console.log(error);
        Sentry.withScope(function (scope) {
            if (error.code) {
                scope.setFingerprint([error.code]);
            }

            scope.setTag("connectivity", "offline");
            Sentry.captureException(error);
        });
    }
}

/**
 * Handle & Log Errors
 * @param {string} errorTitle an error message title (i.e. "Couldn't upload file ...")
 * @param {object} data Error Data Object, will be iterated and processed
 * @param {('debug'|'info'|'warning'|'error'|'fatal')} level Error Level
 */
function handleError(errorTitle, data, level) {
    
    level = level || 'error';
    data = data || {};
    
    if (env === "local") { 
        if (level !== "info") {
            console.error(errorTitle);
            if (!isEmpty(data)) { console.error(data); }
        } else {
            console.warn(errorTitle);
        }
        // return; 
    } else {
        console.log(errorTitle);
    }

    Sentry.withScope(function (scope) {
        
        if (data.code) { 
            scope.setFingerprint([data.code]); 
        }

        scope.setLevel(level);
        
        scope.addEventProcessor((event, hint) => {
            try {
                data.originalError = event.exception.values[0].type + " : " + event.exception.values[0].value;
                event.exception.values[0].type = errorTitle;
                event.exception.values[0].value = data.originalError;
            } catch (e) {
                return event;
            }
            return event;
        });

        if (data.stack || isError(data)) {
            Sentry.captureException(data, { extra : data });
        } else {
            if (!isEmpty(data)) {
                Sentry.captureMessage(errorTitle, { extra : data });
            } else {
                Sentry.captureMessage(errorTitle);
            }
        }
    });
    
}

function setSentryUser(userid) {
    Sentry.configureScope(function (scope) {
        scope.setUser({ id: userid });
        scope.setTag("loggedin", "true");
    });
}

function setSentryTag(key, val) {
    Sentry.configureScope(function (scope) {
        scope.setTag(key, val);
    });
}



/**
 * A Breadcrumb Message Logger for debugging
 * @param {string} message Breadcrumb Message i.e. "[Document] Saving ..."
 * @param {('info'|'warning'))} level 
 */
function breadcrumb(message, level) {
    level = level || "info";
    Sentry.addBreadcrumb({
        message: message,
        level: level
    });

    // we're on testing / local env. log breadcrumbs to console.
    if (env !== "prod") { console.log(message); }
}

function logTimeStart(name) {
    if (env !== "prod") { console.time(name); }
}

function logTimeEnd(name) {
    if (env !== "prod") { console.timeEnd(name); }
}

function isError(obj){
    return Object.prototype.toString.call(obj) === "[object Error]";
}

function metricsTags() {
    let metricTags = {};

    // get resolution
    if ($(window).width() <= 480) { metricTags.resolution = "<=480px"; } 
    if ($(window).width() > 480)  { metricTags.resolution = ">480px";  } 
    if ($(window).width() > 720)  { metricTags.resolution = ">720px";  } 
    if ($(window).width() > 1280) { metricTags.resolution = ">1280px"; } 
    if ($(window).width() > 1920) { metricTags.resolution = ">1920px"; }
    
    // get os
    if (isios)       { metricTags.os = "ios"; }
    if (isAndroid)   { metricTags.os = "android"; }
    if (isipados)    { metricTags.os  = "ipados"; }
    
    // get browser
    if (isSafari)    { metricTags.browser = "safari"; }
    if (isFirefox)   { metricTags.browser = "firefox"; }
    if (isChromium)  { metricTags.browser = "chromium"; }
    if (isIOSChrome) { metricTags.browser = "ioschrome"; }
    
    // get touch / platform 
    metricTags.touch = isTouch || false;
    metricTags.platform = "web"; 
    if (isInstalled) { metricTags.platform = "pwa"; }

    // get locale etc
    if (detectedLocale) { metricTags.locale = detectedLocale; }
    metricTags.language = navigator.language;

    // get plan
    metricTags.plan = theUserPlan || "free";
    
    return metricTags;
}

/**
 * Increment a counter by +X, i.e. for each button click increment +1
 * @param {String} key (i.e. "button_click")
 * @param {Number} val (i.e. 1)
 * @param {Object} additionalTags (any other tags you need to provide, you can here.)
 */
function metricsIncrement(key, val, additionalTags) {
    val = val || 1;
    additionalTags = additionalTags || {};
    
    let tags = metricsTags();
    tags = {...tags, ...additionalTags };

    Sentry.metrics.increment(key, val, { tags: tags });
}

/**
 * Distributions help us get insights by allowing us to obtain aggregations such as p90, min, max, and avg. i.e. Add '15.0' to a distribution used for tracking the loading times for component.
 * @param {String} key i.e. "component_loadtime"
 * @param {Number} val i.e. 15.0
 * @param {('nanosecond'|'microsecond'|'millisecond'|'second'|'minute'|'hour'|'day'|'week'|'bit'|'byte'|'kilobyte'|'kibibyte'|'megabyte'|'mebibyte'|'gigabyte'|'gibibyte'|'terabyte'|'tebibyte'|'petabyte'|'pebibyte'|'exabyte'|'exbibyte'|'ratio'|'percent')} unit The unit of measurement. Defaults to millisecond
 * @param {Object} additionalTags (any other tags you need to provide, you can here.)
 */
function metricsDistribution(key, val, unit, additionalTags) {
    additionalTags = additionalTags || {};
    
    let tags = metricsTags();
    tags = {...tags, ...additionalTags };
    
    try { Sentry.metrics.distribution(key, val, { unit : unit || "millisecond", tags: tags }); } catch (e) {}

}

/**
 * Gauges are space saving version of distributions, that help us get insights by allowing us to obtain aggregations such as p90, min, max, and avg. i.e. Add '15.0' to a distribution used for tracking the loading times for component.
 * But they can't be used to get percentiles. If percentiles aren't important, use gauges instead.
 * @param {String} key i.e. "component_loadtime"
 * @param {Number} val i.e. 15.0
 * @param {('nanosecond'|'microsecond'|'millisecond'|'second'|'minute'|'hour'|'day'|'week'|'bit'|'byte'|'kilobyte'|'kibibyte'|'megabyte'|'mebibyte'|'gigabyte'|'gibibyte'|'terabyte'|'tebibyte'|'petabyte'|'pebibyte'|'exabyte'|'exbibyte'|'ratio'|'percent')} unit The unit of measurement. Defaults to millisecond
 * @param {Object} additionalTags (any other tags you need to provide, you can here.)
 */
function metricsGauge(key, val, unit, additionalTags) {
    additionalTags = additionalTags || {};
    
    let tags = metricsTags();
    tags = {...tags, ...additionalTags };
    
    try { Sentry.metrics.gauge(key, val, { unit : unit || "millisecond", tags: tags }); } catch (e) {}

}

/**
 * Sets are useful for looking at unique occurrences and counting the unique elements you added.
 * i.e. page loaded
 * @param {String} key 
 * @param {String} val 
 */
function metricsSet(key, val) {
    Sentry.metrics.set(key, val, { tags: metricsTags() });
}


/**
 * We keep track of the metrics timers with this object.
 */
let metricsTimers = {};

/**
 * This allows us to set up a metrics timer, and log it once it's completed  
 * @param {String} key i.e. 'component_loadtime'
 */
function metricsTimerStart(key) { metricsTimers[key] = Date.now(); }

/**
 * This allows us to complete a metrics timer, and log the value as distribution or gauge
 * @param {String} key i.e. 'component_loadtime'
 * @param {'distribution'|'gauge'} distributionOrGauge 
 * @param {Object} additionalTags (any other tags you need to provide, you can here.)
 * @returns {Number} metricInMS This is in case if we wish to do something about this later, i.e. log etc
 */
function metricsTimerEnd(key, distributionOrGauge, additionalTags) {
    let metric; 
    
    try {
        metric = Date.now() - metricsTimers[key];

        if (distributionOrGauge === "distribution") {
            metricsDistribution(key, metric, "millisecond", additionalTags); // defaults to ms
        } else {
            metricsGauge(key, metric, "millisecond", additionalTags); // defaults to ms
        }
    } catch (e) {}

    return metric;
}