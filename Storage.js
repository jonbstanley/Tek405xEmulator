// Tek 4050 Emulator Storage Script
// 07-10-2021


var uploadTo4051 = 0;
var fileIndex = [];
var content = new Uint8Array();
var program = "";

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

function saveFile(){
    var fnumstr = document.getElementById('fileNum').value;
	var filelistobj = document.getElementById('fileList');
	if (fnumstr) {
        if (localStorage.getItem(fnumstr)) {
            if (confirm("Overwrite existing file?")){
//		        localStorage.setItem(fnumstr, btoa(String.fromCharCode.apply(null,content)));
		        localStorage.setItem(fnumstr, String.fromCharCode.apply(null,content));
            }else{
                return;
            }
        }else{
//            localStorage.setItem(fnumstr, btoa(String.fromCharCode.apply(null,content)));
            localStorage.setItem(fnumstr, String.fromCharCode.apply(null,content));
        }
        saveFileIndex();
		clearFileList();
		updateFileList();
		filelistobj.value = fnumstr;
//		updateFileInfoCtrls(fnumstr);
	}else{
		alert("File number required!");
	}
}


function loadFile(){
    var filenumobj = document.getElementById('fileNum');
	var filelistobj = document.getElementById('fileList');
	var fnumstr = filelistobj.options[filelistobj.selectedIndex].text;
	var fsize = document.getElementById('fileSize');
	filenumobj.value = fnumstr;
console.log("File to display: " + fnumstr);
	if (fnumstr) {
        content = [];
//        var filedata = atob(localStorage.getItem(idx));
        var filedata = localStorage.getItem(fnumstr);
        content = str2uint8Array(filedata);
        loadFileIndex();
        updateFileInfoCtrls(fnumstr);
//        fsize.value = content.length;
        displayInViewer();
	}else{
		alert("File number required!");
	}
}


function deleteFile(){
    var filenumobj = document.getElementById('fileNum');
	var filelistobj = document.getElementById('fileList');
	var fnumstr = filelistobj.options[filelistobj.selectedIndex].text;
	if (fnumstr != '') {
        if (localStorage.getItem(fnumstr)) {
            if (confirm("Delete existing file?")){
                // Delete file
		        viewerobj = document.getElementById('fileViewer');
		        viewerobj.value = "";
				clearFileList();
                content = [];
                localStorage.removeItem(fnumstr);
				updateFileList();
				filenumobj.value = '';
                clearIndexEntry(fnumstr);
                saveFileIndex();
            }
        }else{
            alert("Nothing to delete!");
        }
	}else{
		alert("Select a file number to delete!");
	}
}


function selectFile(){
    var filecontent = document.getElementById('fileViewer').value;
    upload_to_tek(str2arraybuf(filecontent));
	closeStorage();
}


