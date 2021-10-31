/* JavaScript Zero-order Logic rules engine */
// :encoding=UTF-8:                       for jEdit

// Harry KARADIMAS, 2020, 2021

console.log("Entering jszlog.js");

var ti, p, ti_end, cc, cn, linenr, colnr, tee, errCount;
const VALUE_TYPES = ["BOOL", "NUM", "TEXT", "DATE", "TIME", "CALC", "CHOICE"];
const VALUE_TYPE_BOOL = 0;
const VALUE_TYPE_NUM = 1;
const VALUE_TYPE_TEXT = 2;
const VALUE_TYPE_DATE = 3;
const VALUE_TYPE_TIME = 4;
const VALUE_TYPE_CALC = 5;
const VALUE_TYPE_CHOICE = 6; //CHOICE is not allowed as such and must be the last
//kewords are reserved and no variable can have their names. I try to keep as few keywords as possible.
const KEYWORDS = [
  "BOOL","NUM","TEXT","DATE","TIME","DATA","LOGIC","ACTIONS","WRITE",
  "TRUE","FALSE","NOW"
]; //case-sensitive
const CO_EQ = 0;
const CO_NE = 1;
const CO_LT = 2;
const CO_LE = 3;
const CO_GE = 4;
const CO_GT = 5;
const CO_OPERATORS = ["=","<>","<","<=",">=",">"];
//control various debugging messages on the console
const DEBUG_PARSING = false;
const DEBUG_DOM_CONTROL = false;
const DEBUG_TEMPLATING = false;
//constants for calculation
const MS_PER_DAY = 1000 * 60 * 60 * 24; //24 hours of 60 minutes of 60 seconds of 1000 ms
var dataDefs = [];
var dataDefsByName = {};
var rules = [];
var rulesByName = {};
var actionDefs = [];
var actionDefsByName = {};
var inString = false;
var nodeUid = 1;
var checkingCycles = false; //are we checking cycles or not
var callerNodes = new Set(); //to track nodes that are callers and detect cycles
var i18; //internalionalized messsages
var i18_default; //default
var parseMarkerPos; //mark position so we can rewind if necessary. Not used everywhere.
var parsedString; //result of parsed string (used when method returns true or false)
var lang = "en"; //language used

// -------------------------------- OBJECTS -----------------------------------
// moved to objects.js
// -------------------------- END OF OBJECTS ----------------------------------

// -------------------------- TRANSLATIONS ------------------------------------
// moved to i18n.js
// -------------------------- END OF TRANSLATIONS -----------------------------

//parser utility methods

//clearer synonym to get p
function getCurrentParsingPosition() { return p; }

//advance pointer to next char in input.
//read current char and current char number
//ignore comments (what starts with '#' and is not in a string)
function next() {
  p++; colnr++;
  if (p < ti_end) {
    cc = ti.charAt(p);
    cn = ti.charCodeAt(p);
  }
  else {
    p = ti_end;
    cc = -1;
    cn = 0;
  }
  if (cc == '#' && !inString) {
    //skip comment until EOL or EOF
    do {
      p++; colnr++;
      if (p < ti_end) { cc = ti.charAt(p); cn = ti.charCodeAt(p); }
      else { p = ti_end; cc = -1; cn = 0; }
    }
    while (cc != -1 && cc != "\n" && cc != "\r");
  }
  if (cc == "\n" || cc == "\r") { linenr++; colnr = 1; }
}

//rewind pointer n chars back
function rewind(n) {
  p = p - (n + 1); //actually it must be n + 1
  if (p < 0) throw "Error rewinded past start of input !";
  next();
}

//rewind back to position n. Useful to backtrack when parsing failed.
function rewindTo(n) { p = n; }

//space is space, tab or any form of newline
function isSpace() {
  return cc == " " || cc == "\t" || cc == '\n' || cc == '\r';
}

function isIdStart() {
  return ('A' <= cc && cc <= 'Z') || ('a' <= cc && cc <= 'z');
}

function isIdChar() {
  return isIdStart() || ('0' <= cc && cc <= '9') || cc == '_';
}

function isNumberDigit() { return ('0' <= cc && cc <= '9'); }

function skipWs() { while(isSpace()) next(); }

function parseWord() {
  var r = "";
  while (isIdStart()) { r = r + cc; next(); }
  return r;
}

function parseId() {
  var id;
  if (isIdStart()) {
    id = cc;
    next();
    while (isIdChar()) {
      id = id + cc;
      next();
    }
    return id;
  }
  else throw "Not allowed for ID start : " + cc
}

function expect(c) {
  if (cc != c) {
     throw "Expected char '" + c + "', got '" + cc + "'";
     errCount++;
  }
  else {
    next();
  }
}

// synonym for expect(c) when it is obvious that c is expected
function skip(c) { expect(c); }

/**
 * Main entry for parser
 */
