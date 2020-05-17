import { html, PolymerElement } from '@polymer/polymer/polymer-element.js'
import * as _ from 'underscore'
import { color_stops } from './color.js'
import * as utils from './utils.js'

/**
 * `heatmap-element`
 * heatmap for oTree Visual Markets
 *
 * @customElement
 * @polymer
 * @demo demo/index.html
 */
class HeatmapElement extends PolymerElement {
  static get template () {
    return html`
      <style>
        canvas {
          border: 1px solid #000000;
        }
        :host {
          display: block;
        }
      </style>
      
      <canvas id="heatmapCanvas" height="400" width="400">
      </canvas>
    `
  }

  static get properties () {
    return {
      color: {
        type: String,
        observer: 'generate_heatmap'
      },
      utility_function: {
        type: Object,
        value: function () {
          return (x, y) => x ** 2 + y ** 3
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
      _currentUtility: {
        type: Number,
        notify: true,
        observer: 'define_current_curve'
      },
      _maxUtility: {
        type: Number,
        notify: true,
        observer: 'generate_heatmap'
      },
      _previousCurve: {
        type: Boolean,
        value: false
      },
      _initalState: {
        type: Object
      }

    }
  }

  constructor () {
    super()
    this.color = 'red'
    this.currentXAsset = 2
    this.currentYAsset = 2

    // Bind hover function
    this.addEventListener('mousemove', _.throttle(this.hover_curve.bind(event), 35))
  }

  /**
   * Calculates the utility for the user's current x and y asset values
   */
  get_current_util () {

    // Break if prerequisite variables not defined or if function already completed 
    if (!this.currentYAsset || !this.currentXAsset || this._currentUtility) {
      return
    }
    this._currentUtility = this.utility_function(this.currentXAsset, this.currentYAsset)
  }

  /**
   * Calculates the maximum utility possible withing the given x and y asset range
   */
  get_max () {
    
    // Break if prerequisite variables not defined or if function already completed 
    if (!this.minXAsset || !this.minYAsset || !this.maxYAsset || !this.maxXAsset || this._maxUtility) {
      return
    }
    
    
    // var t1 = performance.now() // Uncomment if performamnce testing is needed

    // Function Variables
    const step = 0.01   // Increase for faster start up, decrease for better accuracy
    var max = -1
    var temp = max

    // Do a brute force iteration over the domain
    for (var i = this.minXAsset; i <= this.maxXAsset; i += step) {
      for (var j = this.minYAsset; j <= this.maxYAsset; j += step) {
        
        // Calculate utility of current x and y assets
        temp = this.utility_function(i, j)
        if (temp > max) {
          max = temp
        }
      }
    }

    // Set max value, used for normalizing pixel heat intensity
    this._maxUtility = max


    // Uncomment if performamnce testing is needed
    // var t2 = performance.now()
    // console.log("end max: " + (t2-t1));
  }


  /**
   * Calculate the points used for the indiffernce curve
   * 
   * @param {Object} asset_bounds     min/max X and Y asset values
   * @param {Number} target_utility   indifference curve utility value
   * @param {Number} delta            acceptable difference from target
   * @param {Function} util_function  fucntion used to calculated utility
   * @param {Number} width            width of canvas
   * @param {Number} height           height of canvas
   * @return {Object Array}           points used for indifference curve
   */
  get_indiffernce_curve_points (asset_bounds, target_utility, delta, util_function, width, height) {
    
    // List of points that are within delta range of target_utility
    var points = []

    // Iterate top-down left-right
    // accoplishes left-right sorted fashion
    for (let col = 0; col < width; col++) {
      for (let row = 0; row < height; row++) {

        // Translate coords to x,y asset values
        // https://stackoverflow.com/questions/929103/convert-a-number-range-to-another-range-maintaining-ratio
        const pixel_x_value = ((col * (asset_bounds.maxXAsset - asset_bounds.minXAsset)) / width) + (asset_bounds.minXAsset);
        const pixel_y_value = (((height - row) * (asset_bounds.maxYAsset - asset_bounds.minYAsset)) / height) + (asset_bounds.minYAsset);

        // Call utility function
        const point_payoff = util_function(pixel_x_value, pixel_y_value);

        // Get differnce from target util
        var difference = Math.abs(point_payoff - target_utility);

        // Add to list if withing range
        if (difference < delta) {
          points.push({ x: col, y: row, payoff: point_payoff });
        }
      }
    }

    return points
  }

  // Taken from:
  // https://stackoverflow.com/questions/7054272/how-to-draw-smooth-curve-through-n-points-using-javascript-html5-canvas

  /**
   * Method used to draw an indiffernce curve
   * Idea taken from:
   *  https://stackoverflow.com/questions/7054272/how-to-draw-smooth-curve-through-n-points-using-javascript-html5-canvas
   * 
   * @param {*} context context of the canvas to be used
   * @param {*} points  array containing the points of the curve
   *                    format: [{x: Number, y: Number, payoff: Number}, ...]
   */
  draw_indifference_curve (context, points) {
    context.beginPath()
    context.moveTo((points[0].x), points[0].y)

    for (var i = 0; i < points.length - 1; i++) {
      var x_mid = (points[i].x + points[i + 1].x) / 2;
      var y_mid = (points[i].y + points[i + 1].y) / 2;
      var cp_x1 = (x_mid + points[i].x) / 2;
      var cp_x2 = (x_mid + points[i + 1].x) / 2;
      context.quadraticCurveTo(cp_x1, points[i].y, x_mid, y_mid);
      context.quadraticCurveTo(cp_x2, points[i + 1].y, points[i + 1].x, points[i + 1].y);
    }
    context.stroke();
  }

  /**
   * Create an indifference curve for the user's currently selected asset values
   */
  define_current_curve () {
    if (!this._currentUtility) {
      return;
    }

    // Uncomment for performace testing
    // var t1 = performance.now(); 
    
    // Select canvas element
    const canvas = this.$.heatmapCanvas;
    const context = canvas.getContext('2d');
    
    // Create object of asset boundaries
    const asset_bounds = {
      maxXAsset: this.maxXAsset,
      minXAsset: this.minXAsset,
      maxYAsset: this.maxYAsset,
      minYAsset: this.minYAsset
    }
    
    // Calculate points on curve
    const points = this.get_indiffernce_curve_points(asset_bounds, this._currentUtility, 0.3, this.utility_function, canvas.width, canvas.height);

    // Draw the indiffernce curve
    this.draw_indifference_curve(context, points);

    // Create a baseline for the orginal graph, used for erasing hover curves
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    this._initalState = imageData;
    
    // Uncomment for performace testing
    // var t2 = performance.now();
    // console.log("end curve: " + (t2-t1));
  }

  /**
   * Erase old hover curve
   * @param {*} element replacement for keyword "this"
   * @param {*} context canvas context
   * @param {*} points  points 
   * @param {*} w 
   * @param {*} h 
   */
  erase_old_hover_curve (element, context) {
    context.putImageData(element._initalState, 0, 0);
  }

  /**
   * Generate indiffernce curve based on current mouse position
   * 
   * @param {*} e mousemove event
   */
  hover_curve (e) {
    
    // function variables
    const element = e.target;
    const bounds = element.getBoundingClientRect();
    const canvas = element.$.heatmapCanvas;
    const context = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const x = (e.pageX - bounds.left);
    const y = (e.pageY - bounds.top);

    const pixel_x_value = ((x * (element.maxXAsset - element.minXAsset)) / w) + (element.minXAsset);
    const pixel_y_value = (((h - y) * (element.maxYAsset - element.minYAsset)) / h) + (element.minYAsset);

    // Hover is out of bounds
    // Happens occasionally when first entering bounds
    if (pixel_x_value < element.minXAsset || pixel_x_value > element.maxXAsset ||
      pixel_y_value < element.minYAsset || pixel_y_value > element.maxYAsset) {
      return;
    }

    // Utility of current mouse position
    const utility = element.utility_function(pixel_x_value, pixel_y_value);

    // Create object of asset boundaries
    const asset_bounds = {
      maxXAsset: element.maxXAsset,
      minXAsset: element.minXAsset,
      maxYAsset: element.maxYAsset,
      minYAsset: element.minYAsset
    }

    // Calculate points on curve
    const points = element.get_indiffernce_curve_points(asset_bounds, utility, 0.3, element.utility_function, w, h);

    // If a hover curve is displayed alreay erase it
    if (element._previousCurve) {
      element.erase_old_hover_curve(element, context, element._previousCurve, w, h);
    } else {
      element._previousCurve = true;
    }
    // Draw hover curve
    element.draw_indifference_curve(context, points);
  }

  // 
  /**
   * gets colors from the gradient defined by the color stops above
   * 0.0 <= percent <= 1.0
   * where percent = 1.0 gets the last color in color_stops and percent = 0.0 gets the first color in color_stops
   * 
   * @param {*} percent       curr_payoff / max payoff
   * @param {*} color_scheme  color scheem of gradient
   */
  get_gradient_color (percent, color_scheme) {
    const scheme = color_stops[color_scheme]
    if (typeof (scheme[0][0]) === 'number') {
      percent = percent * (scheme.length - 1)
      const low_index = Math.floor(percent)
      const high_index = Math.ceil(percent)
      percent = percent - low_index

      try {
        return [0, 1, 2].map(i => percent * scheme[high_index][i] +
            (1 - percent) * scheme[low_index][i])
      } catch (e) {
        return [255, 120, 210]
      }
    }
    for (let i = 0; i < scheme.length - 1; i++) {
      const curr_stop = scheme[i][1]
      const next_stop = scheme[i + 1][1]
      if (percent >= curr_stop && percent <= next_stop) {
        const low_color = scheme[i][0]
        const high_color = scheme[i + 1][0]
        const interp = 1 - ((percent - curr_stop) / (next_stop - curr_stop))
        return [0, 1, 2].map(i => interp * low_color[i] + (1 - interp) * high_color[i])
      }
    }
    return scheme[scheme.length - 1][0]
  }

  /**
   * Generate the heatmap for the given utility function
   */
  generate_heatmap () {
    
    
    // return if variables are not yet initialized
    if (!this.color || !this._maxUtility) {
      return
    }
    
    // Uncomment for performance testing
    // var t1 = performance.now()

    const canvas = this.$.heatmapCanvas
    const w = canvas.width
    const h = canvas.height
    const ctx = canvas.getContext('2d')

    // const max_payoff = this.get_max(this.utility_function, this.minXAsset, this.minY, this.maxXAsset, this.maxYAsset, 1);
    const max_payoff = this._maxUtility

    // create empty imageData object
    const imageData = ctx.createImageData(w, h)
    const data = imageData.data

    // iterate through every pixel in the image in row major order
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        // Get the current pixel's x and y asset values, based on:
        // https://stackoverflow.com/questions/929103/convert-a-number-range-to-another-range-maintaining-ratio
        const pixel_x_value = ((col * (this.maxXAsset - this.minXAsset)) / w) + (this.minXAsset)
        const pixel_y_value = (((h - row) * (this.maxYAsset - this.minYAsset)) / h) + (this.minYAsset)

        // Call utility function
        const point_payoff = this.utility_function(pixel_x_value, pixel_y_value)

        // divide the payoff by the max payoff to get an color intensity percentage
        // use get_gradient_color to get the appropriate color in the gradient for that percentage
        var percent = point_payoff / max_payoff

        // Get pizel coloring
        const point_color = this.get_gradient_color(percent, this.color)

        // set imageData for this pixel to the calculated color
        const index = (row * w * 4) + (col * 4)
        data[index] = point_color[0]
        data[index + 1] = point_color[1]
        data[index + 2] = point_color[2]
        // set alpha channel to fully opaque
        data[index + 3] = 255
      }
    }

    // Display heatmap
    ctx.putImageData(imageData, 0, 0)
    
    // Uncomment for performance testing
    // var t2 = performance.now()
    // console.log('end heatmap: ' + (t2 - t1))
  }
}

window.customElements.define('heatmap-element', HeatmapElement)