// Clear index entries
function clearIndexEntry(fnumstr){
console.log("Clearing file from index:" + fnumstr);
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
function clearFile(){
    var filenumobj = document.getElementById('fileNum');
    var fileobj = document.getElementById('fileViewer');
	var filename = document.getElementById('fname');
    var fnumstr = filenumobj.value;
    // Clear storage page
	filenumobj.value = "";
	fileobj.value = "";
    content = [];
    filename.innerHTML = "Drop a file to this window";
}


function clearAll(){
    if (confirm("WARNING: this will clear ALL storage and cannot be undone!\nDo you still wish to continue?")){
        // Clear viewer
        clearFile();
        content = [];
        // Clear storage
        localStorage.clear();
        // Clear file select control (file list)
        clearFileList()
        // Clear file index
        listIndex = [];
    }
}


function closeStorage(){
    var storageobj = document.getElementById('storage');
    storageobj.style.display="none";
}


// Read a file from disk into storage
function readFile(file){
    if (file) {
        var filename = file.name;
        var filenamefield = document.getElementById('fname');
        var freader = new FileReader();
        var viewerobj = document.getElementById('fileViewer');
        filenamefield.innerHTML = filename;

        content = [];
        console.log("File length1: " + content.length);

        freader.onload = function(ev) {
            var filecontent = ev.target.result;
	        var fsize = document.getElementById('fileSize');
			var fnumobj = document.getElementById('fileNum');

//            viewerobj.value = ev.target.result;
            contentarray = new Uint8Array(filecontent);
            content = contentarray;
            fsize.value = content.length;
			fnumobj.value = getFileInfo(filename);  // Sanity check: is it a 4924 emu file?
			if (fnumobj.value != "") {
//				updateFileInfo(fnumstr);
//				updateFileInfoCtrls(fnumobj.value);
				saveFile();
                updateFileInfoCtrls(fnumobj.value);
			}
            displayInViewer();
		    //console.log(progobj.value);
		    // If a direct upload to the emulator has bene requested
			// CHECK IF FILE IS a PROGRAM!
/*
		    if (uploadTo4051) {
			    console.log("Uploading to Tek...");
	            upload_to_tek(str2arraybuf(progobj.value));	// Upload the program to the emulator
		        tek.programLoaded(); // Signal the emulator that the upload is complete
	            uploadTo4051 = 0; // Reset flag
		    }
*/
		    // console.log("Upload done.");
        }
//        freader.readAsText(file);
        freader.readAsArrayBuffer(file);    
    }
}


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


function import4924Dir(){
    var fileobj = document.getElementById('importObj');
    var filelistobj = document.getElementById('fileList');
    var fnumobj = document.getElementById('fileNum');
    var numfiles = fileobj.files.length;
	var freader = new FileReader();
    var fnumstr = "";

	clearFile();

    function readFile(idx) {
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
            fnumstr = getFileInfo(filename);    // Sanity check - valid 4924 emu file?
            if (fnumstr != "") {
                fnumobj.value = fnumstr;
			    saveFile();
            }
            if (idx == numfiles-1) {
                for (var i=0; i<filelistobj.options.length; i++) {
                    if (filelistobj.options[i] == fnumobj.value) {
                        filelistobj.selectedIndex = i;
                    }
                }
                console.log("File to display: " + fnumobj.value);
                displayInViewer();
                updateFileInfoCtrls(fnumobj.value);
            }
            readFile(idx+1);
		}
        freader.readAsArrayBuffer(file);
    }
    readFile(0);

	// Finished with importing multiple files
    fileobj.removeAttribute('multiple','');

}


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


function dropHandler(ev) {
  console.log('File(s) dropped');

  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();

//  if (ev.dataTransfer.items) {
    // Use DataTransferItemList interface to access the file(s)
//    for (var i = 0; i < ev.dataTransfer.items.length; i++) {
      // If dropped items aren't files, reject them
//      if (ev.dataTransfer.items[i].kind === 'file') {
//        var file = ev.dataTransfer.items[i].getAsFile();
//        var program = document.getElementById('fileViewer');
//        console.log('... file[' + i + '].name = ' + file.name);
        
//        program.value = ev.dataTransfer.getData();
//      }
//    }
//  } else {
    // Use DataTransfer interface to access the file(s)
//    for (var i = 0; i < ev.dataTransfer.files.length; i++) {
    var file = ev.dataTransfer.files[0];
    readFile(file);
}


function dragOverHandler(event){
    event.preventDefault();
}


function storageAdm(inbound){
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
//            console.log("Import 4924 emulator directory...");
	        if (confirm("WARNING: This will overwite all current files!")) {
                var multifile = document.getElementById('importObj');
                multifile.setAttribute('multiple','true');
		        multifile.click();
	        }else{
                return;
            }
        }else{
            console.log("Export 4924 emulator directory...");
            export4924();
        }   
	} else {
        alert("ERROR: shouln't get here!");    
	}
    
}


function importObject() {
    var idx = document.getElementById('importType').selectedIndex;
    if (idx == 0) {
		var file = document.getElementById('importObj').files[0];
	    readFile(file);
    } else if (idx == 1) {
	    restoreStorage();
    } else if (idx == 2) {
	    import4924Dir();
    }
}


