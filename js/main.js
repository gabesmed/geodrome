// RSVP init
RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

// MAP INITIALIZATION
var trackEditor = null, trackGeom = null;

// RENDERER INITIALIZATION
var scene, camera, renderer, controls;
var environments = {};
var sceneWidth = 800, sceneHeight = 500;
scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(75,
  window.innerWidth / window.innerHeight, 0.1, 10000);

renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
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

var panoCache = new PanoCache();

// RENDERER CODE

function initRenderer() {
  camera.position.set(-50, 100, 0);
  camera.up = new THREE.Vector3(0, 1, 0);
  camera.target = new THREE.Vector3(0, 0, 0);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
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

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateScene() {
  if(trackGeom) { scene.remove(trackGeom); }
  trackEditor.track.fetchPanos(panoCache, function(pano, i) {
    // new pano loaded callback
    console.info('fetching ' + (i + 1) + ' / ' +
      trackEditor.track.route.length);
  }, function(errorMessage) {
    console.error(errorMessage);
  }).then(function(result) {
    // success!
    if(result.numErrors) { console.warn(result.numErrors + ' errors.'); }
    else { console.info('all ok!'); }
    try {
      trackGeom = new TrackGeometry(trackEditor.track, result.panos);
    } catch(err) {
      console.error(err);
    }
    scene.add(trackGeom);
    render();
  }, function(err) {
    console.error(err);
  });
}

function init() {
  initRenderer();
  $("#renderContainer").html(renderer.domElement);
  window.addEventListener('resize', onWindowResize, false);
  var initialPath = [
    new google.maps.LatLng(42.346247, -71.098675),
    new google.maps.LatLng(42.346461, -71.099391)
  ];
  trackEditor = new TrackEditor('#trackEditorContainer', initialPath, true);
  trackEditor.then(function() { updateScene(); });
  trackEditor.onGenerate = function() { updateScene(); };
  update();
}

window.onload = init;
