// Objects used by jszlog.js

console.log("Entering objects.js 1");

const DEBUG_OBJECTS = false;
const DEBUG_EVAL = true;

console.log("Entering objects.js 2");

//"prettyprint" v by outputting ISO String if v is a date
function pp(v) {
  //console.log("type of v : " + typeof v);
  if (v == null) return "<null>";
  if (v instanceof Date) {
    //console.log("ISO STRING : " + v.toISOString());
    return v.toISOString();
  }
  else return v.toString();
}

// DataDef object constructor function
// name : string, valueType : ValueType object, defaultValue : string, number or CeCalculatedExpression object
function DataDef(name, valueType, defaultValue) {
  this.uid = nodeUid++;
  this.name = name;
  this.valueType = valueType;
  this.defaultValue = defaultValue;
}

DataDef.prototype.print = function() {
  var s;
  s = "data def name: " + this.name + ", valueType: (";
  s += this.valueType ? this.valueType.print() : "<null>";
  if (this.defaultValue !== undefined) {
    if (this.valueType.name == "CALC") {
      s += ", defaultValue: " + pp(this.defaultValue.print());
    }
    else s += ", defaultValue: " + pp(this.defaultValue);
  }
  s += ")";
  return s;
};

DataDef.prototype.calc = function() {
  var v;
  if (this.valueType !== undefined) {
    if (this.valueType.name == "CALC") {
      v = this.defaultValue.calc();
      if (DEBUG_EVAL) console.log("For CALC returning value " + v);
      return v;
    }
  }
  v = getDataInputValue(this.name);
  if (DEBUG_EVAL) console.log("In DataDef.calc, returning " + v);
  return v;
};

//ActionDef object constructor function
function ActionDef(name, strval) {
  this.name = name;
  this.strval = strval;
}

ActionDef.prototype.print = function() {
  var s;
  s = "action def name: " + this.name + ", strval: '" + this.strval + "'";
  return s;
};

//ValueType object constructor function
//name is one of "BOOL", "TEXT", "NUM", "CALC", "CHOICE" ("CHOICE" can not be set directly)
//You can get the number of the type with VALUE_TYPES.indexOf(w)
function ValueType(name, choices) {
  this.name = name;
  this.choices = choices;
}
ValueType.prototype.print = function () {
  return "type: " + this.name + ", choices: " + this.choices;
};


//Rules, and expressions that are associated to rules

//Rule object constructor function
function Rule(name, expr) {
  this.uid = nodeUid++;
  this.name = name;
  this.expr = expr;
}
Rule.prototype.print = function() { return "name:"+this.name+",expr:"+this.expr.print(); };
Rule.prototype.html = function() { return this.expr.html(); };
Rule.prototype.calc = function() {
  if (checkingCycles) {
    if (callerNodes.has(this.name)) {
      var m = "Cyclic call of \""+this.name+"\" detected !";
      alert(m);
      throw m;
    }
    else {
      callerNodes.add(this.name);
      var rv = ac(this.uid, this.expr.calc());
      callerNodes.delete(this.name);
      return rv;
    }
  }
  else {
    var v = ac(this.uid, this.expr.calc());
    if (DEBUG_EVAL) console.log("In Rule[" + this.name + "].calc, returning " + v);
    var rv = v;
    return rv;
  }
}

//constructor for AndExpr object
function AndExpr(l,r) {
  this.uid = nodeUid++;
  this.op = '&';
  this.l = l;
  this.r = r;
}
AndExpr.prototype.print = function() {
  var s;
  s = '(' + this.l.print();
  if (this.r !== undefined) s = s + " & " + this.r.print();
  s += ')';
  return s;
};
AndExpr.prototype.html = function() {
  var s;
  s = "<span id='node" + this.uid + "'>" + '(' + this.l.html();
  if (this.r !== undefined) s = s + " &amp; " + this.r.html();
  s += ')' + "</span>";
  return s;
};
AndExpr.prototype.calc = function() {
  var v;
  var lc = this.l.calc();
  if (this.r === undefined) {
    return ac(this.uid, lc);
  }
  var rc = this.r.calc();
  v = lc == true && rc == true;
  if (DEBUG_EVAL) console.log("In AndExpr, lc = "+lc+", rc = "+rc+", v = " + v);
  return ac(this.uid, v);
}

