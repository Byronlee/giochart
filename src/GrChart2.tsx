/***
 * 文档
 */
import {GrChartProps, ChartParamsProps, ChartDataProps, Meta, Source} from './chartProps';
import * as React from "react";
import * as ReactDOM from 'react-dom';
import { find, map, fromPairs, zip } from 'lodash';
import G2 = require('g2');

interface SourceConfig {
  [colName: string]: {
    tickCount?: number;
    mask?: string;
    alias?: string;
    type?: string;
    nice?: boolean;
  }
}
class GrChart extends React.Component <GrChartProps, any> {
  chart: any;
  static contextTypes: React.ValidationMap<any> = {
    source: React.PropTypes.any,
    selected: React.PropTypes.any,
    selectHandler: React.PropTypes.func
  };

  componentWillReceiveProps(nextProps: GrChartProps, nextContext: any) {
    if (nextContext.source) {
      this.chart && this.chart.destroy();
      this.drawChart(nextProps.chartParams, nextContext.source);
    }
  }
  render() {
    return <div></div>;
  }

  /*defaultRetryRequest() {
    let {chartParams} = this.props;
    let result = Promise.reject();
    for (let i = 3; i > 0; i--) {
      result = result.catch(this.defaultRequest.bind(this, chartParams, this.drawChart));
    }
    return result;
  }*/

  componentDidMount() {
    let {chartParams, source} = this.props;

    if (this.props.hasOwnProperty('source')) {
      this.chart && this.chart.destroy();
      this.drawChart(chartParams, source);
    }
  }
  drawChart(chartParams: ChartParamsProps, source: Source) {
    let dom = document.createElement('div');
    ReactDOM.findDOMNode(this).appendChild(dom);
    let chart = new G2.Chart({
      container: dom,
      height: dom.getBoundingClientRect().height || 250,
      forceFit: true,
      plotCfg: {}
    });


    let frame = new G2.Frame(source);
    let sourceDef: SourceConfig = this.createSourceConfig(chartParams);

    let metricCols = map(chartParams.metrics, 'id');
    let dimCols    = chartParams.dimensions;

    if (chartParams.chartType !== 'bubble' && chartParams.metrics.length > 1) {
      frame = G2.Frame.combinColumns(frame, metricCols, 'val', 'metric', dimCols);
      dimCols.push('metric');
      //设定id=>name
      let metricDict = fromPairs(zip(metricCols, chartParams.metricsNames));

      let mColVals = frame.colArray('metric');
      let mColNames = mColVals.map((n: string) => metricDict[n]);
      metricCols = ['val'];
      frame.colReplace('metric', mColNames);
    }
    console.log(frame);
    //sourceDef['metric'] = {alias:'指标', type: 'cat'};
    chart.source(frame, sourceDef);
    //做分组
    chart.axis('tm', { title: false });
    chart.axis('val', { title: false });
    let geom = this.caculateGeom(chart, chartParams.chartType, chartParams.attrs.subChartType);

    let pos;
    if (chartParams.chartType === 'bubble') {
      pos = metricCols[0] + '*' + metricCols[1];
    } else if (chartParams.chartType === 'funnel') {
      pos = G2.Stat.summary.sum('metric*val');
    } else {
      pos = G2.Stat.summary.sum(dimCols[0] + '*' + metricCols[0]);
    }
    geom.position(pos);

    if (chartParams.chartType === 'funnel') {
      geom.color('metric', ['#C82B3D', '#EB4456', '#F9815C', '#F8AB60', '#EDCC72'])
          .label('metric', { offset: 10, label: { fontSize: 14 } });
    } else if (dimCols.length > 1) { //TODO: metrics
      geom.color('metric');
    }

    chart.render();
    this.chart = chart;
/*
    chart.setMode('select');
    chart.select('rangeX');
    //设置筛选功能,将选区传给GrLoader，其他组件通过context传导filter,
    if (chartParams.chartType === 'line') {
      chart.on('rangeselectend', this.context.selectHandler);
    }
*/
  }

  createSourceConfig(chartParams: ChartParamsProps): SourceConfig {
    let sourceDef: SourceConfig = {};
    //射击
    chartParams.metrics.forEach(
      (m, i:number) => {
        sourceDef[m.id] = { alias: chartParams.metricsNames[i] }
      }
    );
    chartParams.dimensions.forEach(
      (m, i:number) => {
        sourceDef[m] = { alias: chartParams.dimensionsNames[i], type: 'cat' }
      }
    );

    if (chartParams.dimensions.includes('tm')) {
      let timeDef = {
        alias: '时间',
        type: 'time',
        mask: 'mm-dd',
        nice: true,
        tickCount: 7
      };

      if (chartParams.timeRange === 'day:8,1') {
        timeDef.tickCount = 7;
      }
      if (chartParams.interval === 86400000) {
        timeDef.mask = 'mm-dd';
      } else if (chartParams.interval === 3600000) {
        timeDef.mask = 'HH:mm';
      }
      if (chartParams.chartType === 'bar' || chartParams.chartType === 'vbar') {
        timeDef.type = 'timeCat';
      }
      sourceDef['tm'] = timeDef;
    }

    return sourceDef;
  }

  caculateGeom(chart:any, gt:string, subType: string) {
    let adjust: string;
    if (subType === 'seperate'){
      adjust = 'dodge';
    } else if (subType === 'total') {
      adjust = 'stack';
    } else if (subType === 'percent') {
      adjust = 'stack';
    }

    if (gt === 'bar') {
      chart.coord('rect').transpose();
      return chart.interval(adjust);
    } else if (gt === 'vbar') {
      return chart.interval(adjust);
    } else if (gt === 'funnel') {
      chart.coord('rect').transpose().scale(1, -1);
      chart.axis(false);
      return chart.intervalSymmetric().shape('funnel');
    } else if (gt === 'bubble') {
      //TODO:重新设计Tooltip;
      return chart.point();
    } else if (gt === 'line') {
      return chart.line().size(2);
    }
    return chart[gt](adjust);
  }
}

export default GrChart;