var GameScene = function(track, data, domElement) {
  THREE.Scene.call(this);
  var self = this;
  this.orbitCamera = new THREE.PerspectiveCamera(75,
    window.innerWidth / window.innerHeight, 0.1, 10000);
  
  this.orbitCamera.position.set(-50, 100, 0);
  this.orbitCamera.up = new THREE.Vector3(0, 1, 0);
  this.orbitCamera.target = new THREE.Vector3(0, 0, 0);
  this.orbitCamera.lookAt(new THREE.Vector3(0, 0, 0));

  this.needsRefresh = true;

  // CONTROLS
  this.controls = new THREE.OrbitControls(this.orbitCamera,
    domElement);
  this.controls.addEventListener('change', function() {
    self.needsRefresh = true;
  });

  // SET UP LIGHTING
  this.add(new THREE.AmbientLight(0xcccccc));
  var light = new THREE.DirectionalLight(0xffffff);
  light.position.set(-1, 1, 1).normalize();
  this.add(light);

  this.trackGeom = new TrackGeometry(track, data.panos);
  this.add(this.trackGeom);
};

GameScene.prototype = Object.create(THREE.Scene.prototype);

GameScene.prototype.onResize = function() {
  this.orbitCamera.aspect = window.innerWidth / window.innerHeight;
  this.orbitCamera.updateProjectionMatrix();
};

GameScene.prototype.destroy = function() {};

GameScene.prototype.update = function() {
  this.controls.update();
};

GameScene.prototype.render = function(renderer) {
  if(!this.needsRefresh) { return; }
  renderer.render(this, this.orbitCamera);
  this.needsRefresh = false;
};
