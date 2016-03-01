classBrowser.factory('PropertyView', function($route, wikidataapi, sparql){
	var MAX_EXAMPLE_ITEMS = 10;
	var RELATED_PROPERTIES_THRESHOLD = 5;
	
	var pid;
	return {
		RELATED_PROPERTIES_THRESHOLD: RELATED_PROPERTIES_THRESHOLD,
		MAX_EXAMPLE_ITEMS: MAX_EXAMPLE_ITEMS,
		
		getPropertyData: function() {
			var url = buildUrlForApiRequest(pid);
			return httpRequest($http, $q, url);
		},
		
		updatePid: function(){
			pid = ($route.current.params.id) ? ($route.current.params.id) : "P31";
		},
		
		getItems: function() {
			return sparql.getPropertySubjects(pid, "$obj", MAX_EXAMPLE_ITEMS + 1);
		},
		
		getPid: function(){
			return pid;
		},
		
		getPropertyData: function() {
			return wikidataapi.fetchEntityData(pid);
		}
	};
})
.controller('PropertyViewController', function($scope, Properties, PropertyView, wikidataapi, sparql){
	PropertyView.updatePid();
	$scope.pid = PropertyView.getPid();
	var numId = $scope.pid.substring(1);
  $scope.url = "https://www.wikidata.org/wiki/Property:" + $scope.pid;
	$scope.exampleItems = null;
	
	PropertyView.getPropertyData().then(function(data){
		console.log(data);
		$scope.propertyData = wikidataapi.extractEntityData(data, $scope.pid);
	});
	
	Properties.then(function(properties){
		$scope.datatype = properties.getDatatype(numId);
		$scope.itemCount = properties.getItemCount(numId);
		$scope.statementCount = properties.getStatementCount(numId);
		$scope.qualifierCount = properties.getQualifierCount(numId);
		$scope.referenceCount = properties.getReferenceCount(numId);
		$scope.totalCount = $scope.statementCount + $scope.referenceCount + $scope.qualifierCount;
		$scope.relatedProperties = properties.formatRelatedProperties(properties.getRelatedProperties(numId), PropertyView.RELATED_PROPERTIES_THRESHOLD);
		console.log("fetched Property");
		if ($scope.itemCount > 0) {
			PropertyView.getItems().then(function(data) {
				$scope.exampleItems = sparql.prepareInstanceQueryResult(data, PropertyView.getPid(), "$obj", PropertyView.MAX_EXAMPLE_ITEMS + 1, null);
			});
		}
	});
});
