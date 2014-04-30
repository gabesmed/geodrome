var BlankScene = function() {
  THREE.Scene.call(this);
};

BlankScene.prototype = Object.create(THREE.Scene.prototype);

BlankScene.prototype.onResize = function() {};

BlankScene.prototype.destroy = function() {};

BlankScene.prototype.update = function() {};

BlankScene.prototype.render = function(renderer) {};
