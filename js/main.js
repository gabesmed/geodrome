// RSVP init
RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

// MAP INITIALIZATION
var CLASSIC_TRACKS = [
  // around the transamerica building in SF (108)
  // '37.795192,-122.402786,37.794830,-122.403810,37.795865,-122.401600,1',
  // around battery park NYC (133)
  // '40.703848,-74.013428,40.704652,-74.014292,1',
  // simple around fenway park BOS (47)
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
var currentScene = new BlankScene();
var trackEditor = null, trackGeom = null;

// RENDERER INITIALIZATION
var renderer;

renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.addEventListener('mousewheel',
  function(e) { e.preventDefault(); }, false );
renderer.domElement.addEventListener('DOMMouseScroll',
  function(e) { e.preventDefault(); }, false );

var panoCache = new PanoCache();

// RENDERER CODE

function update() {
  currentScene.update();
  currentScene.render(renderer);
  requestAnimationFrame(update);
}

function onWindowResize() {
  currentScene.onResize();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}

function updateScene(track) {

  if(currentTrack) {
    if(currentTrack.isFetching) { currentTrack.cancelFetch(); }
    currentTrack = null;
  }
  currentScene.destroy();
  currentTrack = track;
  window.location.hash = track.serialize();

  $("#trackLoading").fadeIn().html("0%");
  track.fetchPanos(panoCache, function(pano, i) {
    // new pano loaded callback
    $("#trackLoading").show().html(
      Math.floor(100 * (i + 1) / track.route.length) + "%");
  }, function(err) {
    console.error(err);
  }).then(function(result) {
    $("#trackLoading").html("100%").fadeOut();
    console.log('Tracks loaded! ' + result.panos.length + ' ok, ' +
      result.notFound.length + ' not found, ' +
      result.errors.length + ' errors.' );
    currentScene = new GameScene(track, result, renderer.domElement);
    render();
  }).then(null, function(err) {
    // mostly in case of an interrupt
    console.error("Loading tracks failed.");
  }).then(function() {
    $("#trackLoading").fadeOut();
  });
}

function createTrackEditor() {
  trackEditor = new TrackEditor('#trackEditorContainer', currentTrack);
  trackEditor.then(function() { updateScene(trackEditor.track); });
  trackEditor.onGenerate = function() { updateScene(trackEditor.track); };
  trackEditor.onCancel = function() { closeTrackEditor(); };
  trackEditor.onRace = function() { if(trackGeom) { closeTrackEditor(); } };
  $("#trackEditorPrompt").click(function() { openTrackEditor(); });
}

function openTrackEditor() {
  $("#trackEditorContainer").show();
  google.maps.event.trigger(trackEditor.map, "resize");
  $("#trackEditorPrompt").hide();
}

function closeTrackEditor() {
  $("#trackEditorContainer").hide();
  $("#trackEditorPrompt").show();
}


function init() {
  $("#renderContainer").html(renderer.domElement);
  window.addEventListener('resize', onWindowResize, false);
  createTrackEditor();
  openTrackEditor();
  update();
}

window.onload = init;