//constructor for OrExpr object
function OrExpr(l,r) {
  this.uid = nodeUid++;
  this.op = '|';
  this.l = l;
  this.r = r;
}
OrExpr.prototype.print = function() {
  var s;
  s = '(' + this.l.print();
  if (this.r !== undefined) s = s + " | " + this.r.print();
  s += ')';
  return s;
};
OrExpr.prototype.html = function() {
  var s;
  s = "<span id='node" + this.uid + "'>" + '(' + this.l.html();
  if (this.r !== undefined) s = s + " | " + this.r.html();
  s += ')' + "</span>";
  return s;
};
OrExpr.prototype.calc = function() {
  var v;
  var lc = this.l.calc();
  if (this.r === undefined) return ac(this.uid, lc);
  var rc = this.r.calc();
  v = lc == true || rc == true;
  if (DEBUG_EVAL) console.log("In OrExpr, lc = "+lc+", rc = "+rc+", v = " + v);
  return ac(this.uid, v);
}


//constructor for NotExpr object
function NotExpr(l) {
  this.uid = nodeUid++;
  this.op = '!';
  this.l = l;
}
NotExpr.prototype.print = function() { return "!" + this.l.print(); };
NotExpr.prototype.html = function() { return "<span id='node" + this.uid + "'>" + "!" + this.l.html() + "</span>"; };
NotExpr.prototype.calc = function() {
  var lc = this.l.calc();
  var v = !(lc == true);
  if (DEBUG_EVAL) console.log("In NotExpr, lc = " + lc + ", v = " + v);
  return ac(this.uid, v);
}

//constructor for FactExpr object
function FactExpr(factName) {
  this.uid = nodeUid++;
  this.factName = factName;
}
FactExpr.prototype.print = function() { return '"' + this.factName + '"'; };
FactExpr.prototype.html = function() {
  return "<span id='node" + this.uid + "'>\"" + this.factName + "\"</span>";
};
FactExpr.prototype.calc = function() {
  var rul = rulesByName[this.factName];
  if (rul !== undefined) {
    return ac(this.uid, rul.calc()); //TODO protect from circular references !
  }
  else return ac(this.uid, false); //not found = false
};

//constructor for TrueExpr object
function TrueExpr() {
  this.uid = nodeUid++;
}
TrueExpr.prototype.print = function() { return "true"; };
TrueExpr.prototype.html = function() {
  return "<span id='node" + this.uid + "'>true</span>";
};
TrueExpr.prototype.calc = function() {
  return ac(this.uid, true); //that was easy
};

//constructor for IdExpr object
function IdExpr(id) {
  this.uid = nodeUid++;
  this.id = id;
};
IdExpr.prototype.print = function() { return this.id; };
IdExpr.prototype.html = function() { return "<span id='node" + this.uid + "'>" + this.id + "</span>"; }
IdExpr.prototype.calc = function() {
  return ac(this.uid, evalVar(this.id)); //using this helper function, queries the form directly or calculates an expr
};

//constructor for comparison subexpression
//id is text
function CompExpr(id, cop, val) {
  this.uid = nodeUid++;
  this.id = id;
  this.cop = cop;
  this.val = val;
}
CompExpr.prototype.print = function() {
  var s;
  s = this.id + " " + CO_OPERATORS[this.cop] + " ";
  if (typeof this.val == "string") s = s + "'" + this.val + "'";
  else s = s + this.val;
  return s;
}
CompExpr.prototype.html = function() {
  var s;
  s = "<span id='node" + this.uid + "'>";
  s += this.id + " " + escapeHTML(CO_OPERATORS[this.cop]) + " ";
  if (typeof this.val == "string") s += "'" + this.val + "'";
  else {
    if (DEBUG_OBJECTS) console.log("CompExpr val : " + this.val);
    s += pp(this.val);
  }
  s += "</span>";
  return s;
}
CompExpr.prototype.calc = function() {
  var v;
  //var idv = getDataInputValue(this.id); //get value from form
  var idv = evalVar(this.id); //eval var because now IDs are also allowed
  if (DEBUG_OBJECTS) console.log("idv:"+idv+",id:"+this.id+",cop:"+this.cop+",val:'"+this.val+"'");
  switch (this.cop) {
    case CO_EQ:
      v =  ac(this.uid, idv == this.val);
      break;
    case CO_GE:
      v =  ac(this.uid, idv >= this.val);
      break;
    case CO_GT:
      v =  ac(this.uid, idv > this.val);
      break;
    case CO_LE:
      v =  ac(this.uid, idv <= this.val);
      break;
    case CO_LT:
      v =  ac(this.uid, idv < this.val);
      break;
    case CO_NE:
      v =  ac(this.uid, idv != this.val);
      break;
    default:
      v =  ac(this.uid, false); //unknown comparison expr -> false
  }
  if (DEBUG_EVAL) console.log("In CompExpr.calc, id="+this.id+",idv="+pp(idv)+", cop="+this.cop+",val="+pp(this.val)+", v="+pp(v));
  return v;
};



