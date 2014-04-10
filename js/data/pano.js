/*
    +y=up
      |   +x=north
      |  /
      | /
      |/
      \
       \
        \+z=east
*/

var Pano = function() {
  this.panoId = null;
  this.heading = null;
  this.location = null;
  this.copyright = null;
  this.panoCanvas = null;
  this.depthData = null;
};

Pano.load = function(cache, location) {
  var pano = new Pano(), self = this;
  return self.getPano(cache, location).then(function(panoData) {
    // save data
    pano.panoId = panoData.panoId;
    pano.heading = panoData.heading;
    pano.copyright = panoData.copyright;
    pano.location = panoData.location;
    pano.panoCanvas = panoData.canvas;

    // load depth
    return new GSVPANO.PanoDepthLoader().load(cache, pano.panoId);

  }).then(function(depthData) {
    pano.depthData = depthData;
    return pano;
  });
};

Pano.getPano = function(cache, location) {
  var self = this;
  return this.getCachedPano(cache, location).then(function(cachedPano) {
    if(cachedPano === PanoCache.ZERO_RESULTS) {
      // console.info('empty result loaded from cache');
      throw new Error('ZERO_RESULTS');
    }
    if(cachedPano) {
      // console.info('pano', cachedPano.panoId, 'loaded from cache');
      return cachedPano;
    }
    // console.info('pano at ' + location.lat() + ', ' + location.lng() +
    //   ' fetching live');
    return self.fetchPano(location).then(function(pano) {
      self.cachePano(cache, pano);
      return pano;
    }, function(errorStatus) {
      if(errorStatus === 'ZERO_RESULTS') {
        self.cacheNoResults(cache, location);
      }
      throw new Error(errorStatus);
    });
  });
};

Pano.cacheNoResults = function(cache, location) {
  cache.cacheNoResults(location);
};

Pano.cachePano = function(cache, pano) {
  var panoData = {
    panoId: pano.panoId, heading: pano.heading, copyright: pano.copyright,
    location: [pano.location.lat(), pano.location.lng()]};
  try {
    cache.cachePanoLocation(pano.panoId, pano.location);
    cache.setJson('pano-' + pano.panoId, panoData);
    cache.setImage('pano-image-' + pano.panoId, pano.canvas);
  } catch(err) {
    console.error("Error caching pano " + pano.panoId + ": " + err);
  }
};

Pano.getCachedPano = function(cache, loc) {
  return new RSVP.Promise(function(resolve) {
    cache.panoIdForLocation(loc, function(panoId) {
      if(!panoId) {
        // console.log('id not found for ', loc.lat(), ',', loc.lng());
        resolve(null); return; }
      if(panoId === PanoCache.ZERO_RESULTS) {
        // console.log('cached no results for ', loc.lat(), ',', loc.lng());
        resolve(PanoCache.ZERO_RESULTS); return; }
      cache.getJson('pano-' + panoId, function(panoData) {
        if(!panoData) {
          // console.log('data not found for ', loc.lat(), ',', loc.lng());
          resolve(null); return; }
        cache.getImage('pano-image-' + panoId, function(panoCanvas) {
          if(!panoCanvas) {
            // console.log('canvas not found for ', loc.lat(), ',', loc.lng());
            resolve(null); return; }
          resolve({
            panoId: panoData.panoId,
            heading: panoData.heading,
            copyright: panoData.copyright,
            location: new google.maps.LatLng(
              panoData.location[0], panoData.location[1]),
            canvas: panoCanvas
          });
        });
      });
    });
  });
};

