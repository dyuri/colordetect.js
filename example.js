var cd = window.colordetect;

var handleCamera = function (video) {
  var tracker = new cd.Tracker(video),
      canvas = tracker.canvas;

  tracker.start();
  tracker.showCanvas();

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

    var ct = new cd.ColorTracking(color, function (color, tracker) {
      color.searchAndMarkOld(tracker.canvas);
    });

    tracker.addTracking(ct, "test");

  });
};

cd.getCamera(handleCamera);
