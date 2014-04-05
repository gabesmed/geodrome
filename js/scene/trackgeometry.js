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
  var i, s;
  var trackOffset = this.offsetForLocation(pano.panoData.location.latLng);

  // var pointsGeom = new THREE.Geometry();
  // var pointsMaterial = new THREE.MeshLambertMaterial({
  //   color: 0xffffff, shading: THREE.FlatShading,
  //   vertexColors: THREE.VertexColors,
  //   side: THREE.DoubleSide});

  // // create points
  // var point, color, i, l;
  // var points = pano.getPoints();
  // for(i = 0, l = points.length; i < l; i++) {
  //   point = points[i].clone().add(trackOffset);
  //   pointsGeom.vertices.push(
  //     new THREE.Vector3(point.x, point.y - 0.3, point.z - 0.3),
  //     new THREE.Vector3(point.x, point.y + 0.3, point.z - 0.3),
  //     new THREE.Vector3(point.x, point.y + 0.3, point.z + 0.3),
  //     new THREE.Vector3(point.x, point.y - 0.3, point.z + 0.3),
  //     new THREE.Vector3(point.x - 0.3, point.y - 0.3, point.z),
  //     new THREE.Vector3(point.x - 0.3, point.y + 0.3, point.z),
  //     new THREE.Vector3(point.x + 0.3, point.y + 0.3, point.z),
  //     new THREE.Vector3(point.x + 0.3, point.y - 0.3, point.z));
  //   color = new THREE.Color(points[i].c);
  //   pointsGeom.faces.push(
  //     new THREE.Face3(i*8+0, i*8+1, i*8+2),
  //     new THREE.Face3(i*8+2, i*8+3, i*8+0),
  //     new THREE.Face3(i*8+4+0, i*8+4+1, i*8+4+2),
  //     new THREE.Face3(i*8+4+2, i*8+4+3, i*8+4+0));
  //   pointsGeom.faces[i*4].vertexColors =
  //     pointsGeom.faces[i*4+1].vertexColors =
  //     pointsGeom.faces[i*4+2].vertexColors =
  //     pointsGeom.faces[i*4+3].vertexColors =
  //     [color, color, color];
  // }
  // var pointsMesh = new THREE.Mesh(pointsGeom, pointsMaterial);
  // this.add(pointsMesh);

  // create planes

  var shard, shards = pano.getShards(), si, sv0;
  var shardsGeom = new THREE.Geometry();
  var texture = new THREE.Texture(pano.panoData.canvas);
  var shardsMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    // wireframe: true,
    map: texture
  });
  shardsMaterial.map.needsUpdate = true;

  for(i = 0, l = shards.length; i < l; i++) {
    shard = shards[i];
    for(si = 0; si < shard.numStripes; si++) {
      sv0 = shardsGeom.vertices.length;
      shardsGeom.vertices.push(
        shard.vertices[si * 2 + 0].clone().add(trackOffset),
        shard.vertices[si * 2 + 2].clone().add(trackOffset),
        shard.vertices[si * 2 + 3].clone().add(trackOffset),
        shard.vertices[si * 2 + 1].clone().add(trackOffset));
      shardsGeom.faces.push(
        new THREE.Face3(sv0 + 0, sv0 + 1, sv0 + 2),
        new THREE.Face3(sv0 + 2, sv0 + 3, sv0 + 0));
      shardsGeom.faceVertexUvs[0].push(
        [shard.uv[si * 2 + 0], shard.uv[si * 2 + 2], shard.uv[si * 2 + 3]],
        [shard.uv[si * 2 + 3], shard.uv[si * 2 + 1], shard.uv[si * 2 + 0]]);
    }
  }
  var shardsMesh = new THREE.Mesh(shardsGeom, shardsMaterial);
  this.add(shardsMesh);

  // create center cube
  var cubeGeometry = new THREE.CubeGeometry(1, 1, 1);
  var cubeMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff, ambient: 0xffffff, shading: THREE.FlatShading});
  var centerCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  centerCube.position.copy(trackOffset);
  this.add(centerCube);
};
