import * as d3 from 'd3';
import * as moment from 'moment';
import { handleErrors } from '../common/utils';

import {
  Looker,
  LookerChartUtils,
  VisualizationDefinition
} from '../types/types'

declare const looker: Looker;
declare const LookerCharts: LookerChartUtils;

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

function getTooltipHtml(d: any, dimensionName: any, pivotValue: any) {
  return `
    <div>
      <div>
        <span>${dimensionName}</span>
      </div>
      <div style="margin-bottom: 10px;">
        <span><b>${d.data.dimensionValue}</b></span>
      </div>
      <div>
        <span>${pivotValue}</span>
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

function getRectPivotValue(d: any, pivot: any, pivotValues: any) {
  const orderedPivotValues = pivotValues.sort(function(p1: any, p2: any) {
    const p1Sort = p1["metadata"][pivot.name].sort_value;
    const p2Sort = p2["metadata"][pivot.name].sort_value;

    if (p1Sort > p2Sort) {
      return 1;
    }
    if (p1Sort < p2Sort) {
      return -1
    }
    return 0;
  });

  const targetValue = d["0"];
  let accumulatedValue = 0;
  let matchingLabel = "";
  orderedPivotValues.forEach(function(p: any, i: any) {
    const pivotLabel = p["metadata"][pivot.name].value;
    const dataValue = d.data[pivotLabel];

    if (dataValue === 0) {
      return;
    }

    if (accumulatedValue === targetValue) {
      matchingLabel = pivotLabel;
    }

    accumulatedValue += dataValue;
  });

  return matchingLabel;
}

function formatDateValue(dateStr: any, dateFormat: any) {
  let datetime = moment(dateStr);
  if (!datetime.isValid()) {
    return "Invalid Date";
  }

  return datetime.format(dateFormat);
}

interface NestedColumnGraphVisualization extends VisualizationDefinition {
    svg?: any
}

const nestedColumnGraph: NestedColumnGraphVisualization = {
  // Id and Label are legacy properties that no longer have any function besides documenting
  // what the visualization used to have. The properties are now set via the manifest
  // form within the admin/visualizations page of Looker
  id: "nested_column_graph",
  label: "Nested Column Graph",
  options: {
    x_axis_label: {
      type: "string",
      label: "X Axis Label",
      display: "text",
      default: "",
      order: 1,
    },
    y_axis_label: {
      type: "string",
      label: "Y Axis Label",
      display: "text",
      default: "",
      order: 2,
    },
    date_format: {
      type: "string",
      label: "Date Format",
      display: "text",
      default: "",
      order: 3,
    },
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
          width: 150px;
          max-width: 150px;
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
      .domain(data.map(function(d) {
        return !config.date_format ?
                 d[dimension.name].value.toString() :
                 formatDateValue(d[dimension.name].value.toString(), config.date_format);
      }));

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
                ["dimensionValue"]: !config.date_format ?
                                      d[dimension.name].value.toString() :
                                      formatDateValue(d[dimension.name].value.toString(), config.date_format),
                ["measureName"]: m.label_short,
                ["links"]: d[dimension.name].links
            };

            pivotValues.map(function(p) {
                dataPoint[p["metadata"][pivot.name].value] = d[m.name][p.key].value || 0;
            });

            flattenedData.push(dataPoint);
        });
    });

    const stackData = stack
  	  .keys(pivotValues.map(function(p) { return p["metadata"][pivot.name].value }))(flattenedData);

    let rects = g.selectAll(".rects")
      .data(stackData)
      .enter().append("g")
        .attr("fill", function(d: any) { return palette[pivotValueOrder[d.key] % palette.length]; });
    
    rects.selectAll("rect")
      .data(function(d: any) { return d; })
      .enter().append("rect")
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
          let tooltip = document.getElementById("tooltip")!;
          let isMouseOnLeftSide = d3.event.pageX < (element.clientWidth / 2);
          tooltip.innerHTML = getTooltipHtml(d, dimension.label_short, getRectPivotValue(d, pivot, pivotValues));
          tooltip.style.display = "block";
          tooltip.style.left = isMouseOnLeftSide ? (d3.event.pageX + 10) + "px" : (d3.event.pageX - 170) + "px";
          tooltip.style.top = d3.event.pageY - 35 + "px";
        })
        .on('mouseout', function (this: any) {
          let tooltip = document.getElementById("tooltip")!;
          tooltip.style.display = "none";
        });

    // X axis
    g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(dimensionX));
    
    g.selectAll(".x-axis")
      .selectAll("g")
      .selectAll("text")
        .attr("transform", "translate(0, 15)");

    // X axis label
    g.selectAll(".x-axis")
      .append("text")
        .attr("transform", `translate(${width / 2}, 50)`)
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .text(config.x_axis_label);
    
    // Measure labels
    measures.forEach(function(m: any, i: number) {
      g.selectAll(".x-axis")
        .selectAll("g")
        .append("text")
        .attr("transform", `translate(${measureX.bandwidth() * (i === 0 ? -.65 : .65)}, 15)`)
          .attr("fill", "#000")
          .attr("font-size", 8)
          .text(m.label_short);
    });

    // Legend
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

    // Y axis
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

      done();
  }
};

looker.plugins.visualizations.add(nestedColumnGraph);