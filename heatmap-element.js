import {html, PolymerElement} from '@polymer/polymer/polymer-element.js';
import {color_stops} from './color.js';
import * as utils from './utils.js';
/**
 * `heatmap-element`
 * heatmap for oTree Visual Markets
 *
 * @customElement
 * @polymer
 * @demo demo/index.html
 */
class HeatmapElement extends PolymerElement {
  static get template() {
    return html`
      <style>
        canvas {
          border: 1px solid #000000;
          height: 500;
          width: 7000;
        }
        :host {
          display: block;
        }
      </style>
      
      <canvas id="heatmapCanvas" height="200" width="500">
      <canvas id="indifferenceCurve" height="200" width="500">
      </canvas>
    `;
  }
  static get properties() {
    return {
      color: {
        type: String,
        observer: 'generate_heatmap'
      },
      utility_fucntion: {
        type: Object,
        value: function () {
          return (x,y) => Math.abs(x**2 - y**3);
        }
      },
      maxXAsset: {
        type: Number,
        value: 6,
        notify: true,
        observer: 'get_max'
      },
      maxYAsset: {
        type: Number,
        value: 7,
        notify: true,
        observer: 'get_max'
      },
      minXAsset: {
        type: Number,
        value: 2,
        notify: true,
        observer: 'get_max'
      },
      minYAsset: {
        type: Number,
        value: 1,
        notify: true,
        observer: 'get_max'
      },
      currentXAssest: {
        type: Number,
        notify: true
      },
      maxUtility: {
        type: Number,
        notify: true,
        observer: 'generate_heatmap'
      }

    };
  }

  constructor(){
    super();
    this.color = 'red';
    // this.addEventListener('mouseover', this.hover_test.bind(event ));
  }

  // Get max then make heatmap
  get_max(){
    if(!this.minXAsset || !this.minYAsset || !this.maxYAsset || !this.maxXAsset){
      return;
    }
    var step = .01;
    var max = -1;
    var temp = max;
    for(var i = this.minXAsset; i <= this.maxXAsset; i += step){
      for(var j = this.minYAsset; j <= this.maxYAsset; j += step){
        temp = this.utility_fucntion(i, j);
        if(temp > max){
          max = temp
        }
      }
    }
    this.maxUtility = max;
  }



  draw_indifference_curve(canvas, xAsset, yAsset, isHover){
    return 0;

  }

  hover_test(e){
    // var bounds = e.target.getBoundingClientRect();
    // var x = (e.pageX - bounds.left);
    // var y = (e.pageY - bounds.top);

    
    // const pixel_x_value = ((x * (e.target.properties.maxXAsset - this.minXAsset)) / w) + (this.minXAsset);
    // const pixel_y_value = (( (e.target.height - y) * (this.maxYAsset - this.minYAsset)) / h) + (this.minYAsset);


    // console.log("x: " + x + "\ty: " + y);
    // console.log(e);
    
    
  }

  // gets colors from the gradient defined by the color stops above
  // 0.0 <= percent <= 1.0
  // where percent = 1.0 gets the last color in color_stops and percent = 0.0 gets the first color in color_stops
  get_gradient_color(percent, color_scheme) {
    const scheme = color_stops[color_scheme];
    if (typeof(scheme[0][0]) == 'number') {
        percent =  percent * (scheme.length - 1);
        const low_index = Math.floor(percent);
        const high_index = Math.ceil(percent);
        percent =  percent - low_index;

        try{

          return [0, 1, 2].map(i => percent * scheme[high_index][i]
            + (1 - percent) * scheme[low_index][i]);
        } catch (e){
          return [255, 120, 210];
        }
    }
    for (let i = 0; i < scheme.length-1; i++) {
        const curr_stop = scheme[i][1];
        const next_stop = scheme[i+1][1];
        if (percent >= curr_stop && percent <= next_stop) {
            const low_color = scheme[i][0];
            const high_color = scheme[i+1][0];
            const interp = 1 - ((percent - curr_stop) / (next_stop - curr_stop));
            return [0, 1, 2].map(i => interp * low_color[i] + (1 - interp) * high_color[i]);
        }
    }
    return scheme[scheme.length-1][0];
  }
  generate_heatmap(){
    
    if (!this.color || !this.maxUtility) {
      return;
    }
    const canvas = this.$.heatmapCanvas;
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');
    
    // const max_payoff = this.get_max(this.utility_fucntion, this.minXAsset, this.minY, this.maxXAsset, this.maxYAsset, 1);
    const max_payoff = this.maxUtility;

    // create empty imageData object
    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;

    // iterate through every pixel in the image in row major order
    for (let row = 0; row < h; row++) {

      for (let col = 0; col < w; col++) {

        // Get the current pixel's x and y asset values, based on: 
        // https://stackoverflow.com/questions/929103/convert-a-number-range-to-another-range-maintaining-ratio
        const pixel_x_value = ((col * (this.maxXAsset - this.minXAsset)) / w) + (this.minXAsset);
        const pixel_y_value = (( (h - row) * (this.maxYAsset - this.minYAsset)) / h) + (this.minYAsset);
        

        // Call utility function
        const point_payoff = this.utility_fucntion(pixel_x_value, pixel_y_value);

        // divide the payoff by the max payoff to get an color intensity percentage
        // use get_gradient_color to get the appropriate color in the gradient for that percentage
        var percent = point_payoff / max_payoff;

        const point_color = this.get_gradient_color(percent, this.color);

        // set imageData for this pixel to the calculated color
        const index = (row * w * 4) + (col * 4);
        data[index] = point_color[0];
        data[index + 1] = point_color[1];
        data[index + 2] = point_color[2];
        // set alpha channel to fully opaque
        data[index + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }








}

window.customElements.define('heatmap-element', HeatmapElement);
