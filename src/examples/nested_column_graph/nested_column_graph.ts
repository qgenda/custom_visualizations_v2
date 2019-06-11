import * as d3 from 'd3';
import { handleErrors } from '../common/utils';

import {
  Looker,
  LookerChartUtils,
  VisualizationDefinition
} from '../types/types'

declare const looker: Looker;
declare const LookerCharts: LookerChartUtils

function getDataStackValue(dataStack: any) {
  let currentSum = 0;
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

function getTooltipHtml(d: any, dimensionName: any) {
  return `
    <div>
      <div>
        <span>${dimensionName}</span>
      </div>
      <div style="margin-bottom: 10px;">
        <span><b>${d.data.dimensionValue}</b></span>
      </div>
      <div>
        <span>${d.data.measureName}</span>
      </div>
      <div>
        <span><b>${Math.round((d["1"] - d["0"]) * 100) / 100}</b></span>
      </div>
    </div>
  `.trim();
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
    x_axis_label:{
      type: "string",
      label: "X Axis Label",
      display: "text",
      default: ""
    },
    y_axis_label:{
      type: "string",
      label: "Y Axis Label",
      display: "text",
      default: ""
    },

    // TODO: Parse dimension as time y/n
    // TODO: Time format
  },
  
  create: function(element, config) {
    element.innerHTML = `
      <style>
        #tooltip {
          background: black;
          color: white;
          border: 1px solid black;
          border-radius: 5px;
          padding: 5px;
          opacity: .75;
        }
      </style>
      <div id="tooltip" display="none" style="position: absolute; display: none;"></div>
    `;

    this.svg = d3.select(element).append('svg')
    
  },
  updateAsync: function(data, element, config, queryResponse, details, done) {
    if (!handleErrors(this, queryResponse, {
      min_pivots: 1, max_pivots: 1,
      min_dimensions: 1, max_dimensions: 1,
      min_measures: 2, max_measures: 2 // TODO: This could be any number, just need to fix measure label positions on axis
    })) return;

    console.log("data: ", data);
    console.log("element:" , element);
    console.log("config: ", config);
    console.log("queryResponse: ", queryResponse);
    console.log("details: ", details);
    console.log("done: ", done);

    const margin = {
      top: 20,
      right: 20,
      bottom: 70,
      left: 40
    };
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;

    const dimension = queryResponse.fields.dimensions[0];
    const measures = queryResponse.fields.measures;
    const pivot = queryResponse.fields.pivots[0];
    const pivotValues = queryResponse.pivots;
    const pivotValueOrder: any = {};
    pivotValues.map(function(p) {
      pivotValueOrder[p["metadata"][pivot.name].value] = p["metadata"][pivot.name].sort_value
    });

    console.log("pivotValues: ", pivotValues);
    console.log("pivotValueOrder: ", pivotValueOrder);
    
    // "Boardshorts"
    const palette = [
      "#4276be",
      "#3fb0d5",
      "#e57947",
      "#ffd95f",
      "#b42f37",
      "#6a013a",
      "#7363a9",
      "#44759a",
      "#fbb556",
      "#d5c679",
      "#9ed7d7",
      "#d59e79"
    ];

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

    let stack = d3.stack()
        .offset(d3.stackOffsetNone);
    
    let flattenedData: any[] = [];
    data.map(function(d) {
        measures.map(function(m) {
            let dataPoint: any = {
                ["dimensionValue"]: d[dimension.name].value.toString(),
                ["measureName"]: m.label_short,
                ["links"]: d[dimension.name].links
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

    let serie = g.selectAll(".serie")
      .data(stackData)
      .enter().append("g")
        .attr("class", "serie")
        .attr("fill", function(d: any) { return palette[pivotValueOrder[d.key] % palette.length]; });
    
    serie.selectAll("rect")
      .data(function(d: any) { return d; })
      .enter().append("rect")
        .attr("class", "serie-rect")
        .attr("transform", function(d: any) { return "translate(" + dimensionX(d.data.dimensionValue) + ",0)"; })
        .attr("x", function(d: any) { return measureX(d.data.measureName); })
        .attr("y", function(d: any) { return y(d[1]); })
        .attr("height", function(d: any) { return y(d[0]) - y(d[1]); })
        .attr("width", measureX.bandwidth())
        .attr("cursor", "pointer")
        .on('click', function (this: any, d: any) {
          const event: object = { pageX: d3.event.pageX, pageY: d3.event.pageY }
          LookerCharts.Utils.openDrillMenu({
            links: d.data.links,
            event: event
          })
        })
        .on('mousemove', function (this: any, d: any) {
          console.log("this: ", this);
          console.log("d: ", d);
          let tooltip = document.getElementById("tooltip")!;
          tooltip.innerHTML = getTooltipHtml(d, dimension.label_short);
          tooltip.style.display = "block";
          tooltip.style.left = d3.event.pageX + 10 + "px";
          tooltip.style.top = d3.event.pageY - 25 + "px";
        })
        .on('mouseout', function (this: any) {
          let tooltip = document.getElementById("tooltip")!;
          tooltip.style.display = "none";
        });

    g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(dimensionX));
    
    g.selectAll(".x-axis")
      .selectAll("g")
      .selectAll("text")
        .attr("transform", "translate(0, 15)");
    
    measures.forEach(function(m: any, i: number) {
      g.selectAll(".x-axis")
        .selectAll("g")
        .append("text")
        .attr("transform", `translate(${measureX.bandwidth() * (i === 0 ? -.65 : .65)}, 15)`)
          .attr("fill", "#000")
          .attr("font-size", 8)
          .text(m.label_short);
    });

    g.selectAll(".x-axis")
      .append("text")
        .attr("transform", `translate(${width / 2}, 50)`)
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .text(config.x_axis_label);

    pivotValues.forEach(function(p: any, i: number) {
      svg.append("circle")
          .attr("cx",margin.left + (i * 50))
          .attr("cy", element.clientHeight - 5)
          .attr("r", 5)
          .attr("fill", palette[p["metadata"][pivot.name].sort_value % palette.length]);

      svg.append("text")
          .attr("x", margin.left + ((i * 50) + 10))
          .attr("y", element.clientHeight - 1)
          .attr("fill", "#000")
          .attr("font-size", 12)
          .text(p["metadata"][pivot.name].value.substr(0, 3));
    });

    g.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y).ticks(5, "s"))
      .append("text")
        .attr("x", -(height/3))
        .attr("y", -35)
        .attr("dy", "0.32em")
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .attr("text-anchor", "end")
        .attr("font-size", 12)
        .attr("transform", "rotate(-90)")
        .text(config.y_axis_label);
        
      console.log("-------------------------");
      done();
  }
};

looker.plugins.visualizations.add(vis);