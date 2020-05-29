const variableNames = "Ans|A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z|theta".split('|');

/**
 * Handles interfacing between the JS and the user.
 */
class Interpreter {
	constructor() {
		/**
		 * Holds the values of all of the variables in 
		 * @type {Object<string, number>}
		 */
		this.variables = {};
	}

	/**
	 * Resets all the For(T,R,A,N variables to zero
	 */
	reset() {
		variableNames.forEach(name => {
			this.variables[name] = 0;
		});
	}

	toggleOutput() {
		document.getElementById("outputcol").classList.toggle("visible");
	}

	print(text) {
		let output = document.getElementById("output");

		output.value += text + '\n';
	}

	/**
	 * Updates the variable display.
	 */
	updateVariableDisplay() {
		variableNames.forEach(name => {
			let element = document.querySelector(`#variables input[name=${name}]`);

			element.value = this.variables[name] || 0;
		});	
	}

	run() {
		let code = document.getElementById('code').value;

		this.reset();
		this.set("Ans", parseFloat(document.getElementById("input").value) || 0);

		document.getElementById("output").value = '';

		document.getElementById("outputcol").classList.remove("visible");
		document.getElementById("outputcol").classList.add("visible");

		let parser = new Parser(code, {
			"warnings": document.getElementById("doWarnings").checked
		});

		let block = parser.parse();

		block.execute();
	}

	/**
	 * @param  {string} name The name of the variable to retrieve.
	 * @return {number} The value of that variable.
	 */
	get(name) {
		return this.variables[name] || 0;
	}

	/**
	 * @param {string} name The name of the variable to set.
	 * @param {number} value The number to set it to.
	 */
	set(name, value) {
		this.variables[name] = value;

		if (!isFinite(value)) {
			this.print(`Aborted with a warning: Variable ${name} went to Infinity.`);
			throw new Error();
		}

		this.updateVariableDisplay();
	}
}

let interpreter = new Interpreter();

/**
 * A reference to a For(T,R,A,N variable.
 */
class Reference {
	/**
	 * @param  {string} name The name of the variable to reference.
	 */
	constructor(name) {
		this.name = name;
	}

	/**
	 * @param  {Object<string, number>} variables
	 * @return {number}
	 */
	get() {
		return interpreter.get(this.name);
	}

	/**
	 * @param {number} value
	 */
	set(value) {
		return interpreter.set(this.name, value);
	}
}

const val = (literalOrReference) => literalOrReference instanceof Reference ? literalOrReference.get() : literalOrReference;

class Statement {
	constructor() {}

	/**
	 * @abstract
	 */
	execute() {}
}

class Block extends Statement {
	constructor(statements) {
		super();

		this.statements = statements;
	}

	execute() {
		this.statements.forEach(statement => {
			statement.execute();
		});
	}
}

/**
 * A for loop.
 */
class ForLoop extends Statement {
	/**
	 * @param {Reference} iterator The name of the For(T,R,A,N variable to iterate through
	 * @param {Reference|number} start A reference to a For(T,R,A,N variable or a numeric literal saying what number to start looping at.
	 * @param {Reference|number} end A reference to a For(T,R,A,N variable or a numeric literal saying what number to stop looping at.
	 * @param {Reference|number?} step A reference to a For(T,R,A,N variable or a numeric literal saying what number to loop by.
	 * @param {Block} body The commands to loop over.
	 * @see {@link http://tibasicdev.wikidot.com/for}
	 */
	constructor(iterator, start, end, step, body) {
		super();

		this.iterator = iterator;
		this.start = start;
		this.end = end;
		this.step = step || 1; 

		this.body = body;

		this.abortTime = null;
	}

	execute() {
		// http://tibasicdev.wikidot.com/for
		this.iterator.set(val(this.start));

		this.abortTime = Date.now() + 10000;

		while (
			(val(this.step)  < 0 && val(this.iterator) >= val(this.end)) || 
			(val(this.step) >= 0 && val(this.iterator) <= val(this.end))
		) {
			if (Date.now() > this.abortTime) return;
			this.body.execute();

			this.iterator.set(this.iterator.get() + val(this.step));
		}
	}
}

class End extends Statement {
	constructor() {
		super();
	}

	execute() {};
}

