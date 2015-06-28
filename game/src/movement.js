/*

Copyright (C) 2013 @mgechev Minko Gechev

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */
;(function (w) {
  'use strict';

  var Movement = {};

  Movement.constants = {
    WIDTH: 400,
    HEIGHT: 300,
    MOTION_LIMIT: 79680,
    MIN_FRAMES_WITHOUT_MOTION: 48,
    FRAME_RATE: 5,
    NOICE_DIFF: 15
  };

  Movement.movements = {
    STAND: 'stand',
    LEFT_ARM_UP: 'left-arm-up',
    RIGHT_ARM_UP: 'right-arm-up',
    ARMS_UP: 'arms-up',
    SQUAT_LEFT_ARM_UP: 'squat-left-arm-up',
    SQUAT_RIGHT_ARM_UP: 'squat-right-arm-up',
    LEFT_LEG_UP: 'left-leg-up',
    SQUAT: 'squat',
    EMPTY: 'empty',
    RIGHT_LEG_UP: 'right-leg-up'
  };

  Movement.positions = {
    LEFT: 'left',
    RIGHT: 'right',
    MIDDLE: 'middle',
    EMPTY: 'empty'
  };

  var Filters = {};

  Filters.getPixels = function(img) {
    var c = this.getCanvas(img.width, img.height),
      ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0,0,c.width,c.height);
  };

  Filters.getCanvas = function(w,h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };

  Filters.filterImage = function(filter, image, var_args) {
    var args = [this.getPixels(image)];
    for (var i=2; i<arguments.length; i++) {
      args.push(arguments[i]);
    }
    return filter.apply(null, args);
  };

  Filters.grayscale = function(pixels, args) {
    var d = pixels.data;
    for (var i=0; i<d.length; i+=4) {
      var r = d[i],
        g = d[i + 1],
        b = d[i + 2],
        v = 0.2126*r + 0.7152*g + 0.0722*b;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    return pixels;
  };

  Filters.threshold = function(pixels, threshold) {
    var d = pixels.data;
    for (var i=0; i<d.length; i+=4) {
      var r = d[i],
        g = d[i + 1],
        b = d[i + 2],
        v = (0.2126*r + 0.7152*g + 0.0722*b >= threshold) ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    return pixels;
  };

  Filters.difference = function(below, above) {
    var a = below.data,
      b = above.data,
      dst = a,
      f = 1/255;
    for (var i = 0; i < a.length; i += 4) {
      dst[i] = Math.abs(a[i] - b[i]);
      dst[i + 1] = Math.abs(a[i + 1] - b[i + 1]);
      dst[i + 2] = Math.abs(a[i + 2] - b[i + 2]);
      dst[i + 3] = a[i + 3] + ((255 - a[i + 3]) * b[i + 3]) * f;
    }
    return below;
  };

  Filters.horizontalIntensityStatistics = function (pixels) {
    var d = pixels.data,
      w = pixels.width,
      h = pixels.height,
      g = [],
      current;
    for (var i = 0; i < h; i += 1) {
      for (var j = 0; j < w; j += 1) {
        current = g[j] || 0;
        g[j] = current + d[(i * w * 4) + (j * 4)];
      }
    }
    return g;
  };

  Filters.verticalIntensityStatistics = function (pixels) {
    var d = pixels.data,
      w = pixels.width,
      h = pixels.height,
      g = [];
    for (var i = 0; i < h; i += 1) {
      g[i] = 0;
      for (var j = 0; j < w; j += 1) {
        g[i] += d[(i * w * 4) + (j * 4)];
      }
    }
    return g;
  };

  var vid,
      can,
      background,
      last,
      diffCanvas,
      initialized,
      previous = false,
      backgroundInitialized = false,
      lastPosition,
      lastMovement,
      framesWithoutMotion = 0,
      getUserMedia =
        navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia,
      URL = w.URL || w.webkitURL || w.mozURL;

  Movement.init = function (options) {
    var self = this;
    Movement.options = options;
    vid = document.createElement('video');
    document.body.appendChild(vid);
    vid.style.position = 'absolute';
    vid.style.visibility = 'hidden';
    vid.width = Movement.constants.WIDTH;
    vid.height = Movement.constants.HEIGHT;
    this._initCanvases();
    getUserMedia.call(navigator, { video: true }, function (stream) {
      if (!initialized) {
        initialized = true;
        vid.src = URL.createObjectURL(stream);
        vid.play();
        self._start();
      }
      initialized = true;
    }, function () {
      alert('Access forbidden');
    });
  };

  Movement._initCanvases = function () {
    can = document.createElement('canvas');
    document.body.appendChild(can);
    can.id = 'movementjs-main-canvas';
    can.style.position = 'absolute';
    can.style.visibility = 'visible';

    background = document.createElement('canvas');
    document.body.appendChild(background);
    background.style.position = 'absolute';
    background.style.visibility = 'hidden';

    last = document.createElement('canvas');
    document.body.appendChild(last);
    last.style.position = 'absolute';
    last.style.visibility = 'hidden';

    diffCanvas = document.createElement('canvas');
    document.body.appendChild(diffCanvas);
    diffCanvas.style.position = 'absolute';
    diffCanvas.style.visibility = 'hidden';

//    test1 = document.createElement('canvas');
//    document.body.appendChild(test1);
//
//    test2 = document.createElement('canvas');
//    document.body.appendChild(test2);

    diffCanvas.width = last.width = background.width = can.width = Movement.constants.WIDTH;
    diffCanvas.height = last.height = background.height = can.height = Movement.constants.HEIGHT;

//    test2.width = Movement.constants.HEIGHT * 2;
//    test2.height = 255;
//
//    test1.width = Movement.constants.WIDTH * 2;
//    test1.height = 255;
  };

  Movement._start = function () {
    var interval = 1000 / Movement.constants.FRAME_RATE,
      self = this;
    setInterval(function () {
      self._handleFrame();
    }, interval);
  };

  Movement._handleFrame = function () {
    if (!backgroundInitialized) {
      this._initializeBackground();
      backgroundInitialized = true;
    } else {
      this._processFrame();
    }
  };

  Movement._processFrame = function () {
    var data = Filters.filterImage(Filters.grayscale, vid);
    this._putData(can, data);
    data = Filters.filterImage(Filters.difference, can, this._getData(background));
    this._putData(can, data);
    data = Filters.filterImage(Filters.threshold, can, 50);
    this._putData(can, data);
    if (previous) {
      this._handleChanges();
    } else {
      previous = true;
    }
    last.getContext('2d').drawImage(can, 0, 0, can.width, can.height);
  };

  Movement._handleChanges = function () {
    var diff = Filters.filterImage(Filters.difference, can, this._getData(last)),
      diffStat;
    this._putData(diffCanvas, diff);
    diff = Filters.filterImage(Filters.threshold, diffCanvas, 50);
    this._putData(diffCanvas, diff);
    diffStat = Filters.filterImage(Filters.horizontalIntensityStatistics, can);
    if (this._activeGesture(diffStat)) {
      var diffH = Filters.filterImage(Filters.horizontalIntensityStatistics, can),
        diffV = Filters.filterImage(Filters.verticalIntensityStatistics, can),
        stand = this._stand(diffH),
        empty = this._sceneEmpty(diffH),
        currentMovement = this._recognizeGesture(diffH, diffV, stand, empty),
        currentPos = this._recognizePosition(diffH, diffV, stand, empty);
      this._triggerChanges(currentMovement, currentPos);
    }
  };

  Movement._triggerChanges = function (movement, position) {
    var o = Movement.options,
      callback;
    if (movement !== lastMovement) {
      callback = o.movementChanged;
      if (typeof callback === 'function') {
        callback.call(null, movement);
        lastMovement = movement;
      }
    }
    if (position !== lastPosition) {
      callback = o.positionChanged;
      if (typeof callback === 'function') {
        callback.call(null, position);
        lastPosition = position;
      }
    }
  };

  Movement._initializeBackground = function () {
    var currentData = Filters.filterImage(Filters.grayscale, vid);
    this._putData(background, currentData);
  };

  Movement._activeGesture = function (diff) {
    var changedPixels = 0;
    for (var i = 0; i < diff.length; i += 1) {
      changedPixels += diff[i];
    }
    if (changedPixels / 255 <= Movement.constants.MOTION_LIMIT) {
       framesWithoutMotion += 1;
    } else {
      framesWithoutMotion = 0;
    }
    if (framesWithoutMotion >= Movement.constants.MIN_FRAMES_WITHOUT_MOTION) {
      return true;
    }
    return false;
  };

  Movement._recognizePosition = function (diffH, diffV, stand, empty) {
    var p = this.positions;
    if (this._leftSide(diffH)) {
      return p.LEFT;
    } else if (this._rightSide(diffH)) {
      return p.RIGHT;
    } else if (stand || !empty) {
      return p.MIDDLE;
    } else {
      return p.EMPTY;
    }
  };

  Movement._recognizeGesture = function (diffH, diffV, stand, empty) {
    var leftHandUp,
      rightHandUp,
      limbDown,
      m = this.movements;

    if (empty) {
      return m.EMPTY;
    } else {
      leftHandUp = this._leftHandUp(diffH);
      rightHandUp = this._rightHandUp(diffH);
      if (stand) {
        if (leftHandUp || rightHandUp) {
          limbDown = this._limbDown(diffV);
          if (limbDown) {
            if (leftHandUp) {
              return m.LEFT_LEG_UP;
            } else if (rightHandUp) {
              return m.RIGHT_LEG_UP;
            }
          } else {
            if (leftHandUp && rightHandUp) {
              return m.ARMS_UP;
            } else if (leftHandUp) {
              return m.LEFT_ARM_UP;
            } else if (rightHandUp) {
              return m.RIGHT_ARM_UP;
            }
          }
        }
        return m.STAND;
      } else {
        if (leftHandUp) {
          return m.SQUAT_LEFT_ARM_UP;
        } else if (rightHandUp) {
          return m.SQUAT_RIGHT_ARM_UP;
        } else {
          return m.SQUAT;
        }
      }
    }
  };

// For testing purposes
//  function draw(d, c) {
//    var w = c.width,
//      h = c.height;
//    c = c.getContext('2d');
//    c.fillStyle = '#fff';
//    c.fillRect(0, 0, w, h);
//    c.fillStyle = '#000';
//    for (var i = 0; i < d.length; i += 1) {
//       c.fillRect(2 * i, 0, 2, d[i] / 400);
//    }
//    c.fillStyle = '#000';
//  }
//
  Movement._sceneEmpty = function (data) {
    var minDiff = Movement.constants.NOICE_DIFF,
      bigger = 0;
    for (var i = 0; i < data.length; i += 1) {
      if (data[i] / 255 > minDiff) {
        bigger += 1;
      }
    }
    return bigger > minDiff ? false : true;
  };

  Movement._stand = function (data) {
    var requiredHeight = Movement.constants.HEIGHT * 0.3,
      requiredWidth = Movement.constants.WIDTH * 0.1,
      middlePix = 0;
    for (var i = 0; i < data.length; i += 1) {
      if (data[i] / 255 >= requiredHeight) {
        middlePix += 1;
      }
    }
    return (middlePix >= requiredWidth) ? true : false;
  };

  Movement._armsUp = function (data) {
    var width = Movement.constants.WIDTH,
      height = Movement.constants.HEIGHT,
      middle = Math.floor(data.length / 2),
      left = middle,
      right = middle,
      minWidth = width * 0.8;
    for (var i = middle; i < data.length; i += 1) {
      if (data[i] / 255 > minWidth) {
        left -= 1;
        right += 1;
      }
      if (right - left > height * 0.04) {
        return true;
      }
    }
    return false;
  };

  Movement._rightHandUp = function (data) {
    var minHeight = Movement.constants.HEIGHT * 0.05,
      moved = 0;
    for (var i = 0; i < data.length * 0.6; i += 1) {
      if (data[i] / 255 >= minHeight) {
        moved += 1;
      }
    }
    return moved >= data.length / 2;
  };

  Movement._leftHandUp = function (data) {
    var minHeight = Movement.constants.HEIGHT * 0.05,
      moved = 0;
    for (var i = data.length - 1; i > data.length * 0.4; i -= 1) {
      if (data[i] / 255 >= minHeight) {
        moved += 1;
      }
    }
    return moved >= data.length / 2;
  };

  Movement._rightSide = function (data) {
    var minHeight = Movement.constants.HEIGHT * 0.2,
      moved = 0;
    for (var i = 0; i < data.length * 0.3; i += 1) {
      if (data[i] / 255 >= minHeight) {
        moved += 1;
      }
    }
    return moved >= data.length * 0.1;
  };

  Movement._leftSide = function (data) {
    var minHeight = Movement.constants.HEIGHT * 0.2,
      moved = 0;
    for (var i = data.length - 1; i >= data.length * 0.7; i -= 1) {
      if (data[i] / 255 >= minHeight) {
        moved += 1;
      }
    }
    return moved >= data.length * 0.1;
  };

  Movement._limbDown = function (data) {
    var down = 0,
        up = 0,
        armBoundry = Math.floor(data.length * 0.4),
        legBoundry = Math.floor(data.length * 0.7),
        i;

    for (i = armBoundry; i < legBoundry; i += 1) {
      up += data[i] / 255;
    }
    for (i = legBoundry; i < data.length; i += 1) {
      down += data[i] / 255;
    }
    return down > up;
  };

  Movement._putData = function (canvas, data) {
    canvas.getContext('2d').putImageData(data, 0, 0);
  };

  Movement._getData = function (canvas) {
    return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  };

  w.Movement = Movement;

}(window));