function doparse() {
  var r;
  //clear all global vars
  dataDefs = [];
  dataDefsByName = {};
  rules = [];
  rulesByName = {};
  actionDefs = [];
  actionDefsByName = {};
  inString = false;

  ti = document.getElementById('textinput').value;
  tee = document.getElementById('texterr');
  tee.textContent = "";
  toe = document.getElementById('textout');
  toe.textContent = "";

  ti_end = ti.length;
  p = -1;
  linenr = 1; colnr = 1;
  cc = -1;
  next();
  errCount = 0;
  //set the reserved variable NOW to be the start time of the evaluation
  var nowDate = new Date();
  var nowDataDef = new DataDef('NOW', new ValueType('CALC', null), new CeDate(nowDate));
  dataDefs.push(nowDataDef);
  dataDefsByName['NOW'] = nowDataDef;
  console.log("NOW : " + evalVar('NOW'));
  //if (ti_end > 0) cc = ti.charAt(0); else cc = -1;
  //alert("ti : " + ti.value)
  //alert("len:"+ti_end)
  //r = listchars(ti.value)
  //r = "len = " + ti_end;
  parseAll();
  //emitOut(r);
  //to = document.getElementById('textout');
  //to.textContent = r;
  //everything parsed, put content as link
  var retrolink = document.getElementById('retrolink');
  var loc = window.location.href;
  retrolink.textContent = "link";
  var loc2 = loc;
  var ixDttp = loc2.indexOf("&defaulttexttoparse=");
  if (ixDttp > 0) {
    loc2 = loc2.substring(0, ixDttp); //remove previous text
  }
  retrolink.href = loc2 + "&defaulttexttoparse=" + encodeURIComponent(ti);
}

function parseAll() {
  try {
    parseDataSection();
    parseLogicSection();
    parseActionsSection();
    emitOut("********DEFINITIONS*DE*DONNEES**********************************");
    for (var i = 0; i < dataDefs.length; i++) {
      var dd = dataDefs[i];
      //emitOut(dataDefs[dd].print());
      emitOut(dd.print());
    }
    emitOut("--------REGLES--------------------------------------------------");
    for (var i = 0; i < rules.length; i++) {
      var ru = rules[i];
      emitOut(ru.print());
    }
    emitOut("++++++++ACTIONS+++++++++++++++++++++++++++++++++++++++++++++++++");
    for (var i = 0; i < actionDefs.length; i++) {
      var ac = actionDefs[i];
      emitOut(ac.print());
    }
    //now start filling the DOM
    //Data Entry part
    var dataentry = document.getElementById('dataentry');
    removeAllRows(dataentry);
    for (var i = 0; i < dataDefs.length; i++) { //modified for retrocompatibility with IE11
      var dataDef = dataDefs[i];
      //dataDefs.forEach((dataDef, i) => {
      var vtn = dataDef.valueType.name;
      var ddn = dataDef.name;
      if (ddn != 'NOW') { //hide NOW data entry
        var tr = dataentry.insertRow(-1);
        var td = tr.insertCell(0);
        td.innerHTML = dataDef.name;
        td = tr.insertCell(1);
        var typ = "";
        var input = "";
        if (vtn == "BOOL") {
          input = "<input type='checkbox' name='input_" + dataDef.name + "' id='input_" + dataDef.name + "'";
          if (dataDef.defaultValue) input += "checked ";
          input += " onchange='refresh()'>\n";
        }
        else if (vtn == "TEXT" || vtn == "NUM") {
          input = "<input type='text' name='input_" + dataDef.name + "' id='input_" + dataDef.name + "' ";
          if (dataDef.defaultValue !== undefined) {
            input += "value='" + dataDef.defaultValue + "'";
          }
          input += " onchange='refresh()'>\n";
        }
        else if (vtn == "DATE") {
          input = "<input type='date' name='input_" + dataDef.name + "' id='input_" + dataDef.name + "' ";
          if (dataDef.defaultValue !== undefined) {
            input += "value='" + dataDef.defaultValue + "'";
          }
          input += " onchange='refresh()'>\n";
        }
        else if (vtn == "TIME") {
          input = "<input type='time' name='input_" + dataDef.name + "' id='input_" + dataDef.name + "' ";
          if (dataDef.defaultValue !== undefined) {
            input += "value='" + dataDef.defaultValue + "'";
          }
          input += " onchange='refresh()'>\n";
        }
        else if (vtn == "CHOICE") {
          for (var j = 0; j < dataDef.valueType.choices.length; j++) { //changed for retrocompatibility with IE11
            var choice = dataDef.valueType.choices[j];
            //dataDef.valueType.choices.forEach((choice, i) => {
            var checked = (choice == dataDef.defaultValue) ? "checked" : "";
            input += "<input type='radio' name='input_" + dataDef.name + "' id='input_" + dataDef.name + "' ";
            input += "value='" + choice + "' " + checked + " onchange='refresh()'>"
            input += choice + " &nbsp;&nbsp;\n";
          }
        }
        else if (vtn == "CALC") {
          input = "<span id='input_" + dataDef.name + "'></span>"; //start with an empty span element
        }
        else throw "Unknown value type '" + vtn + "'";
        td.innerHTML = input;
        td.id = "input_parent_" + dataDef.name;
      }
    } //for

    //logic rules part
    var rulesElement = document.getElementById('rules');
    removeAllRows(rulesElement);
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      //rules.forEach((rule, i) => {
      var tr = rulesElement.insertRow(-1);
      var td0 = tr.insertCell(0);
      td0.innerHTML = "<span id='node" + rule.uid + "'>" + rule.name + "</span>";
      var td1 = tr.insertCell(1);
      //var td2 = tr.insertCell(2);
      //td2.innerHTML = "";
      td0.colSpan = "2";
      //td0.getAttributeNode("colspan").value = 2;
      //alert(rule.name);
      tr = rulesElement.insertRow(-1);
      td0 = tr.insertCell(0);
      td0.style = "width: 5%;";
      td1 = tr.insertCell(1);
      td1.colSpan = "2";
      td1.innerHTML = rule.html();
      //td2 = tr.insertCell(2);
    }//for

    refresh();

  }
  catch (e) {
    //adust column number because 99% of the time the err is at the position
    //before the current pos
    emitErr(e + " at line " + linenr + " and column " + (colnr - 1));
    //rethrow e to gain from dev tools
    throw e;
  }
  finally {

  }
}

