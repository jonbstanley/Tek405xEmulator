

function TekDisplay(hw, canvas) {
	
	var canvasctx = canvas.getContext("2d");
	var width = canvas.width;
	var height = canvas.height;
	
	var X_DA = 0;
	var Y_DA = 0;
	
	const pixel_erase_inten  = 255;
	const pixel_store_inten  = 240;
	const pixel_cursor_inten = 200;
	
	
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
    
	canvasctx.fillStyle = "rgb("+ColourTable[0][0]+","+ColourTable[0][1]+","+ColourTable[0][2]+")";
	canvasctx.fillRect( 0, 0, width, height );
    
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
		
			// double vector pixel width and height
			setPixel( x0+2, y0+2, 'VECTOR' );
			setPixel( x0, y0+2, 'VECTOR' );
			setPixel( x0+2, y0+1, 'VECTOR' );
			setPixel( x0, y0+1, 'VECTOR' );
			
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
				setPixelRGB( x, y, 0, pixel_cursor_inten, 0 ); // DARK GREEN
				break;
			case 'ADOT' : // stored character dot
				setPixelRGB( x, y, 0, pixel_store_inten, 0 ); // BRIGHT GREEN
				break;
			case 'VECTOR' :
				setPixelRGB( x, y, 0, pixel_store_inten, 0 ); // BRIGHT GREEN
				break;
			default :
				break;
		}					
	}

	function setPixelRGB( x, y, r, g, b ) {	    
		my = height - y; // Convert to 'canvas' coordinates from Tektronix coordinates.
		canvasctx.fillStyle = "rgb("+r+","+g+","+b+")";
		canvasctx.fillRect( x,my, 1,1 );
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
				// setPixel( X_DA + X_CHAR, Y_DA + Y_CHAR, 'ADOT');
				// double width and double height of character pixels
				// 4 setPixel calls to interpolate between pixels for continuous font appearance
				setPixel( X_DA + 2*X_CHAR+2, Y_DA + 2*Y_CHAR, 'ADOT' );
				setPixel( X_DA + 2*X_CHAR+1, Y_DA + 2*Y_CHAR, 'ADOT' );
				setPixel( X_DA + 2*X_CHAR+2, Y_DA + 2*Y_CHAR-1, 'ADOT' );
				setPixel( X_DA + 2*X_CHAR+1, Y_DA + 2*Y_CHAR-1, 'ADOT' );
								
			} else {
			    // setPixel( X_DA + X_CHAR, Y_DA + Y_CHAR, 'SOT');
				// double width and double height of cursor pixels
				// but don't fill in completely, it is pixelated on the actual machine
				setPixel( X_DA + 2*X_CHAR+2, Y_DA + 2*Y_CHAR, 'SOT' );
				
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

        var imgd = canvasctx.getImageData(0, 0, width, height);
        var buffer = imgd.data.buffer;
        var buf8 = new Uint8ClampedArray(buffer);
        var data = new Uint32Array(buffer);
	
	    // Fill the screen bright green
	    for(i = 0; i < data.length; i++) {
           // 31:24 = alpha
           // 23:16 = blue
           // 15:8  = green
           //  7:0  = red
           data[i] = 0xFF00FF00;
        }
        imgd.data.set(buf8);
        canvasctx.putImageData(imgd, 0, 0);
        
        // Blank the screen
        for(i = 0; i < data.length; i++) {
           // 31:24 = alpha
           // 23:16 = blue
           // 15:8  = green
           //  7:0  = red
           data[i] = 0xFF000000;
        }
        imgd.data.set(buf8);
        
        // The DVST resets right after the screen flash
        //setTimeout(function(){
            canvasctx.putImageData(imgd, 0, 0);
         //   }, 10);  //timeout reduced to 10msec to prevent loss of first PRINTed characters after PAGE
		
	}

    
	this.dvst_emulate = function() {
	    
	    var imgd = canvasctx.getImageData(0, 0, width, height);
        var buffer = imgd.data.buffer;
        var buf8 = new Uint8ClampedArray(buffer);
        var data = new Uint32Array(buffer);
	
	    for(i = 0; i < data.length; i++) {
           // 31:24 = alpha
           // 23:16 = blue
           // 15:8  = green
           //  7:0  = red
            var pixel = (data[i] >> 8) & 0xFF;
            
            // If the pixel is bright enough for the DVST to store it
            // then it will stay that way. If the pixel brightness
            // is below the threshold for the DVST to store the pixel
            // then its brightness will decay to zero.
            if(pixel_store_inten > pixel) {
               data[i] = 0xFF000000; // Blank the pixel
            }
        }
        imgd.data.set(buf8);
        canvasctx.putImageData(imgd, 0, 0); 
	}

	
	this.COPY = function() {
	
        var link = document.createElement('a');
        link.download = "screen.png";
        link.href = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");;
        link.click();
	
	}

}