//Calculated expressions, that can appear in CALC - typed variables

//constructor for generic calculated expression
function CeExpr(l) {
  this.uid = nodeUid++;
  this.l = l;
}
CeExpr.prototype.print = function() {
  var s;
  s = this.l.print();
  return s;
}
CeExpr.prototype.html = function() {
  return escapeHTML(this.print());
}
CeExpr.prototype.calc = function() {
  var lv = this.l.calc();
  return lv;
};

//constructor for Conditional ternary operator "fact" ? expr_if_true [ : expr_if_false ]
function CeCondExec(factName, l, r) {
  this.uid = nodeUid++;
  this.factname = factName;
  this.l = l;
  this.r = r;
}
CeCondExec.prototype.print = function() {
  var s;
  s = this.factname + " ? " + this.l.print();
  if (this.r !== undefined) s += " : " + this.r.print();
  return s;
}
CeCondExec.prototype.html = function() {
  return escapeHTML(this.print());
}
CeCondExec.prototype.calc = function() {
  var ruleVal = evalRule(this.factname);
  var lv = this.l.calc();
  var rv = ""; //default is empty string for right part, which evaluates also to false
  if (this.r !== undefined) rv = this.r.calc();
  return ruleVal ? lv : rv;
};

//constructor for calculated expression add and sub
function CeAddSubExpr(op, l, r) {
  this.uid = nodeUid++;
  this.op = op;
  this.l = l;
  this.r = r;
}
CeAddSubExpr.prototype.print = function() {
  var s;
  s = this.l.print() + " " + this.op + " " + this.r.print();
  return s;
}
CeAddSubExpr.prototype.html = function() {
  return escapeHTML(this.print());
}
/**
 * Addition is overloaded for : date + nr_of_days
 * Substraction is overloaded for : date - nr_of_days, date - date
 * Evaluation is left associative here so we have to loop while the right
 * node is CeAddSubExpr, we must not descend recursively.
 */
CeAddSubExpr.prototype.calc = function() {
  var accResult = this.l.calc();
  var r = this.r;
  var op = this.op;
  var addSubEval = function(op, lv, r) {
    var rv = r.calc();
    if (op == '+') {
      //'+' is very overloaded
      if (lv instanceof Date && !isNaN(rv)) {
        return new Date(lv.getTime() + MS_PER_DAY * rv);
      }
      if (rv instanceof Date && !isNaN(lv)) {
        return new Date(rv.getTime() + MS_PER_DAY * lv);
      }
      return lv + rv;
    }
    else if (op == '-') {
      //'-' is overloaded even more
      if (lv instanceof Date && !isNaN(rv)) {
        return new Date(lv.getTime() - MS_PER_DAY * rv);
      }
      if (rv instanceof Date && !isNaN(lv)) {
        return new Date(rv.getTime() - MS_PER_DAY * lv);
      }
      if (lv instanceof Date && rv instanceof Date) {
        var ms = lv - rv; //this is the difference in milliseconds
        return ms / MS_PER_DAY;
      }
      return lv - rv;
    }
    else throw "Unallowed op '"+op+"'";
  };//addSubEval
  while (r instanceof CeAddSubExpr) {
    accResult = addSubEval(op, accResult, r.l);
    op = r.op; //get next op
    r = r.r; //advance to next node
  }
  accResult = addSubEval(op, accResult, r); //final calculation
  return accResult;
};

//constructor for calculated expression mul and div
function CeMulDivExpr(op, l, r) {
  this.uid = nodeUid++;
  this.op = op;
  this.l = l;
  this.r = r;
}
CeMulDivExpr.prototype.print = function() {
  var s;
  s = this.l.print() + " " + this.op + " " + this.r.print();
  return s;
}
CeMulDivExpr.prototype.html = function() {
  return escapeHTML(this.print());
}
/**
 * Evaluation is left associative here so we have to loop while the right
 * node is CeMulDivExpr, we must not descend recursively.
 */
