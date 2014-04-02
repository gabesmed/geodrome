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
var trackEditor = null, track = null;

// RENDERER INITIALIZATION
var scene, camera, renderer, controls;
var environments = {};
var sceneWidth = 800, sceneHeight = 600;
scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(75, sceneWidth / sceneHeight, 0.1, 10000);

renderer = new THREE.WebGLRenderer();
renderer.setSize(sceneWidth, sceneHeight);
renderer.domElement.addEventListener('mousewheel',
  function(e) { e.preventDefault(); }, false );
renderer.domElement.addEventListener('DOMMouseScroll',
  function(e) { e.preventDefault(); }, false );

// CONTROLS
controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.addEventListener('change', render);

// SET UP LIGHTING
scene.add(new THREE.AmbientLight(0xcccccc));
var light = new THREE.DirectionalLight(0xffffff);
light.position.set(-1, 1, 1).normalize();
scene.add(light);

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

function updateScene() {
  track = trackEditor.track;
  hideAllPanos();
  var promiseChain = RSVP.resolve();
  return track.fetchPanos(function(pano) {
    // pano loaded
    $("#panoContainer").html(pano.panoData.canvas);
    var depthImage = pano.getDepthImage();
    $("#depthContainer").html(depthImage);
    // If we already have it loaded, just proceed to showing
    if(!environments[pano.panoData.panoId]) {
      createEnvironment(pano);
    }
    showPano(pano.panoData.panoId);
    render();
  }, function(err) {
    // pano error
    console.error(err);
  }).then(function(result) {
    // all complete
    if(result.numErrors) {
      console.warning(numErrors + ' errors.');
    } else {
      console.info('all ok!');
    }
  }, function(err) {
    // overall error
    console.error(err);
  });
}

function init() {
  initRenderer();
  initScene();
  $("#renderContainer").html(renderer.domElement);

  var initialPath = [new google.maps.LatLng(42.345601, -71.098348)];
  trackEditor = new TrackEditor('#trackEditorContainer', initialPath[0]);
  trackEditor.onGenerate = function() {
    console.log('onGenerate');
    updateScene();
  };
  trackEditor.reset(initialPath).then(function() {
    updateScene();
  });
  update();
}

window.onload = init;
