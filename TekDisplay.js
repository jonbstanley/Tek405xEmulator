

function TekDisplay(hw, canvas) {
	
	var X_DA = 0;
	var Y_DA = 0;
	
    // ********************
    // ***              ***
    // ***  STD VIDEO.  ***
    // ***              ***
    // ********************

    FGColourIndex = 0x2;
    BGColourIndex = 0x0;

    // Colours are indexed [0..7] and then [Red,Green,Blue] (where Red, Green and Blue are in the range 0..255).
    //
    ColourTable = [
      [   0,   0,   0 ], // [0] Black.
      [   0,   0, 255 ], // [1] Blue.
      [   0, 255,   0 ], // [2] Green.
      [ 255,   0,   0 ], // [3] Red.
      [   0, 255, 255 ], // [4] Cyan.
      [ 255,   0, 255 ], // [5] Magenta.
      [ 255, 255,   0 ], // [6] Yellow.
      [ 255, 255, 255 ], // [7] White.
    ];
    
	canvas.fillStyle = "rgb("+ColourTable[0][0]+","+ColourTable[0][1]+","+ColourTable[0][2]+")";
	canvas.fillRect( 0, 0, 1024, 780 );
    
    // ****************
    // ***          ***
    // ***  VECTOR  ***
    // ***          ***
    // ****************

	function VECTOR( x0, y0, x1, y1 ) {

		var dx = Math.abs( x1 - x0 );
		var dy = Math.abs( y1 - y0 );
		
		var sx = -1;
		var sy = -1;
		
		if( x0 < x1 ) sx = 1;
		if( y0 < y1 ) sy = 1;
		
		var err = dx - dy;
		
		do {
		
			setPixel( x0, y0, 'VECTOR' );
			
			if( (x0 == x1) && (y0 == y1) ) break;
			
			var e2 = 2 * err;
			
			if( e2 > -dy ) {
			
				err -= dy;
				
				x0 += sx;
				
			} // End if.
			
			if( e2 < dx ) {
			
				err += dx;
				
				y0 += sy;
				
			} // End if.
			
		} while( true );
			
	} // End of function VECTOR.
	
	


	function setPixel( x, y, type ) {
  
		switch( type ) {
			case 'ERASE' :
		 		setPixelRGB( x, y, 0, 0, 0 ); // BLACK
				break;
			case 'SOT' : // cursor refresh dot
				setPixelRGB( x, y, 0, 0, 200 ); // BLUE
				// setPixelRGB( x, y, 0, 255, 0 ); // GREEN
				break;
			case 'ADOT' : // stored character dot
				setPixelRGB( x, y, 0, 200, 0 ); // DARK GREEN
				break;
			case 'VECTOR' :
				setPixelRGB( x, y, 0, 200, 0 ); // DARK GREEN
				break;
			default :
				break;
		}					
	}

	function setPixelRGB( x, y, r, g, b ) {	    
		my = 779 - y; // Convert to 'canvas' coordinates from Tektronix coordinates.
		canvas.fillStyle = "rgb("+r+","+g+","+b+")";
		canvas.fillRect( x,my, 1,1 );
	}
    
   
    // ****************
    // ***          ***
    // ***  SCREEN  ***
    // ***          ***
    // ****************

	var adotpending = false;
	
	this.SCREEN = function( type ) {

        //console.log("TekDisplay SCREEN");

        DISP_INFO = hw.getDisplayControl();

		X_CHAR = DISP_INFO[0];
		Y_CHAR = DISP_INFO[1];
		
		VECTOR_0 = DISP_INFO[2];
		VEN_1    = DISP_INFO[3];
		
		new_X = DISP_INFO[4];
		new_Y = DISP_INFO[5];
			
		if( type == 'BUFCLK' ) {
		
			var old_X = X_DA;
			var old_Y = Y_DA;

			if( (VEN_1 == 1) && (VECTOR_0 == 0) )
				VECTOR( old_X, old_Y, new_X, new_Y );
		    
			// DER 9th August 2014 - Add debug code for drawing vectors.
			if( (VEN_1 == 1) && (VECTOR_0 == 0) && 0 ) {
			
				console.log( 'DER: TEKTRONIX4051.js - $$$' );
				console.log( ' DRAW VECTOR ' ); 
				console.log( ' old_X = '     ); console.log( old_X );
				console.log( ' old_Y = '     ); console.log( old_Y );
				console.log( ' new_X = '     ); console.log( new_X );
				console.log( ' new_Y = '     ); console.log( new_Y );
				console.log( ' VECTOR-0 = '  ); console.log( VECTOR_0 );
				console.log( ' VEN-1 = '     ); console.log( VEN_1 );
				
			} // End if.
			
			X_DA = new_X;
			Y_DA = new_Y;
		
		} // End if bufclk.
		
		// Check for cursor dot.
		if( (type == 'SOT') && (VECTOR_0 == 1) && (VEN_1 == 0) ) {
			if( adotpending ) {
				setPixel( X_DA + X_CHAR, Y_DA + Y_CHAR, 'ADOT');
			} else {
				setPixel( X_DA + X_CHAR, Y_DA + Y_CHAR, 'SOT');
			}
			adotpending = false;
		} // End if sot.
		
		// Check for alphanumeric dot.
		if( (type == 'ADOT') && (VECTOR_0 == 1) && (VEN_1 == 0) ) {
			adotpending = true;
		}
		
		// DER - Debug code...
		if( 0 ) {
			console.log( 'DER: TEKTRONIX4051.js - $$$' );
			console.log( ' TYPE = '     ); console.log( type   );
			console.log( ' X_DA = '     ); console.log( X_DA   );
			console.log( ' Y_DA = '     ); console.log( Y_DA   );
			console.log( ' X_CHAR = '   ); console.log( X_CHAR );
			console.log( ' Y_CHAR = '   ); console.log( Y_CHAR );
			console.log( ' VECTOR-0 = ' ); console.log( VECTOR_0 );
			console.log( ' VEN-1 = '    ); console.log( VEN_1 );
		} // End if
		
	} // End of function SCREEN.

    // ***************
    // ***         ***
    // ***  ERASE  ***
    // ***         ***
    // ***************

	this.ERASE = function() {
		//console.log("TekDisplay: Erase screen");
		for( x=0; x<1024; x++ ) {
			for( y=0; y<780; y++ ) {
				setPixel( x, y, 'ERASE'); 
			}
		}
	}
	
	this.COPY = function() {
	
	    // TO DO - below is an idea, but untested
	    /*
	    var canvas = document.getElementById("thecanvas");
        var image = canvas.toDataURL();

        var aLink = document.createElement('a');
        var evt = document.createEvent("HTMLEvents");
        evt.initEvent("click");
        aLink.download = 'image.png';
        aLink.href = image;
        aLink.dispatchEvent(evt); */
	
	}

}