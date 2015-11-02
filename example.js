var cd = window.colordetect;
var tracker;

var handleCamera = function (video) {
  var canvas;
  var copyCanvas = document.createElement('canvas');

  copyCanvas.id = "copyCanvas";
  copyCanvas.width = 640;
  copyCanvas.height = 480;

  document.body.appendChild(copyCanvas);

  tracker = new cd.Tracker(video);
  tracker.start();
  tracker.showCanvas();

  canvas = tracker.canvas;

  /* old search & mark */
  /*
  canvas.addEventListener('click', function (e) {
    var canvas = tracker.canvas,
        ctx = tracker.ctx,
        imgData, x, y, w, h;

    w = 32;
    h = 32;
    x = e.offsetX < w/2 ? 0 : (e.offsetX + w/2 >= canvas.width ? canvas.width-1-w : e.offsetX - w/2);
    y = e.offsetY < h/2 ? 0 : (e.offsetY + h/2 >= canvas.height ? canvas.height-1-h : e.offsetY - h/2);

    imgData = ctx.getImageData(x, y, w, h);

    var color = cd.getRefColor(imgData, w/2, w/2, 3);

    if (color) {
      console.log(color + " " + color.toHex() + " " + color.toHsl());
    }

    var ctosm = new cd.ColorTracking(color, function (color, tracker) {
      color.searchAndMarkOld(tracker.canvas);
    });

    tracker.addTracking(ctosm, "osm");

  });
  */

  /* pager */
  var debug = document.createElement('div');
  document.body.appendChild(debug);

  /* change pager color on mouse click */
  canvas.addEventListener('click', function (e) {
    var canvas = tracker.canvas,
        ctx = tracker.ctx,
        imgData, x, y, w, h;

    w = 32;
    h = 32;
    x = e.offsetX < w/2 ? 0 : (e.offsetX + w/2 >= canvas.width ? canvas.width-1-w : e.offsetX - w/2);
    y = e.offsetY < h/2 ? 0 : (e.offsetY + h/2 >= canvas.height ? canvas.height-1-h : e.offsetY - h/2);

    imgData = ctx.getImageData(x, y, w, h);

    var color = cd.getRefColor(imgData, w/2, w/2, 3);

    console.log(color + " " + color.toHex() + " " + color.toHsl());

    var ctpager = new cd.ColorTracking(
      color,
      cd.algorithms.simplepager,
      function (res) {
        if (res.top || res.left || res.right || res.bottom) {
          debug.innerHTML =
            (res.top && " top " || "") +
            (res.bottom && " bottom " || "") +
            (res.left && " left " || "") +
            (res.right && " right " || "");
        } else {
          debug.innerHTML = "";
        }
      },
      { threshold: 200 }
    );
    tracker.addTracking(ctpager, "simplepager");

    // snapshot on click
    var colorFn = function (cC, sC, fC, iData, cx, cy) {
      cd.setColor(iData, cx, cy, new cd.Color(255, 0, 0, .5));
    };
    var matcherFn = function (cC, sC, fC, iData, cx, cy) {
      return cC.similar(sC) && !(cC.alpha < 1);
    };
    copyCanvas.getContext('2d').putImageData(ctx.getImageData(0, 0, 640, 480), 0, 0);
    console.log(cd.histogram(copyCanvas.getContext('2d').getImageData(0, 0, 640, 480)));
  });

};

cd.getCamera(handleCamera);
