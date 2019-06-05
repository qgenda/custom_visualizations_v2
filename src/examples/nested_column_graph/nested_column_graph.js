function getDataStackValue(dataStack) {
  var currentSum = 0;
  Object.keys(dataStack).forEach((function(dataPivot) {
    currentSum += (dataPivot.value || 0);
  }));

  return currentSum;
}

function getMaxStackValue(data, measures) {
  return Math.max(...measures.map(function (m) {
    return Math.max(...data.map(function(d) {
      return getDataStackValue(d[m.name]);
    }));
  }));
}

var vis = {
  // Id and Label are legacy properties that no longer have any function besides documenting
  // what the visualization used to have. The properties are now set via the manifest
  // form within the admin/visualizations page of Looker
  id: "nested_column_graph",
  label: "Nested Column Graph",
  options: {
    font_size: {
      type: "string",
      label: "Font Size",
      values: [
        {"Large": "large"},
        {"Small": "small"}
      ],
      display: "radio",
      default: "large"
    }
  },
  
  create: function(element, config) {
    element.innerHTML = `
      <style>

      </style>
    `;

    var container = element.appendChild(document.createElement("svg"));
    container.className = "chart";
    
  },
  updateAsync: function(data, element, config, queryResponse, details, done) {
    if (!handleErrors(this, queryResponse, {
      min_pivots: 1, max_pivots: 1,
      min_dimensions: 1, max_dimensions: 1,
      min_measures: 1, max_measures: undefined
    })) return;

    console.log("data: ", data);
    console.log("element:" , element);
    console.log("config: ", config);
    console.log("queryResponse: ", queryResponse);
    console.log("details: ", details);
    console.log("done: ", done);

    // TODO: Remove?
    // this.clearErrors();

    const margin = {
      top: 20,
      right: 20,
      bottom: 60,
      left: 40
    };
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;

    const dimension = queryResponse.fields.dimensions[0];
    const pivot = queryResponse.fields.pivots[0];
    const measures = queryResponse.fields.measures;

    var dimension_x = d3.scaleBand()
      .rangeRound([0, width])
      .paddingInner(0.1);

    var measure_x = d3.scaleBand()
      .padding(0.05);

    /*
    var dimension_groups = d3.scaleOrdinal()
        .rangeRoundBands([0, width], .1)
        .domain(data.map(function(d, i) { return d[dimension.name]; } ));
    var measure_groups = d3.scaleOrdinal();
    */

    var dimension_axis = d3.svg.axis()
        .scale(dimension_x)
        .orient("bottom");

    var y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, getMaxStackValue(data, measures)]);

    var y_axis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .tickFormat(d3.format(".2s"));

    var chart = d3.select(".chart")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    

    done();
  }
};

looker.plugins.visualizations.add(vis);