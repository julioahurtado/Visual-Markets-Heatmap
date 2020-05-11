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
        }
        :host {
          display: block;
        }
      </style>
      
      <canvas id="heatmapCanvas" height="200" width="300">
      <canvas id="currentCurveCanvas" height="200" width="300">
      <canvas id="hoverCurveCanvas" height="200" width="300">
      </canvas>
    `;
  }
  static get properties() {
    return {
      color: {
        type: String,
        observer: 'generate_heatmap'
      },
      utility_function: {
        type: Object,
        value: function () {
          return (x,y) => x**2 + y**3;
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
      currentXAsset: {
        type: Number,
        notify: true,
        observer: 'get_current_util'
      },
      currentYAsset: {
        type: Number,
        notify: true,
        observer: 'get_current_util'
      },
      currentUtility: {
        type: Number,
        notify: true,
        observer: 'define_current_curve'
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
    this.currentXAsset = 3;
    this.currentYAsset = 4;
    // this.addEventListener('mouseover', this.hover_test.bind(event));
  }

  get_current_util(){
    if(!this.currentYAsset || !this.currentXAsset || this.currentUtility){
      return;
    }
    this.currentUtility = this.utility_function(this.currentXAsset, this.currentYAsset);
  }


  // Get max then make heatmap
  get_max(){
    // Needed for function
    if(!this.minXAsset || !this.minYAsset || !this.maxYAsset || !this.maxXAsset || this.maxUtility){
      return;
    }
    var t1 = performance.now();
    var step = .01;
    var max = -1;
    var temp = max;
    
    // Do a brute force iteration over the domain
    for(var i = this.minXAsset; i <= this.maxXAsset; i += step){
      for(var j = this.minYAsset; j <= this.maxYAsset; j += step){
        temp = this.utility_function(i, j);
        if(temp > max){
          max = temp
        }
      }
    }
    
    // Set max value, used for normalizing pixel heat intensity
    this.maxUtility = max;
    var t2 = performance.now();
    // console.log("end max: " + (t2-t1));
  }


  define_current_curve(){
    if(!this.currentUtility){
      return;
    }
    const canvas = this.$.heatmapCanvas;

    const assets = {
      maxXAsset: this.maxXAsset,
      minXAsset: this.minXAsset,
      maxYAsset: this.maxYAsset,
      minYAsset: this.minYAsset,
    }

    this.draw_indifference_curve(canvas, this.currentUtility, false, this.utility_function, 1, assets);
  }


  draw_indifference_curve(canvas, currentUtility, isHover, eval_function, delta, assets){

    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');
    var t1 = performance.now();

    // create empty imageData object
    const imageData = ctx.getImageData(0,0, w, h);
    const data = imageData.data;

    // iterate through every pixel in the image in row major order
    for (let row = 0; row < h; row++) {

      for (let col = 0; col < w; col++) {

        // Get the current pixel's x and y asset values, based on: 
        // https://stackoverflow.com/questions/929103/convert-a-number-range-to-another-range-maintaining-ratio
        const pixel_x_value = ((col * (assets.maxXAsset - assets.minXAsset)) / w) + (assets.minXAsset);
        const pixel_y_value = (( (h - row) * (assets.maxYAsset - assets.minYAsset)) / h) + (assets.minYAsset);
        

        // Call utility function
        const point_payoff = eval_function(pixel_x_value, pixel_y_value);

        // divide the payoff by the max payoff to get an color intensity percentage
        // use get_gradient_color to get the appropriate color in the gradient for that percentage
        var difference = Math.abs(point_payoff - currentUtility);

        // set imageData for this pixel to the calculated color
        const index = (row * w * 4) + (col * 4);
        if(difference < delta){
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
          // set alpha channel to fully opaque
          data[index + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    var t2 = performance.now();
    console.log("end curve: " + (t2-t1));


    return 0;

  }

  // hover_test(e){
  //   var bounds = e.target.getBoundingClientRect();
  //   var canvas = e.target.$.heatmapCanvas;
  //   var w = canvas.width;
  //   var h = canvas.height;
  //   var x = (e.pageX - bounds.left);
  //   var y = (e.pageY - bounds.top);

    
  //   // const pixel_x_value = ((x * (e.target.maxXAsset - e.target.minXAsset)) / w) + (e.target.minXAsset);
  //   // const pixel_y_value = (( (h - y) * (e.target.maxYAsset - e.target.minYAsset)) / h) + (e.target.minYAsset);


  //   // console.log("x: " + x + "\ty: " + y);
  //   // console.log("x_val: " + pixel_x_value + "\ty_val: " + pixel_y_value);
  //   // console.log(e);
  //   // console.log(e.target.color);
    
    
  // }

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
    var t1 = performance.now();
    
    const canvas = this.$.heatmapCanvas;
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');
    
    // const max_payoff = this.get_max(this.utility_function, this.minXAsset, this.minY, this.maxXAsset, this.maxYAsset, 1);
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
        const point_payoff = this.utility_function(pixel_x_value, pixel_y_value);

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
    var t2 = performance.now();
    console.log("end heatmap: " + (t2-t1));
  }








}

window.customElements.define('heatmap-element', HeatmapElement);
