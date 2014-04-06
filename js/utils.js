var m1 = 111132.92;
var m2 = -559.82;
var m3 = 1.175;
var m4 = -0.0023;
var p1 = 111412.84;
var p2 = -93.5;
var p3 = 0.118;

var EARTH_CIRCUMFERENCE = 6378137;

function degToRad(deg) { return deg * Math.PI / 180.0; }
function radToDeg(rad) { return rad * 180.0 / Math.PI; }

function latMetersPerDegree(latitude) {
  var latitudeRadians = degToRad(latitude);
  return (m1 +
    (m2 * Math.cos(2 * latitudeRadians)) +
    (m3 * Math.cos(4 * latitudeRadians)) +
    (m4 * Math.cos(6 * latitudeRadians)));
}

function lngMetersPerDegree(latitude) {
  latitudeRadians = degToRad(latitude);
  return (
    (p1 * Math.cos(latitudeRadians)) +
    (p2 * Math.cos(3 * latitudeRadians)) +
    (p3 * Math.cos(5 * latitudeRadians)));
}

function hsvToRgb(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (h && s === undefined && v === undefined) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.floor(r * 255),
        g: Math.floor(g * 255),
        b: Math.floor(b * 255)
    };
}

String.prototype.hashCode = function() {
  var hash = 0, i, chr, len;
  if (this.length === 0) return hash;
  for (i = 0, len = this.length; i < len; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};
