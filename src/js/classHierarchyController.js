function getSuperclassesTree(data, ids, count){
	var ret = "";
	if (count > 500){return;}
	for (var i = 0; i < ids.length; i++){
		var item = ids[i];
		ret = ret + "{\"key\": \"" + data.getLabel(item) + "\", \"instances\": " + (data.getDirectInstanceCount(item) + 1); 
		var values = data.getSuperClasses(item);
		if (values.length > 0) {
			ret = ret + ", \"children\": [" + getSuperclassesTree(data,values, count++) + "]";
		}
		ret = ret + "}";
		if (i < ids.length - 1) {
			ret = ret + ", ";
		}
	}
	return ret;
}


function getSubclassesTree(data, ids, count, visited){
	var ret = "";
	if (count > 500){return;}
	for (var i in ids){
		var item = ids[i];
		ret = ret + "{\"key\": \"" + item.label + "\", \"instances\": " + (item.icount + 1) + ",\"subclasses\": " + (item.scount + 1);
		if ($.inArray(item.id, visited) < 0){
			var values = data.getNonemptySubclasses(item.id);
			if (values.length > 0) {
				visited.push(item.id);
				ret = ret + ", \"children\": [" + getSubclassesTree(data, values, count++, visited) + "]";
				visited.pop(item.id);
			}
		}
		ret = ret + "}";
		if (i < ids.length - 1) {
			ret = ret + ", ";
		}
	}
	return ret;
}

function annotateJsonWithValues( root, instValue, instNormalizer, subValue, subNormalizer ) {
	root.inst = (root.instances/instNormalizer) * instValue;
	//console.log(root.inst + " - " + root.key);
	root.subcl = (root.subclasses/subNormalizer) * subValue;
	var sumInstances = 0;
	var sumSubclasses = 0;
	var size = -1;
	if (root.children != undefined) {
		var size = root.children.length;
	}
	for (var i = 0; i < size; i++) {
		sumInstances = sumInstances + root.children[i].instances;
		sumSubclasses = sumSubclasses + root.children[i].subclasses;
	}
	for (var i = 0; i < size; i++) {
		annotateJsonWithValues( root.children[i], root.inst, sumInstances, root.subcl, sumSubclasses);
	}
	return root;
}


classBrowser.controller('ClassHierarchyController', function($scope, Classes, $route) {
	Classes.then(function(classData){
		var qid = ($route.current.params.id) ? parseInt(($route.current.params.id)) : "6999"
		var label = classData.getLabel(qid);
		var icount = classData.getAllInstanceCount(qid);
		var scount = classData.getAllSubclassCount(qid);
		var data = JSON.parse(getSubclassesTree(classData, [{id:qid, label: label, icount: icount, scount: scount}], 0, []));
		var root = annotateJsonWithValues(data, data.instances, data.instances, data.subclasses, data.subclasses);
		console.log(root);
		//var data = getSuperclassesTree(data, ["5"], 0);
		
		//var margin = {top: 24, right: 0, bottom: 0, left: 0},
		var width = 960,
			height = 700,
			radius = (Math.min(width, height) / 2) - 10;

		var attribute = "instances";
		
		
		var color = d3.scale.category20c();

		var x = d3.scale.linear()
			.range([0, 2*Math.PI]);

		var y = d3.scale.sqrt()
			.range([0, radius]);
		
		var partition = d3.layout.partition()
			.value(function(d){ return d.inst; });
		
		var arc = d3.svg.arc()
			.startAngle(function(d){ return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
			.endAngle(function(d){ return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))) })
			.innerRadius(function(d){ return Math.max(0, y(d.y)) })
			.outerRadius(function(d){ return Math.max(0, y(d.y + d.dy)) })
		
		var svg = d3.select("#chart").append("svg")
			.attr("width", width)
			.attr("height", height)
			.append("g")
			.attr("transform", "translate(" + width/2 + "," + height/2 + ")");
		
		var legend = d3.select("#legend")
			.append("p")
			.text(" ")
			.style("visibility", "hidden");
		
		var node = root;
		var path = svg.data([node])
			.selectAll("path")
			.data(partition.nodes)
			.enter()
				.append("path")
				.attr("d", arc)
				.style("fill", function(d) { return color(d.key); })
				.on("click", click)
				.on("mouseleave", mouseleave)
				.on("mouseover", mouseover)
				.each(stash);
		svg.selectAll("path").append("title")
				.text(function(d){return name(d)});
		
		d3.selectAll("input").on("change", function change() {
			var value = this.value === "items"
				? function(d) { attribute = "instances"; return d.inst; }
				: function(d) { attribute = "subclasses"; return d.subcl; }
			path.data(partition.value(value).nodes)
				.transition()
				.duration(1000)
				.attrTween("d", arcTweenData);
			svg.selectAll("path").select("title")
				.text(function(d){return name(d);})
		})
		
		function stash(d){
			d.x0 = d.x;
			d.dx0 = d.dx;
		}
		
		function mouseleave(d) {
			d3.selectAll("path").style("opacity", 1);
			
			legend.style("visibility", "hidden");
		}
		
		function mouseover(d) {
			d3.selectAll("path").style("opacity", .3);
			svg.selectAll("path").filter(function(node) {return node.key == d.key;})
				.style("opacity", 1);
			legend.style("visibility", "")
				.text(buildParentsString(d));
		}
		
		function click(d) {
			node = d;
			path.transition()
				.duration(1000)
				.attrTween("d", arcTweenZoom(d));
		}
		
		function arcTweenData(a, i){
			var oi = d3.interpolate({x: a.x0, dx: a.dx0}, a);
			function tween(t) {
				var b = oi(t);
				a.x0 = b.x;
				a.dx0 = b.dx;
				return arc(b);
			}
			if (i == 0) {
				var xd = d3.interpolate(x.domain(), [node.x, node.x + node.dx]);
				return function(t) {
					x.domain(xd(t));
					return tween(t);
				}
			} else {
				return tween;
			}
		}
		
		function arcTweenZoom(d) {
			var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
			yd = d3.interpolate(y.domain(), [d.y, 1]),
			yr = d3.interpolate(y.range(), [d.y ? 20 : 0, radius]);
			return function(d, i) {
				return i
					? function(t) { return arc(d); }
					: function(t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); return arc(d); }
			}
		}
		
		function buildParentsString(d) {
			return d.parent
				? buildParentsString(d.parent) + " -> " + d.key
				: d.key;
		}
		
		function name(d) {
			return d.key + " (" + (d[attribute] - 1) + ")";
		}
	});
});
