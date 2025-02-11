
////////////////////////////////////////////////
////////////////////////////////////////////////
//	RENDERERS
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Renders an album with given ID, and returns its HTML
 * @param {string} aid Album ID
 * @param {number} [photos] Number of Photos
 * @returns {string} albumHTML Album's HTML
 */
function renderAlbum(aid, photos) {
    var album = albums[aid];
    photos = photos || "";

    if (!album) { 
        handleError("[RENDER ALBUM] Album doesn't exist in catalog.", { "aid" : aid });
        return ""; 
    }

    var name            = album.decryptedTitle || "Untitled Album"; // "ALBUM NAME"
    name = escapeHTML(name);

    var exifDate        = album.date  || "0000:00:00";              // "2019:07:03"
    var sortableDate    = sortableExifDate(exifDate);
    var prettyDate      = fancyDate(exifDate);                      // "NOV '20"
    var thumbToken      = album.ttoken || "";
    var thumbID         = album.thumb || "";                        // "t-12345"

    // var isDarkMode      = $("html").hasClass("dm");
    // var loadMonochromeBg = appPreference.photos["cover-bg-dominant-color"] === "monochrome";
    
    var bgLoadingPreference;

    // if (loadMonochromeBg || isMobile) {
        var avgColor     = "20,20,20";
        var nameColor    = "245,245,245";
        bgLoadingPreference = "monochrome";
    // } else {
        // var avgColor     = album.pinky || "20,20,20";               // "17,24,33"

        // var nameContrast = calculateContrast([20,20,20], avgColor.split(",")).toFixed(3);
    
        // var nameColor = "20,20,20";
        // if (nameContrast < 3.0) { nameColor = "255,255,255"; }
        // bgLoadingPreference = "color";
    // }

    if (useHighResThumbnails && album.ltoken) {
        thumbID         = convertID(thumbID, "l") || "";            // "l-12345"
        thumbToken      = album.ltoken || "";
    }

    return `
    <div class="content album" id="${aid}" name="${name}" date="${prettyDate}" datesort="${sortableDate}" exifDate="${exifDate}" photos="${photos}" thumb="${thumbID}" thumbToken="${thumbToken}"  style="--bg:rgb(${avgColor}); --c:rgb(${nameColor});" bgloadingpref="${bgLoadingPreference}">
        <i></i>
        <img src="" alt thumb="${thumbID}">
    </div>`;
    
}

/**
 * Renders an album for the move modal
 * @param {*} album 
 * @param {Number} index 
 * @returns {string} albumHTML
 */
function renderAlbumForMoveModal(album, index) {

    // we do this so that large libraries load quickly as well.
    index = index % 16; 
    
    let active      = album.id === activeAlbumID;
    let disabled    = active? "disabled" : "";
    let current     = active? "CURRENT ALBUM" : "";
    let name        = album.decryptedTitle;
    let exifDate    = album.date  || "0000:00:00";  
    let date        = fancyDate(exifDate);
    var thumbID     = album.thumb || "";

    return `<button class="radio" group="move" val="${album.id}" ${disabled} style='--i:${index}'>
        <strong>${name}</strong>
        <time>${current || date}</time>
        <img src="" alt thumb="${thumbID}">
    </button>`

}

/**
 * Renders an album header with given ID, and returns its HTML
 * @param {string} aid Album ID
 * @returns {string} albumHeaderHTML Album's Header's HTML
 */
function renderAlbumHeader(aid) {
    var album = {};
    
    if (aid !== "favorites") {
        album = albums[aid];
        
        if (!album) { 
            handleError("[RENDER ALBUM HEADER] Album doesn't exist in catalog.", { "aid" : aid });
            return ""; 
        }
    } else {
        if (detectedLocale === "GB") {
            album.decryptedTitle = "Favourites";
        } else {
            album.decryptedTitle = "Favorites";
        }
        album.date = "0000:00:00";
    }

    var name            = album.decryptedTitle || "Untitled Album"; // "ALBUM NAME"
    name = escapeHTML(name);

    var exifDate        = album.date  || "0000:00:00";              // "2019:07:03"
    var prettyDate      = fancyDate(exifDate);                      // "NOV '20"
    var avgColor        = album.pinky || "54,54,54";                // rgb

    return `
    <div id="albumheader" style="--bg:rgb(${avgColor})">
        <h2 class="name">${name}</h2>
        <h3 class="date" exif="${exifDate}">${prettyDate}</h3>
    </div>`;
}

/**
 * Refreshes album & its header in DOM with changes (i.e. name / date / thumbnail changes etc) 
 * @param {string} aid Album ID
 */
