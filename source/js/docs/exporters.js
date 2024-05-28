
////////////////////////////////////////////////
////////////////////////////////////////////////
//	EXPORTERS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Exports active document as HTML, and optionally if the export's click event is passed, checks if shift is pressed, and B64 encodes the document's first H1, as the filename ( i.e. b64title.html )  
 * @param {*} [event] OnClick Event, to detect shift key
 */
async function exportAsHTML(event) {
    var useTOCHeaderForExport = false; 
    
    if (event) { useTOCHeaderForExport = event.shiftKey; }

    var documentHTML = $(".ql-editor").html();

    var processedHTML = documentHTML; 

    // this processes & nests lists for correct HTML syntax 
    processedHTML = preprocessListsForExport(processedHTML);
    
    // this processes & nests tables for correct HTML syntax
    processedHTML = convertCrypteeTablesToHTMLTables(processedHTML);

    var documentName = await getDocNameFromCatalog(activeDocID);

    var tocHeader;
    if (tocArray[0]) {
        tocHeader = tocArray[0].text();
    } else {
        tocHeader = documentName;
    }

    var exportTitle = "";
    if (useTOCHeaderForExport) {
        exportTitle = tocHeader || "";
    } else {
        exportTitle = documentName || "";
    }

    var blob = new Blob([processedHTML], {type: "text/html;charset=utf-8"});
    saveAsOrShare(blob, exportTitle + ".html");

    hidePanels();
}






/**
 * Exports active document as a markdown file, using turndown to convert from HTML -> Markdown
 */
async function exportAsMarkdown() {
    
    var documentName = await getDocNameFromCatalog(activeDocID);

    var documentHTML = $(".ql-editor").html();

    var processedHTML = documentHTML; 

    // this processes & nests lists for correct HTML syntax 
    processedHTML = preprocessListsForExport(processedHTML);
    
    // this processes & nests tables for correct HTML syntax
    processedHTML = convertCrypteeTablesToHTMLTables(processedHTML);

    var turndownConverter = new TurndownService();
    
    // adds Github Flavored Markdown support (with things like checklists & technically tables in the future once we implement an HTML tables converter)
    if (turndownPluginGfm.gfm) {
        turndownConverter.use(turndownPluginGfm.gfm);
    }

    var markdown = turndownConverter.turndown(processedHTML);
    
    var blob = new Blob([markdown], {type: "text/markdown; charset=UTF-8"});
    saveAsOrShare(blob, documentName + ".md");
    
    hidePanels();
}


/**
 * Exports active document as an ECD file (either using the provided key, or user's key)
 * @param {boolean} useUserKey forces exporter to use the user's key instead of a new key entered in the export modal
 */