function parseDataSection() {
  var w, moreDefs;
  skipWs();
  w = parseWord();
  //emitOut("'" + w + "'");
  if (w != "DATA") {
    throw "Error expected DATA: here";
    errCount++;
  }
  expect(':');
  //now parse data definitions
  moreDefs = true;
  while (moreDefs) {
    var defName, defVt, theDef, defVal;
    skipWs();
    if (isIdStart()) {
      w = parseId();
      //see if we reached "LOGIC:" section
      if (w == "LOGIC") {
        //reached the LOGIC section
        rewind(5);
        moreDefs = false;
        break; //get out of the loop
      }
      //check it's not a keyword
      if (KEYWORDS.indexOf(w) >= 0) {
        throw "Keyword " + w + " not allowed here"
      }
      //OK it's a data def. Let's read its type
      if (cc != ':') throw "':' expected after this ID";
      expect(':');
      defVt = parseValueType();
      defVal = undefined;
      skipWs();
      if (cc == '=') {
        skip('=');
        if (defVt.name == "CALC") {
          defVal = parseCalculatedExpression();
        }
        else {
          //there is a simple default value following
          defVal = parseTerminalValue();
        }
      }
      skipWs();
      if (cc != '.') throw "Expected '.' to end the data value initializer."
      skip(".");
      //add this new definition
      theDef = new DataDef(w, defVt, defVal);
      dataDefs.push(theDef);
      dataDefsByName[w] = theDef;
    }
    else {
      throw "Syntax error in parseDataSection()"
    }
  }//while(moreDefs)

}

function parseLogicSection() {
  var w;
  skipWs();
  w = parseWord();
  //emitOut("'" + w + "'");
  if (w != "LOGIC") {
    throw "Error expected LOGIC: here";
    errCount++;
  }
  expect(':');
  //read and parse rules
  parseRules();
}

function parseActionsSection() {
  var w;
  skipWs();
  w = parseWord();
  //emitOut("'" + w + "'");
  if (w != "ACTIONS") {
    throw "Error expected ACTIONS: here";
    errCount++;
  }
  expect(':');
  //read and parse actions
  parseActions();
}

function emitErr(e) {
  var content = tee.textContent;
  content = content + e + "\n";
  tee.textContent = content;
}

function emitOut(e) {
  var content = toe.textContent;
  content = content + e + "\n";
  toe.textContent = content;
}

function listchars(s) {
  var outstr = "";
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    outstr = outstr + ", '" + c + "'";
  }
  return outstr;
}

// Parse value type, returns a ValueType object
function parseValueType() {
  var w;
  skipWs();
  if (cc == '{') {
    var choices = [];
    expect('{');
    skipWs();
    while (cc != '}' && cc != -1) {
      var opt;
      if (cc == "'") {
        opt = parseStringLiteral();
        choices.push(opt);
        skipWs();
        if (cc == ",") skip(",");
        skipWs();
      }
      else {
        throw "Syntax error in parseValueType()";
      }
    }//while (cc != '}' && cc != -1)
    if (cc == '}') skip('}');
    return new ValueType("CHOICE", choices);
  }
  else if (isIdStart()) {
    var kwi;
    w = parseWord();
    kwi = VALUE_TYPES.indexOf(w);
    if (VALUE_TYPE_BOOL <= kwi && kwi < VALUE_TYPE_CHOICE) {
      return new ValueType(w, []);
    }
    else {
      throw "Unknown value type '" + w + "'";
    }
  }
  else {
    throw "Syntax error in parseValueType()";
  }
}

// Read a string literal
// Return the string's content
function parseStringLiteral() {
  var opt = "";
  expect("'");
  inString = true;
  while (cc != "'" && cn >= 32) {
    opt = opt + cc;
    next();
  }
  inString = false;
  if (cc == "'") skip("'");
  else throw "Missing ' in parseStringLiteral()";
  return opt;
}

