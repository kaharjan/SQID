var width = 1000,
	height = 500;

var color = d3.scale.category20c();

var data = '{ "name": "ParentClass", "children": [{"name":"Class 1", "instances": 5, "subclasses": 10}, {"name": "Class 2", "instances": 3, "subclasses": 10}, {"name": "Class 3", "instances": 72,"subclasses": 13}]}';


var treemap = d3.layout.treemap()
	.size([width, height])
	.sticky(true)
	.value(function(d) { return d.instances; });

var div = d3.select("body").append("div")
	.style("position", "relative")
	.attr("width", width)
	.attr("height", height);

var node = div.datum(JSON.parse(data)).selectAll(".subclass")
	.data(treemap.nodes)
	.enter()
	.append("div")
	.attr("class", "subclass")
	.call(position)
	.style("background", function(d) { return color(d.name)})
	.text(function(d) { return d.children ? null : d.name; });

d3.selectAll("input").on("change", function change() {
	var value = this.value === "items"
		? function(d) { return d.instances; }
		: function(d) { return d.subclasses; };
	
	node
		.data(treemap.value(value).nodes)
		.transition()
		.duration(2000)
		.call(position);
	});

function position() {
	this.style("left", function(d) { return d.x + "px"; })
		.style("top", function(d) { return d.y + "px"; })
		.style("width", function(d) { return Math.max(0, d.dx - 1) + "px"; })
		.style("height", function(d) { return Math.max(0, d.dy - 1) + "px"; });
}