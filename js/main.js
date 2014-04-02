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
var trackEditor = null, trackGeom = null;

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
  var originCubeMaterial = new THREE.MeshLambertMaterial(
    {color: 0xffffff, ambient: 0xffffff, shading: THREE.FlatShading});
  var originCube = new THREE.Mesh(originCubeGeometry, originCubeMaterial);
  scene.add(originCube);
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
  if(trackGeom) { scene.remove(trackGeom); }
  trackGeom = new TrackGeometry(trackEditor.track);
  scene.add(trackGeom);

  trackEditor.track.fetchPanos(function(pano) {
    // pano loaded
    $("#panoContainer").html(pano.panoData.canvas);
    $("#depthContainer").html(pano.getDepthImage());
    trackGeom.addPano(pano);
    render();
  }).then(function(result) {
    if(result.numErrors) { console.warning(numErrors + ' errors.'); }
    else { console.info('all ok!'); }
  });
}

function init() {
  initRenderer();
  initScene();
  $("#renderContainer").html(renderer.domElement);

  var initialPath = [new google.maps.LatLng(42.345601, -71.098348)];
  trackEditor = new TrackEditor('#trackEditorContainer', initialPath[0]);
  trackEditor.onGenerate = function() { updateScene(); };
  trackEditor.reset(initialPath).then(function() { updateScene(); });
  update();
}

window.onload = init;
