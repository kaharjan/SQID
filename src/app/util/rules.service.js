//////// Module Definition ////////////
define([
	'util/util.module',
'util/ruleExamples.service',
'util/wikidataapi.service',
'util/util.service',
'util/sparql.service',
'i18n/i18n.service'
], function() {
///////////////////////////////////////

angular.module('util').factory('rules', [
'ruleExamples','wikidataapi', 'util', 'i18n', 'sparql', '$q', '$http', 
function(ruleExamples, wikidataapi, util, i18n, sparql, $q, $http) {
	
var sparqlLimit = 100;
	


var addIfNew = function(value, list) {
	if(list.indexOf(value)===-1) list.push(value);
};

//map contains a list per key
var put = function(map,key,value) {
	if(map[key] != null) map[key].push(value); //check for duplicates?
	map[key] = [value];
	return;
};

//merge first into second
var mergeMaps = function(map1,map2) {
	for (var key in map1) {
		  if (map1.hasOwnProperty(key)) {
			  if (map2.hasOwnProperty(key)) {
				  
				  map2[key]= map2[key].concat(map1[key]);
			  } else {
				  map2[key]= map1[key];
			  }
		  }
	}
};

var isSPARQLVar = function(object, itemInRule) {
	
	return (object.type == "variable") && (object.value != itemInRule);	
};

//object needs type and value
var getSPARQLTerm = function(object, itemInRule, itemId) {
	
	return (object.type != "variable")  ? object.value : 
		isSPARQLVar(object, itemInRule) ? "?"+object.value : itemId;
};

//qualifier needs attribute and qvalue
//itemInRule is id or var
var addQualifierSPARQL = function(qualifier, stmtvar, pvalue, sparql, itemInRule, itemId) { 
	
	var attrIsVar = isSPARQLVar(qualifier.attribute, itemInRule);
	var attr = getSPARQLTerm(qualifier.attribute, itemInRule, itemId);


	var qvalueIsVar = isSPARQLVar(qualifier.qvalue, itemInRule);
	var qvalue = getSPARQLTerm(qualifier.qvalue, itemInRule, itemId);
	
//	TODO maybe replace stmt attr value with other names. currently we have a problem if the variables in the rule have these names
	var s1;
	if(attrIsVar) {
		s1 =	" \n stmt attr value. " + attr +
				"qualifier wikibase:qualifier attr.";
		
		addIfNew(attr,sparql.selectvars);
		
	} else {
		s1 =	" \n stmt pq:attr value. \n";
	} 
	
	if(qvalueIsVar) addIfNew(qvalue,sparql.selectvars);

	sparql.where +=  s1
	.replace(/stmt/g, stmtvar)
	.replace(/attr/g, attr)
	.replace(/value/g, qvalueIsVar ? qvalue : "wd:"+qvalue);
	
};

//atom needs entity, property, and pvalue
//itementity is id or var, the term representing item in the rule
var addRelTripleSPARQL = function(atom, stmtvar, sparql, itemInRule, itemId, language) { 
	
	var entityIsVar = isSPARQLVar(atom.entity, itemInRule);
	var entity = getSPARQLTerm(atom.entity, itemInRule, itemId);
	
	var pvalueIsVar = isSPARQLVar(atom.pvalue, itemInRule);
	var pvalue = getSPARQLTerm(atom.pvalue, itemInRule, itemId); 
	
//	TODO maybe replace entity ... with other names. currently we have a problem if the variables in the rule have these names
	var s0 =	" \n\
	entity p:property stmt. \n\
	stmt ps:property value. ";

	if(entityIsVar) addIfNew(entity,sparql.selectvars);
	if(pvalueIsVar) addIfNew(pvalue,sparql.selectvars);
	addIfNew(stmtvar,sparql.selectvars);


	sparql.where += s0
		.replace(/entity/g, entityIsVar ? entity : "wd:"+entity)
		.replace(/value/g, pvalueIsVar ? pvalue : "wd:"+pvalue)
		.replace(/property/g, atom.property)
		.replace(/stmt/g, stmtvar);

};



//	a relational atom, index for it, rule it occurs in, id of entity the inferred stmts are about
var getStatementVariable = function(atom, index, itemInRule, itemId) {
	
	var entityIsVar = isSPARQLVar(atom.entity, itemInRule);
	var entity = getSPARQLTerm(atom.entity, itemInRule, itemId);
	
	return (entityIsVar ? entity : "?"+entity) + "stmt" + index;

};	


var addRelAtomSPARQL = function(atom, index, rule, setVarMap, qvalueAtomMap, sparql, id, language) {
	
	var stmtVar = getStatementVariable(atom, index, rule, id);
	
	addRelTripleSPARQL(atom,stmtVar,sparql, rule.head.atom.entity.value,id,language);
	
	var qualifiers = atom.set.type == "set-expression" ? atom.set.value : setVarMap[atom.set.value];
	var pvalue = getSPARQLTerm(atom.pvalue, rule.head.atom.entity.value, id); 
		
	angular.forEach(qualifiers, function(qualifier) {
		
		addQualifierSPARQL(qualifier,stmtVar, atom.property, sparql,rule.head.atom.entity.value,id);		
		
		qvalueAtomMap[qualifier.qvalue.value] = index;
	});	

}

//for all set variables, collect the qualifiers mentioned with it
var getSetVarQualifiers = function(atoms) {
	var sets = new Object();
	
	angular.forEach(atoms, function(atom) {
		if(atom.type == "set-atom") { 
			put(sets, atom.variable, atom);
			
		} else if(atom.type == "closed-specifier" || atom.type == "open-specifier") {
			angular.forEach(atom.value, function(qualifier) {
				put(sets, atom.variable, qualifier);
			});
		}
	});
	
	return sets;
};

//currently not used. sth did not work
//var getSetVarsRelAtomIndex = function(varname, rule) {
//	var index = 0;
//	for (var i = 0; i < rule.body.atoms.length; i++) {
//		if(rule.body.atoms[i].type == "relational-atom"){
//			
//			if(rule.body.atoms[i].set.type == "variable" &&
//					rule.body.atoms[i].set.value == varname) return index;
//			
//			index++;
//		}
//	}
//		
//	return -1;//should not occur since MAPLE requires each set var to occur in a relational atom
//};


//for all set variables, collect the info if an open specifier is part of its specification
var getOpenSpecAtomMap = function(rule) {
	var sets = new Object();

	angular.forEach(rule.body.atoms, function(atom) {
		
		if(atom.type == "open-specifier") {
			
//			atom in rule
			var index = 0;
			angular.forEach(rule.body.atoms, function(atom2) {
				if(atom2.type == "relational-atom" && atom2.set.value == atom.variable) {

					sets[atom.variable] = index;
				}
				index++;
			});
		}
		
	});
//	TODO open spec in function term, is regarded as open in general
	if(rule.head.atom.set.type == "function-term") {

		angular.forEach(rule.head.atom.set.value, function(f) {
			angular.forEach(f.conditions, function(atom) {
				if(atom.type == "open-specifier") {
					
//					atom in rule
					var index = 0;
					angular.forEach(rule.body.atoms, function(atom2) {
						if(atom2.type == "relational-atom" && atom2.set.value == atom.variable) {

							sets[atom.variable] = index;
						}
						index++;
					});
					

				}
				
			});
		});
	}
	
	return sets;
};

////we currently assume each set var to occur only in one rel atom
//var getSetVarAtomIndexMap = function(rule) {
//	var index = 0;
//	var result = new Object();
//	
//	angular.forEach(rule.body.atoms, function(atom) {
//		if(atom.type == "relational-atom") {
//			if(atom.set.type == "set-variable")
//				result[atom.set.value] = index;
//			
//			index++;
//		}
//	});
//	
//}

//we currently assume each set var to occur only in one rel atom
var getSetVarAtomMap = function(rule) {
	var index = 0;
	var result = new Object();
	
	angular.forEach(rule.body.atoms, function(atom) {
		if(atom.type == "relational-atom" && atom.set.type == "set-variable") {
				result[atom.set.value] = {atom:atom, index:index};	
		}
		index++;
	});
	
//	something like this is probably only needed if set variables in the function conditions
//	can refer to set variables introduced only with relational atoms in the same condition
//	but then we need to make sure that we do not refer to relational atoms from other conditions
//	this is not yet covered by the below code
//	if(rule.head.atom.set.type == "function-term") {
//
//		angular.forEach(rule.head.atom.set.value, function(f) {
//			angular.forEach(f.conditions, function(atom) {
//				if(atom.type == "relational-atom") {
//					if(atom.set.type == "set-variable")
//						result[atom.set.value] = {atom:atom, index:index};
//					
//					index++;
//				}
//			});
//		});
//	}
	
	return result;
}

var getAtom = function(rule, index) {	
	
	
	if(index < rule.body.atoms.length) 
		return rule.body.atoms[index];		
		
	if(rule.head.atom.set.type == "function-term") {
		
		var j = rule.body.atoms.length-1;
		var functions = rule.head.atom.set.value;
		
		for (var i = 0; i < functions.length; i++) {
			
			if(index < j + functions[i].conditions.length) 
				return functions[i].conditions[index-j];	
						
			j += functions[i].conditions.length;
			
		}
	}
	
	return null;
};



	
var getRules = function(id,language) {	
//	qvalueAtomMap: maps qualifiers to relational atom it is associated to (to ease property... finding later)
//	form: {rule: rule, qvalueatommap: qvalueAtomMap, sparql: query}
	var ruleData = [];
	
//	import rules from external source?
//		var promise= null;
//		if (!promise){
//			promise = $http.get("data/rules.json").then(function(response){
//				var JSONRules = response.rules;
	
	angular.forEach(ruleExamples.getRules(), function(rule) {
//		parameters to pass by reference
		var sparql = {
			selectvars: [],
			where: "",
			filter: ""
		}	
		
//		atom in rule
		var index = 0;

		var setVarQualifiersMap = getSetVarQualifiers(rule.body.atoms);
		var setVarOpenInfo = getOpenSpecAtomMap(rule);
		//collect occurrences
//		var setVarAtomMap = getSetVarAtomIndexMap(rule);
		var setVarAtomMap = getSetVarAtomMap(rule);
		var qvalueAtomMap = new Object();
		
		var optLabels = [];
		
		angular.forEach(rule.body.atoms, function(atom) {
			if(atom.type == "relational-atom"){
				
				addRelAtomSPARQL(atom, index, rule, setVarQualifiersMap, qvalueAtomMap, sparql, id, language);
			}
			index++;
		});
		
		
//		we (re)use the sparql.where/filter to store the OPTIONAL/OPTIONAL filters, therefore save the real ones
		var where = sparql.where;
		var filter = sparql.filter;
		sparql.where =  "";	
		sparql.filter =  "";	
		
		var optionals = "";

		
		if(rule.head.atom.set.type == "function-term") {
			var entityTerm0;
			angular.forEach(rule.head.atom.set.value, function(f, findex) {

				var setVarQualifiersMap2 = getSetVarQualifiers(f.conditions);
				mergeMaps(setVarQualifiersMap, setVarQualifiersMap2);
								
				angular.forEach(f.conditions, function(atom, i) {
//					we (can) assume that there are relational atoms in the body where the variable occurs in
					if(atom.type == "set-atom"){
						
						var batom = setVarAtomMap[atom.variable].atom;
						var index2 = setVarAtomMap[atom.variable].index;				
						var stmtVar = getStatementVariable(batom, index2, rule, id);
						var pvalue = getSPARQLTerm(batom.pvalue, rule.head.atom.entity.value, id); 

						addQualifierSPARQL(atom,stmtVar,pvalue,sparql,rule.head.atom.entity.value,id);
						
//						we do not want to overwrite refs to (certain) body occurrences
						if(qvalueAtomMap[atom.qvalue.value] == null)
							qvalueAtomMap[atom.qvalue.value] = index2;
						
						if(i==0) entityTerm0 = getSPARQLTerm(batom.entity,rule.head.atom.entity.value,id);
						
					} else if(atom.type == "relational-atom"){

						addRelAtomSPARQL(atom, index, rule, setVarQualifiersMap, qvalueAtomMap, sparql, id, language);
						
						if(i==0) entityTerm0 = getSPARQLTerm(atom.entity,rule.head.atom.entity.value,id);//getStatementVariable(atom, stmtIndex-1, rule, id);
					
					} else if(atom.type == "open-specifier") { //|| atom.type == "closed-specifier"){ closed cannot occur
					
						var batom = setVarAtomMap[atom.variable].atom;
						var index2 = setVarAtomMap[atom.variable].index;
						var stmtVar = getStatementVariable(batom, index2, rule, id);
						var pvalue = getSPARQLTerm(batom.pvalue, rule.head.atom.entity.value, id); 
					
						angular.forEach(atom.value, function(atom) {

							addQualifierSPARQL(atom,stmtVar,pvalue,sparql,rule.head.atom.entity.value,id);
							
//							we do not want to overwrite refs to (certain) body occurrences
							if(qvalueAtomMap[atom.qvalue.value] == null)
								qvalueAtomMap[atom.qvalue.value] = index2;
					
						});
						
						if(i==0) entityTerm0 = getSPARQLTerm(batom.entity,rule.head.atom.entity.value,id); 
					}
					
					index++;
				});	
				
//				//	TODO maybe rename. currently we have a problem if the variables in the rule have this name
				var lvar0 = "?optlabel"+ findex;
				optLabels.push("optlabel"+ findex);
				optionals += " OPTIONAL {" + sparql.where + 
				entityTerm0 + " rdfs:label " + lvar0 +
				". FILTER (lang(" + lvar0 +" ) = \""+ language +"\")." +
				sparql.filter + " } ";

			});		
		}
		
		//we assume each variable to occur only once!
		var select = "";
		angular.forEach(sparql.selectvars, function(v) {
			select +=  v + " ";
		});
		angular.forEach(optLabels, function(v) {
			select += "?" +v + " ";
		});

		var query =	//sparql.getStandardPrefixes() 			currently too few 
			"PREFIX wd: <http://www.wikidata.org/entity/> \n" +
			"PREFIX wdt: <http://www.wikidata.org/prop/direct/> \n" +
			"PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> \n" +
			"PREFIX ps: <http://www.wikidata.org/prop/statement/> \n" +
			"PREFIX pq: <http://www.wikidata.org/prop/qualifier/> \n" +
			"PREFIX pqv: <http://www.wikidata.org/prop/qualifier/value/> \n" +
			"PREFIX wikibase: <http://wikiba.se/ontology#>" +
			
			"SELECT " + select + " WHERE { " + where + optionals + filter + " } LIMIT " + sparqlLimit;
		
			
		ruleData.push({rule: rule, 	//setvaratommap: setVarAtomMap,
			qvalueatommap: qvalueAtomMap, setvarmap: setVarQualifiersMap, setvaropeninfo: setVarOpenInfo, optlabels: optLabels,sparql: query});
	
	});
	
	return ruleData;
};


var getQualifierSnaksForRule = function(itemId, qualifierset, openAtomIndex, rule, qvalueAtomMap, sparqlBindings, apiBindings, atomsToStmts) {
	var qualifiers = {};

	angular.forEach(qualifierset, function(qualifier) {
		
		var attrId = qualifier.attribute.type == "variable" ? 
				sparqlBindings[qualifier.attribute.value].value.substring("http://www.wikidata.org/prop/qualifier/".length) : qualifier.attribute.value;

		var snak = null;
		var isItem = qualifier.qvalue.type == "item";
		if (isItem) {
			snak = {
					snaktype: "value",
					property: attrId,
//						hash: "351acc5bd28610a98a591db9fc5ba31103a951b0",
					datatype: "wikibase-item",
					datavalue: {
						type: "wikibase-entityid",
						value: {
                            'entity-type': "item",
                            'numeric-id': qualifier.qvalue.value.substring(1),
                            id: qualifier.qvalue.value
                        }
					}
			}; 
		} else {//we assume it is a variable
			var index = qvalueAtomMap[qualifier.qvalue.value];
			var stmtIndexInApiBindings = atomsToStmts[index]; 
			
			var atom = getAtom(rule,index);

			//TODO the last [0] is not correct
			snak = apiBindings[stmtIndexInApiBindings].claims[atom.property][0].qualifiers[attrId][0];
//			for (var qsnak in apiBindings[stmtIndexInApiBindings].claims[atom.property][0].qualifiers[attrId]) {
//				if(qsnak.hash == qvalueHash) {
//					snak = qsnak;
//					break;
//				}
//			}
		}


		if (! (attrId in qualifiers) ) {
			qualifiers[attrId] = [];
		}
		qualifiers[attrId].push(snak);
	
	});
	
		
	
	if(openAtomIndex != null) {

		var stmtIndexInApiBindings = atomsToStmts[openAtomIndex]; 	
		var atom = getAtom(rule,openAtomIndex);

		var qualifiersJSON = apiBindings[stmtIndexInApiBindings].claims[atom.property][0].qualifiers;
		
		for (var attrId in qualifiersJSON) {
			  if (qualifiersJSON.hasOwnProperty(attrId)) {
				  angular.forEach(qualifiersJSON[attrId], function(snak) {
						
						if (! (attrId in qualifiers) ) {
							qualifiers[attrId] = [];
						}
						qualifiers[attrId].push(snak);
					});
			  }
		}
	}
	
	
	
	return qualifiers;
};

//var allSetAtomVarsBound = function(atom, sparqlBindings) { 
//
//	var result = true;
//	
//	if(atom.value.attribute.type == "variable") 
//		result = result && sparqlBindings.hasOwnProperty(atom.value.attribute.value);
//	if(atom.value.qvalue.type == "variable") 
//		result = result && sparqlBindings.hasOwnProperty(atom.value.qvalue.value);
//	
//	return result;
//};
//	
//var allRelAtomVarsBound = function(atom, sparqlBindings) { 
//
//	var result = true;
//	
//	if(atom.entity.type == "variable") 
//		result = result && sparqlBindings.hasOwnProperty(atom.entity.value);
//	if(atom.pvalue.type == "variable") 
//		result = result && sparqlBindings.hasOwnProperty(atom.pvalue.value);
//	
//	return result;
//};

//assume atom of type "function-term"
var getFunctionQualifiers = function(atom, ruleData, sparqlBindings, apiBindings, itemId) { 
	var qualifiers = [];
	
	angular.forEach(atom.set.value, function(f, findex) {

		if(sparqlBindings.hasOwnProperty(ruleData.optlabels[findex])) { 
			angular.forEach(f.insert, function(qualifier) {
				qualifiers.push(qualifier);
			});
		}
	});
	
	return qualifiers;
};


var addInferredFromQuery = function(itemId, ruleData, allSparqlBindings, apiBindings, atomsToStmts, statements, propertyIds, itemIds) { 

	var rule = ruleData.rule;

	angular.forEach(allSparqlBindings, function(sparqlBindings, i) {
		
		var property = rule.head.atom.property;
		var pvalue = rule.head.atom.pvalue.type == "variable" ? sparqlBindings[rule.head.atom.pvalue.value].value
				.substring("http://www.wikidata.org/entity/".length) : rule.head.atom.pvalue.value;
	
		if (! (property in statements) ) {
			statements[property] = [];
			propertyIds[property] = true;
		}

//TODO consider case that too many? 
		var entityType;
		if (pvalue.substring(0,1) == "P") {
			entityType = "property";
			propertyIds[pvalue] = true;
		} else {
			entityType = "item";
			itemIds[pvalue] = true;
		}
		
		var qset = rule.head.atom.set.type == "set-expression" ? rule.head.atom.set.value : 
			rule.head.atom.set.type == "set-variable" ? ruleData.setvarmap[rule.head.atom.set.value] : 
				rule.head.atom.set.type == "function-term" ? getFunctionQualifiers(rule.head.atom, ruleData, sparqlBindings, apiBindings, itemId) : [];//latter should never be the case?

		var openAtomIndex = ruleData.setvaropeninfo[rule.head.atom.set.value];
		

		var value = { "entity-type": entityType, "numeric-id": pvalue.substring(1)};
		
		var snak = {
			snaktype: "value",
			property: property,
			datatype: "wikibase-item",
			datavalue: {value: value, type: "wikibase-entityid"}
		}; 

//		TODO fix 
		var stmtId = 0;
		var stmt = { mainsnak: snak, rank: "normal", type: "statement", 
				id: stmtId, 
				qualifiers: getQualifierSnaksForRule(itemId, qset, openAtomIndex, rule, ruleData.qvalueatommap, sparqlBindings, apiBindings,  atomsToStmts[i])
		}; 
		
		statements[property].push(stmt);
	});

}



var getStatementsInferred = function(id) {
	
	var language = i18n.getLanguage();
	
	var rules = getRules(id, language);
	var requests = [];
	
	angular.forEach(rules, function (rule) {
		requests.push(sparql.getQueryRequest(rule.sparql));
	});
	
	var statements = {};
	var propertyIds = {};
	var itemIds = {};
	
	return $q.all(requests).then( function(responses) {
		
//		collect the ids needed to request the qualifiers
		var stmtIds = [];
		var atomsToStmts = [];

		angular.forEach(responses, function (response, i) {
			var atomsToStmts1 = [];
			
			angular.forEach(response.results.bindings, function (result, k) {
				
				var atomsToStmts2 = [];
				
				var index = 0;			
				angular.forEach(rules[i].rule.body.atoms, function (atom) {
					
					if(atom.type == "relational-atom") { 
						var sv = getStatementVariable(atom, index, rules[i].rule.head.atom.entity.value, id).substring(1);
						
						var stmtId = result[sv].value
							.substring("http://www.wikidata.org/entity/statement/".length).replace('-','$');
						var j = stmtIds.indexOf(stmtId);
						if(j == -1) {
							stmtIds.push(stmtId);	
							atomsToStmts2[index] = stmtIds.length-1;
						} else {
							atomsToStmts2[index] = j;
						}

					}
					index++;
				});	
				

				if(rules[i].rule.head.atom.set.type == "function-term") {
					angular.forEach(rules[i].rule.head.atom.set.value, function (f) {
						angular.forEach(f.conditions, function (atom) {
							if(atom.type == "relational-atom") { 
								
								var sv = getStatementVariable(atom, index, rules[i].rule.head.atom.entity.value, id).substring(1);
								
								
								var stmtId = result[sv].value
								.substring("http://www.wikidata.org/entity/statement/".length).replace('-','$');
								var j = stmtIds.indexOf(stmtId);
								if(j == -1) {
									stmtIds.push(stmtId);	
									atomsToStmts2[index] = stmtIds.length-1;
								} else {
									atomsToStmts2[index] = j;
								}
							
							}
							index++;
						});
	
					});	
				}
				
				atomsToStmts1.push(atomsToStmts2);
			});
			atomsToStmts.push(atomsToStmts1);
		});	

		
		
		return	wikidataapi.getClaims(stmtIds).then(function(apiBindings){
			
			for (var i = 0; i < rules.length; i ++) {
				addInferredFromQuery(id, rules[i], responses[i].results.bindings, 
						apiBindings, atomsToStmts[i],
						statements, propertyIds, itemIds );
			}

			
			return { statements:statements, propertyids: propertyIds,itemids:itemIds};
			
		});		
	});
};




//----------------------------------------------------------------------------------------------------------------
// ALL BELOW IS TEST CODE
//----------------------------------------------------------------------------------------------------------------

//
//var addInferredFromQuery2 = function(itemId, ruleData, qvalueAtomMap, allSparqlBindings, apiBindings, statements, propertyIds, itemIds) { 
//	var sparqlBindings = allSparqlBindings[0];
//	
//	var rule = ruleData.rule;
//	
//	var property = rule.head.atom.property;
//	var pvalue = rule.head.atom.pvalue.type == "variable" ? sparqlBindings[rule.head.atom.pvalue.value].value
//			.substring("http://www.wikidata.org/entity/".length) : rule.head.atom.pvalue.value;
//
//	if (! (property in statements) ) {
//		statements[property] = [];
//		propertyIds[property] = true;
//	}
//
//// consider case that too many? 
//// we currently only consider statements the other case, not sure how to consider the first	
//	var entityType;
////				if (pvalue.substring(0,1) == "P") {
////					entityType = "property";
////					propertyIds[pvalue] = true;
////				} else
//	{
//		entityType = "item";
//		itemIds[pvalue] = true;
//	}
//
//	var value = { "entity-type": entityType, "numeric-id": pvalue.substring(1)};
//	
//	var snak = {
//		snaktype: "value",
//		property: property,
//		datatype: "wikibase-item",
//		datavalue: {value: value, type: "wikibase-entityid"}
//	}; 
//	
////	 fix 
//	var stmtId = 0;
////	the set may be a variable/action! so fix qualifiers, 
//	var stmt = { mainsnak: snak, rank: "normal", type: "statement", 
//			id: stmtId, 
//			qualifiers: []//getQualifierSnaksForRule(rule.head.atom.set.value, rule, qvalueAtomMap, sparqlBindings, apiBindings)
//	}; 
//	return stmt;
//	statements[property].push(stmt);
//	
//	
//	angular.forEach(allSparqlBindings, function(sparqlBindings) {
//		
//		var property = rule.head.atom.property;
//		var pvalue = rule.head.atom.pvalue.type == "variable" ? sparqlBindings[rule.head.atom.pvalue.value].value
//				.substring("http://www.wikidata.org/entity/".length) : rule.head.atom.pvalue.value;
//	
//		if (! (property in statements) ) {
//			statements[property] = [];
//			propertyIds[property] = true;
//		}
//
//// consider case that too many? 
//// we currently only consider statements the other case, not sure how to consider the first	
//		var entityType;
////					if (pvalue.substring(0,1) == "P") {
////						entityType = "property";
////						propertyIds[pvalue] = true;
////					} else
//		{
//			entityType = "item";
//			itemIds[pvalue] = true;
//		}
//
//		var value = { "entity-type": entityType, "numeric-id": pvalue.substring(1)};
//		
//		var snak = {
//			snaktype: "value",
//			property: property,
//			datatype: "wikibase-item",
//			datavalue: {value: value, type: "wikibase-entityid"}
//		}; 
//		
////		fix 
//		var stmtId = 0;
////		 the set may be a variable/action! so fix qualifiers, 
//		var stmt = { mainsnak: snak, rank: "normal", type: "statement", 
//				id: stmtId, 
//				qualifiers: []//getQualifierSnaksForRule(rule.head.atom.set.value, rule, qvalueAtomMap, sparqlBindings, apiBindings)
//		}; 
//		
//		statements[property].push(stmt);
//	});
//
//}


//		{"mainsnak":{
	//	"snaktype":"value",
//			"property":"P1038",
//			"datavalue":{
//				"value":{"entity-type":"item","numeric-id":425612},
//				"type":"wikibase-entityid"},
//			"datatype":"wikibase-item"},
//		"type":"statement",
//		"qualifiers":{
//			"P1039":[{
//				"snaktype":"value",
//				"property":"P1039",
//				"hash":"b3aef1481fa4e9ea4e1e33e698a10e682c547361",
//				"datavalue":{"value":{"entity-type":"item","numeric-id":9238344},
//							"type":"wikibase-entityid"},
//				"datatype":"wikibase-item"}]
//			},"qualifiers-order":["P1039"],"id":"Q1339$a89859aa-4010-4d06-a3ac-aa7966be0cbe","rank":"normal"}
//var getQualifierData22 = function(bindings, bindings2, set, qvalueAtomMap, rule) {
//	var qualifiers = {};
//	var qualifier = set[0];
//
//	var attr = qualifier.attribute.type=="variable" ? bindings[qualifier.attribute.value] : qualifier.attribute.value;
//var stmtIndex = qvalueAtomMap[qualifier.qvalue.value];
//				
//				var atom = rule.body.atoms[stmtIndex];
//				var entityId = atom.entity.type == "variable" ? bindings[atom.entity.value] : atom.entity.value;
//			return entityId ;
//			var snak = bindings2[entityId].claims[atom.property][0].qualifiers[attr][0] ;//fix the [0]
//			
//			
//			
////		
////		return set[0].attribute.type=="variable" ? bindings[set[0].attribute.value] : set[0].attribute.value;
//	angular.forEach(set, function(qualifier) {
//		
//		
//		
//		var x = set[0].attribute.type=="variable" ? bindings[set[0].attribute.value] : set[0].attribute.value;
//		return bindings;
//		var stmtIndex = headqualifiers[x];
//		
//		var atom = rule.body.atoms[stmtIndex];//also head!
//		
////			var entity = bindings[atom.entity.value];
//		
////			var snak = bindings2.
////			
//		var pqsnak = {
//				snaktype: "value",
//				property: qualifier.attribute.value,//bindings[qualifier.attribute].value,// might be no var
//				datatype: "string",//x.type,//or type?
//				datavalue: atom//{//value: bindings[qualifier.value].value, type: template.type}
//			}; 
//
//		if (! (qualifier.attribute.value in qualifiers) ) {
//			qualifiers[qualifier.attribute.value] = [];
//		}
//			qualifiers[qualifier.attribute.value].push(pqsnak);
//	
//});
//
//		
//		return qualifiers;
//	}
			


	
var getTest = function(id) {
	
	var language = i18n.getLanguage();
	
	var rules = getRules(id, language);
	var requests = [];
	
	angular.forEach(rules, function (rule) {
		requests.push(sparql.getQueryRequest(rule.sparql));
	});
	
	var statements = {};
	var propertyIds = {};
	var itemIds = {};
	
	return $q.all(requests).then( function(responses) {
			
//			collect the ids needed to request the qualifiers
//			var resultEntities = [];
			var stmtIds = [];//new Object();
			var atomsToStmts = [];
			
			angular.forEach(responses, function (response, i) {
				var atomsToStmts1 = [];

//				index of atom in rule 
				var index = 0;			
//				index of rel atom in rule 
//				var stmtIndex = 0;
				angular.forEach(rules[i].rule.body.atoms, function (atom) {
					
					if(atom.type == "relational-atom") {
						var sv = getStatementVariable(atom, index, rules[i].rule.head.atom.entity.value, id).substring(1);
//						 return sv;
						angular.forEach(response.results.bindings, function (result) {
							var stmtId = result[sv].value
							.substring("http://www.wikidata.org/entity/statement/".length).replace('-','$');
							var j = stmtIds.indexOf(stmtId);
							if(j == -1) {
								stmtIds.push(stmtId);	
								atomsToStmts1[index] = stmtIds.length-1;
							} else {
								atomsToStmts1[index] = j;
							}
						});
						
//						stmtIndex++;
					}
					index++;
				});	
						
				if(rules[i].rule.head.atom.set.type == "function-term") {
					angular.forEach(rules[i].rule.head.atom.set.value, function (f) {
						angular.forEach(f.conditions, function (atom) {
							if(atom.type == "relational-atom") { 
								
								var sv = getStatementVariable(atom, index, rules[i].rule.head.atom.entity.value, id).substring(1);
								
								angular.forEach(response.results.bindings, function (result) {
									var stmtId = result[sv].value
									.substring("http://www.wikidata.org/entity/statement/".length).replace('-','$');
									var j = stmtIds.indexOf(stmtId);
									if(j == -1) {
										stmtIds.push(stmtId);	
										atomsToStmts1[index] = stmtIds.length-1;
									} else {
										atomsToStmts1[index] = j;
									}
								});
								
//								stmtIndex++;
							}
							index++;
						});

					});	
				}
				
				
				atomsToStmts.push(atomsToStmts1);

			});
//			return rules[0];
			return responses;//rules[0];//return atomsToStmts;
			return	wikidataapi.getClaims(stmtIds).then(function(apiBindings){
				return apiBindings;
				for (var i = 0; i < rules.length; i ++) {
					addInferredFromQuery(id, rules[i], responses[i].results.bindings, 
							apiBindings, atomsToStmts[i],
							statements, propertyIds, itemIds );
				}

				
				return { statements:statements, propertyids: propertyIds,itemids:itemIds};
			
		});		
	});
};



return {
		getStatementsInferred: getStatementsInferred,
		getTest:getTest
	};
}]);

return {}; }); // module definition end