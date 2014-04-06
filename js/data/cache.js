var PanoCache = function() {};

PanoCache.prototype.cachePano = function(pano) {
  // cache location
  var panoLocations = this.getJson('panoLocations');
  if(!panoLocations[pano.panoId]) {
    panoLocations[pano.panoId] = [pano.location.lat(), pano.location.lng()];
    this.setJson('panoLocations', panoLocations);
  }
  // cache pano data
  var panoHash = {
    panoId: pano.panoId,
    heading: pano.heading,
    location: pano.location,
    copyright: pano.copyright,
    depthData: pano.depthData
  };
  // cache pano canvas.
};

PanoCache.prototype.getCachedPano = function(location) {

};

PanoCache.prototype.panoCacheMaxDistance = 1;  // 1 meter

PanoCache.prototype.panoIdForLocation = function(location) {
  var closestPanoId = null, closestDist = this.panoCacheMaxDistance,
    dist, panoLoc, panoId;
  var locs = this.getJson('panoLocations');
  for(panoId in locs) {
    panoLoc = new google.maps.LatLng(locs[panoId][0], locs[panoId][1]);
    dist = google.maps.geometry.spherical.computeDistanceBetween(
      location, panoLoc);
    if(dist < closestDist) { closestDist = dist; closestPanoId = panoId; }
  }
  return closestPanoId;
};


PanoCache.prototype.getJson = function(key) {
  var data = localStorage[key];
  return data ? JSON.parse(data) : null;
};

PanoCache.prototype.setJson = function(key, value) {
  localStorage[key] = JSON.stringify(value);
};