function exportFile(filename, contentType, mode) {
    // Mode: false = single file; true = multiple files;
//    var content = document.getElementById('fileViewer').value;
console.log("Started export of file: " + filename);
//    var ename = "a";
//    if (idx !== 0) ename = ename + idx.toString();
    const exported = document.createElement('a');
//    const exported = document.createElement(ename);
    const file = new Blob([content], {type: contentType});
  
    exported.href = URL.createObjectURL(file);
    exported.download = filename;
    exported.click();

    URL.revokeObjectURL(exported.href);
    if (mode) {
        return exported;
    }else{
        exported.remove();
    }
console.log("Done export of file: " + filename);
}


function archiveStorage(filename, contentType) {
    var content = JSON.stringify(localStorage);
    const exported = document.createElement('a');
    const file = new Blob([content], {type: contentType});
  
    exported.href = URL.createObjectURL(file);
    exported.download = filename;
    exported.click();

    URL.revokeObjectURL(exported.href);
    exported.remove();
}


function export4924(){
    var filelistobj = document.getElementById('fileList');
    var fnumstr = "";
    var idx = 0;
    var filename;
    var filedata;
    var exported;
    if (filelistobj && filelistobj.length>0) {
        for(var i=0; i<filelistobj.length; i++){
            fnumstr = filelistobj[i].text;
            filename = "";
            if (fnumstr != "IDX") {
                content = [];
                // var filedata = atob(localStorage.getItem(idx));
                filedata = localStorage.getItem(fnumstr);
                content = str2uint8Array(filedata);
                idx = findFileRecord(fnumstr);
                if (idx>-1) filename = getFilename(fnumstr);
                if (filename === "") filename = "File-" + fnumstr + ".tek";
                exported = exportFile(filename, 'application/octet-stream', true);                             
            }
        }
        exported.remove();
    }
}


function showStorageOptions(){
    var storage = document.getElementById('storage');
    var idx = "0";
	clearFileList();
	updateFileList();
    loadFileIndex();
    storage.style.display="block";
}


//function str2arraybuf(str) {
//  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
//  var bufView = new Uint16Array(buf);
//  for (var i=0, strLen=str.length; i<strLen; i++) {
//    bufView[i] = str.charCodeAt(i);
//  }
//  return buf;
//}


function str2uint8Array(str) {
    if (str) {
        var tempArray = new Uint8Array(str.length);
        for (var i=0; i<str.length; i++) {
            tempArray[i] = str.charCodeAt(i);
        }
    }
    return tempArray;
}



