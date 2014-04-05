var TrackGeometry = function(track, panos) {
  THREE.Object3D.call(this);
  this.track = track;
  panos.forEach(function(pano) {
    this.addPano(pano);
  }, this);
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
  var i, s;
  var trackOffset = this.offsetForLocation(pano.location.latLng);

  var up = new THREE.Vector3(0, 1, 0);
  var panoHeading = ((-pano.heading / 180.0) + 1) * Math.PI;

  var pointsGeom = new THREE.Geometry();
  var pointsMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff, shading: THREE.FlatShading,
    vertexColors: THREE.VertexColors,
    side: THREE.DoubleSide});

  var shard, shards = pano.getShards(), col, row, lastVertex, vs;
  var shardsGeom = new THREE.Geometry();
  var texture = new THREE.Texture(pano.panoCanvas);
  var shardsMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    // wireframe: true,
    map: texture
  });
  shardsMaterial.map.needsUpdate = true;

  for(i = 0, l = shards.length; i < l; i++) {
    shard = shards[i];
    for(row = 0; row < shard.rows; row++) {
      for(col = 0; col < shard.cols; col++) {
        vs = [
          (col + 0) * (shard.rows + 1) + row + 0,
          (col + 1) * (shard.rows + 1) + row + 0,
          (col + 1) * (shard.rows + 1) + row + 1,
          (col + 0) * (shard.rows + 1) + row + 1];
        lastVertex = shardsGeom.vertices.length;
        shardsGeom.vertices.push(
          shard.vertices[vs[0]],
          shard.vertices[vs[1]],
          shard.vertices[vs[2]],
          shard.vertices[vs[3]]);
        shardsGeom.faces.push(
          new THREE.Face3(lastVertex + 0, lastVertex + 1, lastVertex + 2),
          new THREE.Face3(lastVertex + 2, lastVertex + 3, lastVertex + 0));
        shardsGeom.faceVertexUvs[0].push(
          [shard.uvs[vs[0]], shard.uvs[vs[1]], shard.uvs[vs[2]]],
          [shard.uvs[vs[2]], shard.uvs[vs[3]], shard.uvs[vs[0]]]);
      }
    }
  }
  var shardsMesh = new THREE.Mesh(shardsGeom, shardsMaterial);
  shardsMesh.setRotationFromAxisAngle(up, panoHeading);
  shardsMesh.position = trackOffset;
  this.add(shardsMesh);

  // create center cube
  var cubeGeometry = new THREE.CubeGeometry(1, 1, 1);
  var cubeMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff, ambient: 0xffffff, shading: THREE.FlatShading});
  var centerCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  centerCube.position.copy(trackOffset);
  this.add(centerCube);
};
