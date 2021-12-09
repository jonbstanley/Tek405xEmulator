<B>Updates by Twilight Logic</B>

Update 02 Dec 2021

  - added ability to edit description field
  - added support for dir command (secondary address 19)
  - miscellaneous bug fixes
  - removed support for 'Secret'

Update 05 Nov 2021:

  - export to '4924 Emulator Directory':
    - now renamed to '4050 Tape Emulator Files'
    - now exports all files to a single ZIP file

  - fixed bug where SAVE@5: appended to the previous file instead of overwriting it


Update 04 Nov 2021:

  - fixed some bugs reported by Monty McGraw including:
    - unclear functions of buttons: ClrALL renamed to DellALL. Delete renamed to DelFile. order of buttons changed to reflect a more logical grouping.
    - ClrALL (now DelALL) failed to delete the repository
    - import 4924 directory did not work
    - Clear did not clear file number or parameters to defaults


Update 02 Nov 2021:

  - the display has been updated by Monty McGraw to enable refresh graphics

  - implemented additional commands to read/write from web storage: PRINT, INPUT, WRITE, READ, BSAVE, BOLD

  - implemented ROM Expander (4051E01)

  - implemented ROM backpack right slot

  &nbsp;&nbsp;&nbsp;Known issues:

  - export to 4924 Emulator directory does not export all files. It will, however, export up to around 10 files at a time.


Update 16 Oct 2021:

  - implemented Dave R's fix for the random number generator


Update 15 Oct 2021:

  - added feature to allow import/export of files between the JavaScript emulator and Monty's Arduino 4924 emulator

  - added feature to allow the entire storage to be archived/imported as a single "tape" file archive"

  - updated Keyboard.js and re-mapped keyboard to use standard PC keys


Previous:

  - added feature to drag and drop files on to the storage window

  - added local storage features to enable programs to be stored in the browser and accessed like an external tape drive

---

<B>Additions by Monty McGraw:</B>

Update 02 Nov 2021

  - the display has been updated to enable refresh graphics

Previous:

 - Added new "UNIVERSAL" HTML emulator file that is compatible with all 4050 Control Characters

I plan to begin converting ALL my older program captures - to a universal format compatible with the universal emulator HTLM file      AND the 4051, 4052, 4052A and 4054A computers.

For the older programs from the Programs directory, and my older programs on the 4050 Program repository that have Character, backspace, underline - execute the older HTML file


