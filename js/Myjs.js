//Init Map
//*******************************************************************************************************************************************************
var lat = 41.141376;
var lng = -8.613999;
var zoom = 14;

// add an OpenStreetMap tile layer
var mbAttr = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="http://mapbox.com">Mapbox</a>',
    mbUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiemdYSVVLRSJ9.g3lbg_eN0kztmsfIPxa9MQ';


var grayscale = L.tileLayer(mbUrl, {
        id: 'mapbox.light',
        attribution: mbAttr
    }),
    streets = L.tileLayer(mbUrl, {
        id: 'mapbox.streets',
        attribution: mbAttr
    });
var map = L.map('map', {
    center: [lat, lng], // Porto
    zoom: zoom,
    layers: [streets],
    zoomControl: true,
    fullscreenControl: true,
    fullscreenControlOptions: { // optional
        title: "Show me the fullscreen !",
        titleCancel: "Exit fullscreen mode",
        position: 'bottomright'
    }
});

var baseLayers = {
    "Grayscale": grayscale, // Grayscale tile layer
    "Streets": streets, // Streets tile layer
};

layerControl = L.control.layers(baseLayers, null, {
    position: 'bottomleft'
}).addTo(map);

// Initialise the FeatureGroup to store editable layers
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var featureGroup = L.featureGroup();

var drawControl = new L.Control.Draw({
    position: 'bottomright',
	collapsed: false,
    draw: {
        // Available Shapes in Draw box. To disable anyone of them just convert true to false
        polyline: false,
        polygon: false,
        circle: false,
        rectangle: true,
        marker: false,
    }

});
map.addControl(drawControl); // To add anything to map, add it to "drawControl"
//*******************************************************************************************************************************************************
//*****************************************************************************************************************************************
// Index Road Network by Using R-Tree
//*****************************************************************************************************************************************
var rt = cw(function(data,cb){
	var self = this;
	var request,_resp;
	importScripts("js/rtree.js");
	if(!self.rt){
		self.rt=RTree();
		request = new XMLHttpRequest();
		request.open("GET", data);
		request.onreadystatechange = function() {
			if (request.readyState === 4 && request.status === 200) {
				_resp=JSON.parse(request.responseText);
				self.rt.geoJSON(_resp);
				cb(true);
			}
		};
		request.send();
	}else{
		return self.rt.bbox(data);
	}
});

rt.data(cw.makeUrl("js/trips.json"));
//*****************************************************************************************************************************************	
//*****************************************************************************************************************************************
// Drawing Shapes (polyline, polygon, circle, rectangle, marker) Event:
// Select from draw box and start drawing on map.
//*****************************************************************************************************************************************	

map.on('draw:created', function (e) {
	
	var type = e.layerType,
		layer = e.layer;
	
	if (type === 'rectangle') {
		//console.log(layer.getLatLngs()); //Rectangle Corners points
		var bounds=layer.getBounds();
		rt.data([[bounds.getSouthWest().lng,bounds.getSouthWest().lat],[bounds.getNorthEast().lng,bounds.getNorthEast().lat]]).
		then(function(d){var result = d.map(function(a) {return a.properties;});
		//console.log(result);		// Trip Info: avspeed, distance, duration, endtime, maxspeed, minspeed, starttime, streetnames, taxiid, tripid
		DrawRS(result);
		WordCloudResultDisplay(result);
		DeriveCordFromMap(result);
		ScatterPlotDisplay(result);
		});
	}
	
	drawnItems.addLayer(layer);			//Add your Selection to Map  
});
//*****************************************************************************************************************************************
// DrawRS Function:
// Input is a list of road segments ID and their color. Then the visualization can show the corresponding road segments with the color
// Test:      var input_data = [{road:53, color:"#f00"}, {road:248, color:"#0f0"}, {road:1281, color:"#00f"}];
//            DrawRS(input_data);
//*****************************************************************************************************************************************
function DrawRS(trips) {
	for (var j=0; j<trips.length; j++) {  // Check Number of Segments and go through all segments
		var TPT = new Array();			  
		TPT = TArr[trips[j].tripid].split(',');  		 // Find each segment in TArr Dictionary. 
		var polyline = new L.Polyline([]).addTo(drawnItems);
        polyline.setStyle({
            color: 'red',                      // polyline color
			weight: 1,                         // polyline weight
			opacity: 0.5,                      // polyline opacity
			smoothFactor: 1.0  
        });
		for(var y = 0; y < TPT.length-1; y=y+2){    // Parse latlng for each segment
			polyline.addLatLng([parseFloat(TPT[y+1]), parseFloat(TPT[y])]);
		}
	}		
}