async function exportAsECD(useUserKey) {
    
    useUserKey = useUserKey || false;

    var keyToUseForEncryption = $("#ecd-export-key-input").val().trim() || "";

    if (!keyToUseForEncryption && !useUserKey) {
        $("#ecd-export-key-input").trigger("focus");
        return false;
    }
    
    if (useUserKey) { keyToUseForEncryption = theKey; }

    var stringifiedPlaintextDocDelta;

    try {
        var plaintextDocDelta = quill.getContents();
        stringifiedPlaintextDocDelta = JSON.stringify(plaintextDocDelta);
    } catch (error) {
        handleError("[EXPORT ECD] Failed to stringify document contents", error);
        createPopup("Failed to export your document as ECD. Chances are your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }

    var documentName = await getDocNameFromCatalog(activeDocID);

    var encryptedDocDelta, stringifiedEncryptedDocDelta;

    try {
        encryptedDocDelta = await encrypt(stringifiedPlaintextDocDelta, [keyToUseForEncryption]);
        stringifiedEncryptedDocDelta = JSON.stringify(encryptedDocDelta);
    } catch (error) {
        handleError("[EXPORT ECD] Failed to stringify encrypted doc contents", error);
        createPopup("Failed to export your document as ECD. Chances are your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }

    var title = documentName + ".ecd";
    var blob = new Blob([stringifiedEncryptedDocDelta], {type: "application/json;charset=utf-8"});
    saveAsOrShare(blob, title);

    hideActiveModal();

    return true;

}




async function exportAsDOCX() {

    var documentName = await getDocNameFromCatalog(activeDocID);
    
    var documentHTML = $(".ql-editor").html();

    var processedHTML = documentHTML; 

    // this processes & nests lists for correct HTML syntax 
    processedHTML = preprocessListsForExport(processedHTML);
    
    // this processes & nests tables for correct HTML syntax
    processedHTML = convertCrypteeTablesToHTMLTables(processedHTML);

    var wordDoc;

    try {
        wordDoc = htmlToDocx(processedHTML, documentName);
    } catch (error) {
        handleError("[EXPORT DOCX] Failed to convert html to docx", error);
        createPopup("Failed to export your document as DOCX. Chances are your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }

    if (!wordDoc) {
        handleError("[EXPORT DOCX] Failed to convert html to docx", { did : activeDocID});
        createPopup("Failed to export your document as DOCX. Chances are your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }

    var docxBlob; 
    
    try {
        docxBlob = await docx.Packer.toBlob(wordDoc);
    } catch (error) {
        handleError("[EXPORT DOCX] Packer failed to pack docx file", error);
        createPopup("Failed to export your document as DOCX. Chances are your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    } 
    
    saveAsOrShare(docxBlob, documentName + ".docx");
    
    hidePanels();

}








/**
 * Starts a download from the previewer's unsupported popup
 * @param {*} did Doc ID
 */
async function downloadUnsupportedFile(did) {
    if (!did) { 
        hideAllPopups(); 
        return; 
    }

    var connection = checkConnection();
    if (!connection) { 
        breadcrumb("[DOWNLOAD FILES] No internet connection.");
        createPopup(`Failed to connect / download your files. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false; 
    }

    $("#download-unsupported-file-button").html("downloading");
    $("#download-unsupported-file-button").addClass("loading");
    
    await downloadAndSaveFile(did);
    
    hideAllPopups();
    
    return true;
}


var downloadsCancelled = false;
var downloadingFiles = false;

/**
 * Downloads & saves an array of files to disk
 * @param {string} [whatToDownload] Optionally provided, if we're downloading a right click'ed single doc, instead of selections.
 */
async function downloadFiles(whatToDownload) {
    var isDownloadingAndSavingMultipleFiles = false;

    arrayOfDIDsToDownload = selections;
    if (arrayOfDIDsToDownload.length === 0) { 
        arrayOfDIDsToDownload = [$("#dropdown-doc").attr("did")]; 
    } 

    // download in a batch of 2 for now, since parallel decrypting more stuff could mess things up. 
    // i.e. if a file/photo is 500mb, 2 of these would take ~100mb memory. 
    if (downloadingFiles) { 
        breadcrumb("[DOWNLOAD FILES] Already downloading");
        return false; 
    }

    if (arrayOfDIDsToDownload.length === 0) {
        breadcrumb("[DOWNLOAD FILES] Nothing to download");
        return false;
    }

    if (arrayOfDIDsToDownload.length > 1) { isDownloadingAndSavingMultipleFiles = true; }

    var connection = checkConnection();
    if (!connection) { 
        breadcrumb("[DOWNLOAD FILES] No internet connection.");
        createPopup(`Failed to connect / download your files. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false; 
    }


    var batchSize = 2;
    downloadingFiles = true;
    downloadsCancelled = false;
    $("#start-downloads-button").addClass("downloading");
    
    if (whatToDownload === "single") {
        $("#downloadFileButton").addClass("loading");
    } else {
        minimizeMaximizePopup("popup-download"); 
    }

    breadcrumb(`[DOWNLOAD FILES] Starting to download a total of ${arrayOfDIDsToDownload.length} files(s) in batches of 2`);

    arrayOfDIDsToDownload.forEach(startDocOrFileProgress);

    for (var index = 0; index < arrayOfDIDsToDownload.length; index+= batchSize) {
        if (!downloadsCancelled) {
            var firstDID = arrayOfDIDsToDownload[index] || "";
            var secondDID = arrayOfDIDsToDownload[index + 1] || "";
            $("#popup-download").find(".status").html(`DOWNLOADING ${index} / ${arrayOfDIDsToDownload.length}`);
            await Promise.all([downloadAndSaveFile(firstDID, isDownloadingAndSavingMultipleFiles), downloadAndSaveFile(secondDID, isDownloadingAndSavingMultipleFiles)]);
        }
    }

    downloadingFiles = false;
    downloadsCancelled = false;
    $("#start-downloads-button").removeClass("downloading");

    if (whatToDownload === "single") {
        $("#downloadFileButton").removeClass("loading");
    } else {
        hidePopup("popup-download");
    }

    arrayOfDIDsToDownload.forEach(stopDocOrFileProgress);
    
    if (whatToDownload !== "single") {
        clearSelections();
    }

    hideRightClickDropdowns();
    hidePanels();

    return true;

}




/**
 * Download, decrypt and saveAs file.  
 * @param {String} did 
 * @param {*} isDownloadingAndSavingMultipleFiles (this will be passed = true, if we're downloading this file as a part of a batch, which will force "save as", instead of showing the native share dialog in ios and android pwa) 
 * @returns 
 */
async function downloadAndSaveFile(did, isDownloadingAndSavingMultipleFiles) {

    if (!did) { return false; } // likely the last in the batch (i.e. an odd number)
    if (downloadsCancelled) { return false; } // downloads cancelled; 

    // if we're downloading / saving multiple files, 
    // we'll need to force saveAs instead of showing the user the native share popup on ios/android PWA. 
    isDownloadingAndSavingMultipleFiles = isDownloadingAndSavingMultipleFiles || false;

    breadcrumb(`[DOWNLOAD FILES] Downloading ${did}`);

    var file;
    try {
        file = await getDocFromCatalog(did);
    } catch (error) {
        error.did = did;
        handleError("[DOWNLOAD FILES] Failed to get file from catalog", error);
        return false;
    }

    var filename = docName(file);
    
    if (!file.isfile) { filename = filename + ".uecd"; }

    var fileContents;

    try {
        fileContents = await downloadAndDecryptFile(did, null, "blob", filename, file.mime, null, file, true);
    } catch (error) {
        error.did = did;
        handleError("[DOWNLOAD FILES] Failed to download & decrypt file", error);
        return false;
    }

    if (!fileContents) {
        handleError("[DOWNLOAD FILES] Couldn't Save file", {did : did});
        return false;
    }

    if (fileContents === "aborted") {
        handleError("[DOWNLOAD FILES] Aborted download to save file", {did : did}, "info");
        return false;
    }

    try {
        saveAsOrShare(fileContents, filename, isDownloadingAndSavingMultipleFiles);
    } catch (error) {
        error.did = did;
        handleError("[DOWNLOAD FILES] Couldn't Save file", error);
        return false;
    }

    return true;

}



/**
 * Cancels downloads
 */
function cancelDownloads() {
    downloadsCancelled = true;
    hidePopup("popup-download");
    $("#start-downloads-button").removeClass("downloading");
}


async function downloadActiveDocAsUECD() {
    
    $("#button-download-active-doc-as-uecd").addClass("loading");

    await downloadAndSaveFile(activeDocID);    

    $("#button-download-active-doc-as-uecd").removeClass("loading");
}




































////////////////////////////////////////////////
////////////////////////////////////////////////
//	CONVERT LISTS TO CORRECT HTML SYNTAX
////////////////////////////////////////////////
////////////////////////////////////////////////

// https://github.com/quilljs/quill/issues/979#issuecomment-470942118
function getListLevelForExport(el) {
    var className = el.className || '0';
    return +className.replace(/[^\d]/g, '');
}
// Attempts to fix lists, because quill exports broken indented lists
// https://github.com/quilljs/quill/issues/979
// https://gist.github.com/Daenero/3442213dc5093dc10f30711edb529729
// https://gist.github.com/Daenero/3442213dc5093dc10f30711edb529729?permalink_comment_id=3769242#gistcomment-3769242

/**
 * This takes in an HTML from editor, and converts all lists in it to correctly nested lists using a correct syntax
 * @param {string} rawHTML HTML
 * @returns {string} processedHTML
 */
function preprocessListsForExport(rawHTML) {
    if (!rawHTML || rawHTML.length === 0) {
        return rawHTML;
    }

    const tempEl = window.document.createElement('div');
    tempEl.setAttribute('style', 'display: none;');
    tempEl.innerHTML = rawHTML;

    const listTypes = ['1', 'a', 'i'];

    ['ul', 'ol'].forEach((type) => {
        // Grab each list, and work on it in turn
        Array.from(tempEl.querySelectorAll(type)).forEach((outerListEl) => {
            const listChildren = Array.from(outerListEl.children).filter((el) => el.tagName === 'LI');

            let lastLiLevel = 0;

            const parentElementsStack = [];
            const root = document.createElement(type);

            parentElementsStack.push(root);

            listChildren.forEach((e, i) => {
                const currentLiLevel = getQuillListLevel(e);
                e.className = e.className.replace(getIndentClass(currentLiLevel), '');
                const difference = currentLiLevel - lastLiLevel;
                lastLiLevel = currentLiLevel;

                if (difference > 0) {
                    let currentDiff = difference;

                    while (currentDiff > 0) {
                        let lastLiInCurrentLevel = seekLastElement(parentElementsStack).lastElementChild;

                        if (!lastLiInCurrentLevel) {
                            lastLiInCurrentLevel = document.createElement('li');
                            encode_addChildToCurrentParent(parentElementsStack, lastLiInCurrentLevel);
                        }

                        const newList = document.createElement(type);
                        if (type === 'ol') { newList.setAttribute('type', listTypes[currentLiLevel % 3]); }
                        lastLiInCurrentLevel.appendChild(newList);
                        parentElementsStack.push(newList);

                        currentDiff--;
                    }
                }

                if (difference < 0) {
                    let currentDiff = difference;

                    while (currentDiff < 0) {
                        parentElementsStack.pop();

                        currentDiff++;
                    }
                }

                encode_addChildToCurrentParent(parentElementsStack, e);
            });

            outerListEl.innerHTML = root.innerHTML;
        });
    });

    const newContent = tempEl.innerHTML;
    tempEl.remove();
    return newContent;

    function seekLastElement(list) {
        return list[list.length - 1];
    }

    function encode_addChildToCurrentParent(parentStack, child) {
        const currentParent = seekLastElement(parentStack);
        currentParent.appendChild(child);
    }

    function getQuillListLevel(el) {
        const className = el.className || '0';
        return +className.replace(/[^\d]/g, '');
    }

    function getIndentClass(level) { return `ql-indent-${level}`; }

}




/**
 * This takes in an HTML from editor, and converts all tables in it to correct html tables syntax 
 * @param {string} crypteeHTML HTML
 * @returns {string} webHTML HTML
 */
function convertCrypteeTablesToHTMLTables(crypteeHTML) {
    
    var tempEl = document.createElement('div');
    tempEl.setAttribute('style', 'display: none;');
    tempEl.innerHTML = crypteeHTML;

    var startRow = '::startrow::';
    var endRow = '::endrow::';

    // find each tabledata and remove it
    Array.from(tempEl.querySelectorAll("crypteetabledata")).forEach((tabledata) => {
        tabledata.remove();
    });

    // find each table
    Array.from(tempEl.querySelectorAll("crypteetable")).forEach((table) => {
        var cells = Array.from(table.children).filter((el) => el.tagName === 'CRYPTEETABLECELL');
        var columns = parseInt((table.getAttribute("columns") || "1"));

        // Now work through each cell in the this table
        for (var i = 0; i < cells.length; i++) {
            var currentCell = cells[i];

            if ((i % columns) === 0) {
                // first item in row
                currentCell.before(startRow);
            }

            if ((i % columns) === columns - 1) {
                // last item in row
                currentCell.after(endRow);
            }
        }
    });

    //  Get the content in the temp element and replace the temporary tags with new ones
    var newContent = tempEl.innerHTML;
    newContent = newContent.replace(/::startrow::/g, '<tr>');
    newContent = newContent.replace(/::endrow::/g, '</tr>');

    newContent = newContent.replace(/<crypteetablecell/g, '<td');
    newContent = newContent.replace(/<\/crypteetablecell>/g, '</td>');

    newContent = newContent.replace(/<crypteetable/g, '<table');
    newContent = newContent.replace(/<\/crypteetable>/g, '</table>');

    tempEl.remove();

    return newContent;
}