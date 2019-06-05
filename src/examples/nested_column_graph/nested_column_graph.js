"use strict";
import * as d3 from "d3";
import { formatType, handleErrors } from "../common/utils";

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
  // Set up the initial state of the visualization
  create: function(element, config) {

    // Insert a <style> tag with some styles we'll use later.
    element.innerHTML = `
      <style>

      </style>
    `;

    var container = element.appendChild(document.createElement("svg"));
    container.className = "nested-column-vis";
  },
  // Render in response to the data or settings changing
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

    var dimension_groups = d3.scale.ordinal()
      .rangeRoundBands([0, width], .1)
      .domain(data.map(function(d, i) { return d[dimension.name]; } ));
    var measure_groups = d3.scale.ordinal();
    
    var dimension_axis = d3.svg.axis()
      .scale(dimension_groups)
      .orient("bottom");

    var y = d3.scale.linear()
      .range([height, 0])
      .domain([0, height]);
    //.domain(): calculate largest stack of bars

    var y_axis = d3.svg.axis()
      .scale(y)
      .orient("left")
      .tickFormat(d3.format(".2s"));

    // Grab the first cell of the data
    var firstRow = data[0];
    var firstCell = firstRow[dimension.name];

    // Insert the data into the page
    this._textElement.innerHTML = LookerCharts.Utils.htmlForCell(firstCell);

    // Set the size to the user-selected size
    if (config.font_size == "small") {
      this._textElement.className = "nested-column-text-small";
    } else {
      this._textElement.className = "nested-column-text-large";
    }

    done();
  }
};

looker.plugins.visualizations.add(vis);