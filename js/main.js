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

// CONSTANTS
var MIN_ROUTEPOINT_DISTANCE = 15; // meters
var twoPi = Math.PI * 2;

// MAP INITIALIZATION
var map, markers = [], routePolyline, track = null;
var initialPosition = new google.maps.LatLng(42.345601, -71.098348);
var geocoder = new google.maps.Geocoder();

// RENDERER INITIALIZATION
var scene, camera, renderer, controls;
var environments = {};
var sceneWidth = 800, sceneHeight = 600;
scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(75, sceneWidth / sceneHeight, 0.1, 10000);

renderer = new THREE.WebGLRenderer();
renderer.setSize(sceneWidth, sceneHeight);
renderer.domElement.addEventListener( 'mousewheel', function(e) { e.preventDefault(); }, false );
renderer.domElement.addEventListener( 'DOMMouseScroll', function(e) { e.preventDefault(); }, false );

// CONTROLS
THREE.EventDispatcher.prototype.apply(THREE.OrbitControls.prototype);
controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.addEventListener('change', render);

// SET UP LIGHTING
scene.add(new THREE.AmbientLight(0xcccccc));
var light = new THREE.DirectionalLight(0xffffff);
light.position.set(-1, 1, 1).normalize();
scene.add(light);

// MAP CODE

function initUI() {
  $("#btnClear").click(onClear);
  $("#btnGenerate").click(onGenerate);
  $("#checkLoop").click(onLoop);
  $("#formSearch, #txtSearch").submit(onSearch);
}

function initMap() {
  var mapOptions = {
    zoom: 16,
    overviewMapControl: false,
    streetViewControl: false,
    center: initialPosition,
    disableDoubleClickZoom: true
  };
  map = new google.maps.Map(document.getElementById('mapCanvas'),
    mapOptions);
  google.maps.event.addListener(map, 'click', onMapClick);

  routePolyline = new google.maps.Polyline({
    map: map, path: [],
    strokeColor: "#000000",
    strokeOpacity: 0.5,
    strokeWeight: 7,
    clickable: false
  });
}

function initPath(initialPosition) {
  track = new Track();
  track.setWaypoints([initialPosition]);
  clearMarkers();
  addMarker(initialPosition);
}

function addMarker(position) {
  var marker = new google.maps.Marker({
    map: map,
    draggable: true,
    position: position
  });
  google.maps.event.addListener(marker, 'click', onMarkerClick);
  google.maps.event.addListener(marker, 'dragend', onMarkerDragend);
  markers.push(marker);
}

function onMapClick(e, map) {
  addMarker(e.latLng);
  track.waypoints.push(e.latLng);
  track.updateRoute().then(updateTrackDisplay);
}

function onMarkerClick(e) {
  google.maps.event.clearInstanceListeners(this);
  this.setMap(null);
  var index = markers.indexOf(this);
  markers.splice(index, 1);
  track.waypoints.splice(index, 1);
  track.updateRoute().then(updateTrackDisplay);
}

function onSearch(e) {
  var searchText = $("#txtSearch").val();
  geocoder.geocode({'address': searchText}, function(results, status) {
    if (status === google.maps.GeocoderStatus.OK) {
      map.setCenter(results[0].geometry.location);
      initPath(results[0].geometry.location);
      $("#txtSearch").val("");
    } else {
      console.error("Geocoding failed: " + status);
    }
  });
  e.preventDefault();
  return false;
}

function onMarkerDragend(e) {
  var index = markers.indexOf(this);
  track.waypoints[index] = this.getPosition();
  track.updateRoute().then(updateTrackDisplay);
}

function updateTrackDisplay() {
  routePolyline.setPath(track.route);
  $("#trackStatus").html(track.route.length + " waypoints.");
}

function clearMarkers() {
  markers.forEach(function(marker) {
    marker.setMap(null);
  });
  markers = [];
}

function clearPath() {
  clearMarkers();
  track.setWaypoints([]);
  track.updateRoute().then(updateTrackDisplay);
}

function onClear() {
  clearPath();
}

function onGenerate() {
  updateScene();
}

function onLoop() {
  track.isLoop = $("#checkLoop").is(":checked");
  track.updateRoute().then(updateTrackDisplay);
}

// RENDERER CODE

function initRenderer() {
  camera.position.set(-50, 50, 0);
  camera.up = new THREE.Vector3(0, 1, 0);
  camera.target = new THREE.Vector3(0, 0, 0);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
}

function initScene() {
  // dummy objects
  var originCubeGeometry = new THREE.CubeGeometry(3, 3, 3);
  var originCubeMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    ambient: 0xffffff,
    shading: THREE.FlatShading
  });
  var originCube = new THREE.Mesh(originCubeGeometry, originCubeMaterial);
  scene.add(originCube);
}

function clearEnvironment() {
  environments = {};
}

