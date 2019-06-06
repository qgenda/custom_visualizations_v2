declare var looker: Looker;

import * as d3 from 'd3';
import { handleErrors } from '../common/utils';

import {
    Row,
    Looker,
    VisualizationDefinition
} from '../types/types'

function getDataStackValue(dataStack: any) {
  var currentSum = 0;
  Object.keys(dataStack).forEach((function(dataPivot) {
    currentSum += (dataStack[dataPivot].value || 0);
  }));

  return currentSum;
}

function getMaxStackValue(data: any, measures: any) {
  return Math.max(...measures.map(function (m: any) {
    return Math.max(...data.map(function(d: any) {
      return getDataStackValue(d[m.name]);
    }));
  }));
}

interface NestedColumnGraphVisualization extends VisualizationDefinition {
    svg?: any
}

const vis: NestedColumnGraphVisualization = {
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

    this.svg = d3.select(element).append('svg')
    
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
    const measures = queryResponse.fields.measures;
    const pivot = queryResponse.fields.pivots[0];
    const pivotValues = queryResponse.pivots;

    const svg = this.svg!
        .html('')
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      
    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

    let dimensionX = d3.scaleBand()
      .rangeRound([0, width])
      .paddingInner(0.1)
      .domain(data.map(function(d) { return d[dimension.name].value; } ));

    let measureX = d3.scaleBand()
      .padding(0.05)
      .domain(measures.map(function(m) { return m.label_short }))
      .rangeRound([0, dimensionX.bandwidth()])
      .padding(0.2);
      
    let y = d3.scaleLinear()
      .range([height, 0])
      .domain([0, getMaxStackValue(data, measures)]);
    
    let colorScale = d3.scaleOrdinal()
      .range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"])
      .domain(pivotValues.map(function(p) { return p["metadata"][pivot.name].value }));

    let stack = d3.stack()
        .offset(d3.stackOffsetNone);
    
    let flattenedData: any[] = [];
    data.map(function(d) {
        measures.map(function(m) {
            let dataPoint: any = {
                ["dimensionValue"]: d[dimension.name].value.toString(),
                ["measureName"]: m.label_short
            };

            pivotValues.map(function(p) {
                dataPoint[p["metadata"][pivot.name].value] = d[m.name][p.key].value || 0;
            });

            flattenedData.push(dataPoint);
        });
    });

    console.log("flattenedData: ", flattenedData);

    const stackData = stack
  	  .keys(pivotValues.map(function(p) { return p["metadata"][pivot.name].value }))(flattenedData);

    console.log("stackData: ", stackData);

    var serie = g.selectAll(".serie")
      .data(stackData)
      .enter().append("g")
        .attr("class", "serie")
        .attr("fill", function(d: any) { return colorScale(d.key); });
    
    serie.selectAll("rect")
      .data(function(d: any) { return d; })
      .enter().append("rect")
        .attr("class", "serie-rect")
        .attr("transform", function(d: any) { return "translate(" + dimensionX(d.data.dimensionValue) + ",0)"; })
        .attr("x", function(d: any) { return measureX(d.data.measureName); })
        .attr("y", function(d: any) { return y(d[1]); })
        .attr("height", function(d: any) { return y(d[0]) - y(d[1]); })
        .attr("width", measureX.bandwidth())
        .on("click", function(d: any, i: any){ console.log("serie-rect click d", i, d); });

    g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(dimensionX));
    
    g.selectAll(".axis")
      .selectAll("g")
      .selectAll("text")
        .attr("transform", "rotate(30 10,30)");

    g.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y).ticks(null, "s"))
      .append("text")
        .attr("x", 2)
        .attr("y", y((y as any).ticks().pop()) + 0.5)
        .attr("dy", "0.32em")
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .attr("text-anchor", "start")
        .text(measures[0].label_short);
        
      console.log("-------------------------");
      done();
  }
};

looker.plugins.visualizations.add(vis);