function refreshAlbumInDOM(aid) {
    if (!aid) { return; }
    
    var albumID = aid;

    if ($(`.album[id="${albumID}"]`).length > 0) {
        $(`.album[id="${albumID}"]`).replaceWith(renderAlbum(albumID));
        
        setTimeout(function () { 
            $(`.album[id="${albumID}"]`).each(function(){
                setupIntersectionObserver($(this)[0]); 
            });
        }, 50);
    }

    if (albumID === activeAlbumID) {
        $("#albumheader").replaceWith(renderAlbumHeader(albumID));
    }

}



/**
 * Renders a photo with given ID, and returns its HTML
 * @param {string} id Photo ID
 * @returns {string} photoHTML Photo's HTML
 */
function renderMedia(id, forSearch) {
    var photo = photos[id] || favorites[id];
    forSearch = forSearch || false;

    if (!photo) {
        handleError("[RENDER PHOTO] Media doesn't exist in album's catalog.", { "id" : id });
        return ""; 
    }

    var name         = photo.decryptedTitle || "Untitled.jpg";                              // A Photo Name
    name = escapeHTML(name);

    var exifDate     = photo.date    || "0000:00:00";                                       // "2020:09:27" etc.
    // var exifDay      = photo.day     || dayFromEXIF(exifDate)   || "00";                    // "27"
    // var exifMonth    = photo.month   || monthFromEXIF(exifDate) || "00";                    // "09"
    // var exifYear     = photo.year    || yearFromEXIF(exifDate)  || "0000";                  // "2020"
    // var exifTime     = photo.time    || timeFromEXIF(exifDate)  || "00:00:00";              // "15:33:04"
    var sortableDate = sortableExifDate(exifDate);

    var avgColor     = photo.pinky   || "54,54,54";                                         // "17,24,33"

    var thumbToken   = photo.ttoken  || "";
    var thumbID      = convertID(id, "t") || "";                                           // "t-12345"
    
    var selectionIcon = "<i></i>";
    if (activeAlbumID === "favorites" || forSearch) { selectionIcon = ""; }

    var type = "photo";
    if (id.startsWith("v-")) { type = "video"; }
    
    var raw = "";
    if (photo.raw) { raw = "raw='true'"; }

    var maker = "";
    if (photo['exif-make']) { 
        maker = (photo['exif-make'] || "").toLowerCase();
        if (maker.includes("apple"))       { maker = "maker='apple'"; }    
        if (maker.includes("leica"))       { maker = "maker='leica'"; }
        if (maker.includes("hasselblad"))  { maker = "maker='hasselblad'"; }    
    }

    var model = "";
    var mono = "";
    if (photo['exif-model']) {
        model = (photo['exif-model'] || "").toLowerCase();
        model = `model='${model}'`;
        if (model.includes("monochrom")) { mono = "mono='true'"; }
    }

    var rawTag = "";
    if (raw) { rawTag = `<u ${maker} ${model} ${mono}>RAW</u>`; }

    var favTag = `<b></b>`;
    if (favorites[id]) { favTag=`<b fav="true"></b>`;}

    var favAttr = '';
    if (favorites[id]) { favAttr = `fav="true"`; }

    return `
    <div class="content media ${type}" id="${id}" name="${name}" datesort="${sortableDate}" exifDate="${exifDate}" thumb="${thumbID}" thumbToken="${thumbToken}" style="--bg:rgb(${avgColor})" ${raw} ${maker} ${favAttr}>
        ${selectionIcon}
        <img src="" alt thumb="${thumbID}">
        ${rawTag}
        ${favTag}
    </div>`;
}



/**
 * Renders a search header with given title and optional subtitle, and returns its HTML
 * @param {string} title Search Title
 * @param {string} subtitle Search SubTitle
 * @returns {string} searchHeaderHTML Search Header's HTML
 */
function renderSearchHeader(title) {
    title = title || "";
    title = escapeHTML(title);
    return `
    <div class="searchheader" style="--bg:rgb(0,0,0)">
        <h3 class="title">${title}</h3>
    </div>`;
}


/**
 * Renders a photo/video for lightbox with given ID and returns its HTML
 * @param {String} id 
 */
function renderLightboxMedia(id) {
    var media; 
    if (id.startsWith("p-")) {
        media = `<div class='swiper-zoom-container' pid='${id}'><img class="lbox-photo" pid='${id}' draggable='false' src=""/></div>`;
    } else {
        media = `<div class="swiper-video-container" pid='${id}'>
                    <video width="1920" height="1080" pid='${id}' class="lbox-video" poster="" autoplay playsinline>
                        <source src="" type="video/mp4" pid='${id}'>
                    </video>
                </div>`;
    }
    return media;
}