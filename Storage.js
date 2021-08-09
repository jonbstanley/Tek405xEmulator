// Storage test script

var uploadTo4051 = 0;

function saveProgram(idx, progobj){
	if (idx) {
        if (localStorage.getItem(idx)) {
            if (confirm("Overwrite existing program?")){
		        localStorage.setItem(idx, progobj.value);
            }else{
                return;
            }
        }else{
            localStorage.setItem(idx, progobj.value);
        }
	}else{
		alert("Program number required!");
	}
}


function loadProgram(idx){
	if (idx) {
		progobj = document.getElementById('program');
		progobj.value = localStorage.getItem(idx);
	}else{
		alert("Program number required!");
	}
}


function deleteProgram(idx){
	if (idx) {
        if (localStorage.getItem(idx)) {
            if (confirm("Delete existing program?")){
		        progobj = document.getElementById('program');
		        progobj.value = "";
                localStorage.removeItem(idx);
            }
        }else{
            alert("Nothing to delete!");
        }
	}else{
		alert("Program number required!");
	}
}


function selectProgram(){
    var program = document.getElementById('program').value;
    upload_to_tek(str2arraybuf(program));
	closeStorage();
}


function closeStorage(){
    var storageobj = document.getElementById('storage');
    storageobj.style.display="none";
}


function readFile(file){
    var filename = file.name;
    var filenamefield = document.getElementById('fname');
    var freader = new FileReader();
    filenamefield.innerHTML = filename;
    freader.onload = function(ev) {
        var progobj = document.getElementById('program');
        progobj.value = ev.target.result;
		//console.log(progobj.value);
		// If a direct upload to the emulator has bene requested
		if (uploadTo4051) {
			console.log("Uploading to Tek...");
			upload_to_tek(str2arraybuf(progobj.value));	// Upload the program to the emulator
			tek.programLoaded(); // Signal the emulator that the upload is complete
			uploadTo4051 = 0; // Reset flag
		}
		// console.log("Upload done.");
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
//        var program = document.getElementById('program');
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


function exportProgram(content, filename, contentType) {
    const exported = document.createElement('a');
    const file = new Blob([content], {type: contentType});
  
    exported.href= URL.createObjectURL(file);
    exported.download = filename;
    exported.click();

    URL.revokeObjectURL(exported.href);
    exported.remove();
}


function importProgram() {
    var file = document.getElementById('importFile').files[0];
	readFile(file);
/*
    readfile(file).then(
		result => console.log("File load complete."),
		error => console.log("File load error!")
	);
*/
}


function showStorageOptions(){
    var storage = document.getElementById('storage');
    storage.style.display="block";
}


function str2arraybuf(str) {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i<strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}


function readFromTape(idx) {
console.log("Idx: " + idx);
	if (idx != '0') {
		// console.log("Loading from web storage...");
		upload_to_tek(str2arraybuf(localStorage.getItem(idx)));
	}else{
		var progobj = document.getElementById('program');
		progobj.value = "";
		// Signal we want to upload directly into the emulator
		uploadTo4051 = 1; 
		// Trigger the file dialog to let the user choose a file
		document.getElementById('importFile').click(); 
		//console.log("Opened file import dialog");
	}
}


