classBrowser.factory('PropertyView', function($http, $route, $q){
	var pid;
	return {
		getPropertyData: function() {	
		  var url = buildUrlForApiRequest(pid);
		  return httpRequest($http, $q, url);
        },
		updatePid: function(){
			pid = ($route.current.params.id) ? ($route.current.params.id) : "P31";
		},
		getPid: function(){
		  return pid;
		}
	};
})
  .controller('PropertyViewController', function($scope, Properties, PropertyView){
	PropertyView.updatePid();
	$scope.pid = PropertyView.getPid();
  	$scope.url = "https://www.wikidata.org/wiki/Property:" + $scope.pid;
	
	PropertyView.getPropertyData().then(function(data) {
		$scope.propertyData = parsePropertyData(data, $scope.pid);
	  });
	
	
	Properties.then(function(data){
  	  $scope.relatedProperties = util.parseRelatedProperties($scope.pid, data.getProperties());
  	  $scope.propertyNumbers = parsePropertyNumbers(data.getProperties(), $scope.pid);
	  $scope.datatype = parseDataType(data.getProperties(), $scope.pid);
  	  console.log("fetched Property");
  	});
	
});

function parseDataType(data, pid){
	return data[pid][util.JSON_DATATYPE];
}

function parsePropertyNumbers(data, pid){
	var propertyNumbers = {
		statements: data[pid][util.JSON_USES_IN_STATEMENTS],
		items: data[pid][util.JSON_ITEMS_WITH_SUCH_STATEMENTS],
		statements_qualifiers: data[pid][util.JSON_USES_IN_STATEMENTS_WITH_QUALIFIERS],
		qualifiers: data[pid][util.JSON_USES_IN_QUALIFIERS],
		references: data[pid][util.JSON_USES_IN_REFERENCES],
		properties: data[pid][util.JSON_USES_IN_PROPERTIES],
		total: 0
	};
	propertyNumbers.total = propertyNumbers.statements + propertyNumbers.qualifiers + propertyNumbers.references + propertyNumbers.properties;
	return propertyNumbers;
}

function parsePropertyData(data, pid) {
	var propertyData = {
		label: "",
		aliases: "",
		description: ""
	}
	try {
		propertyData.label = parseLabel(data,pid);
		propertyData.description = parseDescription(data, pid);
		propertyData.aliases = parseAliases(data,pid);
	}
	catch (e) {}
	return propertyData;
}