// Read a fact name such as "Low erythrocyte count"
// Return the string
function parseFactName() {
  var fn = "";
  expect('"');
  inString = true;
  while (cc != '"' && cn >= 32) {
    fn = fn + cc;
    next();
  }
  inString = false;
  if (cc == '"') skip('"');
  else throw "Missing ' in parseFactName()";
  return fn;
}

function parseRule() {
  var factName;
  var rule;
  var rhs;
  skipWs();
  if (cc == '"') {
    factName = parseFactName();
    skipWs();
    rhs = new TrueExpr(); //default is true expr
    if (cc == '<') {
      skip('<'); expect('-');
      skipWs();
      //parse body of rule, it becomes the right hand sise
      rhs = parseOrExpr();
    }
    skipWs();
    if (cc == '.') {
      skip('.');
      rule = new Rule(factName, rhs);
      return rule;
    }
    else {
      throw "'.' expected to end a rule.";
    }
  }
  return null; //no more rules -> return null
}

function parseRules() {
  var rule;
  do {
    rule = parseRule();
    if (rule != null) {
      if (rulesByName[rule.name] !== undefined) throw "Error duplication of rule '"+rule.name+"'"
      rules.push(rule);
      rulesByName[rule.name] = rule;
    }
  }
  while (rule != null);
  skipWs();
}

function parseAction() {
  var factName, w, strval, actionDef;
  skipWs();
  if (cc == '"') {
    factName = parseFactName();
    if (cc != ':') throw "Missing ':' after fact name in action definition"
    skip(':');
    skipWs();
    w = parseWord();
    if (w != 'WRITE') throw "only WRITE action is supported currently"
    skipWs();
    if (cc != "'") throw "Expected string literal here"
    strval = parseStringLiteral();
    skipWs();
    if (cc != '.') throw "'.' expected at end of action def";
    skip('.');
    actionDef = new ActionDef(factName, strval);
    return actionDef;
  }
  return null;
}

function parseActions() {
  var actionDef;
  do {
    actionDef = parseAction();
    if (actionDef != null) {
      actionDefs.push(actionDef);
      actionDefsByName[actionDef.name] = actionDef;
    }
  }
  while (actionDef != null);
  skipWs;
}

function parseOrExpr() {
  var l,r;
  l = parseAndExpr();
  skipWs();
  if (cc == "|") {
    skip("|");
    r = parseOrExpr();
    return new OrExpr(l,r);
  }
  else return l;
}

function parseAndExpr() {
  var l,r;
  l = parseNotExpr();
  skipWs();
  if (cc == "&") {
    skip("&");
    r = parseAndExpr();
    return new AndExpr(l,r);
  }
  else return l;
}

function parseNotExpr() {
  var l;
  skipWs();
  if (cc == '!') {
    skip('!');
    l = parseAtomicExpr();
    return new NotExpr(l);
  }
  else {
    l = parseAtomicExpr();
    return l;
  }
}

function parseComparisonOperator() {
  if (cc == '=') {
    skip('=');
    return CO_EQ;
  }
  else if (cc == '<') {
    skip('<');
    if (cc == '=') {
      skip('=');
      return CO_LE;
    }
    else if (cc == '>') {
      skip('>');
      return CO_NE;
    }
    else {
      return CO_LT;
    }
  }
  else if (cc == '>') {
    skip('>');
    if (cc == '=') {
      skip('=');
      return CO_GE;
    }
    else {
      return CO_GT;
    }
  }
  else return null;
}

// Atomic expression is one of
// - ( subexpression )
// - ID
// - ID <comparison_operator> TERMINAL_VALUE
function parseAtomicExpr() {
  var l;
  skipWs();
  if (cc == '(') {
    skip('(');
    skipWs();
    l = parseOrExpr();
    skipWs();
    expect(')');
    return l;
  }
  else if (cc == '"') {
    var factName;
    factName = parseFactName();
    return new FactExpr(factName);
  }
  else if (isIdStart()) {
    var id;
    var cop;
    id = parseId();
    skipWs();
    cop = parseComparisonOperator();
    if (cop == null) {
      return new IdExpr(id);
    }
    else {
      var ce;
      var tv;
      skipWs();
      tv = parseTerminalValue();
      ce = new CompExpr(id, cop, tv);
      return ce;
    }
  }
  else throw "Syntax error [parseAtomicExpr()]";
}

function parseNumber() {
  var numChars;
  numChars = "";
  if (cc == '+' || cc == '-') {
    numChars = numChars + cc;
    next();
  }
  while ('0' <= cc && cc <= '9') {
    numChars = numChars + cc;
    next();
  }
  if (cc == '.') {
    numChars = numChars + cc;
    skip('.');
    if (!('0' <= cc && cc <= '9')) {
      throw "Numeric digit expected after '.'"
    }
    while ('0' <= cc && cc <= '9') {
      numChars = numChars + cc;
      next();
    }
  }
  if (cc == 'E' || cc == 'e') {
    numChars = numChars + cc;
    next();
    if (cc == '+' || cc == '-') {
      numChars = numChars + cc;
      next();
    }
    if (!('0' <= cc && cc <= '9')) {
      throw "Numeric digit expected for exponent '.'"
    }
    while ('0' <= cc && cc <= '9') {
      numChars = numChars + cc;
      next();
    }//while
  }
  return numChars;
}