class Disp extends Statement {
	/**
	 * @param {Reference|number} arg The value or variable to print.
	 */
	constructor(arg) {
		super();
		this.arg = arg;
	}

	execute() {
		interpreter.print(val(this.arg));
	}
}

class Parser {
	constructor(code, options) {
		/**
		 * @readOnly
		 * @type {Array<string>}
		 */
		this.lines = code.split('\n');

		/**
		 * @type {number}
		 */
		this.lineIdx = 0;

		/**
		 * @type {number}
		 */
		this.charIdx = 0;

		/**
		 * @type {number}
		 */
		this.depth = 0;

		/**
		 * @type {boolean}
		 */
		this.startOfLine = true;

		options = options || {};
		this.options = {
			"warnings": options["warnings"] || false
		};

		/**
		 * @type {number}
		 */
		this.abortTime = Date.now() + 2000;

		/**
		 * Makes sure that the warning about closing end statements only gets sent once, if it's sent at all.
		 * @type {boolean}
		 */
		this.didEndWarning = false;
	}

	get line() {
		if (Date.now() > this.abortTime) this.throwFatal("Parsing took too long. Please reports this.");
		return this.lines[this.lineIdx];
	}

	get char() {
		if (Date.now() > this.abortTime) this.throwFatal("Parsing took too long. Please reports this.");
		return this.line ? this.line[this.charIdx] : undefined;
	}

	nextLine() {
		++this.lineIdx;
		this.charIdx = 0;
		this.startOfLine = true;
	}

	nextChar() {
		++this.charIdx;
		this.startOfLine = false;
	}

	/**
	 * @return {boolean} True if charIdx is at or beyond the end of the line.
	 */
	endOfLine() {
		return this.charIdx >= this.line.length;
	}

	/**
	 * @return {boolean} True if there is no more code to consume.
	 */
	endOfCode() {
		return this.line === undefined;
	}

	/**
	 * Throws a fatal syntax error with the given message.
	 * @param {string} message The error to throw.
	 */
	throwFatal(message) {
		const text = `SyntaxError while parsing at ${this.lineIdx+1}:${this.charIdx+1}: ${message}`;

		interpreter.print(text);
		throw new SyntaxError(text);
	}

	/**
	 * Warns about a possible problem.
	 * @param {string} message The message to warn about.
	 */
	warn(message) {
		const text = `Warning during parsing at ${this.lineIdx+1}:${this.charIdx+1}: ${message}`;

		if (this.options["warnings"]) {
			interpreter.print(text);
		}

		console.warn(text);
	}

	/**
	 * Attempts to consume a string and any whitespace after it, and throws an error if it fails.
	 * @param  {string} string The characters to consume
	 * @throws {SyntaxError} If the appropriate characters aren't encountered.
	 */
	consume(string) {
		for (let i = 0; i < string.length; ++i) {
			if (this.char != string[i]) {
				this.throwFatal(`Expected to see ${string}`);
			}

			this.nextChar();
		}
		this.consumeInlineWhitespace();
	}

	/**
	 * Looks for a string and merely returns false if it fails. Does not consume anything.
	 */
	peek(string) {
		return this.line.startsWith(string, this.charIdx);
	}

	/**
	 * @return {Array<ForLoop>} The parsed for-loop tree.
	 */
	parse() {
		return this.consumeBlock();
	}

	/**
	 * Consumes whitespace, without moving to the next line.
	 * @returns {boolean} true if whitespace was consumed.
	 */
	consumeInlineWhitespace() {
		let success = false;
		while (!this.endOfLine() && /\s/.test(this.char)) {
			success = true;
			this.nextChar();
		}

		return success;
	}

	/**
	 * Consumes as much continuous whitespace as it can, even if it spans over multiple lines.
	 * @returns {boolean} true if whitespace was consumed.
	 */
	consumeWhitespace() {
		let success = false;
		while (/\s/.test(this.char)) {
			success = success || this.consumeInlineWhitespace();

			if (this.endOfLine()) {
				nextLine();
			}
		}

		return success;
	}

	/**
	 * @returns {bookean} true if it consumed a comment or whitespace
	 */
	consumeComment() {
		let success = false;
		this.consumeWhitespace();
		while (!this.endOfCode() && this.line.startsWith("//", this.charIdx)) {
			success = true;
			this.nextLine();
			this.consumeWhitespace();
		}

		return success;
	}

