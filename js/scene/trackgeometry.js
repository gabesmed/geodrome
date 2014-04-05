var TrackGeometry = function(track, panos) {
  THREE.Object3D.call(this);
  this.track = track;
  if(!this.track.waypoints.length) { throw new Error("Empty track"); }

  var cells = this.calculateVoronoi(panos);
  panos.forEach(function(pano, i) {
    this.addPano(pano, cells[i]);
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

TrackGeometry.prototype.calculateVoronoi = function(panos) {
  // calculate pano coordinates
  var sites = panos.map(function(pano) {
    var coord = this.offsetForLocation(pano.location);
    return {x: coord.z, y: coord.x};
  }, this);
  this.sites = sites;
  // and bounding box
  var bounds = {
    xl: sites[0].x, xr: sites[0].x,
    yt: sites[0].y, yb: sites[0].y
  };
  sites.forEach(function(site) {
    if(site.x < bounds.xl) { bounds.xl = site.x; }
    if(site.x > bounds.xr) { bounds.xr = site.x; }
    if(site.y < bounds.yt) { bounds.yt = site.y; }
    if(site.y > bounds.yb) { bounds.yb = site.y; }
  });
  var boundsMargin = 100; // meters
  bounds.xl -= boundsMargin; bounds.xr += boundsMargin;
  bounds.yt -= boundsMargin; bounds.yb += boundsMargin;
  var voronoi = new Voronoi().compute(sites, bounds);
  var cells = voronoi.cells.map(function(cell) {
    var coords = [], pt;
    pt = cell.halfedges[0].getStartpoint();
    coords.push(new THREE.Vector3(pt.y, 0, pt.x));
    cell.halfedges.forEach(function(halfedge) {
      pt = halfedge.getEndpoint();
      coords.push(new THREE.Vector3(pt.y, 0, pt.x));
    });
    return {coords: coords};
  });
  return cells;
};

TrackGeometry.prototype.addPano = function(pano, cell) {
  // create materials
  var i, s, up = new THREE.Vector3(0, 1, 0);
  var panoOffset = this.offsetForLocation(pano.location);
  var panoHeading = ((-pano.heading / 180.0) + 1) * Math.PI;

  var shards = pano.getShards();
  var shard, col, row, lastVertex, vs;
  var shardsGeom = new THREE.Geometry();
  var texture = new THREE.Texture(pano.panoCanvas);
  texture.needsUpdate = true;
  var shardsMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff, side: THREE.DoubleSide, map: texture});

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
  shardsMesh.position = panoOffset;
  this.add(shardsMesh);

  // create pano cube
  var cubeGeometry = new THREE.CubeGeometry(1, 1, 1);
  var cubeMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff, ambient: 0xffffff, shading: THREE.FlatShading});
  var centerCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  centerCube.position.copy(panoOffset);
  this.add(centerCube);

  // add voronoi cell
  this.addVoronoiCell(cell);
};

TrackGeometry.prototype.addVoronoiCell = function(cell) {
  var cellGeom = new THREE.Geometry();
  var up = new THREE.Vector3(0, 1, 0);
  for(var i = 0; i < cell.coords.length - 1; i++) {
    var v0 = cell.coords[i];
    var v1 = cell.coords[i + 1];
    var lastVertex = cellGeom.vertices.length;
    cellGeom.vertices.push(
      v0.clone(),
      v0.clone().add(up.clone().multiplyScalar(-2)),
      v1.clone().add(up.clone().multiplyScalar(-2)),
      v1.clone());
    cellGeom.faces.push(
      new THREE.Face3(lastVertex + 0, lastVertex + 1, lastVertex + 2),
      new THREE.Face3(lastVertex + 2, lastVertex + 3, lastVertex + 0));
  }
  var cellMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff, ambient: 0xffffff, shading: THREE.FlatShading});
  var cellMesh = new THREE.Mesh(cellGeom, cellMaterial);
  this.add(cellMesh);
};
