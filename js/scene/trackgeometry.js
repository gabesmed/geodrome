var TrackGeometry = function(track, panos) {
  THREE.Object3D.call(this);
  this.track = track;
  if(!this.track.waypoints.length) { throw new Error("Empty track"); }
  this.up = new THREE.Vector3(0, 1, 0);
  this.createGeometry(panos);
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
  var cells = sites.map(function(site) {
    var cell = voronoi.cells.filter(
      function(c) { return c.site === site; })[0];
    var edges = cell.halfedges.map(function(halfedge) {
      var pt0 = halfedge.getStartpoint(),
          pt1 = halfedge.getEndpoint();
      return [
        new THREE.Vector3(pt0.y, 0, pt0.x),
        new THREE.Vector3(pt1.y, 0, pt1.x)];
    });
    return {edges: edges};
  });
  return cells;
};

TrackGeometry.prototype.isSegInsideCell = function(s0, s1, cell, strict) {
  if(strict === undefined) { strict = false; }
  for(var c = 0, cl = cell.edges.length; c < cl; c++) {
    var edge = cell.edges[c];
    var v01 = edge[1].clone().sub(edge[0]);
    var v0L = s0.clone().sub(edge[0]);
    var v0R = s1.clone().sub(edge[0]);
    var n = v01.normalize().cross(this.up);
    var dot0L = n.dot(v0L);
    var dot0R = n.dot(v0R);
    if(dot0L < 0 && dot0R < 0) { return false; }
    if(dot0L < 0 || dot0R < 0) { if(strict) { return false; } }
  }
  return true;
};

TrackGeometry.prototype.getShardsOverlapping = function(
    panoIndex, shardIndex) {
  var shard = this.shardsLists[panoIndex][shardIndex], testShard;
  var shardMatrix = this.panoMatrices[panoIndex];
  var s0 = shard.vertices[0].clone().applyMatrix4(shardMatrix);
  var s1 = shard.vertices[shard.cols * (shard.rows + 1)]
    .clone().applyMatrix4(shardMatrix);
  var sray = s1.clone().sub(s0).normalize();
  var slength = s1.clone().sub(s0).length();

  var maxDist = 1;

  var overlappingShards = [], numPanos = this.shardsLists.length, numShards,
    s, p, t0, t1, testMatrix, t0diff, t1diff, t0dot, t1dot, t0dist, t1dist, t0along, t1along;
  for(p = 0; p < numPanos; p++) {
    // skip shards in same panorama, as they won't overlap each other.
    if(p === panoIndex) { continue; }
    numShards = this.shardsLists[p].length;
    testMatrix = this.panoMatrices[p];
    for(s = 0; s < numShards; s++) {
      testShard = this.shardsLists[p][s];
      t0 = testShard.vertices[0].clone().applyMatrix4(testMatrix);
      t1 = testShard.vertices[testShard.cols * (testShard.rows + 1)]
        .clone().applyMatrix4(testMatrix);
      t0diff = t0.clone().sub(s0);
      t0dot = t0diff.clone().normalize().dot(sray);
      t0dist = (1 - Math.abs(t0dot)) * t0diff.length();
      if(t0dist > maxDist) { continue; } // t0 is too far away to overlap
      t1diff = t1.clone().sub(s0);
      t1dot = t1diff.clone().normalize().dot(sray);
      t1dist = (1 - Math.abs(t1dot)) * t1diff.length();
      if(t1dist > maxDist) { continue; } // t1 is too far away to overlap
      t0along = t0diff.dot(sray);
      t1along = t1diff.dot(sray);
      if(t0along < 0 && t1along < 0) { continue; } // both before plane starts
      // both after ends
      if(t0along > slength && t1along > slength) { continue; }
      overlappingShards.push(testShard);
    }
  }
  return overlappingShards;
};

