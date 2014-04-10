// RSVP init
RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

// MAP INITIALIZATION
var CLASSIC_TRACKS = [
  [42.346247, -71.098675, 42.346461, -71.099391, 1]
];

var initialTrack;
if(window.location.hash) {
  initialTrack = window.location.hash.substr(1);
} else {
  initialTrack = CLASSIC_TRACKS[Math.floor(
    Math.random() * CLASSIC_TRACKS.length)];
}
var currentTrack = Track.deserialize(initialTrack);

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

function updateScene(track) {

  if(currentTrack) {
    if(currentTrack.isFetching) { currentTrack.cancelFetch(); }
    currentTrack = null;
  }
  if(trackGeom) {
    scene.remove(trackGeom);
    trackGeom = null;
  }

  currentTrack = track;
  window.location.hash = track.serialize();

  $("#trackLoading").fadeIn().html("0%");
  track.fetchPanos(panoCache, function(pano, i) {
    // new pano loaded callback
    $("#trackLoading").show().html(
      Math.floor(100 * (i + 1) / track.route.length) + "%");
  }, function(errorMessage) {
    console.error(errorMessage);
  }).then(function(result) {
    $("#trackLoading").html("100%").fadeOut();
    trackGeom = new TrackGeometry(track, result.panos);
    scene.add(trackGeom);
    render();
  }, function(err) {
    // mostly in case of an interrupt
    console.error(err);
  }).then(function() {
    $("#trackLoading").fadeOut();
  });
}

function createTrackEditor() {
  trackEditor = new TrackEditor('#trackEditorContainer', currentTrack);
  trackEditor.then(function() { updateScene(trackEditor.track); });
  trackEditor.onGenerate = function() { updateScene(trackEditor.track); };
  trackEditor.onCancel = function() {
    closeTrackEditor();
  };
  trackEditor.onRace = function() {
    if(!trackGeom) { return; }
    closeTrackEditor();
  };
  $("#trackEditorPrompt").click(function() {
    openTrackEditor();
  });
}

function openTrackEditor() {
  $("#trackEditorContainer").show();
  $("#trackEditorPrompt").hide();
}

function closeTrackEditor() {
  $("#trackEditorContainer").hide();
  $("#trackEditorPrompt").show();
}


function init() {
  initRenderer();
  $("#renderContainer").html(renderer.domElement);
  window.addEventListener('resize', onWindowResize, false);
  createTrackEditor();
  openTrackEditor();
  update();
}

window.onload = init;
