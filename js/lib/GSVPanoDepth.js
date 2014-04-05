var GSVPANO = GSVPANO || {};
GSVPANO.PanoDepthLoader = function (parameters) {

  'use strict';

  var _parameters = parameters || {},
    onDepthLoad = null;

  this.onError = function(errorMessage) {
    console.error(errorMessage);
  };
  this.onDepthLoad = function() {};

  this.load = function(panoId) {
    var self = this,
      url;

    url = "http://maps.google.com/cbk?output=json&cb_client=maps_sv&v=4&dm=1&pm=1&ph=1&hl=en&panoid=" + panoId;

    $.ajax({
        url: url,
        dataType: 'jsonp'
      })
      .done(function(data, textStatus, xhr) {
        var decoded = self.decode(data.model.depth_map);
        self.depthMap = self.parse(decoded);
        self.onDepthLoad();
      })
      .fail(function(xhr, textStatus, errorThrown) {
        self.onError("Request failed: " + url + "\n" + textStatus + "\n" + errorThrown);
      });
  };

  this.decode = function(rawDepthMap) {
    var self = this,
           i,
           compressedDepthMapData,
           depthMap,
           decompressedDepthMap;

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
    var depthMap = null,
      x, y,
      planeIdx,
      phi, theta,
      v = [0, 0, 0],
      w = header.width, h = header.height,
      plane, t, p;

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

  this.annotatePlanes = function(header, indices, planes, depthMap) {
    var x, y, w = header.width, h = header.height,
      planeIdx, plane, y0, y1;
    var planeY0, planeY1, planeHeight;
    for(x = 0; x < w; ++x) {
      planeY0 = {};
      planeY1 = {};
      for(y = 0; y < h; ++y) {
        // first go through and annotate each plane's left and right bound.
        planeIdx = indices[y * w + x];
        if(planeIdx > 0) {
          plane = planes[planeIdx];
          // save plane heights
          if(planeY0[planeIdx] === undefined) {
            planeY0[planeIdx] = planeY1[planeIdx] = y;
          } else {
            planeY1[planeIdx] = y;
          }
          // get x bounds for plane
          if(plane.x0 === undefined) {
            plane.x0 = plane.x1 = x;
            plane.x0y = plane.x1y = y;
          } else if(x > plane.x1) {
            plane.x1 = x;
            plane.x1y = y;
            plane.w = x - plane.x0;
          }
        }
      }
      // store plane height on plane if its' higher than previously stored.
      for(planeIdx = 1; planeIdx < header.numberOfPlanes; planeIdx++) {
        plane = planes[planeIdx];
        if(planeY0[planeIdx] !== undefined) {
          // we have a width
          planeHeight = planeY1[planeIdx] - planeY0[planeIdx];
          if(!plane.hMax || planeHeight > plane.hMax) {
            plane.hMax = planeHeight;
            plane.hx = x;
            plane.hy0 = planeY0[planeIdx];
            plane.hy1 = planeY1[planeIdx];
          }
        }
      }
    }
    var ci = 0;
    _.sortBy(planes, function(p) { return p.x0; }).forEach(function(plane, i) {
      if(plane.n[2] < -0.95) {
        plane.ci = -1; plane.rgb = {r: 120, g: 120, b: 120}; return; }
      plane.ci = ci++;
      plane.rgb = hsvToRgb({h: (plane.ci * 0.022), s: 1.0, v: 1.0});
    });

    console.log(planes.map(function(p) { return p.w; }));

    // overview
    for(planeIdx = 1; planeIdx < header.numberOfPlanes; planeIdx++) {
      plane = planes[planeIdx];
      console.log(planeIdx + '.',
        'x0', plane.x0, plane.x0y, depthMap[plane.x0y * w + plane.x0],
        'x1', plane.x1, plane.x1y, depthMap[plane.x1y * w + plane.x1]);
    }
  };

  this.parse = function(depthMap) {
    var depthMapData, header, response, data;
    depthMapData = new DataView(depthMap.buffer);
    header = this.parseHeader(depthMapData);
    data = this.parsePlanes(header, depthMapData);
    depthMap = this.computeDepthMap(header, data.indices, data.planes);
    this.annotatePlanes(header, data.indices, data.planes, depthMap);
    return {
      width: header.width,
      height: header.height,
      depthMap: depthMap,
      indices: data.indices,
      planes: data.planes
    };
  };

  this.createEmptyDepthMap = function() {
    var depthMap = {
      width: 512,
      height: 256,
      depthMap: new Float32Array(512*256)
    };
    for(var i=0; i<512*256; ++i)
      depthMap.depthMap[i] = 9999999999999999999.0;
    return depthMap;
  };
};
