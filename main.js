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

// MAP INITIALIZATION
var map, markers = [], waypoints = [], finalRoute = [], routePolyline;
var initialPosition = new google.maps.LatLng(42.345601, -71.098348);
var directionsService = new google.maps.DirectionsService();

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

function initMap() {
  var mapOptions = {
    zoom: 16,
    overviewMapControl: false,
    zoomControl: false,
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
  waypoints = [initialPosition];
  addMarker(initialPosition);
  waypointsDidChange();
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
  waypoints.push(e.latLng);
  waypointsDidChange();
}

function onMarkerClick(e) {
  google.maps.event.clearInstanceListeners(this);
  this.setMap(null);
  var index = markers.indexOf(this);
  markers.splice(index, 1);
  waypoints.splice(index, 1);
  waypointsDidChange();
}

function onMarkerDragend(e) {
  var index = markers.indexOf(this);
  waypoints[index] = this.getPosition();
  waypointsDidChange();
}

function waypointsDidChange() {
  getRoute().then(function(route) {
    finalRoute = route;
    routePolyline.setPath(finalRoute);
    updateScene();
  });
}

function getRoute() {
  if(waypoints.length === 0) { return RSVP.resolve(waypoints); }
  if(waypoints.length === 1) { return RSVP.resolve(waypoints); }
  return fetchDirections().then(function(directionsResponse) {
    return directionsResponse.routes[0].overview_path;
  });
}

function fetchDirections() {
  if(waypoints.length === 0) { return RSVP.reject(); }
  if(waypoints.length === 1) { return RSVP.resolve(); }
  var routeRequest = {
    origin: waypoints[0],
    destination: waypoints[waypoints.length - 1],
    waypoints: waypoints.slice(1, waypoints.length - 1).map(function(pos) {
      return {location: pos, stopover: false};
    }),
    travelMode: google.maps.DirectionsTravelMode.DRIVING
  };
  return new RSVP.Promise(function(resolve, reject) {
    directionsService.route(routeRequest, function(response, status) {
      if (status === google.maps.DirectionsStatus.OK) {
        resolve(response);
      } else {
        reject(status);
      }
    });    
  });
}

// RENDERER CODE

function initRenderer() {
  camera.position.set(-50, 50, 0);
  camera.up = new THREE.Vector3(0, 1, 0);
  camera.target = new THREE.Vector3(0, 0, 0);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
}

var LASER_UNITS = 1;  // each unit of a laser is 1/10 of a meter

function pointsFromPanoAndDepth(panoData, depthMap) {
  var panoImage = panoData.canvas;
  var panoCtx = panoImage.getContext('2d');
  var panoImageData = panoCtx.getImageData(0, 0, panoImage.width,
    panoImage.height);

  // beta/lat, lambda/lng
  var raysLng = 120, raysLat = 60, lngIndex, latIndex, lat, lng, x, y, z, ym;
  var panoX, panoY, panoIndex, depthX, depthY, c, depth, depthZ;
  var n, points = [], colors = [];
  var lngOffset = (Math.PI * 2) * (-panoData.heading / 360.0);
  for(lngIndex = 0; lngIndex < raysLng; lngIndex++) {
    lng = lngOffset + (lngIndex * Math.PI * 2 / raysLng);
    while(lng > Math.PI * 2) { lng -= Math.PI * 2; }
    x = -Math.cos(lng);
    z = Math.sin(lng);
    for(latIndex = 1; latIndex <= raysLat * 0.51; latIndex++) {
      // calculate normal
      lat = Math.PI * 0.5 - (latIndex * Math.PI / raysLat);
      y = Math.sin(lat);
      ym = Math.cos(lat);  // y modifier, how close to center are you
      n = new THREE.Vector3(x * ym, y, z * ym);

      // calculate depth
      depthX = Math.floor(lngIndex * depthMap.width / raysLng);
      depthY = Math.floor(latIndex * depthMap.height / raysLat);
      depthIndex = depthY * depthMap.width + depthX;
      depthZ = depthMap.depthMap[depthIndex];

      // end of sky map; doesn't count!
      // if(depthZ === 255) { continue; }

      depth = depthZ * LASER_UNITS;

      // final point
      n.multiplyScalar(depth);
      points.push(n);

      // calculate color
      panoX = Math.floor(lngIndex * panoImage.width / raysLng);
      panoY = Math.floor(latIndex * panoImage.height / raysLat);
      panoIndex = 4 * (panoY * panoImage.width + panoX);
      c = (panoImageData.data[panoIndex] << 16) +
        (panoImageData.data[panoIndex + 1] << 8) +
        panoImageData.data[panoIndex + 2];
      colors.push(c);
    }
  }
  return {points: points, colors: colors};
}

function initScene() {
  // dummy objects
  var originCubeGeometry = new THREE.CubeGeometry(3, 3, 3);
  var originCubeMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff, ambient: 0xffffff, shading: THREE.FlatShading});
  var originCube = new THREE.Mesh(originCubeGeometry, originCubeMaterial);
  scene.add(originCube);  
}

function clearEnvironment() {
  environments = {};
}

