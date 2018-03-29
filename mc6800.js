
/*
 *
 * JSMSX - MSX Emulator in Javascript
 * Copyright (c) 2006 Marcus Granado <mrc.gran(@)gmail.com>
 *
 * Portions of the initial code was inspired by the work of
 * Arnon Cardoso's Java MSX Emulator and
 * Adam Davidson & Andrew Pollard's Z80 class of the Spectrum Java Emulator
 * after reading this thread: http://www.msx.org/forumtopic4176.html
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 * The full license is available at http://www.gnu.org/licenses/gpl.html
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * Completely revamped to the MC6800 CPU by Dave Roberts based on the work of William Beech.
 * January 2018 - Further updated by Jon Stanley with some reorganization and TekExtended instructions.
 *
 * m6800.c: SWTP 6800 CPU simulator

   Copyright (c) 2005-2011, William Beech

   Permission is hereby granted, free of charge, to any person obtaining a
   copy of this software and associated documentation files (the "Software"),
   to deal in the Software without restriction, including without limitation
   the rights to use, copy, modify, merge, publish, distribute, sublicense,
   and/or sell copies of the Software, and to permit persons to whom the
   Software is furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in
   all copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL
   WILLIAM A. BEECH BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
   IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
   CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

   Except as contained in this notice, the name of William A. Beech shall not
   be used in advertising or otherwise to promote the sale, use or other dealings
   in this Software without prior written authorization from William A. Beech.
 *
 */

    