CeMulDivExpr.prototype.calc = function() {
  var accResult = this.l.calc();
  var r = this.r;
  var op = this.op;
  //function is simpler here because '*' and '-' are not overloaded for date and time operations
  var mulDivEval = function(op, lv, r) {
    var rv = r.calc();
    if (op == '*') { return lv * rv; }
    else if (op == '/') { return lv / rv; }
    else throw "Unallowed operator '"+op+"'";
  };//mulDivEval
  while (r instanceof CeMulDivExpr) {
    accResult = mulDivEval(op, accResult, r.l);
    op = r.op;
    r = r.r; //chain with next expr
  }
  accResult = mulDivEval(op, accResult, r); //final calculation
  return accResult;
};

//constructor for calculated expression : fact name
function CeFact(factName) {
  this.factName = factName;
}
CeFact.prototype.print = function() { return this.factName; };
CeFact.prototype.html = function() { return escapeHTML(this.print()); };
CeFact.prototype.calc = function() { return evalRule(this.factName); };

//constructor for calculated expression : id value
function CeVar(id) {
  this.id = id;
}
CeVar.prototype.print = function() { return this.id; };
CeVar.prototype.html = function() { return escapeHTML(this.print()); };
CeVar.prototype.calc = function() { return evalVar(this.id); };

//constructor for calculated expression : number
function CeNum(num) {
  this.num = parseFloat(num);
}
CeNum.prototype.print = function() { return this.num; };
CeNum.prototype.html = function() { return escapeHTML(this.print()); };
CeNum.prototype.calc = function() { return this.num; };

//constructor for calculated expression : String
function CeString(str) {
  this.str = str;
}
CeString.prototype.print = function() { return this.str; };
CeString.prototype.html = function() { return escapeHTML(this.print()); };
CeString.prototype.calc = function() { return this.str; };

//constructor for calculated expression : date
function CeDate(dateLiteral) {
  if (dateLiteral instanceof Date) this.date = dateLiteral;
  else this.date = new Date(dateLiteral);
}
CeDate.prototype.print = function() {
  if (DEBUG_OBJECTS) console.log("To ISO String : " + this.date.toISOString());
  return this.date.toISOString();
};
CeDate.prototype.html = function() { return escapeHTML(this.print()); };
CeDate.prototype.calc = function() { return this.date; };

