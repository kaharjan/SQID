function getSuperclassesTree(data, ids, count){
	var ret = "";
	if (count > 500){return;}
	for (var i = 0; i < ids.length; i++){
		var item = ids[i];
		ret = ret + "{\"key\": \"" + data.getLabel(item) + "\", \"instances\": " + (data.getDirectInstanceCount(item) + 1); 
		var values = data.getSuperClasses(item);
		if (values.length > 0) {
			ret = ret + ", \"_children\": [" + getSuperclassesTree(data,values, count++) + "]";
		}
		ret = ret + "}";
		if (i < ids.length - 1) {
			ret = ret + ", ";
		}
	}
	return ret;
}


function getSubclassesTree(data, ids, count){
	var ret = "";
	if (count > 500){return;}
	for (var i in ids){
		var item = ids[i];
		ret = ret + "{\"key\": \"" + item.label + "\", \"instances\": " + (item.icount + 1); 
		var values = data.getNonemptySubclasses(item.id);
		if (values.length > 0) {
			ret = ret + ", \"_children\": [" + getSubclassesTree(data,values, count++) + "]";
		}
		ret = ret + "}";
		if (i < ids.length - 1) {
			ret = ret + ", ";
		}
	}
	return ret;
}

//var data = '{"key": "entities", "subclasses": 4, "values": [{"key": "class1", "subclasses": 5, "values": [{"key": "class1-1", "subclasses":19, "values":[{"key": "class1-1-1", "subclasses":13}]}, {"key": "class1-2", "subclasses":15}, {"key": "class1-3", "subclasses":5}]}, {"key": "class2", "subclasses": 13, "values":[{"key": "class2-1", "subclasses":26}, {"key": "class2-2", "subclasses":31}]}] }';

classBrowser.controller('ClassHierarchyController', function($scope, Classes) {
	Classes.then(function(classData){
		var qid = "6999";
		var label = classData.getLabel(qid);
		var icount = classData.getAllInstanceCount(qid);
		var data = getSubclassesTree(classData, [{id:qid, label: label, icount: icount}], 0);
		console.log(data);
		//var data = getSuperclassesTree(data, ["5"], 0);
		
		//var margin = {top: 24, right: 0, bottom: 0, left: 0},
		var width = 960,
			height = 700,
			radius = (Math.min(width, height) / 2) - 10;

		var transitioning;

		var attribute = "instances";

		var color = d3.scale.category20c();

		var x = d3.scale.linear()
			.range([0, 2*Math.PI]);

		var y = d3.scale.sqrt()
			.range([0, radius]);
		
		var partition = d3.layout.partition()
			.children(function(d){ return d._children; })
			.value(function(d){return d.instances;});
		
		var arc = d3.svg.arc()
			.startAngle(function(d){ return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
			.endAngle(function(d){ return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))) })
			.innerRadius(function(d){ return Math.max(0, y(d.y)) })
			.outerRadius(function(d){ return Math.max(0, y(d.y + d.dy)) })
		
		var svg = d3.select("#chart").append("svg")
			.attr("width", width)
			.attr("height", height)
			.append("g")
			.attr("transform", "translate(" + width/2 + "," + height/2 + ")")
			.style("fill-opacity", 0.5);
		
	
		var root = JSON.parse(data);
		console.log(root);
		svg.selectAll("path")
			.data(partition.nodes(root))
			.enter()
				.append("path")
				.attr("d", arc)
				.style("fill", function(d) { return color((d.children ? d : d.parent).key); })
				.on("click", click)
				.text("blub13")
			.append("title")
				.text(function(d){return name(d)});
		svg.selectAll("path").append("text")
				.attr("x", 50)
				.attr("y", 100)
				.text(function(d) {return name(d)});
		
		function click(d) {
			if(transitioning){
				console.log(transitioning);
				return;
			}
			transitioning = true;
			svg.transition()
				.duration(1000)
				.tween("scale", function(){
					var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
						yd = d3.interpolate(y.domain(), [d.y, 1]),
						yr = d3.interpolate(y.range(), [d.y ? 20 : 0, radius]);
					return function(t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); };
				})
				.selectAll("path")
					.attrTween("d", function(d) { return function(){ return arc(d); }; });
			transitioning = false;
		}
		
		function name(d) {
			return d.key + " (" + d.value + ")";
		}
	});
});