function TekCpu(hw) {

    // Establish the MIPS = Millions of Instructions Per Second
    // 0.833 is specific to the 6800 processor
    const MIPS = 0.833;
    
    // When the TekCpu object is created, its execute() function will
    // be called 60 times per second in a SetInterval. To faithfully emulate
    // the actual speed of a 6800, compute the number of instructions that will
    // be executed in one execute() function call interval.
    const InstructionsPerInterval = (MIPS*1000000/60.0);
    //console.log("InstructionsPerInterval = " + InstructionsPerInterval);

    // Change this value to true if you want to see some processor executions logged to the console
    const DebugExecutePrint = false;
    
    var instruction_mnemonic;
    var instruction_operand;
    var instruction_description;

	var oldNMI = 0;
	var oldIRQ = 0;
    var lastPC = 0xDEAD;
    
	// NOTE: The Motorola MC6800 stores the most significant byte of a word at the lower address.
	
	// -------------------------------------------------------------------------------------
	// 6800 vectors
	// -------------------------------------------------------------------------------------
	
    const IRQ_VECTOR   = 0xFFF8;
    const SWI_VECTOR   = 0xFFFA;
    const NMI_VECTOR   = 0xFFFC;
    const RESET_VECTOR = 0xFFFE;
	
	// -------------------------------------------------------------------------------------
	// 6800 registers
	// -------------------------------------------------------------------------------------
	
	var A   = 0x00;   // Accumulator A (8 bits)
	var B   = 0x00;   // Accumulator B (8 bits)
	var IX  = 0x0000; // Index register (16 bits)
	var PC  = 0x0000; // Program counter (16 bits)
	var SP  = 0x0000; // Stack pointer (16 bits)
	var CCR = 0x00;   // Condition code register (8 separate bits) aka Status Register
	var IR  = 0x00;   // Instruction Register (8 bits)
	
	// -------------------------------------------------------------------------------------
	// 6800 bit constants
	// -------------------------------------------------------------------------------------
	
	const ADDR_MASK = 0xFFFF; // 16 bits.
	
	// Flag bit positions in CCR
	const FS = 0x80; // Fetch Space (ROM) select - Tektronix 4052/54 only
	const DS = 0x40; // Data Space (RAM) select - Tektronix 4052/54 only
	const HF = 0x20; // Half carry
	const IF = 0x10; // Interrupt mask
	const NF = 0x08; // Negative
	const ZF = 0x04; // Zero
	const VF = 0x02; // Overflow
	const CF = 0x01; // Carry
	
	// For a 6800, the upper 2 bits of the CCR are unused
	const CCR_ALWAYS_ON = 0xC0; 
	const CCR_MASK = HF | IF | NF | ZF | VF | CF;
	
	// -------------------------------------------------------------------------------------
	// Condition Code Register (aka Status Register) helper functions
	// -------------------------------------------------------------------------------------
	
	function TOGGLE_FLAG( FLAG ) {
		CCR ^= FLAG;
	}

	function GET_FLAG( FLAG ) {
    	if( CCR & FLAG ) return 1;
    	else             return 0;
	}
	
	function SET_FLAG( FLAG ) {
		CCR |= FLAG;
	}
	
	function CLR_FLAG( FLAG ) {
		CCR &= ~FLAG;
	}

	function GET_FLAG_BITS( FLAG ) {
		return CCR & FLAG;
	}

	function COND_SET_FLAG( COND, FLAG ) {
		if( COND ) SET_FLAG( FLAG ); 
		else       CLR_FLAG( FLAG );
	}

	function COND_SET_FLAG_N( VAR ) {
		if( VAR & 0x80 ) SET_FLAG( NF );
		else             CLR_FLAG( NF );
	}
		
	function COND_SET_FLAG_Z( VAR ) {
		if( VAR == 0 ) SET_FLAG( ZF );
		else           CLR_FLAG( ZF );
	}
		
	function COND_SET_FLAG_H( COND ) {
		if( COND ) SET_FLAG( HF );
		else       CLR_FLAG( HF );
	}
		
	function COND_SET_FLAG_C( VAR ) {
		if( VAR & 0x100 ) SET_FLAG( CF );
		else              CLR_FLAG( CF );
	}
		
	function COND_SET_FLAG_V( COND ) {
		if( COND ) SET_FLAG( VF );
		else       CLR_FLAG( VF );
	}
		
	
	// -------------------------------------------------------------------------------------
	// Memory access functions
	// -------------------------------------------------------------------------------------

    function readByte( address ) {
        // This calls the hardware outside of the CPU object
		return hw.peekb( address );
    }
    
    function writeByte( address, val ) {
        // This calls the hardware outside of the CPU object
       return hw.pokeb( address, val );
    }
    
    function readWord( address ) {
		var temp = address;
		var val  = readByte(   temp             ) << 8; // MSB
		val     |= readByte( ++temp & ADDR_MASK )     ; // LSB
		return val;
    }
    
    function writeWord( address, val ) {
    	writeByte( (address+0) & ADDR_MASK, (val >>> 8) & 0xFF ); // MSB
    	writeByte( (address+1) & ADDR_MASK, (val >>> 0) & 0xFF ); // LSB
    }
 
    // -------------------------------------------------------------------------------------
	// Memory access helper functions for instruction and operand read and write accesses
	// -------------------------------------------------------------------------------------
    
    // fetch a byte from location in PC
    function fetch_byte() {
    	var val = readByte( PC ) & 0xFF;  // fetch byte at address in PC
	    PC = (PC + 1) & ADDR_MASK; // increment PC by 1
    	return val;
    }
    
    // fetch a 16-bit word from location in PC
    function fetch_word() {
    	var val  = readByte( PC ) << 8;       // fetch high byte
	    val     |= readByte( PC + 1 ) & 0xFF; // fetch low byte
	    PC = (PC + 2) & ADDR_MASK;         // increment PC by 2
    	return val;
    }
    
	// push a byte to the stack and decrement Stack Pointer
	function push_byte( val ) {
    	writeByte( SP, val & 0xFF );   // push byte at address in SP
    	SP = (SP - 1) & ADDR_MASK; // decrement SP by 1
	}

	// push a 16-bit word to the stack (2 byte pushes)
	function push_word( val ) {
    	push_byte( val & 0xFF );  // push low byte
    	push_byte( val >>> 8  );  // push high byte
	}

	// pop a byte from the stack and increment Stack Pointer
	function pop_byte() {
    	SP = (SP + 1) & ADDR_MASK; // increment SP by 1
    	return readByte( SP );        // fetch byte at address in SP
	}

	// pop a 16-bit word from the stack (2 byte pops)
	function pop_word() {
    	var res = pop_byte() << 8; // fetch high byte
    	res |= pop_byte();         // fetch low byte
    	return res;
	}
	
	// -------------------------------------------------------------------------------------
	// Helper function for branch instruction execution and decision making
	// -------------------------------------------------------------------------------------

	// PC will jump to relative offset if the condition is met, otherwise PC remains unchanged
	function branch_relative( cond ) {
	    // Fetch relative offset from memory
    	var temp = get_relative_addr();
    	if( cond ) {
        	PC += temp;
        	// console.log('>>> BRANCH TAKEN <<<');
        } else {
        	// console.log('>>> BRANCH NOT TAKEN <<<');
        }
        // Keep address truncated to 16-bits
    	PC &= ADDR_MASK;
	}
    
	// -------------------------------------------------------------------------------------
	// Address operand fetch and computation helper functions for instruction execution
	// -------------------------------------------------------------------------------------

    // Summary of Address Modes:
    // 1. Relative - 8-bit sign extended address from 2nd operand is added to PC
    // 2. Direct   - 8-bit absolute address from 2nd operand for lower 256 bytes of memory
    // 3. Extended - 16-bit absolute address from 2nd operand = upper, 3rd operand = lower
    // 4. Indexed  - 8-bit zero-extended address from 2nd operand is added to 16-bit Index Register (IX)


	// returns the relative offset (8-bits) sign-extended at the address pointed to by PC
	// rel_addr = sign_extend(operand byte)
	function get_relative_addr() {
	    instruction_operand = ", RELATIVE";
    	var temp = fetch_byte(); // fetch byte at location in PC
    	if( temp & 0x80 ) // Sign-extend offset if MSB is set
        	temp |= 0xFF00;
    	return temp & ADDR_MASK;
	}

	// returns the data value at the direct address pointed to by PC
	function get_direct_data() {
		return readByte( get_direct_addr() );
	}

	// returns the direct address (8-bits) pointed to by PC
	// dir_addr = operand byte
	function get_direct_addr() {
	    instruction_operand = ", DIRECT";
    	return fetch_byte() & 0xFF; // fetch byte at location in PC
	}

	// returns the data value at the indexed (indirect) address
	function get_indexed_data() {
    	return readByte( get_indexed_addr() );
	}

	// returns the indexed (indirect) address pointed to by PC relative to Index Register
	// indir_addr = operand byte + IX
	function get_indexed_addr() {
	    instruction_operand = ", INDIRECT";
    	return (fetch_byte() + IX) & ADDR_MASK; // fetch byte at location in PC and offset by IX
	}

	// returns the data value at the extended address pointed to by PC
	function get_extended_data() {
    	return readByte( get_extended_addr() );
	}

	// returns the extended (16-bit) direct address pointed to by PC
	// ext_addr = 16-bit operand word
	function get_extended_addr() {
	    instruction_operand = ", EXTENDED";
		return fetch_word(); // fetch 16-bit word at location in PC
	}	
		
	// -------------------------------------------------------------------------------------
	// This is THE processor instruction execution function
	// -------------------------------------------------------------------------------------
	this.execute = function() {
	
		var DAR, hi, lo, op1, res;
		
		// Execute only InstructionsPerInterval amount of instructions to emulate the CPU speed
		for(i = 0; i < InstructionsPerInterval; i++) {

		    lastPC = PC;

	        // -------------------------------------------------------------------------------------
		    // Output some status based on useful PC addresses
	        // -------------------------------------------------------------------------------------
		       if( lastPC == 0xCBBF ) hw.println( 'DER: MC6800.js >>>>> CRTRST: <<<<<' );
		    // if( lastPC == 0xC888 ) hw.println( 'DER: MC6800.js >>>>> CHSCAN: <<<<<' );
		    // if( lastPC == 0xCBEE ) hw.println( 'DER: MC6800.js >>>>>  PCHAR: <<<<<' );
		    // if( lastPC == 0xC5B2 ) hw.println( 'DER: MC6800.js >>>>>   IDLE: <<<<<' );
		    // if( lastPC == 0xC65C ) hw.println( 'DER: MC6800.js >>>>>  CIDLE: <<<<<' );
		    
	        // -------------------------------------------------------------------------------------
		    // Process interrupts
	        // -------------------------------------------------------------------------------------
		    if( hw.checkNMI() ) {
		    	if( !oldNMI ) {
                	push_word( PC  );
                	push_word( IX  );
                	push_byte( A   );
                	push_byte( B   );
                	push_byte( CCR );
                	SET_FLAG(  IF  );
                	PC = readWord(NMI_VECTOR) & ADDR_MASK;
           			lastPC = PC;
                	//console.log(' >>>>> NMI <<<<<' );
		    	}
		    	oldNMI = 1;
		    } else {
		    	oldNMI = 0;
		    	if( hw.checkIRQ() ) {
		    		if( !GET_FLAG_BITS( IF ) ) {
		    			if( !oldIRQ ) {
                			push_word( PC  );
                			push_word( IX  );
                			push_byte( A   );
                			push_byte( B   );
                			push_byte( CCR );
                			SET_FLAG(  IF  );
                			PC = readWord(IRQ_VECTOR) & ADDR_MASK;
                			lastPC = PC;
                			//console.log(' >>>>> IRQ <<<<<' );
		    			}
		    			oldIRQ = 1;
		    		} else {
		    			oldIRQ = 0;
		    		}
		    	} else {
		    		oldIRQ = 0;
		    	}
		    }
		    
			// -------------------------------------------------------------------------------------
	        // Fetch instruction at Program Counter (PC) address, decode and execute the instruction
	        // -------------------------------------------------------------------------------------
			IR = fetch_byte(); 
			
			switch( IR ) {

                case 0x01:
                    instruction_mnemonic = "NOP";
                    instruction_description = "(6800) No operation";
                    break;
                case 0x02:
                    instruction_mnemonic = "NOP2";
                    instruction_description = "(TekExtended) No operation";
                    break;
                case 0x03:
                    instruction_mnemonic = "SFA";
                    instruction_description = "(TekExtended) Store A <= F?";
                    i = 0;
                    break;
                case 0x05:
                    instruction_mnemonic = "TAP";
                    instruction_description = "(TekExtended) Transfer Status Register P <= A?";
                    // This might be a specific TAP for ROM/RAM space control to CCR bits 6-7?";
                    i = 0;
                    break;
                case 0x06:
                    instruction_mnemonic = "TAP";
                    instruction_description = "(6800) Transfer Status Register P <= A";
                    CCR = A & this.CCR_MASK;
                    break;
                case 0x07:
                    instruction_mnemonic = "TPA";
                    instruction_description = "(6800) Transfer A <= Status Register P";
                    A = CCR | CCR_ALWAYS_ON;
                    break;
                case 0x08:
                    instruction_mnemonic = "INX";
                    instruction_description = "(6800) Increment IX";
                    IX = (IX + 1) & ADDR_MASK;
                    COND_SET_FLAG_Z( IX );
                    break;
                case 0x09:
                    instruction_mnemonic = "DEX";
                    instruction_description = "(6800) Decrement IX";
                    IX = (IX - 1) & ADDR_MASK;
                    COND_SET_FLAG_Z( IX );
                    break;
                case 0x0A:
                    instruction_mnemonic = "CLV";
                    instruction_description = "(6800) Clear overflow status bit";
                    CLR_FLAG( VF );
                    break;
                case 0x0B:
                    instruction_mnemonic = "SEV";
                    instruction_description = "(6800) Set overflow status bit";
                    SET_FLAG( VF );
                    break;
                case 0x0C:
                    instruction_mnemonic = "CLC";
                    instruction_description = "(6800) Clear carry status bit";
                    CLR_FLAG( CF );
                    break;
                case 0x0D:
                    instruction_mnemonic = "SEC";
                    instruction_description = "(6800) Set carry status bit";
                    SET_FLAG( CF );
                    break;
                case 0x0E:
                    instruction_mnemonic = "CLI";
                    instruction_description = "(6800) Clear interrupt mask status bit";
                    CLR_FLAG( IF );
                    break;
                case 0x0F:
                    instruction_mnemonic = "SEI";
                    instruction_description = "(6800) Set interrupt mask status bit";
                    SET_FLAG( IF );
                    break;
                case 0x10:
                    instruction_mnemonic = "SBA";
                    instruction_description = "(6800) Store A <= A - B";
                    op1 = B;
                    res = A - op1;
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0x11:
                    instruction_mnemonic = "CBA";
                    instruction_description = "(6800) Compare A - B";
                    op1 = B;
                    res = A - op1;
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    COND_SET_FLAG_Z( res & 0xFF );
                    COND_SET_FLAG_N( res & 0xFF );
                    break;
                case 0x12:
                    instruction_mnemonic = "TAPX";
                    instruction_description = "(TekExtended) Transfer Extended Status Register PX <= A?";
                    i = 0;
                    break;
                case 0x13:
                    instruction_mnemonic = "TPAX";
                    instruction_description = "(TekExtended) Transfer A <= Extended Status Register?";
                    i = 0;
                    break;
                case 0x14:
                    instruction_mnemonic = "ADXI";
                    instruction_description = "(TekExtended) ???";
                    i = 0;
                    break;
                case 0x15:
                    instruction_mnemonic = "ASPI";
                    instruction_description = "(TekExtended) ???";
                    i = 0;
                    break;
                case 0x16:
                    instruction_mnemonic = "TAB";
                    instruction_description = "(6800) Transfer A => B";
                    B = A;
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    CLR_FLAG( VF );
                    break;
                case 0x17:
                    instruction_mnemonic = "TBA";
                    instruction_description = "(6800) Transfer B => A";
                    A = B;
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    CLR_FLAG( VF );
                    break;
                case 0x18:
                    instruction_mnemonic = "SDA";
                    instruction_description = "(TekExtended) Store A <= D?";
                    i = 0;
                    break;
                case 0x19:
                    instruction_mnemonic = "DAA";
                    instruction_description = "(6800) Decimal Adjust Accumulator A";
                    // Note: TekExtended version does NOT implement this instruction
                    DAR = A & 0x0F;
                    op1 = GET_FLAG( CF );
                    if( (DAR > 9) || GET_FLAG( CF ) ) {
                        DAR += 6;
                        A &= 0xF0;
                        A |= (DAR & 0x0F);
                        COND_SET_FLAG( DAR & 0x10, CF );
                    }
                    DAR = (A >>> 4) & 0x0F;
                    if( (DAR > 9) || GET_FLAG( CF ) ) {
                        DAR += 6;
                        if( GET_FLAG( CF ) ) 
                            DAR++;
                        A &= 0x0F;
                        A |= (DAR << 4);
                    }
                    COND_SET_FLAG( op1, CF );
                    if( (DAR << 4) & 0x100 )
                        SET_FLAG( CF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    A &= 0xFF;
                    break;
                case 0x1A:
                    instruction_mnemonic = "NLDXX";
                    instruction_description = "(TekExtended) N Load IX <= M(indexed)?";
                    i = 0;
                    break;
                case 0x1B:
                    instruction_mnemonic = "ABA";
                    instruction_description = "(6800) A <= A + B";
                    op1 = B;
                    res = A + op1;
                    COND_SET_FLAG_H( (A ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0x1C:
                    instruction_mnemonic = "NLDAX";
                    instruction_description = "(TekExtended) N Load IX <= A?";
                    i = 0;
                    break;
                case 0x1D:
                    instruction_mnemonic = "NLDBX";
                    instruction_description = "(TekExtended) N Load IX <= B?";
                    i = 0;
                    break;
                case 0x1E:
                    instruction_mnemonic = "NSTAX";
                    instruction_description = "(TekExtended) N Store A <= IX?";
                    i = 0;
                    break;
                case 0x1F:
                    instruction_mnemonic = "JMPAX";
                    instruction_description = "(TekExtended) Jump A IX?";
                    i = 0;
                    break;
                case 0x20:
                    instruction_mnemonic = "BRA";
                    instruction_description = "(6800) Branch Always";
                    branch_relative( 1 );
                    break;
                case 0x21:
                    instruction_mnemonic = "SDB";
                    instruction_description = "(TekExtended) Store or subtract B <= D? Direct?";
                    i = 0;
                    break;
                case 0x22:
                    instruction_mnemonic = "BHI";
                    instruction_description = "(6800) Branch if Higher (unsigned)";
                    branch_relative( !(GET_FLAG(CF) | GET_FLAG(ZF)) );
                    break;
                case 0x23:
                    instruction_mnemonic = "BLS";
                    instruction_description = "(6800) Branch if Lower or Same (unsigned)";
                    branch_relative( GET_FLAG(CF) | GET_FLAG(ZF) );
                    break;
                case 0x24:
                    instruction_mnemonic = "BCC";
                    instruction_description = "(6800) Branch if Carry Clear (CF = 0)";
                    branch_relative( !GET_FLAG(CF) );
                    break;
                case 0x25:
                    instruction_mnemonic = "BCS";
                    instruction_description = "(6800) Branch if Carry Set (CF = 1)";
                    branch_relative( GET_FLAG(CF) );
                    break;
                case 0x26: 
                    instruction_mnemonic = "BNE";
                    instruction_description = "(6800) Branch if Not Equal (ZF = 0)";
                    branch_relative( !GET_FLAG(ZF) );
                    break;
                case 0x27:
                    instruction_mnemonic = "BEQ";
                    instruction_description = "(6800) Branch if Equal (ZF = 1)";
                    branch_relative( GET_FLAG(ZF) );
                    break;
                case 0x28:
                    instruction_mnemonic = "BVC";
                    instruction_description = "(6800) Branch if Overflow Clear (VF = 0)";
                    branch_relative( !GET_FLAG(VF) );
                    break;
                case 0x29:
                    instruction_mnemonic = "BVS";
                    instruction_description = "(6800) Branch if Overflow Set (VF = 1)";
                    branch_relative( GET_FLAG(VF) );
                    break;
                case 0x2A:
                    instruction_mnemonic = "BPL";
                    instruction_description = "(6800) Branch if Plus/Positive (N = 0)";
                    branch_relative( !GET_FLAG(NF) );
                    break;
                case 0x2B:
                    instruction_mnemonic = "BMI";
                    instruction_description = "(6800) Branch if Minus/Negative (N = 1)";
                    branch_relative( GET_FLAG(NF) );
                    break;
                case 0x2C:
                    instruction_mnemonic = "BGE";
                    instruction_description = "(6800) Branch if Greater or Equal (signed)";
                    branch_relative( !(GET_FLAG(NF) ^ GET_FLAG(VF)) );
                    break;
                case 0x2D:
                    instruction_mnemonic = "BLT";
                    instruction_description = "(6800) Branch if Less Than (signed)";
                    branch_relative( GET_FLAG(NF) ^ GET_FLAG(VF) );
                    break;
                case 0x2E:
                    instruction_mnemonic = "BGT";
                    instruction_description = "(6800) Branch if Greater Than (signed)";
                    branch_relative( !(GET_FLAG(ZF) | (GET_FLAG(NF) ^ GET_FLAG(VF))) );
                    break;
                case 0x2F:
                    instruction_mnemonic = "BLE";
                    instruction_description = "(6800) Branch if Less or Equal (signed)";
                    branch_relative( GET_FLAG(ZF) | (GET_FLAG(NF) ^ GET_FLAG(VF)) );
                    break;
                case 0x30:
                    instruction_mnemonic = "TSX";
                    instruction_description = "(6800) Transfer IX <= SP + 1";
                    IX = (SP + 1) & ADDR_MASK;
                    break;
                case 0x31:
                    instruction_mnemonic = "INS";
                    instruction_description = "(6800) Increment SP";
                    SP = (SP + 1) & ADDR_MASK;
                    break;
                case 0x32:
                    instruction_description = "(6800) Pull/Pop Stack to A";
                    instruction_mnemonic = "PUL A";
                    A = pop_byte();
                    break;
                case 0x33:
                    instruction_mnemonic = "PUL B";
                    instruction_description = "(6800) Pull/Pop Stack to B";
                    B = pop_byte();
                    break;
                case 0x34:
                    instruction_mnemonic = "DES";
                    instruction_description = "(6800) Decrement SP";
                    SP = (SP - 1) & ADDR_MASK;
                    break;
                case 0x35:
                    instruction_mnemonic = "TXS";
                    instruction_description = "(6800) Transfer SP <= IX - 1";
                    SP = (IX - 1) & ADDR_MASK;
                    break;
                case 0x36:
                    instruction_mnemonic = "PSH A";
                    instruction_description = "(6800) Push A to Stack";
                    push_byte( A );
                    break;
                case 0x37:
                    instruction_mnemonic = "PSH B";
                    instruction_description = "(6800) Push B to Stack";
                    push_byte( B );
                    break;
                case 0x38:
                    instruction_mnemonic = "JMPIN";
                    instruction_description = "(TekExtended) Jump IN? Extended";
                    i = 0;
                    break;
                case 0x39:
                    instruction_mnemonic = "RTS";
                    instruction_description = "(6800) Return from Subroutine - Pop Stack to PC";
                    PC = pop_word();
                    break;
                case 0x3A:
                    instruction_mnemonic = "FPSHD";
                    instruction_description = "(TekExtended) Function Push M(direct)";
                    i = 0;
                    break;
                case 0x3B:
                    instruction_mnemonic = "RTI";
                    instruction_description = "(6800) Return from Interrupt - Pop Stack and restore Registers";
                    CCR = pop_byte();
                    B   = pop_byte();
                    A   = pop_byte();
                    IX  = pop_word();
                    PC  = pop_word();
                    break;
                case 0x3C:
                    instruction_mnemonic = "FPSHX";
                    instruction_description = "(TekExtended) Function Push M(indexed)";
                    i = 0;
                    break;
                case 0x3D:
                    instruction_mnemonic = "FPSH";
                    instruction_description = "(TekExtended) Function Push M(extended)";
                    i = 0;
                    break;
                case 0x3E:
                    instruction_mnemonic = "WAI";
                    instruction_description = "(6800) Wait For Interrupt - Push Registers to Stack and jump to Reset vector";
                    push_word( PC  );
                    push_word( IX  );
                    push_byte( A   );
                    push_byte( B   );
                    push_byte( CCR );
                    if( GET_FLAG(IF) ) {
                        //@@@ reason = STOP_HALT;
                        //@@@ continue;
                    } else {
                        SET_FLAG( IF );
                        // Fetch the Reset vector for the PC to jump to the WAI routine
                        // This halts the processor until a non-maskable interrupt arrives
                        PC = readWord(RESET_VECTOR) & ADDR_MASK;
                    }
                    break;
                case 0x3F:
                    instruction_mnemonic = "SWI";
                    instruction_description = "(6800) Software Interrupt - Push Registers to Stack and jump to SWI vector";
                    push_word( PC  );
                    push_word( IX  );
                    push_byte( A   );
                    push_byte( B   );
                    push_byte( CCR );
                    SET_FLAG(  IF  );
                    // Fetch the SWI interrupt vector for the PC to jump to the SWI routine
                    PC = readWord(SWI_VECTOR) & ADDR_MASK;
                    break;
                case 0x40:
                    instruction_mnemonic = "NEG A";
                    instruction_description = "(6800) Negate A";
                    A = (0 - A) & 0xFF;
                    COND_SET_FLAG_V( A == 0x80 );
                    COND_SET_FLAG(   A == 0x00, CF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0x41:
                    instruction_mnemonic = "FPSHI";
                    instruction_description = "(TekExtended) Function Push Immediate";
                    i = 0;
                    break;
                case 0x3D:
                    instruction_mnemonic = "FPULD";
                    instruction_description = "(TekExtended) Function Pull/Pop from M(direct)?";
                    i = 0;
                    break;
                case 0x43:
                    instruction_mnemonic = "COM A";
                    instruction_description = "(6800) Ones Complement A";
                    A = (~A) & 0xFF;
                    CLR_FLAG( VF );
                    SET_FLAG( CF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0x44:
                    instruction_mnemonic = "LSR A";
                    instruction_description = "(6800) Logical Shift Right A";
                    COND_SET_FLAG( A & 0x01, CF );
                    A = (A >>> 1) & 0xFF;
                    CLR_FLAG( NF );
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x45:
                    instruction_mnemonic = "FPULX";
                    instruction_description = "(TekExtended) Function Pull/Pop from M(indexed)?";
                    i = 0;
                    break;
                case 0x46:
                    instruction_mnemonic = "ROR A";
                    instruction_description = "(6800) Rotate Right A";
                    hi = GET_FLAG( CF );
                    COND_SET_FLAG( A & 0x01, CF );
                    A = (A >>> 1) & 0xFF;
                    if( hi )
                        A |= 0x80;
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x47:
                    instruction_mnemonic = "ASR A";
                    instruction_description = "(6800) Arithmetic Shift Right A";
                    COND_SET_FLAG( A & 0x01, CF );
                    lo = A & 0x80;
                    A = (A >>> 1) & 0xFF;
                    A |= lo; 
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x48:
                    instruction_mnemonic = "ASL A";
                    instruction_description = "(6800) Arithmetic Shift Left A";
                    COND_SET_FLAG( A & 0x80, CF );
                    A = (A << 1) & 0xFF;
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x49:
                    instruction_mnemonic = "ROL A";
                    instruction_description = "(6800) Rotate Left A";
                    hi = GET_FLAG( CF );
                    COND_SET_FLAG( A & 0x80, CF );
                    A = (A << 1) & 0xFF;
                    if( hi )
                        A |= 0x01;
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x4A:
                    instruction_mnemonic = "DEC A";
                    instruction_description = "(6800) Decrement A";
                    COND_SET_FLAG_V( A == 0x80 );
                    A = (A - 1) & 0xFF;
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0x4B:
                    instruction_mnemonic = "FPUL";
                    instruction_description = "(TekExtended) Function Pull/Pop from M(extended)";
                    i = 0;
                    break;
                case 0x4C:
                    instruction_mnemonic = "INC A";
                    instruction_description = "(6800) Increment A";
                    COND_SET_FLAG_V( A == 0x7F );
                    A = (A + 1) & 0xFF;
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0x4D:
                    instruction_mnemonic = "TST A";
                    instruction_description = "(6800) Test A";
                    lo = (A - 0) & 0xFF;
                    CLR_FLAG( VF );
                    CLR_FLAG( CF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x4E:
                    instruction_mnemonic = "FDUP";
                    instruction_description = "(TekExtended) Function DUP? Duplicate?";
                    i = 0;
                    break;
                case 0x4F:
                    instruction_mnemonic = "CLR A";
                    instruction_description = "(6800) Clear A";
                    A = 0;
                    CLR_FLAG( NF );
                    CLR_FLAG( VF );
                    CLR_FLAG( CF );
                    SET_FLAG( ZF );
                    break;
                case 0x50:
                    instruction_mnemonic = "NEG B";
                    instruction_description = "(6800) Negate B";
                    B = (0 - B) & 0xFF;
                    COND_SET_FLAG_V( B == 0x80 );
                    COND_SET_FLAG(   B == 0x00, CF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0x51:
                    instruction_mnemonic = "FSWP";
                    instruction_description = "(TekExtended) Function SWP?";
                    i = 0;
                    break;
                case 0x52:
                    instruction_mnemonic = "FADD";
                    instruction_description = "(TekExtended) Function Add";
                    i = 0;
                    break;
                case 0x53:
                    instruction_mnemonic = "COM B";
                    instruction_description = "(6800) Ones Complement B";
                    B = (~B) & 0xFF;
                    CLR_FLAG( VF );
                    SET_FLAG( CF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0x54:
                    instruction_mnemonic = "LSR B";
                    instruction_description = "(6800) Logical Shift Right B";
                    COND_SET_FLAG( B & 0x01, CF );
                    B = (B >>> 1) & 0xFF;
                    CLR_FLAG( NF );
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x55:
                    instruction_mnemonic = "FSUB";
                    instruction_description = "(TekExtended) Function Subtract";
                    i = 0;
                    break;
                case 0x56:
                    instruction_mnemonic = "ROR B";
                    instruction_description = "(6800) Rotate Right B";
                    hi = GET_FLAG( CF );
                    COND_SET_FLAG( B & 0x01, CF );
                    B = (B >>> 1) & 0xFF;
                    if( hi )
                        B |= 0x80;
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x57:
                    instruction_mnemonic = "ASR B";
                    instruction_description = "(6800) Arithmetic Shift Right B";
                    COND_SET_FLAG( B & 0x01, CF );
                    lo = B & 0x80;
                    B = (B >>> 1) & 0xFF;
                    B |= lo; 
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF));
                    break;
                case 0x58:
                    instruction_mnemonic = "ASL B";
                    instruction_description = "(6800) Arithmetic Shift Left B";
                    COND_SET_FLAG( B & 0x80, CF );
                    B = (B << 1) & 0xFF;
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x59:
                    instruction_mnemonic = "ROL B";
                    instruction_description = "(6800) Rotate Left B";
                    hi = GET_FLAG( CF );
                    COND_SET_FLAG( B & 0x80, CF );
                    B = (B << 1) & 0xFF;
                    if( hi )
                        B |= 0x01;
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x5A:
                    instruction_mnemonic = "DEC B";
                    instruction_description = "(6800) Decrement B";
                    COND_SET_FLAG_V( B == 0x80 );
                    B = (B - 1) & 0xFF;
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0x5B:
                    instruction_mnemonic = "FMUL";
                    instruction_description = "(TekExtended) Function Multiply";
                    i = 0;
                    break;
                case 0x5C:
                    instruction_mnemonic = "INC B";
                    instruction_description = "(6800) Increment B";
                    COND_SET_FLAG_V( B == 0x7F );
                    B = (B + 1) & 0xFF;
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0x5D:
                    instruction_mnemonic = "TST B";
                    instruction_description = "(6800) Test B";
                    lo = (B - 0) & 0xFF;
                    CLR_FLAG( VF );
                    CLR_FLAG( CF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x5E:
                    instruction_mnemonic = "FDIV";
                    instruction_description = "(TekExtended) Function Divide";
                    i = 0;
                    break;
                case 0x5F:
                    instruction_mnemonic = "CLR B";
                    instruction_description = "(6800) Clear B";
                    B = 0;
                    CLR_FLAG( NF );
                    CLR_FLAG( VF );
                    CLR_FLAG( CF );
                    SET_FLAG( ZF );
                    break;
                case 0x60:
                    instruction_mnemonic = "NEG X";
                    instruction_description = "(6800) Negate M(indexed)";
                    DAR = get_indexed_addr();
                    lo = (0 - readByte( DAR ) ) & 0xFF;
                    writeByte( DAR, lo );
                    COND_SET_FLAG_V( lo == 0x80 );
                    COND_SET_FLAG(   lo == 0x00, CF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x61:
                    instruction_mnemonic = "FNORM";
                    instruction_description = "(TekExtended) Function Normalize";
                    i = 0;
                    break;
                case 0x62:
                    instruction_mnemonic = "PSHRET";
                    instruction_description = "(TekExtended) Push return address in M(direct) to stack?";
                    i = 0;
                    break;
                case 0x63:
                    instruction_mnemonic = "COM X";
                    instruction_description = "(6800) Ones complement M(indexed)";
                    DAR = get_indexed_addr();
                    lo = ~readByte( DAR );
                    lo &= 0xFF;
                    writeByte( DAR, lo );
                    CLR_FLAG( VF );
                    SET_FLAG( CF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x64:
                    instruction_mnemonic = "LSR X";
                    instruction_description = "(6800) Logical Shift Right M(indexed)";
                    DAR = get_indexed_addr();
                    lo = readByte( DAR );
                    COND_SET_FLAG( lo & 0x01, CF );
                    lo >>>= 1;
                    writeByte( DAR, lo );
                    CLR_FLAG( NF );
                    COND_SET_FLAG_Z( lo );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x65:
                    instruction_mnemonic = "RTRN";
                    instruction_description = "(TekExtended) Return to address in M(direct)? Direct";
                    i = 0;
                    break;
                case 0x66:
                    instruction_mnemonic = "ROR X";
                    instruction_description = "(6800) Rotate Right M(indexed)";
                    DAR = get_indexed_addr();
                    lo = readByte( DAR );
                    hi = GET_FLAG( CF );
                    COND_SET_FLAG( lo & 0x01, CF );
                    lo >>>= 1;
                    if( hi )
                        lo |= 0x80;
                    writeByte( DAR, lo );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x67:
                    instruction_mnemonic = "ASR X";
                    instruction_description = "(6800) Arithmetic Shift Right M(indexed)";
                    DAR = get_indexed_addr();
                    lo = readByte( DAR );
                    COND_SET_FLAG( lo & 0x01, CF );
                    lo = (lo & 0x80) | (lo >>> 1);
                    writeByte( DAR, lo );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x68:
                    instruction_mnemonic = "ASL X";
                    instruction_description = "(6800) Arithmetic Shift Left M(indexed)";
                    DAR = get_indexed_addr();
                    lo = readByte( DAR );
                    COND_SET_FLAG( lo & 0x80, CF );
                    lo <<= 1;
                    lo  &= 0xFF;
                    writeByte( DAR, lo );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x69:
                    instruction_mnemonic = "ROL X";
                    instruction_description = "(6800) Rotate Left M(indexed)";
                    DAR = get_indexed_addr();
                    lo = readByte( DAR );
                    hi = GET_FLAG( CF );
                    COND_SET_FLAG( lo & 0x80, CF );
                    lo <<= 1;
                    lo  &= 0xFF;
                    if( hi )
                        lo |= 0x01;
                    writeByte( DAR, lo );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x6A:
                    instruction_mnemonic = "DEC X";
                    instruction_description = "(6800) Decrement M(indexed)";
                    DAR = get_indexed_addr();
                    lo = readByte( DAR );
                    COND_SET_FLAG_V( lo == 0x80 );
                    lo = (lo - 1) & 0xFF;
                    writeByte( DAR, lo );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x6B:
                    instruction_mnemonic = "PSH X";
                    instruction_description = "(TekExtended) Push IX to Stack";
                    i = 0;
                    break;
                case 0x6C:
                    instruction_mnemonic = "INC X";
                    instruction_description = "(6800) Increment M(indexed)";
                    DAR= get_indexed_addr();
                    lo = readByte( DAR );
                    COND_SET_FLAG_V( lo == 0x7F );
                    lo = (lo + 1) & 0xFF;
                    writeByte( DAR, lo );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x6D:
                    instruction_mnemonic = "TST X";
                    instruction_description = "(6800) Test M(indexed)";
                    lo = (get_indexed_data() - 0) & 0xFF;
                    CLR_FLAG( VF );
                    CLR_FLAG( CF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x6E:
                    instruction_mnemonic = "JMP X";
                    instruction_description = "(6800) Jump to indexed address";
                    PC = get_indexed_addr();
                    break;
                case 0x6F:
                    instruction_mnemonic = "CLR X";
                    instruction_description = "(6800) Clear M(indexed)";
                    writeByte( get_indexed_addr(), 0 );
                    CLR_FLAG( NF );
                    CLR_FLAG( VF );
                    CLR_FLAG( CF );
                    SET_FLAG( ZF );
                    break;
                case 0x70:
                    instruction_mnemonic = "NEG";
                    instruction_description = "(6800) Negate M(extended)";
                    DAR = get_extended_addr();
                    lo = (0 - readByte( DAR )) & 0xFF;
                    writeByte( DAR, lo );                
                    COND_SET_FLAG_V( lo == 0x80 );
                    COND_SET_FLAG(   lo == 0x00, CF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x71:
                    instruction_mnemonic = "STROKE";
                    instruction_description = "(TekExtended) ???";
                    i = 0;
                    break;
                case 0x72:
                    instruction_mnemonic = "EC";
                    instruction_description = "(TekExtended) ??? Error Check?";
                    i = 0;
                    break;
                case 0x73:
                    instruction_mnemonic = "COM";
                    instruction_description = "(6800) Ones complement M(extended)";
                    DAR = get_extended_addr();
                    lo = ~readByte( DAR );
                    lo &= 0xFF;
                    writeByte( DAR, lo );
                    CLR_FLAG( VF );
                    SET_FLAG( CF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x74:
                    instruction_mnemonic = "LSR";
                    instruction_description = "(6800) Logical Shift Right M(extended)";
                    DAR = get_extended_addr();
                    lo = readByte( DAR );
                    COND_SET_FLAG( lo & 0x01, CF );
                    lo >>>= 1;
                    writeByte( DAR, lo );
                    CLR_FLAG( NF );
                    COND_SET_FLAG_Z( lo );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x75:
                    instruction_mnemonic = "PUL X";
                    instruction_description = "(TekExtended) Pull/Pop IX from Stack";
                    i = 0;
                    break;
                case 0x76:
                    instruction_mnemonic = "ROR";
                    instruction_description = "(6800) Rotate Right M(extended)";
                    DAR = get_extended_addr();
                    hi = GET_FLAG( CF );
                    lo = readByte( DAR );
                    COND_SET_FLAG( lo & 0x01, CF );
                    lo >>>= 1;
                    if( hi )
                        lo |= 0x80;
                    writeByte( DAR, lo );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x77:
                    instruction_mnemonic = "ASR";
                    instruction_description = "(6800) Arithmetic Shift Right M(extended)";
                    DAR = get_extended_addr();
                    lo = readByte( DAR );
                    COND_SET_FLAG( lo & 0x01, CF );
                    hi = lo & 0x80;
                    lo >>>= 1;
                    lo |= hi;
                    writeByte( DAR, lo );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x78:
                    instruction_mnemonic = "ASL";
                    instruction_description = "(6800) Arithmetic Shift Left M(extended)";
                    DAR = get_extended_addr();
                    lo = readByte( DAR );
                    COND_SET_FLAG( lo & 0x80, CF );
                    lo <<= 1;
                    lo  &= 0xFF;
                    writeByte( DAR, lo );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x79:
                    instruction_mnemonic = "ROL";
                    instruction_description = "(6800) Rotate Left M(extended)";
                    DAR = get_extended_addr();
                    lo = readByte( DAR );
                    hi = GET_FLAG( CF );
                    COND_SET_FLAG( lo & 0x80, CF );
                    lo <<= 1;
                    lo  &= 0xFF;
                    if( hi )
                        lo |= 0x01;
                    writeByte( DAR, lo );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    COND_SET_FLAG_V( GET_FLAG(NF) ^ GET_FLAG(CF) );
                    break;
                case 0x7A:
                    instruction_mnemonic = "DEC";
                    instruction_description = "(6800) Decrement M(extended)";
                    DAR = get_extended_addr();
                    lo = readByte( DAR );
                    COND_SET_FLAG_V( lo == 0x80 );
                    lo = (lo - 1) & 0xFF;
                    writeByte( DAR, lo );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x7C:
                    instruction_mnemonic = "INC";
                    instruction_description = "(6800) Increment M(extended)";
                    DAR = get_extended_addr();
                    lo = readByte( DAR );
                    COND_SET_FLAG_V( lo == 0x7F );
                    lo = (lo + 1) & 0xFF;
                    writeByte( DAR, lo );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x7D:
                    instruction_mnemonic = "TST";
                    instruction_description = "(6800) Test M(extended)";
                    lo = readByte( get_extended_addr() ) - 0;
                    CLR_FLAG( VF );
                    CLR_FLAG( CF );
                    COND_SET_FLAG_N( lo );
                    lo &= 0xFF;
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x7E:
                    instruction_mnemonic = "JMP";
                    instruction_description = "(6800) Jump to extended address";
                    PC = get_extended_addr() & ADDR_MASK;
                    break;
                case 0x7F:
                    instruction_mnemonic = "CLR";
                    instruction_description = "(6800) Clear M(extended)";
                    writeByte( get_extended_addr(), 0 );
                    CLR_FLAG( NF );
                    CLR_FLAG( VF );
                    CLR_FLAG( CF );
                    SET_FLAG( ZF );
                    break;
                case 0x80:
                    instruction_mnemonic = "SUB A";
                    instruction_description = "(6800) A <= A - immediate (8-bit)";
                    op1 = fetch_byte();
                    res = A - op1;
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0x81:
                    instruction_mnemonic = "CMP A";
                    instruction_description = "(6800) Compare A - immediate (8-bit)";
                    op1 = fetch_byte();
                    res = A - op1;
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    COND_SET_FLAG_Z( res & 0xFF );
                    COND_SET_FLAG_N( res & 0xFF );
                    break;
                case 0x82:
                    instruction_mnemonic = "SBC A";
                    instruction_description = "(6800) A <= A - immediate (8-bit) with carry";
                    op1 = fetch_byte();
                    res = A - op1 - GET_FLAG( CF );
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0x84:
                    instruction_mnemonic = "AND A";
                    instruction_description = "(6800) A <= A and immediate (8-bit)";
                    A = (A & fetch_byte()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0x85:
                    instruction_mnemonic = "BIT A";
                    instruction_description = "(6800) Bit test A and immediate (8-bit)";
                    lo = (A & fetch_byte()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x86:
                    instruction_mnemonic = "LDA A";
                    instruction_description = "(6800) Load A <= immediate (8-bit)";
                    A = fetch_byte();
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0x88:
                    instruction_mnemonic = "EOR A";
                    instruction_description = "(6800) A <= A xor immediate (8-bit)";
                    A = (A ^ fetch_byte()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0x89:
                    instruction_mnemonic = "ADC A";
                    instruction_description = "(6800) A <= A + immediate (8-bit) with carry";
                    op1 = fetch_byte();
                    res = A + op1 + GET_FLAG( CF );
                    COND_SET_FLAG_H( (A ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0x8A:
                    instruction_mnemonic = "ORA A";
                    instruction_description = "(6800) A <= A or immediate (8-bit)";
                    A = (A | fetch_byte()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0x8B:
                    instruction_mnemonic = "ADD A";
                    instruction_description = "(6800) A <= A + immediate (8-bit)";
                    op1 = fetch_byte();
                    res = A + op1;
                    COND_SET_FLAG_H( (A ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0x8C:
                    instruction_mnemonic = "CPX";
                    instruction_description = "(6800) Compare IX - immediate (16-bit)";
                    op1 = IX - fetch_word();
                    COND_SET_FLAG_Z( op1           );
                    COND_SET_FLAG_N( op1 >>> 8     );
                    COND_SET_FLAG_V( op1 & 0x10000 );
                    break;
                case 0x8D:
                    instruction_mnemonic = "BSR";
                    instruction_description = "(6800) Branch to Subroutine";
                    lo = get_relative_addr();
                    push_word( PC );
                    PC = PC + lo;
                    PC &= ADDR_MASK;
                    break;
                case 0x8E:
                    instruction_mnemonic = "LDS";
                    instruction_description = "(6800) Load Stack Pointer with extended address";
                    SP = get_extended_addr();
                    COND_SET_FLAG_N( SP >>> 8);
                    COND_SET_FLAG_Z( SP      );
                    CLR_FLAG( VF );
                    break;
                case 0x90:
                    instruction_mnemonic = "SUB A D";
                    instruction_description = "(6800) A <= A - M(direct)";
                    op1 = get_direct_data();
                    res = A - op1;
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0x91:
                    instruction_mnemonic = "CMP A D";
                    instruction_description = "(6800) Compare A - M(direct)";
                    op1 = get_direct_data();
                    res = A - op1;
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    COND_SET_FLAG_Z( res & 0xFF );
                    COND_SET_FLAG_N( res & 0xFF );
                    break;
                case 0x92:
                    instruction_mnemonic = "SBC A D";
                    instruction_description = "(6800) A <= A - M(direct) with carry";
                    op1 = get_direct_data();
                    res = A - op1 - GET_FLAG( CF );
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0x94:
                    instruction_mnemonic = "AND A D";
                    instruction_description = "(6800) A <= A and M(direct)";
                    A = (A & get_direct_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0x95:
                    instruction_mnemonic = "BIT A D";
                    instruction_description = "(6800) Bit test A and M(direct)";
                    lo = (A & get_direct_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0x96:
                    instruction_mnemonic = "LDA A D";
                    instruction_description = "(6800) Load A <= M(direct)";
                    A = get_direct_data();
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0x97:
                    instruction_mnemonic = "STA A D";
                    instruction_description = "(6800) Store M(direct) <= A";
                    writeByte( get_direct_addr(), A );
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0x98:
                    instruction_mnemonic = "EOR A D";
                    instruction_description = "(6800) A <= A xor M(direct)";
                    A = (A ^ get_direct_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0x99:
                    instruction_mnemonic = "ADC A D";
                    instruction_description = "(6800) A <= A + M(direct) with carry";
                    op1 = get_direct_data();
                    res = A + op1 + GET_FLAG( CF );
                    COND_SET_FLAG_H( (A ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0x9A:
                    instruction_mnemonic = "ORA A D";
                    instruction_description = "(6800) A <= A or M(direct)";
                    A = (A | get_direct_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0x9B:
                    instruction_mnemonic = "ADD A D";
                    instruction_description = "(6800) A <= A or M(direct)";
                    op1 = get_direct_data();
                    res = A + op1;
                    COND_SET_FLAG_H( (A ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0x9C:
                    instruction_mnemonic = "CPX D";
                    instruction_description = "(6800) Compare IX - M(direct)";
                    op1 = IX - readWord( get_direct_addr() );
                    COND_SET_FLAG_Z( op1           );
                    COND_SET_FLAG_N( op1 >>> 8     );
                    COND_SET_FLAG_V( op1 & 0x10000 );
                    break;
                case 0x9E:
                    instruction_mnemonic = "LDS D";
                    instruction_description = "(6800) Load SP <= M(direct)";
                    SP = readWord( get_direct_addr() );
                    COND_SET_FLAG_N( SP >>> 8 );
                    COND_SET_FLAG_Z( SP       );
                    CLR_FLAG( VF );
                    break;
                case 0x9F:
                    instruction_mnemonic = "STS D";
                    instruction_description = "(6800) Store M(direct) <= SP";
                    writeWord( get_direct_addr(), SP );
                    COND_SET_FLAG_N( SP >>> 8 );
                    COND_SET_FLAG_Z( SP       );
                    CLR_FLAG( VF );
                    break;
                case 0xA0:
                    instruction_mnemonic = "SUB A X";
                    instruction_description = "(6800) A <= A - M(indexed)";
                    op1 = get_indexed_data();
                    res = A - op1;
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0xA1:
                    instruction_mnemonic = "CMP A X";
                    instruction_description = "(6800) Compare A - M(indexed)";
                    op1 = get_indexed_data();
                    res = A - op1;
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    COND_SET_FLAG_Z( res & 0xFF );
                    COND_SET_FLAG_N( res & 0xFF );
                    break;
                case 0xA2:
                    instruction_mnemonic = "SBC A X";
                    instruction_description = "(6800) A <= A - M(indexed) with carry";
                    op1 = get_indexed_data();
                    res = A - op1 - GET_FLAG( CF );
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0xA4:
                    instruction_mnemonic = "AND A X";
                    instruction_description = "(6800) A <= A and M(indexed)";
                    A = (A & get_indexed_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0xA5:
                    instruction_mnemonic = "BIT A X";
                    instruction_description = "(6800) Bit test A and M(indexed)";
                    lo = (A & get_indexed_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0xA6:
                    instruction_mnemonic = "LDA A X";
                    instruction_description = "(6800) Load A <= M(indexed)";
                    A = get_indexed_data();
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0xA7:
                    instruction_mnemonic = "STA A X";
                    instruction_description = "(6800) Store M(indexed) <= A";
                    writeByte( get_indexed_addr(), A );
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0xA8:
                    instruction_mnemonic = "EOR A X";
                    instruction_description = "(6800) A <= A xor M(indexed)";
                    A = (A ^ get_indexed_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0xA9:
                    instruction_mnemonic = "ADC A X";
                    instruction_description = "(6800) A <= A + M(indexed) with carry";
                    op1 = get_indexed_data();
                    res = A + op1 + GET_FLAG( CF );
                    COND_SET_FLAG_H( (A ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0xAA:
                    instruction_mnemonic = "ORA A X";
                    instruction_description = "(6800) A <= A or M(indexed)";
                    A = (A | get_indexed_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0xAB:
                    instruction_mnemonic = "ADD A X";
                    instruction_description = "(6800) A <= A + M(indexed)";
                    op1 = get_indexed_data();
                    res = A + op1;
                    COND_SET_FLAG_H( (A ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0xAC:
                    instruction_mnemonic = "CPX X";
                    instruction_description = "(6800) Compare IX - M(indexed)";
                    op1 = (IX - get_indexed_addr()) & ADDR_MASK;
                    COND_SET_FLAG_Z( op1           );
                    COND_SET_FLAG_N( op1 >>> 8     );
                    COND_SET_FLAG_V( op1 & 0x10000 );
                    break;
                case 0xAD:
                    instruction_mnemonic = "JSR X";
                    instruction_description = "(6800) Jump to indexed address";
                    DAR = get_indexed_addr();
                    push_word( PC );
                    PC = DAR;
                    break;
                case 0xAE:
                    instruction_mnemonic = "LDS X";
                    instruction_description = "(6800) Load SP <= M(indexed)";
                    SP = readWord( get_indexed_addr() );
                    COND_SET_FLAG_N( SP >>> 8 );
                    COND_SET_FLAG_Z( SP       );
                    CLR_FLAG( VF );
                    break;
                case 0xAF:
                    instruction_mnemonic = "STS X";
                    instruction_description = "(6800) Store M(indexed) <= SP";
                    writeWord( get_indexed_addr(), SP );
                    COND_SET_FLAG_N( SP >>> 8 );
                    COND_SET_FLAG_Z( SP       );
                    CLR_FLAG( VF );
                    break;
                case 0xB0:
                    instruction_mnemonic = "SUB A";
                    instruction_description = "(6800) A <= A - M(extended)";
                    op1 = get_extended_data();
                    res = A - op1;
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0xB1:
                    instruction_mnemonic = "CMP A";
                    instruction_description = "(6800) Compare A - M(extended)";
                    op1 = get_extended_data();
                    res = A - op1;
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    COND_SET_FLAG_Z( res & 0xFF );
                    COND_SET_FLAG_N( res & 0xFF );
                    break;
                case 0xB2:
                    instruction_mnemonic = "SBC A";
                    instruction_description = "(6800) A <= A - M(extended) with carry";
                    op1 = get_extended_data();
                    res = A - op1 - GET_FLAG( CF );
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0xB4:
                    instruction_mnemonic = "AND A";
                    instruction_description = "(6800) A <= A and M(extended)";
                    A = (A & get_extended_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0xB5:
                    instruction_mnemonic = "BIT A";
                    instruction_description = "(6800) Bit test A and M(extended)";
                    lo = (A & get_extended_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0xB6:
                    instruction_mnemonic = "LDA A";
                    instruction_description = "(6800) Load A <= M(extended)";
                    A = get_extended_data();
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0xB7:
                    instruction_mnemonic = "STA A";
                    instruction_description = "(6800) Store M(extended) <= A";
                    writeByte( get_extended_addr(), A );
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0xB8:
                    instruction_mnemonic = "EOR A";
                    instruction_description = "(6800) A <= A xor M(extended)";
                    A = (A ^ get_extended_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0xB9:
                    instruction_mnemonic = "ADC A";
                    instruction_description = "(6800) A <= A + M(extended) with carry";
                    op1 = get_extended_data();
                    res = A + op1 + GET_FLAG( CF );
                    COND_SET_FLAG_H( (A ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0xBA:
                    instruction_mnemonic = "ORA A";
                    instruction_description = "(6800) A <= A or M(extended)";
                    A = (A | get_extended_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( A );
                    COND_SET_FLAG_Z( A );
                    break;
                case 0xBB:
                    instruction_mnemonic = "ADD A";
                    instruction_description = "(6800) A <= A + M(extended)";
                    op1 = get_extended_data();
                    res = A + op1;
                    COND_SET_FLAG_H( (A ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    A = res & 0xFF;
                    COND_SET_FLAG_Z( A );
                    COND_SET_FLAG_N( A );
                    break;
                case 0xBC:
                    instruction_mnemonic = "CPX";
                    instruction_description = "(6800) Compare IX - M(extended)";
                    op1 = (IX - readWord( get_extended_addr() ) ); // & ADDR_MASK;
                    COND_SET_FLAG_Z( op1           );
                    COND_SET_FLAG_N( op1 >>> 8     );
                    COND_SET_FLAG_V( op1 & 0x10000 );
                    break;
                case 0xBD:
                    instruction_mnemonic = "JSR";
                    instruction_description = "(6800) Jump to extended address";
                    DAR = get_extended_addr();
                    push_word( PC );
                    PC = DAR;
                    break;
                case 0xBE:
                    instruction_mnemonic = "LDS";
                    instruction_description = "(6800) Load SP <= M(extended)";
                    SP = readWord( get_extended_addr() );
                    COND_SET_FLAG_N( SP >>> 8 );
                    COND_SET_FLAG_Z( SP       );
                    CLR_FLAG( VF );
                    break;
                case 0xBF:
                    instruction_mnemonic = "STS";
                    instruction_description = "(6800) Store M(extended) <= SP";
                    writeWord( get_extended_addr(), SP );
                    COND_SET_FLAG_N( SP >>> 8 );
                    COND_SET_FLAG_Z( SP       );
                    CLR_FLAG( VF );
                    break;
                case 0xC0:
                    instruction_mnemonic = "SUB B I";
                    instruction_description = "(6800) B <= B - immediate (8-bit)";
                    op1 = fetch_byte();
                    res = B - op1;
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xC1:
                    instruction_mnemonic = "CMP B I";
                    instruction_description = "(6800) Compare B - immediate (8-bit)";
                    op1 = fetch_byte();
                    res = B - op1;
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    COND_SET_FLAG_Z( res & 0xFF );
                    COND_SET_FLAG_N( res & 0xFF );
                    break;
                case 0xC2:
                    instruction_mnemonic = "SBC B I";
                    instruction_description = "(6800) B <= B - immediate (8-bit) with carry";
                    op1 = fetch_byte();
                    res = B - op1 - GET_FLAG( CF );
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xC4:
                    instruction_mnemonic = "AND B I";
                    instruction_description = "(6800) B <= B and immediate (8-bit)";
                    B = (B & fetch_byte()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xC5:
                    instruction_mnemonic = "BIT B I";
                    instruction_description = "(6800) Bit test B and immediate (8-bit)";
                    lo = (B & fetch_byte()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0xC6:
                    instruction_mnemonic = "LDA B I";
                    instruction_description = "(6800) Load B <= immediate (8-bit)";
                    B = fetch_byte();
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xC8:
                    instruction_mnemonic = "EOR B I";
                    instruction_description = "(6800) B <= B xor immediate (8-bit)";
                    B = (B ^ fetch_byte()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xC9:
                    instruction_mnemonic = "ADC B I";
                    instruction_description = "(6800) B <= B + immediate (8-bit)";
                    op1 = fetch_byte();
                    res = B + op1 + GET_FLAG( CF );
                    COND_SET_FLAG_H( (B ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xCA:
                    instruction_mnemonic = "ORA B I";
                    instruction_description = "(6800) B <= B or immediate (8-bit)";
                    B = (B | fetch_byte()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xCB:
                    instruction_mnemonic = "ADD B I";
                    instruction_description = "(6800) B <= B + immediate (8-bit)";
                    op1 = fetch_byte();
                    res = B + op1;
                    COND_SET_FLAG_H( (B ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xCC:
                    instruction_mnemonic = "ADAX";
                    instruction_description = "(TekExtended) Add A to IX?";
                    i = 0;
                    break;
                case 0xCD:
                    instruction_mnemonic = "WADAX";
                    instruction_description = "(TekExtended) Wide Add A to IX?";
                    i = 0;
                    break;
                case 0xCE:
                    instruction_mnemonic = "LDX I";
                    instruction_description = "(6800) Load IX <= immediate (16-bit)";
                    IX = fetch_word();
                    COND_SET_FLAG_N( IX >>> 8 );
                    COND_SET_FLAG_Z( IX       );
                    CLR_FLAG( VF );
                    break;
                case 0xD0:
                    instruction_mnemonic = "SUB B D";
                    instruction_description = "(6800) B <= B - M(direct)";
                    op1 = get_direct_data();
                    res = B - op1;
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xD1:
                    instruction_mnemonic = "CMP B D";
                    instruction_description = "(6800) Compare B - M(direct)";
                    op1 = get_direct_data();
                    res = B - op1;
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    COND_SET_FLAG_Z( res & 0xFF );
                    COND_SET_FLAG_N( res & 0xFF );
                    break;
                case 0xD2:
                    instruction_mnemonic = "SBC B D";
                    instruction_description = "(6800) B <= B - M(direct) with carry";
                    op1 = get_direct_data();
                    res = B - op1 - GET_FLAG( CF );
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xD4:
                    instruction_mnemonic = "AND B D";
                    instruction_description = "(6800) B <= B and M(direct)";
                    B = (B & get_direct_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xD5:
                    instruction_mnemonic = "BIT B D";
                    instruction_description = "(6800) Bit test B and M(direct)";
                    lo = (B & get_direct_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0xD6:
                    instruction_mnemonic = "LDA B D";
                    instruction_description = "(6800) Load B <= M(direct)";
                    B = get_direct_data();
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xD7:
                    instruction_mnemonic = "STA B D";
                    instruction_description = "(6800) Store M(direct) <= B";
                    writeByte( get_direct_addr(), B );
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xD8:
                    instruction_mnemonic = "EOR B D";
                    instruction_description = "(6800) B <= B xor M(direct)";
                    B = (B ^ get_direct_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xD9:
                    instruction_mnemonic = "ADC B D";
                    instruction_description = "(6800) B <= B + M(direct) with carry";
                    op1 = get_direct_data();
                    res = B + op1 + GET_FLAG( CF );
                    COND_SET_FLAG_H( (B ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xDA:
                    instruction_mnemonic = "ORA B D";
                    instruction_description = "(6800) B <= B or M(direct)";
                    B = (B | get_direct_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xDB:
                    instruction_mnemonic = "ADD B D";
                    instruction_description = "(6800) B <= B + M(direct)";
                    op1 = get_direct_data();
                    res = B + op1;
                    COND_SET_FLAG_H( (B ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xDC:
                    instruction_mnemonic = "SBUG";
                    instruction_description = "(TekExtended) Software Bug?";
                    i = 0;
                    break;
                case 0xDD:
                    instruction_mnemonic = "CBUG";
                    instruction_description = "(TekExtended) C Bug?";
                    i = 0;
                    break;
                case 0xDE:
                    instruction_mnemonic = "LDX D";
                    instruction_description = "(6800) Load IX <= M(direct)";
                    IX = readWord( get_direct_addr() );
                    COND_SET_FLAG_N( IX >>> 8 );
                    COND_SET_FLAG_Z( IX       );
                    CLR_FLAG( VF );
                    break;
                case 0xDF:
                    instruction_mnemonic = "STX D";
                    instruction_description = "(6800) Store M(direct) <= IX";
                    writeWord( get_direct_addr(), IX );
                    COND_SET_FLAG_N( IX >>> 8 );
                    COND_SET_FLAG_Z( IX       );
                    CLR_FLAG( VF );
                    break;
                case 0xE0:
                    instruction_mnemonic = "SUB B X";
                    instruction_description = "(6800) B <= B - M(indexed)";
                    op1 = get_indexed_data();
                    res = B - op1;
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xE1:
                    instruction_mnemonic = "CMP B X";
                    instruction_description = "(6800) Compare B - M(indexed)";
                    op1 = get_indexed_data();
                    res = B - op1;
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    COND_SET_FLAG_Z( res & 0xFF );
                    COND_SET_FLAG_N( res & 0xFF );
                    break;
                case 0xE2:
                    instruction_mnemonic = "SBC B X";
                    instruction_description = "(6800) B <= B - M(indexed) with carry";
                    op1 = get_indexed_data();
                    res = B - op1 - GET_FLAG( CF );
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xE3:
                    instruction_mnemonic = "MVLR";
                    instruction_description = "(TekExtended) ???";
                    i = 0;
                    break;
                case 0xE4:
                    instruction_mnemonic = "AND B X";
                    instruction_description = "(6800) B <= B and M(indexed)";
                    B = (B & get_indexed_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xE5:
                    instruction_mnemonic = "BIT B X";
                    instruction_description = "(6800) Bit test B and M(indexed)";
                    lo = (B & get_indexed_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0xE6:
                    instruction_mnemonic = "LDA B X";
                    instruction_description = "(6800) Load B <= M(indexed)";
                    B = get_indexed_data();
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xE7:
                    instruction_mnemonic = "STA B X";
                    instruction_description = "(6800) Store M(indexed) <= B";
                    writeByte( get_indexed_addr(), B );
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xE8:
                    instruction_mnemonic = "EOR B X";
                    instruction_description = "(6800) B <= B xor M(indexed)";
                    B = (B ^ get_indexed_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xE9:
                    instruction_mnemonic = "ADC B X";
                    instruction_description = "(6800) B <= B + M(indexed) with carry";
                    op1 = get_indexed_data();
                    res = B + op1 + GET_FLAG( CF );
                    COND_SET_FLAG_H( (B ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xEA:
                    instruction_mnemonic = "ORA B X";
                    instruction_description = "(6800) B <= B or M(indexed)";
                    B = (B | get_indexed_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xEB:
                    instruction_mnemonic = "ADD B X";
                    instruction_description = "(6800) B <= B + M(indexed)";
                    op1 = get_indexed_data();
                    res = B + op1;
                    COND_SET_FLAG_H( (B ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xEC:
                    instruction_mnemonic = "MVRL";
                    instruction_description = "(TekExtended) ???";
                    i = 0;
                    break;
                case 0xED:
                    instruction_mnemonic = "WADX";
                    instruction_description = "(TekExtended) ??? Extended";
                    i = 0;
                    break;
                case 0xEE:
                    instruction_mnemonic = "LDX X";
                    instruction_description = "(6800) Load IX <= M(indexed)";
                    IX = readWord( get_indexed_addr() );
                    COND_SET_FLAG_N( IX >>> 8 );
                    COND_SET_FLAG_Z( IX       );
                    CLR_FLAG( VF );
                    break;
                case 0xEF:
                    instruction_mnemonic = "STX X";
                    instruction_description = "(6800) Store M(indexed) <= IX";
                    writeWord( get_indexed_addr(), IX );
                    COND_SET_FLAG_N( IX >>> 8 );
                    COND_SET_FLAG_Z( IX       );
                    CLR_FLAG( VF );
                    break;
                case 0xF0:
                    instruction_mnemonic = "SUB B";
                    instruction_description = "(6800) B <= B - M(extended)";
                    op1 = get_extended_data();
                    res = B - op1;
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xF1:
                    instruction_mnemonic = "CMP B";
                    instruction_description = "(6800) Compare B - M(extended)";
                    op1 = get_extended_data();
                    res = B - op1;
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    COND_SET_FLAG_Z( res & 0xFF );
                    COND_SET_FLAG_N( res & 0xFF );
                    break;
                case 0xF2:
                    instruction_mnemonic = "SBC B";
                    instruction_description = "(6800) B <= B - M(extended) with carry";
                    op1 = get_extended_data();
                    res = B - op1 - GET_FLAG( CF );
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xF3:
                    instruction_mnemonic = "CPCH";
                    instruction_description = "(TekExtended) ??? Immediate";
                    i = 0;
                    break;
                case 0xF4:
                    instruction_mnemonic = "AND B";
                    instruction_description = "(6800) B <= B and M(extended)";
                    B = (B & get_extended_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xF5:
                    instruction_mnemonic = "BIT B";
                    instruction_description = "(6800) Bit test B and M(extended)";
                    lo = (B & get_extended_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( lo );
                    COND_SET_FLAG_Z( lo );
                    break;
                case 0xF6:
                    instruction_mnemonic = "LDA B";
                    instruction_description = "(6800) Load B <= M(extended)";
                    B = get_extended_data();
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xF7:
                    instruction_mnemonic = "STA B";
                    instruction_description = "(6800) Store M(extended) <= B";
                    writeByte( get_extended_addr(), B );
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xF8:
                    instruction_mnemonic = "EOR B";
                    instruction_description = "(6800) B <= B xor M(extended)";
                    B = (B ^ get_extended_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xF9:
                    instruction_mnemonic = "ADC B";
                    instruction_description = "(6800) B <= B + M(extended)";
                    op1 = get_extended_data();
                    res = B + op1 + GET_FLAG( CF );
                    COND_SET_FLAG_H( (B ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xFA:
                    instruction_mnemonic = "ORA B";
                    instruction_description = "(6800) B <= B or M(extended)";
                    B = (B | get_extended_data()) & 0xFF;
                    CLR_FLAG( VF );
                    COND_SET_FLAG_N( B );
                    COND_SET_FLAG_Z( B );
                    break;
                case 0xFB:
                    instruction_mnemonic = "ADD B";
                    instruction_description = "(6800) B <= B + M(extended)";
                    op1 = get_extended_data();
                    res = B + op1;
                    COND_SET_FLAG_H( (B ^ op1 ^ res) & 0x10 );
                    COND_SET_FLAG_V( (B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                    COND_SET_FLAG_C( res );
                    B = res & 0xFF;
                    COND_SET_FLAG_Z( B );
                    COND_SET_FLAG_N( B );
                    break;
                case 0xFD:
                    instruction_mnemonic = "PCH";
                    instruction_description = "(TekExtended) ??? Immediate";
                    i = 0;
                    break;
                case 0xFE:
                    instruction_mnemonic = "LDX";
                    instruction_description = "(6800) Load IX <= M(extended)";
                    IX = readWord( get_extended_addr() );
                    COND_SET_FLAG_N( IX >>> 8 );
                    COND_SET_FLAG_Z( IX       );
                    CLR_FLAG( VF );
                    break;
                case 0xFF:
                    instruction_mnemonic = "STX";
                    instruction_description = "(6800) Store M(extended) <= IX";
                    writeWord( get_extended_addr(), IX );
                    COND_SET_FLAG_N( IX >>> 8 );
                    COND_SET_FLAG_Z( IX       );
                    CLR_FLAG( VF );
                    break;
                default:
                    this.println('MC6800.js illegal instruction: ' + this.ReturnHex( lastPC, 4 ) + " => " + this.ReturnHex(IR,2));
                    i = 0;
                    break;

			} // End of switch IR.	
        
		} // End for loop.
		
		// This only logs the last instruction at the end of the execute() interval
        if (DebugExecutePrint) {
            console.log(ReturnHex( lastPC, 4 ) + " => " + 
                        ReturnHex(IR,2) + " " + 
                        instruction_mnemonic + " " + 
                        instruction_operand + " " + 
                        instruction_description);
        }
        
	} // End of function execute.
	
	
	// -------------------------------------------------------------------------------------
	// Miscellaneous functions
	// -------------------------------------------------------------------------------------
	
    this.reset = function() {
        A   = 0x00;
		B   = 0x00;
		IX  = 0x0000;
		PC  = readWord( RESET_VECTOR );
		SP  = 0x0000;
		CCR = CCR_ALWAYS_ON | IF;
    }

	// -------------------------------------------------------------------------------------
	// Debug helper functions
	// -------------------------------------------------------------------------------------
	
    function ReturnHex( i, j ) {
		string = "";
		for( var i_72_ = j-1; i_72_ >= 0; i_72_-- ) {
	
	    	var i_73_ = (i >>> (i_72_ * 4)) & 0xf;
	    	switch( i_73_ ) {
	    		case  0: string += "0"; break;
	    		case  1: string += "1"; break;
	    		case  2: string += "2"; break;
	    		case  3: string += "3"; break;
	    		case  4: string += "4"; break;
	    		case  5: string += "5"; break;
	    		case  6: string += "6"; break;
	    		case  7: string += "7"; break;
	    		case  8: string += "8"; break;
	    		case  9: string += "9"; break;
	    		case 10: string += "A"; break;
	    		case 11: string += "B"; break;
	    		case 12: string += "C"; break;
	    		case 13: string += "D"; break;
	    		case 14: string += "E"; break;
	    		case 15: string += "F"; break;
	    	}
		}
		return string;
    }

} // End function TekCpu.
