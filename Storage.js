// Storage test script

var uploadTo4051 = 0;
var fileIndex = [];
var content = new Uint8Array();
var program = "";


function saveFile(){
    var idx = document.getElementById('fileNum').value;
	var filelistobj = document.getElementById('fileList');
	if (idx) {
        if (localStorage.getItem(idx)) {
            if (confirm("Overwrite existing file?")){
//		        localStorage.setItem(idx, btoa(String.fromCharCode.apply(null,content)));
		        localStorage.setItem(idx, String.fromCharCode.apply(null,content));
            }else{
                return;
            }
        }else{
//            localStorage.setItem(idx, btoa(String.fromCharCode.apply(null,content)));
            localStorage.setItem(idx, String.fromCharCode.apply(null,content));
        }
		clearFileList();
		updateFileList();
		filelistobj.value = idx;
	}else{
		alert("File number required!");
	}
}


function loadFile(){
    var filenumobj = document.getElementById('fileNum');
	var filelistobj = document.getElementById('fileList');
	var idx = filelistobj.options[filelistobj.selectedIndex].text;
	filenumobj.value = idx;
	if (idx) {
        content = [];
//        var filedata = atob(localStorage.getItem(idx));
        var filedata = localStorage.getItem(idx);
        content = base64ToArray(filedata);
        displayInViewer();
	}else{
		alert("File number required!");
	}
}


function base64ToArray(base64str){
    tempArray = new Uint8Array(base64str.length);
    for (var i=0; i<base64str.length; i++){
        tempArray[i] = base64str.charCodeAt(i);
    }
    return tempArray;
}


function deleteFile(){
    var filenumobj = document.getElementById('fileNum');
	var filelistobj = document.getElementById('fileList');
	var idx = filelistobj.options[filelistobj.selectedIndex].text;
	if (idx != '') {
        if (localStorage.getItem(idx)) {
            if (confirm("Delete existing file?")){
		        viewerobj = document.getElementById('fileViewer');
		        viewerobj.value = "";
				clearFileList();
                content = [];
                localStorage.removeItem(idx);
				updateFileList();
				filenumobj.value = '';
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


function clearFile(){
    var filenumobj = document.getElementById('fileNum');
    var fileobj = document.getElementById('fileViewer');
	var filename = document.getElementById('fname');
	filenumobj.value = "";
	fileobj.value = "";
    content = [];
    filename.innerHTML = "Drop a file to this window";
}


function closeStorage(){
    var storageobj = document.getElementById('storage');
    storageobj.style.display="none";
}


function readFile(file){
    if (file) {
        var filename = file.name;
        var filenamefield = document.getElementById('fname');
        var freader = new FileReader();
        var viewerobj = document.getElementById('fileViewer');
        filenamefield.innerHTML = filename;

        content.length = 0;
        console.log("File length1: " + content.length);

        freader.onload = function(ev) {
            var filecontent = ev.target.result;
//            viewerobj.value = ev.target.result;
            contentarray = new Uint8Array(filecontent);
            content = contentarray;
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
    for (var i=0; i<content.length; i++){
        viewerobj.value += String.fromCharCode(content[i]);
    }
}


function import4924Dir(){
    var fileobj = document.getElementById('importObj');
    var len = fileobj.files.length;

console.log("Importing directory...");

console.log("Number of files: " + len);

    for (var i=0; i<len; i++) {
        var filename = fileobj.files[i].name;
        console.log(filename);
    }

    fileobj.removeAttribute('multiple','');


//    var filename = file.name;
//    var filenamefield = document.getElementById('fname');
//    var freader = new FileReader();
//    filenamefield.innerHTML = filename;
//    freader.onload = function(ev) {
//        var progobj = document.getElementById('fileViewer');
//        progobj.value = ev.target.result;
//		//console.log(progobj.value);
//    }
//    freader.readAsText(file);
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
            exportFile('file.txt', 'text/plain');
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
            alert("Import 4924 emulator directory");
	        if (confirm("WARNING: This will overwite all current files!")) {
                var multifile = document.getElementById('importObj');
                multifile.setAttribute('multiple','true');
		        multifile.click();
	        }else{
                return;
            }
        }else{
            alert("Export 4924 emulator directory");
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


function exportFile(filename, contentType) {
//    var content = document.getElementById('fileViewer').value;
    const exported = document.createElement('a');
    const file = new Blob([content], {type: contentType});
  
    exported.href= URL.createObjectURL(file);
    exported.download = filename;
    exported.click();

    URL.revokeObjectURL(exported.href);
    exported.remove();
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


function importFrom4924(filelist){
}


function showStorageOptions(){
    var storage = document.getElementById('storage');
	clearFileList();
	updateFileList();
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
//        var tempArray = base64ToArray(filedata);
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
		exportFile('file.txt', 'text/plain');
	}else{
		saveFile();
	}
}


function clearFileList() {
	var filelistobj = document.getElementById('fileList');
    if (filelistobj) var listlen = filelistobj.length;
	while(listlen--){
		filelistobj.remove(listlen);
	}
}


function updateFileList(idx) {
//alert("Initialising file list...");
	var filelist = Object.keys(localStorage).sort(function(a,b){return a - b});
	var filelistobj = document.getElementById('fileList');

	// Create file list
	for (var i=0; i<filelist.length; i++) {
		var opt = document.createElement('option');
		opt.textContent = filelist[i];
		opt.value = filelist[i];
		filelistobj.appendChild(opt);
	}

	// Delselect any selected option
	filelistobj.selectedIndex = -1;
}


function changeType(){
	var filenumstr = getCurrentFileNum();
	if (filenumstr) {
		// Attempt to find the relevant record
		var idx = findFileRecord(filenum);
		// Get the type setting
		var typeobj = document.getElementById('fileType');
		var type = typeobj.options[typeobj.selectedIndex].text;
		// If no record then create one otherwise update
		if (idx<0) {
			fileIndex.push(filenum,type.charAt(0),'N','N',0,"");
		}else{
			fileIndex[idx][1] = type.charAt(0);
		}
	}
}


function changeUsage(){
	var filenumstr = getCurrentFileNum();
	if (filenumstr) {
		// Attempt to find the relevant record
		var idx = findFileRecord(filenumstr);
		// Get the type setting
		var usageobj = document.getElementById('fileUsage');
		var usage = usageobj.options[usageobj.selectedIndex].text;
		// If no record then create one otherwise update
		if (idx<0) {
			fileIndex.push(filenumstr,'N',usage.charAt(0),'N',0,"");
		}else{
			fileIndex[idx][2] = usage.charAt(0);
		}
	}
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
			fileIndex.push(filenumstr,'N','N',secret,0,"");
		}else{
			fileIndex[idx][3] = secret;
		}
	}
}


function getCurrentFileNum(){
	var listobj = document.getElementById('fileList');
	if (listobj.selectedIndex>-1) {
		var filenum = listobj.options[listobj.selectedIndex].text;
		return filenum;
	}
	return "";
}


function findFileRecord(filenumstr){
	// Find record or return -1 if not found
	var idx = -1;
	for (var i=0; i<fileIndex.length; i++) {
		if (fileIndex[i][0]==filenumstr){
			idx = i;
			break;
		}
	}
	return idx;
}