function WordCloudResultDisplay(streetNames){
	var WordsInWordCloud = {};
	streetNames.forEach(element => {
		element['streetnames'].forEach(street => {
				if (WordsInWordCloud.hasOwnProperty(street)) {
				WordsInWordCloud[street]++;
				} else {
				WordsInWordCloud[street] = 1;}
		});
	});
	generateNodeData(WordsInWordCloud);
	
}

function generateNodeData(occrances) {
	var occr_Array = [];
	Object.keys(occrances).forEach(function(key) { occr_Array.push({ text: key, size: occrances[key]});
	});

	occr_Array.sort(function(a, b){
		return b.size - a.size;
	});
	
	DisplayCloudData(occr_Array);
	
}

function DisplayCloudData(words){
	d3.wordcloud()
					.size([430, 600])
					.fill(d3.scale.ordinal().range(["#BE2625","#FFCC11","#98B82A","#2385E6","#9932CD"]))
					.words(words)
					.onwordclick(function(d, i) {   if (d.href) { window.location = d.href; }	})
					.start();
}
var trips = [];
function DeriveCordFromMap(result){
	let eachValue = new Set();
	result.forEach(st => {
		let from = st['streetnames'][0];
		let to = st['streetnames'][st['streetnames'].length - 1];
		let distance = st['distance'];
		eachValue.add(from);
		if(!eachValue.has(to)){
			trips.push([from,to,distance]);
		}
	});
	google.charts.load('current', {'packages':['sankey']});
    google.charts.setOnLoadCallback(drawChart);
}

function drawChart(){
	var data = new google.visualization.DataTable();
	data.addColumn('string', 'From');
	data.addColumn('string', 'To');
	data.addColumn('number', 'Distance');
	data.addRows(trips);
	var colors = ['#CD3333', '#F7EA2B', '#7B7922', '#668014','#00FFFF', '#40664D', '#006B54', '#008B8B'];
				  
    var options = {
	  width:430,
      height: 700,
      sankey: {
        node: {
		  colors: colors, 
		  nodePadding: 30        
        },
        link: {
          colorMode: 'gradient',
          colors: colors
        }
      }
    };
	var chart = new google.visualization.Sankey(document.getElementById('sankey'));
	chart.draw(data, options);
	trips = []; 
}