//Parse a date literal in ISO 8601 format e.g. 2011-10-05T14:48:00.000Z
//What is parsed is yyyy-mm-dd[Thh:mm:ss[.fff][Z]]
function parseDateLiteral() {
  skipWs();
  parsedString = "";
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if (cc == '-') parsedString += cc; else return false;
  skip('-');
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if (cc == '-') parsedString += cc; else return false;
  skip('-');
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if (cc != 'T') return true; //we matched yyyy-mm-dd
  parsedString += cc;
  skip('T');
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if (cc == ':') parsedString += cc; else return false;
  skip(':');
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if (cc == ':') parsedString += cc; else return false;
  skip(':');
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if ('0' <= cc && cc <= '9') parsedString += cc; else return false;
  next();
  if (cc == '.') {
    //optional fractional part
    parsedString += cc;
    skip('.');
    if ('0' <= cc && cc <= '9') parsedString += cc; else return false; //expect at least one digit
    next();
    while ('0' <= cc && cc <= '9') { parsedString += cc; next(); }
  }
  if (cc != 'Z') return true; //we parsed yyyy-mm-ddThh:mm:ss[.fff]
  parsedString += cc;
  skip('Z');
  return true; //we parsed yyyy-mm-ddThh:mm:ss[.fff]Z
}

//Parse a terminal value for a comparison, like 3.1415 or 'cli'. An ID is also accepted
// Return the value (a floating point number, true, false, a date, a string)
function parseTerminalValue() {
  skipWs();
  if (cc == "'") {
    var v;
    v = parseStringLiteral();
    return v;
  }
  else if (cc == '+' || cc == '-') {
    //it's a signed number
    var n;
    n = parseNumber();
    return parseFloat(n);
  }
  else if ('0' <= cc && cc <= '9') {
    //it's either a date literal or a number
    var n, cc_buf;
    parseMarkerPos = getCurrentParsingPosition();
    cc_buf = cc;
    if (parseDateLiteral()) {
      return new Date(parsedString);
    }
    else {
      if (DEBUG_PARSING) console.log("It's not a date, rewinding back to number parsing ... p=" + p + "cc='" + cc + "', cc_buf='" + cc_buf + "'");
      rewindTo(parseMarkerPos); cc = cc_buf; //cc hacked directly
      n = parseNumber();
      return parseFloat(n);
    }
  }
  else if (isIdStart()) {
    var kw, ddef;
    kw = parseId();
    if (kw == "TRUE") return true;
    else if (kw == "FALSE") return false;
    else if (kw == "NOW") return evalVar(kw); //return current date
    //we allow other IDs for comparisons, so that validation gets easier
    ddef = dataDefsByName[kw];
    if (ddef === undefined) throw im('ERR_UNKNOWN_IDENTIFIER' + " : '" + kw + "'");
    return evalVar(kw);
  }
  else throw "Illegal value for comparison";
}

function parseCalculatedExpression() {
  var condExecExpr;
  condExecExpr = parseCondExecExpression();
  if (condExecExpr != null) return condExecExpr;
  return parseCeAddSubExpression();
}

function parseCondExecExpression() {
  var factName,l,r;
  var markedPos;
  skipWs();
  if (cc != '"') return null; //not a conditional, return null
  markedPos = getCurrentParsingPosition(); //record in case we have to backtrack
  factName = parseFactName();
  skipWs();
  if (cc != '?') {
    //it's not a conditional expression, backtrack
    p = markedPos;
    cc = '"';
    return null;
  }
  skip('?');
  l = parseCalculatedExpression();
  skipWs();
  if (cc == ':') {
    skip(':');
    r = parseCalculatedExpression();
  }
  return new CeCondExec(factName,l,r); //if r is undefined leave it undefined here !
}

function parseCeAddSubExpression() {
  var l,r;
  l = parseCeMulDivExpression();
  skipWs();
  if (cc == '+' || cc == '-') {
    var op = cc;
    skip(cc);
    r = parseCeAddSubExpression();
    return new CeAddSubExpr(op, l, r);
  }
  else return l;
}

function parseCeMulDivExpression() {
  var l,r;
  l = parseCeTermExpr();
  skipWs();
  if (cc == '*' || cc == '/') {
    var op = cc;
    skip(cc);
    r = parseCeMulDivExpression();
    return new CeMulDivExpr(op, l, r);
  }
  else return l;
}

function parseCeTermExpr() {
  skipWs();
  if (cc == '(') {
    skip('(');
    skipWs();
    var nd = parseCalculatedExpression();
    skipWs();
    expect(')');
    return nd;
  }
  else if (cc == '"') {
    var factName = parseFactName();
    return new CeFact(factName);
  }
  else if (isIdStart()) {
    var id = parseId();
    if (cc == '(') {
      var argList = parseCeArgList();
      return new CeFunctionCall(id, argList);
    }
    else return new CeVar(id);
  }
  else if (cc == '+' || cc == '-' || isNumberDigit()) {
    var num = parseNumber();
    return new CeNum(num);
  }
  else if (cc == "'") {
    var parsedString;
    parsedString = parseStringLiteral();
    return new CeString(parsedString);
  }
  else throw "Syntax error [parseCeTermExpr()]";
}

