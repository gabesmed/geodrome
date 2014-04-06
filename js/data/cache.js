var PanoCache = function() {};

PanoCache.prototype.cachePanoLocation = function(panoId, location) {
  var self = this;
  this.getJson('panoLocations', function(panoLocations) {
    panoLocations = panoLocations || {};
    if(!panoLocations[panoId]) {
      panoLocations[panoId] = [location.lat(), location.lng()];
      self.setJson('panoLocations', panoLocations);
    }
  });
};

PanoCache.prototype.panoCacheMaxDistance = 10;  // 1 meter

PanoCache.prototype.panoIdForLocation = function(location, callback) {
  var self = this;
  this.getJson('panoLocations', function(locs) {
    var closestPanoId = null, closestDist = self.panoCacheMaxDistance,
      dist, panoLoc, panoId;
    if(!locs) { callback(null); return; }
    for(panoId in locs) {
      panoLoc = new google.maps.LatLng(locs[panoId][0], locs[panoId][1]);
      dist = google.maps.geometry.spherical.computeDistanceBetween(
        location, panoLoc);
      if(dist < closestDist) { closestDist = dist; closestPanoId = panoId; }
    }
    callback(closestPanoId);
  });
};


PanoCache.prototype.getJson = function(key, callback) {
  localforage.getItem(key, callback);
};

PanoCache.prototype.setJson = function(key, value, callback) {
  localforage.setItem(key, value, callback);
};

PanoCache.prototype.getImage = function(key, callback) {
  localforage.getItem(key, function(data) {
    if(!data) { callback(null); return; }
    var canvas = document.createElement('canvas');
    canvas.isLoaded = false;
    var img = new Image();
    img.onload = function() {
      canvas.isLoaded = true;
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      callback(canvas);
    };
    img.src = data;
  });
};

PanoCache.prototype.setImage = function(key, canvas, callback) {
  localforage.setItem(key, canvas.toDataURL(), callback);
};