function ScatterPlotDisplay(trips){

    var size = 145,
        padding = 10;
    
    var color = d3.scale.ordinal().range([
        "rgb(90%, 20%, 10%)",
        "rgb(20%, 90%, 10%)",
        "rgb(20%, 10%, 90%)"
    ]);
    
    var eachTripsforScatter = [];
   trips.forEach(st => {
		let avgspeed = st['avspeed'];
		let distanc = st['distance'];
		let durat = st['duration'];
		eachTripsforScatter.push({avspeed:avgspeed,distance:distanc,duration:durat});
	});
	
	var position = {};
	   	Object.keys(eachTripsforScatter[0]).forEach(function(eachTrip) {
	     function value(p) { return p[eachTrip]; }
	     position[eachTrip] = d3.scale.linear()
	         .domain([d3.min(eachTripsforScatter, value), d3.max(eachTripsforScatter, value)])
			 .range([padding / 2, size - padding / 2]);
	   });

	console.log(Object.keys(eachTripsforScatter[0])); 


	var svg = d3.select("#scatter-plot")
	     .append("svg:svg")
	       .attr("width", size * Object.keys(eachTripsforScatter[0]).length)
		   .attr("height", size * Object.keys(eachTripsforScatter[0]).length);
		
	
	
	var column = svg.selectAll("g")
      .data(Object.keys(eachTripsforScatter[0]))
      .enter().append("svg:g")
      .attr("transform", function(d, i) { return "translate(" + i * size + ",0)"; })


   var row = column.selectAll("g")
       	.data(cross(Object.keys(eachTripsforScatter[0])))
		.enter().append("svg:g")
	    .attr("transform", function(d, i) { return "translate(0," + i * size + ")"; });

		row.selectAll("line.x")
		       .data(function(d) { return position[d.x].ticks(5).map(position[d.x]); })
		     .enter().append("svg:line")
		       .attr("class", "x")
		       .attr("x1", function(d) { return d; })
		       .attr("x2", function(d) { return d; })
		       .attr("y1", padding / 2)
		       .attr("y2", size - padding / 2);
// Y-ticks. 
   row.selectAll("line.y")
       .data(function(d) { return position[d.y].ticks(5).map(position[d.y]); })
     .enter().append("svg:line")
       .attr("class", "y")
       .attr("x1", padding / 2)
       .attr("x2", size - padding / 2)
       .attr("y1", function(d) { return d; })
	   .attr("y2", function(d) { return d; })  

	   row.filter(function(d) { return d.i === d.j; }).append("text")
      .attr("x", padding)
      .attr("y", padding)
      .attr("dy", ".71em")
      .text(function(d) { return d.x; });


// Frame.
   row.append("svg:rect")
       .attr("x", padding / 2)
       .attr("y", padding / 2)
       .attr("width", size - padding)
       .attr("height", size - padding)
       .style("fill", "none")
       .style("stroke", "#aaa")
       .style("stroke-width", 1.5)
       .attr("pointer-events", "all")
       .on("mousedown", mousedown);

// Dot plot.
   row.selectAll("circle")
       .data(cross(eachTripsforScatter))
     .enter().append("svg:circle")
       .attr("cx", function(d) { return position[d.x.x](d.y[d.x.x]); })
       .attr("cy", function(d) { return size - position[d.x.y](d.y[d.x.y]); })
       .attr("r", 3)
       .style("fill", function(d) { return color(d.y.duration); })
       .style("fill-opacity", .5)
       .attr("pointer-events", "none");

	   d3.select(window)
	          .on("mousemove", mousemove)
	          .on("mouseup", mouseup);
	    
	      var rect, x0, x1, count;
	    
	      function mousedown() {
			x0 = d3.mouse(this);
	        count = 0;
	    
	        rect = d3.select(this.parentNode)
	          .append("svg:rect")
	            .style("fill", "#999")
	            .style("fill-opacity", .5);
	        d3.event.preventDefault(); }
		 
		 function mousemove() {
			     if (!rect) return;
			     x1 = d3.mouse(rect.node());
			 
			     x1[0] = Math.max(padding / 2, Math.min(size - padding / 2, x1[0]));
			     x1[1] = Math.max(padding / 2, Math.min(size - padding / 2, x1[1]));
			 
			     var minx = Math.min(x0[0], x1[0]),
			         maxx = Math.max(x0[0], x1[0]),
			         miny = Math.min(x0[1], x1[1]),
			         maxy = Math.max(x0[1], x1[1]);
			 
			     rect
			         .attr("x", minx - .5)
			         .attr("y", miny - .5)
			         .attr("width", maxx - minx + 1)
			         .attr("height", maxy - miny + 1);
			var v = rect.node().__data__,
			         x = position[v.x],
			         y = position[v.y],
			         mins = x.invert(minx),
			         maxs = x.invert(maxx),
			         mint = y.invert(size - maxy),
			         maxt = y.invert(size - miny);
					 count = 0;
					      svg.selectAll("circle")
					          .style("fill", function(d) {
					            return mins <= d.y[v.x] && maxs >= d.y[v.x]
					                && mint <= d.y[v.y] && maxt >= d.y[v.y]
					                ? (count++, color(d.y.duration))
					                : "#ccc";        });
	   }
	   function mouseup() {
		     if (!rect) return;
		     rect.remove();
		     rect = null; 
		     if (!count) svg.selectAll("circle")
		         .style("fill", function(d) { return color(d.y.duration);
		         });
		   }

}

function cross(a) {
	   return function(d) {
	     var item = [];
	     for (var i = 0, p = a.length; i < p; i++) 
	     	item.push({x: d, y: a[i]});
	     return item;
	   };
 }





