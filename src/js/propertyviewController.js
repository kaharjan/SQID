classBrowser.factory('PropertyView', function($route, wikidataapi, sparql){
	var MAX_EXAMPLE_ITEMS = 10;
	var MAX_EXAMPLE_QUALIFIERS = 10;
	var MAX_EXAMPLE_REFERENCES = 10;
	var RELATED_PROPERTIES_THRESHOLD = 15;
	
	var pid;
	return {
		RELATED_PROPERTIES_THRESHOLD: RELATED_PROPERTIES_THRESHOLD,
		MAX_EXAMPLE_ITEMS: MAX_EXAMPLE_ITEMS,
		MAX_EXAMPLE_QUALIFIERS: MAX_EXAMPLE_QUALIFIERS,
		MAX_EXAMPLE_REFERENCES: MAX_EXAMPLE_REFERENCES,
		
		getPropertyData: function() {
			var url = buildUrlForApiRequest(pid);
			return httpRequest($http, $q, url);
		},
		
		updatePid: function(){
			pid = ($route.current.params.id) ? ($route.current.params.id) : "P31";
		},
		
		getQualifiers: function() {
			return sparql.getQualifierSubjects(pid, MAX_EXAMPLE_QUALIFIERS + 1);
		},
		
		getReferences: function() {
			return sparql.getReferenceSubjects(pid, MAX_EXAMPLE_REFERENCES + 1);
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
	$scope.exampleQualifiers = null;
	$scope.exampleReferences = null;
	
	PropertyView.getPropertyData().then(function(data){
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
		if ($scope.referenceCount > 0) {
			PropertyView.getReferences().then(function(data) {
				$scope.exampleReferences = sparql.prepareReferenceQueryResult(data, PropertyView.getPid(), PropertyView.MAX_EXAMPLE_REFERENCES + 1);
			});
		}
		if ($scope.qualifierCount > 0) {
			PropertyView.getQualifiers().then(function(data){
				$scope.exampleQualifiers = sparql.prepareQualifierQueryResult(data, PropertyView.getPid(), PropertyView.MAX_EXAMPLE_QUALIFIERS + 1);
			});
		}
	});
});
