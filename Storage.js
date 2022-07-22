// Tek 4051 Emulator Storage Script
// 20-07-2022


function Storage() {

    var uploadTo4051 = 0;
    var fileIndex = [];
    var content = new Uint8ClampedArray();
    var binData = [];
    var binDataPtr = 0;
    var currentFile = "";
    var copylen = 256;
    var copyterm = 0x80;
    var copycnt = 0;
    var dirLength = 0;
    var dirFidx = 0;
    var dirFname = "";
    var dirFnamePtr = 0;
    var fileLength = 46;    // Including CR and NULL
    var filesPerDirectory = 255;
    var directoryName = "/root/";
    var padcnt = 0;
    
    const fileTypes = [
	    {idx:'A',type:'ASCII'},
	    {idx:'B',type:'BINARY'},
	    {idx:'N',type:'NEW'},
	    {idx:'L',type:'LAST'}
    ]; 

    const fileUsages = [
	    {idx:'P',usage:'PROG'},
	    {idx:'D',usage:'DATA'},
	    {idx:'L',usage:'LOG'},
	    {idx:'T',usage:'TEXT'}
    ]; 

    // Initialise the file index and and list
    loadFileIndex();
    updateFileList();
    renameIdxKey();	// Tmporary fix to rename IDX key to 999


    // Save a file to web storage
    this.saveFile = function(){
	    var filelistobj = document.getElementById('fileList');
        currentFile = document.getElementById('fileNum').value;
        if (currentFile == "") {
            // Prompt for a file number
            var filenum = 0;
            while (filenum == 0) {
                var nextfnum = getNextAvailableFnum();
                if (nextfnum) {
                    var filenum = prompt("Please provide a file number:", nextfnum);
                    if (filenum) {
                        if ( (filenum>0) && (filenum<filesPerDirectory) ) {
                            currentFile = filenum.toString();
                        }else{
                            filenum = 0;
                        }
                    }else{
                        return;
                    }
                }else{
                    alert("Unable to save. No files available!");
                    return;
                }
            }
        }
//console.log("Currenfile:" + currentFile)
        // If we have a file number then Save the file
        if (currentFile != "") {
            // If file exists in web storage then prompt to overwrite
            if ( localStorage.getItem(currentFile) && !confirm("Overwrite existing file?") ) {
                return;
            }else{
                // Save data to web storage
//		              localStorage.setItem(fnumstr, btoa(String.fromCharCode.apply(null,content)));
		        localStorage.setItem(currentFile, String.fromCharCode.apply(null,content));
            }
            // Save file settings to index
            updateRecordFromControls(currentFile);
            // Save index and update file list
            saveFileIndex();
            clearFileList();
            updateFileList();
            // Set currently selected item in Select dropdown
            selectCurrentFile(currentFile);
        }
    }


    // Retrieve a file from web storage
    this.loadFile = function(){
        // Get the selected file number
	    var filelistobj = document.getElementById('fileList');
	    currentFile = filelistobj.options[filelistobj.selectedIndex].text;
        // Update size field
//	    var fsize = document.getElementById('fileSize');
        // Update the file number field
        var filenumobj = document.getElementById('fileNum');
	    filenumobj.value = currentFile;
        // Load the file
	    if (currentFile != "") {
            selectCurrentFile(currentFile);
	    }else{
		    alert("File number required!");
	    }
    }


    // Remove file from web storage
    this.deleteFile = function(){
//        var filenumobj = document.getElementById('fileNum');
	    var filelistobj = document.getElementById('fileList');
	    var fnumstr = filelistobj.options[filelistobj.selectedIndex].text;
	    if (fnumstr != '') {
            if (localStorage.getItem(fnumstr)) {
                if (confirm("Delete existing file?")){
                    // Delete file
//		            viewerobj = document.getElementById('fileViewer');
//		            viewerobj.value = "";
				    clearFileList();
                    content = [];
                    localStorage.removeItem(fnumstr);
				    updateFileList();
//				    filenumobj.value = '';
                    clearIndexEntry(fnumstr);
                    saveFileIndex();
                    this.clearView();
                }
            }else{
                alert("Nothing to delete!");
            }
	    }else{
		    alert("Select a file number to delete!");
	    }
    }


    // Select file for upload to Tek when 'Select' button clicked
    this.selectTekFile = function(){
        if (content) upload_to_tek(content.buffer);
	    this.closeStorage();
    }


    // Clear index entries
    function clearIndexEntry(fnumstr){
//    console.log("Clearing file from index:" + fnumstr);
        if (fileIndex && fileIndex.length > 0){
            var i = 0;
            while (i < fileIndex.length) {
                if (fileIndex[i][0] == fnumstr) {
                    fileIndex.splice(i,1);
                }else{
                    i++;
                }
            }
        }
    }


    // Clear file from viewer
    this.clearView = function(){
        content = new Uint8Array();
        document.getElementById('fileList').value = "";
        document.getElementById('fileViewer').value = "";
	    document.getElementById('fileType').value = "";
	    document.getElementById('fileUsage').value = "";
	    document.getElementById('fileDesc').value = "";
//	    document.getElementById('fileSecret').value = "N";
        document.getElementById('fname').innerHTML = "Drop a file to this window";
        document.getElementById('fileNum').value = "";
	    document.getElementById('fileSize').value = "";
    }


    // Delete everything in web storage
    this.deleteAll = function(){
        if (confirm("WARNING: this will clear ALL storage and cannot be undone!\nDo you still wish to continue?")){
            // Clear viewer
            this.clearView();
            content = new Uint8Array();
            // Clear storage
            localStorage.clear();
            // Clear file select control (file list)
            clearFileList();
            // Clear file index
            fileIndex = [];
        }
    }


    // Hide the storage window
    this.closeStorage = function(){
        var storageobj = document.getElementById('storage');
        storageobj.style.display="none";
    }


    // Read a file from disk into web storage
    function readFile(file, storageobj){

        if (file) {
            var filename = file.name;
            var filenamefield = document.getElementById('fname');
            var freader = new FileReader();
            var viewerobj = document.getElementById('fileViewer');
            filenamefield.innerHTML = filename;

            content = new Uint8Array();

            freader.onload = function(ev) {
                var filecontent = ev.target.result;
	            var fsize = document.getElementById('fileSize');
			    var fnumobj = document.getElementById('fileNum');

//                contentarray = new Uint8Array(filecontent);
//                content = contentarray;
                content = new Uint8Array(filecontent);
                fsize.value = content.length;
			    var flashfileinfo = isFlashFile(filename);  // Sanity check: is it a 405x Flash Drive file?
			    if (flashfileinfo) {
                    fnumobj.value = flashfileinfo[0];
                    updateFileRecord(flashfileinfo);
                    updateCtrlsFromRecord(fnumobj.value);
				    storageobj.saveFile();			    }
                displayInViewer();
		        //console.log(progobj.value);
		        // If a direct upload to the emulator has bene requested
			    // CHECK IF FILE IS a PROGRAM!
/*
		        if (uploadTo4051) {
//			        console.log("Uploading to Tek...");
	                upload_to_tek(str2arraybuf(progobj.value));	// Upload the program to the emulator
		            tek.programLoaded(); // Signal the emulator that the upload is complete
	                uploadTo4051 = 0; // Reset flag
		        }
*/
		        // console.log("Upload done.");
            }
            freader.readAsArrayBuffer(file);    
        }
    }


    // Update the viewer window
    function displayInViewer(){
        var viewerobj = document.getElementById('fileViewer');
        // Clear current content
        viewerobj.value = "";
        // Upload new content
        if (content && content.length > 0) {
            for (var i=0; i<content.length; i++){
                viewerobj.value += String.fromCharCode(content[i]);
            }
        }
    }


    // Handler to import files in 405x Flash Drive format
    function import4924Dir(storageobj){
        var fileobj = document.getElementById('importObj');
        var filelistobj = document.getElementById('fileList');
        var fnumobj = document.getElementById('fileNum');
        var numfiles = fileobj.files.length;
	    var freader = new FileReader();
        var fnumstr = "";

	    storageobj.clearView();

        alert("Importing files....\nIf many files have been selected this may take some time.\nPress OK to start.");

        function readNextFile(idx) {
            if (idx >= numfiles) return;
            var file = fileobj.files[idx];
		    // Get the next file name
    	    var filename = file.name;

		    // File read handler
		    freader.onload = function(ev) {
    		    var filecontent = ev.target.result;
			    content = [];
        	    contentarray = new Uint8Array(filecontent);
        	    content = contentarray;
                var fileinfo = isFlashFile(filename);  // Sanity check - valid 4924 emu file?
//                fnumstr = getFileInfo(filename);
                if (fileinfo){
//console.log("Fileinfo0:" + fileinfo[0]);
//console.log("Fileinfo1:" + fileinfo[1]);
//console.log("Fileinfo2:" + fileinfo[2]);
//console.log("Fileinfo3:" + fileinfo[3]);
//console.log("Fileinfo4:" + fileinfo[4]);
                    // Get the file number and set the F# field
                    fnumobj.value = fileinfo[0];
                    // Update file controls
                    updateCtrlsFromInfo(fileinfo);
                    // Save file to storage (takes file number from F# field, file info from controls)
			        storageobj.saveFile();
                }
                // Select the last imported file and display it
                if (idx == numfiles-1) {
                    for (var i=0; i<filelistobj.options.length; i++) {
                        if (filelistobj.options[i] == fnumobj.value) {
                            filelistobj.selectedIndex = i;
                        }
                    }
//                    console.log("File to display: " + fnumobj.value);
                    displayInViewer();
                    updateCtrlsFromRecord(fnumobj.value);
                }
                readNextFile(idx+1);
		    }
            freader.readAsArrayBuffer(file);
        }
        readNextFile(0);

	    // Finished with importing multiple files
        fileobj.removeAttribute('multiple','');
    }


    // Hadler to restore storage from archive
    function restoreStorage(){
        var file = document.getElementById('importObj').files[0];
        var freader = new FileReader();
        freader.onload = function(ev) {
		    // Get the file contents
            var archive = "";
            archive = ev.target.result;
		    // console.log(archive);

		    // Clear the local storage ready for import
		    localStorage.clear();

		    // Rebuild local storage
		    var storageobj = JSON.parse(archive);
		    for (var key of Object.keys(storageobj)){
			    // console.log("Key: " + key);
			    // console.log(storageobj[key]);
			    localStorage.setItem(key, storageobj[key]);
		    }

		    clearFileList();
		    updateFileList();

		    alert("Restore complete.");
        }
        freader.readAsText(file);
    }


    // Process file dropped onto viewer window
    this.dropHandler = function(ev, storageObj) {
        var file;
        // Prevent default behavior (Prevent file from being opened)
        ev.preventDefault();

        if (ev.dataTransfer.items) {
            // Use DataTransferItemList interface to access the file(s)
            // If dropped items aren't files, reject them
            if (ev.dataTransfer.items[0].kind === 'file') file = ev.dataTransfer.items[0].getAsFile();
        } else {
            // Use DataTransfer interface to access the file(s)
            file = ev.dataTransfer.files[0];
        }
        readFile(file, storageObj);
    }


    // Prevent default dragover action
    this.dragOverHandler = function(event){
        event.preventDefault();
    }


    // Storage import/export options
    this.storageAdm = function(inbound){
        var idx = document.getElementById('importType').selectedIndex;

        if (idx == 0) {
            if (inbound) {
                document.getElementById('importObj').click();
            }else{
                exportFile('file.txt', 'text/plain', false);
            }   
        } else if (idx == 1) {
            if (inbound) {
	            if (confirm("WARNING: This will overwite all current files!")) {
		            document.getElementById('importObj').click();
	            }else{
                    return;
                }
            }else{
                archiveStorage('archive.tape', 'text/plain');
            }   
        } else if (idx == 2) {
            if (inbound) {
	            if (confirm("WARNING: This will overwite all existing files with the same file number!")) {
                    var multifile = document.getElementById('importObj');
                    multifile.setAttribute('multiple','true');
		            multifile.click();
	            }else{
                    return;
                }
            }else{
                export4924();
            }   
	    } else {
            alert("ERROR: shouln't get here!");    
	    }
    }


    // Import handler
    this.importObject = function(storageObj) {
        var idx = document.getElementById('importType').selectedIndex;
        if (idx == 0) {
		    var file = document.getElementById('importObj').files[0];
	        readFile(file, storageObj);
        } else if (idx == 1) {
	        restoreStorage();
        } else if (idx == 2) {
	        import4924Dir(storageObj);
        }
    }


    // File export handler
    function exportFile(filename, contentType) {
        const file = new Blob([content], {type: contentType});
        performExport(filename, file);
    }


    // Storage archive export handler
    function archiveStorage(filename, contentType) {
        var content = JSON.stringify(localStorage);
        const filedata = new Blob([content], {type: contentType});
        performExport(filename, filedata);
    }


    // Handler to export files in 405x Flash Drive format
    function export4924(){
        var filelistobj = document.getElementById('fileList');
        var fnumstr = "";
        var idx = 0;
        var filename;
        var filedata;
        var zip = new JSZip();
        if (filelistobj && filelistobj.length>0) {

            for(var i=0; i<filelistobj.length; i++){
                fnumstr = filelistobj[i].text;
                filename = "";
                if (fnumstr != "999") {
                    content = [];
                    // var filedata = atob(localStorage.getItem(idx));
                    filedata = localStorage.getItem(fnumstr);
                    content = str2uint8Array(filedata);
                    idx = findFileRecord(fnumstr);
                    if (idx>-1) filename = getFilename(fnumstr);
                    if (filename === "") filename = "File-" + fnumstr + ".tek";

                    zip.file(filename, content);

                }
            }

            zip.generateAsync({type:"blob"}).then(function(zipcontent) {
                performExport("4050files.zip", zipcontent);
            });

        }
    }


    // File export handler
    function performExport(filename, filecontent) {
        const exported = document.createElement('a');
        exported.href = URL.createObjectURL(filecontent);
        exported.download = filename;
        exported.click();
        URL.revokeObjectURL(exported.href);
        exported.remove();
    }


    // Show the storage window
    this.showStorageOptions = function(){
        var storage = document.getElementById('storage');
        var idx = "0";
	    clearFileList();
	    updateFileList();
        loadFileIndex();
        storage.style.display="block";
    }


    // Convert string to uint8 array
    function str2uint8Array(str) {
        if (str) {
            var tempArray = new Uint8Array(str.length);
            for (var i=0; i<str.length; i++) {
                tempArray[i] = str.charCodeAt(i);
            }
        }
        return tempArray;
    }


    // Handler to upload program to the Tek emulator
    this.readFromTape = function(idx,type) {
	    // console.log("Read file idx: " + idx);
	    if (idx != '0') {
		    // console.log("Loading from web storage...");
//		    upload_to_tek(str2arraybuf(localStorage.getItem(idx)));
//          var filedata = atob(localStorage.getItem(idx));
            var filedata = localStorage.getItem(idx);
            var tempArray = str2uint8Array(filedata);
            if (tempArray) {
		    	if (type == 'A') upload_to_tek(tempArray.buffer);
		    	if (type == 'B') upload_to_tek_bin(tempArray.buffer);
		    }else{
				// Force Tek error message
		    	upload_to_tek_fail();
		    }
	    }else{
		    var progobj = document.getElementById('fileViewer');
		    progobj.value = "";
		    // Signal we want to upload directly into the emulator
		    uploadTo4051 = 1; 
		    // Trigger the file dialog to let the user choose a file
		    document.getElementById('importFile').click(); 
		    //console.log("Opened file import dialog");
	    }
    }


    // Prepare to save file to "tape" (web storage)
    this.saveToTapeReady = function(){
//console.log("Ready to save file...");
	    var filecontent = document.getElementById('fileViewer');
	    filecontent.value = "";
        content = new Uint8ClampedArray();
        binData = [];
        binDataPtr = 0;
    }


    this.saveToTapeBin = function(pchar) {
        binData.push(pchar);
    }


    this.saveToTapeDone = function(fnumstr,type) {
	    var fnumobj = document.getElementById('fileNum');
        content = Uint8ClampedArray.from(binData);
        displayInViewer();
	    fnumobj.value = fnumstr;
	    if (fnumstr == '0') {
		    exportFile('file.txt', 'text/plain', false);
	    }else{
		    this.saveFile();
            var idx = findFileRecord(fnumstr);
            if (idx<0) {
                fileIndex.push([currentFile,type,'P','N',""]);
            }else{
                fileIndex[idx][1] = type;
                fileIndex[idx][2] = 'P';
            }
            saveFileIndex();
            updateCtrlsFromRecord(currentFile);         
	    }
    }


    // PRINT to a type NEW or ASCII file. Change type NEW to ASCII.
    this.printToFile = function(byte){
        var idx = findFileRecord(currentFile);
//console.log("PRINT: current file: " + currentFile);
//console.log("PRINT: file index: " + idx);
//console.log(String.fromCharCode(byte));
        if (idx > -1) {
            var ftype = fileIndex[idx][1];
            // Print only to files of type NEW or ASCII
            if ( (ftype == "") || (ftype == 'N') || (ftype == 'A') ) {
                if (binDataPtr == 0) binData = [];
                binData.push(byte);
                binDataPtr++;
                // Change type NEW to type ASCII
                if ( (ftype == "") || (ftype == 'N') ) {
                    fileIndex[idx][1] = 'A';
                    fileIndex[idx][2] = 'D';
                    saveFileIndex();
                    updateCtrlsFromRecord(currentFile);
                }
            }
        }
    }


    // WRITE to a type NEW or BINARY file. Change type NEW to BINARY.
    this.writeToFile = function(byte){
        var idx = findFileRecord(currentFile);
//console.log("PRINT: current file: " + currentFile);
//console.log("PRINT: file index: " + idx);
//console.log("Received: " + String.fromCharCode(byte));
        if (idx > -1) {
            var ftype = fileIndex[idx][1];
            // Write only to files of type NEW or ASCII
            if ( (ftype == "") || (ftype == 'N') || (ftype == "B") ) {
                if (binDataPtr == 0) binData = [];
                binData.push(byte);
                binDataPtr++;
                // Change type NEW to type ASCII
                if ( (ftype == "") || (ftype == 'N') ) {
                    fileIndex[idx][1] = 'B';
                    fileIndex[idx][2] = 'D';
                    saveFileIndex();
                    updateCtrlsFromRecord(currentFile);                
                }
            }
        }
    }



    // Character sequence ended with CR. Save the file to storage.
    this.writeToFileDone = function(){
        content = Uint8ClampedArray.from(binData);
        localStorage.setItem(currentFile, String.fromCharCode.apply(null,content));
    }


    // INPUT data from ASCII file
    this.inputFromFile = function(){
        var idx = findFileRecord(currentFile);
        var ftype = fileIndex[idx][1];
//console.log("Fnum: " + currentFile + "  IDX: " + idx + "  Ftype: " + ftype);
        // Read a byte only from files of type ASCII (ASCII data, prog, log or text), or unassigned
        // This will make a NEW or unassigned file ASCII DATA
        if (ftype == 'A') {
            if (binDataPtr < binData.length){
                var byte = binData[binDataPtr];
                binDataPtr++;
                return byte;
            }
        }
        return 0xFF;
    }


    // COPY/INPUT data from a file
    this.copyFromFile = function(){
        var idx = findFileRecord(currentFile);
        var ftype = fileIndex[idx][1];
        // Read a byte only from files of type ASCII (ASCII data, prog, log or text), or unassigned
        // This will make a NEW or unassigned file ASCII DATA
        if (ftype == 'A') {
            var byteval;
            if ( (binDataPtr < binData.length) ){
                byteval = binData[binDataPtr];
                if ( (byteval == copyterm) || (byteval == 0x0D) ) copycnt = copylen;
                if (binDataPtr == binData.length) byteval = 0x01FF;    // End of file
//console.log("Copycnt: " + copycnt);
/*
                if (copycnt == copylen-1){    // Copy length reached
                    byteval = byteval0x1;
                    binDataPtr--;
                    copycnt = 0;
                }else{
                    copycnt++;
                }
*/
                if (copycnt == copylen) {
                    byteval = 0x1FF;
                    copycnt = 0;
                }else{
                    copycnt++;
                }
//console.log("Byte: " + (byteval & 0xFF));
//console.log("EOI: " + (byteval >> 8));
                binDataPtr++;
                return byteval;
            }
        }
        return 0x1FF;
    }


    // READ from BINARY data file
    this.readFromFile = function(){
        var idx = findFileRecord(currentFile);
//console.log("Current filenum: " + currentFile);
//console.log("Index: " + idx);
        var ftype = fileIndex[idx][1];
        var fusage = fileIndex[idx][2];
        // Read a byte only from files of type ASCII (ASCII data, prog, log or text), or unassigned
        // This will make a NEW or unassigned file ASCII DATA
        if ( (ftype == 'B') && (fusage == 'D') ) {
            if ( (binDataPtr < binData.length) && binData.length ){
                var byte = binData[binDataPtr];
                binDataPtr++;
                return byte;
            }
        }
        return 0x1FF;
    }


    // Read from BINARY PROG file
    this.readBinProg = function(){
        var idx = findFileRecord(currentFile);
        if (idx >= 0) {
            var ftype = fileIndex[idx][1];
            var fusage = fileIndex[idx][2];
            if (binData.length && (binData.length>0) ) {
                if (padcnt==0) padcnt = (256 - (binData.length % 256) );
                // Read only from BINARY PROGRAM file
                if ( (ftype == 'B') && (fusage == 'P') ) {
                    var dataval;
                    if (binDataPtr < binData.length) dataval = binData[binDataPtr];
//                if (binDataPtr == binData.length) dataval = 0x01FF;
//                if (binDataPtr == binData.length-1) dataval += 0x100;
                    binDataPtr++;
                    if ( (binDataPtr-1) < binData.length ) {
                        return dataval;
                    }else if ( (binDataPtr-1) == binData.length ){
//                        padcnt--;
                        return 0xFF;
                    }else{
//console.log("Padding required: " + padcnt);
//                        padcnt--;
//                        if (padcnt>0) {
//console.log("Storage sent 0x20.");
                            return 0x20;
//                        }else if (padcnt==0) {
//console.log("Storage sent 0x20 with EOI!");
//                            return 0x120;
//                        }else{
//                            return 0x1FF;
//                        }
                    }
                }
            }
        }
        return 0x01FF;  // Null response with EOI
    }


    // FIND command - select the requested file
    this.findFile = function(fnumstr){
//console.log("Finding requested file: " + fnumstr);
        if (parseInt(fnumstr) > 0 && parseInt(fnumstr) < 255) {
            binDataPtr = 0;
            copycnt = 0;
            selectCurrentFile(fnumstr);
            // File type?
            var ftype = document.getElementById('fileType').value;
            // If file is marked and has content then load it
            if (content && content.length>0) {             
                // File type is ASCII or BINARY program or data (NOT NEW, LAST or unmarked)
//                if ( (ftype == 'A') || (ftype == 'B') ) {
                    binData = Array.from(content);
//                }else{
//                    binData = [];
//                }
            }else{
                // Create an empty array
                binData = [];
            }
        }
    }


    // CLOSE command - close the requested file
    this.closeFile = function(){
//console.log("Closing current file...");
//        if (parseInt(fnumstr) > 0 && parseInt(fnumstr) < 255) {
            var filelistobj = document.getElementById('fileList');
            content = new Uint8ClampedArray();
            binData = [];
            binDataPtr = 0;
            currentFile = "";
            copycnt = 0;
            this.clearView();
            filelistobj.value = "";
//        }
//console.log("Done.");
    }


    // Return the current directory
    this.getDirectory = function() {
        if (dirFnamePtr == directoryName.length) {
            // Reset pointer to beggining of string, send CR
            dirFnamePtr = 0;
            dirFname = "";
            return 0x0D;
        }else{
            // Send byte
            dirFnamePtr++;
            return directoryName.charCodeAt(dirFnamePtr-1);
        }
    }


    // Get the name of the current file and send it to the 4051
    this.getDirEntry = function(){
        var filelistobj = document.getElementById('fileList');
        if (dirFnamePtr == 0) {
            var idx = findFileRecord(currentFile);
            var filename = "";
            var stat = 0;
            // File exists in index
            if (idx > -1) {
                stat++;
                // File is marked
                if ( (fileIndex[idx][1] == "A") || (fileIndex[idx][1] == "B") ) {
                  if (fileIndex[idx][2] != "") stat++;
                }
                if ( (fileIndex[idx][1] == "N") || (fileIndex[idx][1] == "L") ) {
                  stat++;
                }
                // Filename is not blank
                filename = getFilename(currentFile);
                if (filename != "") stat++;
            }
            if (stat == 3) {
                // Valid filename
                dirFname = filename;
                dirFnamePtr++;
                return dirFname.charCodeAt(0);
            }else{
                // No filename - null return
                dirFnamePtr = 0;
                return 0xFF;            
            }
        }else{
            if (dirFnamePtr == dirFname.length) {
                // Reset pointer to beggining of string, send CR
                dirFnamePtr = 0;
                dirFname = "";
                return 0x0D;
            }else{
                // Send byte
                dirFnamePtr++;
                return dirFname.charCodeAt(dirFnamePtr-1);
            }
        }
    }


    this.setDirEntry = function(rbyte){
//        console.log(String.fromCharCode(rbyte));
        if (rbyte == 0x0D) {
//            console.log("Filename: " + dirFname);

            // Valid format for marked file
            if ( fileInfo = isFlashFile(dirFname)) {
                updateFileRecord(fileInfo);
                updateCtrlsFromInfo(fileInfo);
                saveFileIndex();
            }

            // Some process here
            dirFname = "";
            dirFnamePtr = 0;
        }else{
            dirFname += String.fromCharCode(rbyte);
        }
    }


    function fileIndexCount() {
        var i = 0;
        for (i in fileIndex) {
        }
        return i;
    }


    // Select the current file - load file and update controls and index
    function selectCurrentFile(fnumstr){
	    if (fnumstr) {
            content = new Uint8ClampedArray();
            currentFile = fnumstr;  // Set global current file indicator
            var filelistobj = document.getElementById('fileList');
            // Load the file content
//            var filedata = atob(localStorage.getItem(idx));
            var filedata = localStorage.getItem(fnumstr);
            content = str2uint8Array(filedata);
            // Load (refresh) the index (in case it changed)
            loadFileIndex();
            // Update the state of the file controls
            updateCtrlsFromRecord(fnumstr);
            // Set file selector control to current file
            filelistobj.value = fnumstr;
            // Display file description if available
            var fidx = findFileRecord(fnumstr);
            var fnameobj = document.getElementById('fname');
            var fdescobj = document.getElementById('fileDesc');
            if (fidx>-1) {
                var fileinfo = getFileRecord(fidx);
                if (fileinfo[3] == "") {
//console.log("No desc");
                    fnameobj.innerHTML = "No description";
                    fdescobj.value = "";
                }else if ( (fileinfo[3]=='N') || (fileinfo[3]=='S') ) {   // Temp to deal with Secret
//console.log("Secret");updateCtrlsFromInfo(fileinfo)
                    if (fileinfo[4] == "") {
//console.log("Secret-no fname");
                        fnameobj.innerHTML = "No description";
                        fdescobj.value = "";
                    }else{
//console.log("Fname present");
                        fnameobj.innerHTML = getFilename(fileinfo[0]);
                        fdescobj.value = getFileDescription(fileinfo[4]);
                    }
                }else if ( (fileinfo[1]=='') || (fileinfo[2]=='') ){
                    if ( (fileinfo[1]=='N') || (fileinfo[1]=='L') ) {
                        if (fileinfo[1]=='N') fnameobj.innerHTML = "NEW";
                        if (fileinfo[1]=='L') fnameobj.innerHTML = "LAST";
                        fdescobj.value = "";
                    }else{
//console.log("Not marked");
                        fnameobj.innerHTML = "File not marked!";
                        fdescobj.value = fileinfo[3];
                    }
                }else{
//console.log("Other");
                    fnameobj.innerHTML = getFilename(fileinfo[0]);
                    fdescobj.value = fileinfo[3];
                }
            }else{  // No record available
                fnameobj.innerHTML = "No description";
                fdescobj.value = "";
            }
            // Display content in viewer
            displayInViewer();
        }
    }


    // Clear the file select control
    function clearFileList() {
	    var filelistobj = document.getElementById('fileList');
        if (filelistobj) var listlen = filelistobj.length;
	    while(listlen--){
		    filelistobj.remove(listlen);
//            listlen--;
	    }
    }


    // Update the file select control
    function updateFileList() {
	    var filelist = Object.keys(localStorage).sort(function(a,b){return a - b});
	    var filelistobj = document.getElementById('fileList');
	    // Create file list
	    for (var i=0; i<filelist.length; i++) {
            if (filelist[i]!="999") {
		        var opt = document.createElement('option');
		        opt.textContent = filelist[i];
		        opt.value = filelist[i];
		        filelistobj.appendChild(opt);
            }
	    }
	    // Delselect any selected option
	    filelistobj.selectedIndex = -1;
    }


    this.changeType = function(){
	    var filenumstr = getCurrentFileNum();
//console.log("File index before: " + fileIndex);
	    if (filenumstr) {
		    // Get the type setting
		    var typeobj = document.getElementById('fileType');
		    var type = typeobj.options[typeobj.selectedIndex].value;
		    // Attempt to find the relevant record
		    var idx = findFileRecord(filenumstr);
		    // If no record then create one otherwise update
		    if (idx<0) {
			    fileIndex.push([filenumstr,type,'N',"",""]);
		    }else{
			    fileIndex[idx][1] = type;
		    }
	    }
//        console.log("File index change: " + fileIndex);
    }


    this.changeUsage = function(){
	    var filenumstr = getCurrentFileNum();
	    if (filenumstr) {
		    // Attempt to find the relevant record
		    var idx = findFileRecord(filenumstr);
		    // Get the type setting
		    var usageobj = document.getElementById('fileUsage');
		    var usage = usageobj.options[usageobj.selectedIndex].value;
		    // If no record then create one otherwise update
		    if (idx<0) {
			    fileIndex.push([filenumstr,'N',usage,"",""]);
		    }else{
			    fileIndex[idx][2] = usage;
		    }
	    }
//        console.log("File index change: " + fileIndex);
    }


    // Returns the file number currently selected in the Select drop down
    function getCurrentFileNum(){
	    var listobj = document.getElementById('fileList');
	    if (listobj.selectedIndex>-1) {
		    var filenum = listobj.options[listobj.selectedIndex].text;
		    return filenum;
	    }
	    return "";
    }


    // Finds the index of the file record given a file number
    // Not found returns -1
    function findFileRecord(fnumstr){
	    // Find record or return -1 if not found
	    var idx = -1;
        if (fileIndex) {
	        for (var i=0; i<fileIndex.length; i++) {
		        if (fileIndex[i][0]==fnumstr){
		    	    idx = i;
			        break;
		        }
	        }
        }
	    return idx;
    }


    // Save file index to storage
    function saveFileIndex() {
        var stringified = "";
	    var cnt;
        if (fileIndex) {
            fileIndex.forEach((record, i, array) => {
			    stringified += record;
			    if (i < (array.length-1)) stringified += ':';
		    });
        }
        localStorage.setItem("999", stringified);
    }


    // Retrieve file index from storage
    function loadFileIndex() {
        var record = [];
        var index = [];
        var raw = [];
        stringified = localStorage.getItem("999");
        if (stringified) {
		    raw = stringified.split(':');
    	    raw.forEach(item => { record = item.split(','); index.push(record)});
    	    fileIndex = index;
	    }
    }


    // Update file info controls from index
    function updateCtrlsFromInfo(fileinfo) {
        var ftype = document.getElementById('fileType');
        var fusage = document.getElementById('fileUsage');
        var fdesc = document.getElementById('fileDesc');
	    var fsize = document.getElementById('fileSize');
        ftype.value = fileinfo[1];
        fusage.value = fileinfo[2];
        fdesc.value = fileinfo[3];
        if (content && content.length > 0) {
            fsize.value = content.length;
        }else{
            fsize.value = "";
        }
    }



    // Update file info controls from index
    function updateCtrlsFromRecord(fnumstr) {
        var ftype = document.getElementById('fileType');
        var fusage = document.getElementById('fileUsage');
        var fdesc = document.getElementById('fileDesc');
	    var fsize = document.getElementById('fileSize');
        ftype.value = '';
        fusage.value = '';
        if (fileIndex) {
            dirLength = fileIndex.length;
            var idx = findFileRecord(fnumstr);
            if (idx>-1) {
                if (fileIndex[idx][1]) ftype.value = fileIndex[idx][1];
                if (fileIndex[idx][2]) fusage.value = fileIndex[idx][2];
                if (fileIndex[idx][3]) fdesc.value = fileIndex[idx][3];
            }
        }
        if (content && content.length > 0) {
            fsize.value = content.length;
        }else{
            fsize.value = "";
        }
    }


    // Get file information from 405x Flash Drive filename
    // Returns file number for valid flash file, otherwise NULL
    function isFlashFile(filename){
//	    console.log("Filename: " + filename);
	    var fnum = parseInt(filename.substring(0,6));
	    if (isNaN(fnum)) return null;
	    var ftype = filename.charAt(7);
	    if (!isFileTypeValid(ftype)) return null;
	    var fusage = filename.charAt(15);
	    if (!isFileUsageValid(fusage)) return null;
        var fdesc = getFileDescription(filename);

        var fileinfo = [fnum, ftype, fusage, fdesc, filename];
        return fileinfo;
    }


    // Update the file record from given parameters
    // Record is updated if present or created if not
    function updateFileRecord(fileinfo){
        var idx = findFileRecord(fileinfo[0]);
        if (idx>-1) {
            // Record already exists so update
            fileIndex[idx][1] = fileinfo[1];    // File type
            fileIndex[idx][2] = fileinfo[2];    // File usage
            fileIndex[idx][3] = fileinfo[3];    // File description
            fileIndex[idx][4] = fileinfo[4];    // File full name
        }else{
            // Create a new record
	        fileIndex.push(fileinfo);
        }
    }


    // Updates file record from the status of the controls
    function updateRecordFromControls(fnum) {
        var ftype = document.getElementById('fileType').value;
        var fusage = document.getElementById('fileUsage').value;
        var fdesc = document.getElementById('fileDesc').value;
        var idx = findFileRecord(currentFile);

        if (idx>-1) {
            // Update the existing record
            fileIndex[idx][1] = ftype;
            fileIndex[idx][2] = fusage;
            fileIndex[idx][3] = fdesc;
        }else{
            // Create a new record
            var fileinfo = [fnum, ftype, fusage, fdesc, ""];
            fileIndex.push(fileinfo);
        }
    }


    // Get the file record for the given index number
    function getFileRecord(idx) {
        return fileIndex[idx];
    }


    // Checks whether file TYPE is valid
    function isFileTypeValid(ftype){
//    console.log("File type: " + ftype);
	    for (var i=0; i<fileTypes.length; i++){
		    if (fileTypes[i].idx == ftype) break;
	    }
	    if (i < fileTypes.length) return true;
	    return false;
    }


    // Checks whether file USAGE is valid
    function isFileUsageValid(fusage){
	    for (var i in fileUsages){
		    if (fileUsages[i].idx == fusage) break;
	    }
	    if (i < fileUsages.length) return true;
	    return false;
    }


    // Get or construct file name from the file information in the index
    function getFilename(fnumstr) {
	    var idx = findFileRecord(fnumstr);
        var filename = "";
        var desclen = fileLength - 30;

	    if (idx > -1) {

		    var fnum = fileIndex[idx][0];
		    var ftype = "";
		    for (var i=0; i<fileTypes.length; i++){
			    if (fileTypes[i].idx == fileIndex[idx][1]) ftype = fileTypes[i].type;
		    }

		    var fusage = "";
		    for (var i=0; i<fileUsages.length; i++){
			    if (fileUsages[i].idx == fileIndex[idx][2]) fusage = fileUsages[i].usage;
		    }

		    var fdesc = "";
	        if ( (fileIndex[idx][3] == "") && (fileIndex[idx][4] = "") ) {
                fdesc = "";
            }else{
            	if (fileIndex[idx][3] == "") {
                	fdesc = getFileDescription(fileIndex[idx][4]);
               	}else{
               		fdesc = fileIndex[idx][3];
               	}
            }
            var fsizestr = 0;
            // Check if item has content in store
		    var storfile = localStorage.getItem(fnumstr);
            // If so get the content length
            if (storfile) fsizestr = storfile.length.toString();
            // Construct filename
            filename = fnum.padEnd(7) + ftype.padEnd(8) + fusage.padEnd(5) + fdesc.padEnd(desclen) + ' ' + fsizestr;
	    }

	    return filename;

    }


    // Extracts the file description from the file name
    function getFileDescription(filename) {
        var ch = '';
        var desc = "";
        var depos = getLastSpacePos(filename);
        var desclength = fileLength - 30;   // 30 = fnum[7] + ftype[8] + fusage[5] + fsize[7] + CR + NULL

        // Extract description
        for (var i=20; i<depos; i++) {
            ch = filename.charAt(i);
            if ( (ch != '[') && (ch != ']') ) {
                desc = desc + ch;
            }
        }

        // Truncate to 13 characters, pad if required
        desc = desc.substr(0,desclength);
        desc = desc.padEnd(desclength);
        return desc;
    }


    // Update the file size parameter
    function updateFileSize(fnumstr, filename){
        var depos = getLastSpacePos(filename);
        var fname = filename.substring(0, depos);
        var fsizestr = localStorage.getItem(fnumstr).length.toString();
        fname = fname + fsizestr;
        return fname;
    }


    // Determine the position of the final space (start of file size)
    function getLastSpacePos(filename) {
        var lspos = filename.length;
        var ch = '';
        while ( (ch != ' ') && (lspos > 0) ) {
            ch = filename.charAt(lspos);
            lspos--;
        } 
        return lspos;
    }

    // Limit the length of the file description
    this.fdLimit = function() {
        var ftype = document.getElementById('fileType').value;
        var fdescobj = document.getElementById('fileDesc');

        if ( (ftype=='') || (ftype=='L') ) {
            fdescobj.value = "";    // Can't name a LAST or NEW file
            return true;
        }

        var desclen = fileLength - 30;
        var fdesc = fdescobj.value;

        if (fdesc.length >= desclen) {
            fdesc = fdesc.substr(0, desclen);
            fdescobj.value = fdesc;
        }
    }


    // Temporary function to rename key 'IDX' to '999'
	function renameIdxKey(){
		var IDXitem = "";
		if (IDXitem = localStorage.getItem("IDX")) {
			localStorage.setItem("999", IDXitem);
			localStorage.removeItem("IDX");
			loadFileIndex();
    		updateFileList();
		}
	}


    // get the next available free file number
    function getNextAvailableFnum(){
        var filelistobj = document.getElementById('fileList');
        var keylist = [];
        for (var i=0; i<filelistobj.length; i++){
            keylist.push(filelistobj.options[i].value);
        }
        keylist = keylist.sort(function(a,b){return a - b});
        for (var i=0; i<255; i++){
//console.log("Key: " + parseInt(keylist[i]) + "  I: " + i);
            if (parseInt(keylist[i]) != (i+1)) return i+1;
        }
        return null;
    }


}	// End function Storage



function getFnameTest(fnumstr){
	var fname = getFilename(fnumstr);
//	console.log("Filename: " + fname);
}
