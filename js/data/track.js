var Track = function() {
  this.waypoints = [];
  this.isLoop = true;
  this.route = [];
};

Track.directionsService = new google.maps.DirectionsService();

Track.prototype.setWaypoints = function(waypoints) {
  this.waypoints = waypoints;
};

Track.prototype.updateRoute = function() {
  var self = this;
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
    if(dist > MIN_ROUTEPOINT_DISTANCE) {
      // distance is greater, so add subdivisions too.
      segs = Math.ceil(dist / MIN_ROUTEPOINT_DISTANCE);
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