function readFromTape(idx) {
	// console.log("Read file idx: " + idx);
	if (idx != '0') {
		// console.log("Loading from web storage...");
//		upload_to_tek(str2arraybuf(localStorage.getItem(idx)));
//        var filedata = atob(localStorage.getItem(idx));
        var filedata = localStorage.getItem(idx);
        var tempArray = str2uint8Array(filedata);
		upload_to_tek(tempArray.buffer);
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


function saveToTapeReady(){
	var filecontent = document.getElementById('fileViewer');
	filecontent.value = "";
    program = "";
    content = [];
}


function saveToTapeBU(pchar) {
	var progobj = document.getElementById('fileViewer');
	//console.log(String.fromCharCode(pchar));

	if (pchar == 0x0D) {
		// Store CR as CR
		progobj.value += String.fromCharCode(pchar);
	}else if (pchar < 0x20) {
		// Store control characters preceded with backspace+underscore and adjusted value
		progobj.value += String.fromCharCode(0x10);
		progobj.value += String.fromCharCode(0x5F);
       	progobj.value += String.fromCharCode(pchar + 0x40);
	}else{
		// Store character
		progobj.value += String.fromCharCode(pchar);
	}
}


function saveToTapeBS(pchar) {
	var progobj = document.getElementById('fileViewer');
	//console.log(String.fromCharCode(pchar));
	if (pchar == 0x0D) {
		// Store CR as CR
		program += String.fromCharCode(pchar);
	}else if (pchar < 0x20) {
		// Store control characters preceded with backslash and adjusted value
		program += String.fromCharCode(0x5C);
       	program += String.fromCharCode(pchar + 0x40);
	}else{
		// Store character
		program += String.fromCharCode(pchar);
	}
}


function saveToTapeDone(idx) {
	var fileobj = document.getElementById('fileViewer');
	var fnumobj = document.getElementById('fileNum');

    fileobj.value = program;
    content = [];
    content = str2uint8Array(program);

console.log("Program: " + program);
console.log("Prog array: " + content);

	fnumobj.value = idx;
	if (idx == '0') {
		exportFile('file.txt', 'text/plain', false);
        exported.remove();
	}else{
		saveFile();
	}
}


// Clear the file select control
function clearFileList() {
	var filelistobj = document.getElementById('fileList');
    if (filelistobj) var listlen = filelistobj.length;
	while(listlen--){
		filelistobj.remove(listlen);
//        listlen--;
	}
}


// Update the file select control
function updateFileList(idx) {
	var filelist = Object.keys(localStorage).sort(function(a,b){return a - b});
	var filelistobj = document.getElementById('fileList');

	// Create file list
	for (var i=0; i<filelist.length; i++) {
        if (filelist[i]!="IDX") {
		    var opt = document.createElement('option');
		    opt.textContent = filelist[i];
		    opt.value = filelist[i];
		    filelistobj.appendChild(opt);
        }
	}

	// Delselect any selected option
	filelistobj.selectedIndex = -1;
}


function changeType(){
	var filenumstr = getCurrentFileNum();
console.log("File index before: " + fileIndex);
	if (filenumstr) {
		// Get the type setting
		var typeobj = document.getElementById('fileType');
		var type = typeobj.options[typeobj.selectedIndex].value;
		// Attempt to find the relevant record
		var idx = findFileRecord(filenumstr);
		// If no record then create one otherwise update
		if (idx<0) {
			fileIndex.push([filenumstr,type,'N','N',""]);
		}else{
			fileIndex[idx][1] = type;
		}
	}
    console.log("File index change: " + fileIndex);
}


function changeUsage(){
	var filenumstr = getCurrentFileNum();
	if (filenumstr) {
		// Attempt to find the relevant record
		var idx = findFileRecord(filenumstr);
		// Get the type setting
		var usageobj = document.getElementById('fileUsage');
		var usage = usageobj.options[usageobj.selectedIndex].value;
		// If no record then create one otherwise update
		if (idx<0) {
			fileIndex.push([filenumstr,'N',usage,'N',""]);
		}else{
			fileIndex[idx][2] = usage;
		}
	}
    console.log("File index change: " + fileIndex);
}


function toggleSecret(){
	var filenumstr = getCurrentFileNum();
	if (filenumstr) {
		// Attempt to find the relevant record
		var idx = findFileRecord(filenumstr);
		// Get the type setting
		var secretobj = document.getElementById('fileSecret');
		var secret = secretobj.options[secretobj.selectedIndex].text;
		// If no record then create one otherwise update
		if (idx<0) {
			fileIndex.push([filenumstr,'N','N',secret,""]);
		}else{
			fileIndex[idx][3] = secret;
		}
	}
    console.log("File index change: " + fileIndex);
}


// Get the currently selected file number
function getCurrentFileNum(){
	var listobj = document.getElementById('fileList');
	if (listobj.selectedIndex>-1) {
		var filenum = listobj.options[listobj.selectedIndex].text;
		return filenum;
	}
	return "";
}


// Find a record for the file in the index
// Not found returns -1
function findFileRecord(filenumstr){
	// Find record or return -1 if not found
	var idx = -1;
    if (fileIndex) {
	    for (var i=0; i<fileIndex.length; i++) {
		    if (fileIndex[i][0]==filenumstr){
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
    localStorage.setItem("IDX", stringified);
}


// Retrieve file index from storage
function loadFileIndex() {
    var record = [];
    var index = [];
    var raw = [];
    stringified = localStorage.getItem("IDX");
    if (stringified) {
		raw = stringified.split(':');
    	raw.forEach(item => { record = item.split(','); index.push(record)});
    	fileIndex = index;
		console.log("Final index: " + fileIndex);
	}
}


// Update file info controls from index
function updateFileInfoCtrls(fnumstr) {
    var ftype = document.getElementById('fileType');
    var fusage = document.getElementById('fileUsage');
    var fsecret = document.getElementById('fileSecret');
	var fsize = document.getElementById('fileSize');
    ftype.value = '';
    fusage.value = '';
    fsecret.value = 'N';
    if (fileIndex) {
        var idx = findFileRecord(fnumstr);
        if (idx>-1) {
            if (fileIndex[idx][1]) ftype.value = fileIndex[idx][1];
            if (fileIndex[idx][2]) fusage.value = fileIndex[idx][2];
            if (fileIndex[idx][3]) {
                if (fileIndex[idx][3] === 'S') fsecret.value = 'S';
            }
        }
    }
    var fsize = document.getElementById('fileSize');
    if (content && content.length > 0) {
        fsize.value = content.length;
    }else{
        fsize.value = "";
    }
}


// Get file information from 4924 emulator filename
function getFileInfo(filename){
	var finfo = [];
	console.log("Filename: " + filename);
	var fnum = parseInt(filename.substring(0,6));
	if (isNaN(fnum)) return null;
	var ftype = filename.charAt(7);
	if (!isFileTypeValid(ftype)) return null;
	var fusage = filename.charAt(15);
	if (!isFileUsageValid(fusage)) return null;
	var fsecret = filename.charAt(32);
	if (fsecret != 'S') fsecret = 'N';

    var idx = findFileRecord(fnum);

    if (idx>-1) {
        // Update existing record
        fileIndex[idx][1] = ftype;
        fileIndex[idx][2] = fusage;
        fileIndex[idx][3] = fsecret;
        fileIndex[idx][4] = filename;
    }else{
        // Create a new record
	    finfo = [fnum, ftype, fusage, fsecret, filename];
	    fileIndex.push(finfo);
    }

//	console.log("File size: " + fnum);
//	console.log("File type: " + ftype);
//	console.log("File usage: " + fusage);
//	console.log("File secret: " + fsecret);
//	console.log("File name: " + filename);

//	console.log("File index: " + fileIndex);

	return fnum;
}


// Checks whether file TYPE is valid
function isFileTypeValid(ftype){
console.log("File type: " + ftype);
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
	if (idx > -1) {
		if (fileIndex[idx][4] != "") {
            filename = fileIndex[idx][4];
            filename = updateFileSize(filename);
            return filename;
        }

		var fnum = fileIndex[idx][0];

		var ftype = "";
		for (var i=0; i<fileTypes.length; i++){
			if (fileTypes[i].idx == fileIndex[idx][1]) ftype = fileTypes[i].type;
		}

		var fusage = "";
		for (var i=0; i<fileUsages.length; i++){
			if (fileUsages[i].idx == fileIndex[idx][2]) fusage = fileUsages[i].usage;
		}

        var fsecret = fileIndex[idx][3];
        if (fsecret === 'N') fsecret = ' ';

		var fsize = localStorage.getItem(fnumstr).length.toString();

		filename = fnum.padEnd(7) + ftype.padEnd(8) + fusage.padEnd(17) + fsecret + fsize.padStart(6);

	}

	return filename;

}


// Update the file size parameter
function updateFileSize(filename){
    var fname = filename.substring(0, 33);
    var fsize = 0;
    if (content) fsize = content.length;
    var fsizestr = fsize.toString().padStart(6);
    fname = fname + fsizestr;
    return fname;
}


function getFnameTest(fnumstr){
	var fname = getFilename(fnumstr);
	console.log("Filename: " + fname);
}
