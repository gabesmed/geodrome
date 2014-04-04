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
    return self;
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

Pano.prototype.getDepth = function(depthX, depthY) {
  var depthIndex = depthY * this.depthData.width + depthX;
  return this.depthData.depthMap[depthIndex];
};

Pano.prototype.getNormal = function(x, y, isPixelCoords) {
  if(isPixelCoords) { x /= this.depthData.width; y /= this.depthData.height; }
  var twoPi = Math.PI * 2;
  var panoHeading = -twoPi * this.panoData.heading / 360.0;
  var azimuth = (x * twoPi) + panoHeading;
  var altitude = Math.PI * (0.5 - y);
  var nx = -Math.cos(azimuth) * Math.cos(altitude);
  var ny = Math.sin(altitude);
  var nz = Math.sin(azimuth) * Math.cos(altitude);
  return new THREE.Vector3(nx, ny, nz);
};

Pano.prototype.getPoint = function(x, y, isPixelCoords) {
  var depthX = x, depthY = y,
    w = this.depthData.width, h = this.depthData.height;
  if(isPixelCoords) { x /= w; y /= h; }
  else { depthX = w - Math.floor(x * w); depthY = Math.floor(y * h); }
  var normal = this.getNormal(x, y);
  var depth = this.getDepth(depthX, depthY);
  normal.multiplyScalar(depth);
  return normal;
};

Pano.prototype.getPoints = function() {
  var twoPi = Math.PI * 2;
  var panoImage = this.panoData.canvas;
  var panoCtx = panoImage.getContext('2d');
  var panoImageData = panoCtx.getImageData(0, 0, panoImage.width,
    panoImage.height);

  // beta/lat, lambda/lng
  var raysLng = 240, raysLat = 60, lngIndex, latIndex;
  var panoX, panoY, panoIndex, c;
  var n, points = [];
  // var lngOffset = twoPi * (-this.panoData.heading / 360.0);
  for(lngIndex = 0; lngIndex < raysLng; lngIndex++) {
    for(latIndex = 1; latIndex <= raysLat * 0.81; latIndex++) {
      n = this.getPoint(lngIndex / raysLng, latIndex / raysLat, false);
      if(!n) { continue; }
      points.push(n);

      // calculate color
      panoX = panoImage.width - Math.floor(lngIndex * panoImage.width / raysLng);
      panoY = Math.floor(latIndex * panoImage.height / raysLat);
      panoIndex = 4 * (panoY * panoImage.width + panoX);
      n.c = (panoImageData.data[panoIndex] << 16) +
        (panoImageData.data[panoIndex + 1] << 8) +
        panoImageData.data[panoIndex + 2];
    }
  }
  return points;
};

Pano.prototype.PLANE_MIN_WIDTH = 10;
Pano.prototype.PLANE_MIN_HEIGHT = 10;