function parseCeArgList() {
  var argsAvail;
  var argList = [];
  var arg;
  skip('(');
  skipWs();
  argsAvail = (cc != ')');
  while (argsAvail) {
    skipWs();
    arg = parseCalculatedExpression();
    skipWs();
    argList.push(arg);
    if (cc == ',') {
      skip(',');
    }
    else argsAvail = false;
  }//while
  skipWs();
  if (cc != ')') throw "Closing parenthesis missing";
  skip(')');
  return argList;
}

// Invoke calc() for every rule. This also updates the classes of the elements
function evalRules() {
  checkingCycles = true;
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    //rules.forEach((rule, i) => {
    callerNodes.clear(); //clear all callerNodes to evaluate circular references
    rule.calc();
  }
  checkingCycles = false;
}

// Evaluate rule, general purpose method
function evalRule(factName) {
  var rule = rulesByName[factName];
  if (rule !== undefined) {
    return rule.calc();
  }
  else return false; //not found = false
}

// Evaluate Vars (DataDef's) that are calculated, to detect cycles
function evalVars() {
  checkingCycles = true;
  for (var i = 0; i < dataDefs.length; i++) {
    var dataDef = dataDefs[i];
    if (dataDef.valueType.name == "CALC" && dataDef.name != 'NOW') { //don't refresh NOW because it's hidden
      callerNodes.clear();
      var spanElt = document.getElementById("input_"+dataDef.name);
      spanElt.textContent = pp(evalVar(dataDef.name));
    }
  }//for
  checkingCycles = false;
}

// Evaluate variable (DataDef element)
function evalVar(id) {
  var dd = dataDefsByName[id];
  if (dd == null) return null;
  if (dd.valueType.name == "CALC") {
    if (checkingCycles) {
      if (callerNodes.has(dd.name)) {
        var m = "Cyclic reference of \""+dd.name+"\" detected !";
        alert(m);
        throw m;
      }
      else {
        callerNodes.add(dd.name);
        var r = dd.defaultValue.calc();
        callerNodes.delete(dd.name);
        if (DEBUG_EVAL) console.log("[evalVar '" + id + "']r = " + r);
        return r;
      }
    }
    else {
      var r = dd.defaultValue.calc();
      if (DEBUG_EVAL) console.log("[evalVar '" + id + "']r = " + r);
      return r;
    }
  }
  else {
    return getDataInputValue(id);
  }
}

function fireActions() {
  var ao = document.getElementById("actionsoutput");
  var str = "";
  ao.textContent = ""
  for (var i = 0; i < actionDefs.length; i++) {
    var actionDef = actionDefs[i];
    var rule = rulesByName[actionDef.name];
    if (rule && rule.calc()) {
      str += replaceValues(actionDef.strval) + "\n";
    }
  }//for
  ao.textContent = str;
}

function replaceValues(templateString) {
  var re = /\$[A-Z][0-9A-Z_]* /ig;
  if (templateString == null) return "";
  if (DEBUG_TEMPLATING) console.log("templateString: '"+templateString+"'");
  var str = templateString;
  var result;
  while ((result = re.exec(templateString)) !== null) {
    if (DEBUG_TEMPLATING) console.log(result);
    var ms = result[0]; //matched string
    var varName = ms.substring(1, ms.length - 1); //take what's between $ and final space
    if (DEBUG_TEMPLATING) console.log("varName: '" + varName + "'");
    var varVal = evalVar(varName);
    str = str.replace(ms, varVal);
  }
  return str;
}

function refresh() {
  evalRules(); //evalRules also calculates vars as necessary
  evalVars(); //this allows to calculate the vars that have not been referenced by any rule
  fireActions();
}

//got it from https://stackoverflow.com/questions/6234773/can-i-escape-html-special-chars-in-javascript
function escapeHTML(unsafe) {
  return unsafe.replace(/[&<>"']/g, function(m) {
    switch (m) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
          return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#039;';
    }
  });
};


//return value of data input value using just it's id
function getDataInputValue(id) {
  var ctrl = document.getElementById("input_"+id);
  if (ctrl == null) {
    if (DEBUG_EVAL) console.log("element input_" + id + " not found, returning null");
    return false; //not found = return false
  }
  var dd = dataDefsByName[id];
  if (dd == null) return ctrl.value;
  var vtn = dd.valueType.name;
  if (vtn == "BOOL") {
    return ctrl.checked;
  }
  else if (vtn == "CHOICE") {
    var v = getSelectedRadioButtonValue("input_" + dd.name);
    if (DEBUG_EVAL) console.log("CHOICE : " + v);
    //alternate strategy for radio buttons, which are really hard
    return v;
  }
  else if (vtn == "CALC") {
    var v;
    v = dd.defaultValue.calc();
    //special "calculated value" type
    if (DEBUG_EVAL) console.log("CALC : " + v);
    return v;
  }
  else if (vtn == "DATE") {
    var v;
    v = ctrl.value;
    if (DEBUG_EVAL) console.log("DATE : '" + v + "'");
    if (v.trim() == "") return null;
    return new Date(v);
  }
  else if (vtn == "TIME") {
    var v;
    v = ctrl.value;
    if (DEBUG_EVAL) console.log("TIME : '" + v + "'");
    if (v.trim() == "") return null;
    return new Date('1970-01-01T' + v.trim() + 'Z').getTime() / MS_PER_DAY;
  }
  else {
    if (DEBUG_EVAL) console.log("Control '" + id + "' : value = '" + ctrl.value +"'")
    if (vtn == "NUM") return parseFloat(ctrl.value);
    else return ctrl.value;
  }
}

