(function (w) {
  var ns = w.colordetect = w.colordetect || {};

  var requestAnimationFrame = ns.requestAnimationFrame = window.requestAnimationFrame || 
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (cb) { window.setTimeout(cb, 1000 / 60); };

  var getUserMedia = ns.getUserMedia = (
    navigator.getUserMedia && navigator.getUserMedia.bind(navigator) ||
    navigator.webkitGetUserMedia && navigator.webkitGetUserMedia.bind(navigator) ||
    navigator.mozGetUserMedia && navigator.mozGetUserMedia.bind(navigator) ||
    navigator.msGetUserMedia && navigator.msGetUserMedia.bind(navigator));

  /**
   * creates a new video tag with the content of the webcam
   * @param {function(HTMLElement=)} callback will be called upon success with the <video> element or with no parameter on error
   */
  ns.getCamera = function (cb) {
    getUserMedia(
      { video: true },
      function (localMediaStream) {
        var video = document.createElement("video");

        video.src = window.URL && window.URL.createObjectURL(localMediaStream) || localMediaStream;
        video.width = 640;
        video.height = 480;
        video.style.display = "none";
        video.autoplay = true;
        
        document.body.appendChild(video);

        cb(video);
      },
      function (err) {
        console.log("The following error occured during opening webcam: "+err);
        cb();
      }
    );
  };

  /**
   * Color class
   * @constructor
   * @param {number} r red component (0-255)
   * @param {number} g green component (0-255)
   * @param {number} b blue component (0-255)
   * @param {number=} a alpha
   */
  var Color = ns.Color = function (r, g, b, a) {
    this.red = parseInt(r, 10);
    this.green = parseInt(g, 10);
    this.blue = parseInt(b, 10);
    this.alpha = parseFloat(a || 1);
  };

  /**
   * check if the color is valid
   * @return {boolean}
   */
  Color.prototype.isValid = function () {
    return this.red >= 0 && this.red <= 255 && 
           this.green >= 0 && this.green <= 255 &&
           this.blue >= 0 && this.blue <= 255 &&
           this.alpha <= 1 && this.alpha >= 0;
  };

  /**
   * toString for colors
   * @return {string}
   */
  Color.prototype.toString = function () {
    if (this.alpha !== 1) {
      return "rgba("+([this.red, this.green, this.blue, this.alpha].join(", "))+")";
    } else {
      return "rgb("+([this.red, this.green, this.blue].join(", "))+")";
    }
  };

  /**
   * return the complementer color
   * @return {Color}
   */
  Color.prototype.invert = function () {
    return new Color(255-this.red, 255-this.green, 255-this.blue, this.alpha);
  };

  /**
   * Hex code of the color
   * @return {string} the hex code
   */
  Color.prototype.toHex = function () {
    var r = this.red >= 16 ? this.red.toString(16) : '0'+this.red.toString(16),
        g = this.green >= 16 ? this.green.toString(16) : '0'+this.green.toString(16),
        b = this.blue >= 16 ? this.blue.toString(16) : '0'+this.blue.toString(16);
    
    return '#'+r+g+b;
  };
  
  /**
   * HSL values of the color
   * @return {Array.<number>} [hue, saturation, lightning]
   */
  Color.prototype.toHsl = function () {
    // caching
    if (this.h && this.s && this.l) {
      return [this.h, this.s, this.l];
    }

    var r = this.red / 255,
        g = this.green / 255,
        b = this.blue / 255,
        max = Math.max(r, g, b), min = Math.min(r, g, b),
        d, h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch(max){
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
        }
        h = h / 6;
    }

    this.h = h;
    this.s = s;
    this.l = l;
    return [h, s, l];
  };

  /**
   * Compares two color objects if they are similar depending on the given parameters
   * @param {Color} color the color to compare
   * @param {number=} hdiff max hue difference
   * @param {number=} sdiff max saturation difference
   * @param {number=} ldiff max lightness difference
   * @return {boolean} true if they are similar, false otherwise
   */
  Color.prototype.similarHsl = function (color, hdiff, sdiff, ldiff) {
    // hue - max 0.01 difference
    // saturation - max 0.2 difference
    var hsl1 = this.toHsl(), hsl2 = color.toHsl();
    hdiff = hdiff || 0.01;
    sdiff = sdiff || 0.2;
    ldiff = ldiff || 0.5;

    return Math.abs(hsl1[0] - hsl2[0]) < hdiff && Math.abs(hsl1[1] - hsl2[1]) < sdiff && Math.abs(hsl1[2] - hsl2[2]) < ldiff;
  };

  /**
   * Compares two color based on YUV values
   * @param {Color} color
   */

  /**
   * Compares two color based on RGB values
   * not as good as similarHsl, but much quicker
   * @param {Color} color
   * @param {number=} threshold
   */
  Color.prototype.similarRgb = function (color, threshold) {
    threshold = threshold || 40;
    return this.diff(color) < threshold;
  };

  Color.prototype.similar = Color.prototype.similarHsl;

  /**
   * counts the similar pixels on a canvas
   * returns if optional maximum value reached
   * @param {HTMLCanvasElement} canvas
   * @param {number=} max
   * @return {number}
   */
  Color.prototype.countSimilars = function (canvas, max) {
    var ctx = canvas.getContext("2d"),
        imgData = ctx.getImageData(0, 0, canvas.width, canvas.height),
        data = imgData.data,
        i, tmpc, num = 0;
    
    for (i = 0; i < data.length; i+=4) {
      tmpc = new Color(data[i], data[i+1], data[i+2]);
      if (tmpc.similar(this)) {
        num++;
        if (max && num >= max) {
          break;
        }
      }
    }

    return max ? (num >= max) : num;
  };

  /**
   * "Difference" between colors
   * @param {Color} color the color to compare
   * @return {number} the difference
   */
  Color.prototype.diffHsl = function (color) {
    var hsl1 = this.toHsl(),
        hsl2 = color.toHsl();

    return Math.abs(hsl1[0] - hsl2[0]) * 10 + Math.abs(hsl1[1] - hsl2[1]);
  };

  /**
   * "Difference" between colors, based on rgb values
   * @param {Color} color the color to compare
   * @return {number} the difference
   */
  Color.prototype.diffRgb = function (color) {
    var rd = this.red - color.red,
        gd = this.green - color.green,
        bd = this.blue - color.blue;

    return Math.sqrt(rd*rd + gd*gd + bd*bd);
  };

  Color.prototype.diff = Color.prototype.diffRgb;

  /**
   * Return a new color object with the "average color" of the given list
   * @param {Array.<Color>} clist list of colors
   * @return {Color} the average color
   */
  Color.average = function (clist) {
    var r = 0, g = 0, b = 0, i, l = clist.length;

    for (i = 0; i < l; i++) {
      r += clist[i].red;
      g += clist[i].green;
      b += clist[i].blue;
    }

    return new Color(r/l, g/l, b/l);
  };

  /**
   * An area of similar colors matching a reference color
   * @constructor
   * @param {number} left
   * @param {number} top
   * @param {number} right
   * @param {number} bottom
   * @param {Color} refColor
   * @param {Array.<Color>} colors
   */
  var Match = ns.Match = function (left, top, right, bottom, refColor, colors) {
    this.color = Color.average(colors);
    this.refColor = refColor;
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
    this.width = right - left;
    this.height = bottom - top;
    this.weight = colors.length;
    this.diff = this.color.diff(refColor); // match "goodness" = weight / diff ??
  };

  /**
   * Checks the sourrundings of the given point if it matches the color
   * @param {ImageData} imgData
   * @param {number} x
   * @param {number} y
   * @param {number=} radius radius of checked subareas to speed up matching
   * @return {?Match}
   */
  Color.prototype.matchArea = function (imgData, x, y, radius) {
    var i, j, c, tempc,
        direction, // 1: y, -1: -y
        maxx = imgData.width,
        maxy = imgData.height,
        blocks = [], colors = [], top, bottom, left, right;

    radius = radius || 3;

    // check color
    c = getColor(imgData, x, y);
    if (!c || !c.similar(this)) {
      return null;
    }

    // check small area
    c = getRefColor(imgData, x, y, radius);
    if (!c || !c.similar(this)) {
      return null;
    }

    colors.push(c);
    i = x; j = y;
    top = y - radius;
    bottom = y + radius;
    left = x - radius;
    right = x + radius;
    blocks.push({x: i, y: j, color: c, radius: radius});
    direction = -1;

    while (true) {
      j += 2 * radius * direction;
      tempc = getRefColor(imgData, i, j, radius);
      if (tempc && tempc.similar(c)) {
        colors.push(tempc);
        blocks.push({x: i, y: j, color: tempc, radius: radius});
        top = top <= j - radius ? top : j - radius;
        bottom = bottom >= j + radius ? bottom : j + radius;
        left = left <= i - radius ? left : i - radius;
        right = right >= i + radius ? right : i + radius;
      } else if (direction < 0) {
        if (j < top || j <= 0) {
          direction = +1;
        }
      } else if (direction > 0) {
        if (j > bottom || j >= maxy) { 
          if (i < right && i < (maxx - radius * 2) ) {
            c = Color.average(colors);
            direction = -1;
            i += radius * 2;
            j = parseInt((top + bottom) / 2, 10);
          } else {
            break;
          }
        }
      } else {
        break;
      }
    }

    return new Match(left, top, right, bottom, this, colors);
  };

  /**
   * get color from the given position of an imgData object
   * @param {ImageData} imgData
   * @param {number} x
   * @param {number} y
   * @return {Color}
   */
  var getColor = ns.getColor = function (imgData, x, y) {
    var offset = y*imgData.width*4 + x*4;
    return new Color(imgData.data[offset], imgData.data[offset+1], imgData.data[offset+2]);
  };

  /**
   * set color of the given position of an imgData object
   * @param {ImageData} imgData
   * @param {number} x
   * @param {number} y
   * @param {Color} color
   */
  var setColor = ns.setColor = function (imgData, x, y, color) {
    var offset = y*imgData.width*4 + x*4;
    imgData.data[offset] = color.red;
    imgData.data[offset+1] = color.green;
    imgData.data[offset+2] = color.blue;
  };

  /**
   * get the average color from the given area of an imgData object
   * @param {ImageData} imgData
   * @param {number} x
   * @param {number} y
   * @param {number=} radius radius of the area
   * @return {Color}
   */
  var getRefColor = ns.getRefColor = function (imgData, x, y, radius) {
    var i, j, cl = [];

    radius = radius || 3;

    for (i = x-radius; x+radius >= i; i++) {
      for (j = y-radius; y+radius >= j; j++) {
        cl.push(getColor(imgData, i, j));
      }
    }

    return Color.average(cl);
  };

  /**
   * Old search&mark method
   * @param {HTMLCanvas} canvas
   * @deprecated
   */
  Color.prototype.searchAndMarkOld = function (canvas, config) {
    var ctx = canvas.getContext('2d'),
        imgData = ctx.getImageData(0, 0, canvas.width, canvas.height),
        x, y, border = 10,
        radius = config && config.radius || 3,
        minmatch = config && config.minmatch,
        matches = [], i, l, m, bestm, bestmgoodness = 0;

    // TODO: overlapping matches?

    for (x = border; x < canvas.width - border; x = x + radius) {
      for (y = border; y < canvas.width - border; y = y + radius) {
        
        for (i = 0, l = matches.length; i < l; i++) {
          m = matches[i];
          if (y >= m.top && y <= m.bottom && x >= m.left && x <= m.right) {
            y = m.bottom + radius;
          }
        }

        m = this.matchArea(imgData, x, y, radius);
        if (m) {
          
          if (minmatch && m.weight >= minmatch) {
            return m;
          }

          matches.push(m);
          if (m.weight > bestmgoodness) {
            bestm = m;
            bestmgoodness = m.weight;
          }
        }
      }
    }

    if (bestm) {
      ctx.strokeStyle = this.invert().toHex();
      ctx.strokeRect(bestm.left, bestm.top, bestm.width, bestm.height);
    }

    return bestm;
  };

  /**
   * basic infrastructure to track colors
   * @constructor
   * @param {HTMLElement} video
   */
  var Tracker = ns.Tracker = function (video) {
    if (!video) {
      throw "Video tag should not be null!";
    }

    this.video = video;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");

    this.canvas.width = this.video.width;
    this.canvas.height = this.video.height;
    this.canvas.style.display = "none";
    this.canvas.classList.add("cd_flippedCanvas");
    document.body.appendChild(this.canvas);

    this.tracking = {};

    this.boundUpdate = this.update.bind(this);
  };

  /**
   * add color tracking algorithm to the tracker
   * replaces the old ct with the same id
   * @param {ColorTracking} ct color tracking algorithm
   * @param {string} ctid id
   */
  Tracker.prototype.addTracking = function (ct, ctid) {
    this.tracking[ctid] = ct;
  };

  /**
   * remove color tracking algorithm from tracker
   * @param {string} ctid tracking id to remove
   * @return {ColorTracking} color tracker instance
   */
  Tracker.prototype.removeTracking = function (ctid) {
    var ct = this.tracking[ctid];
    
    delete this.tracking[ctid];
    
    return ct;
  };

  /**
   * run the color tracking algorithms
   */
  Tracker.prototype.track = function () {
    var ctid;

    for (ctid in this.tracking) {
      if (this.tracking.hasOwnProperty(ctid)) {
        this.tracking[ctid].run(this);
      }
    }
  };

  /**
   * start tracking
   */
  Tracker.prototype.start = function () {
    this.running = true;
    this.update();
  };

  /**
   * stop tracking
   */
  Tracker.prototype.stop = function () {
    this.running = false;
  };

  /**
   * copies the content of the given video tag onto a canvas
   */
  Tracker.prototype.update = function () {
    if (this.running) {
      this.ctx.drawImage(this.video, 0, 0);

      this.track();

      requestAnimationFrame(this.boundUpdate);
    }
  };

  /**
   * TODO show in popup?
   */
  Tracker.prototype.showCanvas = function () {
    var overlay = document.getElementById("cd_canvasOverlay"),
        holder = document.getElementById("cd_canvasHolder");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "cd_canvasOverlay";
      overlay.style.display = "block";
      document.body.appendChild(overlay);
    }

    if (!holder) {
      holder = document.createElement("div");
      holder.id = "cd_canvasHolder";
      overlay.appendChild(holder);
    }

    holder.appendChild(this.canvas);

    this.canvas.style.display = "block";
  };

  /**
   * TODO hide w/ popup?
   */
  Tracker.prototype.hideCanvas = function () {
    var overlay = document.getElementById("cd_canvasOverlay"),
        holder = document.getElementById("cd_canvasHolder");

    if (overlay) {
      overlay.style.display = "none";
    }

    if (holder) {
      holder.removeChild(this.canvas);
    }

    this.canvas.style.display = "none";
  };

  /**
   * color tracking algorithm wrapper objects
   * @constructor
   * @param {Color} color tracked color
   * @param {function(Color, Tracker, Object=)} fun tracking function
   * @param {function=} callback callback function called with the result of the tracking function
   * @param {Object=} config configuration passed to the tracking function
   */
  var ColorTracking = ns.ColorTracking = function (color, fun, callback, config) {
    this.color = color;
    this.fun = fun;
    this.callback = callback;
    this.config = config;
  };

  /**
   * run the algorithm, call the callback
   * @param {Tracker} tracker
   */
  ColorTracking.prototype.run = function (tracker) {
    var result = this.fun.call(this, this.color, tracker, this.config);

    if (this.callback) {
      this.callback(result);
    }
  };

  /**
   * Example algorithms
   */
  var algorithms = ns.algorithms = ns.algorithms || {};

  /**
   * simple pager
   * checks the top/left/right 15% of the image for the specified color
   * @param {Tracker} tracker
   * @return {Object} object containing which area is active (top/left/right/bottom)
   * example: { top: false, left: true, right: false, bottom: true }
   */
  algorithms.simplepager = function (color, tracker, config) {
    var canvas = tracker.canvas,
        threshold = config.threshold || 30;

    if (!this.ctop) {
      this.ctop = document.createElement("canvas");
      // 15% top, 1/4 resolution
      this.ctop.width = 160;
      this.ctop.height = 18;
      this.ctopctx = this.ctop.getContext("2d");
    }

    if (!this.cbottom) {
      this.cbottom = document.createElement("canvas");
      // 15% bottom, 1/4 resolution
      this.cbottom.width = 160;
      this.cbottom.height = 18;
      this.cbottomctx = this.cbottom.getContext("2d");
    }

    if (!this.cleft) {
      this.cleft = document.createElement("canvas");
      // 15% left, 1/4 resolution
      this.cleft.width = 24;
      this.cleft.height = 120;
      this.cleftctx = this.cleft.getContext("2d");
    }

    if (!this.cright) {
      this.cright = document.createElement("canvas");
      // 15% right, 1/4 resolution
      this.cright.width = 24;
      this.cright.height = 120;
      this.crightctx = this.cright.getContext("2d");
    }

    /* TODO
     * replace searchAndMarkOld with something better
     */

    this.ctopctx.drawImage(canvas, 0, 0, 640, 72, 0, 0, 160, 18);
    this.topmatch = color.countSimilars(this.ctop, threshold);

    this.cbottomctx.drawImage(canvas, 0, 408, 640, 72, 0, 0, 160, 18);
    this.bottommatch = color.countSimilars(this.cbottom, threshold);

    this.cleftctx.drawImage(canvas, 0, 0, 96, 480, 0, 0, 24, 120);
    this.leftmatch = color.countSimilars(this.cleft, threshold);

    this.crightctx.drawImage(canvas, 544, 0, 96, 480, 0, 0, 24, 120);
    this.rightmatch = color.countSimilars(this.cright, threshold);

    return {
      top: !!this.topmatch,
      bottom: !!this.bottommatch,
      left: !!this.leftmatch,
      right: !!this.rightmatch
    };
  };

}(window));