Pano.prototype.getPlanes = function() {
  return [];

  var twoPi = Math.PI * 2, planes = [],
    w = this.depthData.width,
    h = this.depthData.height, normal, depth,
    t, l, r, b, tl, tr, bl, br,
    lx, lz, rx, rz, ty, by,
    up = new THREE.Vector3(0, 1, 0);
  var panoHeading = -twoPi * this.panoData.heading / 360.0;
  this.depthData.planes.forEach(function(plane, i) {
    if(i === 0) { return; } // null
    if(plane.n[2] < -0.95) { return; } // ground plane
    // if(!plane.hMax) { return; } // no height
    // if(plane.w < this.PLANE_MIN_WIDTH) { return; } // too small
    // if(plane.hMax < this.PLANE_MIN_HEIGHT) { return; } // too small


    // ATTEMPT ONE: FOUR CORNERS, DEPTH FROM DEPTH MAP

    // left:   plane.x0, plane.x0y
    // right:  plane.x1, plane.x1y
    // top:    plane.hx, plane.hy0
    // bottom: plane.hx, plane.hy1

    // l = this.getPoint(plane.x0, plane.x0y, true);
    // r = this.getPoint(plane.x1, plane.x1y, true);
    // t = this.getPoint(plane.hx, plane.hy0, true);
    // b = this.getPoint(plane.hx, plane.hy1, true);

    // lx = l.x; lz = l.z;
    // rx = r.x; rz = r.z;
    // ty = t.y; by = b.y;

    // console.log(i + '.',
    //   'l', plane.x0, 'r', plane.x1,
    //   't', plane.hy0, 'b', plane.hy1,
    //   'hmax', plane.hMax, '---',
    //   'l', lx.toFixed(3), lz.toFixed(3),
    //   'r', rx.toFixed(3), rz.toFixed(3),
    //   't', ty.toFixed(3), 'b', by.toFixed(3));

    // tl = new THREE.Vector3(lx, ty, lz);
    // tr = new THREE.Vector3(rx, ty, rz);
    // bl = new THREE.Vector3(lx, by, lz);
    // br = new THREE.Vector3(rx, by, rz);
    // planes.push({vertices: [tl, tr, br, bl]});

    // ATTEMPT TWO: FOUR CORNERS, FIXED DEPTH

    // l = this.getNormal(plane.x0, plane.x0y, true).multiplyScalar(10);
    // r = this.getNormal(plane.x1, plane.x1y, true).multiplyScalar(10);
    // t = this.getNormal(plane.hx, plane.hy0, true).multiplyScalar(10);
    // b = this.getNormal(plane.hx, plane.hy1, true).multiplyScalar(10);

    // lx = l.x; lz = l.z;
    // rx = r.x; rz = r.z;
    // ty = t.y; by = b.y;

    // tl = new THREE.Vector3(lx, ty, lz);
    // tr = new THREE.Vector3(rx, ty, rz);
    // bl = new THREE.Vector3(lx, by, lz);
    // br = new THREE.Vector3(rx, by, rz);
    // planes.push({vertices: [tl, tr, br, bl]});

    // ATTEMPT THREE, PLANE NORMAL AND DEPTH FROM GOOGLE DATA

    // normal = new THREE.Vector3(plane.n[1], plane.n[2], plane.n[0]);
    // normal.applyAxisAngle(up, panoHeading);
    // var planeNormalX = normal.clone().cross(up).normalize();
    // var planeNormalY = planeNormalX.clone().cross(normal).normalize();

    // var position = normal.clone().multiplyScalar(plane.d);

    // tl = position.clone().add(normal.clone()
    //   .add(planeNormalX.clone().multiplyScalar(10))
    //   .add(planeNormalY.clone().multiplyScalar(10)));
    // tr = position.clone().add(normal.clone()
    //   .add(planeNormalX.clone().multiplyScalar(-10))
    //   .add(planeNormalY.clone().multiplyScalar(10)));
    // br = position.clone().add(normal.clone()
    //   .add(planeNormalX.clone().multiplyScalar(-10))
    //   .add(planeNormalY.clone().multiplyScalar(-10)));
    // bl = position.clone().add(normal.clone()
    //   .add(planeNormalX.clone().multiplyScalar(10))
    //   .add(planeNormalY.clone().multiplyScalar(-10)));

    // planes.push({vertices: [tl, tr, br, bl]});

    // ATTEMPT FOUR: plane position from google data, left+right
    // from pixel data.

    // normal = new THREE.Vector3(plane.n[1], plane.n[2], plane.n[0]);
    // normal.applyAxisAngle(up, panoHeading);
    // var planeNormalX = normal.clone().cross(up).normalize();
    // var planeNormalY = planeNormalX.clone().cross(normal).normalize();

    // var position = normal.clone().multiplyScalar(plane.d);

    // var phi0 = (plane.x0 / w * twoPi) + panoHeading;
    // var nx0 = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    // var dx0 = plane.d / normal.clone().dot(nx0);
    // console.log('nx0', nx0.toArray(), 'dx0', dx0);
    // var rx0 = nx0.clone().multiplyScalar(dx0);

    // var phi1 = (plane.x1 / w * twoPi) + panoHeading;
    // var nx1 = new THREE.Vector3(-Math.cos(phi1), 0, Math.sin(phi1));
    // var dx1 = plane.d / normal.clone().dot(nx1);
    // var rx1 = nx1.clone().multiplyScalar(dx1);

    // tl = new THREE.Vector3(rx0.x, 10, rx0.z);
    // tr = new THREE.Vector3(rx1.x, 10, rx1.z);
    // br = new THREE.Vector3(rx1.x, -10, rx1.z);
    // bl = new THREE.Vector3(rx0.x, -10, rx0.z);

    // planes.push({vertices: [tl, tr, br, bl]});

    // ATTEMPT FIVE: all corners from intersection of plane and
    // pixel boundaries

    normal = new THREE.Vector3(plane.n[1], plane.n[2], plane.n[0]);
    normal.applyAxisAngle(up, panoHeading);
    var planeNormalX = normal.clone().cross(up).normalize();
    var planeNormalY = planeNormalX.clone().cross(normal).normalize();

    var position = normal.clone().multiplyScalar(plane.d);

    var phi0 = (plane.x0 / w * twoPi) + panoHeading;
    var nx0 = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    var dx0 = plane.d / normal.clone().dot(nx0);
    console.log('nx0', nx0.toArray(), 'dx0', dx0);
    var rx0 = nx0.clone().multiplyScalar(dx0);

    var phi1 = (plane.x1 / w * twoPi) + panoHeading;
    var nx1 = new THREE.Vector3(-Math.cos(phi1), 0, Math.sin(phi1));
    var dx1 = plane.d / normal.clone().dot(nx1);
    var rx1 = nx1.clone().multiplyScalar(dx1);

    tl = new THREE.Vector3(rx0.x, 10, rx0.z);
    tr = new THREE.Vector3(rx1.x, 10, rx1.z);
    br = new THREE.Vector3(rx1.x, -10, rx1.z);
    bl = new THREE.Vector3(rx0.x, -10, rx0.z);

    planes.push({ci: plane.ci, vertices: [tl, tr, br, bl]});
  }, this);
  return planes;
};