function offsetForLocation(location) {
  var latDiff = location.lat() - waypoints[0].lat();
  var lngDiff = location.lng() - waypoints[0].lng();
  var latMpd = latMetersPerDegree(waypoints[0].lat());
  var lngMpd = lngMetersPerDegree(waypoints[0].lat());
  var eastOffset = lngDiff * lngMpd;
  var northOffset = latDiff * latMpd;
  console.log('lngDiff', lngDiff, 'eastOffset', eastOffset);
  return new THREE.Vector3(northOffset, 0, eastOffset);
}

function createEnvironment(panoData, depthMap) {
  // create points
  var points = pointsFromPanoAndDepth(panoData, depthMap);
  var offset = offsetForLocation(panoData.location.latLng);
  var geom = new THREE.Geometry();
  var geomMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff, shading: THREE.FlatShading,
    vertexColors: THREE.VertexColors,
    side: THREE.DoubleSide
  });
  var point, color;

  for(var i = 0, l = points.points.length; i < l; i++) {
    point = points.points[i].clone().add(offset);
    geom.vertices.push(
      new THREE.Vector3(point.x, point.y - 0.3, point.z - 0.3),
      new THREE.Vector3(point.x, point.y + 0.3, point.z - 0.3),
      new THREE.Vector3(point.x, point.y + 0.3, point.z + 0.3),
      new THREE.Vector3(point.x, point.y - 0.3, point.z + 0.3),
      new THREE.Vector3(point.x - 0.3, point.y - 0.3, point.z),
      new THREE.Vector3(point.x - 0.3, point.y + 0.3, point.z),
      new THREE.Vector3(point.x + 0.3, point.y + 0.3, point.z),
      new THREE.Vector3(point.x + 0.3, point.y - 0.3, point.z));
    color = new THREE.Color(points.colors[i]);
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

  environments[panoData.panoId] = {
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

function drawDepthMap(depthMap) {
  var x, y, depthCanvas, depthContext, depthData, w, h, c;
  depthImage = document.createElement("canvas");
  depthContext = depthImage.getContext('2d');
  w = depthMap.width;
  h = depthMap.height;
  depthImage.setAttribute('width', w);
  depthImage.setAttribute('height', h);
  depthData = depthContext.getImageData(0, 0, w, h);
  for(y=0; y<h; ++y) {
    for(x=0; x<w; ++x) {
      c = depthMap.depthMap[y*w + x] / 50 * 255;
      depthData.data[4*(y*w + x)  ] = c;
      depthData.data[4*(y*w + x) + 1] = c;
      depthData.data[4*(y*w + x) + 2] = c;
      depthData.data[4*(y*w + x) + 3] = 255;
    }
  }
  depthContext.putImageData(depthData, 0, 0);
  return depthImage;
}

function loadPanoAtLocation(location) {
  return new RSVP.Promise(function(resolve, reject) {
    var panoLoader = new GSVPANO.PanoLoader({zoom: 1});
    var panoData;
    panoLoader.onPanoramaData = function(result) {
      panoData = result;
    };
    panoLoader.onPanoramaLoad = function() {
      resolve({
        canvas: this.canvas,
        heading: panoData.tiles.centerHeading,
        location: panoData.location,
        panoId: this.panoId
      });
    };
    panoLoader.onError = function(errorMessage) {
      reject(errorMessage);
    };
    panoLoader.load(location);
  });
}

function loadDepthMap(panoId) {
  return new RSVP.Promise(function(resolve, reject) {
    var depthLoader = new GSVPANO.PanoDepthLoader();
    depthLoader.onDepthLoad = function() {
      resolve(this.depthMap);
    };
    depthLoader.load(panoId);
  });
}

function createEnvironmentAtLocation(location) {
  // load pano
  var panoData;
  return loadPanoAtLocation(location).then(function(result) {
    // add pano canvas to doc
    panoData = result;
    $("#panoContainer").html(panoData.canvas);
    // If we already have it loaded, just proceed to showing
    if(!!environments[panoData.panoId]) { return true; }
    // Otherwise, get the depth map and create the environment.
    return loadDepthMap(panoData.panoId).then(function(depthMap) {
      // draw depth map
      var depthImage = drawDepthMap(depthMap);
      $("#depthContainer").html(depthImage);
      // and init scene
      createEnvironment(panoData, depthMap);
    });
  }).then(function() {
    showPano(panoData.panoId);
  });
}

function updateScene() {
  hideAllPanos();
  if(waypoints.length === 0) { render(); return RSVP.reject("No waypoints."); }
  var promiseChain = RSVP.resolve();
  finalRoute.forEach(function(location, i) {
    promiseChain = promiseChain.then(function() {
      console.info('rendering ' + (i + 1) + ' / ' + finalRoute.length);
      return createEnvironmentAtLocation(location);
    });
  });
  promiseChain.then(function() {
    render();
    console.info('complete!');
  }, function(err) {
    console.error(err);
  });
}

function init() {
  initMap();
  initPath(initialPosition);
  initRenderer();
  initScene();
  $("#renderContainer").html(renderer.domElement);
  update();
}

window.onload = init;