function getSelectedRadioButtonValue(name) {
  //found correct method in https://www.javascripttutorial.net/javascript-dom/javascript-radio-button/
  var elts = document.querySelectorAll('input[name="'+name+'"]');
  for (var i = 0; i < elts.length; i++) {
    var v = elts[i];
    if (v.checked) return v.value;
  }
  return null;
}

//Apply class (trueElt, falseElt) to element with the uid if it exists
//returns val
function ac(uid, val) {
  if (DEBUG_DOM_CONTROL) console.log("uid:"+uid,",val:"+val);
  var elt = document.getElementById("node"+uid);
  if (elt) {
    if (val) elt.className = "trueElt";
    else elt.className = "falseElt";
  }
  return val;
}

//called when body loads
function initvalues() {
  console.log("Guessing language");
  var loc = window.location.href;
  console.log(loc);
  //TODO match lang=en or such
  var lang_match = /lang=(..)/.exec(loc);
  lang = "en"; //it's a global var
  if (lang_match) lang = lang_match[1];
  console.log("'"+lang+"'");
  //very crude language handling, if more than 3..4 languages are needed,
  //clearly something else will be needed !!
  switch (lang) {
    case 'en':
      i18 = english_messages;
      break;
    case 'fr':
      i18 = french_messages;
      console.log("Switching to french");
      break;
    default:
      i18 = i18_default;
  }
  internalionalize();
  var ttp_match = /defaulttexttoparse=(.*)/.exec(loc); //must be last parameter
  if (ttp_match) {
    var ttp = document.getElementById('textinput');
    ttp.textContent = decodeURIComponent(ttp_match[1]);
  }
}

function visibilityTextout() {
  var toElt = document.getElementById("textout");
  var cls = toElt.className;
  if (cls == "invisible") toElt.className = "visible";
  else toElt.className = "invisible";
}

function removeAllRows(table) {
  while (table.rows.length > 0) table.deleteRow(-1);
}

function im(k) {
  var msg = i18[k];
  if (msg === undefined) msg = i18_default[k];
  return msg;
}

function im_id(id) {
	var element = document.getElementById(id);
	if (element === undefined) { 
		console.log("Could not find element with id '"+id+"'"); 
	}
	else {
		//Treat buttons (id starts with btn_) differently
		if (id.substring(0,4) == "btn_") element.value = im(id.toUpperCase());
		else element.textContent = im(id.toUpperCase());
	}
}

/**
 * Internalionalize various parts
 */
function internalionalize() {
  //im_id('');
  im_id('variable_name_th');
  im_id('variable_value_th');
  im_id('rule_name_th');
  im_id('rule_body_th');
  im_id('internal_content_span');
  im_id('enter_something_interesting_span');
  im_id('manual_span');
  im_id('btn_analyze');
  im_id('btn_template');
  im_id('btn_calc');
  im_id('btn_example1');
  im_id('btn_example2');
  im_id('fill_in_examples_span');
  
  // var variable_name_th = document.getElementById('variable_name_th');
  // variable_name_th.textContent = im('VARIABLE_NAME_TH');
  // var variable_value_th = document.getElementById('variable_value_th');
  // variable_value_th.textContent = im('VARIABLE_VALUE_TH');
  // var rule_name_th = document.getElementById('rule_name_th');
  // rule_name_th.textContent = im('RULE_NAME_TH');
  // var rule_body_th = document.getElementById('rule_body_th');
  // rule_body_th.textContent = im('RULE_NAME_TH');
  
  
}

function buttonEmptyTemplate() {
  var eltInput = document.getElementById("textinput");
  if (lang == "fr") {
    eltInput.textContent = '#Titre.\n' +
    'DATA:\n' +
    'LOGIC:\n' +
    'ACTIONS:\n' +
    '\n'
    ;
  }
  else { // "en" and others
    eltInput.textContent = '#Title.\n' +
    'DATA:\n' +
    'LOGIC:\n' +
    'ACTIONS:\n' +
    '\n'
    ;
  }
}