Pano.fetchPano = function(location) {
  return new RSVP.Promise(function(resolve, reject) {
    var rawPanoData;
    var panoLoader = new GSVPANO.PanoLoader({zoom: 1});
    panoLoader.onPanoramaData = function(result) { rawPanoData = result; };
    panoLoader.onPanoramaLoad = function() {
      resolve({
        canvas: this.canvas,
        heading: rawPanoData.tiles.centerHeading,
        copyright: rawPanoData.copyright,
        location: rawPanoData.location.latLng,
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

Pano.prototype.getDepth = function(depthX, depthY) {
  var depthIndex = depthY * this.depthData.width + depthX;
  return this.depthData.depthMap[depthIndex];
};

Pano.prototype.getNormal = function(x, y, isPixelCoords) {
  if(isPixelCoords) { x /= this.depthData.width; y /= this.depthData.height; }
  var azimuth = ((x + 0.5) * THREE.Math.PI2);
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

Pano.prototype.getPlanePointAtCoord = function(plane, x, y) {
  var w = this.depthData.width, h = this.depthData.height;
  var up = new THREE.Vector3(0, 1, 0);
  var phi = (w - x - 1) / (w - 1) * 2 * Math.PI + Math.PI/2;
  var theta = (h - y - 1) / (h - 1) * Math.PI;
  var v = [
    Math.sin(theta) * Math.cos(phi),
    Math.sin(theta) * Math.sin(phi),
    Math.cos(theta)];
  var n = plane.n;
  var t = plane.d / (v[0] * n[0] + v[1] * n[1] + v[2] * n[2]);
  var vt = [v[0] * t, v[1] * t, v[2] * t];
  var d = Math.sqrt(vt[0]*vt[0] + vt[1]*vt[1] + vt[2]*vt[2]);
  var r = new THREE.Vector3(v[1], -v[2], v[0])
    .multiplyScalar(d);
  return r;
};

Pano.prototype.getShards = function() {
  var shards = [],
    w = this.depthData.width,
    h = this.depthData.height, normal, depth,
    shardLeft, shardRight, shardTop, shardBottom, colDepth, shardHeight,
    row, rows, col, colPos, cols, vertices, uvx, pointPos, pointY,
    colTop, colBottom, colNormal,
    pointPhi, uvy, uv;

  var colsPerQuarter = 20;
  var rowsPerHalf = 16;

  var up = new THREE.Vector3(0, 1, 0);
  this.depthData.shards.forEach(function(shard, i) {
    if(i === 0) { return; } // null
    if(!this.includeShard(shard)) { return; } // ground shard

    cols = Math.ceil(shard.w / (w / 4) * colsPerQuarter);
    rows = Math.ceil(shard.hMax / h * rowsPerHalf);
    vertices = [];
    uvs = [];

    shardTop = this.getPlanePointAtCoord(shard, shard.hx, shard.hy0);
    shardBottom = this.getPlanePointAtCoord(shard, shard.hx, shard.hy1);
    shardLeft = this.getPlanePointAtCoord(shard, shard.x0, 127.5);
    shardRight = this.getPlanePointAtCoord(shard, shard.x1, 127.5);
    shardHeight = shardTop.y - shardBottom.y;

    for(col = 0; col <= cols; col++) {
      colPos = shardLeft.clone().lerp(shardRight, (col / cols));
      colTop = new THREE.Vector3(colPos.x, shardTop.y, colPos.z);
      colBottom = new THREE.Vector3(colPos.x, shardBottom.y, colPos.z);
      colDepth = colPos.length();
      colNormal = colPos.clone().normalize();

      uvx = Math.atan2(colNormal.z, colNormal.x) / THREE.Math.PI2;
      if(uvx < 0) { uvx += 1; }

      for(row = 0; row <= rows; row++) {
        pointY = shardTop.y - shardHeight * (row / rows);
        pointPos = new THREE.Vector3(colPos.x, pointY, colPos.z);
        pointPhi = Math.atan(pointY / colDepth);

        uvy = (pointPhi / Math.PI) + 0.5;
        uv = new THREE.Vector2(uvx, uvy);
        vertices.push(pointPos);
        uvs.push(uv);
      }
    }
    shards.push({
      ci: shard.ci, rgb: shard.rgb,
      cols: cols, rows: rows,
      vertices: vertices, uvs: uvs
    });
  }, this);
  return shards;
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

Pano.prototype.includePlane = function(plane) {
  if(plane.n[2] < -0.95) { return false; }
  if(!plane.w || plane.w < 5) { return false; }
  return true;
};

Pano.prototype.includeShard = function(shard) {
  if(shard.n[2] < -0.95) { return false; }
  if(!shard.w || shard.w < 5) { return false; }
  return true;
};

Pano.prototype.getShard = function(plane, x) {
  // console.log('plane', plane, x);
  var shards = [], shard;
  plane.shards.forEach(function(shardIndex) {
    shard = this.depthData.shards[shardIndex];
    if(shard.x0 <= x && shard.x1 >= x) {
      shards.push(shard);
    }
  }, this);
  return shards[0];
};

Pano.prototype.getPlaneImage = function() {
  var x, y, ctx, image, imageData, w, h, idx, rgb, plane, yi;
  image = document.createElement("canvas");
  ctx = image.getContext('2d');
  w = this.depthData.width;
  h = this.depthData.height;
  image.setAttribute('width', w);
  image.setAttribute('height', h);
  imageData = ctx.getImageData(0, 0, w, h);
  function put(x, y, rgb) {
    imageData.data[4*(y*w + x)  ] = rgb.r;
    imageData.data[4*(y*w + x) + 1] = rgb.g;
    imageData.data[4*(y*w + x) + 2] = rgb.b;
    imageData.data[4*(y*w + x) + 3] = 255;
  }
  for(y=0; y<h; ++y) {
    for(x=0; x<w; ++x) {
      idx = this.depthData.indices[y * w + x];
      if(idx === 0) {
        rgb = {r: 0, g: 0, b: 0};
      } else {
        shard = this.getShard(this.depthData.planes[idx], x);
        rgb = shard ? shard.rgb : {r: 120, g: 120, b: 120};
      }
      put(x, y, rgb);
    }
  }
  for(idx = 1; idx < this.depthData.shards.length; idx++) {
    shard = this.depthData.shards[idx];
    y = h - 20 - (shard.planeIdx % 10) * 3;
    if(!this.includeShard(shard)) { continue; }
    for(x = shard.x0; x <= shard.x1; x++) {
      for(yi = 0; yi < 3; yi++) {
        put(x, y + yi, shard.rgb);
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return image;
};