Pano.prototype.getDepthImage = function() {
  var x, y, ctx, image, imageData, w, h, c;
  image = document.createElement("canvas");
  ctx = image.getContext('2d');
  w = this.depthData.width;
  h = this.depthData.height;
  image.setAttribute('width', w);
  image.setAttribute('height', h);
  imageData = ctx.getImageData(0, 0, w, h);
  for(y=0; y<h; ++y) {
    for(x=0; x<w; ++x) {
      c = this.depthData.depthMap[y*w + x] / 50 * 255;
      imageData.data[4*(y*w + x)  ] = c;
      imageData.data[4*(y*w + x) + 1] = c;
      imageData.data[4*(y*w + x) + 2] = c;
      imageData.data[4*(y*w + x) + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return image;
};

Pano.prototype.getPlaneImage = function() {
  var x, y, ctx, image, imageData, w, h, idx, rgb, plane, hues, hue, lastHue;
  image = document.createElement("canvas");
  ctx = image.getContext('2d');
  w = this.depthData.width;
  h = this.depthData.height;
  image.setAttribute('width', w);
  image.setAttribute('height', h);
  imageData = ctx.getImageData(0, 0, w, h);
  for(y=0; y<h; ++y) {
    for(x=0; x<w; ++x) {
      idx = this.depthData.indices[y * w + x];
      if(idx === 0) {
        rgb = {r: 0, g: 0, b: 0};
      } else {
        plane = this.depthData.planes[idx];
        if(plane.n[2] < -0.95) {
          rgb = {r: 120, g: 120, b: 120};
        } else {
          rgb = hsvToRgb({h: plane.ci * 0.04, s: 1.0, v: 1});
        }
      }
      imageData.data[4*(y*w + x)  ] = rgb.r;
      imageData.data[4*(y*w + x) + 1] = rgb.g;
      imageData.data[4*(y*w + x) + 2] = rgb.b;
      imageData.data[4*(y*w + x) + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return image;
};
