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
  var sites = panos.map(function(pano) {
    var coord = this.offsetForLocation(pano.location);
    return {x: coord.z, y: coord.x};
  }, this);
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
    return {
      edges: cell.halfedges.map(function(halfedge) {
        var pt0 = halfedge.getStartpoint();
        var pt1 = halfedge.getEndpoint();
        return [
          new THREE.Vector3(pt0.y, 0, pt0.x),
          new THREE.Vector3(pt1.y, 0, pt1.x)];
      })
    };
  });
  return cells;
};

TrackGeometry.prototype.createShard = function(
    shard, cell, geom, clippedGeom) {

  var up = new THREE.Vector3(0, 1, 0);

  for(col = 0; col < shard.cols; col++) {

    var isClipped = false;
    var colL = shard.vertices[(col + 0) * (shard.rows + 1)];
    var colR = shard.vertices[(col + 1) * (shard.rows + 1)];

    for(var c = 0, cl = cell.edges.length; c < cl; c++) {
      var edge = cell.edges[c];
      var vL = colL.clone().sub(edge[0]);
      var vR = colR.clone().sub(edge[0]);
      var edgeNormal = edge[1].clone().sub(edge[0]).normalize().cross(up);
      var dotL = edgeNormal.dot(vL);
      var dotR = edgeNormal.dot(vR);
      if(dotL < 0 && dotR < 0) { isClipped = true; }
    }

    var addToGeom = isClipped ? clippedGeom : geom;

    for(row = 0; row < shard.rows; row++) {
      vs = [
        (col + 0) * (shard.rows + 1) + row + 0,
        (col + 1) * (shard.rows + 1) + row + 0,
        (col + 1) * (shard.rows + 1) + row + 1,
        (col + 0) * (shard.rows + 1) + row + 1];
      lastVertex = addToGeom.vertices.length;
      addToGeom.vertices.push(
        shard.vertices[vs[0]],
        shard.vertices[vs[1]],
        shard.vertices[vs[2]],
        shard.vertices[vs[3]]);
      addToGeom.faces.push(
        new THREE.Face3(lastVertex + 0, lastVertex + 1, lastVertex + 2),
        new THREE.Face3(lastVertex + 2, lastVertex + 3, lastVertex + 0));
      addToGeom.faceVertexUvs[0].push(
        [shard.uvs[vs[0]], shard.uvs[vs[1]], shard.uvs[vs[2]]],
        [shard.uvs[vs[2]], shard.uvs[vs[3]], shard.uvs[vs[0]]]);
    }
  }
};

TrackGeometry.prototype.addPano = function(pano, cell) {
  console.log("**** PANO", pano.panoId);

  var i, s, up = new THREE.Vector3(0, 1, 0);

  var hue = (pano.panoId.hashCode() % 1000) * 0.001;
  var rgb = hsvToRgb(hue, 1.0, 1.0);

  // create pano root
  var panoRoot = new THREE.Object3D();
  var panoOffset = this.offsetForLocation(pano.location);
  var panoHeading = ((-pano.heading / 180.0) + 1) * Math.PI;
  panoRoot.setRotationFromAxisAngle(up, panoHeading);
  panoRoot.position = panoOffset;
  this.add(panoRoot);

  // create voronoi cell
  function reverseXform(pt) {
    return pt.clone().sub(panoOffset).applyAxisAngle(up, -panoHeading);
  }
  var panoCell = {edges: cell.edges.map(function(edge) {
    return [reverseXform(edge[0]), reverseXform(edge[1])];
  })};
  if(cell.edges.length) { this.addVoronoiCell(panoRoot, panoCell, rgb); }

  // create shards
  var shards = pano.getShards();
  var shard, col, row, lastVertex, vs;
  var shardsGeom = new THREE.Geometry();
  var texture = new THREE.Texture(pano.panoCanvas);
  texture.needsUpdate = true;
  var shardsMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(rgb.r, rgb.g, rgb.b),
    // color: 0xffffff,
    // map: texture,
    side: THREE.DoubleSide
  });

  var clippedShardsGeom = new THREE.Geometry();
  var clippedShardsMaterial = new THREE.MeshBasicMaterial({
    color: 0x444444, side: THREE.DoubleSide});

  for(i = 0, l = shards.length; i < l; i++) {
    this.createShard(shards[i], cell, shardsGeom, clippedShardsGeom);
  }

  var shardsMesh = new THREE.Mesh(shardsGeom, shardsMaterial);
  var clippedShardsMesh = new THREE.Mesh(clippedShardsGeom, clippedShardsMaterial);
  panoRoot.add(shardsMesh);
  panoRoot.add(clippedShardsMesh);

  // create viewpoint cube
  var cubeGeometry = new THREE.CubeGeometry(1, 1, 1);
  var cubeMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff, ambient: 0xffffff, shading: THREE.FlatShading});
  var centerCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  panoRoot.add(centerCube);
};

TrackGeometry.prototype.addVoronoiCell = function(panoRoot, cell, rgb) {
  var cellGeom = new THREE.Geometry();
  var up = new THREE.Vector3(0, 1, 0);
  cell.edges.forEach(function(edge) {
    var lastVertex = cellGeom.vertices.length;
    cellGeom.vertices.push(
      edge[0],
      edge[0].clone().add(up.clone().multiplyScalar(-2)),
      edge[1].clone().add(up.clone().multiplyScalar(-2)),
      edge[1]);
    cellGeom.faces.push(
      new THREE.Face3(lastVertex + 0, lastVertex + 1, lastVertex + 2),
      new THREE.Face3(lastVertex + 2, lastVertex + 3, lastVertex + 0));
  });
  var cellMaterial = new THREE.MeshLambertMaterial({
    color: new THREE.Color(rgb.r, rgb.g, rgb.b),
    ambient: new THREE.Color(rgb.r, rgb.g, rgb.b),
    shading: THREE.FlatShading});
  var cellMesh = new THREE.Mesh(cellGeom, cellMaterial);
  panoRoot.add(cellMesh);
};
