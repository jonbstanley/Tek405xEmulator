Added new "universal" HTML file that is compatible with all 4050 Control Characters
------------
Tektronix 4051 Javascript emulator
==================================

This is a partially complete emulation of the Tektronix 4051 computer.

The emulation consists of a 6800 CPU complete with the 'hardware' and 
original ROM images. No internal tape drive is provided. Loading the
emulator with a BASIC program is accomplished through the browser interface
and the use of an emulated GPIB device (#1). There is also a Real Time Clock
configured as GPIB device #2.

Some of the keyboard keys are a bit 'wonky' at this point in time (!) as is
some of the screen display (for example the blinking cursor). Consider this
release as a pre-Alpha... The emulator is also considerably faster than the
original Tektronix 4051 machine. This is generally good news - except when
trying to pilot the Lunar Lander down (where this is virtually impossible)!

This emulator was written on an Apple iMac with the Safari browser. The emulator
requires a browser that is HTML 5 compliant (as some of the features used for
loading the BASIC program into the emulator). I have saved the source files in
such a manner that they should be readable and modifiable on a Windows platform - 
although I have not actually tested this out.

To run the emulator - double-click on the 'jsTEKTRONIX4051.html' icon. Your browser
should start and you should be presented with a large (1024 by 1024) black screen.
Scroll down a bit and you should find a button marked [start]. Click the [start] 
button. A little bit of diagnostic text (DER: MC6800.js >>>>> CRTRST: <<<<<) should 
appear in the debug log window below the button.

You should also see a blue square in the top left-hand corner of the screen. This is
(or will be when I have finished it!) the flashing green cursor...

Congratulations, the emulator seems to be running...

To load a BASIC program from the host operating system, the following procedure should
be followed:

Scroll down a bit to the buttons again.

Click the [Choose File] button and navigate to the directory containing the LINES.txt
file. Select this file. A message should appear in the debug log window as follows
"Selected file loaded from host operating system.".

In the Tektronix window type the command 'OLD @1:' followed by the <RETURN> key. The
selected BASIC program should be loaded into the emulator and the blue cursor should 
reappear on the next line. Type RUN and you should be away...

If you have tried the above procedure without reading to here - you will have identified
a problem with the keyboard. I have tried my best to map the Tektronix 4051 key matrix
to a 'standard' PC keyboard - but failed dismally in a number of areas! This is also not
helped by the shifted characters on a 'standard' keyboard being different to those on the
Tektronix keyboard either! I have mapped the keys as follows (again, noting that these
are off my iMac keyboard and not a PC). Also, I have a wired keyboard on my iMac and not
the wireless one - so I have access to the numeric pad.

Tektronix @         = Keyboard `
Tektronix :         = Keyboard '
Tektronix PAGE      = Function key 13.
Tektronix RUBOUT    = <DELETE> key.
Tektronix BREAK     = Function key 14.
Tektronix CLEAR     = Function key 15.
Tektronix AUTO NUM  = Function key 16.
Tektronix STEP PROG = Function Key 17.

If you hate me for this mapping (!) you have the source code so you can change it
yourself. Look for the function this.HandleKeyboardEvent in the file TEKTRONIX4051.js.

The CAPS LOCK, Control and Shift keys work - albeit with some limitations on the
characters that are actually displayed! I would suggest typing the characters on your 
keyboard and seeing what appears on the emulated Tektronix screen as a start.

You can't edit programs on the Tektronix emulation and save them back to the PC's disk.
Standard HTML and Javascript prohibits this. My expectation is that people will have
(or edit) the Tektronix BASIC programs using their favourite text editor on the PC and
download the program to run on the emulator.

I hope you find this emulator of interest. If you do, have identified bugs or have
helpful suggestions for improvement then please contact me at: 
daver21145 AT gmail DOT com - with text / character conversions as appropriate.

Regards,

Dave