TrackGeometry.prototype.createShard = function(
    panoIndex, shardIndex, cell, geom, clippedGeom) {

  var shard = this.shardsLists[panoIndex][shardIndex];
  var shardL = shard.vertices[0];
  var shardR = shard.vertices[shard.cols * (shard.rows + 1)];
  var isShardWithinCell = this.isSegInsideCell(shardL, shardR, cell, true);
  var doesShardTouchCell = this.isSegInsideCell(shardL, shardR, cell);

  var isShardTouchingOther = this.getShardsOverlapping(panoIndex, shardIndex);

  var colL, colR, colIsVisible, isColInsideCell, addToGeom;
  for(col = 0; col < shard.cols; col++) {
    // check if this column is inside the cell. If it is not, clip it.
    if(isShardWithinCell) {
      isColInsideCell = true;
    } else if(doesShardTouchCell) {
      colL = shard.vertices[(col + 0) * (shard.rows + 1)];
      colR = shard.vertices[(col + 1) * (shard.rows + 1)];
      isColInsideCell = this.isSegInsideCell(colL, colR, cell);
    } else {
      isColInsideCell = false;
    }
    if(isColInsideCell) {
      colIsVisible = true;
    } else {
      // if col is not inside cell, check if there are any overlapping bits
      // If not, use it. Otherwise, hide.
      if(isShardTouchingOther.length > 0) {
        colIsVisible = false;
      } else {
        colIsVisible = true;
      }
    }
    addToGeom = colIsVisible ? geom : clippedGeom;

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

TrackGeometry.prototype.createGeometry = function(panos) {
  this.panos = panos;
  this.cells = this.calculateVoronoi(panos);
  this.panoRoots = [];
  this.panoMatrices = [];
  this.shardsLists = [];
  panos.forEach(function(pano) {
    // create root object for each panorama
    var panoRoot = new THREE.Object3D();
    var panoOffset = this.offsetForLocation(pano.location);
    var panoHeading = ((-pano.heading / 180.0) + 1) * Math.PI;
    var panoMatrix = new THREE.Matrix4();
    panoMatrix.makeRotationAxis(this.up, panoHeading);
    panoMatrix.setPosition(panoOffset);
    panoRoot.applyMatrix(panoMatrix);
    this.panoMatrices.push(panoMatrix);
    this.panoRoots.push(panoRoot);
    this.add(panoRoot);
    // and create shards list.
    var shards = pano.getShards();
    this.shardsLists.push(shards);
  }, this);
  for(var i = 0, l = panos.length; i < l; i++) {
    this.createPano(i);
  }
};

TrackGeometry.prototype.createPano = function(panoIndex) {

  var pano = this.panos[panoIndex];
  var cell = this.cells[panoIndex];
  var shards = this.shardsLists[panoIndex];
  var panoRoot = this.panoRoots[panoIndex];
  var panoMatrix = this.panoMatrices[panoIndex];

  var shardIndex;
  var hue = (panoIndex % 13) / 13.0;
  var rgb = hsvToRgb({h: hue, s: 1.0, v: 1.0});
  var color = new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255);

  // create voronoi cell
  var panoInverse = new THREE.Matrix4().getInverse(panoMatrix);
  var panoCell = {edges: cell.edges.map(function(edge) {
    return [
      edge[0].clone().applyMatrix4(panoInverse),
      edge[1].clone().applyMatrix4(panoInverse)];
  })};
  if(cell.edges.length) { this.addVoronoiCell(panoRoot, panoCell, color); }

  // create shards
  var shard, col, row, lastVertex, vs;
  var shardsGeom = new THREE.Geometry();
  var texture = new THREE.Texture(pano.panoCanvas);
  texture.needsUpdate = true;
  var shardsMaterial = new THREE.MeshBasicMaterial({
    // color: color,
    color: 0xffffff,
    map: texture,
    side: THREE.DoubleSide
  });

  var clippedShardsGeom = new THREE.Geometry();
  var clippedShardsMaterial = new THREE.MeshBasicMaterial({
    // color: 0x444444,
    visible: false,
    color: color,
    side: THREE.DoubleSide, wireframe: true
  });

  var numShards = shards.length;
  for(shardIndex = 0; shardIndex < numShards; shardIndex++) {
    this.createShard(panoIndex, shardIndex, panoCell,
      shardsGeom, clippedShardsGeom);
  }

  var shardsMesh = new THREE.Mesh(shardsGeom, shardsMaterial);
  var clippedShardsMesh = new THREE.Mesh(
    clippedShardsGeom, clippedShardsMaterial);
  panoRoot.add(shardsMesh);
  panoRoot.add(clippedShardsMesh);

  // create viewpoint cube
  var cubeGeometry = new THREE.CubeGeometry(1, 1, 1);
  var cubeMaterial = new THREE.MeshLambertMaterial({
    color: color, ambient: color, shading: THREE.FlatShading});
  var centerCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  panoRoot.add(centerCube);
};

TrackGeometry.prototype.addVoronoiCell = function(panoRoot, cell, color) {
  var cellGeom = new THREE.Geometry();
  cell.edges.forEach(function(edge) {
    var lastVertex = cellGeom.vertices.length;
    cellGeom.vertices.push(
      edge[0].clone().add(this.up.clone().multiplyScalar(-4)),
      edge[0].clone().add(this.up.clone().multiplyScalar(-5)),
      edge[1].clone().add(this.up.clone().multiplyScalar(-5)),
      edge[1].clone().add(this.up.clone().multiplyScalar(-4)));
    cellGeom.faces.push(
      new THREE.Face3(lastVertex + 0, lastVertex + 1, lastVertex + 2),
      new THREE.Face3(lastVertex + 2, lastVertex + 3, lastVertex + 0));
  }, this);
  var cellMaterial = new THREE.MeshLambertMaterial({
    color: color,
    ambient: color,
    shading: THREE.FlatShading});
  var cellMesh = new THREE.Mesh(cellGeom, cellMaterial);
  panoRoot.add(cellMesh);
};
