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
  Color.prototype.similar = function (color, hdiff, sdiff, ldiff) {
    // hue - max 0.01 difference
    // saturation - max 0.2 difference
    var hsl1 = this.toHsl(), hsl2 = color.toHsl();
    hdiff = hdiff || 0.01;
    sdiff = sdiff || 0.2;
    ldiff = ldiff || 0.5;

    return Math.abs(hsl1[0] - hsl2[0]) < hdiff && Math.abs(hsl1[1] - hsl2[1]) < sdiff && Math.abs(hsl1[2] - hsl2[2]) < ldiff;
  };

  /**
   * "Difference" between colors
   * @param {Color} color the color to compare
   * @return {number} the difference
   */
  Color.prototype.diff = function (color) {
    var hsl1 = this.toHsl(),
        hsl2 = color.toHsl();

    return Math.abs(hsl1[0] - hsl2[0]) * 10 + Math.abs(hsl1[1] - hsl2[1]);
  };

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
    var i, j, c, tempc, go,
        direction, // 1: y, -1: -y
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
    go = true;
    i = x; j = y;
    top = y - radius;
    bottom = y + radius;
    left = x - radius;
    right = x + radius;
    blocks.push({x: i, y: j, color: c, radius: radius});
    direction = -1;

    while (go) {
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
        if (j < top) {
          direction = +1;
        }
      } else if (direction > 0) {
        if (j > bottom) { 
          if (i < right) {
            c = Color.average(colors);
            direction = -1;
            i += radius * 2;
            j = parseInt((top + bottom) / 2, 10);
          } else {
            go = false;
          }
        }
      } else {
        go = false;
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
  Color.prototype.searchAndMarkOld = function (canvas) {
    var ctx = canvas.getContext('2d'),
        imgData = ctx.getImageData(0, 0, canvas.width, canvas.height),
        x, y, border = 10,
        radius = 3,
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
    this.canvas.style.display = "block";
  };

  /**
   * TODO hide w/ popup?
   */
  Tracker.prototype.hideCanvas = function () {
    this.canvas.style.display = "none";
  };

  /**
   * color tracking algorithm wrapper objects
   * @constructor
   * @param {Color} color tracked color
   * @param {function(Color, Tracker, Object=)} fun tracking function
   * @param {Object=} config configuration passed to the tracking function
   * @param {function=} callback callback function called with the result of the tracking function
   */
  var ColorTracking = ns.ColorTracking = function (color, fun, config, callback) {
    this.color = color;
    this.fun = fun;
    this.config = config;
    this.callback = callback;
  };

  /**
   * run the algorithm, call the callback
   * @param {Tracker} tracker
   */
  ColorTracking.prototype.run = function (tracker) {
    var result = this.fun(this.color, tracker, this.config);

    if (this.callback) {
      this.callback(result);
    }
  };

}(window));
