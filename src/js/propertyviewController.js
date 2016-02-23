classBrowser.factory('PropertyView', function($http, $route, $q){
	var pid;
	return {
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
	
	Properties.then(function(data){
  	  $scope.relatedProperties = util.parseRelatedProperties($scope.pid, data.getProperties());
  	  //$scope.classNumbers = util.parseClassNumbers($scope.qid, data.getProperties());
  	  //$scope.classNumbers = getNumberForClass($scope.qid);
  	  console.log("fetched Property");
  	});
	
});