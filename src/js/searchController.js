classBrowser.controller('SearchController', function($scope, Classes, Properties){
	$scope.results = [];
	Classes.then(function(classes){
		$scope.results = classes.getAllClassesWithLabels();
		Properties.then(function(properties){
			$scope.results = $scope.results.concat(properties.getAllPropertiesWithLabels());
		});
	});
	//$scope.results = [{id: "Q5", label: "human"}, {id: "Q4", label: "death"}];
	$scope.quantity = 5;
});