	/**
	 * @return {Reference|null} Returns the reference if it found one, otherwise null.
	 */
	consumeReference() {
		let name = variableNames.find((name) => this.peek(name));

		if (name === undefined) {
			return null;
		} else {
			this.consume(name);
			return new Reference(name);
		}
	}

	/**
	 * @return {number|null} Returns the numeric literal if it found one, otherwise null.
	 */
	consumeLiteral() {
		let match = /^~?(?:\d+(?:\.\d+)?|\.\d+)/.exec(this.line.substring(this.charIdx));
		if (match === null) {
			return null;
		} else {
			let literal = match[0];
			this.consume(literal);
			return parseFloat(literal.replace('~', '-'));
		}
	}

	/**
	 * @return {number|Reference}
	 * @throws {SyntaxError} If no number or reference is found.
	 */
	consumeValue() {
		if (this.endOfCode()) return null;

		let arg = this.consumeLiteral(); // reminder that 0 is false-y
		if (arg === null) arg = this.consumeReference();

		if (arg === null) {
			this.throwFatal("Expected to see a numeric literal or a variable name.");
		}

		return arg;
	}

	/**
	 * @return {ForLoop|null}
	 */
	consumeLoop() {
		if (this.endOfCode()) return null;

		if (this.peek("For(")) {
			if (!this.startOfLine) {
				this.throwFatal("Unexpected for-loop");
			}

			this.consume("For(");

			let iterator = this.consumeReference();

			if (iterator === null) {
				this.throwFatal("Expected to see a variable name.");
			} else if (iterator.name === "Ans") {
				this.throwFatal("You cannot use Ans as the iterator in a for-loop");
			}

			this.consumeInlineWhitespace();
			this.consume(',');

			let start = this.consumeValue();

			this.consumeInlineWhitespace();
			this.consume(',');

			let end = this.consumeValue();

			this.consumeInlineWhitespace();

			let step = null;
			if (this.peek(',')) {
				this.consume(',');
				step = this.consumeValue();
				this.consumeInlineWhitespace();
			}

			if (this.peek(')')) {
				this.consume(')');
			}

			let body = this.consumeBlock();
			let loop = new ForLoop(iterator, start, end, step, body);

			return loop;
		} else {
			return null;
		}
	}

	/**
	 * @returns {End|null}
	 */
	consumeEnd() {
		if (this.endOfCode()) return null;

		if (this.peek("End")) {
			if (!this.startOfLine) {
				this.throwFatal("Unexpected End statement");
			}

			this.consume("End");

			return new End();
		} else {
			return null;
		}
	}

	/**
	 * @return {Disp|null}
	 */
	consumeDisp() {
		if (this.endOfCode()) return null;

		if (this.peek("Disp ")) {
			if (!this.startOfLine) {
				this.throwFatal("Unexpected Disp statement");
			}

			this.consume("Disp ");

			let arg = this.consumeValue();

			return new Disp(arg);
		} else {
			return null;
		}
	}

	consumeStatement() {
		let consumedJunk;
		do {
			consumedJunk = false;
			if (this.endOfCode()) return null;

			while (this.endOfLine()) {
				this.nextLine();
				if (this.endOfCode()) return null;
				consumedJunk = true;
			}

			if (this.peek(':')) {
				this.consume(':');
				this.startOfLine = true;
				consumedJunk = true;
			}

			consumedJunk = consumedJunk || this.consumeComment();
		} while (consumedJunk);

		return this.consumeLoop() || this.consumeDisp() || this.consumeEnd();
	}

	/**
	 * @return {Block}
	 */
	consumeBlock() {
		this.depth++;

		let statements = [];

		let statement = this.consumeStatement();

		while (statement) {
			if (statement instanceof End) {
				this.depth--;
				if (this.depth < 0) {
					this.throwFatal("Too many End statements!");
				}

				return new Block(statements);
			}

			statements.push(statement);
			statement = this.consumeStatement();
		}

		this.depth--;
		if (this.depth !== 0 && !this.didEndWarning) {
			this.warn(`Not enough End statements: ${this.depth} unclosed block(s).`);
			this.didEndWarning = true;
		}

		return new Block(statements);
	}
}