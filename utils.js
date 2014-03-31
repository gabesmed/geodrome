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