//constructor for function call
function CeFunctionCall(id, argList) {
  this.id = id;
  this.argList = argList;
}
CeFunctionCall.prototype.print = function() { return this.id + '(' + this.argList.map(function(v){return v.print()}).join(',') + ')';  };
CeFunctionCall.prototype.html = function() { return escapeHTML(this.print()); };
CeFunctionCall.prototype.calc = function() {
  var arg1, arg2, arg3;
  var str, r, t, i;
  switch(this.id) {
    case 'COS':
      if (this.argList.length != 1) throw "Only one argument expected for COS";
      arg1 = this.argList[0].calc();
      if (DEBUG_EVAL) console.log("COS arg : '" + arg1 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("COS arg : '" + arg1 + "' is NaN");
        return NaN;
      }
      else return Math.cos(arg1);

    case 'SIN':
      if (this.argList.length != 1) throw "Only one argument expected for SIN";
      arg1 = this.argList[0].calc();
      if (DEBUG_EVAL) console.log("SIN arg : '" + arg1 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("SIN arg : '" + arg1 + "' is NaN");
        return NaN;
      }
      else return Math.sin(arg1);

    case 'TAN':
      if (this.argList.length != 1) throw "Only one argument expected for TAN";
      arg1 = this.argList[0].calc();
      if (DEBUG_EVAL) console.log("TAN arg : '" + arg1 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("TAN arg : '" + arg1 + "' is NaN");
        return NaN;
      }
      else return Math.tan(arg1);

    case 'SQRT':
      if (this.argList.length != 1) throw "Only one argument expected for SQRT";
      arg1 = this.argList[0].calc();
      if (DEBUG_EVAL) console.log("SQRT arg : '" + arg1 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("SQRT arg : '" + arg1 + "' is NaN");
        return NaN;
      }
      else return Math.sqrt(arg1);

    case 'FLOOR':
      if (this.argList.length != 1) throw "Only one argument expected for FLOOR";
      arg1 = this.argList[0].calc();
      if (DEBUG_EVAL) console.log("FLOOR arg : '" + arg1 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("FLOOR arg : '" + arg1 + "' is NaN");
        return NaN;
      }
      else return Math.floor(arg1);

    case 'TRUNC':
      if (this.argList.length != 1) throw "Only one argument expected for TRUNC";
      arg1 = this.argList[0].calc();
      if (DEBUG_EVAL) console.log("TRUNC arg : '" + arg1 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("TRUNC arg : '" + arg1 + "' is NaN");
        return NaN;
      }
      else return Math.trunc(arg1);

    case 'CEIL':
      if (this.argList.length != 1) throw "Only one argument expected for CEIL";
      arg1 = this.argList[0].calc();
      if (DEBUG_EVAL) console.log("CEIL arg : '" + arg1 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("CEIL arg : '" + arg1 + "' is NaN");
        return NaN;
      }
      else return Math.ceil(arg1);

    case 'ABS':
      if (this.argList.length != 1) throw "Only one argument expected for ABS";
      arg1 = this.argList[0].calc();
      if (DEBUG_EVAL) console.log("ABS arg : '" + arg1 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("ABS arg : '" + arg1 + "' is NaN");
        return NaN;
      }
      else return Math.abs(arg1);

    case 'EXP':
      if (this.argList.length != 1) throw "Only one argument expected for EXP";
      arg1 = this.argList[0].calc();
      if (DEBUG_EVAL) console.log("EXP arg : '" + arg1 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("EXP arg : '" + arg1 + "' is NaN");
        return NaN;
      }
      else return Math.exp(arg1);

    case 'LOG':
      if (this.argList.length != 1) throw "Only one argument expected for LOG";
      arg1 = this.argList[0].calc();
      if (DEBUG_EVAL) console.log("LOG arg : '" + arg1 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("LOG arg : '" + arg1 + "' is NaN");
        return NaN;
      }
      else return Math.log(arg1);

    case 'ROUND':
      if (this.argList.length != 1) throw "Only one argument ROUNDected for ROUND";
      arg1 = this.argList[0].calc();
      if (DEBUG_EVAL) console.log("ROUND arg : '" + arg1 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("ROUND arg : '" + arg1 + "' is NaN");
        return NaN;
      }
      else return Math.round(arg1);

    /**
     * Helper function to format a fractional day into hours:minutes format
     */
    case 'HM':
      if (this.argList.length != 1) throw "Only one argument expected for HM";
      arg1 = this.argList[0].calc();
      if (DEBUG_EVAL) console.log("HM arg : '" + arg1 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("HM arg : '" + arg1 + "' is NaN");
        return "??:??";
      }
      else {
        var days = Math.abs(arg1) + 0.1157e-5; //adding the equivalent of a second to optimize rounding
        var intDays = Math.floor(days);
        var hours = (days - intDays) * 24;
        var intHours = Math.floor(hours);
        var minutes = (hours - intHours) * 60;
        var intMinutes = Math.floor(minutes);
        return (intHours < 10 ? "0" : "") + intHours + ":" + (intMinutes < 10 ? "0" : "") + intMinutes ;
      }

    case 'POW':
      if (this.argList.length != 2) throw "Exactly two arguments expected for POW";
      arg1 = this.argList[0].calc();
      arg2 = this.argList[1].calc();
      if (DEBUG_EVAL) console.log("POW args : '" + arg1 + "', '" + arg2 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("POW arg 1 : '" + arg1 + "' is NaN");
        return NaN;
      }
      if (isNaN(arg2)) {
        if (DEBUG_EVAL) console.log("POW arg 2 : '" + arg2 + "' is NaN");
        return NaN;
      }
      else return Math.pow(arg1, arg2);

    case 'MOD':
      if (this.argList.length != 2) throw "Exactly two arguments expected for MOD";
      arg1 = this.argList[0].calc();
      arg2 = this.argList[1].calc();
      if (DEBUG_EVAL) console.log("MOD args : '" + arg1 + "', '" + arg2 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("MOD arg 1 : '" + arg1 + "' is NaN");
        return NaN;
      }
      if (isNaN(arg2)) {
        if (DEBUG_EVAL) console.log("MOD arg 2 : '" + arg2 + "' is NaN");
        return NaN;
      }
      else return arg1 % arg2;

    //Integer division (or quotient)
    //For negative number results, see : https://en.wikipedia.org/wiki/Modulo_operation
    //and : https://stackoverflow.com/questions/4228356/integer-division-with-remainder-in-javascript
    case 'IDIV':
      if (this.argList.length != 2) throw "Exactly two arguments expected for IDIV";
      arg1 = this.argList[0].calc();
      arg2 = this.argList[1].calc();
      if (DEBUG_EVAL) console.log("IDIV args : '" + arg1 + "', '" + arg2 + "'");
      if (isNaN(arg1)) {
        if (DEBUG_EVAL) console.log("IDIV arg 1 : '" + arg1 + "' is NaN");
        return NaN;
      }
      if (isNaN(arg2)) {
        if (DEBUG_EVAL) console.log("IDIV arg 2 : '" + arg2 + "' is NaN");
        return NaN;
      }
      else return Math.trunc(arg1 / arg2); //I prefer the implementation that uses "trunc"

    case 'MIN':
      r = NaN;
      //hk 201119 changed to be retro compatible with IE 11
      for (var i = 0; i < this.argList.length; i++) {
        var arg = this.argList[i];
        t = arg.calc();
        if (isNaN(r)) r = t;
        else if (t < r) r = t;
      }
      //for (var arg of this.argList) {
      //}
      return r;


    case 'MAX':
      r = NaN;
      for (var i = 0; i < this.argList.length; i++) {
        var arg = this.argList[i];
        //for (var arg of this.argList) {
        t = arg.calc();
        if (isNaN(r)) r = t;
        else if (t > r) r = t;
      }
      return r;


    case 'CAT':
      r = "";
      for (var i = 0; i < this.argList.length; i++) {
        var arg = this.argList[i];
        //for (var arg of this.argList) {
        r = r + arg.calc().toString();
      }
      return r;

    case 'LEFT':
      if (this.argList.length != 2) throw "Exactly two arguments expected for LEFT";
      arg1 = this.argList[0].calc();
      arg2 = this.argList[1].calc();
      if (DEBUG_EVAL) console.log("LEFT args : '" + arg1 + "', '" + arg2 + "'");
      if (isNaN(arg2)) {
        if (DEBUG_EVAL) console.log("LEFT arg 2 : '" + arg2 + "' is NaN");
        return arg1.toString();
      }
      else return arg1.toString().slice(0, arg2);


    case 'RIGHT':
      if (this.argList.length != 2) throw "Exactly two arguments expected for RIGHT";
      arg1 = this.argList[0].calc();
      arg2 = this.argList[1].calc();
      if (DEBUG_EVAL) console.log("RIGHT args : '" + arg1 + "', '" + arg2 + "'");
      if (isNaN(arg2)) {
        if (DEBUG_EVAL) console.log("RIGHT arg 2 : '" + arg2 + "' is NaN");
        return arg1.toString();
      }
      else return arg1.toString().slice(-arg2);


    case 'SLICE':
      if (this.argList.length != 3) throw "Exactly three arguments expected for SLICE";
      arg1 = this.argList[0].calc();
      arg2 = this.argList[1].calc();
      arg3 = this.argList[2].calc();
      if (DEBUG_EVAL) console.log("SLICE args : '" + arg1 + "', '" + arg2 + "'");
      if (isNaN(arg2)) {
        if (DEBUG_EVAL) console.log("SLICE arg 2 : '" + arg2 + "' is NaN");
        return arg1.toString();
      }
      else if (isNaN(arg3)) {
        if (DEBUG_EVAL) console.log("SLICE arg 3 : '" + arg2 + "' is NaN");
        return arg1.toString();
      }
      else return arg1.toString().slice(arg2, arg3);


    case 'LEN':
      if (this.argList.length != 1) throw "Only one argument expected for LEN";
      arg1 = this.argList[0].calc();
      if (DEBUG_EVAL) console.log("LEN arg : '" + arg1 + "'");
      return arg1.toString().length;

    case 'INDEXOF':
      if (this.argList.length != 2) throw "Exactly two arguments expected for INDEXOF";
      arg1 = this.argList[0].calc();
      arg2 = this.argList[1].calc();
      if (DEBUG_EVAL) console.log("INDEXOF args : '" + arg1 + "', '" + arg2 + "'");
      return arg1.toString().indexOf(arg2.toString());


    default:
      throw "Unknown function '"+this.id+"'";
  }//switch
};
