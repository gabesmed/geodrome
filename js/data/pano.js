var Pano = function() {
  this.panoData = null;
  this.depthData = null;
};

Pano.prototype.load = function(location) {
  var self = this;
  return this.fetchPano(location).then(function(panoData) {
    self.panoData = panoData;
    return self.fetchDepthMap(panoData.panoId);
  }).then(function(depthData) {
    self.depthData = depthData;
  });
};

Pano.prototype.fetchPano = function(location) {
  return new RSVP.Promise(function(resolve, reject) {
    var rawPanoData;
    var panoLoader = new GSVPANO.PanoLoader({zoom: 1});
    panoLoader.onPanoramaData = function(result) { rawPanoData = result; };
    panoLoader.onPanoramaLoad = function() {
      resolve({
        canvas: this.canvas,
        heading: rawPanoData.tiles.centerHeading,
        location: rawPanoData.location,
        panoId: this.panoId
      });
    };
    panoLoader.onError = function(errorMessage) {
      console.error(errorMessage);
      reject(errorMessage);
    };
    panoLoader.load(location);
  });
};

Pano.prototype.fetchDepthMap = function(panoId) {
  return new RSVP.Promise(function(resolve, reject) {
    var depthLoader = new GSVPANO.PanoDepthLoader();
    depthLoader.onDepthLoad = function() {
      resolve(this.depthMap);
    };
    depthLoader.onError = function(errorMessage) {
      console.error(errorMessage);
      reject(errorMessage);
    };
    depthLoader.load(panoId);
  });
};

Pano.prototype.getPoint = function(x, y) {
  // get depth
  var panoHeading = -twoPi * this.panoData.heading / 360.0;
  var depthX = Math.floor(x * this.depthData.width);
  var depthY = Math.floor(y * this.depthData.height);
  var depthIndex = depthY * this.depthData.width + depthX;
  var depth = this.depthData.depthMap[depthIndex];
  if(depth > 100000000) { return null; }

  // get angle
  var azimuth = (x * twoPi) + panoHeading;
  var altitude = Math.PI * (0.5 - y);
  var nx = -Math.cos(azimuth) * Math.cos(altitude);
  var ny = Math.sin(altitude);
  var nz = Math.sin(azimuth) * Math.cos(altitude);
  var n = new THREE.Vector3(nx, ny, nz);
  n.multiplyScalar(depth);
  return n;
};

Pano.prototype.getPoints = function() {
  var panoImage = this.panoData.canvas;
  var panoCtx = panoImage.getContext('2d');
  var panoImageData = panoCtx.getImageData(0, 0, panoImage.width,
    panoImage.height);

  // beta/lat, lambda/lng
  var raysLng = 120, raysLat = 60, lngIndex, latIndex;
  var panoX, panoY, panoIndex, c;
  var n, points = [];
  // var lngOffset = twoPi * (-this.panoData.heading / 360.0);
  for(lngIndex = 0; lngIndex < raysLng; lngIndex++) {
    for(latIndex = 1; latIndex <= raysLat * 0.51; latIndex++) {
      n = this.getPoint(lngIndex / raysLng, latIndex / raysLat);
      if(!n) { continue; }
      points.push(n);

      // calculate color
      panoX = Math.floor(lngIndex * panoImage.width / raysLng);
      panoY = Math.floor(latIndex * panoImage.height / raysLat);
      panoIndex = 4 * (panoY * panoImage.width + panoX);
      n.c = (panoImageData.data[panoIndex] << 16) +
        (panoImageData.data[panoIndex + 1] << 8) +
        panoImageData.data[panoIndex + 2];
    }
  }
  return points;
};

Pano.prototype.getPlanes = function() {
  var planes = [],
    depthMap = this.depthData.depthMap,
    dm, d0, d1, ym0, ym1, ym, lng0, lng1,
    x0mid, x1mid;
  ym = 0; // eye level is always at zero.
  this.depthData.planes.forEach(function(planeData) {
    // get distance to top (d0), bottom (d1), and eye-level (dm)
    dm = depthMap[ym * w + x];
    d0 = depthMap[Math.floor(planeData.x05y0 * h) * w + x];
    d1 = depthMap[Math.floor(planeData.x05y1 * h) * w + x];
    // figure out height from eye to top and eye to bottom
    // if d0 or d1 < dm, then it's higher, so height is positive.
    // otherwise it's lower than eye level so height is negative.
    ym0 = Math.sqrt(d0 * d0 - dm * dm) * (d0 < dm ? 1 : -1);
    ym1 = Math.sqrt(d1 * d1 - dm * dm) * (d1 < dm ? 1 : -1);
    // y top and y bottom in world coordinates.
    y0 = ym0 + ym;
    y1 = ym1 + ym;
    // now get x
    lng0 = planeData.x0 * twoPi;
    lng1 = planeData.x1 * twoPi;
    x0mid = this.getPoint(planeData.x0, 0.5);
    x1mid = this.getPoint(planeData.x1, 0.5);

  }, this);
  return planes;
};

Pano.prototype.getDepthImage = function() {
  var x, y, depthCanvas, depthContext, depthImageData, w, h, c;
  depthImage = document.createElement("canvas");
  depthContext = depthImage.getContext('2d');
  w = this.depthData.width;
  h = this.depthData.height;
  depthImage.setAttribute('width', w);
  depthImage.setAttribute('height', h);
  depthImageData = depthContext.getImageData(0, 0, w, h);
  for(y=0; y<h; ++y) {
    for(x=0; x<w; ++x) {
      c = this.depthData.depthMap[y*w + x] / 50 * 255;
      depthImageData.data[4*(y*w + x)  ] = c;
      depthImageData.data[4*(y*w + x) + 1] = c;
      depthImageData.data[4*(y*w + x) + 2] = c;
      depthImageData.data[4*(y*w + x) + 3] = 255;
    }
  }
  depthContext.putImageData(depthImageData, 0, 0);
  return depthImage;
};
