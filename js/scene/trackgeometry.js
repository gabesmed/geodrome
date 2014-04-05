var TrackGeometry = function(track) {
  THREE.Object3D.call(this);
  this.track = track;
};

TrackGeometry.prototype = Object.create(THREE.Object3D.prototype);

TrackGeometry.prototype.offsetForLocation = function(location) {
  var latDiff = location.lat() - this.track.waypoints[0].lat();
  var lngDiff = location.lng() - this.track.waypoints[0].lng();
  var latMpd = latMetersPerDegree(this.track.waypoints[0].lat());
  var lngMpd = lngMetersPerDegree(this.track.waypoints[0].lat());
  var eastOffset = lngDiff * lngMpd;
  var northOffset = latDiff * latMpd;
  return new THREE.Vector3(northOffset, 0, eastOffset);
};

TrackGeometry.prototype.addPano = function(pano) {
  // create materials
  var trackOffset = this.offsetForLocation(pano.panoData.location.latLng);
  var pointsGeom = new THREE.Geometry();
  var pointsMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff, shading: THREE.FlatShading,
    vertexColors: THREE.VertexColors,
    side: THREE.DoubleSide});

  // create points
  var point, color, i, l;
  var points = pano.getPoints();
  for(i = 0, l = points.length; i < l; i++) {
    point = points[i].clone().add(trackOffset);
    pointsGeom.vertices.push(
      new THREE.Vector3(point.x, point.y - 0.3, point.z - 0.3),
      new THREE.Vector3(point.x, point.y + 0.3, point.z - 0.3),
      new THREE.Vector3(point.x, point.y + 0.3, point.z + 0.3),
      new THREE.Vector3(point.x, point.y - 0.3, point.z + 0.3),
      new THREE.Vector3(point.x - 0.3, point.y - 0.3, point.z),
      new THREE.Vector3(point.x - 0.3, point.y + 0.3, point.z),
      new THREE.Vector3(point.x + 0.3, point.y + 0.3, point.z),
      new THREE.Vector3(point.x + 0.3, point.y - 0.3, point.z));
    color = new THREE.Color(points[i].c);
    pointsGeom.faces.push(
      new THREE.Face3(i*8+0, i*8+1, i*8+2),
      new THREE.Face3(i*8+2, i*8+3, i*8+0),
      new THREE.Face3(i*8+4+0, i*8+4+1, i*8+4+2),
      new THREE.Face3(i*8+4+2, i*8+4+3, i*8+4+0));
    pointsGeom.faces[i*4].vertexColors =
      pointsGeom.faces[i*4+1].vertexColors =
      pointsGeom.faces[i*4+2].vertexColors =
      pointsGeom.faces[i*4+3].vertexColors =
      [color, color, color];
  }
  var pointsMesh = new THREE.Mesh(pointsGeom, pointsMaterial);
  this.add(pointsMesh);

  // create planes
  var plane, planes = pano.getPlanes();
  var planesGeom = new THREE.Geometry();
  var planesMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff, vertexColors: THREE.VertexColors,
    shading: THREE.FlatShading, side: THREE.DoubleSide});

  for(i = 0, l = planes.length; i < l; i++) {
    plane = planes[i];
    planesGeom.vertices.push(
      plane.vertices[0].clone().add(trackOffset),
      plane.vertices[1].clone().add(trackOffset),
      plane.vertices[2].clone().add(trackOffset),
      plane.vertices[3].clone().add(trackOffset));
    planesGeom.faces.push(
      new THREE.Face3(i*4+0, i*4+1, i*4+2),
      new THREE.Face3(i*4+2, i*4+3, i*4+0));
    color = new THREE.Color((plane.rgb.r << 16) +
      (plane.rgb.g << 8) + plane.rgb.b);
    planesGeom.faces[i*2].vertexColors =
      planesGeom.faces[i*2+1].vertexColors =
      [color, color, color];
  }
  var planesMesh = new THREE.Mesh(planesGeom, planesMaterial);
  this.add(planesMesh);

  // create center cube
  var cubeGeometry = new THREE.CubeGeometry(1, 1, 1);
  var cubeMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff, ambient: 0xffffff, shading: THREE.FlatShading});
  var centerCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  centerCube.position.copy(trackOffset);
  this.add(centerCube);
};
