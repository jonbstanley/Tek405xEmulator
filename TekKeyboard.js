function TekKeyboard(hw, window) {

    // *****************************
    // ***                       ***
    // ***  HandleKeyboardEvent  ***
    // ***                       ***
    // *****************************

    function HandleKeyboardEvent( i, bool, e ) {

		//@@@ this.print('Key = '); this.printHex4( i ); this.print(' bool = '); this.print( bool ); this.print(' PC=0x'); this.printHex4( this.last_PC ); this.println('');
		
		// Decide what action to take depending upon the key code in 'i'.
		//
		switch( i ) {
		
		  case 0x0010 : // Left or Right shift keys.
		                hw.KBD_SHIFT_0 = bool ? 0 : 1; // Shift key down = logical '0' (negative logic sense).
		                                                 // Shift key up   = logical '1'. 
		                i = 0; break;
		                
		  case 0x0011 : // Left or Right control keys.
		                hw.KBD_CTRL_0 = bool ? 0 : 1; // Control key down = logical '0' (negative logic sense).
		                                                // Control key up   = logical '1'. 
		                i = 0; break;
		                
		  case 0x0014 : // Caps lock key.
		                hw.KBD_TTY_0 = bool ? 0 : 1; // Caps lock key down = logical '0' (negative logic sense).
		                                               // Caps lock key up   = logical '1'. 
		                i = 0; break;
		  
		  // Letters.
		  case 0x0041 : // 'A'
		  case 0x0042 : // 'B'
		  case 0x0043 : // 'C'
		  case 0x0044 : // 'D'
		  case 0x0045 : // 'E'
		  case 0x0046 : // 'F'
		  case 0x0047 : // 'G'
		  case 0x0048 : // 'H'
		  case 0x0049 : // 'I'
		  case 0x004A : // 'J'
		  case 0x004B : // 'K'
		  case 0x004C : // 'L'
		  case 0x004D : // 'M'
		  case 0x004E : // 'N'
		  case 0x004F : // 'O'
		  case 0x0050 : // 'P'
		  case 0x0051 : // 'Q'
		  case 0x0052 : // 'R'
		  case 0x0053 : // 'S'
		  case 0x0054 : // 'T'
		  case 0x0055 : // 'U'
		  case 0x0056 : // 'V'
		  case 0x0057 : // 'W'
		  case 0x0058 : // 'X'
		  case 0x0059 : // 'Y'
		  case 0x005A : // 'Z'
		                break; // Nothing further to do.

		  // Numbers.
		  case 0x0030 : // '0'
		  case 0x0031 : // '1'
		  case 0x0032 : // '2'
		  case 0x0033 : // '3'
		  case 0x0034 : // '4'
		  case 0x0035 : // '5'
		  case 0x0036 : // '6'
		  case 0x0037 : // '7'
		  case 0x0038 : // '8'
		  case 0x0039 : // '9'
		                break; // Nothing further to do.
		  
		  // Symbols.
		  case 0x0008 : // BK SPACE
		  case 0x0009 : // TAB
		  case 0x000A : // LF
		  case 0x000D : // RETURN
		  case 0x001B : // ESC
		                break; // Nothing further to do.
		  case 0x007C : i = 0x6A; break; // <f13> = PAGE 
		  case 0x00DB : i = 0x5B; break; // '[' 
		  case 0x00DE : i = 0x3A; break; // ''' = ':'
		  case 0x00BD : i = 0x3D; break; // '-' 
		  case 0x00DD : i = 0x5D; break; // ']' 
		  case 0x00DF : i = 0x5E; break; // '^' 
		  case 0x00C0 : i = 0x40; break; // '`' = '@' 
		  case 0x00BA : i = 0x3B; break;  // ';'
		  case 0x00BF : i = 0x3F; break;  // '/'
		  case 0x002E : i = 0x5F; break; // <DELETE> = RUBOUT
		  case 0x00BC : i = 0x3C; break; // ',' 
		  case 0x00BE : i = 0x3E; break; // '.'
		  case 0x00DC : i = 0x5C; break; // '\'
		  case 0x007D : i = 0x6B; break; // <f14> = BREAK 
		  case 0x0020 : i = 0x10; break; // ' ' = SPACE  

		  // Numeric keypad.
		  case 0x0060 : i = 0x20; break; // '0'  
		  case 0x006E : i = 0x2E; break; // '.'  
		  case 0x0061 : i = 0x21; break; // '1'  
		  case 0x0062 : i = 0x22; break; // '2'  
		  case 0x0063 : i = 0x23; break; // '3'  
		  case 0x0064 : i = 0x24; break; // '4'  
		  case 0x0065 : i = 0x25; break; // '5'  
		  case 0x0066 : i = 0x26; break; // '6'  
		  case 0x0067 : i = 0x27; break; // '7'  
		  case 0x0068 : i = 0x28; break; // '8'  
		  case 0x0069 : i = 0x29; break; // '9'  
		  // KC '(', 'E', ')' and '^' missing.
		  case 0x006F : i = 0x2F; break; // '/'  
		  case 0x006A : i = 0x2A; break; // '*'  
		  case 0x006D : i = 0x2D; break; // '-'  
		  case 0x006B : i = 0x2B; break; // '+'  
		  
		  // Function keys. Note - potential error in Tek documentation 0x5X versus 0x6X
		  case 0x0070 : i = 0x60; break; // FK1  
		  case 0x0071 : i = 0x61; break; // FK2
		  case 0x0072 : i = 0x62; break; // FK3  
		  case 0x0073 : i = 0x63; break; // FK4  
		  case 0x0074 : i = 0x64; break; // FK5  
		  case 0x0075 : i = 0x65; break; // FK6  
		  case 0x0076 : i = 0x66; break; // FK7  
		  case 0x0077 : i = 0x67; break; // FK8  
		  case 0x0078 : i = 0x68; break; // FK9  
		  case 0x0079 : i = 0x69; break; // FK10  
		  
		  // Line editing keys.
		  case 0x0090 : i = 0x70; break; // EXPAND
		  case 0x0091 : i = 0x71; break; // BK SPACE
		  case 0x0092 : i = 0x72; break; // SPACE
		  case 0x0093 : i = 0x73; break; // <f15> = CLEAR
		  case 0x0094 : i = 0x74; break; // RECALL


		  // Tape control keys.
//		  case 0x0000 : i = 0x77; break; // AUTO LOAD
//		  case 0x0000 : i = 0x5C; break; // REWIND
//		  case 0x0000 : i = 0x5D; break; // MAKE COPY


		  // Program control keys.
		  case 0x007F : i = 0x75; break; // <f16> = AUTO NUM
		  case 0x0080 : i = 0x76; break; // <f17> = STEP PROG

		  default : i = 0; break; // Ignore the key press if I don't know what to map it to.
		  
		} // End switch.
		
		//@@@ this.print( 'KBDDEBUG: i = 0x' ); this.printHex2( i ); this.print( ' bool = ' ); this.printHex2( bool ); this.println( '' );
		
		// Check for a key press or key release.
		if( bool ) {
		    hw.keyboardData('PRESS', i);
		} else {
		    hw.keyboardData('RELEASE');
		}
		
      	e.returnValue = false;
      	
		return false;
		
    } // End of function HandleKeyboardEvent.
    
    
    // *********************
    // ***               ***
    // ***  HandleEvent  ***
    // ***               ***
    // *********************

    function handleEvent( e ) {
		//console.log("You pressed: keyUniCode="+e.keyCode+",type="+e.type);
        return HandleKeyboardEvent(e.keyCode, e.type=='keydown', e );
    }
    

	// ***************
    // ***         ***
    // ***  FcnKey ***
    // ***         ***
    // ***************

	this.FcnKey = function(code, press) {
		// code - key code for keyboard key
		// press   - true for keydown, false for key up
		var e = {keyCode:code, type:press ? "keydown" : "keyup", returnValue: false};
		return handleEvent(e);
	}

    window.onkeydown = handleEvent;
    window.onkeyup   = handleEvent;
}