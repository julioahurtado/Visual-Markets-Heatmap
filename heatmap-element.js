import { html, PolymerElement } from '@polymer/polymer/polymer-element.js'
import * as _ from 'underscore'
import * as ms from 'marchingsquares'
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
      
      <canvas id="heatmapCanvas" height="400" width="550">
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
      },
      _dataQuadTree: {
        type: Object
      },
      _old_line:{
        type: Array
      }

    }
  }

  constructor () {
    super()
    this.color = 'red'
    this.currentXAsset = 4
    this.currentYAsset = 1.5

    // Bind hover function
    this.addEventListener('mousemove', _.throttle(this.hover_curve.bind(event), 50))
    this.addEventListener('mouseout', _.throttle(this.mouse_leave.bind(event), 35))
  }

  /**
   * Clear hover cure on mouse curve
   * 
   * @param {Event} e JS event 'mouseout'
   */
  mouse_leave (e) {
    const element = e.target
    if (!element._previousCurve) {
      return
    }

    const canvas = element.$.heatmapCanvas
    const context = canvas.getContext('2d')

    element.erase_old_hover_curve(element, context)
    element._previousCurve = false
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
    const step = 0.01 // Increase for faster start up, decrease for better accuracy
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
   * Draw contour line (indiffernce curve) using the marching sqaures algorithm
   * 
   * @param {Object} element replacement for keyword "this"
   * @param {Number} threshold Threshold limit for marching squares algorithm
   */
  draw_countour_line(element, threshold){
    var t1 = performance.now()
    var points = ms.isoLines(element._dataQuadTree, threshold);
    const canvas = element.$.heatmapCanvas 
    const w = canvas.width
    const h = canvas.height
    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data

    for(var i = 0; i < points[0].length; i++){
      
      // Skip border indexes
      if(h - Math.ceil(points[0][i][1]) <= 1 || Math.floor(points[0][i][0]) === 0 || (w - Math.ceil(points[0][i][0])) <= 1){
        continue;
      }
      const index = (Math.floor(points[0][i][1]) * w * 4) + (Math.floor(points[0][i][0]) * 4)

      data[index] = 0
      data[index + 1] = 0
      data[index + 2] = 0
      // set alpha channel to fully opaque
      data[index + 3] = 255
    }
    ctx.putImageData(imageData, 0, 0)
    var t2 = performance.now()
    console.log('end countour: ' + (t2 - t1))
  }


  /**
   * Create an indifference curve for the user's currently selected asset values
   */
  define_current_curve () {
    if (!this._currentUtility) {
      return
    }

    // Uncomment for performace testing
    // var t1 = performance.now();

    // Select canvas element
    const canvas = this.$.heatmapCanvas
    const context = canvas.getContext('2d')

    // Create object of asset boundaries
    const asset_bounds = {
      maxXAsset: this.maxXAsset,
      minXAsset: this.minXAsset,
      maxYAsset: this.maxYAsset,
      minYAsset: this.minYAsset
    }

    // Draw the indiffernce curve
    this.draw_countour_line(this,this._currentUtility)

    // Create a baseline for the orginal graph, used for erasing hover curves
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    this._initalState = imageData

    // Uncomment for performace testing
    // var t2 = performance.now();
    // console.log("end curve: " + (t2-t1));
  }

  /**
   * Erase old hover curve. takes ~.3ms
   * @param {*} element replacement for keyword "this"
   * @param {*} context canvas context
   */
  erase_old_hover_curve (element, context) {
    // var t1 = performance.now() // Uncomment if performamnce testing is needed
    context.putImageData(element._initalState, 0, 0)
    // var t2 = performance.now() // Uncomment if performamnce testing is needed
    // console.log('Erase curve: ' + (t2 - t1))
  }

  /**
   * Generate indiffernce curve based on current mouse position
   *
   * @param {*} e mousemove event
   */
  hover_curve (e) {
    // function variables
    // var t1 = performance.now() // Uncomment if performamnce testing is needed
    const element = e.target
    const bounds = element.getBoundingClientRect()
    const canvas = element.$.heatmapCanvas
    const context = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    const x = (e.pageX - bounds.left)
    const y = (e.pageY - bounds.top)

    var pixel_x_value = ((x * (element.maxXAsset - element.minXAsset)) / w) + (element.minXAsset)
    var pixel_y_value = (((h - y) * (element.maxYAsset - element.minYAsset)) / h) + (element.minYAsset)

    // Hover is out of bounds
    // Happens occasionally when first entering bounds
    if (pixel_x_value < element.minXAsset || pixel_x_value > element.maxXAsset ||
      pixel_y_value < element.minYAsset || pixel_y_value > element.maxYAsset) {
      return
    }

    // Utility of current mouse position
    const utility = element.utility_function(pixel_x_value, pixel_y_value)


    // If a hover curve is displayed alreay erase it
    if (element._previousCurve) {
      element.erase_old_hover_curve(element, context, element._previousCurve, w, h)
    } else {
      element._previousCurve = true
    }
    // Draw hover curve
    element.draw_countour_line(element, utility)
    // var t2 = performance.now()
    // console.log("Hover curve: " + (t2-t1));
  }

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

    const max_payoff = this._maxUtility

    // create empty imageData object
    const imageData = ctx.createImageData(w, h)
    const data = imageData.data
    var msData = []
    // iterate through every pixel in the image in row major order
    for (let row = 0; row < h; row++) {
      msData.push([])
      for (let col = 0; col < w; col++) {
        // Get the current pixel's x and y asset values, based on:
        // https://stackoverflow.com/questions/929103/convert-a-number-range-to-another-range-maintaining-ratio
        var pixel_x_value = ((col * (this.maxXAsset - this.minXAsset)) / w) + (this.minXAsset)
        var pixel_y_value = (((h - row) * (this.maxYAsset - this.minYAsset)) / h) + (this.minYAsset)

        // Call utility function
        const point_payoff = this.utility_function(pixel_x_value, pixel_y_value)
        msData[row].push(point_payoff)
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

    // Perform preprocessing for improved performance in further calls
    this._dataQuadTree = new ms.QuadTree(msData);

    // Uncomment for performance testing
    // var t2 = performance.now()
    // console.log('end heatmap: ' + (t2 - t1))
  }
}

window.customElements.define('heatmap-element', HeatmapElement)
