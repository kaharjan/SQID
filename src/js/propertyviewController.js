classBrowser.factory('PropertyView', function($route, wikidataapi){
	var RELATED_PROPERTIES_THRESHOLD = 5;
	
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
		},
		
		getPropertyData: function() {
			return wikidataapi.fetchEntityData(pid);
		}
	};
})
.controller('PropertyViewController', function($scope, Properties, PropertyView, wikidataapi){
	PropertyView.updatePid();
	$scope.pid = PropertyView.getPid();
	var numId = $scope.pid.substring(1);
  $scope.url = "https://www.wikidata.org/wiki/Property:" + $scope.pid;	
	
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
	});
});
