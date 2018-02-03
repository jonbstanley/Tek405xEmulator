
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

function MC6800( d ) {

    this.steps = 0; //steps since reset
    this.der_icount = 0;
    this.last_PC = 0xDEAD;

    this.instruction_operand = "";
    
    this.tstatesPerInterrupt = 0;

	// NOTE: The Motorola MC6800 stores the most significant byte of a word at the lower address.
	
	this.A   = 0x00;   // Accumulator A (8 bits).
	this.B   = 0x00;   // Accumulator B (8 bits).
	this.IX  = 0x0000; // Index register (16 bits).
	this.PC  = 0x0000; // Program counter (16 bits).
	this.SP  = 0x0000; // Stack pointer (16 bits).
	this.CCR = 0x00;   // Condition codes (8 separate bits)..
	
	// Flag values to set proper positions in CCR .
	this.HF = 0x20;
	this.IF = 0x10;
	this.NF = 0x08;
	this.ZF = 0x04;
	this.VF = 0x02;
	this.CF = 0x01;

	this.oldNMI = 0;
	this.oldIRQ = 0;
	
	this.ADDRMASK = 0xFFFF; // 16 bits.
	
	this.CCR_ALWAYS_ON = 0xC0; // For a 6800.
	
	this.CCR_MSK = this.HF | this.IF | this.NF | this.ZF | this.VF | this.CF;
	
	this.TOGGLE_FLAG = function( FLAG ) {
		this.CCR ^= FLAG;
	}

	this.SET_FLAG = function( FLAG ) {
		this.CCR |= FLAG;
	}
	
	this.CLR_FLAG = function( FLAG ) {
		this.CCR &= ~FLAG;
	}

	this.GET_FLAG_BITS = function( FLAG ) {
		return this.CCR & FLAG;
	}

	this.COND_SET_FLAG = function( COND, FLAG ) {
		if( COND ) this.SET_FLAG( FLAG ); 
		else       this.CLR_FLAG( FLAG );
	}

	this.COND_SET_FLAG_N = function( VAR ) {
		if( VAR & 0x80 ) this.SET_FLAG( this.NF );
		else             this.CLR_FLAG( this.NF );
	}
		
	this.COND_SET_FLAG_Z = function( VAR ) {
		if( VAR == 0 ) this.SET_FLAG( this.ZF );
		else           this.CLR_FLAG( this.ZF );
	}
		
	this.COND_SET_FLAG_H = function( COND ) {
		if( COND ) this.SET_FLAG( this.HF );
		else       this.CLR_FLAG( this.HF );
	}
		
	this.COND_SET_FLAG_C = function( VAR ) {
		if( VAR & 0x100 ) this.SET_FLAG( this.CF );
		else              this.CLR_FLAG( this.CF );
	}
		
	this.COND_SET_FLAG_V = function( COND ) {
		if( COND ) this.SET_FLAG( this.VF );
		else       this.CLR_FLAG( this.VF );
	}
		
	this.execute = function() {
	
		var IR, OP, DAR, reason, hi, lo, op1, res;
		
		var i = -(this.tstatesPerInterrupt - this.interrupt());

		if( this.der_icount > 0 ) {
			this.DumpRegisters();
		} // End if this.der_icount > 0
		
		while( i < 0 ) {

		    this.last_PC = this.PC;
		    
		    this.instruction_operand = ""; /* Not identified yet. */

		    i += 1; //BODGE
		    
		    // if( (this.last_PC == 0xBC6E) && (this.der_icount == 0) )
		    //    this.der_icount = 2000;

		    if( this.last_PC == 0xCBBF ) this.println( 'DER: MC6800.js >>>>> CRTRST: <<<<<' );
		    // if( this.last_PC == 0xC888 ) this.println( 'DER: MC6800.js >>>>> CHSCAN: <<<<<' );
		    // if( this.last_PC == 0xCBEE ) this.println( 'DER: MC6800.js >>>>>  PCHAR: <<<<<' );
		    
		    // if( this.last_PC == 0xC5B2 ) this.println( 'DER: MC6800.js >>>>>   IDLE: <<<<<' );
		    // if( this.last_PC == 0xC65C ) this.println( 'DER: MC6800.js >>>>>  CIDLE: <<<<<' );
		    
		    // if( (this.last_PC >= 0xF4B0) && (this.last_PC <= 0xF7A9) ) {
		    // 	this.print( 'IECDEBUG: PC=0x' ); this.printHex4( this.last_PC ); this.println( '' ); 
		    // } // End if
		    
		    if( this.checkNMI() ) {
		    	if( !this.oldNMI ) {
                	this.push_word( this.PC  );
                	this.push_word( this.IX  );
                	this.push_byte( this.A   );
                	this.push_byte( this.B   );
                	this.push_byte( this.CCR );
                	this.SET_FLAG(  this.IF  );
                	this.PC = this.CPU_BD_get_mword(0xFFFC) & this.ADDRMASK;
           			this.last_PC = this.PC;
                	this.println('DER: MC6800.js >>>>> NMI <<<<<' );
		    	} // End if
		    	this.oldNMI = 1;
		    } else {
		    	this.oldNMI = 0;
		    	if( this.checkIRQ() ) {
		    		if( !this.GET_FLAG_BITS( this.IF ) ) {
		    			if( !this.oldIRQ ) {
                			this.push_word( this.PC  );
                			this.push_word( this.IX  );
                			this.push_byte( this.A   );
                			this.push_byte( this.B   );
                			this.push_byte( this.CCR );
                			this.SET_FLAG(  this.IF  );
                			this.PC = this.CPU_BD_get_mword(0xFFF8) & this.ADDRMASK;
                			this.last_PC = this.PC;
                			// this.println('DER: MC6800.js >>>>> IRQ <<<<<' );
                			// this.der_icount = 200;
		    			} // End if
		    			this.oldIRQ = 1;
		    		} else {
		    			this.oldIRQ = 0;
		    		} // End if
		    	} else {
		    		this.oldIRQ = 0;
		    	} // End if
		    } // End if
		    
			OP = this.fetch_byte(); IR = OP;
			
			switch( IR ) {

            case 0x01:                  /* NOP */
                break;
            case 0x06:                  /* TAP */
                this.CCR = this.A; //DER: Technically not correct for bits 7 and 6!
                break;
            case 0x07:                  /* TPA */
                this.A = this.CCR | this.CCR_ALWAYS_ON;
                break;
            case 0x08:                  /* INX */
                this.IX = (this.IX + 1) & this.ADDRMASK;
                this.COND_SET_FLAG_Z( this.IX );
                break;
            case 0x09:                  /* DEX */
                this.IX = (this.IX - 1) & this.ADDRMASK;
                this.COND_SET_FLAG_Z( this.IX );
                break;
            case 0x0A:                  /* CLV */
                this.CLR_FLAG( this.VF );
                break;
            case 0x0B:                  /* SEV */
                this.SET_FLAG( this.VF );
                break;
            case 0x0C:                  /* CLC */
                this.CLR_FLAG( this.CF );
                break;
            case 0x0D:                  /* SEC */
                this.SET_FLAG( this.CF );
                break;
            case 0x0E:                  /* CLI */
                this.CLR_FLAG( this.IF );
                break;
            case 0x0F:                  /* SEI */
                this.SET_FLAG( this.IF );
                break;
            case 0x10:                  /* SBA */
                op1 = this.B;
                res = this.A - op1;
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0x11:                  /* CBA */
                op1 = this.B;
                res = this.A - op1;
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.COND_SET_FLAG_Z( res & 0xFF );
                this.COND_SET_FLAG_N( res & 0xFF );
                break;
            case 0x16:                  /* TAB */
                this.B = this.A;
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                this.CLR_FLAG( this.VF );
                break;
            case 0x17:                  /* TBA */
                this.A = this.B;
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                this.CLR_FLAG( this.VF );
                break;
            case 0x19:                  /* DAA */
                DAR = this.A & 0x0F;
                op1 = this.get_flag( this.CF );
                if( (DAR > 9) || this.get_flag( this.CF ) ) {
                    DAR += 6;
                    this.A &= 0xF0;
                    this.A |= (DAR & 0x0F);
                    this.COND_SET_FLAG( DAR & 0x10, this.CF );
                } // End if.
                DAR = (this.A >>> 4) & 0x0F;
                if( (DAR > 9) || this.get_flag( this.CF ) ) {
                    DAR += 6;
                    if( this.get_flag( this.CF ) ) 
                        DAR++;
                    this.A &= 0x0F;
                    this.A |= (DAR << 4);
                }
                this.COND_SET_FLAG( op1, this.CF );
                if( (DAR << 4) & 0x100 )
                    this.SET_FLAG( this.CF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                this.A &= 0xFF;
                break;
            case 0x1B:                  /* ABA */
                op1 = this.B;
                res = this.A + op1;
                this.COND_SET_FLAG_H( (this.A ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0x20:                  /* BRA rel */
                this.go_rel( 1 );
                break;
            case 0x22:                  /* BHI rel */
                this.go_rel( !(this.get_flag(this.CF) | this.get_flag(this.ZF)) );
                break;
            case 0x23:                  /* BLS rel */
                this.go_rel( this.get_flag(this.CF) | this.get_flag(this.ZF) );
                break;
            case 0x24:                  /* BCC rel */
                this.go_rel( !this.get_flag(this.CF) );
                break;
            case 0x25:                  /* BCS rel */
                this.go_rel( this.get_flag(this.CF) );
                break;
            case 0x26:                  /* BNE rel */
                this.go_rel( !this.get_flag(this.ZF) );
                break;
            case 0x27:                  /* BEQ rel */
                this.go_rel( this.get_flag(this.ZF) );
                break;
            case 0x28:                  /* BVC rel */
                this.go_rel( !this.get_flag(this.VF) );
                break;
            case 0x29:                  /* BVS rel */
                this.go_rel( this.get_flag(this.VF) );
                break;
            case 0x2A:                  /* BPL rel */
                this.go_rel( !this.get_flag(this.NF) );
                break;
            case 0x2B:                  /* BMI rel */
                this.go_rel( this.get_flag(this.NF) );
                break;
            case 0x2C:                  /* BGE rel */
                this.go_rel( !(this.get_flag(this.NF) ^ this.get_flag(this.VF)) );
                break;
            case 0x2D:                  /* BLT rel */
                this.go_rel( this.get_flag(this.NF) ^ this.get_flag(this.VF) );
                break;
            case 0x2E:                  /* BGT rel */
                this.go_rel( !(this.get_flag(this.ZF) | (this.get_flag(this.NF) ^ this.get_flag(this.VF))) );
                break;
            case 0x2F:                  /* BLE rel */
                this.go_rel( this.get_flag(this.ZF) | (this.get_flag(this.NF) ^ this.get_flag(this.VF)) );
                break;
            case 0x30:                  /* TSX */
                this.IX = (this.SP + 1) & this.ADDRMASK;
                break;
            case 0x31:                  /* INS */
                this.SP = (this.SP + 1) & this.ADDRMASK;
                break;
            case 0x32:                  /* PUL A */
                this.A = this.pop_byte();
                break;
            case 0x33:                  /* PUL B */
                this.B = this.pop_byte();
                break;
            case 0x34:                  /* DES */
                this.SP = (this.SP - 1) & this.ADDRMASK;
                break;
            case 0x35:                  /* TXS */
                this.SP = (this.IX - 1) & this.ADDRMASK;
                break;
            case 0x36:                  /* PSH A */
                this.push_byte( this.A );
                break;
            case 0x37:                  /* PSH B */
                this.push_byte( this.B );
                break;
            case 0x39:                  /* RTS */
                this.PC = this.pop_word();
                break;
            case 0x3B:                  /* RTI */
                this.CCR = this.pop_byte();
                this.B   = this.pop_byte();
                this.A   = this.pop_byte();
                this.IX  = this.pop_word();
                this.PC  = this.pop_word();
                break;
            case 0x3E:                  /* WAI */
                this.push_word( this.PC  );
                this.push_word( this.IX  );
                this.push_byte( this.A   );
                this.push_byte( this.B   );
                this.push_byte( this.CCR );
                if( this.get_flag(this.IF) ) {
                    //@@@ reason = STOP_HALT;
                    //@@@ continue;
                } else {
                    this.SET_FLAG( this.IF );
                    this.PC = this.CPU_BD_get_mword(0xFFFE) & this.ADDRMASK;
                }
                break;
            case 0x3F:                  /* SWI */
                this.push_word( this.PC  );
                this.push_word( this.IX  );
                this.push_byte( this.A   );
                this.push_byte( this.B   );
                this.push_byte( this.CCR );
                this.SET_FLAG(  this.IF  );
                this.PC = this.CPU_BD_get_mword(0xFFFA) & this.ADDRMASK;
                break;
            case 0x40:                  /* NEG A */
                this.A = (0 - this.A) & 0xFF;
                this.COND_SET_FLAG_V( this.A == 0x80 );
                this.COND_SET_FLAG(   this.A == 0x00, this.CF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0x43:                  /* COM A */
                this.A = (~this.A) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.SET_FLAG( this.CF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0x44:                  /* LSR A */
                this.COND_SET_FLAG( this.A & 0x01, this.CF );
                this.A = (this.A >>> 1) & 0xFF;
                this.CLR_FLAG( this.NF );
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x46:                  /* ROR A */
                hi = this.get_flag( this.CF );
                this.COND_SET_FLAG( this.A & 0x01, this.CF );
                this.A = (this.A >>> 1) & 0xFF;
                if( hi )
                    this.A |= 0x80;
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x47:                  /* ASR A */
                this.COND_SET_FLAG( this.A & 0x01, this.CF );
                lo = this.A & 0x80;
                this.A = (this.A >>> 1) & 0xFF;
                this.A |= lo; 
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x48:                  /* ASL A */
                this.COND_SET_FLAG( this.A & 0x80, this.CF );
                this.A = (this.A << 1) & 0xFF;
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x49:                  /* ROL A */
                hi = this.get_flag( this.CF );
                this.COND_SET_FLAG( this.A & 0x80, this.CF );
                this.A = (this.A << 1) & 0xFF;
                if( hi )
                    this.A |= 0x01;
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x4A:                  /* DEC A */
                this.COND_SET_FLAG_V( this.A == 0x80 );
                this.A = (this.A - 1) & 0xFF;
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0x4C:                  /* INC A */
                this.COND_SET_FLAG_V( this.A == 0x7F );
                this.A = (this.A + 1) & 0xFF;
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0x4D:                  /* TST A */
                lo = (this.A - 0) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.CLR_FLAG( this.CF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x4F:                  /* CLR A */
                this.A = 0;
                this.CLR_FLAG( this.NF );
                this.CLR_FLAG( this.VF );
                this.CLR_FLAG( this.CF );
                this.SET_FLAG( this.ZF );
                break;
            case 0x50:                  /* NEG B */
                this.B = (0 - this.B) & 0xFF;
                this.COND_SET_FLAG_V( this.B == 0x80 );
                this.COND_SET_FLAG(   this.B == 0x00, this.CF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0x53:                  /* COM B */
                this.B = (~this.B) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.SET_FLAG( this.CF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0x54:                  /* LSR B */
                this.COND_SET_FLAG( this.B & 0x01, this.CF );
                this.B = (this.B >>> 1) & 0xFF;
                this.CLR_FLAG( this.NF );
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x56:                  /* ROR B */
                hi = this.get_flag( this.CF );
                this.COND_SET_FLAG( this.B & 0x01, this.CF );
                this.B = (this.B >>> 1) & 0xFF;
                if( hi )
                    this.B |= 0x80;
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x57:                  /* ASR B */
                this.COND_SET_FLAG( this.B & 0x01, this.CF );
                lo = this.B & 0x80;
                this.B = (this.B >>> 1) & 0xFF;
                this.B |= lo; 
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF));
                break;
            case 0x58:                  /* ASL B */
                this.COND_SET_FLAG( this.B & 0x80, this.CF );
                this.B = (this.B << 1) & 0xFF;
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x59:                  /* ROL B */
                hi = this.get_flag( this.CF );
                this.COND_SET_FLAG( this.B & 0x80, this.CF );
                this.B = (this.B << 1) & 0xFF;
                if( hi )
                    this.B |= 0x01;
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x5A:                  /* DEC B */
                this.COND_SET_FLAG_V( this.B == 0x80 );
                this.B = (this.B - 1) & 0xFF;
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0x5C:                  /* INC B */
                this.COND_SET_FLAG_V( this.B == 0x7F );
                this.B = (this.B + 1) & 0xFF;
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0x5D:                  /* TST B */
                lo = (this.B - 0) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.CLR_FLAG( this.CF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x5F:                  /* CLR B */
                this.B = 0;
                this.CLR_FLAG( this.NF );
                this.CLR_FLAG( this.VF );
                this.CLR_FLAG( this.CF );
                this.SET_FLAG( this.ZF );
                break;
            case 0x60:                  /* NEG ind */
                DAR = this.get_indir_addr();
                lo = (0 - this.CPU_BD_get_mbyte( DAR ) ) & 0xFF;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.COND_SET_FLAG_V( lo == 0x80 );
                this.COND_SET_FLAG(   lo == 0x00, this.CF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x63:                  /* COM ind */
                DAR = this.get_indir_addr();
                lo = ~this.CPU_BD_get_mbyte( DAR );
                lo &= 0xFF;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.CLR_FLAG( this.VF );
                this.SET_FLAG( this.CF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x64:                  /* LSR ind */
                DAR = this.get_indir_addr();
                lo = this.CPU_BD_get_mbyte( DAR );
                this.COND_SET_FLAG( lo & 0x01, this.CF );
                lo >>>= 1;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.CLR_FLAG( this.NF );
                this.COND_SET_FLAG_Z( lo );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x66:                  /* ROR ind */
                DAR = this.get_indir_addr();
                lo = this.CPU_BD_get_mbyte( DAR );
                hi = this.get_flag( this.CF );
                this.COND_SET_FLAG( lo & 0x01, this.CF );
                lo >>>= 1;
                if( hi )
                    lo |= 0x80;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x67:                  /* ASR ind */
                DAR = this.get_indir_addr();
                lo = this.CPU_BD_get_mbyte( DAR );
                this.COND_SET_FLAG( lo & 0x01, this.CF );
                lo = (lo & 0x80) | (lo >>> 1);
                this.CPU_BD_put_mbyte( DAR, lo );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x68:                  /* ASL ind */
                DAR = this.get_indir_addr();
                lo = this.CPU_BD_get_mbyte( DAR );
                this.COND_SET_FLAG( lo & 0x80, this.CF );
                lo <<= 1;
                lo  &= 0xFF;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x69:                  /* ROL ind */
                DAR = this.get_indir_addr();
                lo = this.CPU_BD_get_mbyte( DAR );
                hi = this.get_flag( this.CF );
                this.COND_SET_FLAG( lo & 0x80, this.CF );
                lo <<= 1;
                lo  &= 0xFF;
                if( hi )
                    lo |= 0x01;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x6A:                  /* DEC ind */
                DAR = this.get_indir_addr();
                lo = this.CPU_BD_get_mbyte( DAR );
                this.COND_SET_FLAG_V( lo == 0x80 );
                lo = (lo - 1) & 0xFF;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x6C:                  /* INC ind */
                DAR= this.get_indir_addr();
                lo = this.CPU_BD_get_mbyte( DAR );
                this.COND_SET_FLAG_V( lo == 0x7F );
                lo = (lo + 1) & 0xFF;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x6D:                  /* TST ind */
                lo = (this.get_indir_val() - 0) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.CLR_FLAG( this.CF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x6E:                  /* JMP ind */
                this.PC = this.get_indir_addr();
                break;
            case 0x6F:                  /* CLR ind */
                this.CPU_BD_put_mbyte( this.get_indir_addr(), 0 );
                this.CLR_FLAG( this.NF );
                this.CLR_FLAG( this.VF );
                this.CLR_FLAG( this.CF );
                this.SET_FLAG( this.ZF );
                break;
            case 0x70:                  /* NEG ext */
                DAR = this.get_ext_addr();
                lo = (0 - this.CPU_BD_get_mbyte( DAR )) & 0xFF;
                this.CPU_BD_put_mbyte( DAR, lo );                
                this.COND_SET_FLAG_V( lo == 0x80 );
                this.COND_SET_FLAG(   lo == 0x00, this.CF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x73:                  /* COM ext */
                DAR = this.get_ext_addr();
                lo = ~this.CPU_BD_get_mbyte( DAR );
                lo &= 0xFF;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.CLR_FLAG( this.VF );
                this.SET_FLAG( this.CF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x74:                  /* LSR ext */
                DAR = this.get_ext_addr();
                lo = this.CPU_BD_get_mbyte( DAR );
                this.COND_SET_FLAG( lo & 0x01, this.CF );
                lo >>>= 1;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.CLR_FLAG( this.NF );
                this.COND_SET_FLAG_Z( lo );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x76:                  /* ROR ext */
                DAR = this.get_ext_addr();
                hi = this.get_flag( this.CF );
                lo = this.CPU_BD_get_mbyte( DAR );
                this.COND_SET_FLAG( lo & 0x01, this.CF );
                lo >>>= 1;
                if( hi )
                    lo |= 0x80;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x77:                  /* ASR ext */
                DAR = this.get_ext_addr();
                lo = this.CPU_BD_get_mbyte( DAR );
                this.COND_SET_FLAG( lo & 0x01, this.CF );
                hi = lo & 0x80;
                lo >>>= 1;
                lo |= hi;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x78:                  /* ASL ext */
                DAR = this.get_ext_addr();
                lo = this.CPU_BD_get_mbyte( DAR );
                this.COND_SET_FLAG( lo & 0x80, this.CF );
                lo <<= 1;
                lo  &= 0xFF;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x79:                  /* ROL ext */
                DAR = this.get_ext_addr();
                lo = this.CPU_BD_get_mbyte( DAR );
                hi = this.get_flag( this.CF );
                this.COND_SET_FLAG( lo & 0x80, this.CF );
                lo <<= 1;
                lo  &= 0xFF;
                if( hi )
                    lo |= 0x01;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                this.COND_SET_FLAG_V( this.get_flag(this.NF) ^ this.get_flag(this.CF) );
                break;
            case 0x7A:                  /* DEC ext */
                DAR = this.get_ext_addr();
                lo = this.CPU_BD_get_mbyte( DAR );
                this.COND_SET_FLAG_V( lo == 0x80 );
                lo = (lo - 1) & 0xFF;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x7C:                  /* INC ext */
                DAR = this.get_ext_addr();
                lo = this.CPU_BD_get_mbyte( DAR );
                this.COND_SET_FLAG_V( lo == 0x7F );
                lo = (lo + 1) & 0xFF;
                this.CPU_BD_put_mbyte( DAR, lo );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x7D:                  /* TST ext */
                lo = this.CPU_BD_get_mbyte( this.get_ext_addr() ) - 0;
                this.CLR_FLAG( this.VF );
                this.CLR_FLAG( this.CF );
                this.COND_SET_FLAG_N( lo );
                lo &= 0xFF;
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x7E:                  /* JMP ext */
                this.PC = this.get_ext_addr() & this.ADDRMASK;
                break;
            case 0x7F:                  /* CLR ext */
                this.CPU_BD_put_mbyte( this.get_ext_addr(), 0 );
                this.CLR_FLAG( this.NF );
                this.CLR_FLAG( this.VF );
                this.CLR_FLAG( this.CF );
                this.SET_FLAG( this.ZF );
                break;
            case 0x80:                  /* SUB A imm */
                op1 = this.get_dir_addr();
                res = this.A - op1;
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0x81:                  /* CMP A imm */
                op1 = this.get_dir_addr();
                res = this.A - op1;
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.COND_SET_FLAG_Z( res & 0xFF );
                this.COND_SET_FLAG_N( res & 0xFF );
                break;
            case 0x82:                  /* SBC A imm */
                op1 = this.get_dir_addr();
                res = this.A - op1 - this.get_flag( this.CF );
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0x84:                  /* AND A imm */
                this.A = (this.A & this.get_dir_addr()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0x85:                  /* BIT A imm */
                lo = (this.A & this.get_dir_addr()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x86:                  /* LDA A imm */
                this.A = this.get_dir_addr();
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0x88:                  /* EOR A imm */
                this.A = (this.A ^ this.get_dir_addr()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0x89:                  /* ADC A imm */
                op1 = this.get_dir_addr();
                res = this.A + op1 + this.get_flag( this.CF );
                this.COND_SET_FLAG_H( (this.A ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0x8A:                  /* ORA A imm */
                this.A = (this.A | this.get_dir_addr()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0x8B:                  /* ADD A imm */
                op1 = this.get_dir_addr();
                res = this.A + op1;
                this.COND_SET_FLAG_H( (this.A ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0x8C:                  /* CPX imm */
                op1 = this.IX - this.get_ext_addr();
                this.COND_SET_FLAG_Z( op1           );
                this.COND_SET_FLAG_N( op1 >>> 8     );
                this.COND_SET_FLAG_V( op1 & 0x10000 );
                break;
            case 0x8D:                  /* BSR rel */
                lo = this.get_rel_addr();
                this.push_word( this.PC );
                this.PC = this.PC + lo;
                this.PC &= this.ADDRMASK;
                break;
            case 0x8E:                  /* LDS imm */
                this.SP = this.get_ext_addr();
                this.COND_SET_FLAG_N( this.SP >>> 8);
                this.COND_SET_FLAG_Z( this.SP      );
                this.CLR_FLAG( this.VF );
                break;
            case 0x90:                  /* SUB A dir */
                op1 = this.get_dir_val();
                res = this.A - op1;
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0x91:                  /* CMP A dir */
                op1 = this.get_dir_val();
                res = this.A - op1;
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.COND_SET_FLAG_Z( res & 0xFF );
                this.COND_SET_FLAG_N( res & 0xFF );
                break;
            case 0x92:                  /* SBC A dir */
                op1 = this.get_dir_val();
                res = this.A - op1 - this.get_flag( this.CF );
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0x94:                  /* AND A dir */
                this.A = (this.A & this.get_dir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0x95:                  /* BIT A dir */
                lo = (this.A & this.get_dir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0x96:                  /* LDA A dir */
                this.A = this.get_dir_val();
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0x97:                  /* STA A dir */
                this.CPU_BD_put_mbyte( this.get_dir_addr(), this.A );
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0x98:                  /* EOR A dir */
                this.A = (this.A ^ this.get_dir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0x99:                  /* ADC A dir */
                op1 = this.get_dir_val();
                res = this.A + op1 + this.get_flag( this.CF );
                this.COND_SET_FLAG_H( (this.A ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0x9A:                  /* ORA A dir */
                this.A = (this.A | this.get_dir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0x9B:                  /* ADD A dir */
                op1 = this.get_dir_val();
                res = this.A + op1;
                this.COND_SET_FLAG_H( (this.A ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0x9C:                  /* CPX dir */
                op1 = this.IX - this.CPU_BD_get_mword( this.get_dir_addr() );
                this.COND_SET_FLAG_Z( op1           );
                this.COND_SET_FLAG_N( op1 >>> 8     );
                this.COND_SET_FLAG_V( op1 & 0x10000 );
                break;
            case 0x9E:                  /* LDS dir */
                this.SP = this.CPU_BD_get_mword( this.get_dir_addr() );
                this.COND_SET_FLAG_N( this.SP >>> 8 );
                this.COND_SET_FLAG_Z( this.SP       );
                this.CLR_FLAG( this.VF );
                break;
            case 0x9F:                  /* STS dir */
                this.CPU_BD_put_mword( this.get_dir_addr(), this.SP );
                this.COND_SET_FLAG_N( this.SP >>> 8 );
                this.COND_SET_FLAG_Z( this.SP       );
                this.CLR_FLAG( this.VF );
                break;
            case 0xA0:                  /* SUB A ind */
                op1 = this.get_indir_val();
                res = this.A - op1;
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0xA1:                  /* CMP A ind */
                op1 = this.get_indir_val();
                res = this.A - op1;
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.COND_SET_FLAG_Z( res & 0xFF );
                this.COND_SET_FLAG_N( res & 0xFF );
                break;
            case 0xA2:                  /* SBC A ind */
                op1 = this.get_indir_val();
                res = this.A - op1 - this.get_flag( this.CF );
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0xA4:                  /* AND A ind */
                this.A = (this.A & this.get_indir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0xA5:                  /* BIT A ind */
                lo = (this.A & this.get_indir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0xA6:                  /* LDA A ind */
                this.A = this.get_indir_val();
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0xA7:                  /* STA A ind */
                this.CPU_BD_put_mbyte( this.get_indir_addr(), this.A );
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0xA8:                  /* EOR A ind */
                this.A = (this.A ^ this.get_indir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0xA9:                  /* ADC A ind */
                op1 = this.get_indir_val();
                res = this.A + op1 + this.get_flag( this.CF );
                this.COND_SET_FLAG_H( (this.A ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0xAA:                  /* ORA A ind */
                this.A = (this.A | this.get_indir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0xAB:                  /* ADD A ind */
                op1 = this.get_indir_val();
                res = this.A + op1;
                this.COND_SET_FLAG_H( (this.A ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0xAC:                  /* CPX ind */
                op1 = (this.IX - this.get_indir_addr()) & this.ADDRMASK;
                this.COND_SET_FLAG_Z( op1           );
                this.COND_SET_FLAG_N( op1 >>> 8     );
                this.COND_SET_FLAG_V( op1 & 0x10000 );
                break;
            case 0xAD:                  /* JSR ind */
                DAR = this.get_indir_addr();
                this.push_word( this.PC );
                this.PC = DAR;
                break;
            case 0xAE:                  /* LDS ind */
                this.SP = this.CPU_BD_get_mword( this.get_indir_addr() );
                this.COND_SET_FLAG_N( this.SP >>> 8 );
                this.COND_SET_FLAG_Z( this.SP       );
                this.CLR_FLAG( this.VF );
                break;
            case 0xAF:                  /* STS ind */
                this.CPU_BD_put_mword( this.get_indir_addr(), this.SP );
                this.COND_SET_FLAG_N( this.SP >>> 8 );
                this.COND_SET_FLAG_Z( this.SP       );
                this.CLR_FLAG( this.VF );
                break;
            case 0xB0:                  /* SUB A ext */
                op1 = this.get_ext_val();
                res = this.A - op1;
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0xB1:                  /* CMP A ext */
                op1 = this.get_ext_val();
                res = this.A - op1;
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.COND_SET_FLAG_Z( res & 0xFF );
                this.COND_SET_FLAG_N( res & 0xFF );
                break;
            case 0xB2:                  /* SBC A ext */
                op1 = this.get_ext_val();
                res = this.A - op1 - this.get_flag( this.CF );
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0xB4:                  /* AND A ext */
                this.A = (this.A & this.get_ext_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0xB5:                  /* BIT A ext */
                lo = (this.A & this.get_ext_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0xB6:                  /* LDA A ext */
                this.A = this.get_ext_val();
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0xB7:                  /* STA A ext */
                this.CPU_BD_put_mbyte( this.get_ext_addr(), this.A );
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0xB8:                  /* EOR A ext */
                this.A = (this.A ^ this.get_ext_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0xB9:                  /* ADC A ext */
                op1 = this.get_ext_val();
                res = this.A + op1 + this.get_flag( this.CF );
                this.COND_SET_FLAG_H( (this.A ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0xBA:                  /* ORA A ext */
                this.A = (this.A | this.get_ext_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.A );
                this.COND_SET_FLAG_Z( this.A );
                break;
            case 0xBB:                  /* ADD A ext */
                op1 = this.get_ext_val();
                res = this.A + op1;
                this.COND_SET_FLAG_H( (this.A ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.A ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.A = res & 0xFF;
                this.COND_SET_FLAG_Z( this.A );
                this.COND_SET_FLAG_N( this.A );
                break;
            case 0xBC:                  /* CPX ext */
                op1 = (this.IX - this.CPU_BD_get_mword( this.get_ext_addr() ) ); // & this.ADDRMASK;
                this.COND_SET_FLAG_Z( op1           );
                this.COND_SET_FLAG_N( op1 >>> 8     );
                this.COND_SET_FLAG_V( op1 & 0x10000 );
                break;
            case 0xBD:                  /* JSR ext */
                DAR = this.get_ext_addr();
                this.push_word( this.PC );
                this.PC = DAR;
                break;
            case 0xBE:                  /* LDS ext */
                this.SP = this.CPU_BD_get_mword( this.get_ext_addr() );
                this.COND_SET_FLAG_N( this.SP >>> 8 );
                this.COND_SET_FLAG_Z( this.SP       );
                this.CLR_FLAG( this.VF );
                break;
            case 0xBF:                  /* STS ext */
                this.CPU_BD_put_mword( this.get_ext_addr(), this.SP );
                this.COND_SET_FLAG_N( this.SP >>> 8 );
                this.COND_SET_FLAG_Z( this.SP       );
                this.CLR_FLAG( this.VF );
                break;
            case 0xC0:                  /* SUB B imm */
                op1 = this.get_dir_addr();
                res = this.B - op1;
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xC1:                  /* CMP B imm */
                op1 = this.get_dir_addr();
                res = this.B - op1;
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.COND_SET_FLAG_Z( res & 0xFF );
                this.COND_SET_FLAG_N( res & 0xFF );
                break;
            case 0xC2:                  /* SBC B imm */
                op1 = this.get_dir_addr();
                res = this.B - op1 - this.get_flag( this.CF );
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xC4:                  /* AND B imm */
                this.B = (this.B & this.get_dir_addr()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xC5:                  /* BIT B imm */
                lo = (this.B & this.get_dir_addr()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0xC6:                  /* LDA B imm */
                this.B = this.get_dir_addr();
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xC8:                  /* EOR B imm */
                this.B = (this.B ^ this.get_dir_addr()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xC9:                  /* ADC B imm */
                op1 = this.get_dir_addr();
                res = this.B + op1 + this.get_flag( this.CF );
                this.COND_SET_FLAG_H( (this.B ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xCA:                  /* ORA B imm */
                this.B = (this.B | this.get_dir_addr()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xCB:                  /* ADD B imm */
                op1 = this.get_dir_addr();
                res = this.B + op1;
                this.COND_SET_FLAG_H( (this.B ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xCE:                  /* LDX imm */
                this.IX = this.get_ext_addr();
                this.COND_SET_FLAG_N( this.IX >>> 8 );
                this.COND_SET_FLAG_Z( this.IX       );
                this.CLR_FLAG( this.VF );
                break;
            case 0xD0:                  /* SUB B dir */
                op1 = this.get_dir_val();
                res = this.B - op1;
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xD1:                  /* CMP B dir */
                op1 = this.get_dir_val();
                res = this.B - op1;
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.COND_SET_FLAG_Z( res & 0xFF );
                this.COND_SET_FLAG_N( res & 0xFF );
                break;
            case 0xD2:                  /* SBC B dir */
                op1 = this.get_dir_val();
                res = this.B - op1 - this.get_flag( this.CF );
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xD4:                  /* AND B dir */
                this.B = (this.B & this.get_dir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xD5:                  /* BIT B dir */
                lo = (this.B & this.get_dir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0xD6:                  /* LDA B dir */
                this.B = this.get_dir_val();
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xD7:                  /* STA B dir */
                this.CPU_BD_put_mbyte( this.get_dir_addr(), this.B );
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xD8:                  /* EOR B dir */
                this.B = (this.B ^ this.get_dir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xD9:                  /* ADC B dir */
                op1 = this.get_dir_val();
                res = this.B + op1 + this.get_flag( this.CF );
                this.COND_SET_FLAG_H( (this.B ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xDA:                  /* ORA B dir */
                this.B = (this.B | this.get_dir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xDB:                  /* ADD B dir */
                op1 = this.get_dir_val();
                res = this.B + op1;
                this.COND_SET_FLAG_H( (this.B ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xDE:                  /* LDX dir */
                this.IX = this.CPU_BD_get_mword( this.get_dir_addr() );
                this.COND_SET_FLAG_N( this.IX >>> 8 );
                this.COND_SET_FLAG_Z( this.IX       );
                this.CLR_FLAG( this.VF );
                break;
            case 0xDF:                  /* STX dir */
                this.CPU_BD_put_mword( this.get_dir_addr(), this.IX );
                this.COND_SET_FLAG_N( this.IX >>> 8 );
                this.COND_SET_FLAG_Z( this.IX       );
                this.CLR_FLAG( this.VF );
                break;
            case 0xE0:                  /* SUB B ind */
                op1 = this.get_indir_val();
                res = this.B - op1;
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xE1:                  /* CMP B ind */
                op1 = this.get_indir_val();
                res = this.B - op1;
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.COND_SET_FLAG_Z( res & 0xFF );
                this.COND_SET_FLAG_N( res & 0xFF );
                break;
            case 0xE2:                  /* SBC B ind */
                op1 = this.get_indir_val();
                res = this.B - op1 - this.get_flag( this.CF );
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xE4:                  /* AND B ind */
                this.B = (this.B & this.get_indir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xE5:                  /* BIT B ind */
                lo = (this.B & this.get_indir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0xE6:                  /* LDA B ind */
                this.B = this.get_indir_val();
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xE7:                  /* STA B ind */
                this.CPU_BD_put_mbyte( this.get_indir_addr(), this.B );
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xE8:                  /* EOR B ind */
                this.B = (this.B ^ this.get_indir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xE9:                  /* ADC B ind */
                op1 = this.get_indir_val();
                res = this.B + op1 + this.get_flag( this.CF );
                this.COND_SET_FLAG_H( (this.B ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xEA:                  /* ORA B ind */
                this.B = (this.B | this.get_indir_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xEB:                  /* ADD B ind */
                op1 = this.get_indir_val();
                res = this.B + op1;
                this.COND_SET_FLAG_H( (this.B ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xEE:                  /* LDX ind */
                this.IX = this.CPU_BD_get_mword( this.get_indir_addr() );
                this.COND_SET_FLAG_N( this.IX >>> 8 );
                this.COND_SET_FLAG_Z( this.IX       );
                this.CLR_FLAG( this.VF );
                break;
            case 0xEF:                  /* STX ind */
                this.CPU_BD_put_mword( this.get_indir_addr(), this.IX );
                this.COND_SET_FLAG_N( this.IX >>> 8 );
                this.COND_SET_FLAG_Z( this.IX       );
                this.CLR_FLAG( this.VF );
                break;
            case 0xF0:                  /* SUB B ext */
                op1 = this.get_ext_val();
                res = this.B - op1;
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xF1:                  /* CMP B ext */
                op1 = this.get_ext_val();
                res = this.B - op1;
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.COND_SET_FLAG_Z( res & 0xFF );
                this.COND_SET_FLAG_N( res & 0xFF );
                break;
            case 0xF2:                  /* SBC B ext */
                op1 = this.get_ext_val();
                res = this.B - op1 - this.get_flag( this.CF );
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xF4:                  /* AND B ext */
                this.B = (this.B & this.get_ext_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xF5:                  /* BIT B ext */
                lo = (this.B & this.get_ext_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( lo );
                this.COND_SET_FLAG_Z( lo );
                break;
            case 0xF6:                  /* LDA B ext */
                this.B = this.get_ext_val();
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xF7:                  /* STA B ext */
                this.CPU_BD_put_mbyte( this.get_ext_addr(), this.B );
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xF8:                  /* EOR B ext */
                this.B = (this.B ^ this.get_ext_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xF9:                  /* ADC B ext */
                op1 = this.get_ext_val();
                res = this.B + op1 + this.get_flag( this.CF );
                this.COND_SET_FLAG_H( (this.B ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xFA:                  /* ORA B ext */
                this.B = (this.B | this.get_ext_val()) & 0xFF;
                this.CLR_FLAG( this.VF );
                this.COND_SET_FLAG_N( this.B );
                this.COND_SET_FLAG_Z( this.B );
                break;
            case 0xFB:                  /* ADD B ext */
                op1 = this.get_ext_val();
                res = this.B + op1;
                this.COND_SET_FLAG_H( (this.B ^ op1 ^ res) & 0x10 );
                this.COND_SET_FLAG_V( (this.B ^ op1 ^ res ^ (res >>> 1)) & 0x80 );
                this.COND_SET_FLAG_C( res );
                this.B = res & 0xFF;
                this.COND_SET_FLAG_Z( this.B );
                this.COND_SET_FLAG_N( this.B );
                break;
            case 0xFE:                  /* LDX ext */
                this.IX = this.CPU_BD_get_mword( this.get_ext_addr() );
                this.COND_SET_FLAG_N( this.IX >>> 8 );
                this.COND_SET_FLAG_Z( this.IX       );
                this.CLR_FLAG( this.VF );
                break;
            case 0xFF:                  /* STX ext */
                this.CPU_BD_put_mword( this.get_ext_addr(), this.IX );
                this.COND_SET_FLAG_N( this.IX >>> 8 );
                this.COND_SET_FLAG_Z( this.IX       );
                this.CLR_FLAG( this.VF );
                break;

			default :	// Unimplemented or illegal.
						this.println('DER: MC6800.js illegal/unimplemented: ' + this.retornaHex( this.last_PC, 4 ) + " => " + this.retornaInst(IR));
						i = 0;
						break;

			} // End of switch IR.
			
			if( this.der_icount > 0 ) {
				this.println('DER: MC6800.js execute: ' + this.retornaHex( this.last_PC, 4 ) + " => " + this.retornaHex(IR,2) + " = " + this.retornaInst(IR) + this.instruction_operand);
				// this.DumpRegisters();
				this.der_icount -= 1;
			} // End if this.der_icount > 0

		} // End while i.

	} // End of function execute.
	
    this.reset = function( starting_address ) {

		this.A   = 0x00;
		this.B   = 0x00;
		this.IX  = 0x0000;
		this.PC  = this.peekw( starting_address );
		this.SP  = 0x0000;
		this.CCR = this.CCR_ALWAYS_ON | this.IF;
		
    } // End of function reset.
	
    this.checkIRQ = function() { // Overridden in TEKTRONIX4051.js

    	return 0;
    			
    } // End of function checkIRQ.
    
    this.checkNMI = function() { // Overridden in TEKTRONIX4051.js
    
    	return 0;
    			
    } // End of function checkNMI.

    this.MC6800_interrupt = function() {

		return 0;
		
	} // End of function MC6800_interrupt.
	
	this.DumpRegisters = function() {
		this.print('PC='); this.print( this.retornaHex( this.PC, 4 ) ); this.print(' ');
		this.print('SP='); this.print( this.retornaHex( this.SP, 4 ) ); this.print(' ');
		this.print('IX='); this.print( this.retornaHex( this.IX, 4 ) ); this.print(' ');
		this.print('A='); this.print( this.retornaHex( this.A, 2 ) ); this.print(' ');
		this.print('B='); this.print( this.retornaHex( this.B, 2 ) ); this.print(' ');
		this.print('CCR='); this.print( this.retornaHex( this.CCR, 2 ) ); this.print(' ');
		this.println('');		
	}
	
    this.retornaHex = function( i, j ) {
    
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
	    			
	    	} // End of switch.
	    		
		} // End of for.
	
		return string;
		
    } // End of function retornaHex.

    this.retornaInst = function( i ) {

		return this.opcodes[ i ];
			
	} // End of function retornaInst.

	//public MC6800(double d) {
	this.tstatesPerInterrupt = (d * 1000000.0 / 60.0); // DER: Assuming 60 interrupts per second!
    //}

    this.peekb = function( address ) { // Should be overridden!
		return 0;
    }
    
    this.peekw = function( address ) {
		var temp = address;
		var val  = this.peekb(   temp                 ) << 8; // MSB
		val     |= this.peekb( ++temp & this.ADDRMASK )     ; // LSB
		return val;
    }
    
    this.pokeb = function( address, val ) { // Should be overridden!
		/* empty */
    }
    
    this.pokew = function( address, val ) {
    	this.pokeb( (address+0) & this.ADDRMASK, (val >>> 8) & 0xFF ); // MSB
    	this.pokeb( (address+1) & this.ADDRMASK, (val >>> 0) & 0xFF ); // LSB
    }
    
    this.CPU_BD_get_mbyte = function( address ) {
    	var val = this.peekb( address );
    	//@@@ this.println('Reading memory byte from address '+this.retornaHex(address,4)+' of '+this.retornaHex(val,2));
    	return val;
    }

    this.CPU_BD_get_mword = function( address ) {
    	var val = this.peekw( address );
    	//@@@ this.println('Reading memory word from address '+this.retornaHex(address,4)+' of '+this.retornaHex(val,4));
    	return val;
    }

    this.CPU_BD_put_mbyte = function( address, val ) {
    	//@@@ this.println('Writing memory byte to address '+this.retornaHex(address,4)+' of '+this.retornaHex(val,2));
    	this.pokeb( address, val );
    }
    
    this.CPU_BD_put_mword = function( address, val ) {
    	//@@@ this.println('Writing memory word to address '+this.retornaHex(address,4)+' of '+this.retornaHex(val,4));
    	this.pokew( address, val );
    }
    
    this.fetch_byte = function() {
    	var val = this.CPU_BD_get_mbyte( this.PC ) & 0xFF; /* fetch byte */
	    this.PC = (this.PC + 1) & this.ADDRMASK;           /* increment PC */
    	return val;
    }
    
    this.fetch_word = function( address ) {
    	var val  = this.CPU_BD_get_mbyte( this.PC ) << 8;       /* fetch high byte */
	    val     |= this.CPU_BD_get_mbyte( this.PC + 1 ) & 0xFF; /* fetch low byte */
	    this.PC = (this.PC + 2) & this.ADDRMASK;                /* increment PC */
    	return val;
    }
    
	/* push a byte to the stack */
	this.push_byte = function( val ) {
    	this.CPU_BD_put_mbyte( this.SP, val & 0xFF );
    	this.SP = (this.SP - 1) & this.ADDRMASK;
	}

	/* push a word to the stack */
	this.push_word = function( val ) {
    	this.push_byte( val & 0xFF );
    	this.push_byte( val >>> 8  );
	}

	/* pop a byte from the stack */
	this.pop_byte = function() {	
	
    	this.SP = (this.SP + 1) & this.ADDRMASK;
    	
    	return this.CPU_BD_get_mbyte( this.SP );
    	
	}

	/* pop a word from the stack */
	this.pop_word = function() {

    	var res;

    	res  = this.pop_byte() << 8;
    	res |= this.pop_byte();
    	
    	return res;

	}

	/*        this routine does the jump to relative offset if the condition is
    	    met.  Otherwise, execution continues at the current PC. */

	this.go_rel = function( cond ) {
	
    	var temp = this.get_rel_addr();
    	
    	if( cond ) {
        	this.PC += temp;
        	//@@@ this.println('>>> BRANCH TAKEN <<<');
        } else {
        	//@@@ this.println('>>> BRANCH NOT TAKEN <<<');
        } // End if
        
    	this.PC &= this.ADDRMASK;

	}

	/* returns the relative offset sign-extended */

	this.get_rel_addr = function() {
	
	    this.instruction_operand = ",RELATIVE";
	
    	var temp = this.fetch_byte();
    	
    	if( temp & 0x80 )
        	temp |= 0xFF00;
        	
    	return temp & this.ADDRMASK;

	}

	/* returns the value at the direct address pointed to by PC */

	this.get_dir_val = function() {
	
		return this.CPU_BD_get_mbyte( this.get_dir_addr() );
    	
	}

	/* returns the direct address pointed to by PC */

	this.get_dir_addr = function() {
	
	    this.instruction_operand = ",DIRECT";
	
    	return this.fetch_byte() & 0xFF;
    	
	}

	/* returns the value at the indirect address pointed to by PC */

	this.get_indir_val = function() {
	
    	return this.CPU_BD_get_mbyte( this.get_indir_addr() );
    	
	}

	/* returns the indirect address pointed to by PC or immediate byte */

	this.get_indir_addr = function() {
	
	    this.instruction_operand = ",INDIRECT";
	
    	return (this.fetch_byte() + this.IX) & this.ADDRMASK;

	}

	/* returns the value at the extended address pointed to by PC */

	this.get_ext_val = function() {
	
    	return this.CPU_BD_get_mbyte( this.get_ext_addr() );
    	
	}

	/* returns the extended address pointed to by PC or immediate word */

	this.get_ext_addr = function() {
	
	    this.instruction_operand = ",EXTENDED";
	
		return this.fetch_word();

	}

	/* return 1 for flag set or 0 for flag clear */

	this.get_flag = function( flg ) {
	
    	if( this.CCR & flg )
        	return 1;
    	else
        	return 0;
        	
	}
    
	this.opcodes = [
		"???", "NOP", "???", "???",             //0x00
		"???", "???", "TAP", "TPA",
		"INX", "DEX", "CLV", "SEV",
		"CLC", "SEC", "CLI", "SEI",
		"SBA", "CBA", "???", "???",             //0x10
		"???", "???", "TAB", "TBA",
		"???", "DAA", "???", "ABA",
		"???", "???", "???", "???",
		"BRA", "???", "BHI", "BLS",             //0x20
		"BCC", "BCS", "BNE", "BEQ",
		"BVC", "BVS", "BPL", "BMI",
		"BGE", "BLT", "BGT", "BLE",
		"TSX", "INS", "PULA", "PULB",           //0x30
		"DES", "TXS", "PSHA", "PSHB",
		"???", "RTS", "???", "RTI",
		"???", "???", "WAI", "SWI",
		"NEGA", "???", "???", "COMA",           //0x40
		"LSRA", "???", "RORA", "ASRA",
		"ASLA", "ROLA", "DECA", "???",
		"INCA", "TSTA", "???", "CLRA",
		"NEGB", "???", "???", "COMB",           //0x50
		"LSRB", "???", "RORB", "ASRB",
		"ASLB", "ROLB", "DECB", "???",
		"INCB", "TSTB", "???", "CLRB",
		"NEG", "???", "???", "COM",             //0x60
		"LSR", "???", "ROR", "ASR",
		"ASL", "ROL", "DEC", "???",
		"INC", "TST", "JMP", "CLR",
		"NEG", "???", "???", "COM",             //0x70
		"LSR", "???", "ROR", "ASR",
		"ASL", "ROL", "DEC", "???",
		"INC", "TST", "JMP", "CLR",
		"SUBA", "CMPA", "SBCA", "???",          //0x80
		"ANDA", "BITA", "LDAA", "???",
		"EORA", "ADCA", "ORAA", "ADDA",
		"CPX", "BSR", "LDS", "???",
		"SUBA", "CMPA", "SBCA", "???",          //0x90
		"ANDA", "BITA", "LDAA", "STAA",
		"EORA", "ADCA", "ORAA", "ADDA",
		"CPX", "???", "LDS", "STS",
		"SUBA", "CMPA", "SBCA", "???",          //0xA0
		"ANDA", "BITA", "LDAA", "STAA",
		"EORA", "ADCA", "ORAA", "ADDA",
		"CPX X", "JSR X", "LDS X", "STS X",
		"SUBA", "CMPA", "SBCA", "???",          //0xB0
		"ANDA", "BITA", "LDAA", "STAA",
		"EORA", "ADCA", "ORAA", "ADDA",
		"CPX", "JSR", "LDS", "STS",
		"SUBB", "CMPB", "SBCB", "???",          //0xC0
		"ANDB", "BITB", "LDAB", "???",
		"EORB", "ADCB", "ORAB", "ADDB",
		"???", "???", "LDX", "???",
		"SUBB", "CMPB", "SBCB", "???",          //0xD0
		"ANDB", "BITB", "LDAB", "STAB",
		"EORB", "ADCB", "ORAB", "ADDB",
		"???", "???", "LDX", "STX",
		"SUBB", "CMPB", "SBCB", "???",          //0xE0
		"ANDB", "BITB", "LDAB", "STAB",
		"EORB", "ADCB", "ORAB", "ADDB",
		"???", "???", "LDX", "STX",
		"SUBB", "CMPB", "SBCB", "???",          //0xF0
		"ANDB", "BITB", "LDAB", "STAB",
		"EORB", "ADCB", "ORAB", "ADDB",
		"???", "???", "LDX", "STX",
	];

	this.oplen = [
		0,1,0,0,0,0,1,1,1,1,1,1,1,1,1,1,        //0x00
		1,1,0,0,0,0,1,1,0,1,0,1,0,0,0,0,
		2,0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,
		1,1,1,1,1,1,1,1,0,1,0,1,0,0,1,1,
		1,0,0,1,1,0,1,1,1,1,1,0,1,1,0,1,        //0x40
		1,0,0,1,1,0,1,1,1,1,1,0,1,1,0,1,
		2,0,0,2,2,0,2,2,2,2,2,0,2,2,2,2,
		3,0,0,3,3,0,3,3,3,3,3,0,3,3,3,3,
		2,2,2,0,2,2,2,0,2,2,2,2,3,2,3,0,        //0x80
		2,2,2,0,2,2,2,2,2,2,2,2,2,0,2,2,
		2,2,2,0,2,2,2,2,2,2,2,2,2,2,2,2,
		3,3,3,0,3,3,3,3,3,3,3,3,3,3,3,3,
		2,2,2,0,2,2,2,0,2,2,2,2,0,0,3,0,        //0xC0
		2,2,2,0,2,2,2,2,2,2,2,2,0,0,2,2,
		2,2,2,0,2,2,2,2,2,2,2,2,0,0,2,2,
		3,3,3,0,3,3,3,3,3,3,3,3,0,0,3,3
	];
    
} // End of function MC6800
