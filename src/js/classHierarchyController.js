function getSuperclassesTree(data, ids, count){
	var ret = "";
	if (count > 500){return;}
	for (var i = 0; i < ids.length; i++){
		var item = ids[i];
		ret = ret + "{\"key\": \"" + data.getLabel(item) + "\", \"instances\": " + (data.getAllInstanceCount(item) + 1); 
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

classBrowser.controller('ClassHierarchyController', function($scope, Classes) {
	Classes.then(function(classData){
		var qid = "5";
		var label = classData.getLabel("5");
		var icount = classData.getAllInstanceCount("5");
		var data = getSubclassesTree(classData, [{id:qid, label: label, icount: icount}], 0);
		//var data = getSuperclassesTree(data, ["5"], 0);
		
		var margin = {top: 24, right: 0, bottom: 0, left: 0},
			theight = 36 + 16;
			width = 960 - margin.left - margin.right,
			height = 500 - margin.top - margin.bottom - theight;

		var transitioning;

		var attribute = "instances";

		var color = d3.scale.category20c();

		var x = d3.scale.linear()
			.domain([0, width])
			.range([0, width]);

		var y = d3.scale.linear()
			.domain([0, height])
			.range([0, height]);

		var treemap = d3.layout.treemap()
			.children(function(d, depth) { return depth ? null : d._children; })
			.sort(function(a, b) { return a.value - b.value; })
			.ratio(height / width * 0.5 * (1 + Math.sqrt(5)))
			.round(false)
			.value(function(d){return d[attribute]});

		var svg = d3.select("#chart").append("svg")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.bottom + margin.top)
			.style("margin-left", -margin.left + "px")
			.style("margin.right", -margin.right + "px")
			.append("g")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
			.style("shape-rendering", "crispEdges");

		var grandparent = svg.append("g")
			.attr("class", "grandparent");

		grandparent.append("rect")
			.attr("y", -margin.top)
			.attr("width", width)
			.attr("height", margin.top);

		grandparent.append("text")
			.attr("x", 6)
			.attr("y", 6 - margin.top)
			.attr("dy", ".75em");

		function formatValue(value){
			return value - 1;
		}
	
		var root = JSON.parse(data);
			initialize(root);
			layout(root);
			display(root);

		console.log(root);
		
		function initialize(root) {
			root.x = root.y = 0;
			root.dx = width;
			root.dy = height;
			root.depth = 0;
		}


		function layout(d) {
			if (d._children) {
				treemap.nodes({_children: d._children});
				d._children.forEach(function(c) {
					c.x = d.x + c.x * d.dx;
					c.y = d.y + c.y * d.dy;
					c.dx *= d.dx;
					c.dy *= d.dy;
					c.parent = d;
					layout(c);
				});
			}
		}
	
		function display(d) {
			grandparent
				.datum(d.parent)
				.on("click", transition)
				.select("text")
				.text(name(d));

			var g1 = svg.insert("g", ".grandparent")
				.datum(d)
				.attr("class", "depth");
		
			var g = g1.selectAll("g")
				.data(d._children)
				.enter().append("g");
	
			g.filter(function(d) { return d._children; })
				.classed("children", true)
				.on("click", transition);
		
			var children = g.selectAll(".child")
				.data(function(d) { return d._children || [d]; })
				.enter().append("g");
	
			children.append("rect")
				.attr("class", "child")
				.call(rect)
				.append("title")
				.text(function(d) { return d.key + " (" + formatValue(d.value) + ")"; });
		
			children.append("text")
				.attr("class", "ctext")
				.text(function(d) { return d.key; })
				.call(text2);

			g.append("rect")
				.attr("class", "parent")
				.call(rect);
	
			var t = g.append("text")
				.attr("class", "ptext")
				.attr("dy", ".75em")

			t.append("tspan")
				.text(function(d) { return d.key; });
	
			t.append("tspan")
				.attr("dy", "1.0em")
				.text(function(d) { return formatValue(d.value); });
	
			t.call(text);
	
			g.selectAll("rect")
				.style("fill", function(d) { return color(d.key); });
		
			function transition(d) {
				if (transitioning || !d) return;
				transitioning = true;
		
				var g2 = display(d),
					t1 = g1.transition().duration(750),
					t2 = g2.transition().duration(750);
		
				// Update the domain only after entering new elements.
				x.domain([d.x, d.x + d.dx]);
				y.domain([d.y, d.y + d.dy]);
		
				// Enable anti-aliasing during the transition.
				svg.style("shape-rendering", null);

				// Draw child nodes on top of parent nodes.
				svg.selectAll(".depth").sort(function(a, b) { return a.depth - b.depth; });
		
				// Fade-in entering text.
				g2.selectAll("text").style("fill-opacity", 0);
		
				// Transition to the new view.
				t1.selectAll(".ptext").call(text).style("fill-opacity", 0);
				t1.selectAll(".ctext").call(text2).style("fill-opacity", 0);
				t2.selectAll(".ptext").call(text).style("fill-opacity", 1);
				t2.selectAll(".ctext").call(text2).style("fill-opacity", 1);
				t1.selectAll("rect").call(rect);
				t2.selectAll("rect").call(rect);
		
				// Remove the old node when the transition is finished.
				t1.remove().each("end", function() {
					svg.style("shape-rendering", "crispEdges");
					transitioning = false;
				});
			}
			return g;
		}

		function text(text) {
			text.selectAll("tspan")
				.attr("x", function(d) { return x(d.x) + 6; })
	
			text.attr("x", function(d) { return x(d.x) + 6; })
				.attr("y", function(d) { return y(d.y) + 6; })
				.style("opacity", function(d) { return this.getComputedTextLength() < x(d.x + d.dx) - x(d.x) ? 1 : 0; });
		}

		function text2(text) {
			text.attr("x", function(d) { return x(d.x + d.dx) - this.getComputedTextLength() - 6; })
				.attr("y", function(d) { return y(d.y + d.dy) - 6; })
				.style("opacity", function(d) { return this.getComputedTextLength() < x(d.x + d.dx) - x(d.x) ? 1 : 0; });
		}

		function rect(rect) {
			rect.attr("x", function(d) { return x(d.x); })
				.attr("y", function(d) { return y(d.y); })
				.attr("width", function(d) { return x(d.x + d.dx) - x(d.x); })
				.attr("height", function(d) { return y(d.y + d.dy) - y(d.y); });
		}

		function name(d) {
			return d.parent
				? name(d.parent) + " . " + d.key + "(" + formatValue(d.value) + ")"
				: d.key + " (" + d[attribute] + ")";
		}

		d3.selectAll("input").on("change", function change() {
			var value = this.value === "items"
				? function(d) { return d.value; }
				: function(d) { return 1; };
		});
	});
});