function buttonCalculatorTemplate() {
  var eltInput = document.getElementById("textinput");
  if (lang == "fr") {
    eltInput.textContent = '#Utilisation comme calculateur (cf. manuel pour la liste des fonctions)\n' +
    'DATA:\n' +
    '  x: CALC = 1 + 1 . # remplacer 1 + 1 par votre expression a calculer\n' +
    'LOGIC:\n' +
    'ACTIONS:\n' +
    '\n'
    ;
  }
  else { //"en", and all others
    eltInput.textContent = '#Usage as a calculator (see manual for the list of functions)\n' +
    'DATA:\n' +
    '  x: CALC = 1 + 1 . # replace 1 + 1 with the expression you want to calculate\n' +
    'LOGIC:\n' +
    'ACTIONS:\n' +
    '\n'
    ;

  }
}

function buttonExample1() {
  var eltInput = document.getElementById("textinput");
  if (lang == "fr") {
    eltInput.textContent = '#Exemple simple : detection d\'une hypokaliémie.\n' +
    'DATA:\n' +
    '  potassium: NUM .\n' +
    'LOGIC:\n' +
    ' "Hypokaliémie" <- potassium < 3.5 . # noter l\'espace entre le nombre et le point\n' +
    'ACTIONS:\n' +
    '  "Hypokaliémie": WRITE \'Une Hypokaliémie ($potassium  mmol/l) a été détectée\' .\n' +
    '\n'
    ;
  }
  else { //en and all others
    eltInput.textContent = '#Simple example : detect hypokalemia.\n' +
    'DATA:\n' +
    '  potassium: NUM .\n' +
    'LOGIC:\n' +
    ' "Hypokalemia" <- potassium < 3.5 . # note the space between the number and the point\n' +
    'ACTIONS:\n' +
    '  "Hypokalemia": WRITE \'An hypokalemia ($potassium  mmol/l) has been detected\' .\n' +
    '\n'
    ;
  }

}

function buttonExample2() {
  var eltInput = document.getElementById("textinput");
  if (lang == "fr") {
    eltInput.textContent =
    '#Exemple plus elaboré : calcul de la clairance de la Créatinine \n' +
    '#(par la formule de Cockroft-Gault). \n' +
    'DATA:\n' +
    '  age_en_annees: NUM .\n' +
    '  poids_en_kg: NUM .\n' +
    '  creatininemie_en_mmol_l: NUM .\n' +
    '  sexe: {\'masculin\',\'feminin\'} .\n' +
    '  crclm: CALC = 1.23 * poids_en_kg * (140 - age_en_annees) / creatininemie_en_mmol_l .\n' +
    '  crclf: CALC = 1.04 * poids_en_kg * (140 - age_en_annees) / creatininemie_en_mmol_l .\n' +
    '  crcl: CALC = "Sexem" * crclm + "Sexef" * crclf .\n' +
    'LOGIC:\n' +
    '  "Sexem" <- sexe = \'masculin\' .\n' +
    '  "Sexef" <- sexe = \'feminin\' .\n' +
    '  "Ecrire résultat". # C\'est un fait : on écrit toujours le résultat\n' +
    '  "Commenter si diminuée" <- ("Sexem" & crcl < 100) | ("Sexef" & crcl < 75) .\n' +
    '  "Commenter si augmentée" <- ("Sexem" & crcl > 140) | ("Sexef" & crcl > 115) .\n' +
    'ACTIONS:\n' +
    '  "Ecrire résultat": WRITE \'Clairance estimée : $crcl  ml/min\' .\n' +
    '  "Commenter si augmentée": WRITE \'La clairance estimée est plus haute que la normale\' .\n' +
    '  "Commenter si diminuée": WRITE \'La clairance estimée est plus basse que la normale\' .\n'
    ;
  }
  else { //"en" and all others
    eltInput.textContent =
    '#A more elaborate example : calculate creatinin clearance \n' +
    '#(using the Cockroft-Gault formula). \n' +
    'DATA:\n' +
    '  age_in_years: NUM .\n' +
    '  weight_in_kg: NUM .\n' +
    '  serum_creatinine_in_mmol_l: NUM .\n' +
    '  sex: {\'male\',\'female\'} .\n' +
    '  crclm: CALC = 1.23 * weight_in_kg * (140 - age_in_years) / serum_creatinine_in_mmol_l .\n' +
    '  crclf: CALC = 1.04 * weight_in_kg * (140 - age_in_years) / serum_creatinine_in_mmol_l .\n' +
    '  crcl: CALC = "Msex" * crclm + "Fsex" * crclf .\n' +
    'LOGIC:\n' +
    '  "Msex" <- sex = \'male\' .\n' +
    '  "Fsex" <- sex = \'female\' .\n' +
    '  "Print result". # Fact : we always print the result.\n' +
    '  "Comment when below" <- ("Msex" & crcl < 100) | ("Fsex" & crcl < 75) .\n' +
    '  "Comment when above" <- ("Msex" & crcl > 140) | ("Fsex" & crcl > 115) .\n' +
    'ACTIONS:\n' +
    '  "Print result": WRITE \'Estimated creatinin clearance : $crcl  ml/min\' .\n' +
    '  "Comment when below": WRITE \'The estimated creatinin clearance is lower than normal.\' .\n' +
    '  "Comment when above": WRITE \'The estimated creatinin clearance is higher than normal.\' .\n'
    ;
  }
}