function offsetForLocation(location) {
  var latDiff = location.lat() - track.waypoints[0].lat();
  var lngDiff = location.lng() - track.waypoints[0].lng();
  var latMpd = latMetersPerDegree(track.waypoints[0].lat());
  var lngMpd = lngMetersPerDegree(track.waypoints[0].lat());
  var eastOffset = lngDiff * lngMpd;
  var northOffset = latDiff * latMpd;
  return new THREE.Vector3(northOffset, 0, eastOffset);
}

function createEnvironment(pano) {
  // create points
  var points = pano.getPoints();
  var offset = offsetForLocation(pano.panoData.location.latLng);
  var geom = new THREE.Geometry();
  var geomMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff, shading: THREE.FlatShading,
    vertexColors: THREE.VertexColors,
    side: THREE.DoubleSide
  });
  var point, color;

  for(var i = 0, l = points.length; i < l; i++) {
    point = points[i].clone().add(offset);
    geom.vertices.push(
      new THREE.Vector3(point.x, point.y - 0.3, point.z - 0.3),
      new THREE.Vector3(point.x, point.y + 0.3, point.z - 0.3),
      new THREE.Vector3(point.x, point.y + 0.3, point.z + 0.3),
      new THREE.Vector3(point.x, point.y - 0.3, point.z + 0.3),
      new THREE.Vector3(point.x - 0.3, point.y - 0.3, point.z),
      new THREE.Vector3(point.x - 0.3, point.y + 0.3, point.z),
      new THREE.Vector3(point.x + 0.3, point.y + 0.3, point.z),
      new THREE.Vector3(point.x + 0.3, point.y - 0.3, point.z));
    color = new THREE.Color(points[i].c);
    geom.faces.push(new THREE.Face3(i*8+0, i*8+1, i*8+2));
    geom.faces.push(new THREE.Face3(i*8+2, i*8+3, i*8+0));
    geom.faces.push(new THREE.Face3(i*8+4+0, i*8+4+1, i*8+4+2));
    geom.faces.push(new THREE.Face3(i*8+4+2, i*8+4+3, i*8+4+0));
    geom.faces[i*4].vertexColors = geom.faces[i*4+1].vertexColors =
      geom.faces[i*4+2].vertexColors = geom.faces[i*4+3].vertexColors =
      [color, color, color];
  }

  var geomMesh = new THREE.Mesh(geom, geomMaterial);

  // create center cube
  var cubeGeometry = new THREE.CubeGeometry(1, 1, 1);
  var cubeMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff, ambient: 0xffffff, shading: THREE.FlatShading});
  var centerCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  centerCube.position.copy(offset);
  scene.add(centerCube);

  environments[pano.panoData.panoId] = {
    geom: geomMesh,
    centerCube: centerCube,
    visible: false
  };
}

function objectsForPano(panoId) {
  if(!environments[panoId]) {
    console.error("Pano " + panoId + " not found."); return []; }
  var objs = [];
  objs.push(environments[panoId].geom);
  objs.push(environments[panoId].centerCube);
  return objs;
}

function showPano(panoId) {
  var objs = objectsForPano(panoId), i, l;
  for(i = 0, l = objs.length; i < l; i++) { scene.add(objs[i]); }
}

function hidePano(panoId) {
  var objs = objectsForPano(panoId), i, l;
  for(i = 0, l = objs.length; i < l; i++) { scene.remove(objs[i]); }
}

function hideAllPanos() {
  for(var panoId in environments) {
    hidePano(panoId);
  }
}

function update() {
  controls.update();
  requestAnimationFrame(update);
}

function render() {
  // controls.update();
  renderer.render(scene, camera);
  // requestAnimationFrame(render);
}

function createEnvironmentAtLocation(location) {
  // load pano
  var pano = new Pano();
  return pano.load(location).then(function() {
    $("#panoContainer").html(pano.panoData.canvas);
    var depthImage = pano.getDepthImage();
    $("#depthContainer").html(depthImage);
    // If we already have it loaded, just proceed to showing
    if(!!environments[pano.panoData.panoId]) { return true; }
    createEnvironment(pano);
  }).then(function() {
    showPano(pano.panoData.panoId);
  });
}

function updateScene() {
  hideAllPanos();
  if(track.waypoints.length === 0) {
    render(); return RSVP.reject("No waypoints."); }
  var promiseChain = RSVP.resolve();
  var numErrors = 0;
  track.route.forEach(function(location, i) {
    promiseChain = promiseChain.then(function() {
      console.info('rendering ' + (i + 1) + ' / ' + track.route.length);
      return createEnvironmentAtLocation(location);
    }).then(function() {
      render();
    }, function(err) {
      numErrors++;
    });
  });
  promiseChain.then(function() {
    if(numErrors) {
      console.warning(numErrors + ' errors.');
    } else {
      console.info('all ok!');
    }
  }, function(err) {
    console.error(err);
  });
}

function init() {
  initMap();
  initUI();
  initPath(initialPosition);
  initRenderer();
  initScene();
  $("#renderContainer").html(renderer.domElement);
  track.updateRoute().then(function() {
    updateTrackDisplay();
    updateScene();
  });
  update();
}

window.onload = init;
