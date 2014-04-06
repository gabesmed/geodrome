var GSVPANO = GSVPANO || {};
GSVPANO.PanoDepthLoader = function () {
  'use strict';

  this.load = function(cache, panoId) {
    var self = this;
    return this.getData(cache, panoId).then(function(data) {
      var decoded = self.decode(data.model.depth_map);
      var depthMap = self.parse(decoded);
      return depthMap;
    });
  };

  this.getData = function(cache, panoId) {
    // get data and set in cache.
    var cachedData = cache.getJson('depth-' + panoId);
    if(cachedData) {
      console.info('depth', panoId, 'loaded from cache');
      return RSVP.resolve(cachedData);
    }
    console.info('depth', panoId, 'fetched live');
    return this.fetch(panoId).then(function(data) {
      cache.setJson('depth-' + panoId, data);
      return data;
    });
  };

  this.fetch = function(panoId) {
    return new RSVP.Promise(function(resolve, reject) {
      var url = "http://maps.google.com/cbk?output=json&cb_client=maps_sv&v=4&dm=1&pm=1&ph=1&hl=en&panoid=" + panoId;
      $.ajax({url: url, dataType: 'jsonp'})
        .done(function(data, textStatus, xhr) { resolve(data); })
        .fail(function(xhr, textStatus, errorThrown) {
          reject(textStatus + ": " + errorThrown);
        });
    });
  };

  this.decode = function(rawDepthMap) {
    var self = this, i, compressedDepthMapData, depthMap, decompressedDepthMap;

    // Append '=' in order to make the length of the array a multiple of 4
    while(rawDepthMap.length % 4 !== 0)
      rawDepthMap += '=';

    // Replace '-' by '+' and '_' by '/'
    rawDepthMap = rawDepthMap.replace(/-/g,'+');
    rawDepthMap = rawDepthMap.replace(/_/g,'/');

    // Decode and decompress data
    compressedDepthMapData = $.base64.decode(rawDepthMap);
    decompressedDepthMap = zpipe.inflate(compressedDepthMapData);

    // Convert output of decompressor to Uint8Array
    depthMap = new Uint8Array(decompressedDepthMap.length);
    for(i=0; i<decompressedDepthMap.length; ++i)
      depthMap[i] = decompressedDepthMap.charCodeAt(i);
    return depthMap;
  };

  this.parseHeader = function(depthMap) {
    return {
      headerSize : depthMap.getUint8(0),
      numberOfPlanes : depthMap.getUint16(1, true),
      width: depthMap.getUint16(3, true),
      height: depthMap.getUint16(5, true),
      offset: depthMap.getUint16(7, true)
    };
  };

  this.parsePlanes = function(header, depthMap) {
    var planes = [],
      indices = [],
      i,
      n = [0, 0, 0],
      d,
      byteOffset;

    for(i=0; i<header.width*header.height; ++i) {
      indices.push(depthMap.getUint8(header.offset + i));
    }

    for(i=0; i<header.numberOfPlanes; ++i) {
      byteOffset = header.offset + header.width*header.height + i*4*4;
      n[0] = depthMap.getFloat32(byteOffset, true);
      n[1] = depthMap.getFloat32(byteOffset + 4, true);
      n[2] = depthMap.getFloat32(byteOffset + 8, true);
      d  = depthMap.getFloat32(byteOffset + 12, true);
      planes.push({
        n: n.slice(0),
        d: d
      });
    }

    return {planes: planes, indices: indices};
  };

  this.computeDepthMap = function(header, indices, planes) {
    var depthMap = null, x, y, planeIdx, phi, theta, v = [0, 0, 0],
      w = header.width, h = header.height, plane, t, p;

    depthMap = new Float32Array(w*h);

    for(x=0; x<w; ++x) {
      for(y=0; y<h; ++y) {
        planeIdx = indices[y*w + x];
        // phi -- lng, azimuth
        phi = (w - x - 1) / (w - 1) * 2 * Math.PI + Math.PI/2;
        // theta -- lat, altitude
        theta = (h - y - 1) / (h - 1) * Math.PI;
        v[0] = Math.sin(theta) * Math.cos(phi);
        v[1] = Math.sin(theta) * Math.sin(phi);
        v[2] = Math.cos(theta);
        if(planeIdx > 0) {
          plane = planes[planeIdx];
          t = plane.d / (v[0]*plane.n[0] + v[1]*plane.n[1] + v[2]*plane.n[2]);
          v[0] *= t; v[1] *= t; v[2] *= t;
          depthMap[y * w + x] = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
        } else {
          depthMap[y * w + x] = 9999999999999999999.0;
        }
      }
    }
    return depthMap;
  };

  this.computeShards = function(header, indices, planes, depthMap) {
    var x, y, w = header.width, h = header.height,
      planeIdx, plane, y0, y1;
    var planeY0, planeY1, planeHeight;
    var shards = [];
    // Go through columns from left to right
    for(x = 0; x < w; ++x) {
      planeY0 = {};
      planeY1 = {};
      // Go through column from top to bottom
      for(y = 0; y < h; ++y) {
        planeIdx = indices[y * w + x];
        if(planeIdx === 0) { continue; } // empty
        plane = planes[planeIdx];
        if(planeY0[planeIdx] === undefined) {
          // if plane wasn't previously detected on this column, set
          // its top and bottom to current position
          planeY0[planeIdx] = planeY1[planeIdx] = y;
        } else {
          // if previously detected, extend y1 to bottom
          planeY1[planeIdx] = y;
        }
        // Extend x bounds for plane
        if(plane.x0 === undefined) {
          plane.x0 = plane.x1 = x;
        } else if(x > plane.x1) {
          plane.x1 = x;
        }
      }
      // after going through entire column, look at all planes that had a
      // presence in this column. If this plane height is higher than any
      // previous height
      // store plane height on plane if its' higher than previously stored.
      for(planeIdx = 1; planeIdx < header.numberOfPlanes; planeIdx++) {
        plane = planes[planeIdx];
        if(planeY0[planeIdx] !== undefined) {
          // This plane was detected in this column. So re-calculate
          // the plane height if the current height is higher than that
          // of any previous column.
          planeHeight = planeY1[planeIdx] - planeY0[planeIdx];
          if(!plane.hMax || planeHeight > plane.hMax) {
            plane.hMax = planeHeight;
            plane.hx = x;
            plane.hy0 = planeY0[planeIdx];
            plane.hy1 = planeY1[planeIdx];
          }
        } else if(plane.x0 !== undefined) {
          // This plane was *not* detected in this column, but WAS previously
          // detected. Copy to mini-planes array.
          shards.push({
            planeIdx: planeIdx,
            n: plane.n, d: plane.d,
            x0: plane.x0, x1: plane.x1,
            hx: plane.hx, hMax: plane.hMax,
            hy0: plane.hy0, hy1: plane.hy1
          });
          // And clear plane history so ready for a fresh shard.
          delete plane.x0;
          delete plane.x1;
          delete plane.hMax;
          delete plane.hx;
          delete plane.hy0;
          delete plane.hy1;
        }
      }
    }

    var ci = 0, rgb;
    // annotate some more.
    planes.forEach(function(plane) {
      plane.w = plane.x1 - plane.x0;
      plane.rgb = {r: 120, g: 120, b: 120}; // default
      plane.shards = [];
    });

    // annotate some more.
    shards.forEach(function(shard, i) {
      shard.w = shard.x1 - shard.x0;
      planes[shard.planeIdx].shards.push(i);
    });
    // assign colors by x position
    ci = 0;
    _.sortBy(shards, function(s) { return s.x0; }).forEach(function(shard) {
      if(shard.n[2] < -0.95) {
        rgb = {r: 120, g: 120, b: 120};
      } else {
        rgb = hsvToRgb({h: ((ci++) * 0.022), s: 1.0, v: 1.0});
      }
      shard.rgb = rgb;
      if(!planes[shard.planeIdx].rgb) { planes[shard.planeIdx].rgb = s.rgb; }
    });
    return shards;
  };

  this.parse = function(depthMap) {
    var depthMapData, header, response, data, shards;
    depthMapData = new DataView(depthMap.buffer);
    header = this.parseHeader(depthMapData);
    data = this.parsePlanes(header, depthMapData);
    depthMap = this.computeDepthMap(header, data.indices, data.planes);
    shards = this.computeShards(header, data.indices, data.planes, depthMap);
    return {
      width: header.width,
      height: header.height,
      depthMap: depthMap,
      indices: data.indices,
      planes: data.planes,
      shards: shards
    };
  };
};
