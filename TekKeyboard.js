function TekKeyboard(hw, windowobj) {

    // *****************************
    // ***                       ***
    // ***  HandleKeyboardEvent  ***
    // ***                       ***
    // *****************************

	var capsLockSet = false;

    function HandleKeyboardEvent( k, bool, scancode, e ) {

		var i = 0;


		//console.log("Key pressed: " + k + "  ASCII code: " + k.charCodeAt());


		//@@@ this.print('Key = '); this.printHex4( i ); this.print(' bool = '); this.print( bool ); this.print(' PC=0x'); this.printHex4( this.last_PC ); this.println('');

		// Deal with Shift, Control and CapsLock 
		switch (k) {
			case 'Shift' :
				hw.KBD_SHIFT_0 = bool ? 0 : 1;	// Shift key down = logical '0' (negative logic sense).
												// Shift key up   = logical '1'. 
				//e.preventDefault();
				k = '';
				return;
				break;
			case 'Control' :
				hw.KBD_CTRL_0 = bool ? 0 : 1;	// Control key down = logical '0' (negative logic sense).
												// Control key up   = logical '1'.
				k = '';
				return;
				break;

			case 'CapsLock' :
				if (bool) {
					capsLockSet = !capsLockSet;			// On capslock down toggle state of capslock
					hw.KBD_TTY_0 = capsLockSet ? 0 : 1;	// Caps lock key down = logical '0' (negative logic sense).
				}										  // Caps lock key up   = logical '1'. 
				k = '';
				return;
				break;
		}

		// console.log("KBD_SHIFT: " + hw.KBD_SHIFT_0);
		// console.log("K length: " + k.length);

		// Decide which key to use (some keys require translation to Tek codes)
		if ( k != '' ) {
			if ( k.length > 1 ) {
				// Look up the key ASCII character
				i = keyLookup(k);
			}else{
				// Check for Tek shift mapping
				hw.KBD_SHIFT_0 = tekShift(k.charCodeAt());
				// Look up the key string
				i = asciiLookup[k.charCodeAt()];
			}
		}else{
			if (scancode>0) {
				// Pass keyboard scan code directly
				i = scancode;
			}else{
				i = 0;
				return;
			}
		}

		// console.log("Key to Tek: " + i);
		// console.log("Shift status: " + hw.KBD_SHIFT_0);	// Down = 0, UP = 1;

		
		// Check for a key press or key release.
		if( bool ) {
		    hw.keyboardPress(i);
		} else {
		    hw.keyboardRelease();
		}

		// console.log("Done.");

		//keyboardInterrupt();
		
      	e.returnValue = false;
      	
		return false;
		
    } // End of function HandleKeyboardEvent.
    
    
    // *********************
    // ***               ***
    // ***  HandleEvent  ***
    // ***               ***
    // *********************

	// Hardware key events
    function handleEvent( e ) {
        var storage = document.getElementById('storage');
		// If storage dialog is displayed then ignore and return
        if (storage) {
            if (storage.style.display=="block") return;
        }
		// Did we get an emulated keypress scan code
		if (e.detail.scancode) {
			return HandleKeyboardEvent('', e.detail.type=='keydown', e.detail.scancode, e);
		}else{		
			// Otherwise execute keyboard handler
        	return HandleKeyboardEvent(e.key, e.type=='keydown', 0, e );
		}
    }

/*    
	// Emulated key events
	function handleEkeyEvent ( e ) {
        var storage = document.getElementById('storage');
        if (storage) {
            if (storage.style.display=="block") return;
        }
		
	}
*/

	// ***************
    // ***         ***
    // ***  FcnKey ***
    // ***         ***
    // ***************
/*
	this.FcnKey = function(code, press) {
		// code - key code for keyboard key
		// press   - true for keydown, false for key up
		var e = {keyCode:code, type:press ? "keydown" : "keyup", returnValue: false};
		return handleEvent(e);
	}
*/

	// Most characters can be looked up in a table
	var asciiLookup = [
	//  Tek:-	   PC:-
		0x00,	// 000 [00] Null
		0x00,	// 001 [01] SOH (Start of heading)
		0x00,	// 002 [02] STX (Start of text)
		0x00,	// 003 [03] ETX (End of text)
		0x00,	// 004 [04] EOT (End of transmission)
		0x00,	// 005 [05] ENQ (Enquiry)
		0x00,	// 006 [06] ACK (Acknowledge)
		0x00,	// 007 [07] BEL (Bell)
		0x08,	// 008 [08] BS  (Backspace)
		0x09,	// 009 [09] TAB (Horizontal tab)
		0x0A,	// 010 [0A] LF  (Line feed)
		0x00,	// 011 [0B] VT  (Vertical tab)
		0x00,	// 012 [0C] FF  (Form feed)
		0x0D,	// 013 [0D] CR  (Carriage return)
		0x00,	// 014 [0E] SO  (Shift out)
		0x00,	// 015 [0F] SI  (Shift in)
		0x10,	// 016 [10] DLE (Data link escape)
		0x00,	// 017 [11] DC1 (Device control 1)
		0x00,	// 018 [12] DC1 (Device control 2)
		0x00,	// 019 [13] DC1 (Device control 3)
		0x00,	// 020 [14] DC1 (Device control 4)
		0x00,	// 021 [15] NAK (Negative acknowledge)
		0x00,	// 022 [16] SYN (Synchronous idle)
		0x00,	// 023 [17] ETB (End of transmiaaion block)
		0x00,	// 024 [18] CAN (Cancel)
		0x00,	// 025 [19] EM  (End of medium)
		0x00,	// 026 [1A] SUB (Substitute)
		0x1B,	// 027 [1B] ESC (Escape)
		0x00,	// 028 [1C] FS  (File separator)
		0x00,	// 029 [1D] GS  (Group separator)
		0x00,	// 030 [1E] RS  (Record separator)
		0x00,	// 031 [1F] US  (Unit separator)
		0x10,	// 032 [20] Space
		0x31,	// 033 [21] !
		0x32,	// 034 [22] "
		0x33,	// 035 [23] # [':']
		0x34,	// 036 [24] $
		0x35,	// 037 [25] %
		0x36,	// 038 [26] &
		0x37,	// 039 [27] '      ' ['@'] 0x40 0x37
		0x38,	// 040 [28] (
		0x39,	// 041 [29] )
		0x2A,	// 042 [2A] *
		0x3B,	// 043 [2B] +
		0x3C,	// 044 [2C] ,
		0x3D,	// 045 [2D] -
		0x3E,	// 046 [2E] .
		0x3F,	// 047 [2F] /
		0x30,	// 048 [30] 0
		0x31,	// 049 [31] 1
		0x32,	// 050 [32] 2
		0x33,	// 051 [33] 3
		0x34,	// 052 [34] 4
		0x35,	// 053 [35] 5
		0x36,	// 054 [36] 6
		0x37,	// 055 [37] 7
		0x38,	// 056 [38] 8
		0x39,	// 057 [39] 9
		0x3A,	// 058 [3A] :
		0x3B,	// 059 [3B] ;
		0x3C,	// 060 [3C] <
		0x3D,	// 061 [3D] =
		0x3E,	// 062 [3E] >
		0x3F,	// 063 [3F] ?
		0x40,	// 064 [40] @
		0x41,	// 065 [41] A
		0x42,	// 066 [42] B
		0x43,	// 067 [43] C
		0x44,	// 068 [44] D
		0x45,	// 069 [45] E
		0x46,	// 070 [46] F
		0x47,	// 071 [47] G
		0x48,	// 072 [48] H
		0x49,	// 073 [49] I
		0x4A,	// 074 [4A] J
		0x4B,	// 075 [4B] K
		0x4C,	// 076 [4C] L
		0x4D,	// 077 [4D] M
		0x4E,	// 078 [4E] N
		0x4F,	// 079 [4F] O
		0x50,	// 080 [50] P
		0x51,	// 081 [51] Q
		0x52,	// 082 [52] R
		0x53,	// 083 [53] S
		0x54,	// 084 [54] T
		0x55,	// 085 [55] U
		0x56,	// 086 [56] V
		0x57,	// 087 [57] W
		0x58,	// 088 [58] X
		0x59,	// 089 [59] Y
		0x5A,	// 090 [5A] Z
		0x5B,	// 091 [5B] [
		0x5C,	// 092 [5C] Backslash
		0x5D,	// 093 [5D] ]
		0x5E,	// 094 [5E] ^
		0x5F,	// 095 [5F] _
		0x40,	// 096 [60] `
		0x41,	// 097 [61] a
		0x42,	// 098 [62] b
		0x43,	// 099 [63] c
		0x44,	// 100 [64] d
		0x45,	// 101 [65] e
		0x46,	// 102 [66] f
		0x47,	// 103 [67] g
		0x48,	// 104 [68] h
		0x49,	// 105 [69] i
		0x4A,	// 106 [6A] j
		0x4B,	// 107 [6B] k
		0x4C,	// 108 [6C] l
		0x4D,	// 109 [6D] m
		0x4E,	// 110 [6E] n
		0x4F,	// 111 [6F] o
		0x50,	// 112 [70] p
		0x51,	// 113 [71] q
		0x52,	// 114 [72] r
		0x53,	// 115 [73] s
		0x54,	// 116 [74] t
		0x55,	// 117 [75] u
		0x56,	// 118 [76] v
		0x57,	// 119 [77] w
		0x58,	// 120 [78] x
		0x59,	// 121 [79] y
		0x5A,	// 122 [7A] z
		0x5B,	// 123 [7B] {
		0x5C,	// 124 [7C] |
		0x5D,	// 125 [7D] }
		0x5E,	// 126 [7E] ~
		0x7F	// 127 [7F] Delete (numeric keypad)

	];


	// Special keys generate strings in the 'key' parameter 
	function keyLookup ( key ) {

		//console.log("Looking up " + key);

		switch (key) {
			// Control keys
			case "Alt"         : return 0x00; break;
			case "AltGraph"    : return 0x00; break;
			case "ArrowDown"   : return 0x00; break;
			case "ArrowLeft"   : return 0x00; break;
			case "ArrowRight"  : return 0x00; break;
			case "ArrowUp"     : return 0x00; break;
			case "Backspace"   : return 0x08; break;	// Back space
			case "Control"     : return 0x11; break;
			case "Capslock"    : return 0x14; break;
			case "ContextMenu" : return 0x00; break;
			case "Delete"      : return 0x5F; break;	// Rubout
			case "End"         : return 0x6B; break;	// BREAK
			case "Enter"       : return 0x0D; break;
			case "Escape"      : return 0x1B; break;
			case "F1"   	   : return 0x60; break; 
			case "F2"   	   : return 0x61; break; 
			case "F3"   	   : return 0x62; break; 
			case "F4"   	   : return 0x63; break; 
			case "F5"   	   : return 0x64; break; 
			case "F6"   	   : return 0x65; break; 
			case "F7"   	   : return 0x66; break;
			case "F8"   	   : return 0x67; break; 
			case "F9"   	   : return 0x68; break; 
			case "F10"   	   : return 0x69; break; 
			case "F11"   	   : return 0x00; break; 
			case "F12"   	   : return 0x00; break;
			case "F13"   	   : return 0x6A; break;	// [Mac] PAGE 
			case "F14"   	   : return 0x6B; break;	// [Mac] BREAK
			case "F15"   	   : return 0x73; break;	// [Mac] CLEAR 
			case "F16"   	   : return 0x75; break;	// [Mac] AUTO NUM 
			case "F17"   	   : return 0x76; break;	// [Mac] STEP PROG 
			case "F18"   	   : return 0x00; break;	// [Mac]
			case "F19"   	   : return 0x00; break;	// [Mac]
			case "Home"        : return 0x6A; break; 	// PAGE£
			case "Insert"      : return 0x73; break; 	// CLEAR
			case "NumLock"     : return 0x70; break; 
			case "PageDown"    : return 0x00; break;
			case "PageUp"      : return 0x75; break;	// AUTO NUM
			case "Pause"       : return 0x76; break;	// STEP PROG
			case "ScrollLock"  : return 0x00; break;
			case "Shift"       : return 0x10; break;
			case "Tab"         : return 0x09; break;
		}
	}

	// Some characters require the status of shift to be reversed
	function tekShift(key) {

		switch (key) {
			case 0x23 : return !hw.KBD_SHIFT_0; break; // 7 => #
			case 0x27 : return !hw.KBD_SHIFT_0; break; // 7 => '	
//			case 0x2A : return !hw.KBD_SHIFT_0; break; // *		
			case 0x3A : return !hw.KBD_SHIFT_0; break; // * => :
			case 0x3D : return !hw.KBD_SHIFT_0; break; // - => =
			case 0x40 : return !hw.KBD_SHIFT_0; break; // ` => @
			case 0x5E : return !hw.KBD_SHIFT_0; break; // ~ => ^
			default : 	return hw.KBD_SHIFT_0;
		}	
	};

	// Hardware key events
    windowobj.onkeydown = handleEvent;
    windowobj.onkeyup   = handleEvent;

	// Emulated key events
	windowobj.addEventListener('kdbePress', function(ev) {
		handleEvent(ev);
	});
	windowobj.addEventListener('kdbeRelease', function(ev) {
		handleEvent(ev);
	});

}

