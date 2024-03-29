/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / https://github.com/WestLangley
 */

THREE.OrbitControls = function (object, domElement) {

  THREE.EventDispatcher.call(this);

  this.object = object;
  this.domElement = ( domElement !== undefined ) ? domElement : document;

  // API

  this.center = new THREE.Vector3();

  this.userZoom = true;
  this.userZoomSpeed = 1.0;

  this.userRotate = true;
  this.userRotateSpeed = 1.0;

  this.userPan = true;
  this.userPanSpeed = 0.6;

  this.autoRotate = false;
  this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

  this.minPolarAngle = 0; // radians
  this.maxPolarAngle = Math.PI; // radians

  this.minDistance = 0.1;
  this.maxDistance = Infinity;
  this.reverseRotationAtDistance = 1;

  // internals

  var scope = this;

  var EPS = 0.000001;
  var PIXELS_PER_ROUND = 1800;

  var up = new THREE.Vector3(0, 1, 0);

  var rotateStart = new THREE.Vector2();
  var rotateEnd = new THREE.Vector2();
  var rotateDelta = new THREE.Vector2();

  var zoomStart = new THREE.Vector2();
  var zoomEnd = new THREE.Vector2();
  var zoomDelta = new THREE.Vector2();

  var panStart = new THREE.Vector2();
  var panEnd = new THREE.Vector2();
  var panDelta = new THREE.Vector2();

  var phiDelta = 0;
  var thetaDelta = 0;
  var scale = 1;

  var lastPosition = new THREE.Vector3();

  var STATE = {NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2};
  var state = STATE.NONE;

  // events

  var changeEvent = {type: 'change'};

  this.rotateLeft = function(angle) {
    if(angle === undefined) { angle = getAutoRotationAngle(); }
    thetaDelta -= angle;
  };

  this.rotateRight = function(angle) {
    if(angle === undefined) { angle = getAutoRotationAngle(); }
    thetaDelta += angle;
  };

  this.rotateUp = function(angle) {
    if (angle === undefined) { angle = getAutoRotationAngle(); }
    phiDelta -= angle;
  };

  this.rotateDown = function(angle) {
    if (angle === undefined) { angle = getAutoRotationAngle(); }
    phiDelta += angle;
  };

  this.zoomIn = function(zoomScale) {
    if (zoomScale === undefined ) { zoomScale = getZoomScale(); }
    scale /= zoomScale;
  };

  this.zoomOut = function(zoomScale) {
    if (zoomScale === undefined ) { zoomScale = getZoomScale(); }
    scale *= zoomScale;
  };

  this.panLeft = function(amount) {
    var pan = this.object.position.clone().sub(this.center)
      .setY(0).normalize()
      .cross(up)
      .multiplyScalar(amount * scope.userPanSpeed);
    this.center.add(pan);
    this.object.position.add(pan);
  };

  this.panUp = function(amount) {
    var pan = this.object.position.clone().sub(this.center)
      .setY(0).normalize()
      .multiplyScalar(amount * scope.userPanSpeed);
    this.center.add(pan);
    this.object.position.add(pan);
  };

  this.update = function () {

    var position = this.object.position;
    var offset = position.clone().sub(this.center);

    // angle from z-axis around y-axis
    var theta = Math.atan2(offset.x, offset.z);

    // angle from y-axis
    var phi = Math.atan2(Math.sqrt(offset.x * offset.x + offset.z * offset.z),
        offset.y);

    if (this.autoRotate) {
      this.rotateLeft(getAutoRotationAngle());
    }

    theta += thetaDelta;
    phi += phiDelta;

    // restrict phi to be between desired limits
    phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, phi));

    // restrict phi to be betwee EPS and PI-EPS
    phi = Math.max(EPS, Math.min(Math.PI - EPS, phi));

    var radius = offset.length() * scale;

    // restrict radius to be between desired limits
    radius = Math.max(this.minDistance, Math.min(this.maxDistance, radius));

    offset.x = radius * Math.sin(phi) * Math.sin(theta);
    offset.y = radius * Math.cos(phi);
    offset.z = radius * Math.sin(phi) * Math.cos(theta);

    position.copy(this.center).add(offset);

    this.object.lookAt(this.center);

    thetaDelta = 0;
    phiDelta = 0;
    scale = 1;

    if (lastPosition.distanceTo(this.object.position) > 0) {
      this.dispatchEvent(changeEvent);
      lastPosition.copy(this.object.position);
    }
  };


  function getAutoRotationAngle() {
    return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
  }

  function getZoomScale() {
    return Math.pow( 0.95, scope.userZoomSpeed );
  }

  function onMouseDown( event ) {
    event.preventDefault();
    if(event.shiftKey) {
      if(scope.userPan) {
        state = STATE.PAN;
        panStart.set(event.clientX, event.clientY);
      }
    } else if(event.button === 0 || event.button === 2) {
      if(scope.userRotate) {
        state = STATE.ROTATE;
        rotateStart.set(event.clientX, event.clientY);
      }
    } else if(event.button === 1) {
      if(scope.userZoom) {
        state = STATE.ZOOM;
        zoomStart.set( event.clientX, event.clientY );
      }
    }
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('mouseup', onMouseUp, false);
  }

  function onMouseMove( event ) {
    event.preventDefault();

    if(state === STATE.ROTATE) {

      rotateEnd.set(event.clientX, event.clientY);
      rotateDelta.subVectors(rotateEnd, rotateStart);

      if(scope.object.position.clone().sub(scope.center).length() <
          scope.reverseRotationAtDistance) {
        rotateDelta.negate();
      }

      scope.rotateLeft(THREE.Math.PI2 * rotateDelta.x /
        PIXELS_PER_ROUND * scope.userRotateSpeed);
      scope.rotateUp(THREE.Math.PI2 * rotateDelta.y /
        PIXELS_PER_ROUND * scope.userRotateSpeed);
      rotateStart.copy(rotateEnd);

    } else if(state === STATE.ZOOM) {

      zoomEnd.set(event.clientX, event.clientY);
      zoomDelta.subVectors(zoomEnd, zoomStart);
      if (zoomDelta.y > 0) { scope.zoomIn(); } else { scope.zoomOut(); }
      zoomStart.copy(zoomEnd);

    } else if(state === STATE.PAN) {
      panEnd.set(event.clientX, event.clientY);
      panDelta.subVectors(panEnd, panStart);
      scope.panLeft(panDelta.x);
      scope.panUp(-panDelta.y);
      panStart.copy(panEnd);
    }
  }

  function onMouseUp( event ) {
    if (!scope.userRotate) return;
    document.removeEventListener( 'mousemove', onMouseMove, false );
    document.removeEventListener( 'mouseup', onMouseUp, false );
    state = STATE.NONE;
  }

  function onMouseWheel( event ) {
    if (!scope.userZoom) return;
    var delta = 0;
    if (event.wheelDelta) { // WebKit / Opera / Explorer 9
      delta = event.wheelDelta;
    } else if (event.detail) { // Firefox
      delta = - event.detail;
    }
    if (delta > 0) { scope.zoomOut(); } else { scope.zoomIn(); }
  }

  this.domElement.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); }, false );
  this.domElement.addEventListener( 'mousedown', onMouseDown, false );
  this.domElement.addEventListener( 'mousewheel', onMouseWheel, false );
  this.domElement.addEventListener( 'DOMMouseScroll', onMouseWheel, false ); // firefox
};

THREE.EventDispatcher.prototype.apply(THREE.OrbitControls.prototype);
