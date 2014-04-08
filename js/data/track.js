var Track = function(waypoints, isLoop) {
  this.waypoints = waypoints || [];
  this.isLoop = isLoop !== undefined ? isLoop : false;
  this.route = [];
};

Track.directionsService = new google.maps.DirectionsService();

Track.MIN_ROUTEPOINT_DISTANCE = 15;

Track.deserialize = function(data) {
  if(typeof data === 'string') {
    data = data.split(',').map(function(i) { return parseFloat(i); });
  }
  var numPoints = (data.length - 1) / 2;
  var waypoints = [];
  for(var i = 0; i < numPoints; i++) {
    waypoints.push(new google.maps.LatLng(data[2*i], data[2*i+1]));
  }
  return new Track(waypoints, !!data[data.length - 1]);
};

Track.prototype.serialize = function() {
  var s = '';
  this.waypoints.forEach(function(waypoint) {
    s += waypoint.lat().toFixed(6) + ',';
    s += waypoint.lng().toFixed(6) + ',';
  });
  s += this.isLoop ? '1' : '0';
  return s;
};

Track.prototype.setWaypoints = function(waypoints) {
  this.waypoints = waypoints;
};

Track.prototype.updateRoute = function() {
  var self = this;
  if(this.waypoints.length === 0) { self.route = []; return RSVP.resolve(); }
  return this.fetchDirections().then(function(response) {
    if(!response) { self.route = self.waypoints; return; }
    var rawPath = response.routes[0].overview_path;
    self.route = self.routeFromPath(rawPath);
  });
};

Track.prototype.routeFromPath = function(path) {
  var route = [path[0]], i, dist, segs, j;
  for(i = 1, l = path.length; i < l; i++) {
    dist = google.maps.geometry.spherical.computeDistanceBetween(
      path[i-1], path[i]);
    if(dist > Track.MIN_ROUTEPOINT_DISTANCE) {
      // distance is greater, so add subdivisions too.
      segs = Math.ceil(dist / Track.MIN_ROUTEPOINT_DISTANCE);
      for(j = 1; j < segs; j++) {
        route.push(google.maps.geometry.spherical.interpolate(
          path[i-1], path[i], j / segs));
      }
    }
    route.push(path[i]);
  }
  return route;
};

Track.prototype.fetchDirections = function() {
  if(this.waypoints.length === 0) { return RSVP.reject(); }
  if(this.waypoints.length === 1) { return RSVP.resolve(); }
  var routeWaypoints = this.waypoints.slice(0);
  if(this.isLoop) { routeWaypoints.push(routeWaypoints[0]); }

  // Form request.
  var routeRequest = {
    origin: routeWaypoints[0],
    destination: routeWaypoints[routeWaypoints.length - 1],
    waypoints: routeWaypoints.slice(1, routeWaypoints.length - 1).map(
      function(pos) {return {location: pos, stopover: false}; }),
    travelMode: google.maps.DirectionsTravelMode.DRIVING
  };
  // Make request
  return new RSVP.Promise(function(resolve, reject) {
    Track.directionsService.route(routeRequest, function(response, status) {
      if(status === google.maps.DirectionsStatus.OK) {
        resolve(response);
      } else {
        reject(status);
      }
    });
  });
};

Track.prototype.fetchPanos = function(cache, progressCallback, errorCallback) {
  var promiseChain = RSVP.resolve();
  var errors = [], panos = [], panoIds = {}, self = this;
  this.route.forEach(function(location, i) {
    promiseChain = promiseChain.then(function() {
      return Pano.load(cache, location);
    }).then(function(pano) {
      if(!!panoIds[pano.panoId]) { return; }  // pano has already been loaded!
      panoIds[pano.panoId] = true;
      panos.push(pano);
      if(progressCallback) { progressCallback(pano, i); }
    }, function(err) {
      errors.push(err);
      if(errorCallback) { errorCallback(err, i); }
    });
  }, this);
  return promiseChain.then(function() {
    console.log('done');
    return {panos: panos, errors: errors, numErrors: errors.length};
  }, function(err) {
    console.log('error fetching panos', err);
  });
};
