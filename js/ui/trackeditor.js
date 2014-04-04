var TrackEditor = function(sel, center) {
  var template = Handlebars.compile($("#track-editor-template").html());
  var self = this, context = {};
  this.$el = $(sel);
  this.$el.html(template(context));

  this.$el.find(".btn-clear").click(this.onClear.bind(this));
  this.$el.find(".btn-generate").click(function() { self.onGenerate(); });
  this.$el.find(".check-loop").click(this.onLoop.bind(this));
  this.$el.find(".form-search, .txt-search").submit(this.onSearch.bind(this));

  var mapOptions = {
    zoom: 16,
    overviewMapControl: false,
    streetViewControl: false,
    center: center,
    disableDoubleClickZoom: true
  };
  this.map = new google.maps.Map(this.$el.find('.map-canvas')[0], mapOptions);
  google.maps.event.addListener(this.map, 'click', this.onMapClick.bind(this));

  this.routePolyline = new google.maps.Polyline({
    map: this.map,
    path: [],
    strokeColor: "#000000",
    strokeOpacity: 0.5,
    strokeWeight: 7,
    clickable: false
  });

  this.geocoder = new google.maps.Geocoder();
  this.markers = [];
  this.reset([]);
};

TrackEditor.prototype.reset = function(waypoints) {
  this.track = new Track();
  this.track.setWaypoints(waypoints);
  this.clearMarkers();
  waypoints.forEach(function(w, i) { this.addMarker(w); }, this);
  return this.onWaypointsChanged();
};

TrackEditor.prototype.addMarker = function(position) {
  var self = this, marker = new google.maps.Marker({
    map: this.map,
    draggable: true,
    position: position
  });
  google.maps.event.addListener(marker, 'click', function(e) {
    self.onMarkerClick(e, this);
  });
  google.maps.event.addListener(marker, 'dragend', function(e) {
    self.onMarkerDragend(e, this);
  });
  this.markers.push(marker);
};

TrackEditor.prototype.onMapClick = function(e) {
  this.addMarker(e.latLng);
  this.track.waypoints.push(e.latLng);
  this.onWaypointsChanged();
};

TrackEditor.prototype.onMarkerClick = function(e, marker) {
  google.maps.event.clearInstanceListeners(marker);
  marker.setMap(null);
  var index = this.markers.indexOf(marker);
  this.markers.splice(index, 1);
  this.track.waypoints.splice(index, 1);
  this.onWaypointsChanged();
};

TrackEditor.prototype.onMarkerDragend = function(e, marker) {
  var index = this.markers.indexOf(marker);
  this.track.waypoints[index] = this.getPosition();
  this.onWaypointsChanged();
};

TrackEditor.prototype.onWaypointsChanged = function() {
  return this.track.updateRoute().then(this.updateTrackDisplay.bind(this));
};

TrackEditor.prototype.onSearch = function(e) {
  var searchText = this.$el.find(".txt-search").val();
  var self = this, query = {'address': searchText};
  this.geocoder.geocode(query, function(results, status) {
    if (status === google.maps.GeocoderStatus.OK) {
      self.map.setCenter(results[0].geometry.location);
      self.reset([results[0].geometry.location]);
      self.$el.find(".txt-search").val("");
    } else {
      console.error("Geocoding failed: " + status);
    }
  });
  e.preventDefault();
  return false;
};

TrackEditor.prototype.updateTrackDisplay = function() {
  this.routePolyline.setPath(this.track.route);
  this.$el.find(".track-status").html(this.track.route.length + " waypoints.");
};

TrackEditor.prototype.clearMarkers = function() {
  this.markers.forEach(function(marker) { marker.setMap(null); });
  this.markers = [];
};

TrackEditor.prototype.clearPath = function() {
  this.clearMarkers();
  this.track.setWaypoints([]);
  this.onWaypointsChanged();
};

TrackEditor.prototype.onClear = function() {
  this.clearPath();
};

TrackEditor.prototype.onGenerate = function() {};

TrackEditor.prototype.onLoop = function() {
  this.track.isLoop = this.$el.find(".check-loop").is(":checked");
  this.onWaypointsChanged();
};
